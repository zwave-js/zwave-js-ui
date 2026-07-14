import { Driver } from 'zwave-js'
import type {
	OTWFirmwareUpdateProgress,
	OTWFirmwareUpdateResult,
	PartialZWaveOptions,
} from 'zwave-js'
import {
	ZWaveErrorCodes,
	isZWaveError,
	CONTROLLER_LOGLEVEL,
} from '@zwave-js/core'
import type { LogConfig } from '@zwave-js/core'
import { createDefaultTransportFormat } from '@zwave-js/core/bindings/log/node'
import { JSONTransport } from '@zwave-js/log-transport-json'
import type { ZwavejsServer } from '@zwave-js/server'
import type Transport from 'winston-transport'

import * as LogManager from '../logger.ts'
import * as utils from '../utils.ts'
import { applyExternalDriverSettings } from '../externalSettings.ts'
import { configDbDir, logsDir, storeDir } from '../../config/app.ts'
import { PkgFsBindings } from '../PkgFsBindings.ts'
import { deviceConfigPriorityDir } from '../Constants.ts'
import ZwaveServerManager, {
	type ZwaveServerHost,
} from '../../hass/ZwaveServerManager.ts'
import {
	ZwaveClientStatus,
	type ZwaveConfig,
	type InclusionUserCallbacks,
} from './ports.ts'

const logger = LogManager.module('Z-Wave')

/** Constructor-injected builders for the external objects the lifecycle constructs, so callers (production or tests) supply them without module-level mocking */
export interface DriverLifecycleDeps {
	createDriver(port: string, options: PartialZWaveOptions): Driver
	createLogTransport(): JSONTransport
	createServerManager(host: ZwaveServerHost): ZwaveServerManager
	ensureDir(dir: string): Promise<void>
}

const defaultDriverLifecycleDeps: DriverLifecycleDeps = {
	createDriver: (port, options) => new Driver(port, options),
	createLogTransport: () => new JSONTransport(),
	createServerManager: (host) => new ZwaveServerManager(host),
	ensureDir: (dir) => utils.ensureDir(dir),
}

/** Every method resolves live client state so nothing is captured at construction across driver/config swaps */
export interface DriverLifecycleHost {
	getConfig(): ZwaveConfig
	getDriver(): Driver | null
	setDriver(driver: Driver | null): void
	isDriverReady(): boolean
	/** Raw `_driverReady` field without the driver/closed checks `isDriverReady` applies */
	isDriverReadyRaw(): boolean
	isClosed(): boolean
	setClosed(closed: boolean): void
	isDestroyed(): boolean
	setStatus(status: ZwaveClientStatus): void
	/** Fires `driverStatus` when the value changes */
	setDriverReady(ready: boolean): void
	hasConnectedClients(): Promise<boolean>
	emitDebug(message: string): void
	/** Callbacks attached only when the server is disabled, so inclusion still works over MQTT */
	getInclusionUserCallbacks(): InclusionUserCallbacks
	installUserCallbacks(): void
	persistConfig(): Promise<void>
	restart(): Promise<void>
	buildServerHost(): ZwaveServerHost
	/** Runs mid-close, after the lifecycle's own timers are cleared and before the server/driver are destroyed */
	clearRuntimeOnClose(): void
	finalizeClose(): void
	/** Lifecycle drives only the generation, leaving node-registry restoration to ZwaveClient */
	onDriverReady(generation: number): Promise<void>
	onDriverError(error: unknown, skipRestart: boolean): void
	onScanComplete(): void
	onBootLoaderReady(): void
	onOTWFirmwareUpdateProgress(progress: OTWFirmwareUpdateProgress): void
	onOTWFirmwareUpdateFinished(result: OTWFirmwareUpdateResult): void
}

export class DriverLifecycle {
	private readonly host: DriverLifecycleHost

	/** Bumped when a new driver starts connecting and when the client closes, so in-flight work from an obsolete driver detects the mismatch and aborts */
	private _generation = 0

	private _backoffRetry = 0
	private _restartTimeout: NodeJS.Timeout | null = null

