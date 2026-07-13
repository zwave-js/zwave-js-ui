/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Direct state-machine tests for the extracted {@link DriverLifecycle}
 * service (`api/lib/zwave/DriverLifecycle.ts`).
 *
 * The service reaches everything it needs from `ZwaveClient` through the
 * narrow {@link DriverLifecycleHost} port, so these tests drive it with a
 * fully-faked host whose accessors read/write a small mutable state object.
 * `zwave-js`'s `Driver` is replaced with an `EventEmitter` fake so the real
 * `connect()` body runs verbatim (real option building, real event wiring),
 * and `@zwave-js/server` + `utils.ensureDir` are stubbed so no real server
 * binds a port and no directory is written to disk.
 *
 * The complementary end-to-end flow through the `ZwaveClient` facade (real
 * `connect()` → driver-ready → `_onDriverReady()` → server start → `close()`),
 * including generation fencing of a late `_onDriverReady()`, is characterized
 * in `test/lib/hass/server.test.ts` and the socket production-integration suite.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ZWaveError, ZWaveErrorCodes } from '@zwave-js/core'

import type { DriverLifecycleHost } from '../../../api/lib/zwave/DriverLifecycle.ts'
import type {
	ZwaveConfig,
	InclusionUserCallbacks,
} from '../../../api/lib/zwave/ports.ts'
import { ZwaveClientStatus } from '../../../api/lib/zwave/ports.ts'

// vi.hoisted holders the mock factories push into, reset in beforeEach
const hoisted = vi.hoisted(() => ({
	drivers: [] as any[],
	destroyOrder: [] as string[],
	startBehavior: 'resolve' as 'resolve' | 'reject' | 'hang' | 'deferred',
	startError: new Error('start failed'),
	/** In 'deferred' mode each start() pushes a controllable settler here so a test can interleave two overlapping connect() calls with no timers */
	startDeferreds: [] as Array<{
		resolve: () => void
		reject: (err: unknown) => void
	}>,
	startHook: null as null | (() => void),
	ensureDirHook: null as null | (() => void),
	destroyRejects: false,
	/** 'reject' keeps the instance intact/retryable (models a destroy that fails while the driver may still hold the port); 'deferred' lets a test hold teardown open to prove no replacement is built mid-teardown */
	destroyBehavior: 'resolve' as 'resolve' | 'reject' | 'deferred',
	/** In 'deferred' mode each destroy() pushes a settler here; resolve() records the teardown effect once, reject() leaves the instance intact/retryable */
	destroyDeferreds: [] as Array<{
		resolve: () => void
		reject: (err?: Error) => void
	}>,
	/** Leading destroy() calls that reject before one succeeds, so a test can prove a rejected destroy keeps the owner and a later retry tears it down */
	destroyRejectCount: 0,
	destroyInvocations: 0,
	logTransports: [] as any[],
	/** Overrides buildLogConfig() for the next connect() to reach enrichment branches the always-populated real config never hits (no logConfig, or a non-string level) */
	buildLogConfigOverride: null as null | (() => any),
}))

// zwave-js Driver fake: extends EventEmitter so production wires real handlers; start()/destroy() honour the controllable hoisted behavior
vi.mock('zwave-js', async () => {
	const actual = await vi.importActual<any>('zwave-js')
	const { EventEmitter } = await import('node:events')

	class FakeController extends EventEmitter {
		homeId = 0xcafebabe
		ownNodeId = 1
		nodes = new Map()
	}

	class FakeDriver extends EventEmitter {
		controller = new FakeController()
		port: any
		options: any
		private _destroyed = false
		start = vi.fn(() => {
			hoisted.startHook?.()
			if (hoisted.startBehavior === 'reject') {
				return Promise.reject(hoisted.startError)
			}
			if (hoisted.startBehavior === 'hang') {
				return new Promise<void>(() => {
					/* never resolves */
				})
			}
			if (hoisted.startBehavior === 'deferred') {
				return new Promise<void>((resolve, reject) => {
					hoisted.startDeferreds.push({ resolve, reject })
				})
			}
			return Promise.resolve()
		})
		destroy = vi.fn((): Promise<void> => {
			hoisted.destroyInvocations++

			// Record the teardown effect at most once per instance, mirroring real zwave-js Driver.destroy() idempotency so a stale-connect teardown racing close() records it exactly once
			const recordEffect = () => {
				if (!this._destroyed) {
					this._destroyed = true
					hoisted.destroyOrder.push('driver')
				}
			}

			if (hoisted.destroyBehavior === 'deferred') {
				return new Promise<void>((resolve, reject) => {
					hoisted.destroyDeferreds.push({
						resolve: () => {
							recordEffect()
							resolve()
						},
						reject: (err?: Error) =>
							reject(err ?? new Error('destroy rejected')),
					})
				})
			}

			// Already torn down: idempotent clean resolve
			if (this._destroyed) {
				return Promise.resolve()
			}

			// A rejecting destroy must not mark the instance destroyed or record an effect, so the exact owner stays intact and retryable
			const rejectThis =
				hoisted.destroyRejects ||
				hoisted.destroyBehavior === 'reject' ||
				hoisted.destroyRejectCount > 0
			if (rejectThis) {
				if (hoisted.destroyRejectCount > 0) {
					hoisted.destroyRejectCount--
				}
				return Promise.reject(new Error('destroy failed'))
			}

			recordEffect()
			return Promise.resolve()
		})
		enableStatistics = vi.fn()
		disableStatistics = vi.fn()
		updateLogConfig = vi.fn()

		constructor(port: any, options: any) {
			super()
			this.port = port
			this.options = options
			hoisted.drivers.push(this)
		}
	}

	return { ...actual, Driver: FakeDriver }
})

// @zwave-js/server stub so the lazy fallback ZwaveServerManager never binds a real port
vi.mock('@zwave-js/server', async () => {
	const { EventEmitter } = await import('node:events')
	class ZwavejsServerMock extends EventEmitter {
		server: any = undefined
		start = vi.fn(() => {
			this.server = {}
			return Promise.resolve()
		})
		destroy = vi.fn(() => Promise.resolve())
		constructor(
			public driver: any,
			public options: any,
		) {
			super()
		}
	}
	return { serverVersion: '0.0.0-test', ZwavejsServer: ZwavejsServerMock }
})

// JSON log transport fake whose `.stream` we can drive to exercise the production stream.on('data') → host.emitDebug wiring
vi.mock('@zwave-js/log-transport-json', async () => {
	const { EventEmitter } = await import('node:events')
	class JSONTransportMock {
		format: any = undefined
		stream = new EventEmitter()
		constructor() {
			hoisted.logTransports.push(this)
		}
	}
	return { JSONTransport: JSONTransportMock }
})

// Stub only utils.ensureDir to avoid a real mkdir and to hook the generation mid-await; every other util stays real
vi.mock('../../../api/lib/utils.ts', async () => {
	const actual = await vi.importActual<any>('../../../api/lib/utils.ts')
	return {
		...actual,
		ensureDir: vi.fn(() => {
			hoisted.ensureDirHook?.()
			return Promise.resolve()
		}),
		buildLogConfig: vi.fn((...args: any[]) =>
			hoisted.buildLogConfigOverride
				? hoisted.buildLogConfigOverride()
				: actual.buildLogConfig(...args),
		),
	}
})

