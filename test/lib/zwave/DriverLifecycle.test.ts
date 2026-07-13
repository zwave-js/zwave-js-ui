import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { ZWaveError, ZWaveErrorCodes } from '@zwave-js/core'
import { RFRegion } from 'zwave-js'
import type { Driver, ZWaveOptions, PartialZWaveOptions } from 'zwave-js'
import type { JSONTransport } from '@zwave-js/log-transport-json'
import type { ZwavejsServer } from '@zwave-js/server'
import Transport from 'winston-transport'

import {
	DriverLifecycle,
	type DriverLifecycleHost,
	type DriverLifecycleDeps,
} from '../../../api/lib/zwave/DriverLifecycle.ts'
import type ZwaveServerManager from '../../../api/hass/ZwaveServerManager.ts'
import type { ZwaveServerHost } from '../../../api/hass/ZwaveServerManager.ts'
import type {
	ZwaveConfig,
	InclusionUserCallbacks,
} from '../../../api/lib/zwave/ports.ts'
import { ZwaveClientStatus } from '../../../api/lib/zwave/ports.ts'

// The lifecycle constructs its Driver, JSON log transport and server manager
// through injected factories, so every test drives the real production wiring
// with typed fakes and never module-mocks or reaches into private seams. Casts
// to the production port types live ONLY at the injection boundary below; the
// `world` recorder keeps the concrete fake types so assertions stay type-safe.

type StartBehavior = 'resolve' | 'reject' | 'hang' | 'deferred'
type DestroyBehavior = 'resolve' | 'reject' | 'deferred'

interface Deferred {
	resolve: () => void
	reject: (err?: unknown) => void
}

interface DestroyDeferred {
	resolve: () => void
	reject: (err?: Error) => void
}

interface World {
	drivers: FakeDriver[]
	logTransports: FakeLogTransport[]
	serverManagers: FakeServerManager[]
	destroyOrder: string[]
	startBehavior: StartBehavior
	startError: Error
	startDeferreds: Deferred[]
	startHook: (() => void) | null
	ensureDirHook: (() => void) | null
	destroyBehavior: DestroyBehavior
	destroyRejects: boolean
	destroyDeferreds: DestroyDeferred[]
	destroyRejectCount: number
	destroyInvocations: number
}

class FakeDriver extends EventEmitter {
	port: string
	options: PartialZWaveOptions
	enableStatistics = vi.fn()
	disableStatistics = vi.fn()
	updateLogConfig = vi.fn()
	start!: ReturnType<typeof vi.fn>
	destroy!: ReturnType<typeof vi.fn>
	private _destroyed = false

	constructor(world: World, port: string, options: PartialZWaveOptions) {
		super()
		this.port = port
		this.options = options
		world.drivers.push(this)

		this.start = vi.fn((): Promise<void> => {
			world.startHook?.()
			if (world.startBehavior === 'reject') {
				return Promise.reject(world.startError)
			}
			if (world.startBehavior === 'hang') {
				return new Promise<void>(() => {})
			}
			if (world.startBehavior === 'deferred') {
				return new Promise<void>((resolve, reject) => {
					world.startDeferreds.push({ resolve, reject })
				})
			}
			return Promise.resolve()
		})

		this.destroy = vi.fn((): Promise<void> => {
			world.destroyInvocations++

			const recordEffect = () => {
				if (!this._destroyed) {
					this._destroyed = true
					world.destroyOrder.push('driver')
				}
			}

			if (world.destroyBehavior === 'deferred') {
				return new Promise<void>((resolve, reject) => {
					world.destroyDeferreds.push({
						resolve: () => {
							recordEffect()
							resolve()
						},
						reject: (err?: Error) =>
							reject(err ?? new Error('destroy rejected')),
					})
				})
			}

			if (this._destroyed) {
				return Promise.resolve()
			}

			// Keep the failed instance as owner so a later close/retry destroys it again
			const rejectThis =
				world.destroyRejects ||
				world.destroyBehavior === 'reject' ||
				world.destroyRejectCount > 0
			if (rejectThis) {
				if (world.destroyRejectCount > 0) {
					world.destroyRejectCount--
				}
				return Promise.reject(new Error('destroy failed'))
			}

			recordEffect()
			return Promise.resolve()
		})
	}
}

class FakeLogTransport {
	format: unknown = undefined
	stream = new EventEmitter()

	constructor(world: World) {
		world.logTransports.push(this)
	}
}

class FakeServerManager {
	create = vi.fn()
	startIfNeeded = vi.fn()
	destroy!: ReturnType<typeof vi.fn>
	server: ZwavejsServer | null = null

	constructor(world: World) {
		world.serverManagers.push(this)
		this.destroy = vi.fn((): Promise<void> => {
			world.destroyOrder.push('server')
			return Promise.resolve()
		})
	}
}

function createWorld(): World {
	return {
		drivers: [],
		logTransports: [],
		serverManagers: [],
		destroyOrder: [],
		startBehavior: 'resolve',
		startError: new Error('start failed'),
		startDeferreds: [],
		startHook: null,
		ensureDirHook: null,
		destroyBehavior: 'resolve',
		destroyRejects: false,
		destroyDeferreds: [],
		destroyRejectCount: 0,
		destroyInvocations: 0,
	}
}

