/* eslint-disable @typescript-eslint/unbound-method */
import { CommandClasses, SecurityClass } from '@zwave-js/core'
import { EventEmitter } from 'node:events'
import type {
	ControllerStatistics,
	FirmwareUpdateResult,
	FoundNode,
	InclusionResult,
	InterviewProgress,
	NodeInterviewFailedEventArgs,
	NodeStatistics,
	ZWaveNode,
	ZWaveNodeMetadataUpdatedArgs,
	ZWaveNodeValueAddedArgs,
	ZWaveNodeValueNotificationArgs,
	ZWaveNodeValueRemovedArgs,
	ZWaveNodeValueUpdatedArgs,
	ZWaveNotificationCallbackParams_NotificationCC,
} from 'zwave-js'
import {
	FirmwareUpdateStatus,
	InterviewStage,
	NodeStatus,
	RemoveNodeReason,
} from 'zwave-js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { NodesStoreFile } from '#api/config/store.ts'
import { socketEvents } from '#api/lib/SocketEvents.ts'
import type { ZUINode, ZUIValueId } from '#api/lib/ZwaveClient.ts'
import {
	NodeRegistry,
	type NodeRegistryController,
	type NodeRegistryDriver,
	type NodeRegistryHost,
} from '#api/lib/zwave/NodeRegistry.ts'
import {
	createServiceLogger,
	createValue,
	createZWaveNode,
} from './nodeFixtures.ts'
import { requireDefined } from '../testUtils.ts'

class ControllerNodeMap extends Map<number, ZWaveNode> {
	getOrThrow(key: number): ZWaveNode {
		const node = this.get(key)
		if (!node) throw new Error(`Missing controller node ${key}`)
		return node
	}
}

function nodeStatistics(
	overrides: Partial<NodeStatistics> = {},
): NodeStatistics {
	return {
		commandsTX: 0,
		commandsRX: 0,
		commandsDroppedRX: 0,
		commandsDroppedTX: 0,
		timeoutResponse: 0,
		...overrides,
	}
}

function controllerStatistics(
	overrides: Partial<ControllerStatistics> = {},
): ControllerStatistics {
	return {
		messagesTX: 0,
		messagesRX: 0,
		messagesDroppedRX: 0,
		messagesDroppedTX: 0,
		NAK: 0,
		CAN: 0,
		timeoutACK: 0,
		timeoutResponse: 0,
		timeoutCallback: 0,
		...overrides,
	}
}

