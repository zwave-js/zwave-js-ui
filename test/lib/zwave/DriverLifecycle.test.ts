import {
	describe,
	it,
	expect,
	vi,
	beforeEach,
	afterEach,
	type Mock,
} from 'vitest'
import { EventEmitter } from 'node:events'
import {
	ZWaveError,
	ZWaveErrorCodes,
	CONTROLLER_LOGLEVEL,
} from '@zwave-js/core'
import { RFRegion } from 'zwave-js'
import type { Driver, PartialZWaveOptions } from 'zwave-js'
import type { JSONTransport } from '@zwave-js/log-transport-json'
import type { ZwavejsServer } from '@zwave-js/server'
import Transport from 'winston-transport'

import {
	DriverLifecycle,
	type DriverLifecycleHost,
	type DriverLifecycleDeps,
} from '#api/lib/zwave/DriverLifecycle'
import type ZwaveServerManager from '#api/hass/ZwaveServerManager'
import type { ZwaveServerHost } from '#api/hass/ZwaveServerManager'
import type {
	ZwaveConfig,
	InclusionUserCallbacks,
} from '#api/lib/zwave/ports'
import { ZwaveClientStatus } from '#api/lib/zwave/ports'
import {
	createDeferred,
	requireDefined,
	type Deferred,
} from './serviceTestSupport.ts'

type StartBehavior = 'resolve' | 'reject' | 'hang' | 'deferred'
type DestroyBehavior = 'resolve' | 'reject' | 'deferred'

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
	startDeferreds: Deferred<void>[]
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
	start!: Mock<() => Promise<void>>
	destroy!: Mock<() => Promise<void>>
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
				const deferred = createDeferred<void>()
				world.startDeferreds.push(deferred)
				return deferred.promise
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
				const deferred = createDeferred<void>()
				world.destroyDeferreds.push({
					resolve: () => {
						recordEffect()
						deferred.resolve()
					},
					reject: (err?: Error) =>
						deferred.reject(err ?? new Error('destroy rejected')),
				})
				return deferred.promise
			}

			if (this._destroyed) {
				return Promise.resolve()
			}

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
	destroy!: Mock<() => Promise<void>>
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

