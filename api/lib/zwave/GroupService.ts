/**
 * GroupService – owns all multicast-group collection/persistence state, CRUD
 * with physical-node validation, and the group virtual-node lifecycle
 * (creation/update/value-projection/socket emission) driven by group
 * membership changes.
 *
 * Extracted from ZwaveClient to keep the monolith slim. The service is
 * strict-clean (no `any` casts, no non-null assertions, no ts-ignore).
 *
 * Broadcast virtual nodes (standard + LR) are NOT part of this service –
 * they're lifecycle-owned by ZwaveClient (driver-ready / node-added /
 * node-removed hooks) and out of scope for this extraction. They share the
 * same live virtual-node instance registry, so `GroupVirtualNodeRegistryPort`
 * is a thin pass-through to that shared `Map` rather than state owned here.
 *
 * Ports:
 *   driver        – resolves current driver/controller readiness + multicast
 *                    group creation across restarts
 *   virtualNodes  – shared live VirtualNode instance registry (multicast +
 *                    broadcast), owned by ZwaveClient
 *   zuiNodes      – ZUINode registry access (get/set/delete by id)
 *   socket        – socket emission + event bus notifications
 *   utils         – shared helpers ZwaveClient still owns (ValueID
 *                    stringification, virtual ZUINode/value-id construction –
 *                    reused by the broadcast lifecycle too – and throttling,
 *                    plus a logger for internal error reporting)
 *   persistence   – read/write groups.json via jsonStore
 */

import { NODE_ID_BROADCAST, NODE_ID_BROADCAST_LR } from '@zwave-js/core'
import { getErrorMessage } from '../errors.ts'
import { socketEvents } from '../SocketEvents.ts'
import type {
	GroupDriverPort,
	GroupVirtualNodeRegistryPort,
	GroupZUINodeStorePort,
	GroupSocketPort,
	GroupUtilsPort,
	GroupPersistencePort,
	ServiceLogger,
	ZUIGroup,
} from './ports.ts'

/** Maximum length of a multicast group name (avoids bloating MQTT topics). */
const GROUP_NAME_MAX_LENGTH = 64

/**
 * Lower bound for auto-assigned multicast-group virtual-node IDs. Chosen
 * above the LR address space so they never collide with physical or
 * broadcast nodes.
 */
const GROUP_ID_MIN = 0x1000

export class GroupService {
	private _groups: ZUIGroup[]

	/**
	 * Index of physical nodeId → groupIds containing it. Rebuilt on group
	 * create/update/delete so per-value-change lookups are O(1) instead of
	 * O(groups).
	 */
	private readonly _nodeToGroups: Map<number, Set<number>> = new Map()

	private readonly _driver: GroupDriverPort
	private readonly _virtualNodes: GroupVirtualNodeRegistryPort
	private readonly _zuiNodes: GroupZUINodeStorePort
	private readonly _socket: GroupSocketPort
	private readonly _utils: GroupUtilsPort
	private readonly _persistence: GroupPersistencePort
	private readonly _logger: ServiceLogger

	constructor(
		driver: GroupDriverPort,
		virtualNodes: GroupVirtualNodeRegistryPort,
		zuiNodes: GroupZUINodeStorePort,
		socket: GroupSocketPort,
		utils: GroupUtilsPort,
		persistence: GroupPersistencePort,
		logger: ServiceLogger,
		initialGroups: ZUIGroup[],
	) {
		this._driver = driver
		this._virtualNodes = virtualNodes
		this._zuiNodes = zuiNodes
		this._socket = socket
		this._utils = utils
		this._persistence = persistence
		this._logger = logger
		this._groups = initialGroups
		this._rebuildNodeToGroupsIndex()
	}

	// ---------------------------------------------------------------
	// Internal helpers
	// ---------------------------------------------------------------

	/**
	 * Validate and normalize a group name.
	 */
	private _validateGroupName(name: string): string {
		const trimmed = name?.trim()
		if (!trimmed) {
			throw new Error('Group name is required')
		}
		if (trimmed.length > GROUP_NAME_MAX_LENGTH) {
			throw new Error(
				`Group name must be at most ${GROUP_NAME_MAX_LENGTH} characters`,
			)
		}
		return trimmed
	}

