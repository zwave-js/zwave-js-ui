/**
 * Characterizes the @zwave-js/server integration lifecycle, driven entirely
 * through the real connect() entry point.
 *
 * A real end-to-end flow (connect -> driver 'driver ready' -> server start ->
 * close) runs the production connect() body against a faithful EventEmitter
 * Driver fake, so the option mapping, the duplicate-start guard, the
 * user-callback start flag, the error/hard-reset listeners, and the
 * driver-waits-for-server teardown are all proven through the real async event
 * rather than by calling private helpers. The server fake defers destroy() to a
 * later tick to prove teardown awaits server shutdown.
 */
import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	afterEach,
	beforeEach,
	vi,
} from 'vitest'
import { ensureTestEnv, cleanupTestEnv } from './env.ts'
import { createRecordingSocket } from './fixtures.ts'
import { createDeferred } from '../zwave/serviceTestSupport.ts'
import type ZWaveClientType from '#api/lib/ZwaveClient'
import { ZwaveClientStatus } from '#api/lib/ZwaveClient'
import { NODE_ID_BROADCAST, NODE_ID_BROADCAST_LR } from '@zwave-js/core'

/**
 * Narrow view of the lifecycle internals with no public accessor: the status
 * enum and the held server instance. Driving stays on public connect/close.
 */
type ClientInternals = {
	status: ZwaveClientStatus
	server: unknown
}
const internals = (zwave: ZWaveClientType) =>
	zwave as unknown as ClientInternals

// Class-free holders the (lazy) vi.mock factories below push instances /
// teardown order into; vi.hoisted guarantees they exist before any factory runs
const hoisted = vi.hoisted(() => ({
	servers: [] as any[],
	drivers: [] as any[],
	destroyOrder: [] as string[],
	SERVER_VERSION: '1.2.3-test',
}))

// Faithful `@zwave-js/server` fake. `start()` sets the internal `server` prop
// (the duplicate-start guard reads `this.server['server']`), and `destroy()`
// is deferred to a later tick so the close() ordering assertion proves the
// driver teardown awaited the server.
vi.mock('@zwave-js/server', async () => {
	const { EventEmitter } = await import('node:events')

	class ZwavejsServerMock extends EventEmitter {
		driver: any
		options: any
		/** Undefined until start(), mirroring the real class. */
		server: any = undefined
		start = vi.fn((..._args: any[]) => {
			// The real ZwavejsServer assigns its internal http server here
			this.server = {}
			return Promise.resolve()
		})
		destroy = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					setImmediate(() => {
						hoisted.destroyOrder.push('server')
						resolve()
					})
				}),
		)

		constructor(driver: any, options: any) {
			super()
			this.driver = driver
			this.options = options
			hoisted.servers.push(this)
		}
	}

	return {
		serverVersion: hoisted.SERVER_VERSION,
		ZwavejsServer: ZwavejsServerMock,
	}
})

// Faithful `zwave-js` Driver fake: only `Driver` is replaced (importActual
// preserves the other exports). `start()` emits `'driver ready'`
// asynchronously (setImmediate) like the real driver, so the server (built
// after `await driver.start()`) exists before the ready handler fires.
vi.mock('zwave-js', async () => {
	const actual = await vi.importActual<any>('zwave-js')
	const { EventEmitter } = await import('node:events')

	class FakeController extends EventEmitter {
		inclusionState = 0
		homeId = 0xcafebabe
		ownNodeId = 1
		nodes = new Map()
		supportsLongRange = false
		getBroadcastNode() {
			return { nodeId: NODE_ID_BROADCAST, commandClasses: {} }
		}
		getBroadcastNodeLR() {
			return { nodeId: NODE_ID_BROADCAST_LR, commandClasses: {} }
		}
	}

	class FakeDriver extends EventEmitter {
		controller = new FakeController()
		port: any
		options: any
		start = vi.fn(() => {
			// Emit 'driver ready' after start() resolves, matching the real driver
			setImmediate(() => this.emit('driver ready'))
			return Promise.resolve()
		})
		destroy = vi.fn(() => {
			hoisted.destroyOrder.push('driver')
			return Promise.resolve()
		})
		checkForConfigUpdates = vi.fn(() => Promise.resolve(undefined))
		installConfigUpdate = vi.fn(() => Promise.resolve(false))
		// The real Driver exposes updateOptions; connect() calls it through
		// setUserCallbacks() when a user socket is already connected
		updateOptions = vi.fn()

		constructor(port: any, options: any) {
			super()
			this.port = port
			this.options = options
			hoisted.drivers.push(this)
		}
	}

	return { ...actual, Driver: FakeDriver }
})

