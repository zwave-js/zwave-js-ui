/**
 * Characterization tests for the official `@zwave-js/server` integration
 * lifecycle in `api/lib/ZwaveClient.ts`.
 *
 * Two complementary layers are exercised here:
 *
 *  1. A REAL end-to-end event flow (`connect()` → driver `'driver ready'`
 *     event → `_onDriverReady()` → `_startServerIfNeeded()` → `close()`).
 *     `zwave-js`'s `Driver` is replaced with a faithful EventEmitter fake so
 *     the production `connect()` body runs verbatim: it builds real driver
 *     options, wires the real `'driver ready'` handler, and the server is
 *     started by the ACTUAL asynchronous driver-ready event (not by poking a
 *     helper). The duplicate-start guard and the driver-waits-for-server
 *     teardown order are proven through this real flow.
 *
 *  2. Focused direct-helper tests for the `_createServer()` construction
 *     options matrix and the `_startServerIfNeeded()` guard branches, kept as
 *     secondary coverage of the individual option mappings.
 *
 * The upstream `@zwave-js/server` (`ZwavejsServer`) is a real EventEmitter
 * fake so `emit('error')` has faithful Node semantics (throws with no
 * listener) and `destroy()` is deferred to a later tick to prove the driver
 * teardown truly awaits server shutdown. `ZwaveClient.ts` is imported
 * dynamically AFTER `ensureTestEnv()`.
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

// Plain, class-free data holders so the (async) `vi.mock` factories below —
// which run lazily, after imports are live — can push instances / record
// teardown order into them. `vi.hoisted` guarantees these exist before any
// factory executes.
const hoisted = vi.hoisted(() => ({
	servers: [] as any[],
	drivers: [] as any[],
	destroyOrder: [] as string[],
	SERVER_VERSION: '1.2.3-test',
}))

// Faithful `@zwave-js/server` fake. It EXTENDS a real EventEmitter, so
// `emit('error')` throws when unhandled (exactly like the upstream class) —
// which is what makes the production `error` listener meaningful. `start()`
// sets the internal `server` prop (the real class does this too; the
// duplicate-start guard reads `this.server['server']`). `destroy()` is
// DEFERRED to a later tick and only then records `'server'`, so the close()
// ordering assertion proves the driver teardown awaited the server.
vi.mock('@zwave-js/server', async () => {
	const { EventEmitter } = await import('node:events')

	class ZwavejsServerMock extends EventEmitter {
		driver: any
		options: any
		/** Undefined until `start()`; the real class sets this internally. */
		server: any = undefined
		start = vi.fn((..._args: any[]) => {
			// the real ZwavejsServer assigns its internal http server here
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

// Faithful `zwave-js` Driver fake. Only `Driver` is replaced; every other
// named export (error codes, enums, helpers used at import time) is preserved
// via `importActual`. The fake extends EventEmitter so production can wire the
// real `'driver ready'`/`'error'` handlers, and `start()` emits `'driver
// ready'` ASYNCHRONOUSLY (setImmediate) — exactly like the real driver, which
// resolves `start()` before the controller-interview-complete event — so the
// server is created (after `await start()`) before the ready event fires.
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
			// real driver emits 'driver ready' asynchronously AFTER start()
			// resolves; keep that ordering so `_createServer()` (which runs
			// after `await driver.start()`) exists before the ready handler.
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

/** The most recently constructed fake server. */
function lastServer() {
	return hoisted.servers[hoisted.servers.length - 1]
}

/** A minimal fake Driver for the DIRECT-helper tests (never `start()`-ed). */
function fakeDriver() {
	return {
		destroy: vi.fn(() => {
			hoisted.destroyOrder.push('driver')
			return Promise.resolve()
		}),
	}
}

/**
 * Real ZwaveClient (init-only, driver pre-injected) for the direct-helper
 * option/guard tests that do NOT go through `connect()`.
 */
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
 * Drive the REAL connect → driver-ready flow to completion and return the
 * client + its (mocked) driver + server. `_scheduledConfigCheck` is the only
 * thing stubbed: it is orthogonal to the server lifecycle and otherwise arms a
 * real ~24h `setTimeout`. Everything else — option building, `driver.start()`,
 * `_createServer()`, the async `'driver ready'` event, `_onDriverReady()`,
 * `getStoreNodes()`, `_startServerIfNeeded()` — runs for real.
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
	// orthogonal background scheduler — stub so no real long-lived timer leaks
	vi.spyOn(zwave as any, '_scheduledConfigCheck').mockResolvedValue(undefined)

	await zwave.connect()

	// the server exists (created right after `await driver.start()`), but the
	// driver-ready event is still queued — nothing has started yet.
	const beforeReady = {
		status: (zwave as any).status,
		driverReady: (zwave as any).driverReady,
		startCalls: lastServer()?.start.mock.calls.length ?? 0,
	}

	// let the async 'driver ready' event fire and `_onDriverReady()` finish
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

		// connect() finished and created the server, but the driver-ready event
		// was still queued at that point: readiness/start had NOT happened yet.
		expect(beforeReady.status).toBe('connected')
		expect(beforeReady.driverReady).toBe(false)
		expect(beforeReady.startCalls).toBe(0)

		// after the real 'driver ready' event was processed:
		expect((zwave as any).driverReady).toBe(true)
		expect((zwave as any).status).toBe('driver ready')
		expect(server.start).toHaveBeenCalledOnce()
		// no connected user sockets -> start(!hasUserCallbacks) === start(true)
		expect(server.start).toHaveBeenCalledWith(true)
		// the internal server prop is now set -> duplicate-start guard armed
		expect(server.server).toBeDefined()

		await zwave.close(true)
	})

	it('duplicate-start guard holds when the driver RE-EMITS driver ready (real event, e.g. after hard reset)', async () => {
		const { zwave, driver, server } = await driveConnectToReady()
		expect(server.start).toHaveBeenCalledOnce()

		// a real re-emitted 'driver ready' (the exact scenario the guard exists
		// for, see #602) must NOT start a second server.
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
		// server.destroy() resolves on a LATER tick, yet still lands first ->
		// proves close() awaited the server before destroying the driver.
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
	it('an unhandled server error THROWS (real EventEmitter), so the production error listener is load-bearing', async () => {
		const { ZwavejsServer } = (await import('@zwave-js/server')) as any
		const bare = new ZwavejsServer({}, {})
		// no listener attached -> Node's EventEmitter re-throws on 'error'
		expect(() => bare.emit('error', new Error('boom'))).toThrow('boom')
	})

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
		// built with the SAME driver instance (server is created relative to,
		// and after, driver creation)
		expect(server.driver).toBe(driver)
		expect(server.options.port).toBe(3000)
		// this.server points at the freshly built instance
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

		// unset -> defaults to enabled
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
		// force a server object onto the client to prove the cfg guard, not the
		// null-check, is what stops the start
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
		// server destroyed strictly before the driver (deferred destroy proves
		// the await, not merely call ordering)
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