function createHarness(
	options: {
		persisted?: NodesStoreFile
		node?: ZWaveNode
		driverReady?: boolean
		fakeNodesReader?: () => Promise<string | undefined>
	} = {},
) {
	let generation = 1
	let current = true
	const zwaveNode = options.node ?? createZWaveNode()
	const controllerNodes = new ControllerNodeMap([[zwaveNode.id, zwaveNode]])
	const persisted: NodesStoreFile = options.persisted ?? {}
	const controller = Object.assign(new EventEmitter(), {
		nodes: controllerNodes,
		ownNodeId: 1,
		supportsLongRange: true,
		getPrioritySUCReturnRouteCached: vi.fn(() => undefined),
		getCustomSUCReturnRoutesCached: vi.fn<
			NodeRegistryController['getCustomSUCReturnRoutesCached']
		>(() => []),
		getProvisioningEntry:
			vi.fn<NodeRegistryController['getProvisioningEntry']>(),
		getSupportedRFRegions: vi.fn(() => []),
	})
	const driver = {
		configManager: { lookupManufacturer: vi.fn(() => 'Maker') },
		controller,
	} satisfies NodeRegistryDriver
	const host: NodeRegistryHost = {
		getDriver: () => driver,
		getZWaveNode: (nodeId) => controllerNodes.get(nodeId),
		getGeneration: () => generation,
		isCurrent: (candidate, captured) =>
			current && candidate === registry && captured === generation,
		getHomeHex: () => '0x1234',
		getMaxNodeEventsQueueSize: () => 2,
		getPersistedNodes: () => persisted,
		persistNodes: vi.fn(() => Promise.resolve()),
		runPersistenceTransaction: (operation) => operation(),
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
	const logger = createServiceLogger()
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
	it('restores supported persisted node formats', async () => {
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
		expect(scoped.host.persistNodes).toHaveBeenLastCalledWith({
			'0x1234': { 2: { name: 'Keep' } },
		})

		const missingHome = createHarness()
		missingHome.host.getHomeHex = () => undefined
		await expect(
			missingHome.registry.restorePersistedNodes(),
		).rejects.toThrow()
		await missingHome.registry.updateStoreNodes()
		expect(missingHome.logger.warn).toHaveBeenCalled()
	})

	it('reports persistence failures and skips state restored after restart', async () => {
		const harness = createHarness({ persisted: { 2: { name: 'Legacy' } } })
		vi.mocked(harness.host.persistNodes).mockRejectedValueOnce(
			new Error('disk failed'),
		)
		await expect(harness.registry.updateStoreNodes()).rejects.toThrow()
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

		let ready = true
		let resolveReadyPersist!: () => void
		const superseded = createHarness({
			persisted: { 2: { name: 'Superseded' } },
		})
		vi.mocked(superseded.host.persistNodes).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveReadyPersist = () => resolve(undefined)
				}),
		)
		const supersededRestore = superseded.registry.restorePersistedNodes(
			() => ready,
		)
		ready = false
		resolveReadyPersist()
		await supersededRestore
		expect(superseded.registry.storeNodes).toEqual({})

		const detached = createHarness()
		await detached.registry.persistDetachedSnapshot(
			{ 2: { name: 'Detached' } },
			'0x1234',
		)
		await detached.registry.persistDetachedSnapshot(
			{ 3: { name: 'Captured home' } },
			'0xabcd',
		)
		expect(detached.host.persistNodes).toHaveBeenLastCalledWith({
			'0xabcd': { 3: { name: 'Captured home' } },
		})
		vi.mocked(detached.host.persistNodes).mockRejectedValueOnce(
			new Error('detached failed'),
		)
		await expect(
			detached.registry.persistDetachedSnapshot({}, '0x1234'),
		).rejects.toThrow()

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
	})

	it('persists queued node changes after restart', async () => {
		const harness = createHarness()
		harness.registry.replaceStoreNodes({ 2: { name: 'Captured' } })
		let release!: () => void
		harness.host.runPersistenceTransaction = async (operation) => {
			await new Promise<void>((resolve) => {
				release = resolve
			})
			await operation()
		}

		const update = harness.registry.updateStoreNodes()
		harness.registry.replaceStoreNodes({ 3: { name: 'Replacement' } })
		harness.stale()
		release()
		await update

		expect(harness.host.persistNodes).toHaveBeenCalledWith({
			'0x1234': { 2: { name: 'Captured' } },
		})

		await harness.registry.persistDetachedSnapshot(
			{ 4: { name: 'Detached' } },
			'0xabcd',
		)
		expect(harness.host.persistNodes).toHaveBeenLastCalledWith({
			'0xabcd': { 4: { name: 'Detached' } },
		})
	})

	it('publishes node discovery, inclusion, and removal', async () => {
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
		harness.registry.addNode(harness.zwaveNode)
		node.ready = true
		harness.registry.addNode(harness.zwaveNode)
		expect(harness.registry.nodes.get(2)).toMatchObject({
			id: 2,
			ready: true,
		})

		harness.registry.onNodeFound({ id: 3 } satisfies FoundNode)
		expect(harness.host.sendToSocket).toHaveBeenCalledWith(
			socketEvents.nodeFound,
			expect.objectContaining({
				node: expect.objectContaining({ id: 3 }),
			}),
		)

		const added = harness.registry.createNode(4)
		added.ready = false
		const addedZwave = createZWaveNode({
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
			nodeId: 4,
			dsk: '00000-00000-00000-00000-00000-00000-00000-00000',
			securityClasses: [SecurityClass.S2_Authenticated],
			name: 'Provisioned',
			location: 'Office',
		})
		await harness.registry.onNodeAdded(addedZwave, {
			lowSecurity: false,
		} satisfies InclusionResult)
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
		expect(harness.host.emitNodeRemoved).toHaveBeenCalledWith({
			id: 4,
			name: added.name,
			loc: added.loc,
		})
	})

	it('does not publish node settings completed after restart', async () => {
		const harness = createHarness()
		const node = harness.registry.createNode(2)

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
		expect(harness.host.emitNodeUpdate).not.toHaveBeenCalledWith(node, {
			name: 'Late',
		})

		const invalid = createHarness()
		await expect(
			invalid.registry.setNodeName(99, 'Missing'),
		).rejects.toThrow()
		await expect(
			invalid.registry.setNodeLocation(99, 'Missing'),
		).rejects.toThrow()
		expect(() =>
			invalid.registry.setNodeDefaultSetValueOptions(99, {
				defaultVolume: 10,
			}),
		).toThrow()

		const driverOnly = createHarness()
		driverOnly.registry.setNodeDefaultSetValueOptions(2, {
			defaultVolume: 12,
		})
		expect(driverOnly.zwaveNode.defaultVolume).toBe(12)
	})

	it('continues value updates when persistence fails', async () => {
		const symbol = Symbol('event')
		const harness = createHarness({
			node: createZWaveNode({}, { value: symbol }),
		})
		harness.registry.createNode(2)
		vi.mocked(harness.host.persistNodes).mockRejectedValueOnce(
			new Error('write failed'),
		)
		await expect(
			harness.registry.updateStoreNodes(false),
		).resolves.toBeUndefined()
		const result = harness.registry.addValue(
			harness.zwaveNode,
			createValue({ property: 'event', propertyName: 'event' }),
		)
		expect(result?.valueId.value).toBe(symbol)
	})

	it('publishes configured fake node values only before restart', async () => {
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
									commandClass:
										CommandClasses['Binary Switch'],
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

		let ready = true
		let finishSuperseded!: (contents: string | undefined) => void
		const superseded = createHarness({
			fakeNodesReader: () =>
				new Promise((resolve) => {
					finishSuperseded = resolve
				}),
		})
		const supersededLoad = superseded.registry.loadFakeNodes(() => ready)
		ready = false
		finishSuperseded(JSON.stringify([{ id: 10, values: [] }]))
		await supersededLoad
		expect(superseded.registry.nodes.has(10)).toBe(false)

		const absent = createHarness({
			fakeNodesReader: () => Promise.resolve(undefined),
		})
		await absent.registry.loadFakeNodes()
		expect(absent.registry.nodes.size).toBe(0)
	})
})

