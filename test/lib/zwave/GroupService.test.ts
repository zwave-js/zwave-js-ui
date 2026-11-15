import { describe, it, expect, vi } from 'vitest'
import {
	NODE_ID_BROADCAST,
	NODE_ID_BROADCAST_LR,
	CommandClasses,
} from '@zwave-js/core'
import {
	GroupService,
	GroupServiceGeneration,
} from '../../../api/lib/zwave/GroupService.ts'
import { socketEvents } from '../../../api/lib/SocketEvents.ts'
import type {
	GroupDriverPort,
	GroupVirtualNodeRegistryPort,
	GroupVirtualNodeHandle,
	GroupZUINodeStorePort,
	GroupSocketPort,
	GroupUtilsPort,
	GroupPersistencePort,
	ServiceLogger,
	ZUIGroup,
	GroupZUINode,
} from '../../../api/lib/zwave/ports.ts'
import { createDeferred } from './serviceTestSupport.ts'

function makeVirtualNode(_nodeIds: number[]): GroupVirtualNodeHandle {
	return {
		getDefinedValueIDs: vi.fn(() => []),
	}
}

function createDriverPort(
	overrides: Partial<{
		driverReady: boolean
		ownNodeId: number
		physicalNodes: Set<number>
		getMulticastGroup: (nodeIds: number[]) => GroupVirtualNodeHandle
	}> = {},
) {
	let driverReady = overrides.driverReady ?? true
	const physicalNodes = overrides.physicalNodes ?? new Set([2, 3, 4, 5])
	const getMulticastGroup =
		overrides.getMulticastGroup ?? ((nodeIds) => makeVirtualNode(nodeIds))
	return {
		isDriverReady: () => driverReady,
		getOwnNodeId: () => overrides.ownNodeId ?? 1,
		hasPhysicalNode: (nodeId: number) => physicalNodes.has(nodeId),
		getMulticastGroup: vi.fn(getMulticastGroup),
		setDriverReady: (v: boolean) => {
			driverReady = v
		},
	} satisfies GroupDriverPort & { setDriverReady(v: boolean): void }
}

function createVirtualNodeRegistry(): GroupVirtualNodeRegistryPort & {
	map: Map<number, GroupVirtualNodeHandle>
} {
	const map = new Map<number, GroupVirtualNodeHandle>()
	return {
		has: (id) => map.has(id),
		get: (id) => map.get(id),
		set: (id, node) => {
			map.set(id, node)
		},
		delete: (id) => map.delete(id),
		map,
	}
}

function createZUINodeStore(): GroupZUINodeStorePort & {
	map: Map<number, GroupZUINode>
} {
	const map = new Map<number, GroupZUINode>()
	return {
		get: (id) => map.get(id),
		set: (id, node) => {
			map.set(id, node)
		},
		delete: (id) => map.delete(id),
		map,
	}
}

function createSocketPort(): GroupSocketPort & {
	sent: Array<{ event: string; data: unknown }>
	nodeUpdates: Array<{ node: GroupZUINode; changed: unknown }>
	valueChanges: Array<{ valueId: unknown; node: GroupZUINode }>
} {
	const sent: Array<{ event: string; data: unknown }> = []
	const nodeUpdates: Array<{ node: GroupZUINode; changed: unknown }> = []
	const valueChanges: Array<{ valueId: unknown; node: GroupZUINode }> = []
	return {
		sendToSocket: vi.fn((event: string, data: unknown) => {
			sent.push({ event, data })
		}),
		emitNodeUpdate: vi.fn((node, changed) => {
			nodeUpdates.push({ node, changed })
		}),
		emitValueChanged: vi.fn((valueId, node) => {
			valueChanges.push({ valueId, node })
		}),
		sent,
		nodeUpdates,
		valueChanges,
	}
}

function createUtilsPort(overrides: Partial<GroupUtilsPort> = {}) {
	return {
		deepEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
		getValueId: (v) => `${v.commandClass}-${v.endpoint ?? 0}-${v.property}`,
		buildVirtualValueId: vi.fn((_nodeId, _zwaveValue, value) =>
			value === undefined ? null : { value },
		),
		newVirtualZUINode: vi.fn((id, name) => ({ id, name, values: {} })),
		throttle: vi.fn((_key, fn) => fn()),
		...overrides,
	} satisfies GroupUtilsPort
}