	/** In-flight startup promise the current generation's duplicate connect coalesces onto instead of building a second Driver */
	private _activeConnect: Promise<void> | null = null

	/** Generation `_activeConnect` belongs to, so a duplicate connect coalesces only while this still equals `_generation` */
	private _activeConnectGeneration = 0

	private _extraLogTransports: Array<{
		transport: Transport
		level?: string
	}> = []

	/** JSON-socket transport for the current generation, re-sent first on every live add/remove because `updateLogConfig` replaces the driver's whole custom transport list */
	private _driverLogTransport: JSONTransport | null = null

	/** Baseline level name captured before any extra-transport elevation, so removing the last verbose extra recomputes back to it instead of leaving the driver stuck high. Defaults to the exported `CONTROLLER_LOGLEVEL`, which matches this app's configured default level, when the driver config carries no explicit level. */
	private _baseLogLevel: string = CONTROLLER_LOGLEVEL

	private _serverManager?: ZwaveServerManager

	private readonly deps: DriverLifecycleDeps

	constructor(
		host: DriverLifecycleHost,
		deps: DriverLifecycleDeps = defaultDriverLifecycleDeps,
	) {
		this.host = host
		this.deps = deps
	}

	get generation(): number {
		return this._generation
	}

	/** Lazily builds a standalone fallback manager on first access so a directly-constructed client's server lifecycle works with no coordinator to adopt one */
	get zwaveServer(): ZwaveServerManager {
		if (!this._serverManager) {
			this._serverManager = this.deps.createServerManager(
				this.host.buildServerHost(),
			)
		}
		return this._serverManager
	}

	get serverManager(): ZwaveServerManager | undefined {
		return this._serverManager
	}

	get server(): ZwavejsServer | null {
		return this._serverManager?.server ?? null
	}

	set server(value: ZwavejsServer | null) {
		// Route through the lazy accessor so a client assigning `server` before create() still has a manager to hold it
		this.zwaveServer.server = value
	}

	adoptServerManager(manager: ZwaveServerManager): void {
		// Set before the driver connects so create/startIfNeeded/destroy all drive the HA-owned manager
		this._serverManager = manager
	}

	createServer(): void {
		// Construct without starting so the server exists before the driver becomes ready
		this.zwaveServer.create()
	}

	enableStatistics(): void {
		const driver = this.host.getDriver()
		const cfg = this.host.getConfig()
		if (driver) {
			driver.enableStatistics({
				applicationName:
					utils.pkgJson.name +
					(cfg.serverEnabled ? ' / zwave-js-server' : ''),
				applicationVersion: utils.pkgJson.version,
			})
			logger.info('Zwavejs usage statistics ENABLED')
		}

		logger.warn(
			'Zwavejs driver is not ready yet, statistics will be enabled on driver initialization',
		)
	}

	disableStatistics(): void {
		const driver = this.host.getDriver()
		if (driver) {
			driver.disableStatistics()
			logger.info('Zwavejs usage statistics DISABLED')
		}

		logger.warn(
			'Zwavejs driver is not ready yet, statistics will be disabled on driver initialization',
		)
	}

	addExtraLogTransport(transport: Transport, level?: string): void {
		// Store on the lifecycle so the transport survives driver restarts
		this._extraLogTransports.push({ transport, level })
		this.applyRuntimeLogConfig()
	}

	removeExtraLogTransport(transport: Transport): void {
		const idx = this._extraLogTransports.findIndex(
			(e) => e.transport === transport,
		)
		if (idx !== -1) {
			this._extraLogTransports.splice(idx, 1)
		}
		this.applyRuntimeLogConfig()
	}

	private computeRuntimeLogTransports(): Transport[] {
		const transports: Transport[] = []
		if (this._driverLogTransport) {
			transports.push(this._driverLogTransport)
		}
		for (const extra of this._extraLogTransports) {
			transports.push(extra.transport)
		}
		return transports
	}

