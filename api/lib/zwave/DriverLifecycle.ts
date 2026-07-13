/**
 * Owns the low-level lifecycle of one `zwave-js` {@link Driver} for `ZwaveClient`:
 * creation, `@zwave-js/server` coordination, backoff restarts, statistics, log
 * transports and idempotent teardown.
 *
 * A monotonic generation counter lets late `driver ready`/`error`/`all nodes
 * ready`/OTW callbacks from an obsolete driver be ignored so they can't mutate a
 * replacement driver's state. All client state is reached through
 * {@link DriverLifecycleHost}, so this service never imports `ZwaveClient` (no
 * import cycle) and every accessor resolves live state across driver/config swaps.
 */

import { Driver } from 'zwave-js'
import type {
	OTWFirmwareUpdateProgress,
	OTWFirmwareUpdateResult,
	PartialZWaveOptions,
} from 'zwave-js'
import { ZWaveErrorCodes, isZWaveError } from '@zwave-js/core'
import { createDefaultTransportFormat } from '@zwave-js/core/bindings/log/node'
import { JSONTransport } from '@zwave-js/log-transport-json'
import type { ZwavejsServer } from '@zwave-js/server'

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

// Least-to-most verbose ordering so the most verbose extra-transport level wins
const LOG_LEVEL_ORDER = ['error', 'warn', 'info', 'verbose', 'debug', 'silly']

/** Narrow port into `ZwaveClient`; every method resolves live client state so nothing is captured at construction across driver/config swaps */
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
	/** Node-registry restoration stays on `ZwaveClient`; the lifecycle only drives the generation */
	onDriverReady(generation: number): Promise<void>
	onDriverError(error: unknown, skipRestart: boolean): void
	onScanComplete(): void
	onBootLoaderReady(): void
	onOTWFirmwareUpdateProgress(progress: OTWFirmwareUpdateProgress): void
	onOTWFirmwareUpdateFinished(result: OTWFirmwareUpdateResult): void
}

export class DriverLifecycle {
	private readonly host: DriverLifecycleHost

	/** Bumped when a new driver starts connecting and when the client closes, so in-flight work from an obsolete driver detects the mismatch and aborts; never reset by init() */
	private _generation = 0

	private _backoffRetry = 0
	private _restartTimeout: NodeJS.Timeout | null = null

	/** In-flight startup promise for the current connect generation; a duplicate connect coalesces onto this exact promise instead of returning a premature success or building a second Driver */
	private _activeConnect: Promise<void> | null = null

	/** Generation `_activeConnect` belongs to; a duplicate connect only coalesces while this equals `_generation`, so once close/connect bumps it a later connect builds a new driver */
	private _activeConnectGeneration = 0

	private _extraLogTransports: Array<{ transport: any; level?: string }> = []

	/** JSON-socket transport for the current driver generation; `updateLogConfig({transports})` replaces the driver's whole custom list, so every live add/remove must re-send this one first or drop the debug stream */
	private _driverLogTransport: JSONTransport | null = null

	/** Configured log level captured before any extra-transport elevation, so removing a verbose extra recomputes back to this baseline instead of leaving the driver stuck high */
	private _baseLogLevel: string | undefined = undefined

	private _serverManager?: ZwaveServerManager

	constructor(host: DriverLifecycleHost) {
		this.host = host
	}

	get generation(): number {
		return this._generation
	}