let ZWaveClient: typeof ZWaveClientType

function lastServer() {
	return hoisted.servers[hoisted.servers.length - 1]
}

function lastDriver() {
	return hoisted.drivers[hoisted.drivers.length - 1]
}

/**
 * Resolves on the client's real `driver ready` lifecycle event — the
 * deterministic signal that `_onDriverReady` has run (production emits it right
 * before starting the server) — instead of flushing a fixed count of
 * macrotasks. Arm it before `connect()` so the async event can't be missed.
 */
function waitForDriverReadyEvent(zwave: ZWaveClientType): Promise<void> {
	return new Promise<void>((resolve) => {
		const onEvent = (_source: unknown, name: string) => {
			if (name === 'driver ready') {
				zwave.off('event', onEvent)
				resolve()
			}
		}
		zwave.on('event', onEvent)
	})
}

/**
 * Drive the real connect -> driver-ready flow and return the client, driver,
 * and server. Option building, `driver.start()`, the server construction, the
 * async `'driver ready'` event, and the server start all run for real; the
 * orthogonal config-check runs too but its ~24h timer is neutralized by fake
 * timers. Pass `connectedSockets` to model already-connected user sockets.
 */
async function driveConnectToReady(
	cfg: Record<string, any> = {},
	connectedSockets: unknown[] = [],
	prepareDriver?: (driver: ReturnType<typeof lastDriver>) => void,
) {
	const socket = createRecordingSocket(connectedSockets)
	const zwave = new ZWaveClient(
		{
			enabled: true,
			port: 'tcp://localhost:5555',
			serverEnabled: true,
			...cfg,
		} as any,
		socket as any,
	)

	// Arm the deterministic wait before connect so the async 'driver ready'
	// event the driver fires (via setImmediate) after start() can't be missed
	const ready = waitForDriverReadyEvent(zwave)

	await zwave.connect()
	prepareDriver?.(lastDriver())

	// The server exists (created after await driver.start()), but the
	// driver-ready event is still queued, so nothing has started yet
	const beforeReady = {
		status: internals(zwave).status,
		driverReady: zwave.driverReady,
		startCalls: lastServer()?.start.mock.calls.length ?? 0,
	}

	// Wait for the real driver-ready lifecycle event and its ready handler
	await ready

	return {
		zwave,
		driver: lastDriver(),
		server: lastServer(),
		beforeReady,
	}
}

beforeAll(async () => {
	ensureTestEnv()
	const { default: jsonStore } = await import('#api/lib/jsonStore')
	const { default: store } = await import('#api/config/store')
	;({ default: ZWaveClient } = await import('#api/lib/ZwaveClient'))
	await jsonStore.init(store)
})

afterAll(() => {
	cleanupTestEnv()
})

beforeEach(() => {
	hoisted.servers.length = 0
	hoisted.drivers.length = 0
	hoisted.destroyOrder.length = 0
	vi.clearAllMocks()
	// Fake only setTimeout so the real driver-ready handler runs its config-check
	// scheduler without arming a ~24h timer; setImmediate stays real so the
	// 'driver ready' event and deferred server destroy still fire
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
})