// Import after the mocks are registered
const { DriverLifecycle } = await import(
	'../../../api/lib/zwave/DriverLifecycle.ts'
)

interface HarnessState {
	cfg: ZwaveConfig
	driver: any
	driverReady: boolean
	driverReadyRaw: boolean
	closed: boolean
	destroyed: boolean
	status: ZwaveClientStatus | undefined
	connectedClients: boolean
	userCallbacks: InclusionUserCallbacks
}

function createHarness(cfgOverrides: Partial<ZwaveConfig> = {}) {
	const state: HarnessState = {
		cfg: {
			enabled: true,
			port: 'tcp://localhost:5555',
			...cfgOverrides,
		} as ZwaveConfig,
		driver: null,
		driverReady: false,
		driverReadyRaw: false,
		closed: false,
		destroyed: false,
		status: undefined,
		connectedClients: false,
		userCallbacks: {} as InclusionUserCallbacks,
	}

	const serverHost = {
		getDriver: () => state.driver,
		getConfig: () => state.cfg,
		getHasUserCallbacks: () => false,
		onHardReset: vi.fn(),
		logger: {
			error: vi.fn(),
			warn: vi.fn(),
			info: vi.fn(),
			debug: vi.fn(),
		},
		serverLogger: {
			error: vi.fn(),
			warn: vi.fn(),
			info: vi.fn(),
			debug: vi.fn(),
		},
	}

	const host: DriverLifecycleHost = {
		getConfig: () => state.cfg,
		getDriver: () => state.driver,
		setDriver: (d) => {
			state.driver = d
		},
		isDriverReady: () => state.driverReady,
		isDriverReadyRaw: () => state.driverReadyRaw,
		isClosed: () => state.closed,
		setClosed: (c) => {
			state.closed = c
		},
		isDestroyed: () => state.destroyed,
		setStatus: (s) => {
			state.status = s
		},
		setDriverReady: (r) => {
			state.driverReady = r
		},
		hasConnectedClients: vi.fn(() =>
			Promise.resolve(state.connectedClients),
		),
		emitDebug: vi.fn(),
		getInclusionUserCallbacks: vi.fn(() => state.userCallbacks),
		installUserCallbacks: vi.fn(),
		persistConfig: vi.fn(async () => {}),
		restart: vi.fn(async () => {}),
		buildServerHost: vi.fn(() => serverHost as any),
		clearRuntimeOnClose: vi.fn(),
		finalizeClose: vi.fn(),
		onDriverReady: vi.fn(async () => {}),
		onDriverError: vi.fn(),
		onScanComplete: vi.fn(),
		onBootLoaderReady: vi.fn(),
		onOTWFirmwareUpdateProgress: vi.fn(),
		onOTWFirmwareUpdateFinished: vi.fn(),
	}

	const lifecycle = new DriverLifecycle(host)
	return { lifecycle, host, state, serverHost }
}

/** Fake adopted server manager that records its destroy into the order log */
function fakeManager() {
	return {
		create: vi.fn(),
		startIfNeeded: vi.fn(),
		destroy: vi.fn(() => {
			hoisted.destroyOrder.push('server')
			return Promise.resolve()
		}),
		server: null as any,
	}
}

const flush = () => Promise.resolve()

/** Pump the microtask queue until pred() holds; deterministic since every awaited step resolves synchronously (no timers) */
async function until(pred: () => boolean, max = 100): Promise<void> {
	for (let i = 0; i < max; i++) {
		if (pred()) return
		await Promise.resolve()
	}
	if (!pred()) {
		throw new Error('until(): condition was not met')
	}
}

beforeEach(() => {
	hoisted.drivers.length = 0
	hoisted.destroyOrder.length = 0
	hoisted.startBehavior = 'resolve'
	hoisted.startError = new Error('start failed')
	hoisted.startDeferreds.length = 0
	hoisted.startHook = null
	hoisted.ensureDirHook = null
	hoisted.destroyRejects = false
	hoisted.destroyBehavior = 'resolve'
	hoisted.destroyDeferreds.length = 0
	hoisted.destroyRejectCount = 0
	hoisted.destroyInvocations = 0
	hoisted.logTransports.length = 0
	hoisted.buildLogConfigOverride = null
	delete process.env.ZWAVE_PORT
})

describe('DriverLifecycle — @zwave-js/server coordination', () => {
	it('adoptServerManager stores the manager and serverManager returns it', () => {
		const { lifecycle } = createHarness()
		const mgr = fakeManager()
		expect(lifecycle.serverManager).toBeUndefined()
		lifecycle.adoptServerManager(mgr as any)
		expect(lifecycle.serverManager).toBe(mgr)
		expect(lifecycle.zwaveServer).toBe(mgr)
	})

	it('zwaveServer lazily builds a fallback manager once and caches it', () => {
		const { lifecycle, host } = createHarness()
		const first = lifecycle.zwaveServer
		expect(first).toBeDefined()
		expect(lifecycle.zwaveServer).toBe(first)
		expect(host.buildServerHost).toHaveBeenCalledTimes(1)
	})

	it('server get/set delegate through the (lazy) manager', () => {
		const { lifecycle } = createHarness()
		const sentinel = {} as any
		lifecycle.server = sentinel
		expect(lifecycle.server).toBe(sentinel)
	})

	it('createServer() calls create() on the current manager', () => {
		const { lifecycle } = createHarness()
		const mgr = fakeManager()
		lifecycle.adoptServerManager(mgr as any)
		lifecycle.createServer()
		expect(mgr.create).toHaveBeenCalledTimes(1)
	})
})

describe('DriverLifecycle — statistics', () => {
	it('enableStatistics enables on the driver and always warns', () => {
		const { lifecycle, state } = createHarness({ serverEnabled: false })
		const driver = { enableStatistics: vi.fn() }
		state.driver = driver
		lifecycle.enableStatistics()
		expect(driver.enableStatistics).toHaveBeenCalledTimes(1)
		const arg = driver.enableStatistics.mock.calls[0][0]
		expect(arg.applicationName).not.toContain('zwave-js-server')
	})

	it('enableStatistics applicationName includes zwave-js-server when serverEnabled', () => {
		const { lifecycle, state } = createHarness({ serverEnabled: true })
		const driver = { enableStatistics: vi.fn() }
		state.driver = driver
		lifecycle.enableStatistics()
		const arg = driver.enableStatistics.mock.calls[0][0]
		expect(arg.applicationName).toContain('zwave-js-server')
	})

	it('enableStatistics with no driver does not throw', () => {
		const { lifecycle } = createHarness()
		expect(() => lifecycle.enableStatistics()).not.toThrow()
	})

	it('disableStatistics disables on the driver', () => {
		const { lifecycle, state } = createHarness()
		const driver = { disableStatistics: vi.fn() }
		state.driver = driver
		lifecycle.disableStatistics()
		expect(driver.disableStatistics).toHaveBeenCalledTimes(1)
	})

	it('disableStatistics with no driver does not throw', () => {
		const { lifecycle } = createHarness()
		expect(() => lifecycle.disableStatistics()).not.toThrow()
	})
})

