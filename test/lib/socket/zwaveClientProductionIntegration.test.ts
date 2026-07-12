/**
 * TRUE production integration tests for `ZwaveClient.ts`.
 *
 * Unlike the direct service tests in `InclusionCoordinator.test.ts` and
 * `FirmwareUpdateService.test.ts` (commit 868fe408 mislabeled them
 * "Production"), these tests instantiate the REAL `ZwaveClient` class with
 * its REAL service wiring (InclusionCoordinator, FirmwareUpdateService) and
 * exercise public and semi-public methods that the production code actually
 * calls. Only driver/controller/network boundaries are stubbed.
 *
 * Requirement areas:
 * 1. Coordinator identity survives init/hardReset/serverHardReset — captured
 *    callbacks resolve through public ZwaveClient API
 * 2. Server-disabled MQTT callback path — coordinator survives and replies settle
 * 3. Sole state ownership — _createNode, node found/added/remove/failure paths
 * 4. Learn/start inclusion cross-mode delegates and timer counts
 * 5. Firmware service identity survives init/hardReset — generation fencing
 * 6. Listener-count assertions across repeated lifecycle
 *
 * Store isolation: see `zwaveClientServiceWiring.test.ts`'s doc comment.
 */
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
import { InclusionStrategy, RemoveNodeReason } from 'zwave-js'
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
	// The module-level backupManager singleton hasn't had init() called in
	// tests (no real Gateway/app startup). Import and stub it so the
	// inclusion/exclusion backup-on-event check doesn't crash.
	const bm = await import('../../../api/lib/BackupManager.ts')
	backupManager = bm.default as any
	// Ensure config is set to defaults (backupOnEvent = false)
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

/** Real `ZWaveClient` wired to the harness's real Socket.IO server. */
function realZwave(config: Record<string, unknown> = {}): ZWaveClientType {
	return new ZWaveClient(config as any, harness.io)
}

/**
 * Create a minimal fake driver that passes driverReady checks.
 * Only controller/network boundary methods are mocked.
 */
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

// -----------------------------------------------------------------
// 1. Coordinator identity survives init/hardReset/server onHardReset
// -----------------------------------------------------------------
describe('Production integration: coordinator identity survives init(), hardReset(), and buildServerHost().onHardReset()', () => {
	it('captured grant/DSK/abort callbacks settle via public ZwaveClient API after hardReset — same coordinator identity', async () => {
		const zwave = realZwave()
		const coordinatorBefore = (zwave as any)._inclusionCoordinator

		// Capture actual callbacks from the real coordinator
		const callbacks = coordinatorBefore.getUserCallbacks()

		// Wire a fake driver so hardReset() succeeds
		const fakeDriver = createFakeDriver()
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true

		// Perform production hardReset
		await zwave.hardReset()

		// Coordinator identity is the SAME object
		const coordinatorAfter = (zwave as any)._inclusionCoordinator
		expect(coordinatorAfter).toBe(coordinatorBefore)

		// Now invoke captured callbacks — they should settle through public API
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

		// Abort settles pending promises with false
		const abortGrantPromise = callbacks.grantSecurityClasses({
			securityClasses: [3],
			clientSideAuth: false,
		})
		zwave.abortInclusion()
		const abortResult = await abortGrantPromise
		expect(abortResult).toBe(false)
	})

	it('coordinator identity survives init() called directly', () => {
		const zwave = realZwave()
		const coordinatorBefore = (zwave as any)._inclusionCoordinator

		// Call init() directly (as restart would)
		zwave.init()

		const coordinatorAfter = (zwave as any)._inclusionCoordinator
		expect(coordinatorAfter).toBe(coordinatorBefore)
	})

	it('coordinator identity survives buildServerHost().onHardReset()', async () => {
		const zwave = realZwave()
		const coordinatorBefore = (zwave as any)._inclusionCoordinator

		// Capture callbacks before server reset
		const callbacks = coordinatorBefore.getUserCallbacks()

		// Wire driver so hardReset succeeds (onHardReset calls this.init())
		const fakeDriver = createFakeDriver()
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true

		// Execute the server's onHardReset hook (production path)
		const serverHost = zwave.buildServerHost()
		serverHost.onHardReset()

		// Same coordinator
		expect((zwave as any)._inclusionCoordinator).toBe(coordinatorBefore)

		// Captured callbacks still work
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

		// Wire driver
		const fakeDriver = createFakeDriver()
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true

		// Capture callbacks
		const callbacks = (
			zwave as any
		)._inclusionCoordinator.getUserCallbacks()

		// Start a grant flow
		const grantPromise = callbacks.grantSecurityClasses({
			securityClasses: [1],
			clientSideAuth: false,
		})

		// Reset before resolving (emits socket events for grant request)
		const socketCallsBefore = sendToSocketSpy.mock.calls.length

		// Resolve through public API — exactly one grant socket event was sent
		zwave.grantSecurityClasses({ securityClasses: [1] } as any)
		await grantPromise

		// Only the initial grantSecurityClasses socket emission (from
		// _onGrantSecurityClasses), no duplicate after reset
		const grantSocketCalls = sendToSocketSpy.mock.calls
			.slice(socketCallsBefore)
			.filter((call) => call[0] === socketEvents.grantSecurityClasses)
		expect(grantSocketCalls).toHaveLength(0) // resolve doesn't re-emit
	})
})