describe('connecting and reaching driver ready', () => {
	it('starts the server once when the driver becomes ready', async () => {
		const { zwave, server, beforeReady } = await driveConnectToReady()

		expect(beforeReady.status).toBe(ZwaveClientStatus.CONNECTED)
		expect(beforeReady.driverReady).toBe(false)
		expect(beforeReady.startCalls).toBe(0)

		expect(zwave.driverReady).toBe(true)
		expect(internals(zwave).status).toBe(ZwaveClientStatus.DRIVER_READY)
		expect(server.start).toHaveBeenCalledOnce()
		// No connected user sockets, so the server starts owning its callbacks
		expect(server.start).toHaveBeenCalledWith(true)
		// The server's internal http server is now set, arming the duplicate-start guard
		expect(server.server).toBeDefined()

		await zwave.close(true)
	})

	it('does not start a second server when the driver re-emits ready', async () => {
		const { zwave, driver, server } = await driveConnectToReady()
		expect(server.start).toHaveBeenCalledOnce()

		// A re-emitted 'driver ready' (the #602 hard-reset scenario) must not
		// start a second server. Wait on the client's re-emitted lifecycle
		// event rather than a fixed macrotask count.
		const readyAgain = waitForDriverReadyEvent(zwave)
		driver.emit('driver ready')
		await readyAgain

		expect(server.start).toHaveBeenCalledOnce()
		expect(hoisted.servers).toHaveLength(1)

		await zwave.close(true)
	})

	it('keeps a newer manual config result when the scheduled check finishes later', async () => {
		const scheduledCheck = createDeferred<string | undefined>()
		const manualCheck = createDeferred<string | undefined>()
		const { zwave, driver } = await driveConnectToReady(
			{},
			[],
			(driver) => {
				driver.checkForConfigUpdates
					.mockReturnValueOnce(scheduledCheck.promise)
					.mockReturnValueOnce(manualCheck.promise)
			},
		)

		try {
			expect(driver.checkForConfigUpdates).toHaveBeenCalledTimes(1)

			const manualRun = zwave.checkForConfigUpdates()
			manualCheck.resolve('newer')
			await expect(manualRun).resolves.toBe('newer')

			scheduledCheck.resolve('older')
			await scheduledCheck.promise

			expect(zwave.getInfo().newConfigVersion).toBe('newer')
		} finally {
			await zwave.close(true)
		}
	})

	it('clears an installed config update when a check overlaps installation', async () => {
		const { zwave, driver } = await driveConnectToReady()
		const install = createDeferred<boolean>()
		const overlappingCheck = createDeferred<string | undefined>()

		try {
			driver.checkForConfigUpdates.mockResolvedValueOnce('available')
			await zwave.checkForConfigUpdates()
			expect(zwave.getInfo().newConfigVersion).toBe('available')

			driver.installConfigUpdate.mockReturnValueOnce(install.promise)
			driver.checkForConfigUpdates.mockReturnValueOnce(
				overlappingCheck.promise,
			)
			const installRun = zwave.installConfigUpdate()
			const duplicateInstallRun = zwave.installConfigUpdate()
			const checkRun = zwave.checkForConfigUpdates()
			expect(driver.installConfigUpdate).toHaveBeenCalledTimes(1)

			overlappingCheck.resolve('available')
			await checkRun
			install.resolve(true)
			await expect(installRun).resolves.toBe(true)
			await expect(duplicateInstallRun).resolves.toBe(true)

			expect(zwave.getInfo().newConfigVersion).toBeUndefined()
		} finally {
			await zwave.close(true)
		}
	})

	it('closing shuts down the server before the driver even when server shutdown is deferred', async () => {
		const { zwave, driver, server } = await driveConnectToReady()

		await zwave.close(true)

		expect(server.destroy).toHaveBeenCalledOnce()
		expect(driver.destroy).toHaveBeenCalledOnce()
		// server.destroy() resolves on a later tick yet still lands first,
		// proving close() awaited the server before destroying the driver
		expect(hoisted.destroyOrder).toEqual(['server', 'driver'])
		expect(internals(zwave).server).toBeNull()
		expect(zwave.driver).toBeNull()
	})

	it('skips server creation when serverEnabled is false but still reaches driver ready', async () => {
		const { zwave } = await driveConnectToReady({ serverEnabled: false })

		expect(zwave.driverReady).toBe(true)
		expect(hoisted.servers).toHaveLength(0)

		await zwave.close(true)
	})
})

