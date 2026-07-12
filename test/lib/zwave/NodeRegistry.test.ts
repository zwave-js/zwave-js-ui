/* eslint-disable @typescript-eslint/unbound-method */
import { CommandClasses, SecurityClass } from '@zwave-js/core'
import { EventEmitter } from 'node:events'
import {
	FirmwareUpdateStatus,
	InterviewStage,
	NodeStatus,
	Protocols,
	RemoveNodeReason,
} from 'zwave-js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { socketEvents } from '../../../api/lib/SocketEvents.ts'
import {
	NodeRegistry,
	type NodeRegistryHost,
} from '../../../api/lib/zwave/NodeRegistry.ts'

function createZwaveNode(overrides: Record<string, unknown> = {}) {
	const emitter = new EventEmitter() as any
	Object.assign(emitter, {
		id: 2,
		name: '',
		location: '',
		status: NodeStatus.Alive,
		interviewStage: InterviewStage.Complete,
		ready: true,
		isControllerNode: false,
		isListening: true,
		isFrequentListening: false,
		canSleep: false,
		isRouting: true,
		supportedDataRates: [40000],
		maxDataRate: 40000,
		supportsSecurity: true,
		isSecure: true,
		supportsBeaming: true,
		protocolVersion: '7.19',
		sdkVersion: '7.19',
		firmwareVersion: '1.0',
		manufacturerId: 1,
		productId: 2,
		productType: 3,
		zwavePlusVersion: 2,
		zwavePlusRoleType: 5,
		zwavePlusNodeType: 0,
		nodeType: 0,
		deviceClass: {
			basic: 1,
			generic: { key: 2 },
			specific: { key: 3 },
		},
		lastSeen: new Date(100),
		defaultVolume: 20,
		protocol: Protocols.ZWave,
		deviceConfig: {
			label: 'Switch',
			description: 'A switch',
			manufacturer: 'Maker',
		},
		commandClasses: {
			'Schedule Entry Lock': { isSupported: vi.fn(() => false) },
		},
		getEndpointCount: vi.fn(() => 1),
		getAllEndpoints: vi.fn(() => [
			{
				index: 0,
				endpointLabel: '',
				deviceClass: {
					basic: 1,
					generic: { key: 2 },
					specific: { key: 3 },
				},
			},
		]),
		getHighestSecurityClass: vi.fn(() => SecurityClass.S2_Authenticated),
		getFirmwareUpdateCapabilitiesCached: vi.fn(() => undefined),
		hasDeviceConfigChanged: vi.fn(() => true),
		getDefinedValueIDs: vi.fn(() => []),
		getValueMetadata: vi.fn(() => ({
			type: 'number',
			readable: true,
			writeable: true,
		})),
		getValue: vi.fn(() => 1),
		getEndpoint: vi.fn(() => ({ getCCVersion: vi.fn(() => 3) })),
		getCCVersion: vi.fn(() => 3),
		supportsCC: vi.fn(() => false),
		dsk: undefined,
	})
	Object.assign(emitter, overrides)
	return emitter
}

function createHarness(
	options: {
		persisted?: any
		node?: any
		driverReady?: boolean
		fakeNodesReader?: () => Promise<string | undefined>
	} = {},
) {
	let generation = 1
	let current = true
	const zwaveNode = options.node ?? createZwaveNode()
	const controllerNodes = new Map<number, any>([[zwaveNode.id, zwaveNode]])
	const persisted = options.persisted ?? {}
	const driver = {
		configManager: { lookupManufacturer: vi.fn(() => 'Maker') },
		controller: {
			nodes: controllerNodes,
			ownNodeId: 1,
			supportsLongRange: true,
			getPrioritySUCReturnRouteCached: vi.fn(() => undefined),
			getCustomSUCReturnRoutesCached: vi.fn(() => undefined),
			getProvisioningEntry: vi.fn(() => undefined),
			getSupportedRFRegions: vi.fn(() => []),
		},
	}
	const host: NodeRegistryHost = {
		getDriver: () => driver as any,
		getZWaveNode: (nodeId) => controllerNodes.get(nodeId),
		getGeneration: () => generation,
		isCurrent: (candidate, captured) =>
			current && candidate === registry && captured === generation,
		getHomeHex: () => '0x1234',
		getMaxNodeEventsQueueSize: () => 2,
		getPersistedNodes: () => persisted,
		persistNodes: vi.fn(() => Promise.resolve()),
		debug: vi.fn(),
		sendToSocket: vi.fn(),
		logNode: vi.fn(),
		emitNodeUpdate: vi.fn(),
		emitValueChanged: vi.fn(),
		emitStatistics: vi.fn(),
		emitNodeInited: vi.fn(),
		emitNodeLastActive: vi.fn(),
		emitNodeRemoved: vi.fn(),
		emitNotification: vi.fn(),
		emitEvent: vi.fn(),
		takeTmpNode: vi.fn(() => undefined),
		onNodeFound: vi.fn(),
		onNodeAdded: vi.fn(),
		onReplacementComplete: vi.fn(),
		isReplacing: vi.fn(() => false),
		subscribeObserver: vi.fn(),
		notifyObserver: vi.fn(),
		onNameLocationChanged: vi.fn(),
		updateVirtualNodesForNode: vi.fn(),
		removeNodeFromGroups: vi.fn(() => Promise.resolve()),
		refreshBroadcastNodes: vi.fn(),
		updateBroadcastNodeValues: vi.fn(),
		checkConfigurationTemplates: vi.fn(),
		getGroups: vi.fn(),
		getSchedules: vi.fn(() => Promise.resolve()),
		getPriorityRoute: vi.fn(() => Promise.resolve()),
		getCustomSUCReturnRoute: vi.fn(),
		getPrioritySUCReturnRoute: vi.fn(),
		checkNodeFirmwareUpdates: vi.fn(() => Promise.resolve()),
		updateControllerNodeProps: vi.fn(() => Promise.resolve()),
		registerDevice: vi.fn(),
		throttle: vi.fn((_key, callback) => callback()),
		clearThrottle: vi.fn(),
		isDriverReady: vi.fn(() => options.driverReady ?? true),
	}
	const logger = {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}
	const registry = new NodeRegistry(host, logger, options.fakeNodesReader)
	return {
		registry,
		host,
		logger,
		driver,
		zwaveNode,
		controllerNodes,
		stale() {
			current = false
		},
		nextGeneration() {
			generation++
		},
	}
}