describe('DriverLifecycle — extra log transports', () => {
	// Connect first so the JSON-socket transport exists; updateLogConfig({transports}) replaces the whole list, so every apply re-sends it plus all current extras
	async function connectedReadyHarness(cfgOverrides: any = {}) {
		const harness = createHarness({ serverEnabled: false, ...cfgOverrides })
		await harness.lifecycle.connect()
		const json = hoisted.logTransports[0]
		const driver = harness.state.driver
		harness.state.driverReadyRaw = true
		driver.updateLogConfig.mockClear()
		return { ...harness, json, driver }
	}

	it('addExtraLogTransport sends the COMPLETE transport list (JSON socket + extra) and raises the level', async () => {
		const { lifecycle, json, driver } = await connectedReadyHarness()
		const extra = { id: 't1' }
		lifecycle.addExtraLogTransport(extra, 'debug')
		expect(driver.updateLogConfig).toHaveBeenCalledTimes(1)
		expect(driver.updateLogConfig).toHaveBeenCalledWith({
			transports: [json, extra],
			level: 'debug',
		})
	})

	it('addExtraLogTransport without a level keeps the configured baseline level and still retains the JSON transport', async () => {
		const { lifecycle, json, driver } = await connectedReadyHarness()
		const extra = { id: 't2' }
		lifecycle.addExtraLogTransport(extra)
		expect(driver.updateLogConfig).toHaveBeenCalledWith({
			transports: [json, extra],
			level: 'info',
		})
	})

	it('multiple extras with different levels: full list retained and the MOST verbose level wins', async () => {
		const { lifecycle, json, driver } = await connectedReadyHarness()
		const a = { id: 'a' }
		const b = { id: 'b' }
		const c = { id: 'c' }
		lifecycle.addExtraLogTransport(a, 'warn')
		lifecycle.addExtraLogTransport(b, 'silly')
		lifecycle.addExtraLogTransport(c, 'verbose')
		expect(driver.updateLogConfig).toHaveBeenLastCalledWith({
			transports: [json, a, b, c],
			level: 'silly',
		})
	})

	it('removeExtraLogTransport re-sends the remaining transports (never empties the list) and restores the baseline level', async () => {
		const { lifecycle, json, driver } = await connectedReadyHarness()
		const keep = { id: 'keep' }
		const temp = { id: 'temp-debug' }
		lifecycle.addExtraLogTransport(keep, 'info')
		lifecycle.addExtraLogTransport(temp, 'debug')
		driver.updateLogConfig.mockClear()

		lifecycle.removeExtraLogTransport(temp)
		expect(driver.updateLogConfig).toHaveBeenCalledTimes(1)
		expect(driver.updateLogConfig).toHaveBeenCalledWith({
			transports: [json, keep],
			level: 'info',
		})
	})

	it('removing the LAST extra still re-sends the required JSON transport (not an empty array) at the baseline level', async () => {
		const { lifecycle, json, driver } = await connectedReadyHarness()
		const temp = { id: 'only' }
		lifecycle.addExtraLogTransport(temp, 'debug')
		driver.updateLogConfig.mockClear()
		lifecycle.removeExtraLogTransport(temp)
		expect(driver.updateLogConfig).toHaveBeenCalledWith({
			transports: [json],
			level: 'info',
		})
	})

	it('removal order does not matter: the level tracks the most verbose REMAINING extra', async () => {
		const { lifecycle, json, driver } = await connectedReadyHarness()
		const warnT = { id: 'warn' }
		const debugT = { id: 'debug' }
		lifecycle.addExtraLogTransport(warnT, 'warn')
		lifecycle.addExtraLogTransport(debugT, 'debug')

		lifecycle.removeExtraLogTransport(warnT)
		expect(driver.updateLogConfig).toHaveBeenLastCalledWith({
			transports: [json, debugT],
			level: 'debug',
		})

		lifecycle.removeExtraLogTransport(debugT)
		expect(driver.updateLogConfig).toHaveBeenLastCalledWith({
			transports: [json],
			level: 'info',
		})
	})

	it('a configured non-default level is the floor: adding a LESS verbose extra does not lower it', async () => {
		const { lifecycle, json, driver } = await connectedReadyHarness({
			logLevel: 'info',
			options: { logConfig: { level: 'verbose' } } as any,
		})
		const extra = { id: 'quiet' }
		lifecycle.addExtraLogTransport(extra, 'warn')
		expect(driver.updateLogConfig).toHaveBeenCalledWith({
			transports: [json, extra],
			level: 'verbose',
		})
	})

	it('addExtraLogTransport does not touch the driver when it is not ready (registration still persists)', async () => {
		const { lifecycle, state } = createHarness({ serverEnabled: false })
		await lifecycle.connect()
		const driver = state.driver
		state.driverReadyRaw = false
		driver.updateLogConfig.mockClear()
		lifecycle.addExtraLogTransport({ id: 't3' }, 'debug')
		expect(driver.updateLogConfig).not.toHaveBeenCalled()

		state.driverReadyRaw = true
		lifecycle.removeExtraLogTransport({ id: 'unknown' })
		expect(driver.updateLogConfig).toHaveBeenCalledWith({
			transports: [
				hoisted.logTransports[0],
				expect.objectContaining({ id: 't3' }),
			],
			level: 'debug',
		})
	})

	it('before connect there is no driver and add/remove are inert no-ops', () => {
		const { lifecycle } = createHarness({ serverEnabled: false })
		expect(() =>
			lifecycle.addExtraLogTransport({ id: 'pre' }, 'debug'),
		).not.toThrow()
		expect(() =>
			lifecycle.removeExtraLogTransport({ id: 'pre' }),
		).not.toThrow()
	})
})

describe('DriverLifecycle — backoff restart & checkIfDestroyed', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	it('backoffRestart schedules restart with exponential delay and increments the retry', async () => {
		const { lifecycle, host } = createHarness()
		lifecycle.backoffRestart()
		expect(host.restart).not.toHaveBeenCalled()
		await vi.advanceTimersByTimeAsync(1000)
		expect(host.restart).toHaveBeenCalledTimes(1)

		lifecycle.backoffRestart()
		await vi.advanceTimersByTimeAsync(1999)
		expect(host.restart).toHaveBeenCalledTimes(1)
		await vi.advanceTimersByTimeAsync(1)
		expect(host.restart).toHaveBeenCalledTimes(2)
	})

	it('resetBackoff resets the exponential counter back to the first delay', async () => {
		const { lifecycle, host } = createHarness()
		lifecycle.backoffRestart()
		await vi.advanceTimersByTimeAsync(1000)
		lifecycle.backoffRestart()
		await vi.advanceTimersByTimeAsync(2000)
		expect(host.restart).toHaveBeenCalledTimes(2)

		lifecycle.resetBackoff()
		lifecycle.backoffRestart()
		await vi.advanceTimersByTimeAsync(1000)
		expect(host.restart).toHaveBeenCalledTimes(3)
	})

	it('backoffRestart aborts (and closes) when the client is already destroyed', async () => {
		const { lifecycle, host, state } = createHarness()
		state.destroyed = true
		lifecycle.backoffRestart()
		await vi.advanceTimersByTimeAsync(20000)
		expect(host.restart).not.toHaveBeenCalled()
		expect(host.setStatus).toBeDefined()
		expect(state.status).toBe(ZwaveClientStatus.CLOSED)
	})

	it('checkIfDestroyed returns true and closes when destroyed', () => {
		const { lifecycle, state, host } = createHarness()
		state.destroyed = true
		expect(lifecycle.checkIfDestroyed()).toBe(true)
		expect(host.setClosed).toBeDefined()
		expect(state.closed).toBe(true)
	})

	it('checkIfDestroyed returns false when not destroyed', () => {
		const { lifecycle } = createHarness()
		expect(lifecycle.checkIfDestroyed()).toBe(false)
	})
})