function makeDeps(world: World): DriverLifecycleDeps {
	return {
		createDriver: (port, options) =>
			new FakeDriver(world, port, options) as unknown as Driver,
		createLogTransport: () =>
			new FakeLogTransport(world) as unknown as JSONTransport,
		createServerManager: () =>
			new FakeServerManager(world) as unknown as ZwaveServerManager,
		ensureDir: () => {
			world.ensureDirHook?.()
			return Promise.resolve()
		},
	}
}

// The base types `cfg.options` as the full ZWaveOptions, but production only ever
// Object.assigns partial user overrides, so adapt partial fixtures in one place
function zwaveOpts(partial: Partial<ZWaveOptions>): ZWaveOptions {
	return partial as ZWaveOptions
}

interface HarnessState {
	cfg: ZwaveConfig
	driver: Driver | null
	driverReady: boolean
	driverReadyRaw: boolean
	closed: boolean
	destroyed: boolean
	status: ZwaveClientStatus | undefined
	connectedClients: boolean
	userCallbacks: InclusionUserCallbacks
}

function createHarness(cfgOverrides: Partial<ZwaveConfig> = {}) {
	const world = createWorld()

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

	// The injected server-manager factory ignores its host arg, so this stub only
	// has to exist for `buildServerHost()` to return something type-compatible
	const serverHostStub = {} as unknown as ZwaveServerHost

	const host = {
		getConfig: () => state.cfg,
		getDriver: () => state.driver,
		setDriver: (d: Driver | null) => {
			state.driver = d
		},
		isDriverReady: () => state.driverReady,
		isDriverReadyRaw: () => state.driverReadyRaw,
		isClosed: () => state.closed,
		setClosed: (c: boolean) => {
			state.closed = c
		},
		isDestroyed: () => state.destroyed,
		setStatus: (s: ZwaveClientStatus) => {
			state.status = s
		},
		setDriverReady: (r: boolean) => {
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
		buildServerHost: () => serverHostStub,
		clearRuntimeOnClose: vi.fn(),
		finalizeClose: vi.fn(),
		onDriverReady: vi.fn(async () => {}),
		onDriverError: vi.fn(),
		onScanComplete: vi.fn(),
		onBootLoaderReady: vi.fn(),
		onOTWFirmwareUpdateProgress: vi.fn(),
		onOTWFirmwareUpdateFinished: vi.fn(),
	} satisfies DriverLifecycleHost

	const lifecycle = new DriverLifecycle(host, makeDeps(world))
	return { lifecycle, host, state, world }
}

const flush = () => Promise.resolve()

async function until(pred: () => boolean, max = 100): Promise<void> {
	for (let i = 0; i < max; i++) {
		if (pred()) return
		await Promise.resolve()
	}
	if (!pred()) {
		throw new Error('until(): condition was not met')
	}
}

afterEach(() => {
	delete process.env.ZWAVE_PORT
})

describe('DriverLifecycle — statistics', () => {
	it('enableStatistics enables usage reporting on the driver without the server suffix when the server is disabled', async () => {
		const { lifecycle, world } = createHarness({ serverEnabled: false })
		await lifecycle.connect()
		lifecycle.enableStatistics()
		const driver = world.drivers[0]
		expect(driver.enableStatistics).toHaveBeenCalledTimes(1)
		const arg = driver.enableStatistics.mock.calls[0][0]
		expect(arg.applicationName).not.toContain('zwave-js-server')
	})

	it('enableStatistics tags the application name with zwave-js-server when the server is enabled', async () => {
		const { lifecycle, world } = createHarness({ serverEnabled: true })
		await lifecycle.connect()
		lifecycle.enableStatistics()
		const arg = world.drivers[0].enableStatistics.mock.calls[0][0]
		expect(arg.applicationName).toContain('zwave-js-server')
	})

	it('disableStatistics disables usage reporting on the driver', async () => {
		const { lifecycle, world } = createHarness({ serverEnabled: false })
		await lifecycle.connect()
		lifecycle.disableStatistics()
		expect(world.drivers[0].disableStatistics).toHaveBeenCalledTimes(1)
	})

	it('toggling statistics before the driver exists is a safe no-op', () => {
		const { lifecycle } = createHarness()
		expect(() => lifecycle.enableStatistics()).not.toThrow()
		expect(() => lifecycle.disableStatistics()).not.toThrow()
	})
})

describe('DriverLifecycle — extra log transports', () => {
	async function connectedReadyHarness(
		cfgOverrides: Partial<ZwaveConfig> = {},
	) {
		const harness = createHarness({ serverEnabled: false, ...cfgOverrides })
		await harness.lifecycle.connect()
		const json = harness.world.logTransports[0]
		const driver = harness.world.drivers[0]
		harness.state.driverReadyRaw = true
		driver.updateLogConfig.mockClear()
		return { ...harness, json, driver }
	}

	it('addExtraLogTransport sends the COMPLETE transport list (JSON socket + extra) and raises the level', async () => {
		const { lifecycle, json, driver } = await connectedReadyHarness()
		const extra = new Transport({})
		lifecycle.addExtraLogTransport(extra, 'debug')
		expect(driver.updateLogConfig).toHaveBeenCalledTimes(1)
		expect(driver.updateLogConfig).toHaveBeenCalledWith({
			transports: [json, extra],
			level: 'debug',
		})
	})

	it('addExtraLogTransport without a level keeps the configured baseline level and still retains the JSON transport', async () => {
		const { lifecycle, json, driver } = await connectedReadyHarness()
		const extra = new Transport({})
		lifecycle.addExtraLogTransport(extra)
		expect(driver.updateLogConfig).toHaveBeenCalledWith({
			transports: [json, extra],
			level: 'info',
		})
	})

	it('multiple extras with different levels: full list retained and the MOST verbose level wins', async () => {
		const { lifecycle, json, driver } = await connectedReadyHarness()
		const a = new Transport({})
		const b = new Transport({})
		const c = new Transport({})
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
		const keep = new Transport({})
		const temp = new Transport({})
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
		const temp = new Transport({})
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
		const warnT = new Transport({})
		const debugT = new Transport({})
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
			options: zwaveOpts({ logConfig: { level: 'verbose' } }),
		})
		const extra = new Transport({})
		lifecycle.addExtraLogTransport(extra, 'warn')
		expect(driver.updateLogConfig).toHaveBeenCalledWith({
			transports: [json, extra],
			level: 'verbose',
		})
	})

	it('addExtraLogTransport does not touch the driver when it is not ready (registration still persists)', async () => {
		const { lifecycle, world, state } = createHarness({
			serverEnabled: false,
		})
		await lifecycle.connect()
		const driver = world.drivers[0]
		state.driverReadyRaw = false
		driver.updateLogConfig.mockClear()
		const extra = new Transport({})
		lifecycle.addExtraLogTransport(extra, 'debug')
		expect(driver.updateLogConfig).not.toHaveBeenCalled()

		state.driverReadyRaw = true
		lifecycle.removeExtraLogTransport(new Transport({}))
		expect(driver.updateLogConfig).toHaveBeenCalledWith({
			transports: [world.logTransports[0], extra],
			level: 'debug',
		})
	})

	it('before connect there is no driver and add/remove are inert no-ops', () => {
		const { lifecycle } = createHarness({ serverEnabled: false })
		const t = new Transport({})
		expect(() => lifecycle.addExtraLogTransport(t, 'debug')).not.toThrow()
		expect(() => lifecycle.removeExtraLogTransport(t)).not.toThrow()
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
		expect(state.status).toBe(ZwaveClientStatus.CLOSED)
	})

	it('checkIfDestroyed returns true and closes when destroyed', () => {
		const { lifecycle, state } = createHarness()
		state.destroyed = true
		expect(lifecycle.checkIfDestroyed()).toBe(true)
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
		const { lifecycle, world } = createHarness({ enabled: false })
		await lifecycle.connect()
		expect(world.drivers).toHaveLength(0)
		expect(lifecycle.generation).toBe(0)
	})

	it('does nothing when a driver is already ready', async () => {
		const { lifecycle, world, state } = createHarness()
		state.driverReady = true
		await lifecycle.connect()
		expect(world.drivers).toHaveLength(0)
	})

	it('does nothing when the client is already closed', async () => {
		const { lifecycle, world, state } = createHarness()
		state.closed = true
		await lifecycle.connect()
		expect(world.drivers).toHaveLength(0)
	})

	it('does nothing when no port is configured', async () => {
		const { lifecycle, world } = createHarness({ port: undefined })
		await lifecycle.connect()
		expect(world.drivers).toHaveLength(0)
		expect(lifecycle.generation).toBe(0)
	})

	it('honours the ZWAVE_PORT env override (force-enables + overrides port)', async () => {
		process.env.ZWAVE_PORT = 'tcp://override:5555'
		const { lifecycle, world, state } = createHarness({ enabled: false })
		await lifecycle.connect()
		expect(state.cfg.enabled).toBe(true)
		expect(state.cfg.port).toBe('tcp://override:5555')
		expect(world.drivers).toHaveLength(1)
		expect(world.drivers[0].port).toBe('tcp://override:5555')
	})
})