describe('server error and hard-reset handling', () => {
	it('absorbs a server error event so it never crashes the process', async () => {
		const { zwave, server } = await driveConnectToReady()
		// connect() attaches an 'error' listener purely to absorb the event;
		// without a listener Node re-throws an emitted 'error' and crashes
		expect(() => server.emit('error', new Error('boom'))).not.toThrow()
		await zwave.close(true)
	})

	it('re-initializes the client when the server emits hard reset', async () => {
		const { zwave, server } = await driveConnectToReady()
		const initSpy = vi.spyOn(zwave, 'init').mockResolvedValue(undefined)

		server.emit('hard reset')

		expect(initSpy).toHaveBeenCalledOnce()
		await zwave.close(true)
	})
})

describe('server construction options', () => {
	it('builds the server with the created driver and defaults the port to 3000', async () => {
		const { zwave, driver, server } = await driveConnectToReady()
		// The server is constructed with the same driver instance connect() just
		// created, so it always exists before the driver becomes ready
		expect(server.driver).toBe(driver)
		expect(server.options.port).toBe(3000)
		expect(internals(zwave).server).toBe(server)
		await zwave.close(true)
	})

	it('honors an explicit serverPort', async () => {
		const { zwave, server } = await driveConnectToReady({
			serverPort: 9999,
		})
		expect(server.options.port).toBe(9999)
		await zwave.close(true)
	})

	it('maps serverHost to the host option', async () => {
		const { zwave, server } = await driveConnectToReady({
			serverHost: '10.0.0.5',
		})
		expect(server.options.host).toBe('10.0.0.5')
		await zwave.close(true)
	})

	it('inverts serverServiceDiscoveryDisabled into enableDNSServiceDiscovery', async () => {
		const off = await driveConnectToReady({
			serverServiceDiscoveryDisabled: true,
		})
		expect(off.server.options.enableDNSServiceDiscovery).toBe(false)
		await off.zwave.close(true)

		const on = await driveConnectToReady({
			serverServiceDiscoveryDisabled: false,
		})
		expect(on.server.options.enableDNSServiceDiscovery).toBe(true)
		await on.zwave.close(true)

		// Unset defaults to enabled
		const dflt = await driveConnectToReady()
		expect(dflt.server.options.enableDNSServiceDiscovery).toBe(true)
		await dflt.zwave.close(true)
	})
})

describe('starting the server for connected user sockets', () => {
	it('starts the server in user-callback mode when a user socket is already connected', async () => {
		// A connected user socket makes the ready handler start the server with
		// start(false), deferring to the user's callbacks. The stand-in needs
		// emit() because the ready handler pushes init state to each socket
		const { zwave, server } = await driveConnectToReady({}, [
			{ emit: vi.fn() },
		])
		expect(server.start).toHaveBeenCalledWith(false)
		await zwave.close(true)
	})
})

describe('reported server version', () => {
	it('surfaces the serverVersion exported by @zwave-js/server through getInfo', () => {
		// Wiring assertion, not a self-referential oracle: hoisted.SERVER_VERSION
		// is the value the @zwave-js/server mock exports as `serverVersion`,
		// standing in for the real package at that import seam. Asserting
		// getInfo().serverVersion equals it proves getInfo() surfaces the
		// upstream export rather than deriving or hardcoding a version.
		const zwave = new ZWaveClient(
			{ serverEnabled: true } as any,
			createRecordingSocket() as any,
		)
		expect(zwave.getInfo().serverVersion).toBe(hoisted.SERVER_VERSION)
	})
})
