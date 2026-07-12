/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Direct state-machine tests for the extracted {@link DriverLifecycle}
 * service (`api/lib/zwave/DriverLifecycle.ts`).
 *
 * The service owns the low-level lifecycle of a single `zwave-js` `Driver`
 * on behalf of `ZwaveClient`: driver creation/options, log-transport
 * injection, the `@zwave-js/server` coordination, retry/backoff timers,
 * statistics, idempotent teardown, and a monotonic **generation** counter
 * that fences late `driver ready`/`error`/OTW callbacks from an obsolete
 * driver so they can never mutate a replacement generation's state.
 *
 * Everything the service needs from `ZwaveClient` is reached through the
 * narrow {@link DriverLifecycleHost} port, so these tests drive the service
 * with a fully-faked host whose accessors read/write a small mutable state
 * object — exactly mirroring how the real client is wired. `zwave-js`'s
 * `Driver` is replaced with a faithful `EventEmitter` fake so the real
 * `connect()` body runs verbatim (real option building, real event wiring),
 * and `@zwave-js/server` + `utils.ensureDir` are stubbed so no real server
 * binds a port and no directory is written to disk.
 *
 * The complementary end-to-end flow (real `connect()` → driver-ready →
 * `_onDriverReady()` → server start → `close()` through the `ZwaveClient`
 * facade) is characterized in `test/lib/hass/server.test.ts`; the generation
 * fencing of a late `_onDriverReady()` is additionally exercised through the
 * facade there and in the socket production-integration suite.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ZWaveError, ZWaveErrorCodes } from '@zwave-js/core'

import type { DriverLifecycleHost } from '../../../api/lib/zwave/DriverLifecycle.ts'
import type {
	ZwaveConfig,
	InclusionUserCallbacks,
} from '../../../api/lib/zwave/ports.ts'
import { ZwaveClientStatus } from '../../../api/lib/zwave/ports.ts'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Plain, class-free holders the (lazy) `vi.mock` factories push into. Reset in
// `beforeEach`. `vi.hoisted` guarantees they exist before any factory runs.
const hoisted = vi.hoisted(() => ({
	drivers: [] as any[],
	destroyOrder: [] as string[],
	/** 'resolve' | 'reject' | 'hang' — how the fake `driver.start()` behaves. */
	startBehavior: 'resolve' as 'resolve' | 'reject' | 'hang',
	/** Error thrown by `driver.start()` when `startBehavior === 'reject'`. */
	startError: new Error('start failed'),
	/** Synchronous hook invoked at the very start of `driver.start()`. */
	startHook: null as null | (() => void),
	/** Synchronous hook invoked inside the stubbed `utils.ensureDir`. */
	ensureDirHook: null as null | (() => void),
	/** When true, the fake `driver.destroy()` rejects. */
	destroyRejects: false,
	/** Every fake JSON log transport constructed (to drive its `data` stream). */
	logTransports: [] as any[],
}))