	/**
	 * The lifecycle-managed `@zwave-js/server` subsystem. In production this is
	 * the HA-owned manager adopted via {@link adoptServerManager}; a
	 * directly-constructed client lazily builds a standalone fallback here on
	 * first access so its server lifecycle keeps working with no coordinator.
	 */
	get zwaveServer(): ZwaveServerManager {
		if (!this._serverManager) {
			this._serverManager = new ZwaveServerManager(
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

	/**
	 * Adopt the HA-owned server manager. Called by `HomeAssistantManager` once,
	 * before the driver connects, so `create()/startIfNeeded()/destroy()` all
	 * drive the manager the coordinator owns.
	 */
	adoptServerManager(manager: ZwaveServerManager): void {
		this._serverManager = manager
	}

	/** Constructs but does not start the server; called from connect() only when serverEnabled, so the server exists before the driver becomes ready */
	createServer(): void {
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

	/** Registers an extra log transport that persists across driver restarts */
	addExtraLogTransport(transport: any, level?: string): void {
		this._extraLogTransports.push({ transport, level })
		this.applyRuntimeLogConfig()
	}

	removeExtraLogTransport(transport: any): void {
		const idx = this._extraLogTransports.findIndex(
			(e) => e.transport === transport,
		)
		if (idx !== -1) {
			this._extraLogTransports.splice(idx, 1)
		}
		this.applyRuntimeLogConfig()
	}

	/** Full transport list (JSON-socket transport first, then extras); `updateLogConfig({transports})` replaces the driver's custom transports wholesale, so a partial list drops the socket stream or other extras */
	private computeRuntimeLogTransports(): any[] {
		const transports: any[] = []
		if (this._driverLogTransport) {
			transports.push(this._driverLogTransport)
		}
		for (const extra of this._extraLogTransports) {
			transports.push(extra.transport)
		}
		return transports
	}

	/** Configured base level raised to the most verbose registered extra, recomputed from baseline so dropping a verbose extra restores the configured level */
	private computeRuntimeLogLevel(): string | undefined {
		let level = this._baseLogLevel
		let bestIdx =
			typeof level === 'string' ? LOG_LEVEL_ORDER.indexOf(level) : -1
		for (const extra of this._extraLogTransports) {
			if (!extra.level) continue
			const idx = LOG_LEVEL_ORDER.indexOf(extra.level)
			if (idx > bestIdx) {
				bestIdx = idx
				level = extra.level
			}
		}
		return level
	}

	/** No-op until the driver is ready, since connect() builds the identical config into the driver options up front */
	private applyRuntimeLogConfig(): void {
		const driver = this.host.getDriver()
		if (!driver || !this.host.isDriverReadyRaw()) {
			return
		}
		const config: any = {
			transports: this.computeRuntimeLogTransports(),
		}
		const level = this.computeRuntimeLogLevel()
		if (level) {
			config.level = level
		}
		driver.updateLogConfig(config)
	}

	resetBackoff(): void {
		this._backoffRetry = 0
	}

	backoffRestart(): void {
		// fix edge case where client is half closed and restart is called
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

	/**
	 * Checks if the client is destroyed and if so closes it.
	 * @returns True if the client is destroyed
	 */
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

		// this could happen when the driver fails the connect and a reconnect timeout triggers
		if (this.host.isClosed() || this.checkIfDestroyed()) {
			return
		}

		if (!cfg?.port) {
			logger.warn('Z-Wave driver not inited, no port configured')
			return
		}

		// Capture the narrowed port before the host calls below, which reset TypeScript's property narrowing
		const port = cfg.port

		// Coalesce a duplicate connect onto the in-flight startup of the current generation so callers share its outcome and no second Driver is built; a close/restart bumps the generation and clears `_activeConnect`, so a later connect builds fresh
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

	/**
	 * Builds, wires and starts a new `Driver` for the committed generation. Its
	 * internal catch logs and backs off instead of rejecting, matching connect()'s
	 * no-throw contract, so a coalesced caller sees the same completion.
	 */
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
		await utils.ensureDir(priorityDir)

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

		// Apply driver-only external settings (storage, presets, logFilename, forceConsole).
		// These are not in ZwaveConfig/settings.json, so they must be applied directly to driver options.
		applyExternalDriverSettings(zwaveOptions)

		const logTransport = new JSONTransport()
		logTransport.format = createDefaultTransportFormat(true, false)

		// Bind this generation's JSON-socket transport so live add/remove re-sends it in the full replacement list
		this._driverLogTransport = logTransport

		// Enrich the driver-only clone via the same helpers as the runtime path so startup and live configs can't diverge; capture `_baseLogLevel` first so a later transport removal can restore it
		const finalLogConfig = zwaveOptions.logConfig
		if (finalLogConfig) {
			this._baseLogLevel =
				typeof finalLogConfig.level === 'string'
					? finalLogConfig.level
					: undefined
			finalLogConfig.transports = this.computeRuntimeLogTransports()
			const level = this.computeRuntimeLogLevel()
			if (level) {
				finalLogConfig.level = level
			}
		} else {
			this._baseLogLevel = undefined
		}

		logTransport.stream.on('data', (data: any) => {
			this.host.emitDebug(data.message.toString())
		})

		// Hold the exact instance this generation creates so a stale/error exit tears down this driver, never a replacement stored by a newer generation
		let createdDriver: Driver | null = null

		try {
			if (shouldUpdateSettings) {
				await this.host.persistConfig()
				if (this._generation !== generation) {
					return
				}
			}
			// init driver here because if connect fails the driver is destroyed
			// this could throw so include in the try/catch
			const driver = new Driver(port, zwaveOptions)
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
			// Tear down the instance this generation created, not `host.getDriver()`, which may already point at a newer generation's replacement; awaited so the failed instance releases the port before backoff builds a replacement
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

	/**
	 * Destroys a specific driver instance from a stale/error exit, awaiting
	 * `destroy()` before clearing host state so the failed driver releases the
	 * serial port before a backoff/retry or coalesced connect builds a
	 * replacement. On a clean destroy the host field is cleared only while it
	 * still references this exact instance; on a rejected destroy the instance is
	 * retained as owner (field left set, no replacement), since it may still hold
	 * the port, and a later {@link close}/retry re-invokes `destroy()` on it.
	 */
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
			// Keep this instance as owner so a later close/retry can destroy it again; clearing the field now would strand the port it may still hold
			return
		}
		if (this.host.getDriver() === driver) {
			this.host.setDriver(null)
		}
	}

	/** Closes the connection, destroying the server before the driver and clearing every lifecycle timer; idempotent and safe to retry */
	async close(keepListeners = false): Promise<void> {
		// Bump the generation so a driver that becomes ready or errors after this cannot mutate replacement state
		this._generation++

		// Stop a post-close duplicate connect from coalescing onto the superseded startup; callers already awaiting it still settle when it does
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

	// Generation-guarded dispatch drops events from an obsolete driver generation; handler bodies that touch node/controller state stay in ZwaveClient behind the host port
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