describe('NodeRegistry node events and values', () => {
	it('publishes status, interview, and liveness events in order', async () => {
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
		const deadZwaveNode = createZWaveNode({ status: NodeStatus.Dead })
		harness.registry.updateNodeStatus(deadZwaveNode, {
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
		expect(node).toMatchObject({
			interviewProgress: 20,
			interviewStage: 'CommandClasses',
		})
		harness.registry.onInterviewStarted(harness.zwaveNode)
		expect(harness.host.emitEvent).toHaveBeenCalledWith(
			'node',
			'node interview started',
			expect.any(Object),
		)
		harness.registry.onInterviewStageCompleted(
			harness.zwaveNode,
			'command classes',
		)
		expect(harness.host.emitEvent).toHaveBeenCalledWith(
			'node',
			'node interview stage completed',
			expect.any(Object),
		)
		harness.registry.onInterviewProgress(harness.zwaveNode, {
			progress: 50.4,
			stage: InterviewStage.CommandClasses,
		} satisfies InterviewProgress)
		expect(node.interviewProgress).toBe(50)
		harness.registry.onInterviewFailed(harness.zwaveNode, {
			errorMessage: 'failed',
			isFinal: false,
		} satisfies NodeInterviewFailedEventArgs)
		expect(node.interviewProgress).toBe(0)
		expect(harness.host.emitEvent).toHaveBeenCalledWith(
			'node',
			'node interview failed',
			expect.any(Object),
		)
		harness.registry.onInterviewCompleted(harness.zwaveNode)
		await Promise.resolve()
		expect(harness.host.emitEvent).toHaveBeenCalledWith(
			'node',
			'node interview completed',
			expect.any(Object),
		)
		harness.registry.onWakeUp(harness.zwaveNode, NodeStatus.Asleep)
		expect(node.lastAwake).toEqual(expect.any(Number))
		expect(harness.host.emitEvent).toHaveBeenCalledWith(
			'node',
			'node wakeup',
			expect.any(Object),
		)
	})

	it('publishes value lifecycle events with current node data', async () => {
		vi.useFakeTimers()
		const zwaveValue = createValue()
		const target = createValue({
			property: 'targetValue',
			propertyName: 'targetValue',
		})
		const zwaveNode = createZWaveNode(
			{
				getDefinedValueIDs: vi.fn(() => [zwaveValue, target]),
			},
			{
				value: 1,
				metadata: {
					type: 'number',
					readable: true,
					writeable: true,
					states: { 0: 'Off', 1: 'On' },
				},
			},
		)
		const harness = createHarness({ node: zwaveNode })
		const node = harness.registry.createNode(2)
		const added = harness.registry.addValue(zwaveNode, zwaveValue)
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
		} satisfies ZWaveNodeValueAddedArgs)
		harness.registry.onMetadataUpdated(zwaveNode, {
			...zwaveValue,
			metadata: {
				type: 'number',
				readable: true,
				writeable: false,
				min: 0,
				max: 99,
			},
		} satisfies ZWaveNodeMetadataUpdatedArgs)
		expect(harness.host.sendToSocket).toHaveBeenCalledWith(
			socketEvents.metadataUpdated,
			expect.objectContaining({ max: 99 }),
		)

		harness.registry.onValueUpdated(zwaveNode, {
			...zwaveValue,
			prevValue: 1,
			newValue: new Uint8Array([10]),
			stateless: false,
		} satisfies ZWaveNodeValueUpdatedArgs & { stateless: boolean })
		const currentValue = requireDefined(
			node.values,
			'expected projected node values',
		)[`${CommandClasses['Binary Switch']}-0-currentValue`]
		expect(currentValue.value).toBe('0x0a')
		harness.registry.onValueNotification(zwaveNode, {
			...zwaveValue,
			value: 5,
			stateless: true,
		} satisfies ZWaveNodeValueNotificationArgs & { stateless: boolean })
		expect(currentValue.stateless).toBe(true)
		await vi.advanceTimersByTimeAsync(1000)
		expect(currentValue.value).toBeUndefined()

		harness.registry.onValueRemoved(zwaveNode, {
			...zwaveValue,
			prevValue: 1,
		} satisfies ZWaveNodeValueRemovedArgs)
		expect(harness.host.sendToSocket).toHaveBeenCalledWith(
			socketEvents.valueRemoved,
			expect.objectContaining({ property: 'currentValue' }),
		)
		const naming = createValue({
			commandClass: CommandClasses['Node Naming and Location'],
		})
		expect(harness.registry.addValue(zwaveNode, naming)).toBeNull()
		expect(harness.host.onNameLocationChanged).toHaveBeenCalled()
	})

	it('publishes ready node values and statistics when routes fail', async () => {
		const value = createValue()
		const zwaveNode = createZWaveNode(
			{
				getDefinedValueIDs: vi.fn(() => [value]),
			},
			{
				scheduleEntryLockSupported: true,
			},
		)
		const harness = createHarness({ node: zwaveNode })
		const node = harness.registry.createNode(2)
		requireDefined(node.values, 'expected projected node values').old = {
			...harness.registry.parseValue(
				zwaveNode,
				createValue({ property: 'old', propertyName: 'old' }),
				{ type: 'number', readable: true, writeable: true },
			),
			value: 0,
		}
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
		expect(node.values).not.toHaveProperty('old')
		expect(node.values).toHaveProperty(
			`${CommandClasses['Binary Switch']}-0-currentValue`,
		)

		const stats = nodeStatistics({
			lastSeen: new Date(999),
			commandsTX: 1,
		})
		harness.registry.onStatisticsUpdated(zwaveNode, stats)
		expect(node.lastActive).toBe(999)
		expect(harness.host.emitNodeLastActive).toHaveBeenCalledWith(node)
		expect(harness.host.emitStatistics).toHaveBeenCalledWith(
			node,
			expect.objectContaining({ statistics: stats }),
		)
	})
})