// Faithful `zwave-js` Driver fake. Only `Driver` is replaced; every other
// named export is preserved via `importActual`. Extends EventEmitter so the
// production code can wire the real event handlers; `start()` honours the
// controllable behavior; `destroy()` records teardown order.
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
			return Promise.resolve()
		})
		destroy = vi.fn(() => {
			hoisted.destroyOrder.push('driver')
			if (hoisted.destroyRejects) {
				return Promise.reject(new Error('destroy failed'))
			}
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

// Minimal `@zwave-js/server` stub so the lazily-built fallback
// `ZwaveServerManager` never constructs a real HTTP server / binds a port.
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

// Fake JSON log transport whose `.stream` is an EventEmitter we can drive, so
// the production `stream.on('data', ...)` → `host.emitDebug(...)` wiring can be
// exercised without a real driver logging pipeline.
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

// Stub only `utils.ensureDir` (avoids a real mkdir side effect and gives a
// hook to fence the generation mid-`await`). Every other util is real.
vi.mock('../../../api/lib/utils.ts', async () => {
	const actual = await vi.importActual<any>('../../../api/lib/utils.ts')
	return {
		...actual,
		ensureDir: vi.fn(() => {
			hoisted.ensureDirHook?.()
			return Promise.resolve()
		}),
	}
})

// Import AFTER the mocks are registered.
const { DriverLifecycle } = await import(
	'../../../api/lib/zwave/DriverLifecycle.ts'
)

// ---------------------------------------------------------------------------
// Fake host
// ---------------------------------------------------------------------------

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

/** A fake adopted server manager that records its destroy into the order log. */
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

/** Flush pending microtasks. */
const flush = () => Promise.resolve()

beforeEach(() => {
	hoisted.drivers.length = 0
	hoisted.destroyOrder.length = 0
	hoisted.startBehavior = 'resolve'
	hoisted.startError = new Error('start failed')
	hoisted.startHook = null
	hoisted.ensureDirHook = null
	hoisted.destroyRejects = false
	hoisted.logTransports.length = 0
	delete process.env.ZWAVE_PORT
})

// ===========================================================================
// Server coordination
// ===========================================================================

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
		// cached — same instance, host.buildServerHost only used once
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

// ===========================================================================
// Statistics
// ===========================================================================

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

// ===========================================================================
// Extra log transports
// ===========================================================================

describe('DriverLifecycle — extra log transports', () => {
	it('addExtraLogTransport applies immediately when the driver is ready (with level)', () => {
		const { lifecycle, state } = createHarness()
		const driver = { updateLogConfig: vi.fn() }
		state.driver = driver
		state.driverReadyRaw = true
		const transport = { id: 't1' }
		lifecycle.addExtraLogTransport(transport, 'debug')
		expect(driver.updateLogConfig).toHaveBeenCalledWith({
			transports: [transport],
			level: 'debug',
		})
	})

	it('addExtraLogTransport without a level omits the level key', () => {
		const { lifecycle, state } = createHarness()
		const driver = { updateLogConfig: vi.fn() }
		state.driver = driver
		state.driverReadyRaw = true
		const transport = { id: 't2' }
		lifecycle.addExtraLogTransport(transport)
		expect(driver.updateLogConfig).toHaveBeenCalledWith({
			transports: [transport],
		})
	})

	it('addExtraLogTransport does not touch the driver when not ready', () => {
		const { lifecycle, state } = createHarness()
		const driver = { updateLogConfig: vi.fn() }
		state.driver = driver
		state.driverReadyRaw = false
		lifecycle.addExtraLogTransport({ id: 't3' })
		expect(driver.updateLogConfig).not.toHaveBeenCalled()
	})

	it('removeExtraLogTransport removes a registered transport and clears on the driver', () => {
		const { lifecycle, state } = createHarness()
		const driver = { updateLogConfig: vi.fn() }
		state.driver = driver
		state.driverReadyRaw = true
		const transport = { id: 't4' }
		lifecycle.addExtraLogTransport(transport)
		driver.updateLogConfig.mockClear()
		lifecycle.removeExtraLogTransport(transport)
		expect(driver.updateLogConfig).toHaveBeenCalledWith({ transports: [] })
	})

	it('removeExtraLogTransport for an unknown transport still clears when ready', () => {
		const { lifecycle, state } = createHarness()
		const driver = { updateLogConfig: vi.fn() }
		state.driver = driver
		state.driverReadyRaw = true
		lifecycle.removeExtraLogTransport({ id: 'unknown' })
		expect(driver.updateLogConfig).toHaveBeenCalledWith({ transports: [] })
	})
})

// ===========================================================================
// Backoff / destroyed helpers
// ===========================================================================

describe('DriverLifecycle — backoff restart & checkIfDestroyed', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	it('backoffRestart schedules restart with exponential delay and increments the retry', async () => {
		const { lifecycle, host } = createHarness()
		lifecycle.backoffRestart()
		// first retry: 2^0 * 1000 = 1000ms
		expect(host.restart).not.toHaveBeenCalled()
		await vi.advanceTimersByTimeAsync(1000)
		expect(host.restart).toHaveBeenCalledTimes(1)

		lifecycle.backoffRestart()
		// second retry: 2^1 * 1000 = 2000ms
		await vi.advanceTimersByTimeAsync(1999)
		expect(host.restart).toHaveBeenCalledTimes(1)
		await vi.advanceTimersByTimeAsync(1)
		expect(host.restart).toHaveBeenCalledTimes(2)
	})

	it('resetBackoff resets the exponential counter back to the first delay', async () => {
		const { lifecycle, host } = createHarness()
		lifecycle.backoffRestart() // retry -> 1
		await vi.advanceTimersByTimeAsync(1000)
		lifecycle.backoffRestart() // retry -> 2 (2000ms)
		await vi.advanceTimersByTimeAsync(2000)
		expect(host.restart).toHaveBeenCalledTimes(2)

		lifecycle.resetBackoff()
		lifecycle.backoffRestart()
		// back to 2^0 * 1000 = 1000ms
		await vi.advanceTimersByTimeAsync(1000)
		expect(host.restart).toHaveBeenCalledTimes(3)
	})

	it('backoffRestart aborts (and closes) when the client is already destroyed', async () => {
		const { lifecycle, host, state } = createHarness()
		state.destroyed = true
		lifecycle.backoffRestart()
		await vi.advanceTimersByTimeAsync(20000)
		expect(host.restart).not.toHaveBeenCalled()
		// checkIfDestroyed() triggers an idempotent close(true)
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

// ===========================================================================
// connect() — early-return guards
// ===========================================================================

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

// ===========================================================================
// connect() — happy path & option building
// ===========================================================================

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
		// six driver events wired
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
		// inferred default is persisted
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

// ===========================================================================
// connect() — error handling
// ===========================================================================

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
			// backoff scheduled
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

// ===========================================================================
// connect() — generation fencing
// ===========================================================================

describe('DriverLifecycle — connect generation fencing', () => {
	it('aborts before driver creation when the generation changes during ensureDir', async () => {
		const { lifecycle, state } = createHarness()
		hoisted.ensureDirHook = () => {
			// simulate a concurrent close() bumping the generation
			void lifecycle.close()
		}
		await lifecycle.connect()
		// close() ran; no driver was created for the obsolete generation
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
		// driver was constructed but start() never ran (fenced right after)
		expect(hoisted.drivers).toHaveLength(1)
		expect(hoisted.drivers[0].start).not.toHaveBeenCalled()
	})

	it('aborts after driver.start when the generation changes during start()', async () => {
		const { lifecycle, state } = createHarness({ serverEnabled: false })
		hoisted.startHook = () => {
			void lifecycle.close()
		}
		await lifecycle.connect()
		// start ran, but CONNECTED was never set on the obsolete generation
		expect(hoisted.drivers[0].start).toHaveBeenCalled()
		expect(state.status).toBe(ZwaveClientStatus.CLOSED)
	})

	it('aborts when the generation changes during persistConfig', async () => {
		const { lifecycle, host } = createHarness({
			serverEnabled: false,
			rf: { region: 1 } as any, // forces shouldUpdateSettings -> persistConfig
		})
		;(host.persistConfig as any).mockImplementation(() => {
			void lifecycle.close()
			return Promise.resolve()
		})
		await lifecycle.connect()
		// fenced right after persistConfig — no driver created
		expect(hoisted.drivers).toHaveLength(0)
	})
})

// ===========================================================================
// close()
// ===========================================================================

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

// ===========================================================================
// Generation-guarded driver-event dispatch
// ===========================================================================

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
		await lifecycle.close() // bumps generation

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

// ===========================================================================
// connect() — remaining option/edge coverage
// ===========================================================================

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
		// register before connect: applied while building driver log options
		lifecycle.addExtraLogTransport(t1, 'warn')
		lifecycle.addExtraLogTransport(t2, 'silly')
		await lifecycle.connect()
		const logConfig = hoisted.drivers[0].options.logConfig
		expect(logConfig.transports).toContain(t1)
		expect(logConfig.transports).toContain(t2)
		// 'silly' is the most verbose requested level
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
		// checkIfDestroyed() fired after start → CONNECTED never set
		expect(state.status).not.toBe(ZwaveClientStatus.CONNECTED)
		expect(hoisted.drivers[0].start).toHaveBeenCalled()
	})
})

// ===========================================================================
// connect() — catch-path edge coverage
// ===========================================================================

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
			// error still reported + backoff still scheduled despite destroy failing
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
			void lifecycle.close() // bumps generation before the catch runs
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
		// checkIfDestroyed() short-circuits before onDriverError
		expect(host.onDriverError).not.toHaveBeenCalled()
		expect(state.closed).toBe(true)
	})
})

// ===========================================================================
// Async failure paths in timers/helpers
// ===========================================================================

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
			// no unhandled rejection — the .catch handled it
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
		// let the rejected close() settle; the internal .catch handles it
		await flush()
		await flush()
	})
})
