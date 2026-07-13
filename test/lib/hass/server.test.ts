/**
 * Characterization tests for the `@zwave-js/server` integration lifecycle in
 * `api/lib/ZwaveClient.ts`.
 *
 * A real end-to-end flow (`connect()` -> driver `'driver ready'` ->
 * `_onDriverReady()` -> `_startServerIfNeeded()` -> `close()`) runs the
 * production `connect()` body verbatim against a faithful EventEmitter `Driver`
 * fake, so the duplicate-start guard and the driver-waits-for-server teardown
 * are proven through the real async event. Direct-helper tests then cover the
 * `_createServer()` option matrix and `_startServerIfNeeded()` guard branches.
 * The `ZwavejsServer` fake defers `destroy()` to a later tick to prove teardown
 * awaits server shutdown. `ZwaveClient.ts` is imported after `ensureTestEnv()`.
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
import type ZWaveClientType from '../../../api/lib/ZwaveClient.ts'

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
// asynchronously (setImmediate) like the real driver, so `_createServer()`
// (which runs after `await driver.start()`) exists before the ready handler.
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

/** Minimal fake Driver for the direct-helper tests (never start()-ed). */
function fakeDriver() {
	return {
		destroy: vi.fn(() => {
			hoisted.destroyOrder.push('driver')
			return Promise.resolve()
		}),
	}
}

/** Real ZwaveClient (driver pre-injected) for direct-helper tests that skip connect(). */
function makeClient(cfg: Record<string, any>): ZWaveClientType {
	const socket = createRecordingSocket()
	const zwave = new ZWaveClient(cfg as any, socket as any)
	;(zwave as any)._driver = fakeDriver()
	return zwave
}

/** Flush one macrotask so pending `setImmediate` callbacks run. */
function tick(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve))
}

/**
 * Drive the real connect -> driver-ready flow and return the client, driver,
 * and server. Only `_scheduledConfigCheck` is stubbed (orthogonal, otherwise
 * arms a ~24h timer); option building, `driver.start()`, `_createServer()`,
 * the async `'driver ready'` event, and `_startServerIfNeeded()` run for real.
 */
async function driveConnectToReady(cfg: Record<string, any> = {}) {
	const socket = createRecordingSocket()
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
		'../../../api/lib/jsonStore.ts'
	)) as any
	const { default: store } = (await import(
		'../../../api/config/store.ts'
	)) as any
	;({ default: ZWaveClient } = await import(
		'../../../api/lib/ZwaveClient.ts'
	))
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

describe('faithful EventEmitter error semantics', () => {
	it('_createServer() attaches an error listener that swallows the event (no throw)', () => {
		const zwave = makeClient({ serverEnabled: true })
		;(zwave as any)._createServer()
		expect(() => lastServer().emit('error', new Error('x'))).not.toThrow()
	})

	it('_createServer() attaches a `hard reset` listener that re-runs client init()', () => {
		const zwave = makeClient({ serverEnabled: true })
		;(zwave as any)._createServer()
		const initSpy = vi.spyOn(zwave, 'init')

		lastServer().emit('hard reset')

		expect(initSpy).toHaveBeenCalledOnce()
	})
})

describe('_createServer() construction options', () => {
	it('constructs ZwavejsServer with the already-created driver and defaults port to 3000', () => {
		const zwave = makeClient({ serverEnabled: true })
		const driver = (zwave as any)._driver
		;(zwave as any)._createServer()

		const server = lastServer()
		expect(server).toBeDefined()
		// Built with the same driver instance (server created after the driver)
		expect(server.driver).toBe(driver)
		expect(server.options.port).toBe(3000)
		expect((zwave as any).server).toBe(server)
	})

	it('honors an explicit serverPort', () => {
		const zwave = makeClient({ serverEnabled: true, serverPort: 9999 })
		;(zwave as any)._createServer()
		expect(lastServer().options.port).toBe(9999)
	})

	it('maps serverHost to the host option', () => {
		const zwave = makeClient({
			serverEnabled: true,
			serverHost: '10.0.0.5',
		})
		;(zwave as any)._createServer()
		expect(lastServer().options.host).toBe('10.0.0.5')
	})

	it('maps serverServiceDiscoveryDisabled -> enableDNSServiceDiscovery (inverted)', () => {
		const off = makeClient({
			serverEnabled: true,
			serverServiceDiscoveryDisabled: true,
		})
		;(off as any)._createServer()
		expect(lastServer().options.enableDNSServiceDiscovery).toBe(false)

		const on = makeClient({
			serverEnabled: true,
			serverServiceDiscoveryDisabled: false,
		})
		;(on as any)._createServer()
		expect(lastServer().options.enableDNSServiceDiscovery).toBe(true)

		// Unset -> defaults to enabled
		const dflt = makeClient({ serverEnabled: true })
		;(dflt as any)._createServer()
		expect(lastServer().options.enableDNSServiceDiscovery).toBe(true)
	})
})