afterEach(() => {
	vi.useRealTimers()
})

describe('NodeRegistry persistence and lifecycle', () => {
	it('restores array, legacy, and home-scoped persistence and publishes snapshots', async () => {
		const arrayHarness = createHarness({
			persisted: [undefined, { name: 'Controller' }, { name: 'Kitchen' }],
		})
		await arrayHarness.registry.restorePersistedNodes()
		expect(arrayHarness.registry.storeNodes[2]).toEqual({ name: 'Kitchen' })
		expect(arrayHarness.host.persistNodes).toHaveBeenCalledWith({
			'0x1234': {
				1: { name: 'Controller' },
				2: { name: 'Kitchen' },
			},
		})

		const scoped = createHarness({
			persisted: { '0x1234': { 2: { name: 'Scoped' } } },
		})
		await scoped.registry.restorePersistedNodes()
		expect(scoped.registry.storeNodes[2]).toEqual({ name: 'Scoped' })
		scoped.registry.replaceStoreNodes({
			2: { name: 'Keep' },
			3: {},
		})
		await scoped.registry.updateStoreNodes()
		expect(scoped.host.debug).toHaveBeenCalledWith(
			'Updating store nodes.json',
		)
		expect(scoped.host.persistNodes).toHaveBeenLastCalledWith({
			'0x1234': { 2: { name: 'Keep' } },
		})

		const missingHome = createHarness()
		missingHome.host.getHomeHex = () => undefined
		await expect(
			missingHome.registry.restorePersistedNodes(),
		).rejects.toThrow('HomeHex not set')
		await missingHome.registry.updateStoreNodes()
		expect(missingHome.logger.warn).toHaveBeenCalled()
	})

	it('handles persistence failures and fences late restoration', async () => {
		const harness = createHarness({ persisted: { 2: { name: 'Legacy' } } })
		vi.mocked(harness.host.persistNodes).mockRejectedValueOnce(
			new Error('disk failed'),
		)
		await expect(harness.registry.updateStoreNodes()).rejects.toThrow(
			'disk failed',
		)
		await expect(
			harness.registry.updateStoreNodes(false),
		).resolves.toBeUndefined()
		expect(harness.logger.error).toHaveBeenCalled()

		let resolvePersist!: () => void
		vi.mocked(harness.host.persistNodes).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolvePersist = () => resolve(undefined)
				}),
		)
		const restore = harness.registry.restorePersistedNodes()
		harness.stale()
		resolvePersist()
		await restore
		expect(harness.registry.storeNodes).toEqual({})

		const detached = createHarness()
		await detached.registry.persistDetachedSnapshot({
			2: { name: 'Detached' },
		})
		vi.mocked(detached.host.persistNodes).mockRejectedValueOnce(
			new Error('detached failed'),
		)
		await expect(
			detached.registry.persistDetachedSnapshot({}),
		).rejects.toThrow('detached failed')

		const otherHome = createHarness({
			persisted: { '0xabcd': { 9: { name: 'Other' } } },
		})
		await otherHome.registry.restorePersistedNodes()
		expect(otherHome.registry.storeNodes).toEqual({})

		const staleScoped = createHarness({
			persisted: { '0x1234': { 2: { name: 'Stale' } } },
		})
		staleScoped.stale()
		await staleScoped.registry.restorePersistedNodes()
		await staleScoped.registry.updateStoreNodes()
		expect(staleScoped.registry.storeNodes).toEqual({})

		const latePersist = createHarness()
		let finishPersist!: () => void
		vi.mocked(latePersist.host.persistNodes).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishPersist = () => resolve(undefined)
				}),
		)
		const pending = latePersist.registry.updateStoreNodes()
		latePersist.stale()
		finishPersist()
		await pending
	})

	it('creates, adds, finds, replaces, and removes physical nodes', async () => {
		const harness = createHarness()
		vi.mocked(harness.host.takeTmpNode).mockReturnValueOnce({
			name: 'New',
			loc: 'Room',
		})
		const node = harness.registry.createNode(2)
		expect(node).toMatchObject({ id: 2, name: 'New', loc: 'Room' })
		expect(harness.registry.storeNodes[2]).toMatchObject({
			name: 'New',
			loc: 'Room',
		})
		expect(harness.registry.addNode(harness.zwaveNode)).toBe(node)
		node.ready = true
		expect(harness.registry.addNode(harness.zwaveNode)).toBe(node)
		expect(harness.logger.error).toHaveBeenCalled()

		harness.registry.onNodeFound({ id: 3 } as any)
		expect(harness.host.sendToSocket).toHaveBeenCalledWith(
			socketEvents.nodeFound,
			expect.objectContaining({
				node: expect.objectContaining({ id: 3 }),
			}),
		)
		expect(harness.host.onNodeFound).toHaveBeenCalledWith(3)

		const added = harness.registry.createNode(4)
		added.ready = false
		const addedZwave = createZwaveNode({
			id: 4,
			dsk: new Uint8Array(16),
			getHighestSecurityClass: vi.fn(
				() => SecurityClass.S2_Authenticated,
			),
		})
		harness.controllerNodes.set(4, addedZwave)
		vi.mocked(
			harness.driver.controller.getProvisioningEntry,
		).mockReturnValueOnce({
			name: 'Provisioned',
			location: 'Office',
		} as any)
		await harness.registry.onNodeAdded(addedZwave, {
			lowSecurity: false,
		} as any)
		expect(added.security).toBe(
			SecurityClass[SecurityClass.S2_Authenticated],
		)
		expect(addedZwave).toMatchObject({
			name: 'Provisioned',
			location: 'Office',
		})
		expect(harness.registry.storeNodes[4]).toMatchObject({
			name: 'Provisioned',
			loc: 'Office',
		})
		expect(harness.host.sendToSocket).toHaveBeenCalledWith(
			socketEvents.nodeAdded,
			expect.objectContaining({ node: added }),
		)

		await harness.registry.onNodeRemoved(
			addedZwave,
			RemoveNodeReason.Excluded,
		)
		expect(harness.registry.nodes.has(4)).toBe(false)
		expect(harness.host.removeNodeFromGroups).toHaveBeenCalledWith(4)
		expect(harness.host.emitNodeRemoved).toHaveBeenCalledWith({
			id: 4,
			name: added.name,
			loc: added.loc,
		})
		expect(addedZwave.eventNames()).toEqual([])
	})

	it('updates node settings through the registry and fences late publication', async () => {
		const harness = createHarness()
		const node = harness.registry.createNode(2)

		await expect(harness.registry.setNodeName(2, 'Kitchen')).resolves.toBe(
			true,
		)
		await expect(
			harness.registry.setNodeLocation(2, 'Downstairs'),
		).resolves.toBe(true)
		await expect(harness.registry.setNodeName(2, 'Kitchen')).resolves.toBe(
			true,
		)
		await expect(
			harness.registry.setNodeLocation(2, 'Downstairs'),
		).resolves.toBe(true)
		expect(node).toMatchObject({ name: 'Kitchen', loc: 'Downstairs' })
		expect(harness.zwaveNode).toMatchObject({
			name: 'Kitchen',
			location: 'Downstairs',
		})

		harness.registry.setNodeDefaultSetValueOptions(2, {
			defaultTransitionDuration: '2s',
			defaultVolume: 15,
		})
		expect(node).toMatchObject({
			defaultTransitionDuration: '2s',
			defaultVolume: 15,
		})

		let finishPersist!: () => void
		vi.mocked(harness.host.persistNodes).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishPersist = () => resolve(undefined)
				}),
		)
		const update = harness.registry.setNodeName(2, 'Late')
		harness.stale()
		finishPersist()
		await update
		expect(harness.host.emitNodeUpdate).not.toHaveBeenLastCalledWith(node, {
			name: 'Late',
		})

		const invalid = createHarness()
		await expect(
			invalid.registry.setNodeName(99, 'Missing'),
		).rejects.toThrow('Invalid Node ID')
		await expect(
			invalid.registry.setNodeLocation(99, 'Missing'),
		).rejects.toThrow('Invalid Node ID')
		expect(() =>
			invalid.registry.setNodeDefaultSetValueOptions(99, {
				defaultVolume: 10,
			}),
		).toThrow('Invalid Node ID')

		const driverOnly = createHarness()
		driverOnly.registry.setNodeDefaultSetValueOptions(2, {
			defaultVolume: 12,
		})
		expect(driverOnly.zwaveNode.defaultVolume).toBe(12)
	})

	it('preserves persistence failures and value log coercion', async () => {
		const harness = createHarness()
		harness.registry.createNode(2)
		vi.mocked(harness.host.persistNodes).mockRejectedValueOnce(
			new Error('write failed'),
		)
		await expect(
			harness.registry.updateStoreNodes(false),
		).resolves.toBeUndefined()
		expect(harness.logger.error).toHaveBeenCalledWith(
			'Error while updating store nodes: write failed',
			expect.any(Error),
		)

		harness.zwaveNode.getValue = vi.fn(() => Symbol('event'))
		expect(() =>
			harness.registry.addValue(harness.zwaveNode, {
				commandClass: CommandClasses['Binary Switch'],
				commandClassName: 'Binary Switch',
				endpoint: 0,
				property: 'event',
				propertyName: 'event',
			}),
		).toThrow(TypeError)
	})

	it('loads fake nodes as registry values and fences stale reads', async () => {
		const harness = createHarness({
			fakeNodesReader: () =>
				Promise.resolve(
					JSON.stringify([
						{
							id: 8,
							name: 'Fake',
							values: [
								{
									id: '8-37-0-currentValue',
									nodeId: 8,
									commandClass: 37,
									endpoint: 0,
									property: 'currentValue',
									value: true,
								},
							],
						},
					]),
				),
		})
		await harness.registry.loadFakeNodes()
		expect(harness.registry.nodes.get(8)).toMatchObject({
			id: 8,
			name: 'Fake',
			inited: false,
			hassDevices: {},
			values: {
				'37-0-currentValue': expect.objectContaining({ value: true }),
			},
		})
		expect(harness.host.emitNodeUpdate).toHaveBeenCalledWith(
			harness.registry.nodes.get(8),
		)

		let finish!: (contents: string | undefined) => void
		const stale = createHarness({
			fakeNodesReader: () =>
				new Promise((resolve) => {
					finish = resolve
				}),
		})
		const pending = stale.registry.loadFakeNodes()
		stale.stale()
		finish(JSON.stringify([{ id: 9, values: [] }]))
		await pending
		expect(stale.registry.nodes.has(9)).toBe(false)

		const absent = createHarness({
			fakeNodesReader: () => Promise.resolve(undefined),
		})
		await absent.registry.loadFakeNodes()
		expect(absent.registry.nodes.size).toBe(0)
	})
})

