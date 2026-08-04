/**
 * Direct unit/characterization tests for {@link ZwaveServerManager}, the
 * owner of the official `@zwave-js/server` (`ZwavejsServer`) lifecycle. These
 * exercise the manager in isolation (a fake host port, no `ZwaveClient`) so
 * every construction-option mapping, guard branch, teardown ordering and
 * idempotency path is proven against the manager itself. The end-to-end
 * `connect() -> driver ready -> close()` flow through `ZwaveClient` is covered
 * by `server.test.ts`.
 *
 * `@zwave-js/server` is replaced with a faithful EventEmitter fake so
 * `emit('error')` keeps real Node semantics (throws with no listener) and
 * `destroy()` is deferred a tick to prove awaits.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import ZwaveServerManager, {
	type ZwaveServerConfig,
	type ZwaveServerHost,
} from '#api/lib/ZwaveServerManager.ts'
import { makeHassLogger, tick } from './hass/fixtures.ts'

const hoisted = vi.hoisted(() => ({
	servers: [] as any[],
	destroyOrder: [] as string[],
	SERVER_VERSION: '9.9.9-managed',
}))

// Imported inside the factory: `vi.mock` is hoisted above this file's own
// imports, so a top-level binding would not be initialized yet
vi.mock('@zwave-js/server', async () => {
	const { zwaveServerMockFactory } = await import(
		'./shared/zwaveServerMock.ts'
	)
	return zwaveServerMockFactory(hoisted)
})

function lastServer() {
	return hoisted.servers[hoisted.servers.length - 1]
}

interface HarnessOptions {
	config?: ZwaveServerConfig
	hasUserCallbacks?: boolean
	driver?: unknown
}

function createHost(options: HarnessOptions = {}) {
	const driver = options.driver ?? { destroy: vi.fn(() => Promise.resolve()) }
	const logger = makeHassLogger()
	const serverLogger = {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	}
	const state = {
		config: options.config ?? { serverEnabled: true },
		hasUserCallbacks: options.hasUserCallbacks ?? false,
	}
	const onHardReset = vi.fn()
	const host: ZwaveServerHost = {
		getDriver: () => driver as any,
		getConfig: () => state.config,
		getHasUserCallbacks: () => state.hasUserCallbacks,
		onHardReset,
		logger,
		serverLogger,
	}
	return { host, driver, logger, serverLogger, state, onHardReset }
}

beforeEach(() => {
	hoisted.servers.length = 0
	hoisted.destroyOrder.length = 0
	vi.clearAllMocks()
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('ZwaveServerManager.create()', () => {
	it('builds the server with the current driver and defaults port to 3000', () => {
		const { host, driver, serverLogger } = createHost()
		const manager = new ZwaveServerManager(host)

		manager.create()

		const server = lastServer()
		expect(server.driver).toBe(driver)
		expect(server.options.port).toBe(3000)
		expect(server.options.logger).toBe(serverLogger)
		expect(manager.server).toBe(server)
	})

	it('honors an explicit serverPort and serverHost', () => {
		const { host } = createHost({
			config: {
				serverEnabled: true,
				serverPort: 9999,
				serverHost: '10.0.0.5',
			},
		})
		new ZwaveServerManager(host).create()

		expect(lastServer().options.port).toBe(9999)
		expect(lastServer().options.host).toBe('10.0.0.5')
	})

	it('inverts serverServiceDiscoveryDisabled into enableDNSServiceDiscovery', () => {
		const off = createHost({
			config: {
				serverEnabled: true,
				serverServiceDiscoveryDisabled: true,
			},
		})
		new ZwaveServerManager(off.host).create()
		expect(lastServer().options.enableDNSServiceDiscovery).toBe(false)

		const on = createHost({
			config: {
				serverEnabled: true,
				serverServiceDiscoveryDisabled: false,
			},
		})
		new ZwaveServerManager(on.host).create()
		expect(lastServer().options.enableDNSServiceDiscovery).toBe(true)

		const dflt = createHost({ config: { serverEnabled: true } })
		new ZwaveServerManager(dflt.host).create()
		expect(lastServer().options.enableDNSServiceDiscovery).toBe(true)
	})

	it('attaches an error listener that swallows the event (no throw)', () => {
		const { host } = createHost()
		new ZwaveServerManager(host).create()
		expect(() => lastServer().emit('error', new Error('x'))).not.toThrow()
	})

	it('attaches a `hard reset` listener that invokes onHardReset', () => {
		const { host, onHardReset, logger } = createHost()
		new ZwaveServerManager(host).create()

		lastServer().emit('hard reset')

		expect(onHardReset).toHaveBeenCalledOnce()
		expect(logger.info).toHaveBeenCalledWith(
			'Hard reset requested by ZwaveJS Server',
		)
	})

	it('re-reads the driver on every create (no captured snapshot)', () => {
		const first = { id: 'a', destroy: vi.fn() }
		const second = { id: 'b', destroy: vi.fn() }
		let current: unknown = first
		const base = createHost()
		const host: ZwaveServerHost = {
			...base.host,
			getDriver: () => current as any,
		}
		const manager = new ZwaveServerManager(host)

		manager.create()
		expect(lastServer().driver).toBe(first)

		current = second
		manager.create()
		expect(lastServer().driver).toBe(second)
	})

	it('does not build a server when serverEnabled is false (gate lives here)', () => {
		const { host } = createHost({ config: { serverEnabled: false } })
		const manager = new ZwaveServerManager(host)

		manager.create()

		// The enablement gate is owned by the manager, so create() is a no-op
		// and the caller (ZwaveClient.connect) can call it unconditionally
		expect(hoisted.servers).toHaveLength(0)
		expect(manager.server).toBeNull()
	})
})

describe('ZwaveServerManager.startIfNeeded()', () => {
	it('starts with start(true) when there are NO user callbacks', async () => {
		const { host, logger } = createHost({ hasUserCallbacks: false })
		const manager = new ZwaveServerManager(host)
		manager.create()

		manager.startIfNeeded()

		const server = lastServer()
		expect(server.start).toHaveBeenCalledOnce()
		expect(server.start).toHaveBeenCalledWith(true)
		await tick()
		expect(logger.info).toHaveBeenCalledWith('Z-Wave server started')
	})

	it('passes start(false) when user callbacks ARE present', () => {
		const { host } = createHost({ hasUserCallbacks: true })
		const manager = new ZwaveServerManager(host)
		manager.create()

		manager.startIfNeeded()

		expect(lastServer().start).toHaveBeenCalledWith(false)
	})

	it('does not start again once the server is already running', () => {
		const { host } = createHost()
		const manager = new ZwaveServerManager(host)
		manager.create()
		const server = lastServer()

		manager.startIfNeeded()
		expect(server.start).toHaveBeenCalledTimes(1)
		expect(server.server).toBeDefined()

		manager.startIfNeeded()
		expect(server.start).toHaveBeenCalledTimes(1)
	})

	it('logs an error when start() rejects', async () => {
		const { host, logger } = createHost()
		const manager = new ZwaveServerManager(host)
		manager.create()
		const server = lastServer()
		server.start.mockRejectedValueOnce(new Error('boom'))

		manager.startIfNeeded()
		await tick()

		expect(logger.error).toHaveBeenCalledWith(
			'Failed to start zwave-js server: boom',
		)
	})

	it('does nothing when serverEnabled is false (even if a server exists)', () => {
		const { host, state } = createHost()
		const manager = new ZwaveServerManager(host)
		manager.create()
		const server = lastServer()
		state.config = { serverEnabled: false }

		manager.startIfNeeded()

		expect(server.start).not.toHaveBeenCalled()
	})

	it('does nothing when there is no server instance', () => {
		const { host } = createHost()
		const manager = new ZwaveServerManager(host)
		expect(() => manager.startIfNeeded()).not.toThrow()
	})
})

describe('ZwaveServerManager.destroy()', () => {
	it('awaits server.destroy() then nulls the reference', async () => {
		const { host } = createHost()
		const manager = new ZwaveServerManager(host)
		manager.create()
		const server = lastServer()

		await manager.destroy()

		expect(server.destroy).toHaveBeenCalledOnce()
		expect(hoisted.destroyOrder).toEqual(['server'])
		expect(manager.server).toBeNull()
	})

	it('is an idempotent no-op when no server was ever created', async () => {
		const { host } = createHost()
		const manager = new ZwaveServerManager(host)

		await expect(manager.destroy()).resolves.toBeUndefined()
		expect(manager.server).toBeNull()
	})

	it('shares one upstream destroy() across concurrent calls for the same server', async () => {
		const { host } = createHost()
		const manager = new ZwaveServerManager(host)
		manager.create()
		const server = lastServer()

		// Gate the upstream teardown so both calls observe it in flight.
		let release: () => void = () => {}
		server.destroy = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					release = resolve
				}),
		)

		const first = manager.destroy()
		const second = manager.destroy()

		expect(server.destroy).toHaveBeenCalledOnce()

		release()
		await Promise.all([first, second])

		expect(server.destroy).toHaveBeenCalledOnce()
		expect(manager.server).toBeNull()
	})

	it('does not clear a replacement server created while an older destroy is in flight', async () => {
		const { host } = createHost()
		const manager = new ZwaveServerManager(host)
		manager.create()
		const original = lastServer()

		let release: () => void = () => {}
		original.destroy = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					release = resolve
				}),
		)

		const destroying = manager.destroy()
		// A replacement generation is created mid-teardown, exactly as a restart
		// racing an older destroy would
		manager.create()
		const replacement = lastServer()
		expect(replacement).not.toBe(original)

		release()
		await destroying

		expect(manager.server).toBe(replacement)
	})

	it('a rejected destroy() is observable and retryable (reference retained)', async () => {
		const { host } = createHost()
		const manager = new ZwaveServerManager(host)
		manager.create()
		const server = lastServer()

		server.destroy = vi
			.fn()
			.mockRejectedValueOnce(new Error('teardown failed'))
			.mockResolvedValueOnce(undefined)

		await expect(manager.destroy()).rejects.toThrow('teardown failed')
		// Retained after failure so a later stop can retry.
		expect(manager.server).toBe(server)

		await manager.destroy()
		expect(server.destroy).toHaveBeenCalledTimes(2)
		expect(manager.server).toBeNull()
	})
})

describe('ZwaveServerManager.handInclusionControlBack()', () => {
	it('is a no-op until the server has accepted a socket', () => {
		const { host } = createHost()
		const manager = new ZwaveServerManager(host)
		manager.create()
		const server = lastServer()

		manager.handInclusionControlBack()

		expect(server.setInclusionUserCallbacks).not.toHaveBeenCalled()
	})

	it('hands control back once the server owns sockets', () => {
		const { host } = createHost()
		const manager = new ZwaveServerManager(host)
		manager.create()
		const server = lastServer()
		server.sockets = []

		manager.handInclusionControlBack()

		expect(server.setInclusionUserCallbacks).toHaveBeenCalledOnce()
	})

	it('does nothing when there is no server at all', () => {
		const { host } = createHost()
		const manager = new ZwaveServerManager(host)
		expect(() => manager.handInclusionControlBack()).not.toThrow()
	})
})
