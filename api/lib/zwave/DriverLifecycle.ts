/**
 * DriverLifecycle
 * ----------------
 * Owns the low-level lifecycle of a single `zwave-js` {@link Driver} instance
 * on behalf of `ZwaveClient`:
 *
 *  - driver creation, option building, log-transport injection and binding of
 *    the driver event handlers ({@link connect});
 *  - the official `@zwave-js/server` (`ZwavejsServer`) coordination
 *    (create / start-if-needed / destroy / adopt) through {@link ZwaveServerManager};
 *  - retry/backoff restart timing ({@link backoffRestart});
 *  - usage-statistics enable/disable and extra log transports;
 *  - idempotent teardown ({@link close}) that destroys the server BEFORE the
 *    driver and clears every timer it owns;
 *  - a monotonic **generation** counter so a late `driver ready` / `error` /
 *    `all nodes ready` / OTW callback from an obsolete driver can never mutate
 *    a replacement generation's state (the same pattern the other extracted
 *    services use).
 *
 * Everything the service needs from `ZwaveClient` — the current config, the
 * driver field, status/ready/closed/destroyed state, node restoration, socket
 * IO and the driver-event handler bodies (which do node-registry work retained
 * in `ZwaveClient`) — is reached through the narrow {@link DriverLifecycleHost}
 * port. The service therefore never imports `ZwaveClient` and cannot create an
 * import cycle. Every accessor resolves the CURRENT value, so a driver swap on
 * restart is honoured with nothing captured at construction time.
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

/**
 * Log levels ordered from least to most verbose. Used to pick the most
 * verbose level requested by any registered extra log transport.
 */
const LOG_LEVEL_ORDER = ['error', 'warn', 'info', 'verbose', 'debug', 'silly']

/**
 * Narrow port back into `ZwaveClient`. Every method resolves the CURRENT
 * client state so the lifecycle keeps working across driver/config swaps
 * without capturing anything at construction time.
 */
export interface DriverLifecycleHost {
	/** The current Z-Wave configuration (`ZwaveClient.cfg`). */
	getConfig(): ZwaveConfig
	/** The current driver instance (`ZwaveClient._driver`), if any. */
	getDriver(): Driver | null
	/** Store the driver instance back on the client (compatibility field). */
	setDriver(driver: Driver | null): void
	/** `ZwaveClient.driverReady` getter (driver && ready && !closed). */
	isDriverReady(): boolean
	/** The raw `ZwaveClient._driverReady` field (no closed/driver checks). */
	isDriverReadyRaw(): boolean
	/** `ZwaveClient.closed`. */
	isClosed(): boolean
	/** Set `ZwaveClient.closed`. */
	setClosed(closed: boolean): void
	/** `ZwaveClient.destroyed`. */
	isDestroyed(): boolean
	/** Set `ZwaveClient.status`. */
	setStatus(status: ZwaveClientStatus): void
	/** Set `ZwaveClient.driverReady` (fires `driverStatus` when it changes). */
	setDriverReady(ready: boolean): void
	/** True when at least one socket client is connected. */
	hasConnectedClients(): Promise<boolean>
	/** Forward a driver log line to the `debug` socket room. */
	emitDebug(message: string): void
	/** The inclusion user callbacks to attach when no server is enabled. */
	getInclusionUserCallbacks(): InclusionUserCallbacks
	/** Install the inclusion user callbacks on the current driver. */
	installUserCallbacks(): void
	/** Persist the current config to settings.json (startup migrations). */
	persistConfig(): Promise<void>
	/** Re-run the full client init/connect (used by the backoff timer). */
	restart(): Promise<void>
	/** Build the {@link ZwaveServerHost} for a standalone fallback manager. */
	buildServerHost(): ZwaveServerHost
	/**
	 * Clear the runtime timers/throttles that live on `ZwaveClient` and reset
	 * the inclusion coordinator + firmware update service generations. Run
	 * during {@link close} after the lifecycle's own timers are cleared and
	 * before the server/driver are destroyed.
	 */
	clearRuntimeOnClose(): void
	/**
	 * Finalise a non-`keepListeners` close: mark the client destroyed and
	 * remove all its event listeners.
	 */
	finalizeClose(): void
	/** Driver `driver ready` handler body (node restoration lives here). */
	onDriverReady(generation: number): Promise<void>
	/** Driver `error` handler body. */
	onDriverError(error: unknown, skipRestart: boolean): void
	/** Driver `all nodes ready` handler body. */
	onScanComplete(): void
	/** Driver `bootloader ready` handler body. */
	onBootLoaderReady(): void
	/** Driver `firmware update progress` (OTW) handler body. */
	onOTWFirmwareUpdateProgress(progress: OTWFirmwareUpdateProgress): void
	/** Driver `firmware update finished` (OTW) handler body. */
	onOTWFirmwareUpdateFinished(result: OTWFirmwareUpdateResult): void
}

export class DriverLifecycle {
	private readonly host: DriverLifecycleHost

	/**
	 * Monotonically increasing generation counter. Bumped when a new driver
	 * starts connecting AND when the client is closed, so any in-flight async
	 * work from an obsolete driver detects the mismatch and aborts instead of
	 * mutating the replacement generation. NEVER reset by `init()`.
	 */
	private _generation = 0

	private _backoffRetry = 0
	private _restartTimeout: NodeJS.Timeout | null = null

	private _extraLogTransports: Array<{ transport: any; level?: string }> = []