describe('NodeRegistry node events and values', () => {
	it('projects status, interview, liveness, queue order, and errors', async () => {
		const harness = createHarness()
		const node = harness.registry.createNode(2)
		harness.registry.projectNode(harness.zwaveNode)
		harness.registry.updateNodeStatus(harness.zwaveNode, {
			updateInterviewStage: true,
		})
		expect(node).toMatchObject({
			status: 'Alive',
			available: true,
			interviewStage: 'Complete',
		})
		harness.zwaveNode.status = NodeStatus.Dead
		harness.registry.updateNodeStatus(harness.zwaveNode, {
			updateStatusOnly: true,
		})
		expect(harness.host.emitNodeUpdate).toHaveBeenLastCalledWith(node, {
			status: 'Dead',
			available: false,
		})

		harness.registry.onNodeEvent('ready', harness.zwaveNode, 'first')
		harness.registry.onNodeEvent('sleep', harness.zwaveNode, 'second')
		harness.registry.onNodeEvent('alive', harness.zwaveNode, 'third')
		expect(node.eventsQueue.map((entry) => entry.event)).toEqual([
			'sleep',
			'alive',
		])
		expect(harness.host.sendToSocket).toHaveBeenLastCalledWith(
			socketEvents.nodeEvent,
			expect.objectContaining({ nodeId: 2 }),
		)

		harness.registry.setInterviewProgress(
			harness.zwaveNode,
			20,
			'CommandClasses',
			true,
		)
		expect(harness.host.throttle).toHaveBeenCalledWith(
			'_setInterviewProgress_2',
			expect.any(Function),
			250,
		)
		harness.registry.onInterviewStarted(harness.zwaveNode)
		harness.registry.onInterviewStageCompleted(
			harness.zwaveNode,
			'command classes',
		)
		harness.registry.onInterviewProgress(harness.zwaveNode, {
			progress: 50.4,
			stage: InterviewStage.CommandClasses,
		} as any)
		harness.registry.onInterviewFailed(harness.zwaveNode, {
			errorMessage: 'failed',
		} as any)
		harness.registry.onInterviewCompleted(harness.zwaveNode)
		await Promise.resolve()
		harness.registry.onWakeUp(harness.zwaveNode, NodeStatus.Asleep)
		harness.registry.onSleep(harness.zwaveNode, NodeStatus.Unknown)
		harness.registry.onAlive(harness.zwaveNode, NodeStatus.Dead)
		harness.registry.onAlive(harness.zwaveNode, NodeStatus.Unknown)
		harness.registry.onDead(harness.zwaveNode, NodeStatus.Unknown)
		harness.registry.onInfoReceived(harness.zwaveNode)
		expect(harness.host.emitEvent).toHaveBeenCalledWith(
			'node',
			'node wakeup',
			expect.any(Object),
		)

		harness.registry.nodes.delete(2)
		harness.registry.updateNodeStatus(harness.zwaveNode)
		harness.registry.onReady(harness.zwaveNode)
		expect(harness.host.logNode).toHaveBeenCalledWith(
			harness.zwaveNode,
			'error',
			expect.stringContaining("doesn't exists"),
		)
	})

	it('adds, updates, resets, removes, and reprojects values', async () => {
		vi.useFakeTimers()
		const zwaveValue = {
			commandClass: CommandClasses['Binary Switch'],
			commandClassName: 'Binary Switch',
			endpoint: 0,
			property: 'currentValue',
			propertyName: 'currentValue',
		}
		const target = {
			...zwaveValue,
			property: 'targetValue',
			propertyName: 'targetValue',
		}
		const zwaveNode = createZwaveNode({
			getDefinedValueIDs: vi.fn(() => [zwaveValue, target]),
			getValue: vi.fn(() => 1),
			getValueMetadata: vi.fn(() => ({
				type: 'number',
				readable: true,
				writeable: true,
				states: { 0: 'Off', 1: 'On' },
			})),
		})
		const harness = createHarness({ node: zwaveNode })
		const node = harness.registry.createNode(2)
		const added = harness.registry.addValue(zwaveNode, zwaveValue as any)
		expect(added?.valueId).toMatchObject({
			value: 1,
			targetValue: `${CommandClasses['Binary Switch']}-0-targetValue`,
		})
		expect(harness.host.emitValueChanged).toHaveBeenCalledWith(
			added?.valueId,
			node,
			true,
		)

		harness.registry.onValueAdded(zwaveNode, {
			...target,
			newValue: 2,
		} as any)
		harness.registry.onMetadataUpdated(zwaveNode, {
			...zwaveValue,
			metadata: {
				type: 'number',
				readable: true,
				writeable: false,
				min: 0,
				max: 99,
			},
		} as any)
		expect(harness.host.sendToSocket).toHaveBeenCalledWith(
			socketEvents.metadataUpdated,
			expect.objectContaining({ max: 99 }),
		)

		harness.registry.onValueUpdated(zwaveNode, {
			...zwaveValue,
			prevValue: 1,
			newValue: new Uint8Array([10]),
			stateless: false,
		} as any)
		const currentValue =
			node.values[`${CommandClasses['Binary Switch']}-0-currentValue`]
		expect(currentValue.value).toBe('0x0a')
		harness.registry.onValueNotification(zwaveNode, {
			...zwaveValue,
			value: 5,
			stateless: true,
		} as any)
		expect(currentValue.stateless).toBe(true)
		await vi.advanceTimersByTimeAsync(1000)
		expect(currentValue.value).toBeUndefined()

		harness.registry.onValueRemoved(zwaveNode, zwaveValue as any)
		expect(harness.host.sendToSocket).toHaveBeenCalledWith(
			socketEvents.valueRemoved,
			expect.objectContaining({ property: 'currentValue' }),
		)
		harness.registry.removeValue(zwaveNode, zwaveValue as any)
		expect(harness.host.logNode).toHaveBeenCalledWith(
			zwaveNode,
			'warn',
			expect.stringContaining('no such node'),
		)

		const naming = {
			...zwaveValue,
			commandClass: CommandClasses['Node Naming and Location'],
		}
		expect(harness.registry.addValue(zwaveNode, naming as any)).toBeNull()
		expect(harness.host.onNameLocationChanged).toHaveBeenCalled()
		harness.registry.nodes.delete(2)
		expect(
			harness.registry.addValue(zwaveNode, zwaveValue as any),
		).toBeNull()
		expect(() =>
			harness.registry.parseValue(
				zwaveNode,
				zwaveValue as any,
				{ type: 'number', readable: true, writeable: true } as any,
			),
		).toThrow('unknown node')
	})

	it('runs ready coordination, route/schedule failures, and physical statistics', async () => {
		const value = {
			commandClass: CommandClasses['Binary Switch'],
			commandClassName: 'Binary Switch',
			endpoint: 0,
			property: 'currentValue',
			propertyName: 'currentValue',
		}
		const zwaveNode = createZwaveNode({
			getDefinedValueIDs: vi.fn(() => [value]),
			commandClasses: {
				'Schedule Entry Lock': { isSupported: vi.fn(() => true) },
			},
		})
		const harness = createHarness({ node: zwaveNode })
		const node = harness.registry.createNode(2)
		node.values['old'] = { value: 0 } as any
		vi.mocked(harness.host.getSchedules).mockRejectedValueOnce(
			new Error('schedule'),
		)
		vi.mocked(harness.host.getPriorityRoute).mockRejectedValueOnce(
			new Error('route'),
		)
		harness.registry.onReady(zwaveNode)
		await Promise.resolve()
		await Promise.resolve()
		expect(node.ready).toBe(true)
		expect(harness.host.registerDevice).toHaveBeenCalledWith(node)
		expect(harness.host.subscribeObserver).toHaveBeenCalled()
		expect(harness.host.getGroups).toHaveBeenCalledWith(2)
		expect(harness.host.checkConfigurationTemplates).toHaveBeenCalledWith(
			node,
			zwaveNode,
		)
		expect(harness.host.updateBroadcastNodeValues).toHaveBeenCalled()

		const stats = { lastSeen: new Date(999), commandsTX: 1 }
		harness.registry.onStatisticsUpdated(zwaveNode, stats as any)
		expect(node.lastActive).toBe(999)
		expect(harness.host.emitNodeLastActive).toHaveBeenCalledWith(node)
		expect(harness.host.emitStatistics).toHaveBeenCalledWith(
			node,
			expect.objectContaining({ statistics: stats }),
		)
	})

	it('covers defensive, stale, controller, and value edge paths', async () => {
		vi.useFakeTimers()
		const harness = createHarness()
		const registry = harness.registry as any
		const valueId = {
			commandClass: CommandClasses['Binary Switch'],
			commandClassName: 'Binary Switch',
			endpoint: 0,
			property: 'currentValue',
			propertyName: 'currentValue',
		}

		registry.projectNode(createZwaveNode({ id: 99 }))
		registry.removeNode(99)
		vi.mocked(harness.host.isReplacing).mockReturnValue(true)
		registry.storeNodes[98] = { name: 'Replacing' }
		registry.removeNode(98)
		expect(registry.storeNodes[98]).toBeDefined()

		vi.mocked(harness.host.isDriverReady).mockReturnValue(false)
		registry.onNodeFound({ id: 99 })
		const found = registry.createNode(97)
		registry.onNodeFound({ id: 97 })
		expect(harness.host.emitNodeUpdate).toHaveBeenCalledWith(found)

		await registry.onNodeAdded(createZwaveNode({ id: 96 }), {
			lowSecurity: true,
		})
		harness.stale()
		registry.onNodeFound({ id: 94 })
		await registry.onNodeAdded(createZwaveNode({ id: 95 }), {
			lowSecurity: false,
		})
		await registry.onNodeRemoved(
			createZwaveNode({ id: 95 }),
			RemoveNodeReason.Excluded,
		)
		expect(registry.isCurrentNode(harness.zwaveNode)).toBe(false)

		const live = createHarness()
		const node = live.registry.createNode(2)
		vi.mocked(live.host.isDriverReady).mockReturnValue(false)
		await live.registry.onNodeAdded(live.zwaveNode, {
			lowSecurity: false,
		} as any)
		vi.mocked(live.host.isDriverReady).mockReturnValue(true)
		live.zwaveNode.interviewStage = InterviewStage.ProtocolInfo
		live.registry.updateNodeStatus(live.zwaveNode)
		live.registry.onNodeEvent('ready', createZwaveNode({ id: 99 }))
		live.registry.setInterviewProgress(live.zwaveNode, 10)
		live.registry.setInterviewProgress(createZwaveNode({ id: 99 }), 10)
		let throttled!: () => void
		vi.mocked(live.host.throttle).mockImplementationOnce(
			(_key, callback) => {
				throttled = callback
			},
		)
		live.registry.setInterviewProgress(live.zwaveNode, 11, undefined, true)
		live.registry.nodes.set(2, { ...node } as any)
		throttled()
		live.registry.nodes.set(2, node)
		node.manufacturerId = 1
		live.registry.onInterviewCompleted(live.zwaveNode)
		vi.mocked(live.host.checkNodeFirmwareUpdates).mockRejectedValueOnce(
			new Error('firmware check'),
		)
		live.registry.onInterviewCompleted(live.zwaveNode)
		await Promise.resolve()
		live.registry.nodes.delete(2)
		live.registry.onInterviewCompleted(live.zwaveNode)
		live.registry.nodes.set(2, node)
		live.registry.onWakeUp(live.zwaveNode, NodeStatus.Unknown)
		live.registry.onSleep(live.zwaveNode, NodeStatus.Awake)
		live.registry.onDead(live.zwaveNode, NodeStatus.Alive)

		live.registry.updateValue(createZwaveNode({ id: 99 }), {
			...valueId,
			prevValue: 1,
			newValue: 2,
		})
		live.zwaveNode.getValue = vi.fn(() => undefined)
		live.zwaveNode.getValueMetadata = vi.fn(() => ({
			type: 'duration',
			readable: true,
			writeable: true,
		}))
		live.registry.updateValue(live.zwaveNode, {
			...valueId,
			prevValue: new Uint8Array([1]),
			newValue: undefined,
		})
		const projected =
			node.values[`${CommandClasses['Binary Switch']}-0-currentValue`]
		projected.toUpdate = true
		live.registry.updateValue(live.zwaveNode, {
			...valueId,
			prevValue: new Uint8Array([1]),
			newValue: undefined,
			stateless: true,
		})
		live.registry.updateValue(live.zwaveNode, {
			...valueId,
			prevValue: undefined,
			newValue: undefined,
			stateless: true,
		})
		live.registry.removeValue(live.zwaveNode, valueId as any)
		await vi.advanceTimersByTimeAsync(1000)

		const naming = {
			...valueId,
			commandClass: CommandClasses['Node Naming and Location'],
		}
		node.values = {}
		live.zwaveNode.getValueMetadata = vi.fn(() => ({
			type: 'number',
			readable: true,
			writeable: true,
		}))
		live.registry.updateValue(live.zwaveNode, {
			...naming,
			newValue: 'Name',
		})
		live.zwaveNode.ready = false
		live.registry.onValueAdded(live.zwaveNode, {
			...valueId,
			newValue: 1,
		} as any)
		live.registry.onStatisticsUpdated(live.zwaveNode, {} as any)
		live.registry.nodes.delete(2)
		live.registry.onStatisticsUpdated(live.zwaveNode, {} as any)
		live.registry.onFirmwareUpdateProgress(live.zwaveNode, {
			currentFile: 1,
			totalFiles: 1,
			sentFragments: 1,
			totalFragments: 1,
			progress: 100,
		})
		live.registry.onFirmwareUpdateFinished(live.zwaveNode, {
			success: false,
			status: 255,
			reInterview: false,
			waitTime: 2,
		} as any)

		const controller = createHarness({
			node: createZwaveNode({ id: 1, isControllerNode: true }),
		})
		const controllerNode = controller.registry.createNode(1)
		controllerNode.statistics = { messagesRX: 10 } as any
		controller.registry.onControllerStatisticsUpdated({
			messagesRX: 10,
		} as any)
		;(controller.driver.controller as any).ownNodeId = undefined
		controller.registry.onControllerStatisticsUpdated({
			messagesRX: 11,
		} as any)
		;(controller.driver as any).controller = undefined
		controller.registry.onControllerStatisticsUpdated({
			messagesRX: 12,
		} as any)

		const controllerReady = createHarness({
			node: createZwaveNode({
				id: 1,
				isControllerNode: true,
				protocol: Protocols.ZWaveLongRange,
			}),
		})
		controllerReady.registry.createNode(1)
		vi.mocked(
			controllerReady.host.updateControllerNodeProps,
		).mockRejectedValueOnce(new Error('controller props'))
		controllerReady.registry.onReady(controllerReady.zwaveNode)
		await Promise.resolve()
		expect(controllerReady.host.getPriorityRoute).not.toHaveBeenCalled()
	})
})