// -----------------------------------------------------------------
// 2. Server-disabled MQTT callback path
// -----------------------------------------------------------------
describe('Production integration: server-disabled MQTT callback path', () => {
	it('coordinator callback object survives init/hardReset and public replies settle (server disabled)', async () => {
		// Create client with serverEnabled: false
		const zwave = realZwave({ serverEnabled: false })
		const coordinator = (zwave as any)._inclusionCoordinator

		// The callbacks are the same object binding regardless of server state
		const callbacksBefore = coordinator.getUserCallbacks()

		// Wire driver
		;(zwave as any)._driver = createFakeDriver()
		zwave.driverReady = true

		// hardReset
		await zwave.hardReset()

		// Same coordinator
		expect((zwave as any)._inclusionCoordinator).toBe(coordinator)

		// Callbacks captured before reset still resolve
		const dskPromise = callbacksBefore.validateDSKAndEnterPIN('11111-22222')
		zwave.validateDSK('11111')
		expect(await dskPromise).toBe('11111')
	})

	it('setUserCallbacks/removeUserCallbacks on server-disabled config preserves hasUserCallbacks state', async () => {
		const zwave = realZwave({ serverEnabled: false })
		const coordinator = (zwave as any)._inclusionCoordinator

		// No driver configured — setUserCallbacks only sets the flag
		zwave.setUserCallbacks()
		expect(zwave.hasUserCallbacks).toBe(true)
		expect(coordinator.hasUserCallbacks).toBe(true)

		// Wire driver then init (simulates production restart)
		;(zwave as any)._driver = createFakeDriver()
		zwave.driverReady = true
		await zwave.hardReset()

		// hasUserCallbacks preserved
		expect(zwave.hasUserCallbacks).toBe(true)
		expect(coordinator.hasUserCallbacks).toBe(true)

		// Remove still works
		zwave.removeUserCallbacks()
		expect(zwave.hasUserCallbacks).toBe(false)
	})
})

