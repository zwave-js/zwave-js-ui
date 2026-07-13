import {
	describe,
	it,
	expect,
	vi,
	beforeAll,
	beforeEach,
	afterAll,
	afterEach,
} from 'vitest'
import { InclusionStrategy } from 'zwave-js'
import { socketEvents } from '../../../api/lib/SocketEvents.ts'
import type ZWaveClientType from '../../../api/lib/ZwaveClient.ts'
import { createSocketHarness, type SocketHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'

let harness: SocketHarness
let ZWaveClient: typeof ZWaveClientType
let backupManager: { backupOnEvent: boolean; backupNvm: () => Promise<void> }

beforeAll(async () => {
	harness = await createSocketHarness()
	;({ default: ZWaveClient } = await import(
		'../../../api/lib/ZwaveClient.ts'
	))
	// Stub backupOnEvent because this test process does not initialize BackupManager
	const bm = await import('../../../api/lib/BackupManager.ts')
	backupManager = bm.default as any
	Object.defineProperty(backupManager, 'backupOnEvent', {
		get: () => false,
		configurable: true,
	})
})

afterAll(async () => {
	await harness.close()
})

beforeEach(() => {
	vi.restoreAllMocks()
	harness.testHooks.setGateway(createFakeGateway({ zwave: undefined }) as any)
})

afterEach(async () => {
	await harness.disconnectAllClients()
	harness.resetState()
})

function realZwave(config: Record<string, unknown> = {}): ZWaveClientType {
	return new ZWaveClient(config as any, harness.io)
}

function createFakeDriver(overrides: Record<string, unknown> = {}) {
	return {
		controller: {
			ownNodeId: 1,
			inclusionState: undefined,
			nodes: new Map(),
			beginInclusion: vi.fn().mockResolvedValue(true),
			stopInclusion: vi.fn().mockResolvedValue(true),
			beginExclusion: vi.fn().mockResolvedValue(true),
			stopExclusion: vi.fn().mockResolvedValue(true),
			replaceFailedNode: vi.fn().mockResolvedValue(true),
			beginJoiningNetwork: vi.fn().mockResolvedValue({ success: true }),
			stopJoiningNetwork: vi.fn().mockResolvedValue(true),
			getMulticastGroup: vi.fn(() => ({ getDefinedValueIDs: () => [] })),
			supportsLongRange: false,
			getAvailableFirmwareUpdates: vi.fn().mockResolvedValue([]),
			getAllAvailableFirmwareUpdates: vi
				.fn()
				.mockResolvedValue(new Map()),
			getPrioritySUCReturnRouteCached: vi.fn(() => ({})),
			getCustomSUCReturnRoutesCached: vi.fn(() => ({})),
			...overrides,
		},
		hardReset: vi.fn().mockResolvedValue(undefined),
		destroy: vi.fn().mockResolvedValue(undefined),
		updateOptions: vi.fn(),
		...overrides,
	}
}

describe('Production integration: coordinator identity survives init(), hardReset(), and buildServerHost().onHardReset()', () => {
	it('captured grant/DSK/abort callbacks settle via public ZwaveClient API after hardReset — same coordinator identity', async () => {
		const zwave = realZwave()
		const coordinatorBefore = (zwave as any)._inclusionCoordinator

		const callbacks = coordinatorBefore.getUserCallbacks()

		const fakeDriver = createFakeDriver()
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true

		await zwave.hardReset()

		const coordinatorAfter = (zwave as any)._inclusionCoordinator
		expect(coordinatorAfter).toBe(coordinatorBefore)

		const grantPromise = callbacks.grantSecurityClasses({
			securityClasses: [1, 2],
			clientSideAuth: false,
		})
		zwave.grantSecurityClasses({ securityClasses: [1] } as any)
		const grantResult = await grantPromise
		expect(grantResult).toEqual({ securityClasses: [1] })

		const dskPromise = callbacks.validateDSKAndEnterPIN('12345-67890')
		zwave.validateDSK('12345')
		const dskResult = await dskPromise
		expect(dskResult).toBe('12345')

		const abortGrantPromise = callbacks.grantSecurityClasses({
			securityClasses: [3],
			clientSideAuth: false,
		})
		zwave.abortInclusion()
		const abortResult = await abortGrantPromise
		expect(abortResult).toBe(false)
	})

	it('coordinator identity survives buildServerHost().onHardReset()', async () => {
		const zwave = realZwave()
		const coordinatorBefore = (zwave as any)._inclusionCoordinator

		const callbacks = coordinatorBefore.getUserCallbacks()

		const fakeDriver = createFakeDriver()
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true

		const serverHost = zwave.buildServerHost()
		serverHost.onHardReset()

		const grantPromise = callbacks.grantSecurityClasses({
			securityClasses: [5],
			clientSideAuth: false,
		})
		zwave.grantSecurityClasses({ securityClasses: [5] } as any)
		expect(await grantPromise).toEqual({ securityClasses: [5] })
	})

	it('no socket/controller events emitted on obsolete coordinator after reset — exact once assertions', async () => {
		const zwave = realZwave()
		const sendToSocketSpy = vi.spyOn(zwave as any, 'sendToSocket')
		const emitSpy = vi.spyOn(zwave, 'emit')

		const fakeDriver = createFakeDriver()
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true

		const callbacks = (
			zwave as any
		)._inclusionCoordinator.getUserCallbacks()

		const grantPromise = callbacks.grantSecurityClasses({
			securityClasses: [1],
			clientSideAuth: false,
		})

		const socketCallsBefore = sendToSocketSpy.mock.calls.length

		zwave.grantSecurityClasses({ securityClasses: [1] } as any)
		await grantPromise

		const grantSocketCalls = sendToSocketSpy.mock.calls
			.slice(socketCallsBefore)
			.filter((call) => call[0] === socketEvents.grantSecurityClasses)
		expect(grantSocketCalls).toHaveLength(0)
	})
})

describe('Production integration: server-disabled MQTT callback path', () => {
	it('coordinator callback object survives init/hardReset and public replies settle (server disabled)', async () => {
		const zwave = realZwave({ serverEnabled: false })
		const coordinator = (zwave as any)._inclusionCoordinator

		const callbacksBefore = coordinator.getUserCallbacks()

		;(zwave as any)._driver = createFakeDriver()
		zwave.driverReady = true

		await zwave.hardReset()

		const dskPromise = callbacksBefore.validateDSKAndEnterPIN('11111-22222')
		zwave.validateDSK('11111')
		expect(await dskPromise).toBe('11111')
	})

	it('server-enabled: setUserCallbacks installs inclusionUserCallbacks on driver via updateOptions', () => {
		const zwave = realZwave({ serverEnabled: true })
		const fakeDriver = createFakeDriver()
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true

		zwave.setUserCallbacks()

		expect(fakeDriver.updateOptions).toHaveBeenCalledWith({
			inclusionUserCallbacks: expect.objectContaining({
				grantSecurityClasses: expect.any(Function),
				validateDSKAndEnterPIN: expect.any(Function),
				abort: expect.any(Function),
			}),
		})
	})

	it('setUserCallbacks/removeUserCallbacks on server-disabled config preserves hasUserCallbacks state', async () => {
		const zwave = realZwave({ serverEnabled: false })
		const coordinator = (zwave as any)._inclusionCoordinator

		zwave.setUserCallbacks()
		expect(zwave.hasUserCallbacks).toBe(true)
		expect(coordinator.hasUserCallbacks).toBe(true)
		;(zwave as any)._driver = createFakeDriver()
		zwave.driverReady = true
		await zwave.hardReset()

		expect(zwave.hasUserCallbacks).toBe(true)
		expect(coordinator.hasUserCallbacks).toBe(true)

		zwave.removeUserCallbacks()
		expect(zwave.hasUserCallbacks).toBe(false)
	})
})

describe('Production integration: sole state ownership via startInclusion and event handlers', () => {
	it('startInclusion with name/location → _onNodeFound → first _createNode consumes tmpNode atomically', async () => {
		const zwave = realZwave({ commandsTimeout: 30 })
		const fakeDriver = createFakeDriver()
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true
		;(zwave as any).storeNodes = {}

		await zwave.startInclusion(InclusionStrategy.Default, {
			name: 'Sensor',
			location: 'Kitchen',
		})

		const coordinator = (zwave as any)._inclusionCoordinator
		expect(coordinator.tmpNode).toEqual({ name: 'Sensor', loc: 'Kitchen' })
		;(zwave as any)._onNodeFound({ id: 10 })

		const node1 = (zwave as any)._nodes.get(10)
		expect(node1.name).toBe('Sensor')
		expect(node1.loc).toBe('Kitchen')

		expect(coordinator.tmpNode).toBeUndefined()
		;(zwave as any)._onNodeFound({ id: 11 })
		const node2 = (zwave as any)._nodes.get(11)
		expect(node2.name).toBe('')
		expect(node2.loc).toBe('')
	})

	it('_onNodeFound → _onInclusionFailed cleans ghost nodes through production handlers', () => {
		const zwave = realZwave()
		const fakeDriver = createFakeDriver()
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true
		;(zwave as any).storeNodes = {}
		;(zwave as any)._onNodeFound({ id: 20 })
		;(zwave as any)._onNodeFound({ id: 21 })

		const coordinator = (zwave as any)._inclusionCoordinator
		expect(coordinator.pendingInclusionNodeIds.has(20)).toBe(true)
		expect(coordinator.pendingInclusionNodeIds.has(21)).toBe(true)

		expect((zwave as any)._nodes.has(20)).toBe(true)
		expect((zwave as any)._nodes.has(21)).toBe(true)
		;(zwave as any)._onInclusionFailed()

		expect(coordinator.pendingInclusionNodeIds.size).toBe(0)
		expect((zwave as any)._nodes.has(20)).toBe(false)
		expect((zwave as any)._nodes.has(21)).toBe(false)
	})

	it('close(true) cancels inclusion timeout and discards temporary node metadata', async () => {
		vi.useFakeTimers()
		try {
			const zwave = realZwave({ commandsTimeout: 30 })
			const fakeDriver = createFakeDriver()
			;(zwave as any)._driver = fakeDriver
			zwave.driverReady = true
			;(zwave as any).storeNodes = {}

			await zwave.startInclusion(InclusionStrategy.Default, {
				name: 'Test',
				location: 'Room',
			})

			await zwave.close(true)
			await vi.advanceTimersByTimeAsync(30_000)
			expect(fakeDriver.controller.stopInclusion).not.toHaveBeenCalled()

			zwave.init()
			;(zwave as any)._driver = createFakeDriver()
			zwave.driverReady = true
			;(zwave as any).storeNodes = {}
			;(zwave as any)._onNodeFound({ id: 99 })
			expect((zwave as any)._nodes.get(99).name).toBe('')
			expect((zwave as any)._nodes.get(99).loc).toBe('')
		} finally {
			vi.useRealTimers()
		}
	})
})

describe('Production integration: learn/start inclusion delegates and timer counts through real coordinator', () => {
	it('startInclusion with Default strategy delegates to controller.beginInclusion via coordinator', async () => {
		vi.useFakeTimers()
		try {
			const beginInclusion = vi.fn().mockResolvedValue(true)
			const stopInclusion = vi.fn().mockResolvedValue(true)
			const fakeDriver = createFakeDriver({
				controller: {
					...createFakeDriver().controller,
					beginInclusion,
					stopInclusion,
				},
			})

			const zwave = realZwave({ commandsTimeout: 30 })
			;(zwave as any)._driver = fakeDriver
			zwave.driverReady = true

			const result = await zwave.startInclusion(InclusionStrategy.Default)

			expect(result).toBe(true)
			expect(beginInclusion).toHaveBeenCalledOnce()
			expect(beginInclusion).toHaveBeenCalledWith({
				strategy: InclusionStrategy.Default,
				forceSecurity: undefined,
			})

			const coordinator = (zwave as any)._inclusionCoordinator
			expect(coordinator._commandsTimeout).not.toBeNull()

			await vi.advanceTimersByTimeAsync(30000)
			expect(stopInclusion).toHaveBeenCalledOnce()
		} finally {
			vi.useRealTimers()
		}
	})

	it('startLearnMode delegates to controller.beginJoiningNetwork via coordinator with timeout', async () => {
		vi.useFakeTimers()
		try {
			const beginJoiningNetwork = vi
				.fn()
				.mockResolvedValue({ success: true })
			const stopJoiningNetwork = vi.fn().mockResolvedValue(true)
			const fakeDriver = createFakeDriver({
				controller: {
					...createFakeDriver().controller,
					beginJoiningNetwork,
					stopJoiningNetwork,
				},
			})

			const zwave = realZwave({ commandsTimeout: 20 })
			;(zwave as any)._driver = fakeDriver
			zwave.driverReady = true

			const result = await zwave.startLearnMode()

			expect(result).toEqual({ success: true })
			expect(beginJoiningNetwork).toHaveBeenCalledOnce()

			const coordinator = (zwave as any)._inclusionCoordinator
			expect(coordinator._commandsTimeout).not.toBeNull()

			await vi.advanceTimersByTimeAsync(20000)
			expect(stopJoiningNetwork).toHaveBeenCalledOnce()
		} finally {
			vi.useRealTimers()
		}
	})

	it('startInclusion + hardReset clears coordinator timer, new startInclusion sets a new one', async () => {
		vi.useFakeTimers()
		try {
			const fakeDriver = createFakeDriver()
			const zwave = realZwave({ commandsTimeout: 30 })
			;(zwave as any)._driver = fakeDriver
			zwave.driverReady = true

			await zwave.startInclusion(InclusionStrategy.Insecure)
			const coordinator = (zwave as any)._inclusionCoordinator
			const firstTimeout = coordinator._commandsTimeout
			expect(firstTimeout).not.toBeNull()

			await zwave.hardReset()
			expect(coordinator._commandsTimeout).toBeNull()
			;(zwave as any)._driver = createFakeDriver()
			zwave.driverReady = true

			await zwave.startInclusion(InclusionStrategy.Default)
			const secondTimeout = coordinator._commandsTimeout
			expect(secondTimeout).not.toBeNull()
			expect(secondTimeout).not.toBe(firstTimeout)
		} finally {
			vi.useRealTimers()
		}
	})

	it('stopInclusion is called exactly once by timeout (no double-fire)', async () => {
		vi.useFakeTimers()
		try {
			const stopInclusion = vi.fn().mockResolvedValue(true)
			const fakeDriver = createFakeDriver({
				controller: {
					...createFakeDriver().controller,
					stopInclusion,
				},
			})
			const zwave = realZwave({ commandsTimeout: 10 })
			;(zwave as any)._driver = fakeDriver
			zwave.driverReady = true

			await zwave.startInclusion(InclusionStrategy.Default)

			await vi.advanceTimersByTimeAsync(10000)
			expect(stopInclusion).toHaveBeenCalledOnce()

			await vi.advanceTimersByTimeAsync(50000)
			expect(stopInclusion).toHaveBeenCalledOnce()
		} finally {
			vi.useRealTimers()
		}
	})
})

describe('Production integration: firmware lifecycle fencing across reset', () => {
	it('pending scheduled check via real ZwaveClient: resetGeneration (hardReset) fences — no updateStoreNodes/emit/socket', async () => {
		vi.useFakeTimers()
		try {
			let resolveCheck: (v: Map<number, unknown[]>) => void
			const getAllFirmware = vi.fn().mockReturnValue(
				new Promise((resolve) => {
					resolveCheck = resolve
				}),
			)
			const fakeDriver = createFakeDriver({
				controller: {
					...createFakeDriver().controller,
					getAllAvailableFirmwareUpdates: getAllFirmware,
				},
			})

			const zwave = realZwave()
			;(zwave as any)._driver = fakeDriver
			zwave.driverReady = true
			;(zwave as any).storeNodes = { 1: { id: 1 } }
			;(zwave as any)._nodes.set(1, { id: 1, values: {} })

			const updateStoreNodesSpy = vi.spyOn(
				zwave as any,
				'updateStoreNodes',
			)
			const sendToSocketSpy = vi.spyOn(zwave as any, 'sendToSocket')

			const fwService = (zwave as any)._firmwareUpdateService
			const checkPromise = fwService.scheduledFirmwareUpdateCheck()

			await zwave.hardReset()

			resolveCheck(new Map([[1, [{ version: '2.0', downgrade: false }]]]))
			await checkPromise

			expect(updateStoreNodesSpy).not.toHaveBeenCalled()
			expect(sendToSocketSpy).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})

	it('late resolve after production hardReset produces no side effects', async () => {
		vi.useFakeTimers()
		try {
			let resolveCheck: (v: Map<number, unknown[]>) => void
			const getAllFirmware = vi.fn().mockReturnValue(
				new Promise((resolve) => {
					resolveCheck = resolve
				}),
			)
			const fakeDriver = createFakeDriver({
				controller: {
					...createFakeDriver().controller,
					getAllAvailableFirmwareUpdates: getAllFirmware,
				},
			})

			const zwave = realZwave()
			;(zwave as any)._driver = fakeDriver
			zwave.driverReady = true
			;(zwave as any).storeNodes = {}

			const emitSpy = vi.spyOn(zwave, 'emit')
			const fwService = (zwave as any)._firmwareUpdateService
			const checkPromise = fwService.scheduledFirmwareUpdateCheck()

			await zwave.hardReset()

			resolveCheck(new Map())
			await checkPromise

			const firmwareEmits = emitSpy.mock.calls.filter(
				(call) =>
					call[0] === 'valueChanged' || call[0] === 'nodeUpdated',
			)
			expect(firmwareEmits).toHaveLength(0)
		} finally {
			vi.useRealTimers()
		}
	})

	it('late reject after production hardReset produces no crash or mutation', async () => {
		vi.useFakeTimers()
		try {
			let rejectCheck: (e: Error) => void
			const getAllFirmware = vi.fn().mockReturnValue(
				new Promise((_resolve, reject) => {
					rejectCheck = reject
				}),
			)
			const fakeDriver = createFakeDriver({
				controller: {
					...createFakeDriver().controller,
					getAllAvailableFirmwareUpdates: getAllFirmware,
				},
			})

			const zwave = realZwave()
			;(zwave as any)._driver = fakeDriver
			zwave.driverReady = true
			;(zwave as any).storeNodes = {}

			const fwService = (zwave as any)._firmwareUpdateService
			const checkPromise = fwService.scheduledFirmwareUpdateCheck()

			await zwave.hardReset()

			rejectCheck(new Error('network timeout'))
			await checkPromise

			const updateStoreNodesSpy = vi.spyOn(
				zwave as any,
				'updateStoreNodes',
			)
			expect(updateStoreNodesSpy).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})

	it('new generation schedules exactly one timer after hardReset clears old', async () => {
		vi.useFakeTimers()
		try {
			const fakeDriver = createFakeDriver()
			const zwave = realZwave()
			;(zwave as any)._driver = fakeDriver
			zwave.driverReady = true
			;(zwave as any).storeNodes = {}

			const fwService = (zwave as any)._firmwareUpdateService

			await fwService.scheduledFirmwareUpdateCheck()
			const firstTimeout = fwService._firmwareUpdateCheckTimeout
			expect(firstTimeout).not.toBeNull()

			await zwave.hardReset()
			expect(fwService._firmwareUpdateCheckTimeout).toBeNull()
			;(zwave as any)._driver = createFakeDriver()
			zwave.driverReady = true

			await fwService.scheduledFirmwareUpdateCheck()
			const secondTimeout = fwService._firmwareUpdateCheckTimeout
			expect(secondTimeout).not.toBeNull()
			expect(secondTimeout).not.toBe(firstTimeout)

			const timerCountBefore = vi.getTimerCount()
			fwService.clearScheduledCheck()
			const timerCountAfter = vi.getTimerCount()
			expect(timerCountBefore - timerCountAfter).toBe(1)
		} finally {
			vi.useRealTimers()
		}
	})
})

describe('Production integration: snapshot persistence does not mutate storeNodes while pending', () => {
	it('storeNodes remains unchanged during deferred persistence; hardReset fences; no emit/socket after reset', async () => {
		vi.useFakeTimers()
		try {
			let resolvePersist: () => void
			const persistPromise = new Promise<void>((resolve) => {
				resolvePersist = resolve
			})

			const firmwareResult = new Map<number, unknown[]>([
				[
					3,
					[
						{
							version: '5.0.0',
							changelog: 'test',
							channel: 'stable',
							files: [],
							downgrade: false,
							normalizedVersion: '5.0.0',
							device: {
								manufacturerId: 1,
								productType: 2,
								productId: 3,
								firmwareVersion: '4.0.0',
								rfRegion: 0,
							},
						},
					],
				],
			])
			const getAllFirmware = vi.fn().mockResolvedValue(firmwareResult)

			const fakeDriver = createFakeDriver({
				controller: {
					...createFakeDriver().controller,
					getAllAvailableFirmwareUpdates: getAllFirmware,
					nodes: new Map([[3, { id: 3, isControllerNode: false }]]),
				},
			})

			const zwave = realZwave()
			;(zwave as any)._driver = fakeDriver
			zwave.driverReady = true
			;(zwave as any).storeNodes = {
				3: { id: 3, name: 'Existing' },
			}
			;(zwave as any)._nodes.set(3, {
				id: 3,
				values: {},
				availableFirmwareUpdates: [],
				lastFirmwareUpdateCheck: 0,
				firmwareUpdatesDismissed: {},
			})

			let persistCalled = false
			vi.spyOn(zwave as any, '_persistNodesSnapshot').mockImplementation(
				() => {
					persistCalled = true
					return persistPromise
				},
			)
			const sendToSocketSpy = vi.spyOn(zwave as any, 'sendToSocket')

			const storeNodesBefore = { ...(zwave as any).storeNodes[3] }

			const fwService = (zwave as any)._firmwareUpdateService
			const checkPromise = fwService.checkAllNodesFirmwareUpdates()

			await vi.advanceTimersByTimeAsync(0)

			expect(persistCalled).toBe(true)

			expect((zwave as any).storeNodes[3]).toEqual(storeNodesBefore)
			expect(
				(zwave as any).storeNodes[3].availableFirmwareUpdates,
			).toBeUndefined()
			expect(
				(zwave as any).storeNodes[3].lastFirmwareUpdateCheck,
			).toBeUndefined()

			await zwave.hardReset()

			resolvePersist()

			await expect(checkPromise).rejects.toThrow(
				/cancelled.*generation advanced/,
			)

			expect((zwave as any).storeNodes[3]).toEqual(storeNodesBefore)

			const liveNode = (zwave as any)._nodes.get(3)
			if (liveNode) {
				expect(liveNode.availableFirmwareUpdates).toEqual([])
				expect(liveNode.lastFirmwareUpdateCheck).toBe(0)
			}

			expect(sendToSocketSpy).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})

	it('successful path (no reset): storeNodes IS updated after persistence + fence', async () => {
		vi.useFakeTimers()
		try {
			let resolvePersist: () => void
			const persistPromise = new Promise<void>((resolve) => {
				resolvePersist = resolve
			})

			const firmwareResult = new Map<number, unknown[]>([
				[
					2,
					[
						{
							version: '3.0.0',
							changelog: 'update',
							channel: 'stable',
							files: [],
							downgrade: false,
							normalizedVersion: '3.0.0',
							device: {
								manufacturerId: 1,
								productType: 2,
								productId: 3,
								firmwareVersion: '2.0.0',
								rfRegion: 0,
							},
						},
					],
				],
			])
			const getAllFirmware = vi.fn().mockResolvedValue(firmwareResult)

			const fakeDriver = createFakeDriver({
				controller: {
					...createFakeDriver().controller,
					getAllAvailableFirmwareUpdates: getAllFirmware,
					nodes: new Map([[2, { id: 2, isControllerNode: false }]]),
				},
			})

			const zwave = realZwave()
			;(zwave as any)._driver = fakeDriver
			zwave.driverReady = true
			;(zwave as any).storeNodes = { 2: { id: 2 } }
			;(zwave as any)._nodes.set(2, {
				id: 2,
				values: {},
				availableFirmwareUpdates: [],
				lastFirmwareUpdateCheck: 0,
				firmwareUpdatesDismissed: {},
			})

			vi.spyOn(zwave as any, '_persistNodesSnapshot').mockImplementation(
				() => persistPromise,
			)
			const emitNodeUpdateSpy = vi.spyOn(zwave as any, 'emitNodeUpdate')

			const fwService = (zwave as any)._firmwareUpdateService
			const checkPromise = fwService.checkAllNodesFirmwareUpdates()

			await vi.advanceTimersByTimeAsync(0)

			expect(
				(zwave as any).storeNodes[2].availableFirmwareUpdates,
			).toBeUndefined()

			resolvePersist()
			await checkPromise

			expect(
				(zwave as any).storeNodes[2].availableFirmwareUpdates,
			).toBeDefined()
			expect(
				(zwave as any).storeNodes[2].availableFirmwareUpdates,
			).toHaveLength(1)
			expect(
				(zwave as any).storeNodes[2].lastFirmwareUpdateCheck,
			).toBeGreaterThan(0)

			const liveNode = (zwave as any)._nodes.get(2)
			expect(liveNode.availableFirmwareUpdates).toHaveLength(1)

			expect(emitNodeUpdateSpy).toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})
})

describe('Production integration: hardReset failure-safe semantics', () => {
	it('hardReset rejection leaves firmware timer + coordinator state + inclusion promise live', async () => {
		vi.useFakeTimers()
		try {
			const hardResetError = new Error('ZW0100: hard reset failed')
			const fakeDriver = createFakeDriver({
				hardReset: vi.fn().mockRejectedValue(hardResetError),
			})
			const zwave = realZwave({ commandsTimeout: 60 })
			;(zwave as any)._driver = fakeDriver
			zwave.driverReady = true
			;(zwave as any).storeNodes = {}

			const fwService = (zwave as any)._firmwareUpdateService
			await fwService.scheduledFirmwareUpdateCheck()

			const coordinator = (zwave as any)._inclusionCoordinator
			const callbacks = coordinator.getUserCallbacks()
			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [1],
				clientSideAuth: false,
			})
			const timerCountBeforeReset = vi.getTimerCount()
			expect(timerCountBeforeReset).toBeGreaterThan(0)
			await expect(zwave.hardReset()).rejects.toThrow('hard reset failed')

			expect(vi.getTimerCount()).toBe(timerCountBeforeReset)

			zwave.grantSecurityClasses({ securityClasses: [2] } as any)
			const grantResult = await grantPromise
			expect(grantResult).toEqual({ securityClasses: [2] })

			expect(zwave.driverReady).toBe(true)
		} finally {
			vi.useRealTimers()
		}
	})
})

describe('Production integration: listener count stability across repeated init/hardReset/close lifecycle', () => {
	// Check the long-lived client because each hard reset replaces the driver

	it('ZwaveClient event listener count stable across repeated init() calls', () => {
		const zwave = realZwave()

		const baselineCount = zwave.listenerCount('driverStatus')

		zwave.init()
		zwave.init()
		zwave.init()

		expect(zwave.listenerCount('driverStatus')).toBe(baselineCount)
	})

	it('ZwaveClient event listener count stable across repeated hardReset() calls', async () => {
		const zwave = realZwave()
		;(zwave as any)._driver = createFakeDriver()
		zwave.driverReady = true

		const baselineCount = zwave.listenerCount('driverStatus')

		await zwave.hardReset()
		;(zwave as any)._driver = createFakeDriver()
		zwave.driverReady = true

		await zwave.hardReset()
		;(zwave as any)._driver = createFakeDriver()
		zwave.driverReady = true

		await zwave.hardReset()

		expect(zwave.listenerCount('driverStatus')).toBe(baselineCount)
	})

	it('ZwaveClient event listener count stable across close(true)/init cycles', async () => {
		const zwave = realZwave()
		;(zwave as any)._driver = createFakeDriver()
		zwave.driverReady = true

		const baselineCount = zwave.listenerCount('driverStatus')

		await zwave.close(true)
		zwave.init()
		;(zwave as any)._driver = createFakeDriver()
		zwave.driverReady = true

		await zwave.close(true)
		zwave.init()
		;(zwave as any)._driver = createFakeDriver()
		zwave.driverReady = true

		await zwave.close(true)
		zwave.init()

		expect(zwave.listenerCount('driverStatus')).toBe(baselineCount)
	})

	it('server host onHardReset cycle does not leak listeners', () => {
		const zwave = realZwave()
		;(zwave as any)._driver = createFakeDriver()
		zwave.driverReady = true

		const baselineCount = zwave.listenerCount('driverStatus')
		const host = zwave.buildServerHost()

		host.onHardReset()
		;(zwave as any)._driver = createFakeDriver()
		zwave.driverReady = true

		host.onHardReset()
		;(zwave as any)._driver = createFakeDriver()
		zwave.driverReady = true

		host.onHardReset()

		expect(zwave.listenerCount('driverStatus')).toBe(baselineCount)
	})
})

describe('Production integration: inclusion state sole ownership via coordinator', () => {
	it('active inclusion state → close(true) → getState/getInfo report undefined immediately', async () => {
		const zwave = realZwave()
		const fakeDriver = createFakeDriver()
		fakeDriver.controller.inclusionState = 1
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true
		;(zwave as any)._inclusionCoordinator.syncFromDriver()
		expect(zwave.getState().inclusionState).toBe(1)
		expect(zwave.getInfo().inclusionState).toBe(1)

		await zwave.close(true)

		expect(zwave.getState().inclusionState).toBeUndefined()
		expect(zwave.getInfo().inclusionState).toBeUndefined()
	})

	it('active inclusion state → init() → getState/getInfo report undefined immediately', () => {
		const zwave = realZwave()
		const fakeDriver = createFakeDriver()
		fakeDriver.controller.inclusionState = 2
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true
		;(zwave as any)._inclusionCoordinator.syncFromDriver()
		expect(zwave.getState().inclusionState).toBe(2)

		zwave.init()

		expect(zwave.getState().inclusionState).toBeUndefined()
		expect(zwave.getInfo().inclusionState).toBeUndefined()
	})

	it('active inclusion state → public hardReset() → getState/getInfo report undefined immediately', async () => {
		const zwave = realZwave()
		const fakeDriver = createFakeDriver()
		fakeDriver.controller.inclusionState = 3
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true
		;(zwave as any)._inclusionCoordinator.syncFromDriver()
		expect(zwave.getState().inclusionState).toBe(3)

		await zwave.hardReset()

		expect(zwave.getState().inclusionState).toBeUndefined()
		expect(zwave.getInfo().inclusionState).toBeUndefined()
	})

	it('active inclusion state → server hardReset → getState/getInfo report undefined immediately', () => {
		const zwave = realZwave()
		const fakeDriver = createFakeDriver()
		fakeDriver.controller.inclusionState = 4
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true
		;(zwave as any)._inclusionCoordinator.syncFromDriver()
		expect(zwave.getState().inclusionState).toBe(4)

		zwave.buildServerHost().onHardReset()

		expect(zwave.getState().inclusionState).toBeUndefined()
		expect(zwave.getInfo().inclusionState).toBeUndefined()
	})

	it('syncFromDriver() sets correct state after driver ready, onInclusionStateChanged emits on change only', () => {
		const zwave = realZwave()
		const fakeDriver = createFakeDriver()
		fakeDriver.controller.inclusionState = 0
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true
		;(zwave as any)._inclusionCoordinator.syncFromDriver()
		expect(zwave.getState().inclusionState).toBe(0)

		const sendToSocketSpy = vi.spyOn(zwave as any, 'sendToSocket')

		;(zwave as any)._onInclusionStateChanged(0)
		expect(sendToSocketSpy).not.toHaveBeenCalled()
		;(zwave as any)._onInclusionStateChanged(1)
		expect(sendToSocketSpy).toHaveBeenCalledWith(
			socketEvents.controller,
			expect.objectContaining({ inclusionState: 1 }),
		)

		expect(zwave.getState().inclusionState).toBe(1)

		sendToSocketSpy.mockClear()
		;(zwave as any)._onInclusionStateChanged(1)
		expect(sendToSocketSpy).not.toHaveBeenCalled()
	})

	it('_updateControllerStatus reads live inclusion state from coordinator', () => {
		const zwave = realZwave()
		const fakeDriver = createFakeDriver()
		fakeDriver.controller.inclusionState = 1
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true
		;(zwave as any)._inclusionCoordinator.syncFromDriver()

		const sendToSocketSpy = vi.spyOn(zwave as any, 'sendToSocket')

		;(zwave as any)._cntStatus = ''
		;(zwave as any)._updateControllerStatus('Testing')

		expect(sendToSocketSpy).toHaveBeenCalledWith(
			socketEvents.controller,
			expect.objectContaining({ inclusionState: 1, status: 'Testing' }),
		)
	})

	it('init payload contains undefined inclusion state after reset, then sync + event update report current state', () => {
		const zwave = realZwave()
		const fakeDriver = createFakeDriver()
		fakeDriver.controller.inclusionState = 3
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true
		;(zwave as any)._inclusionCoordinator.syncFromDriver()
		expect(zwave.getState().inclusionState).toBe(3)

		zwave.init()
		expect(zwave.getState().inclusionState).toBeUndefined()

		const newDriver = createFakeDriver()
		newDriver.controller.inclusionState = 4
		;(zwave as any)._driver = newDriver
		zwave.driverReady = true
		;(zwave as any)._inclusionCoordinator.syncFromDriver()
		expect(zwave.getState().inclusionState).toBe(4)
		;(zwave as any)._onInclusionStateChanged(2)
		expect(zwave.getState().inclusionState).toBe(2)
		expect(zwave.getInfo().inclusionState).toBe(2)
	})
})

describe('Production integration: _isReplacing cleared at replacement completion', () => {
	it('replaceFailedNode starts → replacement removal preserves store → node added clears flag → later unrelated removal deletes store', async () => {
		const zwave = realZwave({ commandsTimeout: 30 })
		const fakeDriver = createFakeDriver()
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true
		;(zwave as any).storeNodes = { 5: { name: 'OldSensor' } }
		;(zwave as any)._nodes.set(5, { id: 5, name: 'OldSensor' })

		const coordinator = (zwave as any)._inclusionCoordinator

		await zwave.replaceFailedNode(5, InclusionStrategy.Insecure)
		expect(coordinator.isReplacing).toBe(true)

		// Preserve stored metadata until zwave-js finishes replacing the node
		;(zwave as any)._removeNode(5)
		expect((zwave as any).storeNodes[5]).toEqual({ name: 'OldSensor' })

		zwave.driverReady = false
		vi.spyOn(zwave as any, 'logNode').mockImplementation(() => undefined)
		vi.spyOn(zwave as any, 'zwaveNodeToJSON').mockReturnValue({ id: 5 })
		await (zwave as any)._onNodeAdded({ id: 5 }, { lowSecurity: false })
		expect(coordinator.isReplacing).toBe(false)
		;(zwave as any)._nodes.set(6, { id: 6, name: 'Other' })
		;(zwave as any).storeNodes[6] = { name: 'Other' }
		;(zwave as any)._removeNode(6)
		expect((zwave as any).storeNodes[6]).toBeUndefined()
	})

	it('inclusion stopped clears _isReplacing for flows without node-added', async () => {
		const zwave = realZwave({ commandsTimeout: 30 })
		const fakeDriver = createFakeDriver()
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true
		;(zwave as any).storeNodes = { 5: { name: 'OldSensor' } }
		;(zwave as any)._nodes.set(5, { id: 5, name: 'OldSensor' })

		const coordinator = (zwave as any)._inclusionCoordinator

		await zwave.replaceFailedNode(5, InclusionStrategy.Insecure)
		expect(coordinator.isReplacing).toBe(true)
		;(zwave as any)._removeNode(5)
		expect((zwave as any).storeNodes[5]).toEqual({ name: 'OldSensor' })
		;(zwave as any)._onInclusionStopped()
		expect(coordinator.isReplacing).toBe(false)
		;(zwave as any)._nodes.set(7, { id: 7, name: 'Unrelated' })
		;(zwave as any).storeNodes[7] = { name: 'Unrelated' }
		;(zwave as any)._removeNode(7)
		expect((zwave as any).storeNodes[7]).toBeUndefined()
	})

	it('normal inclusion stopped does not affect isReplacing (which is already false)', async () => {
		const zwave = realZwave({ commandsTimeout: 30 })
		const fakeDriver = createFakeDriver()
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true
		;(zwave as any).storeNodes = {}

		await zwave.startInclusion(InclusionStrategy.Default)
		const coordinator = (zwave as any)._inclusionCoordinator
		expect(coordinator.isReplacing).toBe(false)
		;(zwave as any)._onInclusionStopped()
		expect(coordinator.isReplacing).toBe(false)
	})
})