describe('DriverLifecycle — backoff restart coalescing & fencing', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	it('coalesces two backoff schedules made before firing into a single restart (latest delay wins)', async () => {
		const { lifecycle, host } = createHarness()

		lifecycle.backoffRestart()
		lifecycle.backoffRestart()

		await vi.advanceTimersByTimeAsync(1000)
		expect(host.restart).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(1000)
		expect(host.restart).toHaveBeenCalledTimes(1)

		await vi.advanceTimersByTimeAsync(60000)
		expect(host.restart).toHaveBeenCalledTimes(1)
	})

	it('a healthy replacement (new generation) fences a still-pending backoff restart', async () => {
		const { lifecycle, host } = createHarness({ serverEnabled: false })

		lifecycle.backoffRestart()

		// Connecting bumps the generation but does not clear the pending timer, so only the generation fence stops the stale restart
		await lifecycle.connect()
		expect(lifecycle.generation).toBe(1)

		await vi.advanceTimersByTimeAsync(60000)
		expect(host.restart).not.toHaveBeenCalled()
	})

	it('close() clears a pending backoff restart so it never fires', async () => {
		const { lifecycle, host } = createHarness({ serverEnabled: false })

		lifecycle.backoffRestart()
		await lifecycle.close()

		await vi.advanceTimersByTimeAsync(60000)
		expect(host.restart).not.toHaveBeenCalled()
	})
})

describe('DriverLifecycle — connect early returns', () => {
	it('does nothing when the driver is disabled', async () => {
		const { lifecycle } = createHarness({ enabled: false })
		await lifecycle.connect()
		expect(hoisted.drivers).toHaveLength(0)
		expect(lifecycle.generation).toBe(0)
	})

	it('does nothing when a driver is already ready', async () => {
		const { lifecycle, state } = createHarness()
		state.driverReady = true
		await lifecycle.connect()
		expect(hoisted.drivers).toHaveLength(0)
	})

	it('does nothing when the client is already closed', async () => {
		const { lifecycle, state } = createHarness()
		state.closed = true
		await lifecycle.connect()
		expect(hoisted.drivers).toHaveLength(0)
	})

	it('does nothing when no port is configured', async () => {
		const { lifecycle } = createHarness({ port: undefined })
		await lifecycle.connect()
		expect(hoisted.drivers).toHaveLength(0)
		expect(lifecycle.generation).toBe(0)
	})

	it('honours the ZWAVE_PORT env override (force-enables + overrides port)', async () => {
		process.env.ZWAVE_PORT = 'tcp://override:5555'
		const { lifecycle, state } = createHarness({ enabled: false })
		await lifecycle.connect()
		expect(state.cfg.enabled).toBe(true)
		expect(state.cfg.port).toBe('tcp://override:5555')
		expect(hoisted.drivers).toHaveLength(1)
		expect(hoisted.drivers[0].port).toBe('tcp://override:5555')
	})
})

describe('DriverLifecycle — connect happy path', () => {
	it('creates a driver, wires all six events, starts it and sets CONNECTED', async () => {
		const { lifecycle, state } = createHarness({ serverEnabled: false })
		await lifecycle.connect()

		expect(lifecycle.generation).toBe(1)
		expect(hoisted.drivers).toHaveLength(1)
		const driver = hoisted.drivers[0]
		expect(driver.start).toHaveBeenCalledTimes(1)
		expect(state.driver).toBe(driver)
		expect(state.status).toBe(ZwaveClientStatus.CONNECTED)
		for (const evt of [
			'error',
			'driver ready',
			'all nodes ready',
			'bootloader ready',
			'firmware update progress',
			'firmware update finished',
		]) {
			expect(driver.listenerCount(evt)).toBe(1)
		}
	})

	it('installs user callbacks only when clients are connected', async () => {
		const { lifecycle, host, state } = createHarness()
		state.connectedClients = true
		await lifecycle.connect()
		expect(host.installUserCallbacks).toHaveBeenCalledTimes(1)
	})

	it('does NOT install user callbacks when no clients are connected', async () => {
		const { lifecycle, host, state } = createHarness()
		state.connectedClients = false
		await lifecycle.connect()
		expect(host.installUserCallbacks).not.toHaveBeenCalled()
	})

	it('creates the server when serverEnabled', async () => {
		const { lifecycle } = createHarness({ serverEnabled: true })
		const mgr = fakeManager()
		lifecycle.adoptServerManager(mgr as any)
		await lifecycle.connect()
		expect(mgr.create).toHaveBeenCalledTimes(1)
	})

	it('enables statistics on connect when configured', async () => {
		const { lifecycle } = createHarness({
			serverEnabled: false,
			enableStatistics: true,
		})
		await lifecycle.connect()
		expect(hoisted.drivers[0].enableStatistics).toHaveBeenCalledTimes(1)
	})

	it('passes the inclusion user callbacks into driver options when server disabled', async () => {
		const { lifecycle, host } = createHarness({ serverEnabled: false })
		await lifecycle.connect()
		expect(host.getInclusionUserCallbacks).toHaveBeenCalled()
		expect(hoisted.drivers[0].options.inclusionUserCallbacks).toBeDefined()
	})

	it('does not pass inclusion user callbacks when the server is enabled', async () => {
		const { lifecycle } = createHarness({ serverEnabled: true })
		const mgr = fakeManager()
		lifecycle.adoptServerManager(mgr as any)
		await lifecycle.connect()
		expect(
			hoisted.drivers[0].options.inclusionUserCallbacks,
		).toBeUndefined()
	})

	it('applies the soft-reset feature flag when explicitly configured', async () => {
		const { lifecycle } = createHarness({
			serverEnabled: false,
			enableSoftReset: false,
		})
		await lifecycle.connect()
		expect(hoisted.drivers[0].options.features.softReset).toBe(false)
	})

	it('maps rf auto power levels when autoPowerlevels is inferred true', async () => {
		const { lifecycle, host } = createHarness({
			serverEnabled: false,
			rf: { region: 1 } as any,
		})
		await lifecycle.connect()
		const rf = hoisted.drivers[0].options.rf
		expect(rf.region).toBe(1)
		expect(rf.maxLongRangePowerlevel).toBe('auto')
		expect(rf.txPower.powerlevel).toBe('auto')
		expect(host.persistConfig).toHaveBeenCalled()
	})

	it('maps explicit rf power levels when autoPowerlevels is false', async () => {
		const { lifecycle } = createHarness({
			serverEnabled: false,
			rf: {
				region: 2,
				autoPowerlevels: false,
				maxLongRangePowerlevel: 10,
				txPower: { powerlevel: 5, measured0dBm: 1 },
			} as any,
		})
		await lifecycle.connect()
		const rf = hoisted.drivers[0].options.rf
		expect(rf.maxLongRangePowerlevel).toBe(10)
		expect(rf.txPower.powerlevel).toBe(5)
		expect(rf.txPower.measured0dBm).toBe(1)
	})

	it('migrates a legacy networkKey to securityKeys.S0_Legacy and persists', async () => {
		const { lifecycle, host, state } = createHarness({
			serverEnabled: false,
			networkKey: '0102030405060708090A0B0C0D0E0F10',
		} as any)
		await lifecycle.connect()
		expect(state.cfg.securityKeys?.S0_Legacy).toBe(
			'0102030405060708090A0B0C0D0E0F10',
		)
		expect((state.cfg as any).networkKey).toBeUndefined()
		expect(host.persistConfig).toHaveBeenCalled()
	})

	it('merges hidden cfg.options into the driver options', async () => {
		const { lifecycle } = createHarness({
			serverEnabled: false,
			options: { testMarker: 42 } as any,
		})
		await lifecycle.connect()
		expect(hoisted.drivers[0].options.testMarker).toBe(42)
	})
})