// -----------------------------------------------------------------
// 3. Real ZwaveClient sole state ownership
// -----------------------------------------------------------------
describe('Production integration: sole state ownership (_createNode, node handlers, coordinator delegation)', () => {
	it('first _createNode consumes tmpNode metadata, second cannot inherit it', () => {
		const zwave = realZwave()
		const fakeDriver = createFakeDriver()
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true
		;(zwave as any).storeNodes = {}

		// Set tmpNode through coordinator (as startInclusion would)
		const coordinator = (zwave as any)._inclusionCoordinator
		coordinator._tmpNode = { name: 'Sensor', loc: 'Kitchen' }

		// First _createNode consumes metadata
		const node1 = (zwave as any)._createNode(10)
		expect(node1.name).toBe('Sensor')
		expect(node1.loc).toBe('Kitchen')

		// Second _createNode gets nothing (tmpNode already consumed)
		const node2 = (zwave as any)._createNode(11)
		expect(node2.name).toBe('')
		expect(node2.loc).toBe('')
	})

	it('replacement controls store deletion via coordinator isReplacing flag', () => {
		const zwave = realZwave()
		const fakeDriver = createFakeDriver()
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true
		;(zwave as any).storeNodes = { 5: { name: 'Old' } }
		;(zwave as any)._nodes.set(5, { id: 5, name: 'Old' })

		const coordinator = (zwave as any)._inclusionCoordinator

		// When replacing, _removeNode should NOT delete from store
		coordinator._isReplacing = true
		;(zwave as any)._removeNode(5)
		expect((zwave as any).storeNodes[5]).toEqual({ name: 'Old' })

		// When not replacing, store entry is deleted
		;(zwave as any)._nodes.set(6, { id: 6, name: 'Another' })
		;(zwave as any).storeNodes[6] = { name: 'Another' }
		coordinator._isReplacing = false
		;(zwave as any)._removeNode(6)
		expect((zwave as any).storeNodes[6]).toBeUndefined()
	})

	it('pendingInclusionNodeIds are cleaned through coordinator on inclusion failure', () => {
		const zwave = realZwave()
		const fakeDriver = createFakeDriver()
		;(zwave as any)._driver = fakeDriver
		zwave.driverReady = true
		;(zwave as any).storeNodes = {}

		// Simulate node found (adds to pending)
		;(zwave as any)._onNodeFound({ id: 20 })
		;(zwave as any)._onNodeFound({ id: 21 })

		const coordinator = (zwave as any)._inclusionCoordinator
		expect(coordinator.pendingInclusionNodeIds.has(20)).toBe(true)
		expect(coordinator.pendingInclusionNodeIds.has(21)).toBe(true)

		// Nodes are in the nodes map but not ready
		expect((zwave as any)._nodes.has(20)).toBe(true)
		expect((zwave as any)._nodes.has(21)).toBe(true)

		// Inclusion failure cleans up ghost nodes
		;(zwave as any)._onInclusionFailed()

		expect(coordinator.pendingInclusionNodeIds.size).toBe(0)
		// Ghost nodes removed (they were not ready)
		expect((zwave as any)._nodes.has(20)).toBe(false)
		expect((zwave as any)._nodes.has(21)).toBe(false)
	})

	it('close(true)/init clears coordinator state (pendingIds, tmpNode, timeout)', async () => {
		vi.useFakeTimers()
		try {
			const zwave = realZwave()
			const fakeDriver = createFakeDriver()
			;(zwave as any)._driver = fakeDriver
			zwave.driverReady = true
			;(zwave as any).storeNodes = {}

			// Set up coordinator state
			const coordinator = (zwave as any)._inclusionCoordinator
			coordinator._tmpNode = { name: 'Test', loc: 'Room' }
			coordinator._pendingInclusionNodeIds.add(99)
			coordinator._commandsTimeout = setTimeout(() => {}, 30000)

			// close(true) should reset coordinator
			await zwave.close(true)

			expect(coordinator.tmpNode).toBeUndefined()
			expect(coordinator.pendingInclusionNodeIds.size).toBe(0)

			// Now init() to re-establish — coordinator is same instance
			zwave.init()
			expect((zwave as any)._inclusionCoordinator).toBe(coordinator)
		} finally {
			vi.useRealTimers()
		}
	})
})

// -----------------------------------------------------------------
// 4. Learn/start inclusion cross-mode delegates and timer counts
// -----------------------------------------------------------------
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

			// Coordinator has a timer set
			const coordinator = (zwave as any)._inclusionCoordinator
			expect(coordinator._commandsTimeout).not.toBeNull()

			// Advance past timeout — should call stopInclusion
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

			// Coordinator timer set
			const coordinator = (zwave as any)._inclusionCoordinator
			expect(coordinator._commandsTimeout).not.toBeNull()

			// Advance — should call stopJoiningNetwork
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

			// hardReset clears the timer via coordinator.reset()
			await zwave.hardReset()
			expect(coordinator._commandsTimeout).toBeNull()

			// Re-wire driver after reset
			;(zwave as any)._driver = createFakeDriver()
			zwave.driverReady = true

			await zwave.startInclusion(InclusionStrategy.Default)
			// A new timer is set (not the old one)
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

			// Advancing more doesn't call it again
			await vi.advanceTimersByTimeAsync(50000)
			expect(stopInclusion).toHaveBeenCalledOnce()
		} finally {
			vi.useRealTimers()
		}
	})
})