describe('NodeRegistry notifications, firmware, statistics, and listeners', () => {
	it('publishes notifications and firmware updates', () => {
		const harness = createHarness()
		const node = harness.registry.createNode(2)
		const endpoint = harness.zwaveNode
		Object.assign(endpoint, {
			nodeId: 2,
			tryGetNode: () => harness.zwaveNode,
		})
		const notification: ZWaveNotificationCallbackParams_NotificationCC = [
			endpoint,
			CommandClasses.Notification,
			{
				type: 7,
				label: 'Motion',
				event: 8,
				eventLabel: 'detected',
				parameters: new Uint8Array([1, 2]),
			},
		]
		harness.registry.onNotification(...notification)
		expect(harness.host.emitNotification).toHaveBeenCalledWith(
			node,
			expect.objectContaining({
				property: 'Motion',
				propertyKey: 'detected',
				propertyName: 'Motion',
			}),
			'0102',
		)

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
		} satisfies FirmwareUpdateResult)
		expect(node.firmwareUpdate).toBeUndefined()
	})

	it('retains three hours of RSSI and publishes controller statistics', () => {
		const controller = createZWaveNode({ id: 1, isControllerNode: true })
		const harness = createHarness({ node: controller })
		const node = harness.registry.createNode(1)
		node.statistics = controllerStatistics({ messagesRX: 1 })
		for (let index = 0; index < 362; index++) {
			harness.registry.onControllerStatisticsUpdated(
				controllerStatistics({
					messagesRX: index + 2,
					backgroundRSSI: {
						timestamp: index * 60_000,
						channel0: { current: -80, average: -80 },
						channel1: { current: -81, average: -81 },
						channel2: { current: -82, average: -82 },
					},
				}),
			)
		}
		expect(node.lastActive).toEqual(expect.any(Number))
		const points = node.bgRSSIPoints
		if (!points?.length) throw new Error('Expected background RSSI samples')
		const newest = points.at(-1)
		const oldest = points.at(0)
		if (!newest || !oldest)
			throw new Error('Expected background RSSI samples')
		expect(
			points.every(
				(point) =>
					newest.timestamp - point.timestamp <= 3 * 60 * 60 * 1000,
			),
		).toBe(true)
		expect(oldest.timestamp).toBe(181 * 60_000)
		expect(harness.host.emitEvent).toHaveBeenLastCalledWith(
			'controller',
			'statistics updated',
			expect.any(Object),
		)
	})

	it('stops controller event publication after close', () => {
		const harness = createHarness({
			node: createZWaveNode({ id: 1, isControllerNode: true }),
		})
		const node = harness.registry.createNode(1)
		const controller = harness.driver.controller
		harness.registry.bindControllerEvents(controller)
		controller.emit(
			'statistics updated',
			controllerStatistics({ messagesRX: 2 }),
		)
		expect(node.statistics).toMatchObject({ messagesRX: 2 })

		harness.registry.close()
		controller.emit(
			'statistics updated',
			controllerStatistics({ messagesRX: 3 }),
		)
		expect(node.statistics).toMatchObject({ messagesRX: 2 })
	})

	it('removes listeners and pending stateless values on close', async () => {
		vi.useFakeTimers()
		try {
			const harness = createHarness()
			harness.registry.createNode(2)
			harness.registry.updateValue(harness.zwaveNode, {
				...createValue({ property: 'event', propertyName: 'event' }),
				newValue: 1,
				value: 1,
				stateless: true,
			})
			const emitCount = vi.mocked(harness.host.emitValueChanged).mock
				.calls.length

			harness.registry.close()
			await vi.advanceTimersByTimeAsync(1000)

			expect(harness.host.emitValueChanged).toHaveBeenCalledTimes(
				emitCount,
			)
		} finally {
			vi.useRealTimers()
		}
	})
})