	private computeRuntimeLogLevel(): string {
		let level = this._baseLogLevel
		let bestRank = utils.logLevelRank(level)
		for (const extra of this._extraLogTransports) {
			if (!extra.level) continue
			const rank = utils.logLevelRank(extra.level)
			if (rank > bestRank) {
				bestRank = rank
				level = extra.level
			}
		}
		return level
	}

	private applyRuntimeLogConfig(): void {
		// No-op until the driver is ready, since connect() builds the identical config into the driver options up front
		const driver = this.host.getDriver()
		if (!driver || !this.host.isDriverReadyRaw()) {
			return
		}
		// Always resend the level: updateLogConfig merges partial updates, so omitting it would leave a previously elevated level in place once the last verbose extra is removed
		const config: Partial<LogConfig> = {
			transports: this.computeRuntimeLogTransports(),
			level: this.computeRuntimeLogLevel(),
		}
		driver.updateLogConfig(config)
	}

	resetBackoff(): void {
		this._backoffRetry = 0
	}

	backoffRestart(): void {
		// Abort the restart when the client is half-closed
		if (this.checkIfDestroyed()) {
			return
		}

		const timeout = Math.min(2 ** this._backoffRetry * 1000, 15000)
		this._backoffRetry++

		logger.info(
			`Restarting client in ${timeout / 1000} seconds, retry ${
				this._backoffRetry
			}`,
		)

		// Clear any pending restart so repeated schedules coalesce into one and don't leak a timer that fires twice
		if (this._restartTimeout) {
			clearTimeout(this._restartTimeout)
			this._restartTimeout = null
		}

		// Fence the callback to the generation at schedule time so a close/restart or replacement driver can't fire a stale restart
		const generation = this._generation
		this._restartTimeout = setTimeout(() => {
			this._restartTimeout = null
			if (this._generation !== generation) {
				return
			}
			this.host.restart().catch((error: Error) => {
				logger.error(`Error while restarting driver: ${error.message}`)
			})
		}, timeout)
	}

	checkIfDestroyed(): boolean {
		if (this.host.isDestroyed()) {
			logger.debug(
				`Client listening on '${this.host.getConfig().port}' is destroyed, closing`,
			)
			this.close(true).catch((error: Error) => {
				logger.error(`Error while closing driver: ${error.message}`)
			})
			return true
		}

		return false
	}

	async connect(): Promise<void> {
		const cfg = this.host.getConfig()

		// When ZWAVE_PORT env var is set, force enable and override port
		if (process.env.ZWAVE_PORT) {
			cfg.enabled = true
			cfg.port = process.env.ZWAVE_PORT
		}

		if (cfg.enabled === false) {
			logger.info('Z-Wave driver DISABLED')
			return
		}

		if (this.host.isDriverReady()) {
			logger.info(`Driver already connected to ${cfg.port}`)
			return
		}

		// Bail when a failed connect's reconnect timeout races an already-closed client
		if (this.host.isClosed() || this.checkIfDestroyed()) {
			return
		}

		if (!cfg?.port) {
			logger.warn('Z-Wave driver not inited, no port configured')
			return
		}

		// Capture the narrowed port before the host calls below, which reset TypeScript's property narrowing
		const port = cfg.port

		// Coalesce a duplicate connect onto the in-flight startup of the current generation so callers share its outcome and no second Driver is built
		if (
			this._activeConnect &&
			this._activeConnectGeneration === this._generation
		) {
			logger.info(`Driver is already connecting to ${cfg.port}`)
			return this._activeConnect
		}

		// Skip building a replacement while a driver already exists (connecting but not yet ready) after `_activeConnect` cleared; only close/restart nulls that field first
		if (this.host.getDriver()) {
			logger.info(`Driver is already connecting to ${cfg.port}`)
			return
		}

		// Track the startup as `_activeConnect` so concurrent callers coalesce onto it
		const startup = this._startDriver(cfg, port)
		this._activeConnect = startup
		this._activeConnectGeneration = this._generation
		try {
			await startup
		} finally {
			// Clear only if a later connect/close hasn't already replaced it
			if (this._activeConnect === startup) {
				this._activeConnect = null
			}
		}
	}