	/**
	 * Filter and validate node IDs for group creation/update.
	 * Removes duplicates, controller node, broadcast IDs, virtual-group IDs,
	 * and any IDs not present in the controller's physical nodes map.
	 */
	private _filterGroupNodeIds(nodeIds: number[]): number[] {
		const ownNodeId = this._driver.getOwnNodeId()
		const filtered = [...new Set(nodeIds)].filter(
			(id) =>
				typeof id === 'number' &&
				Number.isInteger(id) &&
				id > 0 &&
				id !== ownNodeId &&
				id !== NODE_ID_BROADCAST &&
				id !== NODE_ID_BROADCAST_LR &&
				id < GROUP_ID_MIN &&
				this._driver.hasPhysicalNode(id),
		)

		if (filtered.length < 2) {
			throw new Error('At least 2 valid nodes are required for a group')
		}

		return filtered
	}

	/**
	 * Get next available group ID (>= GROUP_ID_MIN).
	 */
	private _getNextGroupId(): number {
		const existingIds = new Set(this._groups.map((g) => g.id))
		let nextId = GROUP_ID_MIN
		while (existingIds.has(nextId)) {
			nextId++
		}
		return nextId
	}

	/**
	 * Rebuild the nodeId → groupIds index. Called whenever the groups list
	 * changes so per-value-change lookups stay O(1) instead of O(groups).
	 */
	private _rebuildNodeToGroupsIndex(): void {
		this._nodeToGroups.clear()
		for (const group of this._groups) {
			for (const nodeId of group.nodeIds) {
				let set = this._nodeToGroups.get(nodeId)
				if (!set) {
					set = new Set()
					this._nodeToGroups.set(nodeId, set)
				}
				set.add(group.id)
			}
		}
	}

	/**
	 * Update virtual node for multicast group.
	 */
	private _updateVirtualNode(group: ZUIGroup): void {
		const virtualNode = this._zuiNodes.get(group.id)
		if (!virtualNode) {
			// Create if doesn't exist
			this.createVirtualNode(group)
			return
		}

		virtualNode.name = group.name

		// Update virtual node values based on member nodes
		this._updateVirtualNodeValues(group)

		// Emit node updated event
		this._socket.emitNodeUpdate(virtualNode, { name: virtualNode.name })
	}

	/**
	 * Populate values for a multicast group virtual node.
	 *
	 * zwave-js `VirtualNode.getDefinedValueIDs()` returns the **union** of all
	 * writeable actuator value IDs across every physical member node, plus
	 * Basic CC (always added so heterogeneous groups can be controlled
	 * together). This means a group may expose CCs that only some members
	 * support — nodes that don't will simply ignore the command.
	 *
	 * For each value we aggregate the current state of all member nodes:
	 * if every member has the same value it is shown, otherwise `undefined`.
	 */
	private _updateVirtualNodeValues(group: ZUIGroup): void {
		const virtualNode = this._zuiNodes.get(group.id)
		if (!virtualNode) return

		const multicastGroup = this._virtualNodes.get(group.id)
		if (!multicastGroup) return

		try {
			const definedValueIDs = multicastGroup.getDefinedValueIDs()

			virtualNode.values = {}

			for (const zwaveValue of definedValueIDs) {
				const vId = this._utils.getValueId(zwaveValue)

				// Aggregate values from member nodes that support this CC.
				// Show the value if all supporting members agree, otherwise
				// undefined.
				const memberValues = group.nodeIds
					.map((id) => this._zuiNodes.get(id)?.values?.[vId]?.value)
					.filter((v) => v !== undefined && v !== null)
				const allSame =
					memberValues.length > 0 &&
					memberValues.every((v) =>
						this._utils.deepEqual(v, memberValues[0]),
					)

				const valueId = this._utils.buildVirtualValueId(
					group.id,
					zwaveValue,
					allSame ? memberValues[0] : undefined,
				)
				if (!valueId) continue

				virtualNode.values[vId] = valueId
			}

			// Emit valueChanged for each value so the MQTT gateway
			// publishes them and registers topics for write-back
			for (const vId in virtualNode.values) {
				this._socket.emitValueChanged(
					virtualNode.values[vId],
					virtualNode,
					true,
				)
			}

			this._socket.emitNodeUpdate(virtualNode, {
				values: virtualNode.values,
			})
		} catch (error) {
			this._logger.error(
				`Error updating virtual node values for group ${group.id}: ${getErrorMessage(
					error,
				)}`,
			)
		}
	}