describe('DriverLifecycle — connect error handling', () => {
	it('on a generic start failure: destroys the driver, reports the error and backs off', async () => {
		vi.useFakeTimers()
		try {
			const { lifecycle, host } = createHarness({ serverEnabled: false })
			hoisted.startBehavior = 'reject'
			hoisted.startError = new Error('boom')
			await lifecycle.connect()
			expect(hoisted.drivers[0].destroy).toHaveBeenCalled()
			expect(host.onDriverError).toHaveBeenCalledWith(
				expect.any(Error),
				true,
			)
			await vi.advanceTimersByTimeAsync(1000)
			expect(host.restart).toHaveBeenCalledTimes(1)
		} finally {
			vi.useRealTimers()
		}
	})

	it('on Driver_InvalidOptions: reports the error but does NOT back off', async () => {
		vi.useFakeTimers()
		try {
			const { lifecycle, host } = createHarness({ serverEnabled: false })
			hoisted.startBehavior = 'reject'
			hoisted.startError = new ZWaveError(
				'bad options',
				ZWaveErrorCodes.Driver_InvalidOptions,
			)
			await lifecycle.connect()
			expect(host.onDriverError).toHaveBeenCalledWith(
				expect.any(ZWaveError),
				true,
			)
			await vi.advanceTimersByTimeAsync(20000)
			expect(host.restart).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})
})

describe('DriverLifecycle — connect generation fencing', () => {
	it('aborts before driver creation when the generation changes during ensureDir', async () => {
		const { lifecycle, state } = createHarness()
		hoisted.ensureDirHook = () => {
			void lifecycle.close()
		}
		await lifecycle.connect()
		expect(hoisted.drivers).toHaveLength(0)
		expect(state.status).toBe(ZwaveClientStatus.CLOSED)
	})

	it('aborts before driver.start when the generation changes during hasConnectedClients', async () => {
		const { lifecycle, host } = createHarness()
		;(host.hasConnectedClients as any).mockImplementation(() => {
			void lifecycle.close()
			return Promise.resolve(false)
		})
		await lifecycle.connect()
		expect(hoisted.drivers).toHaveLength(1)
		expect(hoisted.drivers[0].start).not.toHaveBeenCalled()
	})

	it('aborts after driver.start when the generation changes during start()', async () => {
		const { lifecycle, state } = createHarness({ serverEnabled: false })
		hoisted.startHook = () => {
			void lifecycle.close()
		}
		await lifecycle.connect()
		expect(hoisted.drivers[0].start).toHaveBeenCalled()
		expect(state.status).toBe(ZwaveClientStatus.CLOSED)
	})

	it('aborts when the generation changes during persistConfig', async () => {
		const { lifecycle, host } = createHarness({
			serverEnabled: false,
			rf: { region: 1 } as any,
		})
		;(host.persistConfig as any).mockImplementation(() => {
			void lifecycle.close()
			return Promise.resolve()
		})
		await lifecycle.connect()
		expect(hoisted.drivers).toHaveLength(0)
	})
})

describe('DriverLifecycle — pre-ready reconnect coalescing', () => {
	it('a second connect after start() resolves but before driver ready does NOT construct or leak a replacement', async () => {
		const { lifecycle, state } = createHarness({ serverEnabled: false })

		await lifecycle.connect()
		expect(hoisted.drivers).toHaveLength(1)
		const driver0 = hoisted.drivers[0]
		expect(state.driver).toBe(driver0)
		expect(state.status).toBe(ZwaveClientStatus.CONNECTED)
		expect(state.driverReady).toBe(false)
		const genAfterFirst = lifecycle.generation

		await lifecycle.connect()

		expect(hoisted.drivers).toHaveLength(1)
		expect(state.driver).toBe(driver0)
		expect(driver0.destroy).not.toHaveBeenCalled()
		expect(lifecycle.generation).toBe(genAfterFirst)
	})

	it('coalesces a second connect while the first is still awaiting driver.start(): it stays PENDING until the first settles, then settles together', async () => {
		const { lifecycle, state } = createHarness({ serverEnabled: false })
		hoisted.startBehavior = 'deferred'

		const first = lifecycle.connect()
		await until(() => hoisted.startDeferreds.length === 1)
		expect(hoisted.drivers).toHaveLength(1)
		const driver0 = hoisted.drivers[0]
		const gen = lifecycle.generation

		let firstSettled = false
		let secondSettled = false
		void first.then(() => {
			firstSettled = true
		})
		const second = lifecycle.connect()
		void second.then(() => {
			secondSettled = true
		})

		await until(() => hoisted.startDeferreds.length === 1)
		expect(hoisted.drivers).toHaveLength(1)
		expect(hoisted.startDeferreds).toHaveLength(1)
		expect(state.driver).toBe(driver0)
		expect(lifecycle.generation).toBe(gen)
		expect(driver0.start).toHaveBeenCalledTimes(1)
		expect(firstSettled).toBe(false)
		expect(secondSettled).toBe(false)

		hoisted.startDeferreds[0].resolve()
		await Promise.all([first, second])
		expect(firstSettled).toBe(true)
		expect(secondSettled).toBe(true)
		expect(state.status).toBe(ZwaveClientStatus.CONNECTED)
		expect(hoisted.drivers).toHaveLength(1)
		expect(driver0.destroy).not.toHaveBeenCalled()
	})

	it('a coalesced duplicate connect shares the first connect FAILURE settlement (start rejects) and no second Driver is built', async () => {
		const { lifecycle, state, host } = createHarness({
			serverEnabled: false,
		})
		hoisted.startBehavior = 'deferred'

		const first = lifecycle.connect()
		await until(() => hoisted.startDeferreds.length === 1)
		const driver0 = hoisted.drivers[0]

		let firstSettled = false
		let secondSettled = false
		void first.then(() => {
			firstSettled = true
		})
		const second = lifecycle.connect()
		void second.then(() => {
			secondSettled = true
		})
		await until(() => hoisted.startDeferreds.length === 1)
		expect(firstSettled).toBe(false)
		expect(secondSettled).toBe(false)

		hoisted.startDeferreds[0].reject(new Error('start failed'))
		await expect(Promise.all([first, second])).resolves.toBeDefined()
		expect(firstSettled).toBe(true)
		expect(secondSettled).toBe(true)
		expect(hoisted.drivers).toHaveLength(1)
		expect(driver0.destroy).toHaveBeenCalledTimes(1)
		expect(state.driver).toBeNull()
		expect(host.onDriverError).toHaveBeenCalledTimes(1)
	})

	it('a duplicate connect AFTER the first start settled but BEFORE driver ready returns compatibly without a replacement', async () => {
		const { lifecycle, state } = createHarness({ serverEnabled: false })

		await lifecycle.connect()
		const driver0 = hoisted.drivers[0]
		const gen = lifecycle.generation
		expect(state.status).toBe(ZwaveClientStatus.CONNECTED)
		expect(state.driverReady).toBe(false)

		await lifecycle.connect()
		expect(hoisted.drivers).toHaveLength(1)
		expect(state.driver).toBe(driver0)
		expect(driver0.destroy).not.toHaveBeenCalled()
		expect(lifecycle.generation).toBe(gen)
	})

	it('a recovery reconnect after a start failure is NOT coalesced (host cleared) and builds exactly one fresh driver', async () => {
		const { lifecycle, state } = createHarness({ serverEnabled: false })

		hoisted.startBehavior = 'reject'
		await lifecycle.connect()
		expect(hoisted.drivers).toHaveLength(1)
		expect(hoisted.drivers[0].destroy).toHaveBeenCalledTimes(1)
		expect(state.driver).toBeNull()

		await lifecycle.close(true)
		state.closed = false

		hoisted.startBehavior = 'resolve'
		await lifecycle.connect()

		expect(hoisted.drivers).toHaveLength(2)
		expect(state.driver).toBe(hoisted.drivers[1])
		expect(state.status).toBe(ZwaveClientStatus.CONNECTED)
	})

	async function openCloseReconnectWithStale() {
		const harness = createHarness({ serverEnabled: false })
		hoisted.startBehavior = 'deferred'

		const stalePromise = harness.lifecycle.connect()
		await until(() => hoisted.startDeferreds.length === 1)
		const driver0 = hoisted.drivers[0]
		expect(harness.state.driver).toBe(driver0)

		await harness.lifecycle.close(true)
		expect(harness.state.driver).toBeNull()
		harness.state.closed = false

		hoisted.startBehavior = 'deferred'
		const freshPromise = harness.lifecycle.connect()
		await until(() => hoisted.startDeferreds.length === 2)
		const driver1 = hoisted.drivers[1]
		hoisted.startDeferreds[1].resolve()
		await freshPromise
		expect(harness.state.driver).toBe(driver1)
		expect(harness.state.status).toBe(ZwaveClientStatus.CONNECTED)

		return { ...harness, stalePromise, driver0, driver1 }
	}

	it('a stale start that RESOLVES after a close+reconnect tears down only its own driver', async () => {
		const { state, stalePromise, driver0, driver1 } =
			await openCloseReconnectWithStale()

		hoisted.startDeferreds[0].resolve()
		await stalePromise

		expect(hoisted.destroyOrder.filter((d) => d === 'driver')).toHaveLength(
			1,
		)
		expect(driver1.destroy).not.toHaveBeenCalled()
		expect(state.driver).toBe(driver1)
	})

	it('a stale start that REJECTS after a close+reconnect never destroys the replacement or backs off', async () => {
		const { host, state, stalePromise, driver0, driver1 } =
			await openCloseReconnectWithStale()

		hoisted.startDeferreds[0].reject(new Error('late start failure'))
		await stalePromise

		expect(hoisted.destroyOrder.filter((d) => d === 'driver')).toHaveLength(
			1,
		)
		expect(driver1.destroy).not.toHaveBeenCalled()
		expect(state.driver).toBe(driver1)
		expect(host.onDriverError).not.toHaveBeenCalled()
		expect(host.restart).not.toHaveBeenCalled()
		void driver0
	})
})

describe('DriverLifecycle — failed-connect teardown ownership', () => {
	it('awaits the failed driver destroy before clearing the host or backing off (no replacement built while the owner is torn down)', async () => {
		vi.useFakeTimers()
		try {
			const { lifecycle, state, host } = createHarness({
				serverEnabled: false,
			})
			hoisted.startBehavior = 'reject'
			hoisted.startError = new Error('start boom')
			hoisted.destroyBehavior = 'deferred'

			const connectP = lifecycle.connect()

			await until(() => hoisted.destroyDeferreds.length === 1)
			expect(hoisted.drivers).toHaveLength(1)
			const driver0 = hoisted.drivers[0]
			expect(state.driver).toBe(driver0)
			expect(host.onDriverError).not.toHaveBeenCalled()
			expect(host.restart).not.toHaveBeenCalled()

			const concurrent = lifecycle.connect()
			await until(() => hoisted.destroyDeferreds.length === 1)
			expect(hoisted.drivers).toHaveLength(1)
			expect(driver0.start).toHaveBeenCalledTimes(1)

			hoisted.destroyDeferreds[0].resolve()
			await connectP
			await concurrent
			expect(state.driver).toBeNull()
			expect(hoisted.destroyOrder).toEqual(['driver'])
			expect(host.onDriverError).toHaveBeenCalledTimes(1)
			expect(host.onDriverError).toHaveBeenCalledWith(
				expect.any(Error),
				true,
			)
			await vi.advanceTimersByTimeAsync(1000)
			expect(host.restart).toHaveBeenCalledTimes(1)
			expect(hoisted.drivers).toHaveLength(1)
		} finally {
			vi.useRealTimers()
		}
	})

	it('retains the exact owner when destroy REJECTS and lets a later close retry the cleanup (no leak, no wrong destroy)', async () => {
		vi.useFakeTimers()
		try {
			const { lifecycle, state, host } = createHarness({
				serverEnabled: false,
			})
			hoisted.startBehavior = 'reject'
			hoisted.startError = new Error('start boom')
			hoisted.destroyRejectCount = 1

			await lifecycle.connect()
			const driver0 = hoisted.drivers[0]

			expect(hoisted.drivers).toHaveLength(1)
			expect(state.driver).toBe(driver0)
			expect(hoisted.destroyInvocations).toBe(1)
			expect(hoisted.destroyOrder).toEqual([])
			expect(host.onDriverError).toHaveBeenCalledTimes(1)

			await lifecycle.close(true)
			expect(hoisted.destroyInvocations).toBe(2)
			expect(hoisted.destroyOrder).toEqual(['driver'])
			expect(state.driver).toBeNull()
			expect(hoisted.drivers).toHaveLength(1)
			expect(driver0.destroy).toHaveBeenCalledTimes(2)
		} finally {
			vi.useRealTimers()
		}
	})

	it('a stale post-start exit awaits teardown of its OWN instance and never destroys the live replacement, even with a delayed destroy', async () => {
		const { lifecycle, state } = createHarness({ serverEnabled: false })
		hoisted.startBehavior = 'deferred'

		const staleP = lifecycle.connect()
		await until(() => hoisted.startDeferreds.length === 1)
		const driver0 = hoisted.drivers[0]

		await lifecycle.close(true)
		state.closed = false
		hoisted.startBehavior = 'deferred'
		const freshP = lifecycle.connect()
		await until(() => hoisted.startDeferreds.length === 2)
		const driver1 = hoisted.drivers[1]
		hoisted.startDeferreds[1].resolve()
		await freshP
		expect(state.driver).toBe(driver1)

		hoisted.startDeferreds[0].resolve()
		await staleP

		expect(driver1.destroy).not.toHaveBeenCalled()
		expect(state.driver).toBe(driver1)
		expect(hoisted.destroyOrder.filter((d) => d === 'driver')).toHaveLength(
			1,
		)
		void driver0
	})
})

describe('DriverLifecycle — final logConfig override', () => {
	it('a documented zwave.options.logConfig override still receives the JSON transport, extra transports and bumped level', async () => {
		const { lifecycle } = createHarness({
			serverEnabled: false,
			options: { logConfig: { level: 'error' } } as any,
		})
		const extra = { id: 'extra-forwarder' }
		lifecycle.addExtraLogTransport(extra, 'debug')

		await lifecycle.connect()

		const passedLogConfig = hoisted.drivers[0].options.logConfig
		const jsonTransport = hoisted.logTransports[0]
		expect(jsonTransport).toBeDefined()
		expect(passedLogConfig.transports).toContain(jsonTransport)
		expect(passedLogConfig.transports).toContain(extra)
		expect(passedLogConfig.level).toBe('debug')
	})

	it('a zwave.options.logConfig override with no extra transports still receives the JSON transport', async () => {
		const { lifecycle } = createHarness({
			serverEnabled: false,
			options: { logConfig: { level: 'warn' } } as any,
		})

		await lifecycle.connect()

		const passedLogConfig = hoisted.drivers[0].options.logConfig
		const jsonTransport = hoisted.logTransports[0]
		expect(passedLogConfig.transports).toEqual([jsonTransport])
		expect(passedLogConfig.level).toBe('warn')
	})

	it('a driver built with NO logConfig object connects cleanly and leaves the base level unset', async () => {
		hoisted.buildLogConfigOverride = () => undefined
		const { lifecycle, state } = createHarness({ serverEnabled: false })

		await lifecycle.connect()

		expect(hoisted.drivers).toHaveLength(1)
		expect(hoisted.drivers[0].options.logConfig).toBeUndefined()
		expect(state.driver).toBe(hoisted.drivers[0])

		state.driverReadyRaw = true
		hoisted.drivers[0].updateLogConfig.mockClear()
		const extra = { id: 'x' }
		lifecycle.addExtraLogTransport(extra, 'warn')
		expect(hoisted.drivers[0].updateLogConfig).toHaveBeenCalledWith({
			transports: [hoisted.logTransports[0], extra],
			level: 'warn',
		})
	})

	it('a driver logConfig with a non-string level leaves the base level unset and never overwrites it', async () => {
		hoisted.buildLogConfigOverride = () => ({ level: 42 })
		const { lifecycle } = createHarness({ serverEnabled: false })

		await lifecycle.connect()

		const passedLogConfig = hoisted.drivers[0].options.logConfig
		expect(passedLogConfig.transports).toEqual([hoisted.logTransports[0]])
		expect(passedLogConfig.level).toBe(42)

		lifecycle['host'].isDriverReadyRaw = () => true
		hoisted.drivers[0].updateLogConfig.mockClear()
		const extra = { id: 'y' }
		lifecycle.addExtraLogTransport(extra, 'silly')
		expect(hoisted.drivers[0].updateLogConfig).toHaveBeenCalledWith({
			transports: [hoisted.logTransports[0], extra],
			level: 'silly',
		})
	})
})

describe('DriverLifecycle — logConfig source isolation', () => {
	it('does not mutate the persisted cfg.options.logConfig; the driver receives a distinct enriched clone', async () => {
		const { lifecycle, state } = createHarness({
			serverEnabled: false,
			options: {
				logConfig: { level: 'warn', maxFiles: 5 },
			} as any,
		})
		const source = (state.cfg as any).options.logConfig
		const sourceSnapshot = JSON.parse(JSON.stringify(source))
		const extra = { id: 'debug-forwarder' }
		lifecycle.addExtraLogTransport(extra, 'debug')

		await lifecycle.connect()

		const driverLogConfig = hoisted.drivers[0].options.logConfig
		expect(driverLogConfig).not.toBe(source)
		expect(driverLogConfig.transports).toContain(hoisted.logTransports[0])
		expect(driverLogConfig.transports).toContain(extra)
		expect(driverLogConfig.level).toBe('debug')

		expect((state.cfg as any).options.logConfig).toBe(source)
		expect(source).toEqual(sourceSnapshot)
		expect(source.transports).toBeUndefined()
		expect(source.level).toBe('warn')
	})

	it('removing a debug transport and restarting returns the driver to the configured level without leaking runtime transports', async () => {
		const { lifecycle, state } = createHarness({
			serverEnabled: false,
			options: { logConfig: { level: 'info' } } as any,
		})
		const source = (state.cfg as any).options.logConfig
		const sourceSnapshot = JSON.parse(JSON.stringify(source))
		const extra = { id: 'temp-debug' }

		lifecycle.addExtraLogTransport(extra, 'debug')
		await lifecycle.connect()
		expect(hoisted.drivers[0].options.logConfig.level).toBe('debug')
		expect(source).toEqual(sourceSnapshot)
		expect((state.cfg as any).options.logConfig).toBe(source)

		lifecycle.removeExtraLogTransport(extra)
		await lifecycle.close()
		state.closed = false
		await lifecycle.connect()

		const restarted = hoisted.drivers[1].options.logConfig
		expect(restarted.level).toBe('info')
		expect(restarted.transports).toEqual([hoisted.logTransports[1]])

		expect((state.cfg as any).options.logConfig).toBe(source)
		expect(source).toEqual(sourceSnapshot)
		expect(source.level).toBe('info')
	})
})

describe('DriverLifecycle — close', () => {
	it('bumps the generation, transitions to CLOSED and clears runtime state', async () => {
		const { lifecycle, host, state } = createHarness()
		await lifecycle.connect()
		const genBefore = lifecycle.generation
		await lifecycle.close()
		expect(lifecycle.generation).toBe(genBefore + 1)
		expect(state.status).toBe(ZwaveClientStatus.CLOSED)
		expect(state.closed).toBe(true)
		expect(state.driverReady).toBe(false)
		expect(host.clearRuntimeOnClose).toHaveBeenCalledTimes(1)
		expect(host.finalizeClose).toHaveBeenCalledTimes(1)
		expect(state.driver).toBeNull()
	})

	it('destroys the server BEFORE the driver', async () => {
		const { lifecycle } = createHarness({ serverEnabled: true })
		const mgr = fakeManager()
		lifecycle.adoptServerManager(mgr as any)
		await lifecycle.connect()
		await lifecycle.close()
		expect(hoisted.destroyOrder).toEqual(['server', 'driver'])
	})

	it('does not finalize (keep listeners) when keepListeners is true', async () => {
		const { lifecycle, host } = createHarness()
		await lifecycle.connect()
		await lifecycle.close(true)
		expect(host.finalizeClose).not.toHaveBeenCalled()
	})

	it('clears a pending backoff restart timer', async () => {
		vi.useFakeTimers()
		try {
			const { lifecycle, host } = createHarness()
			lifecycle.backoffRestart()
			await lifecycle.close()
			await vi.advanceTimersByTimeAsync(20000)
			expect(host.restart).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})

	it('is idempotent and safe to call with no driver or server', async () => {
		const { lifecycle } = createHarness()
		await expect(lifecycle.close()).resolves.toBeUndefined()
		await expect(lifecycle.close()).resolves.toBeUndefined()
		expect(hoisted.destroyOrder).toEqual([])
	})
})

describe('DriverLifecycle — driver-event dispatch', () => {
	it('forwards every driver event to the host with the current generation', async () => {
		const { lifecycle, host } = createHarness({ serverEnabled: false })
		await lifecycle.connect()
		const driver = hoisted.drivers[0]

		driver.emit('driver ready')
		await flush()
		expect(host.onDriverReady).toHaveBeenCalledWith(lifecycle.generation)

		const err = new Error('driver error')
		driver.emit('error', err)
		expect(host.onDriverError).toHaveBeenCalledWith(err, false)

		driver.emit('all nodes ready')
		expect(host.onScanComplete).toHaveBeenCalledTimes(1)

		driver.emit('bootloader ready')
		expect(host.onBootLoaderReady).toHaveBeenCalledTimes(1)

		const progress = { sentFragments: 1, totalFragments: 10 }
		driver.emit('firmware update progress', progress)
		expect(host.onOTWFirmwareUpdateProgress).toHaveBeenCalledWith(progress)

		const result = { success: true }
		driver.emit('firmware update finished', result)
		expect(host.onOTWFirmwareUpdateFinished).toHaveBeenCalledWith(result)
	})

	it('fences a LATE driver-ready from an obsolete generation after close()', async () => {
		const { lifecycle, host } = createHarness({ serverEnabled: false })
		await lifecycle.connect()
		const driver = hoisted.drivers[0]
		await lifecycle.close()

		host.onDriverReady = vi.fn(async () => {})
		driver.emit('driver ready')
		await flush()
		expect(host.onDriverReady).not.toHaveBeenCalled()
	})

	it('fences a late error/scan/bootloader/OTW callback after the generation moves on', async () => {
		const { lifecycle, host } = createHarness({ serverEnabled: false })
		await lifecycle.connect()
		const driver = hoisted.drivers[0]
		await lifecycle.close()

		driver.emit('error', new Error('late'))
		driver.emit('all nodes ready')
		driver.emit('bootloader ready')
		driver.emit('firmware update progress', {})
		driver.emit('firmware update finished', {})

		expect(host.onDriverError).not.toHaveBeenCalled()
		expect(host.onScanComplete).not.toHaveBeenCalled()
		expect(host.onBootLoaderReady).not.toHaveBeenCalled()
		expect(host.onOTWFirmwareUpdateProgress).not.toHaveBeenCalled()
		expect(host.onOTWFirmwareUpdateFinished).not.toHaveBeenCalled()
	})
})

describe('DriverLifecycle — connect option/edge coverage', () => {
	it('builds scale preferences from cfg.scales', async () => {
		const { lifecycle } = createHarness({
			serverEnabled: false,
			scales: [{ key: 1, label: 'Celsius' }] as any,
		})
		await lifecycle.connect()
		expect(hoisted.drivers[0].options.preferences).toEqual({
			scales: { 1: 'Celsius' },
		})
	})

	it('injects PkgFsBindings into driver host options when running in a pkg bundle', async () => {
		const proc = process as NodeJS.Process & { pkg?: unknown }
		proc.pkg = {}
		try {
			const { lifecycle } = createHarness({ serverEnabled: false })
			await lifecycle.connect()
			expect(hoisted.drivers[0].options.host?.fs).toBeDefined()
		} finally {
			delete proc.pkg
		}
	})

	it('merges registered extra log transports and bumps the log level to the most verbose', async () => {
		const { lifecycle } = createHarness({ serverEnabled: false })
		const t1 = { id: 'extra-1' }
		const t2 = { id: 'extra-2' }
		lifecycle.addExtraLogTransport(t1, 'warn')
		lifecycle.addExtraLogTransport(t2, 'silly')
		await lifecycle.connect()
		const logConfig = hoisted.drivers[0].options.logConfig
		expect(logConfig.transports).toContain(t1)
		expect(logConfig.transports).toContain(t2)
		expect(logConfig.level).toBe('silly')
	})

	it('forwards driver log stream data to host.emitDebug', async () => {
		const { lifecycle, host } = createHarness({ serverEnabled: false })
		await lifecycle.connect()
		const transport = hoisted.logTransports[0]
		expect(transport).toBeDefined()
		transport.stream.emit('data', { message: 'hello world' })
		expect(host.emitDebug).toHaveBeenCalledWith('hello world')
	})

	it('aborts after start() when the client became destroyed mid-start', async () => {
		const { lifecycle, state } = createHarness({ serverEnabled: false })
		hoisted.startHook = () => {
			state.destroyed = true
		}
		await lifecycle.connect()
		expect(state.status).not.toBe(ZwaveClientStatus.CONNECTED)
		expect(hoisted.drivers[0].start).toHaveBeenCalled()
	})
})

describe('DriverLifecycle — connect catch-path edges', () => {
	it('swallows a driver.destroy() rejection while handling a start failure', async () => {
		vi.useFakeTimers()
		try {
			const { lifecycle, host } = createHarness({ serverEnabled: false })
			hoisted.startBehavior = 'reject'
			hoisted.startError = new Error('start boom')
			hoisted.destroyRejects = true
			await lifecycle.connect()
			await flush()
			expect(host.onDriverError).toHaveBeenCalledWith(
				expect.any(Error),
				true,
			)
			await vi.advanceTimersByTimeAsync(1000)
			expect(host.restart).toHaveBeenCalledTimes(1)
		} finally {
			vi.useRealTimers()
		}
	})

	it('aborts the catch path without reporting when the generation changed', async () => {
		const { lifecycle, host } = createHarness({ serverEnabled: false })
		hoisted.startBehavior = 'reject'
		hoisted.startError = new Error('boom')
		hoisted.startHook = () => {
			void lifecycle.close()
		}
		await lifecycle.connect()
		expect(host.onDriverError).not.toHaveBeenCalled()
	})

	it('aborts the catch path (closing) when the client became destroyed', async () => {
		const { lifecycle, host, state } = createHarness({
			serverEnabled: false,
		})
		hoisted.startBehavior = 'reject'
		hoisted.startError = new Error('boom')
		hoisted.startHook = () => {
			state.destroyed = true
		}
		await lifecycle.connect()
		expect(host.onDriverError).not.toHaveBeenCalled()
		expect(state.closed).toBe(true)
	})
})

describe('DriverLifecycle — async failure logging', () => {
	it('logs (and swallows) a restart failure from the backoff timer', async () => {
		vi.useFakeTimers()
		try {
			const { lifecycle, host } = createHarness()
			;(host.restart as any).mockRejectedValue(new Error('restart boom'))
			lifecycle.backoffRestart()
			await vi.advanceTimersByTimeAsync(1000)
			await flush()
			expect(host.restart).toHaveBeenCalledTimes(1)
		} finally {
			vi.useRealTimers()
		}
	})

	it('logs (and swallows) a close failure triggered by checkIfDestroyed', async () => {
		const { lifecycle, state } = createHarness()
		state.destroyed = true
		state.driver = {
			destroy: vi.fn(() => Promise.reject(new Error('destroy boom'))),
		}
		expect(lifecycle.checkIfDestroyed()).toBe(true)
		await flush()
		await flush()
	})
})