	/** Catches internally and backs off instead of rejecting so a coalesced connect() caller sees the same no-throw completion */
	private async _startDriver(cfg: ZwaveConfig, port: string): Promise<void> {
		// Bump the generation so any obsolete driver's late callbacks detect the change and abort
		const generation = ++this._generation

		let shouldUpdateSettings = false

		const priorityDir =
			cfg.deviceConfigPriorityDir || deviceConfigPriorityDir

		// extend options with hidden `options`
		const storage: NonNullable<PartialZWaveOptions['storage']> = {
			cacheDir: storeDir,
			deviceConfigPriorityDir: priorityDir,
		}
		const logConfig = utils.buildLogConfig(cfg, logsDir)
		const features: NonNullable<PartialZWaveOptions['features']> = {
			unresponsiveControllerRecovery: cfg.disableControllerRecovery
				? false
				: true,
			watchdog: cfg.disableWatchdog ? false : true,
		}
		const zwaveOptions: PartialZWaveOptions = {
			bootloaderMode: cfg.allowBootloaderOnly ? 'allow' : 'recover',
			storage,
			// https://zwave-js.github.io/node-zwave-js/#/api/driver?id=logconfig
			logConfig,
			emitValueUpdateAfterSetValue: true,
			apiKeys: {
				firmwareUpdateService:
					'421e29797c3c2926f84efc737352d6190354b3b526a6dce6633674dd33a8a4f964c794f5',
			},
			timeouts: {
				report: cfg.higherReportsTimeout ? 10000 : undefined,
				sendToSleep: cfg.sendToSleepTimeout,
				response: cfg.responseTimeout,
			},
			features,
			userAgent: {
				[utils.pkgJson.name]: utils.pkgJson.version,
			},
			disableOptimisticValueUpdate: cfg.disableOptimisticValueUpdate,
		}

		// when no env is specified copy config db to store dir
		// fixes issues with pkg (and no more need to set this env on docker)
		if (!process.env.ZWAVEJS_EXTERNAL_CONFIG) {
			storage.deviceConfigExternalDir = configDbDir
		}

		if (cfg.rf) {
			const { region, txPower, maxLongRangePowerlevel } = cfg.rf

			let { autoPowerlevels } = cfg.rf
			const rf: NonNullable<PartialZWaveOptions['rf']> = {}
			zwaveOptions.rf = rf

			if (typeof region === 'number') {
				rf.region = region
			}

			if (
				autoPowerlevels === undefined &&
				typeof maxLongRangePowerlevel !== 'number' &&
				typeof txPower?.powerlevel !== 'number'
			) {
				// if autoPowerlevels is undefined and maxLongRangePowerlevel is not a number (likely '' or undefined), assume autoPowerlevels is true
				autoPowerlevels = true
				cfg.rf.autoPowerlevels = true
				shouldUpdateSettings = true
			}

			if (autoPowerlevels) {
				rf.maxLongRangePowerlevel = 'auto'
				rf.txPower ??= {}
				rf.txPower.powerlevel = 'auto'
			}

			if (
				!autoPowerlevels &&
				(maxLongRangePowerlevel === 'auto' ||
					typeof maxLongRangePowerlevel === 'number')
			) {
				rf.maxLongRangePowerlevel = maxLongRangePowerlevel
			}

			if (txPower) {
				if (
					!autoPowerlevels &&
					(txPower.powerlevel === 'auto' ||
						typeof txPower.powerlevel === 'number')
				) {
					rf.txPower ??= {}
					rf.txPower.powerlevel = txPower.powerlevel
				}

				if (typeof txPower.measured0dBm === 'number') {
					rf.txPower ??= {}
					rf.txPower.measured0dBm = txPower.measured0dBm
				}
			}
		}

		if ((process as NodeJS.Process & { pkg?: unknown }).pkg) {
			// Ensure Z-Wave JS is looking for the configuration files in the right place
			// when running inside a pkg bundle
			zwaveOptions.host ??= {}
			zwaveOptions.host.fs = new PkgFsBindings()
		}

		// ensure deviceConfigPriorityDir exists to prevent warnings #2374
		// lgtm [js/path-injection]
		await this.deps.ensureDir(priorityDir)

		if (this._generation !== generation) {
			return
		}

		// when not set let zwavejs handle this based on the environment
		if (typeof cfg.enableSoftReset === 'boolean') {
			features.softReset = cfg.enableSoftReset
		}

		// when server is not enabled, disable the user callbacks set/remove
		// so it can be used through MQTT
		if (!cfg.serverEnabled) {
			zwaveOptions.inclusionUserCallbacks =
				this.host.getInclusionUserCallbacks()
		}

		if (cfg.scales) {
			const preferences = utils.buildPreferences(cfg)
			if (preferences) {
				zwaveOptions.preferences = preferences
			}
		}

		Object.assign(zwaveOptions, cfg.options)

		// Clone logConfig before the enrichment below: `Object.assign(cfg.options)` above can alias it onto the persisted `cfg.options.logConfig`, so in-place mutation would leak driver-only transports/level into the user's saved config
		if (zwaveOptions.logConfig) {
			zwaveOptions.logConfig = { ...zwaveOptions.logConfig }
		}

		let s0Key: string | undefined

		// back compatibility
		if (cfg.networkKey) {
			s0Key = cfg.networkKey
			delete cfg.networkKey
		}

		cfg.securityKeys = cfg.securityKeys || {}

		// update settings to fix compatibility
		if (s0Key && !cfg.securityKeys.S0_Legacy) {
			cfg.securityKeys.S0_Legacy = s0Key
			shouldUpdateSettings = true
		}

		utils.parseSecurityKeys(cfg, zwaveOptions)

		// Apply storage, presets, logFilename and forceConsole directly to driver options since they aren't in ZwaveConfig
		applyExternalDriverSettings(zwaveOptions)

		const logTransport = this.deps.createLogTransport()
		logTransport.format = createDefaultTransportFormat(true, false)

		// Bind this generation's JSON-socket transport so live add/remove re-sends it in the full replacement list
		this._driverLogTransport = logTransport

		// Enrich the driver-only clone via the same helpers as the runtime path so startup and live configs can't diverge
		const finalLogConfig = zwaveOptions.logConfig
		if (finalLogConfig) {
			// buildLogConfig stores the configured level as a numeric rank, so resolve it back to a name; fall back to the CONTROLLER_LOGLEVEL default when the config carries no level
			this._baseLogLevel =
				utils.logLevelName(finalLogConfig.level) ?? CONTROLLER_LOGLEVEL
			finalLogConfig.transports = this.computeRuntimeLogTransports()
			finalLogConfig.level = this.computeRuntimeLogLevel()
		} else {
			this._baseLogLevel = CONTROLLER_LOGLEVEL
		}

		logTransport.stream.on('data', (data: any) => {
			this.host.emitDebug(data.message.toString())
		})

		// Hold the exact instance this generation creates so a stale/error exit tears down this driver rather than a newer generation's replacement
		let createdDriver: Driver | null = null

		try {
			if (shouldUpdateSettings) {
				await this.host.persistConfig()
				if (this._generation !== generation) {
					return
				}
			}
			// Constructing the Driver can throw, so keep it inside the try/catch that destroys it on a failed connect
			const driver = this.deps.createDriver(port, zwaveOptions)
			createdDriver = driver
			this.host.setDriver(driver)
			driver.on('error', (error) =>
				this.dispatchDriverError(generation, error),
			)
			driver.on('driver ready', () =>
				this.dispatchDriverReady(generation),
			)
			driver.on('all nodes ready', () =>
				this.dispatchScanComplete(generation),
			)
			driver.on('bootloader ready', () =>
				this.dispatchBootLoaderReady(generation),
			)
			driver.on('firmware update progress', (progress) =>
				this.dispatchOTWFirmwareUpdateProgress(generation, progress),
			)
			driver.on('firmware update finished', (result) =>
				this.dispatchOTWFirmwareUpdateFinished(generation, result),
			)

			logger.info(`Connecting to ${port}`)

			// setup user callbacks only if there are connected clients
			const hasConnectedClients = await this.host.hasConnectedClients()

			if (this._generation !== generation) {
				await this.teardownConnectDriver(driver)
				return
			}

			if (hasConnectedClients) {
				this.host.installUserCallbacks()
			}

			await driver.start()

			if (this._generation !== generation) {
				await this.teardownConnectDriver(driver)
				return
			}

			if (this.checkIfDestroyed()) {
				return
			}

			if (cfg.serverEnabled) {
				this.createServer()
			}

			if (cfg.enableStatistics) {
				this.enableStatistics()
			}

			this.host.setStatus(ZwaveClientStatus.CONNECTED)
		} catch (error) {
			// Tear down the instance this generation created and await it so the failed driver releases the port before backoff builds a replacement
			if (createdDriver) {
				await this.teardownConnectDriver(createdDriver, error)
			}

			if (this._generation !== generation) {
				return
			}

			if (this.checkIfDestroyed()) {
				return
			}

			this.host.onDriverError(error, true)

			if (
				!isZWaveError(error) ||
				error.code !== ZWaveErrorCodes.Driver_InvalidOptions
			) {
				this.backoffRestart()
			} else {
				logger.error(
					`Invalid options for driver: ${error.message}`,
					error,
				)
			}
		}
	}