function createPersistencePort() {
	const puts: ZUIGroup[][] = []
	let stored: ZUIGroup[] = []
	const port = {
		get: () => stored,
		put: vi.fn((data: ZUIGroup[]) => {
			if (port.failNext) {
				port.failNext = false
				return Promise.reject(new Error('persist failed'))
			}
			stored = data
			puts.push(data.map((g) => ({ ...g, nodeIds: [...g.nodeIds] })))
			return Promise.resolve(true)
		}),
		puts,
		failNext: false as boolean,
	} satisfies GroupPersistencePort & {
		puts: ZUIGroup[][]
		failNext: boolean
	}
	return port
}

// deferNextPut() suspends the next put() call, so a test can simulate a restart while persistence is mid-flight and observe both sides of that boundary
function createDeferredPersistencePort() {
	let stored: ZUIGroup[] = []
	const puts: ZUIGroup[][] = []
	let nextDeferred: ReturnType<typeof createDeferred<void>> | null = null
	const port = {
		get: () => stored,
		put: vi.fn((data: ZUIGroup[]) => {
			const snapshot = data.map((g) => ({
				...g,
				nodeIds: [...g.nodeIds],
			}))
			const deferred = nextDeferred
			nextDeferred = null
			const record = () => {
				stored = data
				puts.push(snapshot)
				return true
			}
			if (!deferred) return Promise.resolve(record())
			return deferred.promise.then(record)
		}),
		puts,
		deferNextPut: () => {
			const deferred = createDeferred<void>()
			nextDeferred = deferred
			return {
				resolve: () => deferred.resolve(),
				reject: (error: unknown) => deferred.reject(error),
			}
		},
	} satisfies GroupPersistencePort & {
		puts: ZUIGroup[][]
		deferNextPut: () => {
			resolve: () => void
			reject: (error: unknown) => void
		}
	}
	return port
}

function createLogger(): ServiceLogger & { errors: string[] } {
	const errors: string[] = []
	return {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn((message: string) => {
			errors.push(message)
		}),
		errors,
	}
}

function createService(
	initialGroups: ZUIGroup[] = [],
	overrides: {
		generation?: GroupServiceGeneration
		// Keep the concrete fake type so its failure controls remain available.
		persistence?:
			| ReturnType<typeof createPersistencePort>
			| ReturnType<typeof createDeferredPersistencePort>
	} = {},
) {
	const driver = createDriverPort()
	const virtualNodes = createVirtualNodeRegistry()
	const zuiNodes = createZUINodeStore()
	const socket = createSocketPort()
	const utils = createUtilsPort()
	const persistence = overrides.persistence ?? createPersistencePort()
	const logger = createLogger()
	const generation = overrides.generation ?? new GroupServiceGeneration()

	const service = new GroupService(
		driver,
		virtualNodes,
		zuiNodes,
		socket,
		utils,
		persistence,
		logger,
		generation,
		initialGroups,
	)

	return {
		service,
		driver,
		virtualNodes,
		zuiNodes,
		socket,
		utils,
		persistence,
		logger,
		generation,
	}
}

