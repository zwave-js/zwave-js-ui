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
import type ZWaveClientType from '#api/lib/ZwaveClient.ts'
import { ZwaveClientStatus } from '#api/lib/ZwaveClient.ts'

/**
 * Narrow view of the lifecycle internals with no public accessor: the status
 * enum, the held server instance, and the orthogonal config-check scheduler
 * that is stubbed so no ~24h timer leaks. Driving stays on public connect/close.
 */
type ClientInternals = {
	status: ZwaveClientStatus
	server: unknown
	_scheduledConfigCheck: () => Promise<void>
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
			return { nodeId: 255, commandClasses: {} }
		}
		getBroadcastNodeLR() {
			return { nodeId: 254, commandClasses: {} }
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

/** Flush one macrotask so pending `setImmediate` callbacks run. */
function tick(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve))
}

/**
 * Drive the real connect -> driver-ready flow and return the client, driver,
 * and server. Only `_scheduledConfigCheck` is stubbed (orthogonal, otherwise
 * arms a ~24h timer); option building, `driver.start()`, the server
 * construction, the async `'driver ready'` event, and the server start run for
 * real. Pass `connectedSockets` to model already-connected user sockets.
 */
async function driveConnectToReady(
	cfg: Record<string, any> = {},
	connectedSockets: unknown[] = [],
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

	await zwave.connect()

	// The server exists (created after await driver.start()), but the
	// driver-ready event is still queued, so nothing has started yet
	const beforeReady = {
		status: internals(zwave).status,
		driverReady: zwave.driverReady,
		startCalls: lastServer()?.start.mock.calls.length ?? 0,
	}

	// Let the async 'driver ready' event fire and the ready handler finish
	await tick()
	await tick()
	await tick()

	return {
		zwave,
		driver: lastDriver(),
		server: lastServer(),
		beforeReady,
	}
}

beforeAll(async () => {
	ensureTestEnv()
	const { default: jsonStore } = await import('#api/lib/jsonStore.ts')
	const { default: store } = await import('#api/config/store.ts')
	;({ default: ZWaveClient } = await import('#api/lib/ZwaveClient.ts'))
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
		// start a second server
		driver.emit('driver ready')
		await tick()
		await tick()
		await tick()

		expect(server.start).toHaveBeenCalledOnce()
		expect(hoisted.servers).toHaveLength(1)

		await zwave.close(true)
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
	it('exposes the upstream @zwave-js/server version', () => {
		const zwave = new ZWaveClient(
			{ serverEnabled: true } as any,
			createRecordingSocket() as any,
		)
		expect(zwave.getInfo().serverVersion).toBe(hoisted.SERVER_VERSION)
	})
})