function zwaveOpts(partial: PartialZWaveOptions): PartialZWaveOptions {
	return partial
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

	const serverHostStub = {
		getDriver: () => {
			if (!state.driver) {
				throw new Error('Driver is not available')
			}
			return state.driver
		},
		getConfig: () => state.cfg,
		getHasUserCallbacks: () => false,
		onHardReset: vi.fn(),
		logger: {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			log: vi.fn(),
		},
		serverLogger: {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		},
	} satisfies ZwaveServerHost

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

	it('addExtraLogTransport keeps the JSON transport in the list and raises the level', async () => {
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

	it('multiple extras keep every transport and select the most verbose level', async () => {
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

	it('removeExtraLogTransport re-sends the remaining transports and restores the baseline level', async () => {
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

	it('removing the last extra still re-sends the JSON transport at the baseline level', async () => {
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

	it('the level tracks the most verbose remaining extra regardless of removal order', async () => {
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

	it('a less verbose extra does not lower the configured level', async () => {
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

	it('addExtraLogTransport leaves the driver untouched until it is ready, then applies the registered transport', async () => {
		const { lifecycle, host, world, state } = createHarness({
			serverEnabled: false,
		})
		await lifecycle.connect()
		const driver = world.drivers[0]
		state.driverReadyRaw = false
		driver.updateLogConfig.mockClear()
		const extra = new Transport({})
		lifecycle.addExtraLogTransport(extra, 'debug')
		expect(driver.updateLogConfig).not.toHaveBeenCalled()

		host.onDriverReady.mockImplementationOnce(() => {
			state.driverReadyRaw = true
			return Promise.resolve()
		})
		driver.emit('driver ready')

		expect(driver.updateLogConfig).toHaveBeenCalledWith({
			transports: [world.logTransports[0], extra],
			level: 'debug',
		})
	})

	// A configured level is persisted as an npm numeric rank, so the baseline
	// has to survive the number→name round trip and be re-sent when the last
	// verbose extra is dropped — updateLogConfig merges partial updates, so a
	// missing level would leave the driver stuck at the elevated level.
	it('a numeric configured baseline is restored when the last verbose extra is removed', async () => {
		const { lifecycle, json, driver } = await connectedReadyHarness({
			logLevel: 'verbose',
		})
		const extra = new Transport({})
		lifecycle.addExtraLogTransport(extra, 'debug')
		expect(driver.updateLogConfig).toHaveBeenLastCalledWith({
			transports: [json, extra],
			level: 'debug',
		})
		lifecycle.removeExtraLogTransport(extra)
		expect(driver.updateLogConfig).toHaveBeenLastCalledWith({
			transports: [json],
			level: 'verbose',
		})
	})

	// With no configured level the baseline defaults to zwave-js's documented
	// level, which must be re-sent on removal so the driver returns to it
	// instead of staying at the elevated level.
	it('an omitted baseline returns to the documented default level when the last verbose extra is removed', async () => {
		const { lifecycle, json, driver } = await connectedReadyHarness({
			options: zwaveOpts({ logConfig: { maxFiles: 5 } }),
		})
		const extra = new Transport({})
		lifecycle.addExtraLogTransport(extra, 'debug')
		expect(driver.updateLogConfig).toHaveBeenLastCalledWith({
			transports: [json, extra],
			level: 'debug',
		})
		lifecycle.removeExtraLogTransport(extra)
		expect(driver.updateLogConfig).toHaveBeenLastCalledWith({
			transports: [json],
			level: CONTROLLER_LOGLEVEL,
		})
	})

	// A configured string level is the baseline and must be re-sent verbatim
	// once the verbose extra is removed.
	it('a configured string baseline is preserved across an extra add and removal', async () => {
		const { lifecycle, json, driver } = await connectedReadyHarness({
			options: zwaveOpts({ logConfig: { level: 'warn' } }),
		})
		const extra = new Transport({})
		lifecycle.addExtraLogTransport(extra, 'debug')
		expect(driver.updateLogConfig).toHaveBeenLastCalledWith({
			transports: [json, extra],
			level: 'debug',
		})
		lifecycle.removeExtraLogTransport(extra)
		expect(driver.updateLogConfig).toHaveBeenLastCalledWith({
			transports: [json],
			level: 'warn',
		})
	})

	it('adding or removing transports before connect is a safe no-op', () => {
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

	it('resetBackoff cancels a restart after the driver recovers', async () => {
		const { lifecycle, host } = createHarness()
		lifecycle.backoffRestart()
		lifecycle.resetBackoff()

		await vi.advanceTimersByTimeAsync(1000)

		expect(host.restart).not.toHaveBeenCalled()
	})

	it('backoffRestart aborts and closes when the client is already destroyed', async () => {
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

	it('coalesces two backoff schedules into a single restart', async () => {
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

	it('a healthy replacement fences a still-pending backoff restart', async () => {
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

	it('honours the ZWAVE_PORT env override by forcing the port on', async () => {
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
		const { lifecycle, host, world, state } = createHarness({
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

	it('does not install user callbacks when no clients are connected', async () => {
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

	it('on Driver_InvalidOptions it reports the error but does not back off', async () => {
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

describe('DriverLifecycle — closing during an in-flight connect', () => {
	it('a close before the driver is created leaves no driver and ends closed', async () => {
		const { lifecycle, world, state } = createHarness()
		world.ensureDirHook = () => {
			void lifecycle.close()
		}
		await lifecycle.connect()
		expect(world.drivers).toHaveLength(0)
		expect(state.status).toBe(ZwaveClientStatus.CLOSED)
	})

	it('a close before start leaves the driver unstarted', async () => {
		const { lifecycle, host, world } = createHarness()
		host.hasConnectedClients.mockImplementation(() => {
			void lifecycle.close()
			return Promise.resolve(false)
		})
		await lifecycle.connect()
		expect(world.drivers).toHaveLength(1)
		expect(world.drivers[0].start).not.toHaveBeenCalled()
	})

	it('a close during start ends closed even after the driver was started', async () => {
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

	it('a close while persisting config leaves no driver adopted', async () => {
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
	it('a second connect before driver ready does not build or leak a replacement', async () => {
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

	it('concurrent connect callers coalesce and settle together once the first start settles', async () => {
		const { lifecycle, world, state } = createHarness({
			serverEnabled: false,
		})
		world.startBehavior = 'deferred'

		const first = lifecycle.connect()
		await vi.waitFor(() => expect(world.startDeferreds).toHaveLength(1))
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

	it('concurrent connect callers share the first connect failure and build no second driver', async () => {
		const { lifecycle, world, state, host } = createHarness({
			serverEnabled: false,
		})
		world.startBehavior = 'deferred'

		const first = lifecycle.connect()
		await vi.waitFor(() => expect(world.startDeferreds).toHaveLength(1))
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

	it('a duplicate connect before driver ready builds no replacement', async () => {
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

	it('a reconnect after a start failure builds exactly one fresh driver', async () => {
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
		await vi.waitFor(() => expect(world.startDeferreds).toHaveLength(1))
		const driver0 = world.drivers[0]
		expect(harness.state.driver).toBe(driver0)

		await harness.lifecycle.close(true)
		expect(harness.state.driver).toBeNull()
		harness.state.closed = false

		world.startBehavior = 'deferred'
		const freshPromise = harness.lifecycle.connect()
		await vi.waitFor(() => expect(world.startDeferreds).toHaveLength(2))
		const driver1 = world.drivers[1]
		world.startDeferreds[1].resolve()
		await freshPromise
		expect(harness.state.driver).toBe(driver1)
		expect(harness.state.status).toBe(ZwaveClientStatus.CONNECTED)

		return { ...harness, stalePromise, driver0, driver1 }
	}

	it('a stale start that resolves after a reconnect tears down only its own driver', async () => {
		const { world, state, stalePromise, driver1 } =
			await openCloseReconnectWithStale()

		world.startDeferreds[0].resolve()
		await stalePromise

		expect(world.destroyOrder.filter((d) => d === 'driver')).toHaveLength(1)
		expect(driver1.destroy).not.toHaveBeenCalled()
		expect(state.driver).toBe(driver1)
	})

	it('a stale start that rejects after a reconnect never destroys the replacement or backs off', async () => {
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

describe('DriverLifecycle — cleanup after a failed connect', () => {
	it('no replacement is built until the failed driver finishes tearing down', async () => {
		vi.useFakeTimers()
		try {
			const { lifecycle, world, state, host } = createHarness({
				serverEnabled: false,
			})
			world.startBehavior = 'reject'
			world.startError = new Error('start boom')
			world.destroyBehavior = 'deferred'

			const connectP = lifecycle.connect()

			await vi.waitFor(() =>
				expect(world.destroyDeferreds).toHaveLength(1),
			)
			expect(world.drivers).toHaveLength(1)
			const driver0 = world.drivers[0]
			expect(state.driver).toBe(driver0)
			expect(host.onDriverError).not.toHaveBeenCalled()
			expect(host.restart).not.toHaveBeenCalled()

			const concurrent = lifecycle.connect()
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

	it('a rejected destroy releases terminal ownership so a later connect can retry', async () => {
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
			expect(state.driver).toBeNull()
			expect(world.destroyInvocations).toBe(1)
			expect(world.destroyOrder).toEqual([])
			expect(host.onDriverError).toHaveBeenCalledTimes(1)

			world.startBehavior = 'resolve'
			await lifecycle.connect()
			expect(world.drivers).toHaveLength(2)
			expect(state.driver).toBe(world.drivers[1])
			expect(driver0.destroy).toHaveBeenCalledTimes(1)
		} finally {
			vi.useRealTimers()
		}
	})

	it('a non-Error teardown rejection cannot replace the startup failure or prevent a later retry', async () => {
		const { lifecycle, world, state, host } = createHarness({
			serverEnabled: false,
		})
		const startupError = new Error('start boom')
		world.startBehavior = 'deferred'

		const connect = lifecycle.connect()
		await vi.waitFor(() => expect(world.startDeferreds).toHaveLength(1))
		const driver = world.drivers[0]
		driver.destroy.mockRejectedValueOnce(undefined)
		world.startDeferreds[0].reject(startupError)
		await expect(connect).resolves.toBeUndefined()

		expect(host.onDriverError).toHaveBeenCalledWith(startupError, true)
		expect(state.driver).toBeNull()
		expect(driver.destroy).toHaveBeenCalledTimes(1)

		await expect(lifecycle.close(true)).resolves.toBeUndefined()
		expect(driver.destroy).toHaveBeenCalledTimes(1)
		expect(state.driver).toBeNull()
	})

	it('a close destroy rejection releases the terminal driver without retrying its pending teardown', async () => {
		const { lifecycle, host, world, state } = createHarness({
			serverEnabled: false,
		})
		await lifecycle.connect()
		const driver = world.drivers[0]
		const destroyError = new Error('destroy failed')
		driver.destroy.mockRejectedValueOnce(destroyError)

		await expect(lifecycle.close()).rejects.toBe(destroyError)
		expect(state.driver).toBeNull()
		expect(host.clearRuntimeOnClose).toHaveBeenCalledTimes(1)
		expect(host.finalizeClose).toHaveBeenCalledTimes(1)
		await expect(lifecycle.close(true)).resolves.toBeUndefined()
		expect(driver.destroy).toHaveBeenCalledTimes(1)
	})

	it('an in-flight connect settles after close already attempted terminal teardown', async () => {
		const { lifecycle, world } = createHarness({
			serverEnabled: false,
		})
		world.startBehavior = 'deferred'

		const connect = lifecycle.connect()
		await vi.waitFor(() => expect(world.startDeferreds).toHaveLength(1))
		const driver = world.drivers[0]
		const destroyError = new Error('destroy failed')
		driver.destroy
			.mockRejectedValueOnce(destroyError)
			.mockImplementationOnce(() => new Promise<void>(() => {}))

		await expect(lifecycle.close(true)).rejects.toBe(destroyError)
		world.startDeferreds[0].resolve()

		await expect(connect).resolves.toBeUndefined()
		expect(driver.destroy).toHaveBeenCalledTimes(1)
	})

	it('a stale post-start exit tears down its own driver and never the live replacement', async () => {
		const { lifecycle, world, state } = createHarness({
			serverEnabled: false,
		})
		world.startBehavior = 'deferred'

		const staleP = lifecycle.connect()
		await vi.waitFor(() => expect(world.startDeferreds).toHaveLength(1))

		await lifecycle.close(true)
		state.closed = false
		world.startBehavior = 'deferred'
		const freshP = lifecycle.connect()
		await vi.waitFor(() => expect(world.startDeferreds).toHaveLength(2))
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

describe('DriverLifecycle — logConfig override', () => {
	it('a zwave.options.logConfig override still receives the JSON transport, extra transports and raised level', async () => {
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

	// With no configured logConfig the driver options start with the level unset
	// (connect() lets zwave-js pick its default), and a later, less-verbose extra
	// is clamped to the documented default baseline rather than lowering the level.
	it('a driver with no logConfig connects with the level unset, then clamps a less-verbose extra to the documented default', async () => {
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
			level: CONTROLLER_LOGLEVEL,
		})
	})
})

describe('DriverLifecycle — persisted logConfig immutability', () => {
	it('leaves persisted log settings unchanged while enriching driver options', async () => {
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
		expect(driverLogConfig?.transports).toContain(world.logTransports[0])
		expect(driverLogConfig?.transports).toContain(extra)
		expect(driverLogConfig?.level).toBe('debug')

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

		lifecycle.removeExtraLogTransport(extra)
		await lifecycle.close()
		state.closed = false
		await lifecycle.connect()

		const restarted = world.drivers[1].options.logConfig
		expect(restarted?.level).toBe('info')
		expect(restarted?.transports).toEqual([world.logTransports[1]])

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

	it('destroys the server before the driver', async () => {
		const { lifecycle, world } = createHarness({ serverEnabled: true })
		await lifecycle.connect()
		await lifecycle.close()
		expect(world.destroyOrder).toEqual(['server', 'driver'])
	})

	it('does not finalize when keepListeners is true', async () => {
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

describe('DriverLifecycle — stale driver events after close', () => {
	it('ignores a driver-ready from a closed generation', async () => {
		const { lifecycle, host, world } = createHarness({
			serverEnabled: false,
		})
		await lifecycle.connect()
		const driver = world.drivers[0]
		await lifecycle.close()

		host.onDriverReady = vi.fn(async () => {})
		driver.emit('driver ready')
		await Promise.resolve()
		expect(host.onDriverReady).not.toHaveBeenCalled()
	})

	it('ignores a late driver error once the generation has moved on', async () => {
		const { lifecycle, host, world } = createHarness({
			serverEnabled: false,
		})
		await lifecycle.connect()
		const driver = world.drivers[0]
		await lifecycle.close()

		driver.emit('error', new Error('late'))

		expect(host.onDriverError).not.toHaveBeenCalled()
	})
})

describe('DriverLifecycle — driver-ready failures', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	it('reports a current driver-ready initialization failure and restarts', async () => {
		const { lifecycle, host, world, state } = createHarness({
			serverEnabled: false,
		})
		const readyError = new Error('ready initialization failed')
		host.onDriverReady.mockImplementationOnce(() => {
			state.driverReady = true
			return Promise.reject(readyError)
		})
		await lifecycle.connect()

		world.drivers[0].emit('driver ready')
		world.drivers[0].emit('all nodes ready')
		await vi.waitFor(() => {
			expect(state.driverReady).toBe(false)
		})

		expect(host.onScanComplete).not.toHaveBeenCalled()
		expect(host.onDriverError).toHaveBeenCalledWith(readyError, true)
		expect(host.restart).not.toHaveBeenCalled()
		await vi.advanceTimersByTimeAsync(1000)
		expect(host.restart).toHaveBeenCalledTimes(1)
	})

	it('defers scan completion until matching ready initialization succeeds', async () => {
		const { lifecycle, host, world } = createHarness({
			serverEnabled: false,
		})
		const ready = createDeferred<void>()
		host.onDriverReady.mockReturnValueOnce(ready.promise)
		await lifecycle.connect()

		world.drivers[0].emit('driver ready')
		world.drivers[0].emit('all nodes ready')
		expect(host.onScanComplete).not.toHaveBeenCalled()

		ready.resolve()
		await Promise.resolve()
		await Promise.resolve()

		expect(host.onScanComplete).toHaveBeenCalledTimes(1)
	})

	it('does not carry pending scan completion into a newer ready event', async () => {
		const { lifecycle, host, world } = createHarness({
			serverEnabled: false,
		})
		const firstReady = createDeferred<void>()
		const secondReady = createDeferred<void>()
		host.onDriverReady
			.mockReturnValueOnce(firstReady.promise)
			.mockReturnValueOnce(secondReady.promise)
		await lifecycle.connect()

		world.drivers[0].emit('driver ready')
		world.drivers[0].emit('all nodes ready')
		world.drivers[0].emit('driver ready')
		firstReady.resolve()
		await Promise.resolve()
		await Promise.resolve()
		expect(host.onScanComplete).not.toHaveBeenCalled()

		secondReady.resolve()
		await Promise.resolve()
		await Promise.resolve()
		expect(host.onScanComplete).not.toHaveBeenCalled()

		world.drivers[0].emit('all nodes ready')
		expect(host.onScanComplete).toHaveBeenCalledTimes(1)
	})

	it('keeps newer ready state when an older same-generation initialization rejects', async () => {
		const { lifecycle, host, world, state } = createHarness({
			serverEnabled: false,
		})
		const firstReady = createDeferred<void>()
		host.onDriverReady
			.mockImplementationOnce(() => {
				state.driverReady = true
				return firstReady.promise
			})
			.mockImplementationOnce(() => {
				state.driverReady = true
				return Promise.resolve()
			})
		await lifecycle.connect()

		world.drivers[0].emit('driver ready')
		world.drivers[0].emit('driver ready')
		firstReady.reject(new Error('superseded ready failure'))
		await vi.advanceTimersByTimeAsync(60000)

		expect(state.driverReady).toBe(true)
		expect(host.onDriverError).not.toHaveBeenCalled()
		expect(host.restart).not.toHaveBeenCalled()
	})

	it('ignores pending ready failure after a fatal driver error', async () => {
		const { lifecycle, host, world } = createHarness({
			serverEnabled: false,
		})
		const ready = createDeferred<void>()
		host.onDriverReady.mockReturnValueOnce(ready.promise)
		await lifecycle.connect()
		const fatalError = new ZWaveError(
			'driver failed',
			ZWaveErrorCodes.Driver_Failed,
		)

		world.drivers[0].emit('driver ready')
		world.drivers[0].emit('error', fatalError)
		ready.reject(new Error('superseded ready failure'))
		await vi.advanceTimersByTimeAsync(60000)

		expect(host.onDriverError).toHaveBeenCalledTimes(1)
		expect(host.onDriverError).toHaveBeenCalledWith(fatalError, false)
	})

	it('ignores a driver-ready failure after that generation closes', async () => {
		const { lifecycle, host, world } = createHarness({
			serverEnabled: false,
		})
		const ready = createDeferred<void>()
		host.onDriverReady.mockReturnValueOnce(ready.promise)
		await lifecycle.connect()

		world.drivers[0].emit('driver ready')
		await lifecycle.close()
		ready.reject(new Error('stale ready failure'))
		await Promise.resolve()

		expect(host.onDriverError).not.toHaveBeenCalled()
		await vi.advanceTimersByTimeAsync(60000)
		expect(host.restart).not.toHaveBeenCalled()
	})
})

describe('DriverLifecycle — driver options', () => {
	it('isolates persisted storage settings from driver-only changes', async () => {
		const { lifecycle, state, world } = createHarness({
			serverEnabled: false,
			options: zwaveOpts({
				storage: {
					cacheDir: '/persisted/cache',
					throttle: 'normal',
				},
			}),
		})
		await lifecycle.connect()

		const driverStorage = requireDefined(
			world.drivers[0].options.storage,
			'expected driver storage options',
		)
		driverStorage.cacheDir = '/external/cache'
		driverStorage.throttle = 'fast'

		expect(state.cfg.options?.storage).toEqual({
			cacheDir: '/persisted/cache',
			throttle: 'normal',
		})
	})

	it('builds scale preferences from cfg.scales', async () => {
		const { lifecycle, world } = createHarness({
			serverEnabled: false,
			scales: [
				{
					key: 'temperature',
					sensor: 'Air temperature',
					label: 'Celsius',
				},
			],
		})
		await lifecycle.connect()
		expect(world.drivers[0].options.preferences).toEqual({
			scales: { temperature: 'Celsius' },
		})
	})

	it('provides driver host filesystem bindings when running in a pkg bundle', async () => {
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

	it('merges registered extra log transports and raises the log level to the most verbose', async () => {
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

	it('forwards driver log stream data to the host debug output', async () => {
		const { lifecycle, host, world } = createHarness({
			serverEnabled: false,
		})
		await lifecycle.connect()
		const transport = world.logTransports[0]
		expect(transport).toBeDefined()
		transport.stream.emit('data', { message: 'hello world' })
		expect(host.emitDebug).toHaveBeenCalledWith('hello world')
	})

	it('does not connect when the client is destroyed during start', async () => {
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

describe('DriverLifecycle — error reporting on a failed connect', () => {
	it('does not report the error when a close races a failed start', async () => {
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

	it('closes without reporting the error when the client is destroyed during a failed start', async () => {
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