describe('_startServerIfNeeded() direct-helper guard branches', () => {
	it('starts the server with start(!hasUserCallbacks) === true when there are NO user callbacks', () => {
		const zwave = makeClient({ serverEnabled: true })
		;(zwave as any)._createServer()
		;(zwave as any).hasUserCallbacks = false
		;(zwave as any)._startServerIfNeeded()

		const server = lastServer()
		expect(server.start).toHaveBeenCalledOnce()
		expect(server.start).toHaveBeenCalledWith(true)
	})

	it('passes start(false) when user callbacks ARE present', () => {
		const zwave = makeClient({ serverEnabled: true })
		;(zwave as any)._createServer()
		;(zwave as any).hasUserCallbacks = true
		;(zwave as any)._startServerIfNeeded()

		expect(lastServer().start).toHaveBeenCalledWith(false)
	})

	it('duplicate-start guard: does NOT start again once the internal `server` prop is set', () => {
		const zwave = makeClient({ serverEnabled: true })
		;(zwave as any)._createServer()
		const server = lastServer()

		;(zwave as any)._startServerIfNeeded()
		expect(server.start).toHaveBeenCalledTimes(1)
		// start() armed the internal server prop; a second call is a no-op
		expect(server.server).toBeDefined()
		;(zwave as any)._startServerIfNeeded()
		expect(server.start).toHaveBeenCalledTimes(1)
	})

	it('does nothing when serverEnabled is false (even if a server object exists)', () => {
		const zwave = makeClient({ serverEnabled: false })
		// Force a server object on so the cfg guard, not the null-check, is
		// what stops the start
		;(zwave as any).server = lastServerStub()
		;(zwave as any)._startServerIfNeeded()

		expect((zwave as any).server.start).not.toHaveBeenCalled()
	})

	it('does nothing when there is no server instance', () => {
		const zwave = makeClient({ serverEnabled: true })
		;(zwave as any).server = null
		expect(() => (zwave as any)._startServerIfNeeded()).not.toThrow()
	})
})

describe('close() teardown order (direct helper)', () => {
	it('destroys the server BEFORE the driver and nulls both', async () => {
		const zwave = makeClient({ serverEnabled: true })
		;(zwave as any)._createServer()
		const server = lastServer()
		const driver = (zwave as any)._driver

		await zwave.close(true)

		expect(server.destroy).toHaveBeenCalledOnce()
		expect(driver.destroy).toHaveBeenCalledOnce()
		// Server destroyed strictly before the driver (deferred destroy proves
		// the await, not mere call ordering)
		expect(hoisted.destroyOrder).toEqual(['server', 'driver'])
		expect((zwave as any).server).toBeNull()
		expect((zwave as any)._driver).toBeNull()
	})

	it('is a no-op for the server branch when no server was ever created', async () => {
		const zwave = makeClient({ serverEnabled: false })
		const driver = (zwave as any)._driver
		await zwave.close(true)
		expect(driver.destroy).toHaveBeenCalledOnce()
		expect(hoisted.destroyOrder).toEqual(['driver'])
	})
})

describe('getInfo().serverVersion', () => {
	it('exposes the upstream @zwave-js/server version', () => {
		const zwave = makeClient({ serverEnabled: true })
		expect(zwave.getInfo().serverVersion).toBe(hoisted.SERVER_VERSION)
	})
})

/** A bare server stand-in with just a `start` spy for the disabled-path test. */
function lastServerStub() {
	return { start: vi.fn(() => Promise.resolve()), server: undefined }
}