	private _serverManager?: ZwaveServerManager

	constructor(host: DriverLifecycleHost) {
		this.host = host
	}

	/** The current generation token (see {@link _generation}). */
	get generation(): number {
		return this._generation
	}

	// -----------------------------------------------------------------------
	// @zwave-js/server coordination
	// -----------------------------------------------------------------------

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

	/** The adopted/lazily-built server manager, or `undefined` if none yet. */
	get serverManager(): ZwaveServerManager | undefined {
		return this._serverManager
	}

	get server(): ZwavejsServer | null {
		return this._serverManager?.server ?? null
	}

	set server(value: ZwavejsServer | null) {
		// Route through the lazy accessor so a directly-constructed client
		// (standalone / tests) that assigns `server` before any create() still
		// has a manager to hold it.
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

	/**
	 * Construct (but do not yet start) the server. Called from {@link connect}
	 * right after the driver is created (and only when `serverEnabled`), so the
	 * server always exists BEFORE the driver becomes ready.
	 */
	createServer(): void {
		this.zwaveServer.create()
	}

	// -----------------------------------------------------------------------
	// Statistics
	// -----------------------------------------------------------------------

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

	// -----------------------------------------------------------------------
	// Extra log transports (persist across driver restarts)
	// -----------------------------------------------------------------------

	/**
	 * Register an extra log transport that persists across driver restarts.
	 * If the driver is already running, the transport is applied immediately.
	 */
	addExtraLogTransport(transport: any, level?: string): void {
		this._extraLogTransports.push({ transport, level })
		const driver = this.host.getDriver()
		if (driver && this.host.isDriverReadyRaw()) {
			const config: any = {
				transports: [transport],
			}
			if (level) {
				config.level = level
			}
			driver.updateLogConfig(config)
		}
	}

	/**
	 * Remove a previously registered extra log transport.
	 * If the driver is running, the transport is detached immediately.
	 */
	removeExtraLogTransport(transport: any): void {
		const idx = this._extraLogTransports.findIndex(
			(e) => e.transport === transport,
		)
		if (idx !== -1) {
			this._extraLogTransports.splice(idx, 1)
		}
		const driver = this.host.getDriver()
		if (driver && this.host.isDriverReadyRaw()) {
			driver.updateLogConfig({
				transports: [],
			})
		}
	}

	// -----------------------------------------------------------------------
	// Restart / destroyed helpers
	// -----------------------------------------------------------------------

	/** Reset the exponential backoff counter (called on `driver ready`). */
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

		this._restartTimeout = setTimeout(() => {
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

	// -----------------------------------------------------------------------
	// connect / close
	// -----------------------------------------------------------------------

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

		// Commit to a new driver generation. Any obsolete driver's late async
		// callbacks now detect the bump and abort.
		const generation = ++this._generation
		const port = cfg.port

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

		if (logConfig) {
			logConfig.transports = [
				logTransport,
				...this._extraLogTransports.map((e) => e.transport),
			]

			// If any extra transport requires a more verbose log level, apply it.
			// Use the most verbose (highest priority) level among all extra transports.
			const extraLevel = this._extraLogTransports
				.map((e) => e.level)
				.filter((level): level is string => Boolean(level))
				.reduce<string | undefined>((best, level) => {
					if (!best) return level
					return LOG_LEVEL_ORDER.indexOf(level) >
						LOG_LEVEL_ORDER.indexOf(best)
						? level
						: best
				}, undefined)
			if (extraLevel) {
				const currentLevel = logConfig.level
				const currentIdx =
					typeof currentLevel === 'string'
						? LOG_LEVEL_ORDER.indexOf(currentLevel)
						: -1
				const extraIdx = LOG_LEVEL_ORDER.indexOf(extraLevel)
				if (extraIdx > currentIdx) {
					logConfig.level = extraLevel
				}
			}
		}

		logTransport.stream.on('data', (data: any) => {
			this.host.emitDebug(data.message.toString())
		})

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
				return
			}

			if (hasConnectedClients) {
				this.host.installUserCallbacks()
			}

			await driver.start()

			if (this._generation !== generation) {
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
			// destroy diver instance when it fails
			const driver = this.host.getDriver()
			if (driver) {
				driver.destroy().catch((err: Error) => {
					logger.error(
						`Error while destroying driver ${err.message}`,
						error,
					)
				})
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
	 * Close the client connection. Destroys the server BEFORE the driver and
	 * clears every timer the lifecycle owns. Idempotent and safe to retry.
	 */
	async close(keepListeners = false): Promise<void> {
		// Invalidate any in-flight generation so a driver that becomes ready or
		// errors after this point cannot mutate replacement state.
		this._generation++

		this.host.setStatus(ZwaveClientStatus.CLOSED)
		this.host.setClosed(true)
		this.host.setDriverReady(false)

		if (this._restartTimeout) {
			clearTimeout(this._restartTimeout)
			this._restartTimeout = null
		}

		// Clears heal/updates/stateless/poll/throttle timers on ZwaveClient and
		// resets the inclusion coordinator + firmware update service.
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

	// -----------------------------------------------------------------------
	// Generation-guarded driver-event dispatch
	//
	// The handler bodies (which touch ZwaveClient node/controller state) stay
	// in ZwaveClient behind the host port; the dispatch here drops any event
	// coming from an obsolete driver generation.
	// -----------------------------------------------------------------------

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
