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

/** Maximum length of a multicast group name, kept short to avoid bloating MQTT topics */
const GROUP_NAME_MAX_LENGTH = 64

/** Set above the LR address space so auto-assigned multicast-group virtual-node IDs never collide with physical or broadcast nodes */
const GROUP_ID_MIN = 0x1000

/**
 * Cancellation token for one GroupService generation (one ZwaveClient.init()/restart() lifetime).
 *
 * A restart replaces GroupService with a fresh instance while a mutating call (createGroup/updateGroup/deleteGroup/removeNodeFromGroups)
 * on the old instance may still be suspended on its persistence await, with in-memory bookkeeping (_groups/_nodeToGroups) that's no
 * longer authoritative once the new generation starts rebuilding virtual nodes from a freshly-loaded groups snapshot.
 *
 * Each mutating method checks `cancelled` right after its persistence await and stops mutating virtual-node/socket state if a new
 * generation has since started - the write already persisted, and the new generation's driver-ready handler re-derives virtual nodes
 * from it, so nothing is lost.
 */
export class GroupServiceGeneration {
	private _cancelled = false

	get cancelled(): boolean {
		return this._cancelled
	}

	cancel(): void {
		this._cancelled = true
	}
}

export class GroupService {
	private _groups: ZUIGroup[]

	// Reverse nodeId → groupIds index, rebuilt on every group create/update/delete, kept for O(1) lookups instead of O(groups)
	private readonly _nodeToGroups: Map<number, Set<number>> = new Map()

	private readonly _driver: GroupDriverPort
	// Shared with ZwaveClient's broadcast (standard + LR) virtual-node lifecycle, so this is a pass-through to that Map rather than state owned here; ZwaveClient._updateBroadcastNodeValues() owns refreshing the broadcast entries
	private readonly _virtualNodes: GroupVirtualNodeRegistryPort
	private readonly _zuiNodes: GroupZUINodeStorePort
	private readonly _socket: GroupSocketPort
	private readonly _utils: GroupUtilsPort
	private readonly _persistence: GroupPersistencePort
	private readonly _logger: ServiceLogger
	private readonly _generation: GroupServiceGeneration

	constructor(
		driver: GroupDriverPort,
		virtualNodes: GroupVirtualNodeRegistryPort,
		zuiNodes: GroupZUINodeStorePort,
		socket: GroupSocketPort,
		utils: GroupUtilsPort,
		persistence: GroupPersistencePort,
		logger: ServiceLogger,
		generation: GroupServiceGeneration,
		initialGroups: ZUIGroup[],
	) {
		this._driver = driver
		this._virtualNodes = virtualNodes
		this._zuiNodes = zuiNodes
		this._socket = socket
		this._utils = utils
		this._persistence = persistence
		this._logger = logger
		this._generation = generation
		this._groups = initialGroups
		this._rebuildNodeToGroupsIndex()
	}

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
	 * Drop duplicates, the controller, broadcast targets, and virtual-group IDs, keeping only known physical nodes
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

	private _getNextGroupId(): number {
		const existingIds = new Set(this._groups.map((g) => g.id))
		let nextId = GROUP_ID_MIN
		while (existingIds.has(nextId)) {
			nextId++
		}
		return nextId
	}

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

	private _updateVirtualNode(group: ZUIGroup): void {
		const virtualNode = this._zuiNodes.get(group.id)
		if (!virtualNode) {
			this.createVirtualNode(group)
			return
		}

		virtualNode.name = group.name

		this._updateVirtualNodeValues(group)

		this._socket.emitNodeUpdate(virtualNode, { name: virtualNode.name })
	}

	/**
	 * zwave-js's `getDefinedValueIDs()` unions every member's writeable actuator values plus Basic CC, so a group can expose CCs
	 * that only some members support - those members simply ignore the command
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

				// Show the value only if all supporting members agree, using deep equality so object-valued CCs like Color compare correctly
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

			// Emit valueChanged for each value so the MQTT gateway publishes them and registers topics for write-back
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

	createVirtualNode(group: ZUIGroup): void {
		if (!this._driver.isDriverReady()) return

		try {
			// createGroup registers the live VirtualNode eagerly; driver restart and _updateVirtualNode's fallback create it lazily here
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

			// Emit nodeUpdated, not nodeAdded, since nodeAdded expects {node, result} and triggers a confirmation dialog in the UI
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

	// Throttled per group to avoid rebuilding a virtual node on every single member-value update
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
	}

	// Persists groups.json before touching virtual instances, so a crash between the mutation and the disk write can never resurrect the removed node on restart
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

		// This generation was cancelled by a restart; the persisted removal already stands, so skip refreshing virtual nodes here
		if (this._generation.cancelled) return

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
				// Group dropped below the 2-node minimum; tear down the live virtual node but leave the persisted entry so the user can fix it from the Groups page
				this._virtualNodes.delete(group.id)
				this._zuiNodes.delete(group.id)
				this._socket.sendToSocket(socketEvents.nodeRemoved, {
					id: group.id,
				})
			}
		}
	}

	async createGroup(name: string, nodeIds: number[]): Promise<ZUIGroup> {
		const trimmedName = this._validateGroupName(name)
		const validNodeIds = this._filterGroupNodeIds(nodeIds)

		const id = this._getNextGroupId()
		const group: ZUIGroup = { id, name: trimmedName, nodeIds: validNodeIds }

		// Build the live multicast instance up-front: if zwave-js rejects the node set, throw before we touch persistent state
		if (this._driver.isDriverReady()) {
			const multicastGroup = this._driver.getMulticastGroup(validNodeIds)
			this._virtualNodes.set(id, multicastGroup)
		}

		this._groups.push(group)
		try {
			await this._persistence.put(this._groups)
		} catch (error) {
			this._groups.pop()
			this._virtualNodes.delete(id)
			throw error
		}

		// This generation was cancelled by a restart; the persisted group already stands, so skip materializing its virtual node here
		if (this._generation.cancelled) return group

		this._rebuildNodeToGroupsIndex()
		this.createVirtualNode(group)

		return group
	}

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

		// Refresh the multicast instance before persisting; restore the previous group and rethrow if zwave-js rejects the node list
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

		// This generation was cancelled by a restart; the persisted update already stands, so skip refreshing the virtual node here
		if (this._generation.cancelled) return this._groups[groupIndex]

		this._rebuildNodeToGroupsIndex()
		this._updateVirtualNode(this._groups[groupIndex])

		return this._groups[groupIndex]
	}

	async deleteGroup(id: number): Promise<boolean> {
		const groupIndex = this._groups.findIndex((g) => g.id === id)
		if (groupIndex === -1) {
			return false
		}

		this._zuiNodes.delete(id)
		this._virtualNodes.delete(id)

		this._groups.splice(groupIndex, 1)
		await this._persistence.put(this._groups)

		// This generation was cancelled by a restart; the persisted removal already stands, so skip rebuilding the index and emitting a notification that could race the new generation's own bookkeeping
		if (this._generation.cancelled) return true

		this._rebuildNodeToGroupsIndex()

		this._socket.sendToSocket(socketEvents.nodeRemoved, { id })

		return true
	}

	getGroups(): ZUIGroup[] {
		return this._groups
	}
}