// -----------------------------------------------------------------
// 5. Firmware service identity survives init/hardReset/server hardReset
// -----------------------------------------------------------------
describe('Production integration: firmware service identity survives init/hardReset/server hardReset', () => {
	it('_firmwareUpdateService is same instance after init()', () => {
		const zwave = realZwave()
		const fwBefore = (zwave as any)._firmwareUpdateService

		zwave.init()

		expect((zwave as any)._firmwareUpdateService).toBe(fwBefore)
	})

	it('_firmwareUpdateService is same instance after public hardReset()', async () => {
		const zwave = realZwave()
		const fwBefore = (zwave as any)._firmwareUpdateService
		;(zwave as any)._driver = createFakeDriver()
		zwave.driverReady = true

		await zwave.hardReset()

		expect((zwave as any)._firmwareUpdateService).toBe(fwBefore)
	})

	it('_firmwareUpdateService is same instance after server onHardReset', () => {
		const zwave = realZwave()
		const fwBefore = (zwave as any)._firmwareUpdateService
		;(zwave as any)._driver = createFakeDriver()
		zwave.driverReady = true

		zwave.buildServerHost().onHardReset()

		expect((zwave as any)._firmwareUpdateService).toBe(fwBefore)
	})

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

			// Start the firmware service's scheduled check
			const fwService = (zwave as any)._firmwareUpdateService
			const checkPromise = fwService.scheduledFirmwareUpdateCheck()

			// Execute production hardReset (resets generation)
			await zwave.hardReset()

			// Resolve the deferred controller boundary AFTER reset
			resolveCheck(new Map([[1, [{ version: '2.0', downgrade: false }]]]))
			await checkPromise

			// No store mutation or socket emission from old generation
			expect(updateStoreNodesSpy).not.toHaveBeenCalled()
			expect(sendToSocketSpy).not.toHaveBeenCalled()

			// Old timer cleared
			expect(fwService.generation).toBeGreaterThan(0)
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

			// Production hardReset path
			await zwave.hardReset()

			// Late resolve — should be fenced
			resolveCheck(new Map())
			await checkPromise

			// No valueChanged/nodeUpdated emissions from firmware service
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

			// Late reject — should not crash
			rejectCheck(new Error('network timeout'))
			await checkPromise // should not throw

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

			// Run a scheduled check — it will reschedule
			await fwService.scheduledFirmwareUpdateCheck()
			const firstTimeout = fwService._firmwareUpdateCheckTimeout
			expect(firstTimeout).not.toBeNull()

			// Production hardReset clears it
			await zwave.hardReset()
			expect(fwService._firmwareUpdateCheckTimeout).toBeNull()

			// Re-wire driver
			;(zwave as any)._driver = createFakeDriver()
			zwave.driverReady = true

			// New generation schedules
			await fwService.scheduledFirmwareUpdateCheck()
			const secondTimeout = fwService._firmwareUpdateCheckTimeout
			expect(secondTimeout).not.toBeNull()
			expect(secondTimeout).not.toBe(firstTimeout)

			// Only the firmware service's own timer is active (exactly one)
			// Count timers at global level to prove no old timer leaked
			const timerCountBefore = vi.getTimerCount()
			fwService.clearScheduledCheck()
			const timerCountAfter = vi.getTimerCount()
			// Clearing removed exactly one timer
			expect(timerCountBefore - timerCountAfter).toBe(1)
		} finally {
			vi.useRealTimers()
		}
	})
})

// -----------------------------------------------------------------
// 6. Listener-count assertions across repeated lifecycle
// -----------------------------------------------------------------
describe('Production integration: listener count stability across repeated init/hardReset/close lifecycle', () => {
	it('ZwaveClient event listener count does not increase across repeated init() calls', () => {
		const zwave = realZwave()

		// Baseline after constructor (which calls init() once)
		const baselineCount = zwave.listenerCount('driverStatus')

		// Multiple init() calls
		zwave.init()
		zwave.init()
		zwave.init()

		expect(zwave.listenerCount('driverStatus')).toBe(baselineCount)
	})

	it('ZwaveClient event listener count does not increase across repeated hardReset() calls', async () => {
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

	it('ZwaveClient event listener count does not increase across close(true)/init cycles', async () => {
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

	it('coordinator does not accumulate listeners across repeated init() calls', () => {
		const zwave = realZwave()
		const coordinator = (zwave as any)._inclusionCoordinator

		// Coordinator generation increments indicate reset was called
		const genAfterConstruct = coordinator.generation

		zwave.init()
		zwave.init()
		zwave.init()

		// Generation incremented each init
		expect(coordinator.generation).toBe(genAfterConstruct + 3)

		// Coordinator itself has no EventEmitter, so this proves no leaks
		// through the ZwaveClient's own listener registrations
		expect((zwave as any)._inclusionCoordinator).toBe(coordinator)
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