	// ---------------------------------------------------------------
	// Public API – exact signatures preserved from ZwaveClient
	// ---------------------------------------------------------------

	/**
	 * Materialize (or re-materialize) the ZUINode shell + initial values for a
	 * multicast group.
	 *
	 * Despite the name, this runs in three scenarios:
	 *   1. **Driver startup / restore** — ZwaveClient's driver-ready handler
	 *      iterates persisted groups and calls this to (re)build their live
	 *      `VirtualNode` instance and ZUI shell. The live instance is *not*
	 *      yet registered, so it is created here.
	 *   2. **After `createGroup` succeeds** — the live `VirtualNode` was
	 *      already eagerly registered (so a driver-side rejection happens
	 *      before we mutate persistent state); this call only needs to build
	 *      the ZUI shell.
	 *   3. **As a fallback inside `_updateVirtualNode`** when the ZUI shell is
	 *      missing for an existing live instance.
	 *
	 * The registry `has(group.id)` guard short-circuits case (2)/(3) and
	 * lazily creates the live instance for case (1).
	 */
	createVirtualNode(group: ZUIGroup): void {
		if (!this._driver.isDriverReady()) return

		try {
			if (!this._virtualNodes.has(group.id)) {
				const multicastGroup = this._driver.getMulticastGroup(
					group.nodeIds,
				)
				this._virtualNodes.set(group.id, multicastGroup)
			}

			const virtualNode = this._utils.newVirtualZUINode(
				group.id,
				group.name,
				'multicast',
			)

			this._zuiNodes.set(group.id, virtualNode)

			// Emit node update (not nodeAdded, which expects {node, result}
			// and shows a confirmation dialog)
			this._socket.sendToSocket(socketEvents.nodeUpdated, virtualNode)

			this._updateVirtualNodeValues(group)
		} catch (error) {
			this._logger.error(
				`Error creating virtual node for group ${group.id}: ${getErrorMessage(
					error,
				)}`,
			)
		}
	}

	/**
	 * Update virtual nodes when a member node's value changes.
	 * Throttled to avoid excessive rebuilds on frequent value updates.
	 */
	updateVirtualNodesForNode(nodeId: number): void {
		const groupIds = this._nodeToGroups.get(nodeId)
		if (!groupIds || groupIds.size === 0) return

		for (const groupId of groupIds) {
			const group = this._groups.find((g) => g.id === groupId)
			if (!group) continue
			this._utils.throttle(
				`virtual_node_update_${group.id}`,
				() => {
					this._updateVirtualNodeValues(group)
				},
				1000,
			)
		}
		// Note: broadcast node values are not updated here because they are
		// write-only and don't need to reflect individual node value changes.
		// They are rebuilt when nodes are added/removed or become ready
		// (ZwaveClient owns that lifecycle).
	}