	/** Awaits destroy() before clearing the host's driver field so the failed driver releases the serial port before a retry or coalesced connect builds a replacement */
	private async teardownConnectDriver(
		driver: Driver,
		cause?: unknown,
	): Promise<void> {
		try {
			await driver.destroy()
		} catch (err) {
			logger.error(
				`Error while destroying driver ${(err as Error).message}`,
				cause,
			)
			// Keep this instance as owner so a later close/retry can destroy it again instead of stranding the port it may still hold
			return
		}
		if (this.host.getDriver() === driver) {
			this.host.setDriver(null)
		}
	}

	/** Idempotent and safe to retry */
	async close(keepListeners = false): Promise<void> {
		// Bump the generation so a driver that becomes ready or errors after this cannot mutate replacement state
		this._generation++

		// Stop a post-close duplicate connect from coalescing onto the superseded startup
		this._activeConnect = null

		this.host.setStatus(ZwaveClientStatus.CLOSED)
		this.host.setClosed(true)
		this.host.setDriverReady(false)

		if (this._restartTimeout) {
			clearTimeout(this._restartTimeout)
			this._restartTimeout = null
		}

		this.host.clearRuntimeOnClose()

		if (this._serverManager) {
			await this._serverManager.destroy()
		}

		const driver = this.host.getDriver()
		if (driver) {
			await driver.destroy()
			this.host.setDriver(null)
		}

		if (!keepListeners) {
			this.host.finalizeClose()
		}

		logger.info('Client closed')
	}

	// Generation-guarded dispatch drops events from an obsolete driver generation
	private dispatchDriverReady(generation: number): void {
		if (this._generation !== generation) {
			return
		}
		void this.host.onDriverReady(generation)
	}

	private dispatchDriverError(generation: number, error: Error): void {
		if (this._generation !== generation) {
			return
		}
		this.host.onDriverError(error, false)
	}

	private dispatchScanComplete(generation: number): void {
		if (this._generation !== generation) {
			return
		}
		this.host.onScanComplete()
	}

	private dispatchBootLoaderReady(generation: number): void {
		if (this._generation !== generation) {
			return
		}
		this.host.onBootLoaderReady()
	}

	private dispatchOTWFirmwareUpdateProgress(
		generation: number,
		progress: OTWFirmwareUpdateProgress,
	): void {
		if (this._generation !== generation) {
			return
		}
		this.host.onOTWFirmwareUpdateProgress(progress)
	}

	private dispatchOTWFirmwareUpdateFinished(
		generation: number,
		result: OTWFirmwareUpdateResult,
	): void {
		if (this._generation !== generation) {
			return
		}
		this.host.onOTWFirmwareUpdateFinished(result)
	}
}
