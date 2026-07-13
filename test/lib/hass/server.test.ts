/**
 * Characterization tests for the `@zwave-js/server` integration lifecycle in
 * `api/lib/ZwaveClient.ts`, driven entirely through the real `connect()` entry
 * point.
 *
 * A real end-to-end flow (`connect()` -> driver `'driver ready'` ->
 * `_onDriverReady()` -> server `start()` -> `close()`) runs the production
 * `connect()` body verbatim against a faithful EventEmitter `Driver` fake, so
 * the option mapping, the duplicate-start guard, the user-callback start flag,
 * the `error`/`hard reset` listeners, and the driver-waits-for-server teardown
 * are all proven through the real async event rather than by calling private
 * helpers. The `ZwavejsServer` fake defers `destroy()` to a later tick to prove
 * teardown awaits server shutdown. `ZwaveClient.ts` is imported after
 * `ensureTestEnv()`.
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
	// Stub the orthogonal scheduler so no real long-lived timer leaks
	vi.spyOn(zwave as any, '_scheduledConfigCheck').mockResolvedValue(undefined)

	await zwave.connect()

	// The server exists (created after await driver.start()), but the
	// driver-ready event is still queued, so nothing has started yet
	const beforeReady = {
		status: (zwave as any).status,
		driverReady: (zwave as any).driverReady,
		startCalls: lastServer()?.start.mock.calls.length ?? 0,
	}

	// Let the async 'driver ready' event fire and _onDriverReady() finish
	await tick()
	await tick()
	await tick()

	return {
		zwave,
		driver: (zwave as any)._driver,
		server: lastServer(),
		beforeReady,
	}
}

beforeAll(async () => {
	ensureTestEnv()
	const { default: jsonStore } = (await import(
		'#api/lib/jsonStore.ts'
	)) as any
	const { default: store } = (await import('#api/config/store.ts')) as any
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
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('real connect() -> driver ready event flow', () => {
	it('starts the server exactly once via the ACTUAL asynchronous driver-ready event', async () => {
		const { zwave, server, beforeReady } = await driveConnectToReady()

		expect(beforeReady.status).toBe('connected')
		expect(beforeReady.driverReady).toBe(false)
		expect(beforeReady.startCalls).toBe(0)

		expect((zwave as any).driverReady).toBe(true)
		expect((zwave as any).status).toBe('driver ready')
		expect(server.start).toHaveBeenCalledOnce()
		// No connected user sockets -> start(!hasUserCallbacks) === start(true)
		expect(server.start).toHaveBeenCalledWith(true)
		// Internal server prop now set -> duplicate-start guard armed
		expect(server.server).toBeDefined()

		await zwave.close(true)
	})

	it('duplicate-start guard holds when the driver RE-EMITS driver ready (real event, e.g. after hard reset)', async () => {
		const { zwave, driver, server } = await driveConnectToReady()
		expect(server.start).toHaveBeenCalledOnce()

		// A real re-emitted 'driver ready' (the #602 scenario) must not start
		// a second server
		driver.emit('driver ready')
		await tick()
		await tick()
		await tick()

		expect(server.start).toHaveBeenCalledOnce()
		expect(hoisted.servers).toHaveLength(1)

		await zwave.close(true)
	})

	it('close() destroys the server BEFORE the driver even though server.destroy() is deferred', async () => {
		const { zwave, driver, server } = await driveConnectToReady()

		await zwave.close(true)

		expect(server.destroy).toHaveBeenCalledOnce()
		expect(driver.destroy).toHaveBeenCalledOnce()
		// server.destroy() resolves on a later tick yet still lands first,
		// proving close() awaited the server before destroying the driver
		expect(hoisted.destroyOrder).toEqual(['server', 'driver'])
		expect((zwave as any).server).toBeNull()
		expect((zwave as any)._driver).toBeNull()
	})

	it('does NOT create a server when serverEnabled is false, but still reaches driver ready', async () => {
		const { zwave } = await driveConnectToReady({ serverEnabled: false })

		expect((zwave as any).driverReady).toBe(true)
		expect(hoisted.servers).toHaveLength(0)

		await zwave.close(true)
	})
})

describe('server error + hard-reset listeners (via the real connect flow)', () => {
	it('swallows a server `error` event so it never crashes the process', async () => {
		const { zwave, server } = await driveConnectToReady()
		// connect() attaches an 'error' listener purely to absorb the event;
		// without a listener Node re-throws an emitted 'error' and crashes
		expect(() => server.emit('error', new Error('boom'))).not.toThrow()
		await zwave.close(true)
	})

	it('re-runs client init() when the server emits `hard reset`', async () => {
		const { zwave, server } = await driveConnectToReady()
		const initSpy = vi.spyOn(zwave, 'init').mockResolvedValue(undefined)

		server.emit('hard reset')

		expect(initSpy).toHaveBeenCalledOnce()
		await zwave.close(true)
	})
})

describe('server construction options (via the real connect flow)', () => {
	it('builds the server with the created driver and defaults the port to 3000', async () => {
		const { zwave, driver, server } = await driveConnectToReady()
		// The server is constructed with the same driver instance connect() just
		// created, so it always exists before the driver becomes ready
		expect(server.driver).toBe(driver)
		expect(server.options.port).toBe(3000)
		expect((zwave as any).server).toBe(server)
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

describe('server start flag from connected user sockets', () => {
	it('passes start(false) when a user socket is already connected', async () => {
		// hasUserCallbacks = (await socket.fetchSockets()).length > 0, so a
		// connected socket makes _onDriverReady start the server with start(false).
		// The stand-in needs emit() because _onDriverReady pushes init state to
		// each connected socket
		const { zwave, server } = await driveConnectToReady({}, [
			{ emit: vi.fn() },
		])
		expect(server.start).toHaveBeenCalledWith(false)
		await zwave.close(true)
	})
})

describe('getInfo().serverVersion', () => {
	it('exposes the upstream @zwave-js/server version', () => {
		const zwave = new ZWaveClient(
			{ serverEnabled: true } as any,
			createRecordingSocket() as any,
		)
		expect(zwave.getInfo().serverVersion).toBe(hoisted.SERVER_VERSION)
	})
})