describe('DriverLifecycle — connect happy path', () => {
	it('creates a driver, starts it and sets CONNECTED', async () => {
		const { lifecycle, world, state } = createHarness({
			serverEnabled: false,
		})
		await lifecycle.connect()

		expect(lifecycle.generation).toBe(1)
		expect(world.drivers).toHaveLength(1)
		const driver = world.drivers[0]
		expect(driver.start).toHaveBeenCalledTimes(1)
		expect(state.driver).toBe(driver)
		expect(state.status).toBe(ZwaveClientStatus.CONNECTED)
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
		const { lifecycle, world } = createHarness({ serverEnabled: true })
		await lifecycle.connect()
		expect(world.serverManagers).toHaveLength(1)
		expect(world.serverManagers[0].create).toHaveBeenCalledTimes(1)
	})

	it('enables statistics on connect when configured', async () => {
		const { lifecycle, world } = createHarness({
			serverEnabled: false,
			enableStatistics: true,
		})
		await lifecycle.connect()
		expect(world.drivers[0].enableStatistics).toHaveBeenCalledTimes(1)
	})

	it('passes the inclusion user callbacks into driver options when server disabled', async () => {
		const { lifecycle, host, world } = createHarness({
			serverEnabled: false,
		})
		await lifecycle.connect()
		expect(host.getInclusionUserCallbacks).toHaveBeenCalled()
		expect(world.drivers[0].options.inclusionUserCallbacks).toBeDefined()
	})

	it('does not pass inclusion user callbacks when the server is enabled', async () => {
		const { lifecycle, world } = createHarness({ serverEnabled: true })
		await lifecycle.connect()
		expect(world.drivers[0].options.inclusionUserCallbacks).toBeUndefined()
	})

	it('applies the soft-reset feature flag when explicitly configured', async () => {
		const { lifecycle, world } = createHarness({
			serverEnabled: false,
			enableSoftReset: false,
		})
		await lifecycle.connect()
		expect(world.drivers[0].options.features?.softReset).toBe(false)
	})

	it('maps rf auto power levels when autoPowerlevels is inferred true', async () => {
		const { lifecycle, host, world } = createHarness({
			serverEnabled: false,
			rf: { region: RFRegion.USA },
		})
		await lifecycle.connect()
		const rf = world.drivers[0].options.rf
		expect(rf?.region).toBe(RFRegion.USA)
		expect(rf?.maxLongRangePowerlevel).toBe('auto')
		expect(rf?.txPower?.powerlevel).toBe('auto')
		expect(host.persistConfig).toHaveBeenCalled()
	})

	it('maps explicit rf power levels when autoPowerlevels is false', async () => {
		const { lifecycle, world } = createHarness({
			serverEnabled: false,
			rf: {
				region: RFRegion.Europe,
				autoPowerlevels: false,
				maxLongRangePowerlevel: 10,
				txPower: { powerlevel: 5, measured0dBm: 1 },
			},
		})
		await lifecycle.connect()
		const rf = world.drivers[0].options.rf
		expect(rf?.maxLongRangePowerlevel).toBe(10)
		expect(rf?.txPower?.powerlevel).toBe(5)
		expect(rf?.txPower?.measured0dBm).toBe(1)
	})

	it('migrates a legacy networkKey to securityKeys.S0_Legacy and persists', async () => {
		const { lifecycle, host, state } = createHarness({
			serverEnabled: false,
			networkKey: '0102030405060708090A0B0C0D0E0F10',
		})
		await lifecycle.connect()
		expect(state.cfg.securityKeys?.S0_Legacy).toBe(
			'0102030405060708090A0B0C0D0E0F10',
		)
		expect(state.cfg.networkKey).toBeUndefined()
		expect(host.persistConfig).toHaveBeenCalled()
	})

	it('merges hidden cfg.options into the driver options', async () => {
		const { lifecycle, world } = createHarness({
			serverEnabled: false,
			options: zwaveOpts({ emitValueUpdateAfterSetValue: false }),
		})
		await lifecycle.connect()
		expect(world.drivers[0].options.emitValueUpdateAfterSetValue).toBe(
			false,
		)
	})
})

