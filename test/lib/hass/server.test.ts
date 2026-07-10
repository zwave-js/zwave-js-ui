/**
 * Characterization tests for the official `@zwave-js/server` integration
 * lifecycle in `api/lib/ZwaveClient.ts`:
 *   - `_createServer()`        (construction options + listeners; ZwaveClient.ts)
 *   - `_startServerIfNeeded()` (start-after-ready + duplicate-start guard)
 *   - `close()`                (server-destroyed-BEFORE-driver order)
 *   - `getInfo().serverVersion`(exposed upstream version)
 *
 * Both `_createServer()` and `_startServerIfNeeded()` are the EXACT blocks
 * production runs inside `connect()` / `_onDriverReady()` (extracted verbatim
 * into named methods purely so the server boundary can be exercised without
 * standing up a real serial Driver). Only the upstream `@zwave-js/server`
 * module is mocked here; every assertion drives the real ZwaveClient method
 * bodies. `ZwaveClient.ts` is imported dynamically AFTER `ensureTestEnv()`.
 */
import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	beforeEach,
	vi,
} from 'vitest'
import { ensureTestEnv, cleanupTestEnv } from './env.ts'
import { createRecordingSocket } from './fixtures.ts'
import type ZWaveClientType from '../../../api/lib/ZwaveClient.ts'

// A dependency-free fake for the upstream `ZwavejsServer`. It records the
// constructor `(driver, options)`, exposes `start`/`destroy` spies, a togglable
// internal `server` property (the real class sets this after `start()`, which
// the duplicate-start guard reads), and a minimal `on`/`emit` so the real
// `error`/`hard reset` listeners can be driven. Defined inside `vi.hoisted`
// so the hoisted `vi.mock` factory below can reference it.
const hoisted = vi.hoisted(() => {
	const servers: any[] = []
	const destroyOrder: string[] = []
	const SERVER_VERSION = '1.2.3-test'

	class ZwavejsServerMock {
		driver: any
		options: any
		/** Undefined until `start()`; the real class sets this internally. */
		server: any = undefined
		start = vi.fn((..._args: any[]) => Promise.resolve())
		destroy = vi.fn(() => {
			destroyOrder.push('server')
			return Promise.resolve()
		})
		private handlers: Record<string, ((...a: any[]) => void)[]> = {}

		constructor(driver: any, options: any) {
			this.driver = driver
			this.options = options
			servers.push(this)
		}

		on(evt: string, h: (...a: any[]) => void) {
			;(this.handlers[evt] ||= []).push(h)
			return this
		}

		emit(evt: string, ...args: any[]) {
			for (const h of this.handlers[evt] || []) h(...args)
		}
	}

	return { servers, destroyOrder, SERVER_VERSION, ZwavejsServerMock }
})

vi.mock('@zwave-js/server', () => ({
	serverVersion: hoisted.SERVER_VERSION,
	ZwavejsServer: hoisted.ZwavejsServerMock,
}))

let ZWaveClient: typeof ZWaveClientType

/** The most recently constructed fake server. */
function lastServer() {
	return hoisted.servers[hoisted.servers.length - 1]
}

/** A minimal fake Driver: only ever passed through / `destroy()`-ed here. */
function fakeDriver() {
	return {
		destroy: vi.fn(() => {
			hoisted.destroyOrder.push('driver')
			return Promise.resolve()
		}),
	}
}

/** Real ZwaveClient (init-only, no real driver) with the given config. */
function makeClient(cfg: Record<string, any>): ZWaveClientType {
	const socket = createRecordingSocket()
	const zwave = new ZWaveClient(cfg as any, socket as any)
	;(zwave as any)._driver = fakeDriver()
	return zwave
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
	hoisted.destroyOrder.length = 0
	vi.clearAllMocks()
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

	it('registers an `error` listener that swallows the event (no throw)', () => {
		const zwave = makeClient({ serverEnabled: true })
		;(zwave as any)._createServer()
		expect(() => lastServer().emit('error', new Error('x'))).not.toThrow()
	})

	it('registers a `hard reset` listener that re-runs client init()', () => {
		const zwave = makeClient({ serverEnabled: true })
		;(zwave as any)._createServer()
		const initSpy = vi.spyOn(zwave, 'init')

		lastServer().emit('hard reset')

		expect(initSpy).toHaveBeenCalledOnce()
	})
})

describe('_startServerIfNeeded()', () => {
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

		// simulate the real class having set its internal server after start()
		server.server = {}
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

describe('close() teardown order', () => {
	it('destroys the server BEFORE the driver and nulls both', async () => {
		const zwave = makeClient({ serverEnabled: true })
		;(zwave as any)._createServer()
		const server = lastServer()
		const driver = (zwave as any)._driver

		await zwave.close(true)

		expect(server.destroy).toHaveBeenCalledOnce()
		expect(driver.destroy).toHaveBeenCalledOnce()
		// server destroyed strictly before the driver (Fixes ordering)
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