	/**
	 * Drop a removed physical node from any group containing it. Persists
	 * groups.json before touching live virtual instances, so a crash between
	 * the in-memory mutation and the disk write can never resurrect the
	 * removed node on restart. Refreshes the corresponding multicast
	 * instances and virtual ZUI nodes after the write succeeds.
	 */
	async removeNodeFromGroups(nodeId: number): Promise<void> {
		const groupIds = this._nodeToGroups.get(nodeId)
		if (!groupIds || groupIds.size === 0) return

		const affected: ZUIGroup[] = []
		for (const groupId of groupIds) {
			const group = this._groups.find((g) => g.id === groupId)
			if (!group) continue
			group.nodeIds = group.nodeIds.filter((id) => id !== nodeId)
			affected.push(group)
		}

		if (affected.length === 0) return

		try {
			await this._persistence.put(this._groups)
		} catch (error) {
			this._logger.error(
				`Failed to persist groups after removing node ${nodeId}: ${getErrorMessage(
					error,
				)}`,
			)
			return
		}

		this._rebuildNodeToGroupsIndex()

		for (const group of affected) {
			if (group.nodeIds.length >= 2 && this._driver.isDriverReady()) {
				try {
					const refreshed = this._driver.getMulticastGroup(
						group.nodeIds,
					)
					this._virtualNodes.set(group.id, refreshed)
				} catch (error) {
					this._logger.error(
						`Failed to refresh multicast group ${group.id} after removing node ${nodeId}: ${getErrorMessage(
							error,
						)}`,
					)
				}
				this._updateVirtualNode(group)
			} else {
				// Group dropped below the 2-node minimum; tear down the live
				// virtual node but leave the persisted entry so the user can
				// fix it from the Groups page.
				this._virtualNodes.delete(group.id)
				this._zuiNodes.delete(group.id)
				this._socket.sendToSocket(socketEvents.nodeRemoved, {
					id: group.id,
				})
			}
		}
	}

	/**
	 * Create a new group. Builds the multicast instance before persisting so a
	 * failure leaves no phantom group in `groups.json`.
	 */
	async createGroup(name: string, nodeIds: number[]): Promise<ZUIGroup> {
		const trimmedName = this._validateGroupName(name)
		const validNodeIds = this._filterGroupNodeIds(nodeIds)

		const id = this._getNextGroupId()
		const group: ZUIGroup = { id, name: trimmedName, nodeIds: validNodeIds }

		// Build the live multicast instance up-front: if zwave-js rejects the
		// node set, throw before we touch persistent state.
		if (this._driver.isDriverReady()) {
			const multicastGroup = this._driver.getMulticastGroup(validNodeIds)
			this._virtualNodes.set(id, multicastGroup)
		}

		this._groups.push(group)
		try {
			await this._persistence.put(this._groups)
		} catch (error) {
			// Rollback in-memory state on persistence failure
			this._groups.pop()
			this._virtualNodes.delete(id)
			throw error
		}

		this._rebuildNodeToGroupsIndex()
		this.createVirtualNode(group)

		return group
	}

	/**
	 * Update an existing group.
	 */
	async updateGroup(
		id: number,
		name: string,
		nodeIds: number[],
	): Promise<ZUIGroup | null> {
		const trimmedName = this._validateGroupName(name)
		const validNodeIds = this._filterGroupNodeIds(nodeIds)

		const groupIndex = this._groups.findIndex((g) => g.id === id)
		if (groupIndex === -1) {
			return null
		}

		const previous = { ...this._groups[groupIndex] }
		this._groups[groupIndex].name = trimmedName
		this._groups[groupIndex].nodeIds = validNodeIds

		// Refresh the multicast instance with the validated node list before
		// persisting — if zwave-js rejects, restore previous state and throw.
		if (this._driver.isDriverReady()) {
			try {
				const multicastGroup =
					this._driver.getMulticastGroup(validNodeIds)
				this._virtualNodes.set(id, multicastGroup)
			} catch (error) {
				this._groups[groupIndex] = previous
				throw error
			}
		}

		try {
			await this._persistence.put(this._groups)
		} catch (error) {
			this._groups[groupIndex] = previous
			throw error
		}

		this._rebuildNodeToGroupsIndex()
		this._updateVirtualNode(this._groups[groupIndex])

		return this._groups[groupIndex]
	}

	/**
	 * Delete a group.
	 */
	async deleteGroup(id: number): Promise<boolean> {
		const groupIndex = this._groups.findIndex((g) => g.id === id)
		if (groupIndex === -1) {
			return false
		}

		this._zuiNodes.delete(id)
		this._virtualNodes.delete(id)

		this._groups.splice(groupIndex, 1)
		await this._persistence.put(this._groups)

		this._rebuildNodeToGroupsIndex()

		this._socket.sendToSocket(socketEvents.nodeRemoved, { id })

		return true
	}

	/**
	 * Get all groups
	 */
	getGroups(): ZUIGroup[] {
		return this._groups
	}
}