describe('DriverLifecycle — connect error handling', () => {
	it('on a generic start failure: destroys the driver, reports the error and backs off', async () => {
		vi.useFakeTimers()
		try {
			const { lifecycle, host, world } = createHarness({
				serverEnabled: false,
			})
			world.startBehavior = 'reject'
			world.startError = new Error('boom')
			await lifecycle.connect()
			expect(world.drivers[0].destroy).toHaveBeenCalled()
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
			const { lifecycle, host, world } = createHarness({
				serverEnabled: false,
			})
			world.startBehavior = 'reject'
			world.startError = new ZWaveError(
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
		const { lifecycle, world, state } = createHarness()
		world.ensureDirHook = () => {
			void lifecycle.close()
		}
		await lifecycle.connect()
		expect(world.drivers).toHaveLength(0)
		expect(state.status).toBe(ZwaveClientStatus.CLOSED)
	})

	it('aborts before driver.start when the generation changes during hasConnectedClients', async () => {
		const { lifecycle, host, world } = createHarness()
		host.hasConnectedClients.mockImplementation(() => {
			void lifecycle.close()
			return Promise.resolve(false)
		})
		await lifecycle.connect()
		expect(world.drivers).toHaveLength(1)
		expect(world.drivers[0].start).not.toHaveBeenCalled()
	})

	it('aborts after driver.start when the generation changes during start()', async () => {
		const { lifecycle, world, state } = createHarness({
			serverEnabled: false,
		})
		world.startHook = () => {
			void lifecycle.close()
		}
		await lifecycle.connect()
		expect(world.drivers[0].start).toHaveBeenCalled()
		expect(state.status).toBe(ZwaveClientStatus.CLOSED)
	})

	it('aborts when the generation changes during persistConfig', async () => {
		const { lifecycle, host, world } = createHarness({
			serverEnabled: false,
			rf: { region: RFRegion.USA },
		})
		host.persistConfig.mockImplementation(() => {
			void lifecycle.close()
			return Promise.resolve()
		})
		await lifecycle.connect()
		expect(world.drivers).toHaveLength(0)
	})
})

describe('DriverLifecycle — pre-ready reconnect coalescing', () => {
	it('a second connect after start() resolves but before driver ready does NOT construct or leak a replacement', async () => {
		const { lifecycle, world, state } = createHarness({
			serverEnabled: false,
		})

		await lifecycle.connect()
		expect(world.drivers).toHaveLength(1)
		const driver0 = world.drivers[0]
		expect(state.driver).toBe(driver0)
		expect(state.status).toBe(ZwaveClientStatus.CONNECTED)
		expect(state.driverReady).toBe(false)
		const genAfterFirst = lifecycle.generation

		await lifecycle.connect()

		expect(world.drivers).toHaveLength(1)
		expect(state.driver).toBe(driver0)
		expect(driver0.destroy).not.toHaveBeenCalled()
		expect(lifecycle.generation).toBe(genAfterFirst)
	})

	it('coalesces a second connect while the first is still awaiting driver.start(): it stays PENDING until the first settles, then settles together', async () => {
		const { lifecycle, world, state } = createHarness({
			serverEnabled: false,
		})
		world.startBehavior = 'deferred'

		const first = lifecycle.connect()
		await until(() => world.startDeferreds.length === 1)
		expect(world.drivers).toHaveLength(1)
		const driver0 = world.drivers[0]
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

		await until(() => world.startDeferreds.length === 1)
		expect(world.drivers).toHaveLength(1)
		expect(world.startDeferreds).toHaveLength(1)
		expect(state.driver).toBe(driver0)
		expect(lifecycle.generation).toBe(gen)
		expect(driver0.start).toHaveBeenCalledTimes(1)
		expect(firstSettled).toBe(false)
		expect(secondSettled).toBe(false)

		world.startDeferreds[0].resolve()
		await Promise.all([first, second])
		expect(firstSettled).toBe(true)
		expect(secondSettled).toBe(true)
		expect(state.status).toBe(ZwaveClientStatus.CONNECTED)
		expect(world.drivers).toHaveLength(1)
		expect(driver0.destroy).not.toHaveBeenCalled()
	})

	it('a coalesced duplicate connect shares the first connect FAILURE settlement (start rejects) and no second Driver is built', async () => {
		const { lifecycle, world, state, host } = createHarness({
			serverEnabled: false,
		})
		world.startBehavior = 'deferred'

		const first = lifecycle.connect()
		await until(() => world.startDeferreds.length === 1)
		const driver0 = world.drivers[0]

		let firstSettled = false
		let secondSettled = false
		void first.then(() => {
			firstSettled = true
		})
		const second = lifecycle.connect()
		void second.then(() => {
			secondSettled = true
		})
		await until(() => world.startDeferreds.length === 1)
		expect(firstSettled).toBe(false)
		expect(secondSettled).toBe(false)

		world.startDeferreds[0].reject(new Error('start failed'))
		await expect(Promise.all([first, second])).resolves.toBeDefined()
		expect(firstSettled).toBe(true)
		expect(secondSettled).toBe(true)
		expect(world.drivers).toHaveLength(1)
		expect(driver0.destroy).toHaveBeenCalledTimes(1)
		expect(state.driver).toBeNull()
		expect(host.onDriverError).toHaveBeenCalledTimes(1)
	})

	it('a duplicate connect AFTER the first start settled but BEFORE driver ready returns compatibly without a replacement', async () => {
		const { lifecycle, world, state } = createHarness({
			serverEnabled: false,
		})

		await lifecycle.connect()
		const driver0 = world.drivers[0]
		const gen = lifecycle.generation
		expect(state.status).toBe(ZwaveClientStatus.CONNECTED)
		expect(state.driverReady).toBe(false)

		await lifecycle.connect()
		expect(world.drivers).toHaveLength(1)
		expect(state.driver).toBe(driver0)
		expect(driver0.destroy).not.toHaveBeenCalled()
		expect(lifecycle.generation).toBe(gen)
	})

	it('a recovery reconnect after a start failure is NOT coalesced (host cleared) and builds exactly one fresh driver', async () => {
		const { lifecycle, world, state } = createHarness({
			serverEnabled: false,
		})

		world.startBehavior = 'reject'
		await lifecycle.connect()
		expect(world.drivers).toHaveLength(1)
		expect(world.drivers[0].destroy).toHaveBeenCalledTimes(1)
		expect(state.driver).toBeNull()

		await lifecycle.close(true)
		state.closed = false

		world.startBehavior = 'resolve'
		await lifecycle.connect()

		expect(world.drivers).toHaveLength(2)
		expect(state.driver).toBe(world.drivers[1])
		expect(state.status).toBe(ZwaveClientStatus.CONNECTED)
	})

	async function openCloseReconnectWithStale() {
		const harness = createHarness({ serverEnabled: false })
		const { world } = harness
		world.startBehavior = 'deferred'

		const stalePromise = harness.lifecycle.connect()
		await until(() => world.startDeferreds.length === 1)
		const driver0 = world.drivers[0]
		expect(harness.state.driver).toBe(driver0)

		await harness.lifecycle.close(true)
		expect(harness.state.driver).toBeNull()
		harness.state.closed = false

		world.startBehavior = 'deferred'
		const freshPromise = harness.lifecycle.connect()
		await until(() => world.startDeferreds.length === 2)
		const driver1 = world.drivers[1]
		world.startDeferreds[1].resolve()
		await freshPromise
		expect(harness.state.driver).toBe(driver1)
		expect(harness.state.status).toBe(ZwaveClientStatus.CONNECTED)

		return { ...harness, stalePromise, driver0, driver1 }
	}

	it('a stale start that RESOLVES after a close+reconnect tears down only its own driver', async () => {
		const { world, state, stalePromise, driver1 } =
			await openCloseReconnectWithStale()

		world.startDeferreds[0].resolve()
		await stalePromise

		expect(world.destroyOrder.filter((d) => d === 'driver')).toHaveLength(1)
		expect(driver1.destroy).not.toHaveBeenCalled()
		expect(state.driver).toBe(driver1)
	})

	it('a stale start that REJECTS after a close+reconnect never destroys the replacement or backs off', async () => {
		const { host, world, state, stalePromise, driver1 } =
			await openCloseReconnectWithStale()

		world.startDeferreds[0].reject(new Error('late start failure'))
		await stalePromise

		expect(world.destroyOrder.filter((d) => d === 'driver')).toHaveLength(1)
		expect(driver1.destroy).not.toHaveBeenCalled()
		expect(state.driver).toBe(driver1)
		expect(host.onDriverError).not.toHaveBeenCalled()
		expect(host.restart).not.toHaveBeenCalled()
	})
})

describe('DriverLifecycle — failed-connect teardown ownership', () => {
	it('awaits the failed driver destroy before clearing the host or backing off (no replacement built while the owner is torn down)', async () => {
		vi.useFakeTimers()
		try {
			const { lifecycle, world, state, host } = createHarness({
				serverEnabled: false,
			})
			world.startBehavior = 'reject'
			world.startError = new Error('start boom')
			world.destroyBehavior = 'deferred'

			const connectP = lifecycle.connect()

			await until(() => world.destroyDeferreds.length === 1)
			expect(world.drivers).toHaveLength(1)
			const driver0 = world.drivers[0]
			expect(state.driver).toBe(driver0)
			expect(host.onDriverError).not.toHaveBeenCalled()
			expect(host.restart).not.toHaveBeenCalled()

			const concurrent = lifecycle.connect()
			await until(() => world.destroyDeferreds.length === 1)
			expect(world.drivers).toHaveLength(1)
			expect(driver0.start).toHaveBeenCalledTimes(1)

			world.destroyDeferreds[0].resolve()
			await connectP
			await concurrent
			expect(state.driver).toBeNull()
			expect(world.destroyOrder).toEqual(['driver'])
			expect(host.onDriverError).toHaveBeenCalledTimes(1)
			expect(host.onDriverError).toHaveBeenCalledWith(
				expect.any(Error),
				true,
			)
			await vi.advanceTimersByTimeAsync(1000)
			expect(host.restart).toHaveBeenCalledTimes(1)
			expect(world.drivers).toHaveLength(1)
		} finally {
			vi.useRealTimers()
		}
	})

	it('retains the exact owner when destroy REJECTS and lets a later close retry the cleanup (no leak, no wrong destroy)', async () => {
		vi.useFakeTimers()
		try {
			const { lifecycle, world, state, host } = createHarness({
				serverEnabled: false,
			})
			world.startBehavior = 'reject'
			world.startError = new Error('start boom')
			world.destroyRejectCount = 1

			await lifecycle.connect()
			const driver0 = world.drivers[0]

			expect(world.drivers).toHaveLength(1)
			expect(state.driver).toBe(driver0)
			expect(world.destroyInvocations).toBe(1)
			expect(world.destroyOrder).toEqual([])
			expect(host.onDriverError).toHaveBeenCalledTimes(1)

			await lifecycle.close(true)
			expect(world.destroyInvocations).toBe(2)
			expect(world.destroyOrder).toEqual(['driver'])
			expect(state.driver).toBeNull()
			expect(world.drivers).toHaveLength(1)
			expect(driver0.destroy).toHaveBeenCalledTimes(2)
		} finally {
			vi.useRealTimers()
		}
	})

	it('a stale post-start exit awaits teardown of its OWN instance and never destroys the live replacement, even with a delayed destroy', async () => {
		const { lifecycle, world, state } = createHarness({
			serverEnabled: false,
		})
		world.startBehavior = 'deferred'

		const staleP = lifecycle.connect()
		await until(() => world.startDeferreds.length === 1)

		await lifecycle.close(true)
		state.closed = false
		world.startBehavior = 'deferred'
		const freshP = lifecycle.connect()
		await until(() => world.startDeferreds.length === 2)
		const driver1 = world.drivers[1]
		world.startDeferreds[1].resolve()
		await freshP
		expect(state.driver).toBe(driver1)

		world.startDeferreds[0].resolve()
		await staleP

		expect(driver1.destroy).not.toHaveBeenCalled()
		expect(state.driver).toBe(driver1)
		expect(world.destroyOrder.filter((d) => d === 'driver')).toHaveLength(1)
	})
})

describe('DriverLifecycle — final logConfig override', () => {
	it('a documented zwave.options.logConfig override still receives the JSON transport, extra transports and bumped level', async () => {
		const { lifecycle, world } = createHarness({
			serverEnabled: false,
			options: zwaveOpts({ logConfig: { level: 'error' } }),
		})
		const extra = new Transport({})
		lifecycle.addExtraLogTransport(extra, 'debug')

		await lifecycle.connect()

		const passedLogConfig = world.drivers[0].options.logConfig
		const jsonTransport = world.logTransports[0]
		expect(jsonTransport).toBeDefined()
		expect(passedLogConfig?.transports).toContain(jsonTransport)
		expect(passedLogConfig?.transports).toContain(extra)
		expect(passedLogConfig?.level).toBe('debug')
	})

	it('a zwave.options.logConfig override with no extra transports still receives the JSON transport', async () => {
		const { lifecycle, world } = createHarness({
			serverEnabled: false,
			options: zwaveOpts({ logConfig: { level: 'warn' } }),
		})

		await lifecycle.connect()

		const passedLogConfig = world.drivers[0].options.logConfig
		const jsonTransport = world.logTransports[0]
		expect(passedLogConfig?.transports).toEqual([jsonTransport])
		expect(passedLogConfig?.level).toBe('warn')
	})

	it('a driver built with NO logConfig object connects cleanly and leaves the base level unset', async () => {
		const { lifecycle, world, state } = createHarness({
			serverEnabled: false,
			options: zwaveOpts({ logConfig: undefined }),
		})

		await lifecycle.connect()

		expect(world.drivers).toHaveLength(1)
		expect(world.drivers[0].options.logConfig).toBeUndefined()
		expect(state.driver).toBe(world.drivers[0])

		state.driverReadyRaw = true
		world.drivers[0].updateLogConfig.mockClear()
		const extra = new Transport({})
		lifecycle.addExtraLogTransport(extra, 'warn')
		expect(world.drivers[0].updateLogConfig).toHaveBeenCalledWith({
			transports: [world.logTransports[0], extra],
			level: 'warn',
		})
	})
})

describe('DriverLifecycle — logConfig source isolation', () => {
	it('does not mutate the persisted cfg.options.logConfig; the driver receives a distinct enriched clone', async () => {
		const { lifecycle, world, state } = createHarness({
			serverEnabled: false,
			options: zwaveOpts({ logConfig: { level: 'warn', maxFiles: 5 } }),
		})
		const source = state.cfg.options?.logConfig
		const sourceSnapshot = JSON.parse(JSON.stringify(source))
		const extra = new Transport({})
		lifecycle.addExtraLogTransport(extra, 'debug')

		await lifecycle.connect()

		const driverLogConfig = world.drivers[0].options.logConfig
		expect(driverLogConfig).not.toBe(source)
		expect(driverLogConfig?.transports).toContain(world.logTransports[0])
		expect(driverLogConfig?.transports).toContain(extra)
		expect(driverLogConfig?.level).toBe('debug')

		expect(state.cfg.options?.logConfig).toBe(source)
		expect(source).toEqual(sourceSnapshot)
		expect(source?.transports).toBeUndefined()
		expect(source?.level).toBe('warn')
	})

	it('removing a debug transport and restarting returns the driver to the configured level without leaking runtime transports', async () => {
		const { lifecycle, world, state } = createHarness({
			serverEnabled: false,
			options: zwaveOpts({ logConfig: { level: 'info' } }),
		})
		const source = state.cfg.options?.logConfig
		const sourceSnapshot = JSON.parse(JSON.stringify(source))
		const extra = new Transport({})

		lifecycle.addExtraLogTransport(extra, 'debug')
		await lifecycle.connect()
		expect(world.drivers[0].options.logConfig?.level).toBe('debug')
		expect(source).toEqual(sourceSnapshot)
		expect(state.cfg.options?.logConfig).toBe(source)

		lifecycle.removeExtraLogTransport(extra)
		await lifecycle.close()
		state.closed = false
		await lifecycle.connect()

		const restarted = world.drivers[1].options.logConfig
		expect(restarted?.level).toBe('info')
		expect(restarted?.transports).toEqual([world.logTransports[1]])

		expect(state.cfg.options?.logConfig).toBe(source)
		expect(source).toEqual(sourceSnapshot)
		expect(source?.level).toBe('info')
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
		const { lifecycle, world } = createHarness({ serverEnabled: true })
		await lifecycle.connect()
		await lifecycle.close()
		expect(world.destroyOrder).toEqual(['server', 'driver'])
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
		const { lifecycle, world } = createHarness()
		await expect(lifecycle.close()).resolves.toBeUndefined()
		await expect(lifecycle.close()).resolves.toBeUndefined()
		expect(world.destroyOrder).toEqual([])
	})
})

describe('DriverLifecycle — driver-event dispatch', () => {
	it('forwards every driver event to the host with the current generation', async () => {
		const { lifecycle, host, world } = createHarness({
			serverEnabled: false,
		})
		await lifecycle.connect()
		const driver = world.drivers[0]

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
		const { lifecycle, host, world } = createHarness({
			serverEnabled: false,
		})
		await lifecycle.connect()
		const driver = world.drivers[0]
		await lifecycle.close()

		host.onDriverReady = vi.fn(async () => {})
		driver.emit('driver ready')
		await flush()
		expect(host.onDriverReady).not.toHaveBeenCalled()
	})

	it('fences a late error/scan/bootloader/OTW callback after the generation moves on', async () => {
		const { lifecycle, host, world } = createHarness({
			serverEnabled: false,
		})
		await lifecycle.connect()
		const driver = world.drivers[0]
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
		const { lifecycle, world } = createHarness({
			serverEnabled: false,
			scales: [{ key: 1, sensor: 'Air temperature', label: 'Celsius' }],
		})
		await lifecycle.connect()
		expect(world.drivers[0].options.preferences).toEqual({
			scales: { 1: 'Celsius' },
		})
	})

	it('injects PkgFsBindings into driver host options when running in a pkg bundle', async () => {
		const proc = process as NodeJS.Process & { pkg?: unknown }
		proc.pkg = {}
		try {
			const { lifecycle, world } = createHarness({ serverEnabled: false })
			await lifecycle.connect()
			expect(world.drivers[0].options.host?.fs).toBeDefined()
		} finally {
			delete proc.pkg
		}
	})

	it('merges registered extra log transports and bumps the log level to the most verbose', async () => {
		const { lifecycle, world } = createHarness({ serverEnabled: false })
		const t1 = new Transport({})
		const t2 = new Transport({})
		lifecycle.addExtraLogTransport(t1, 'warn')
		lifecycle.addExtraLogTransport(t2, 'silly')
		await lifecycle.connect()
		const logConfig = world.drivers[0].options.logConfig
		expect(logConfig?.transports).toContain(t1)
		expect(logConfig?.transports).toContain(t2)
		expect(logConfig?.level).toBe('silly')
	})

	it('forwards driver log stream data to host.emitDebug', async () => {
		const { lifecycle, host, world } = createHarness({
			serverEnabled: false,
		})
		await lifecycle.connect()
		const transport = world.logTransports[0]
		expect(transport).toBeDefined()
		transport.stream.emit('data', { message: 'hello world' })
		expect(host.emitDebug).toHaveBeenCalledWith('hello world')
	})

	it('aborts after start() when the client became destroyed mid-start', async () => {
		const { lifecycle, world, state } = createHarness({
			serverEnabled: false,
		})
		world.startHook = () => {
			state.destroyed = true
		}
		await lifecycle.connect()
		expect(state.status).not.toBe(ZwaveClientStatus.CONNECTED)
		expect(world.drivers[0].start).toHaveBeenCalled()
	})
})

describe('DriverLifecycle — connect catch-path edges', () => {
	it('swallows a driver.destroy() rejection while handling a start failure', async () => {
		vi.useFakeTimers()
		try {
			const { lifecycle, host, world } = createHarness({
				serverEnabled: false,
			})
			world.startBehavior = 'reject'
			world.startError = new Error('start boom')
			world.destroyRejects = true
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
		const { lifecycle, host, world } = createHarness({
			serverEnabled: false,
		})
		world.startBehavior = 'reject'
		world.startError = new Error('boom')
		world.startHook = () => {
			void lifecycle.close()
		}
		await lifecycle.connect()
		expect(host.onDriverError).not.toHaveBeenCalled()
	})

	it('aborts the catch path (closing) when the client became destroyed', async () => {
		const { lifecycle, host, world, state } = createHarness({
			serverEnabled: false,
		})
		world.startBehavior = 'reject'
		world.startError = new Error('boom')
		world.startHook = () => {
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
			host.restart.mockRejectedValue(new Error('restart boom'))
			lifecycle.backoffRestart()
			await vi.advanceTimersByTimeAsync(1000)
			await flush()
			expect(host.restart).toHaveBeenCalledTimes(1)
		} finally {
			vi.useRealTimers()
		}
	})

	it('logs (and swallows) a close failure triggered by checkIfDestroyed', async () => {
		const { lifecycle, world, state } = createHarness({
			serverEnabled: false,
		})
		await lifecycle.connect()
		world.destroyBehavior = 'reject'
		state.destroyed = true
		expect(lifecycle.checkIfDestroyed()).toBe(true)
		await flush()
		await flush()
	})
})