describe('NodeRegistry notifications, firmware, statistics, and listeners', () => {
	it('adapts notification command classes and firmware events', () => {
		const harness = createHarness()
		const node = harness.registry.createNode(2)
		const endpoint = { nodeId: 2, tryGetNode: () => harness.zwaveNode }
		harness.registry.onNotification(
			endpoint as any,
			CommandClasses.Notification,
			{
				label: 'Motion',
				eventLabel: 'detected',
				parameters: new Uint8Array([1, 2]),
			} as any,
		)
		harness.registry.onNotification(
			endpoint as any,
			CommandClasses['Entry Control'],
			{
				eventType: 1,
				dataType: 2,
				eventData: new Uint8Array([10]),
			} as any,
		)
		harness.registry.onNotification(
			endpoint as any,
			CommandClasses['Multilevel Switch'],
			{ eventType: 1, direction: 'up' } as any,
		)
		harness.registry.onNotification(
			endpoint as any,
			CommandClasses.Battery,
			{ eventType: 'replacement', urgency: 1 } as any,
		)
		harness.registry.onNotification(
			endpoint as any,
			CommandClasses.Powerlevel,
			{} as any,
		)
		harness.registry.onNotification(endpoint as any, 999, {} as any)
		harness.registry.onNotification(
			{ nodeId: 9, tryGetNode: () => undefined } as any,
			CommandClasses.Notification,
			{} as any,
		)
		expect(harness.host.emitNotification).toHaveBeenCalledTimes(4)

		harness.registry.onFirmwareUpdateProgress(harness.zwaveNode, {
			currentFile: 1,
			totalFiles: 1,
			sentFragments: 1,
			totalFragments: 2,
			progress: 50,
		})
		expect(node.firmwareUpdate).toMatchObject({ progress: 50 })
		harness.registry.onFirmwareUpdateFinished(harness.zwaveNode, {
			success: true,
			status: FirmwareUpdateStatus.OK_NoRestart,
			reInterview: false,
		} as any)
		expect(node.firmwareUpdate).toBeUndefined()
		expect(harness.host.clearThrottle).toHaveBeenCalledWith(
			'_onNodeFirmwareUpdateProgress_2',
		)
	})

	it('tracks controller background RSSI and emits controller events', () => {
		const controller = createZwaveNode({ id: 1, isControllerNode: true })
		const harness = createHarness({ node: controller })
		const node = harness.registry.createNode(1)
		node.statistics = { messagesRX: 1 } as any
		for (let index = 0; index < 362; index++) {
			harness.registry.onControllerStatisticsUpdated({
				messagesRX: index + 2,
				backgroundRSSI: {
					timestamp: index * 60_000,
					channel0: { current: -80, average: -80 },
					channel1: { current: -81, average: -81 },
					channel2: { current: -82, average: -82 },
				},
			} as any)
		}
		expect(node.lastActive).toEqual(expect.any(Number))
		expect(node.bgRSSIPoints?.length).toBeLessThanOrEqual(361)
		expect(harness.host.emitEvent).toHaveBeenLastCalledWith(
			'controller',
			'statistics updated',
			expect.any(Object),
		)
	})

	it('fences and cleans up controller node listeners', () => {
		const harness = createHarness()
		const controller = Object.assign(
			new EventEmitter(),
			harness.driver.controller,
		)
		harness.driver.controller = controller as any
		harness.registry.bindControllerEvents(controller as any)
		expect(controller.listenerCount('node found')).toBe(1)
		expect(controller.listenerCount('node added')).toBe(1)
		expect(controller.listenerCount('node removed')).toBe(1)
		expect(controller.listenerCount('statistics updated')).toBe(1)

		controller.emit('node found', { id: 2 })
		controller.emit('node added', harness.zwaveNode, {
			lowSecurity: false,
		})
		controller.emit(
			'node removed',
			harness.zwaveNode,
			RemoveNodeReason.Excluded,
		)
		controller.emit('statistics updated', { messagesRX: 1 })
		expect(harness.host.onNodeFound).toHaveBeenCalledWith(2)
		expect(harness.host.onNodeAdded).toHaveBeenCalledWith(2)
		expect(harness.host.removeNodeFromGroups).toHaveBeenCalledWith(2)
		const eventCount = vi.mocked(harness.host.emitEvent).mock.calls.length
		harness.stale()
		controller.emit('statistics updated', { messagesRX: 2 })
		expect(harness.host.emitEvent).toHaveBeenCalledTimes(eventCount)

		harness.registry.close()
		expect(controller.eventNames()).toEqual([])
	})

	it('binds exact listeners, fences replacement, and cleans up idempotently', () => {
		const harness = createHarness()
		const node = harness.registry.createNode(2)
		harness.registry.bindNodeEvents(harness.zwaveNode)
		expect(harness.zwaveNode.listenerCount('ready')).toBe(2)

		harness.zwaveNode.emit('ready', harness.zwaveNode)
		harness.zwaveNode.emit('interview started', harness.zwaveNode)
		harness.zwaveNode.emit(
			'interview stage completed',
			harness.zwaveNode,
			'protocol info',
		)
		harness.zwaveNode.emit('interview completed', harness.zwaveNode)
		harness.zwaveNode.emit('interview failed', harness.zwaveNode, {
			errorMessage: 'failed',
		})
		harness.zwaveNode.emit('interview progress', harness.zwaveNode, {
			progress: 10,
			stage: InterviewStage.ProtocolInfo,
		})
		harness.zwaveNode.emit('wake up', harness.zwaveNode, NodeStatus.Asleep)
		harness.zwaveNode.emit('sleep', harness.zwaveNode, NodeStatus.Awake)
		harness.zwaveNode.emit('alive', harness.zwaveNode, NodeStatus.Dead)
		harness.zwaveNode.emit('dead', harness.zwaveNode, NodeStatus.Alive)
		const valueId = {
			commandClass: CommandClasses['Binary Switch'],
			commandClassName: 'Binary Switch',
			endpoint: 0,
			property: 'currentValue',
			propertyName: 'currentValue',
		}
		harness.zwaveNode.emit('value added', harness.zwaveNode, {
			...valueId,
			newValue: 1,
		})
		harness.zwaveNode.emit('value updated', harness.zwaveNode, {
			...valueId,
			prevValue: 1,
			newValue: 2,
		})
		harness.zwaveNode.emit('value notification', harness.zwaveNode, {
			...valueId,
			value: 3,
		})
		harness.zwaveNode.emit('metadata updated', harness.zwaveNode, {
			...valueId,
			metadata: {
				type: 'number',
				readable: true,
				writeable: true,
			},
		})
		harness.zwaveNode.emit(
			'notification',
			{
				nodeId: 2,
				tryGetNode: () => harness.zwaveNode,
			},
			CommandClasses.Notification,
			{
				label: 'Motion',
				eventLabel: 'detected',
				parameters: 1,
			},
		)
		expect(
			node.eventsQueue.some((entry) => entry.event === 'notification'),
		).toBe(false)
		harness.zwaveNode.emit('firmware update progress', harness.zwaveNode, {
			currentFile: 1,
			totalFiles: 1,
			sentFragments: 1,
			totalFragments: 2,
			progress: 50,
		})
		harness.zwaveNode.emit('firmware update finished', harness.zwaveNode, {
			success: true,
			status: FirmwareUpdateStatus.OK_NoRestart,
			reInterview: false,
		})
		harness.zwaveNode.emit('statistics updated', harness.zwaveNode, {
			lastSeen: new Date(10),
		})
		harness.zwaveNode.emit('value removed', harness.zwaveNode, valueId)
		harness.zwaveNode.emit('node info received', harness.zwaveNode)
		expect(harness.host.emitEvent).toHaveBeenCalled()

		const before = vi.mocked(harness.host.emitEvent).mock.calls.length
		const replacement = createZwaveNode()
		harness.controllerNodes.set(2, replacement)
		harness.registry.bindNodeEvents(replacement)
		expect(harness.zwaveNode.listenerCount('ready')).toBe(0)
		expect(replacement.listenerCount('ready')).toBe(2)
		harness.zwaveNode.emit('interview started', harness.zwaveNode)
		expect(vi.mocked(harness.host.emitEvent).mock.calls).toHaveLength(
			before,
		)

		harness.registry.cleanupNodeListeners(replacement)
		harness.registry.cleanupNodeListeners(replacement)
		expect(harness.zwaveNode.listenerCount('ready')).toBe(0)
		expect(replacement.listenerCount('ready')).toBe(0)
		harness.registry.close()
		harness.registry.close()
		expect(harness.registry.current).toBe(false)
	})

	it('closes active listeners and stateless value timers', async () => {
		vi.useFakeTimers()
		try {
			const harness = createHarness()
			harness.registry.createNode(2)
			harness.registry.bindNodeEvents(harness.zwaveNode)
			harness.registry.updateValue(harness.zwaveNode, {
				commandClass: CommandClasses['Binary Switch'],
				endpoint: 0,
				property: 'event',
				newValue: 1,
				stateless: true,
			})
			const emitCount = vi.mocked(harness.host.emitValueChanged).mock
				.calls.length

			harness.registry.close()
			await vi.advanceTimersByTimeAsync(1000)

			expect(harness.zwaveNode.listenerCount('ready')).toBe(0)
			expect(harness.host.emitValueChanged).toHaveBeenCalledTimes(
				emitCount,
			)
		} finally {
			vi.useRealTimers()
		}
	})
})