describe('GroupService', () => {
	describe('createGroup', () => {
		it('creates a group with the next available id starting at 0x1000', async () => {
			const { service, persistence } = createService()

			const group = await service.createGroup('Living Room', [2, 3])

			expect(group).toEqual({
				id: 0x1000,
				name: 'Living Room',
				nodeIds: [2, 3],
			})
			expect(service.getGroups()).toEqual([group])
			expect(persistence.put).toHaveBeenCalledTimes(1)
		})

		it('picks the next free id when lower ids are taken', async () => {
			const { service } = createService([
				{ id: 0x1000, name: 'A', nodeIds: [2, 3] },
			])

			const group = await service.createGroup('B', [4, 5])

			expect(group.id).toBe(0x1001)
		})

		it('trims the group name and rejects blank names', async () => {
			const { service } = createService()

			const group = await service.createGroup('  Trimmed  ', [2, 3])
			expect(group.name).toBe('Trimmed')

			await expect(service.createGroup('   ', [2, 3])).rejects.toThrow(
				'Group name is required',
			)
		})

		it('rejects names longer than 64 characters', async () => {
			const { service } = createService()

			await expect(
				service.createGroup('x'.repeat(65), [2, 3]),
			).rejects.toThrow('Group name must be at most 64 characters')
		})

		it('filters out duplicates, own node id, broadcast ids and non-physical/virtual ids', async () => {
			const { service } = createService()

			const group = await service.createGroup('Filtered', [
				2,
				2,
				3,
				1, // own node id
				NODE_ID_BROADCAST,
				NODE_ID_BROADCAST_LR,
				0x1000, // >= GROUP_ID_MIN, excluded
				99, // not a physical node
			])

			expect(group.nodeIds).toEqual([2, 3])
		})

		it('throws when fewer than 2 valid nodes remain after filtering', async () => {
			const { service } = createService()

			await expect(service.createGroup('Solo', [2])).rejects.toThrow(
				'At least 2 valid nodes are required for a group',
			)
		})

		it('builds the live multicast instance before persisting, when driver is ready', async () => {
			const { service, virtualNodes, driver } = createService()

			const group = await service.createGroup('Ready', [2, 3])

			expect(driver.getMulticastGroup).toHaveBeenCalledWith([2, 3])
			expect(virtualNodes.map.has(group.id)).toBe(true)
		})

		it('skips building the multicast instance when driver is not ready', async () => {
			const { service, virtualNodes, driver, zuiNodes } = createService()
			driver.setDriverReady(false)

			const group = await service.createGroup('NotReady', [2, 3])

			expect(virtualNodes.map.has(group.id)).toBe(false)
			// createVirtualNode() also early-returns when driver isn't ready
			expect(zuiNodes.map.has(group.id)).toBe(false)
		})

		it('rolls back in-memory state when persistence fails', async () => {
			const persistence = createPersistencePort()
			const { service, virtualNodes } = createService([], {
				persistence,
			})
			persistence.failNext = true

			await expect(service.createGroup('Fails', [2, 3])).rejects.toThrow()

			expect(service.getGroups()).toEqual([])
			expect(virtualNodes.map.size).toBe(0)
		})

		it('creates the virtual ZUI node and emits a node-updated socket event', async () => {
			const { service, zuiNodes, socket } = createService()

			const group = await service.createGroup('Materialized', [2, 3])

			expect(zuiNodes.map.has(group.id)).toBe(true)
			expect(socket.sent).toContainEqual({
				event: socketEvents.nodeUpdated,
				data: zuiNodes.map.get(group.id),
			})
		})
	})

	describe('updateGroup', () => {
		it('returns null when the group does not exist', async () => {
			const { service } = createService()

			expect(await service.updateGroup(0x1000, 'X', [2, 3])).toBeNull()
		})

		it('updates name and nodeIds, refreshes the multicast instance and persists', async () => {
			const { service, persistence, virtualNodes } = createService([
				{ id: 0x1000, name: 'Old', nodeIds: [2, 3] },
			])

			const updated = await service.updateGroup(0x1000, 'New', [4, 5])

			expect(updated).toEqual({
				id: 0x1000,
				name: 'New',
				nodeIds: [4, 5],
			})
			expect(service.getGroups()[0]).toEqual(updated)
			expect(virtualNodes.map.get(0x1000)).toBeDefined()
			expect(persistence.put).toHaveBeenCalledTimes(1)
		})

		it('restores the previous group and rethrows when the multicast rebuild rejects', async () => {
			const { service, driver } = createService([
				{ id: 0x1000, name: 'Old', nodeIds: [2, 3] },
			])
			driver.getMulticastGroup = vi.fn(() => {
				throw new Error('rejected node set')
			})

			await expect(
				service.updateGroup(0x1000, 'New', [4, 5]),
			).rejects.toThrow()

			expect(service.getGroups()[0]).toEqual({
				id: 0x1000,
				name: 'Old',
				nodeIds: [2, 3],
			})
		})

		it('restores the previous group and rethrows when persistence fails', async () => {
			const persistence = createPersistencePort()
			const { service } = createService(
				[{ id: 0x1000, name: 'Old', nodeIds: [2, 3] }],
				{ persistence },
			)
			persistence.failNext = true

			await expect(
				service.updateGroup(0x1000, 'New', [4, 5]),
			).rejects.toThrow()

			expect(service.getGroups()[0]).toEqual({
				id: 0x1000,
				name: 'Old',
				nodeIds: [2, 3],
			})
		})

		it('skips multicast refresh when driver is not ready', async () => {
			const { service, driver } = createService([
				{ id: 0x1000, name: 'Old', nodeIds: [2, 3] },
			])
			driver.setDriverReady(false)

			const updated = await service.updateGroup(0x1000, 'New', [4, 5])

			expect(updated?.nodeIds).toEqual([4, 5])
		})

		it('updates the name and projects values on an already-materialized virtual node', async () => {
			const { service, zuiNodes, socket } = createService([
				{ id: 0x1000, name: 'Old', nodeIds: [2, 3] },
			])
			zuiNodes.map.set(0x1000, { id: 0x1000, name: 'Old', values: {} })

			await service.updateGroup(0x1000, 'New', [4, 5])

			expect(zuiNodes.map.get(0x1000)?.name).toBe('New')
			expect(socket.nodeUpdates).toContainEqual({
				node: zuiNodes.map.get(0x1000),
				changed: { name: 'New' },
			})
		})
	})

	describe('deleteGroup', () => {
		it('returns false when the group does not exist', async () => {
			const { service } = createService()

			expect(await service.deleteGroup(0x1000)).toBe(false)
		})

		it('removes the group, tears down virtual state and persists', async () => {
			const { service, virtualNodes, zuiNodes, socket, persistence } =
				createService([{ id: 0x1000, name: 'A', nodeIds: [2, 3] }])
			virtualNodes.map.set(0x1000, makeVirtualNode([2, 3]))
			zuiNodes.map.set(0x1000, { id: 0x1000, name: 'A', values: {} })

			const result = await service.deleteGroup(0x1000)

			expect(result).toBe(true)
			expect(service.getGroups()).toEqual([])
			expect(virtualNodes.map.has(0x1000)).toBe(false)
			expect(zuiNodes.map.has(0x1000)).toBe(false)
			expect(persistence.put).toHaveBeenCalledTimes(1)
			expect(socket.sent).toContainEqual({
				event: socketEvents.nodeRemoved,
				data: { id: 0x1000 },
			})
		})
	})

	describe('createVirtualNode', () => {
		it('does nothing when the driver is not ready', () => {
			const { service, driver, virtualNodes, zuiNodes } = createService()
			driver.setDriverReady(false)

			service.createVirtualNode({
				id: 0x1000,
				name: 'A',
				nodeIds: [2, 3],
			})

			expect(virtualNodes.map.size).toBe(0)
			expect(zuiNodes.map.size).toBe(0)
		})

		it('creates the live multicast instance when missing, and the ZUI shell', () => {
			const { service, driver, virtualNodes, zuiNodes, socket } =
				createService()

			service.createVirtualNode({
				id: 0x1000,
				name: 'A',
				nodeIds: [2, 3],
			})

			expect(driver.getMulticastGroup).toHaveBeenCalledWith([2, 3])
			expect(virtualNodes.map.has(0x1000)).toBe(true)
			expect(zuiNodes.map.has(0x1000)).toBe(true)
			expect(socket.sent).toContainEqual({
				event: socketEvents.nodeUpdated,
				data: zuiNodes.map.get(0x1000),
			})
		})

		it('reuses the live multicast instance when already registered', () => {
			const { service, driver, virtualNodes } = createService()
			const existing = makeVirtualNode([2, 3])
			virtualNodes.map.set(0x1000, existing)

			service.createVirtualNode({
				id: 0x1000,
				name: 'A',
				nodeIds: [2, 3],
			})

			expect(driver.getMulticastGroup).not.toHaveBeenCalled()
			expect(virtualNodes.map.get(0x1000)).toBe(existing)
		})

		it('logs and swallows errors instead of throwing', () => {
			const { service, driver, logger } = createService()
			driver.getMulticastGroup = vi.fn(() => {
				throw new Error('cannot build group')
			})

			expect(() =>
				service.createVirtualNode({
					id: 0x1000,
					name: 'A',
					nodeIds: [2, 3],
				}),
			).not.toThrow()
			expect(
				logger.errors.some((e) => e.includes('cannot build group')),
			).toBe(true)
		})

		it('projects member-node values, showing the common value when all members agree', () => {
			const { service, virtualNodes, zuiNodes, utils, socket } =
				createService()
			const zwaveValue = {
				commandClass: CommandClasses['Binary Switch'],
				endpoint: 0,
				property: 'currentValue',
			}
			virtualNodes.map.set(0x1000, {
				...makeVirtualNode([2, 3]),
				getDefinedValueIDs: vi.fn(() => [zwaveValue]),
			})
			zuiNodes.map.set(2, {
				id: 2,
				values: {
					[`${CommandClasses['Binary Switch']}-0-currentValue`]: {
						value: 50,
					},
				},
			})
			zuiNodes.map.set(3, {
				id: 3,
				values: {
					[`${CommandClasses['Binary Switch']}-0-currentValue`]: {
						value: 50,
					},
				},
			})

			service.createVirtualNode({
				id: 0x1000,
				name: 'A',
				nodeIds: [2, 3],
			})

			expect(utils.buildVirtualValueId).toHaveBeenCalledWith(
				0x1000,
				zwaveValue,
				50,
			)
			const virtualNode = zuiNodes.map.get(0x1000)
			expect(
				virtualNode?.values?.[
					`${CommandClasses['Binary Switch']}-0-currentValue`
				],
			).toEqual({
				value: 50,
			})
			expect(socket.valueChanges).toHaveLength(1)
		})

		it('projects undefined when member values disagree', () => {
			const { service, virtualNodes, zuiNodes, utils } = createService()
			const zwaveValue = {
				commandClass: CommandClasses['Binary Switch'],
				endpoint: 0,
				property: 'currentValue',
			}
			virtualNodes.map.set(0x1000, {
				...makeVirtualNode([2, 3]),
				getDefinedValueIDs: vi.fn(() => [zwaveValue]),
			})
			zuiNodes.map.set(2, {
				id: 2,
				values: {
					[`${CommandClasses['Binary Switch']}-0-currentValue`]: {
						value: 50,
					},
				},
			})
			zuiNodes.map.set(3, {
				id: 3,
				values: {
					[`${CommandClasses['Binary Switch']}-0-currentValue`]: {
						value: 99,
					},
				},
			})

			service.createVirtualNode({
				id: 0x1000,
				name: 'A',
				nodeIds: [2, 3],
			})

			expect(utils.buildVirtualValueId).toHaveBeenCalledWith(
				0x1000,
				zwaveValue,
				undefined,
			)
		})

		it('omits virtual values that cannot be represented', () => {
			const driver = createDriverPort()
			const virtualNodes = createVirtualNodeRegistry()
			const zuiNodes = createZUINodeStore()
			const socket = createSocketPort()
			const utils = createUtilsPort({
				buildVirtualValueId: vi.fn(() => null),
			})
			const persistence = createPersistencePort()
			const logger = createLogger()
			const service = new GroupService(
				driver,
				virtualNodes,
				zuiNodes,
				socket,
				utils,
				persistence,
				logger,
				new GroupServiceGeneration(),
				[],
			)
			const zwaveValue = {
				commandClass: CommandClasses['Binary Switch'],
				endpoint: 0,
				property: 'currentValue',
			}
			virtualNodes.map.set(0x1000, {
				...makeVirtualNode([2, 3]),
				getDefinedValueIDs: vi.fn(() => [zwaveValue]),
			})

			service.createVirtualNode({
				id: 0x1000,
				name: 'A',
				nodeIds: [2, 3],
			})

			const virtualNode = zuiNodes.map.get(0x1000)
			expect(virtualNode?.values).toEqual({})
			expect(socket.valueChanges).toHaveLength(0)
		})

		it('logs and swallows errors thrown while projecting virtual node values', () => {
			const { service, virtualNodes, logger } = createService()
			virtualNodes.map.set(0x1000, {
				...makeVirtualNode([2, 3]),
				getDefinedValueIDs: vi.fn(() => {
					throw new Error('cannot enumerate values')
				}),
			})

			expect(() =>
				service.createVirtualNode({
					id: 0x1000,
					name: 'A',
					nodeIds: [2, 3],
				}),
			).not.toThrow()
			expect(
				logger.errors.some((e) =>
					e.includes('cannot enumerate values'),
				),
			).toBe(true)
		})
	})

	describe('updateVirtualNodesForNode', () => {
		it('refreshes every virtual group containing the changed node', () => {
			const { service, virtualNodes, zuiNodes, socket } = createService([
				{ id: 0x1000, name: 'A', nodeIds: [2, 3] },
				{ id: 0x1001, name: 'B', nodeIds: [3, 4] },
			])
			const zwaveValue = {
				commandClass: CommandClasses['Binary Switch'],
				endpoint: 0,
				property: 'currentValue',
			}
			const valueKey = `${CommandClasses['Binary Switch']}-0-currentValue`
			for (const groupId of [0x1000, 0x1001]) {
				virtualNodes.map.set(groupId, {
					getDefinedValueIDs: () => [zwaveValue],
				})
				zuiNodes.map.set(groupId, { id: groupId, values: {} })
			}
			for (const nodeId of [2, 3, 4]) {
				zuiNodes.map.set(nodeId, {
					id: nodeId,
					values: { [valueKey]: { value: true } },
				})
			}

			service.updateVirtualNodesForNode(3)

			expect(zuiNodes.map.get(0x1000)?.values?.[valueKey]).toEqual({
				value: true,
			})
			expect(zuiNodes.map.get(0x1001)?.values?.[valueKey]).toEqual({
				value: true,
			})
			expect(socket.nodeUpdates.map(({ node }) => node.id)).toEqual([
				0x1000, 0x1001,
			])
		})
	})

	describe('removeNodeFromGroups', () => {
		it('does nothing when the node is part of no group', async () => {
			const { service, persistence } = createService([
				{ id: 0x1000, name: 'A', nodeIds: [2, 3] },
			])

			await service.removeNodeFromGroups(99)

			expect(persistence.put).not.toHaveBeenCalled()
		})

		it('persists and tears down the virtual node when membership drops below 2', async () => {
			const { service, persistence, virtualNodes, zuiNodes, socket } =
				createService([{ id: 0x1000, name: 'A', nodeIds: [2, 3] }])
			virtualNodes.map.set(0x1000, makeVirtualNode([2, 3]))
			zuiNodes.map.set(0x1000, { id: 0x1000, name: 'A', values: {} })

			await service.removeNodeFromGroups(3)

			expect(persistence.put).toHaveBeenCalledTimes(1)
			expect(service.getGroups()[0].nodeIds).toEqual([2])
			expect(virtualNodes.map.has(0x1000)).toBe(false)
			expect(zuiNodes.map.has(0x1000)).toBe(false)
			expect(socket.sent).toContainEqual({
				event: socketEvents.nodeRemoved,
				data: { id: 0x1000 },
			})
		})

		it('refreshes the multicast instance when the group still has 2+ members', async () => {
			const { service, persistence, virtualNodes, driver } =
				createService([{ id: 0x1000, name: 'A', nodeIds: [2, 3, 4] }])
			virtualNodes.map.set(0x1000, makeVirtualNode([2, 3, 4]))

			await service.removeNodeFromGroups(4)

			expect(persistence.put).toHaveBeenCalledTimes(1)
			expect(service.getGroups()[0].nodeIds).toEqual([2, 3])
			expect(driver.getMulticastGroup).toHaveBeenCalledWith([2, 3])
			expect(virtualNodes.map.has(0x1000)).toBe(true)
		})

		it('keeps live virtual state unchanged when persistence fails', async () => {
			const persistence = createPersistencePort()
			const { service, logger, virtualNodes, zuiNodes, socket } =
				createService([{ id: 0x1000, name: 'A', nodeIds: [2, 3] }], {
					persistence,
				})
			const virtualNode = makeVirtualNode([2, 3])
			const zuiNode = { id: 0x1000, name: 'A', values: {} }
			virtualNodes.map.set(0x1000, virtualNode)
			zuiNodes.map.set(0x1000, zuiNode)
			persistence.failNext = true

			await service.removeNodeFromGroups(3)

			expect(
				logger.errors.some((e) => e.includes('Failed to persist')),
			).toBe(true)
			expect(virtualNodes.map.has(0x1000)).toBe(true)
			expect(zuiNodes.map.get(0x1000)).toEqual(zuiNode)
			expect(socket.sent).toEqual([])
		})

		it('logs and continues when refreshing the multicast group throws', async () => {
			const { service, persistence, driver, logger } = createService([
				{ id: 0x1000, name: 'A', nodeIds: [2, 3, 4] },
			])
			driver.getMulticastGroup = vi.fn(() => {
				throw new Error('refresh failed')
			})

			await service.removeNodeFromGroups(4)

			expect(persistence.put).toHaveBeenCalledTimes(1)
			expect(
				logger.errors.some((e) => e.includes('refresh failed')),
			).toBe(true)
		})

		it('tears down the virtual node when the driver is unavailable', async () => {
			const { service, driver, virtualNodes } = createService([
				{ id: 0x1000, name: 'A', nodeIds: [2, 3, 4] },
			])
			virtualNodes.map.set(0x1000, makeVirtualNode([2, 3, 4]))
			driver.setDriverReady(false)

			await service.removeNodeFromGroups(4)

			// 2 members meets the minimum, but the refresh branch also requires the driver ready, so this still falls through to tear-down
			expect(virtualNodes.map.has(0x1000)).toBe(false)
		})
	})

	// Defer persistence so restart ordering is deterministic across writes and restoration
	describe('restart during a persistence write', () => {
		it('restores a group created during restart from persisted state', async () => {
			const persistence = createDeferredPersistencePort()
			const generation = new GroupServiceGeneration()
			const { service, virtualNodes, zuiNodes, socket } = createService(
				[],
				{ generation, persistence },
			)

			const deferredPut = persistence.deferNextPut()
			const createPromise = service.createGroup('Living Room', [2, 3])

			expect(persistence.puts).toHaveLength(0)

			// Restart lands mid-write: cancel the old generation before the deferred put resolves
			generation.cancel()
			deferredPut.resolve()

			const group = await createPromise

			expect(persistence.puts).toHaveLength(1)
			expect(persistence.puts[0]).toEqual([group])
			expect(group).toEqual({
				id: 0x1000,
				name: 'Living Room',
				nodeIds: [2, 3],
			})

			// Register multicast state before persistence but defer ZUI projection until the write completes
			expect(virtualNodes.map.has(group.id)).toBe(true)
			expect(zuiNodes.map.has(group.id)).toBe(false)
			expect(socket.sent).toHaveLength(0)

			// Rebuild the replacement instance from persisted groups
			const newGeneration = new GroupServiceGeneration()
			const {
				service: restartedService,
				zuiNodes: restartedZuiNodes,
				socket: restartedSocket,
			} = createService(persistence.puts[0], {
				generation: newGeneration,
				persistence,
			})
			expect(restartedService.getGroups()).toEqual([group])
			restartedService.createVirtualNode(group)
			expect(restartedZuiNodes.map.has(group.id)).toBe(true)
			expect(restartedSocket.sent).toContainEqual({
				event: socketEvents.nodeUpdated,
				data: restartedZuiNodes.map.get(group.id),
			})
		})

		it('restores a group updated during restart from persisted state', async () => {
			const persistence = createDeferredPersistencePort()
			await persistence.put([
				{ id: 0x1000, name: 'Old', nodeIds: [2, 3] },
			])
			const generation = new GroupServiceGeneration()
			const { service, zuiNodes, socket } = createService(
				[{ id: 0x1000, name: 'Old', nodeIds: [2, 3] }],
				{ generation, persistence },
			)
			zuiNodes.map.set(0x1000, { id: 0x1000, name: 'Old', values: {} })

			const deferredPut = persistence.deferNextPut()
			const updatePromise = service.updateGroup(0x1000, 'New', [4, 5])

			expect(persistence.puts).toHaveLength(1) // just the seed put above

			generation.cancel()
			deferredPut.resolve()

			const updated = await updatePromise

			expect(persistence.puts).toHaveLength(2)
			expect(persistence.puts[1]).toEqual([
				{ id: 0x1000, name: 'New', nodeIds: [4, 5] },
			])
			expect(updated).toEqual({
				id: 0x1000,
				name: 'New',
				nodeIds: [4, 5],
			})
			// Skip projection and notification from the superseded instance
			expect(zuiNodes.map.get(0x1000)?.name).toBe('Old')
			expect(socket.nodeUpdates).toHaveLength(0)

			const newGeneration = new GroupServiceGeneration()
			const { service: restartedService } = createService(
				persistence.puts[1],
				{ generation: newGeneration, persistence },
			)
			expect(restartedService.getGroups()).toEqual([updated])
		})

		it('keeps a group deleted during restart absent after restoration', async () => {
			const persistence = createDeferredPersistencePort()
			await persistence.put([{ id: 0x1000, name: 'A', nodeIds: [2, 3] }])
			const generation = new GroupServiceGeneration()
			const { service, virtualNodes, zuiNodes, socket } = createService(
				[{ id: 0x1000, name: 'A', nodeIds: [2, 3] }],
				{ generation, persistence },
			)
			virtualNodes.map.set(0x1000, makeVirtualNode([2, 3]))
			zuiNodes.map.set(0x1000, { id: 0x1000, name: 'A', values: {} })

			const deferredPut = persistence.deferNextPut()
			const deletePromise = service.deleteGroup(0x1000)

			generation.cancel()
			deferredPut.resolve()

			const result = await deletePromise

			expect(result).toBe(true)
			expect(persistence.puts).toHaveLength(2)
			expect(persistence.puts[1]).toEqual([])
			// Tear down virtual state before persisting deletion
			expect(virtualNodes.map.has(0x1000)).toBe(false)
			expect(zuiNodes.map.has(0x1000)).toBe(false)
			// Skip notification from the superseded instance
			expect(socket.sent).toHaveLength(0)

			const newGeneration = new GroupServiceGeneration()
			const { service: restartedService } = createService(
				persistence.puts[1],
				{ generation: newGeneration, persistence },
			)
			expect(restartedService.getGroups()).toEqual([])
		})

		it('restores membership changed during restart from persisted state', async () => {
			const persistence = createDeferredPersistencePort()
			await persistence.put([{ id: 0x1000, name: 'A', nodeIds: [2, 3] }])
			const generation = new GroupServiceGeneration()
			const { service, virtualNodes, zuiNodes, socket } = createService(
				[{ id: 0x1000, name: 'A', nodeIds: [2, 3] }],
				{ generation, persistence },
			)
			virtualNodes.map.set(0x1000, makeVirtualNode([2, 3]))
			zuiNodes.map.set(0x1000, { id: 0x1000, name: 'A', values: {} })

			const deferredPut = persistence.deferNextPut()
			const removePromise = service.removeNodeFromGroups(3)

			generation.cancel()
			deferredPut.resolve()

			await removePromise

			expect(persistence.puts).toHaveLength(2)
			expect(persistence.puts[1]).toEqual([
				{ id: 0x1000, name: 'A', nodeIds: [2] },
			])
			// Skip virtual-state mutation and notification from the superseded instance
			expect(virtualNodes.map.has(0x1000)).toBe(true)
			expect(zuiNodes.map.has(0x1000)).toBe(true)
			expect(socket.sent).toHaveLength(0)

			const newGeneration = new GroupServiceGeneration()
			const { service: restartedService } = createService(
				persistence.puts[1],
				{ generation: newGeneration, persistence },
			)
			expect(restartedService.getGroups()).toEqual([
				{ id: 0x1000, name: 'A', nodeIds: [2] },
			])
		})

		it('projects and notifies after persistence completes without restart', async () => {
			const { service, zuiNodes, socket } = createService()

			const group = await service.createGroup('Living Room', [2, 3])

			expect(zuiNodes.map.has(group.id)).toBe(true)
			expect(socket.sent).toContainEqual({
				event: socketEvents.nodeUpdated,
				data: zuiNodes.map.get(group.id),
			})
		})
	})
})
