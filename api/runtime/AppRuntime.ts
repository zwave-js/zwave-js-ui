import type { Router } from 'express'
import express from 'express'
import path from 'node:path'
import { readdir, readFile, stat } from 'node:fs/promises'
import type { Server as SocketServer } from 'socket.io'
import type { GatewayConfig } from '../lib/Gateway.ts'
import type { MqttConfig } from '../lib/MqttClient.ts'
import MqttClient from '../lib/MqttClient.ts'
import type { ZwaveConfig } from '../lib/ZwaveClient.ts'
import ZWaveClient from '../lib/ZwaveClient.ts'
import type { ZnifferConfig } from '../lib/ZnifferManager.ts'
import ZnifferManager from '../lib/ZnifferManager.ts'
import type { CustomPlugin, PluginConstructor } from '../lib/CustomPlugin.ts'
import { createPlugin } from '../lib/CustomPlugin.ts'
import backupManager from '../lib/BackupManager.ts'
import HomeAssistantManager from '../hass/HomeAssistantManager.ts'
import jsonStore from '../lib/jsonStore.ts'
import store from '../config/store.ts'
import type { PersistedSettings } from '../config/store.ts'
import * as loggers from '../lib/logger.ts'
import * as utils from '../lib/utils.ts'
import { snippetsDir } from '../config/app.ts'
import type {
	GatewayFactoryPort,
	GatewayPort,
	ZnifferPort,
	ZwaveClientPort,
} from './ports.ts'

const logger = loggers.module('Runtime')

export function isAuthEnabled(): boolean {
	return jsonStore.get(store.settings).gateway?.authEnabled === true
}

export interface ManagedService {
	close(): Promise<void>
}

export interface AppRuntimeDeps {
	getSocketServer(): SocketServer
	gateway?: GatewayPort
	zniffer?: ZnifferPort
	restarting?: boolean
	gatewayFactory: GatewayFactoryPort
}

/**
 * A cancellation token scoped to exactly one `startGateway()` generation.
 *
 * A concurrent teardown/shutdown/restart cancels the in-flight start through
 * this token instead of blocking on it: `runStartGateway()` re-reads
 * {@link cancelled} at each continuation checkpoint following an `await` whose
 * settling it does not control (after `gw.start()`, and around each plugin
 * `import()`) and bails without starting Home Assistant, adopting, or
 * publishing. That lets a teardown quiesce even while a `gw.start()`/plugin
 * top-level `await` is still hung: the teardown closes the gateway (unblocking a
 * hung `gw.start()` by destroying the driver) and returns, and whenever the
 * start's promise settles its continuation observes the cancellation and cannot
 * resurrect the torn-down generation. Cancellation is edge-triggered and
 * generation-exact, with no timeout involved.
 */
class StartGeneration {
	private _cancelled = false
	private _cancellationLogged = false

	get cancelled(): boolean {
		return this._cancelled
	}

	cancel(): void {
		this._cancelled = true
	}

	/**
	 * Log the first time this generation is observed cancelled at a checkpoint,
	 * so a superseded start leaves one trace of what happened to it (and only
	 * one, however many checkpoints it crosses).
	 */
	logCancellationOnce(log: (message: string) => void, step: string): void {
		if (this._cancellationLogged) return
		this._cancellationLogged = true
		log(
			`Gateway start generation cancelled by a concurrent teardown (${step}); not adopting, starting, or publishing`,
		)
	}
}

export class AppRuntime {
	private _gateway?: GatewayPort
	private _zniffer?: ZnifferPort
	private _pluginsRouter?: Router
	private plugins: CustomPlugin[] = []
	// Whether an explicit restart is in progress. Set by `setRestarting(true)`
	// (from `/api/restart` or an injected restart) and cleared once the restart's
	// `startGateway()` settles, so `restarting` reports true across the restart's
	// teardown and start while a boot-time start is never observed as restarting,
	// keeping settings/statistics reachable during initial startup
	private _restarting = false
	private _ownsDebugSession = false
	private _closed = false

	// The cancellation token of the in-flight `startGateway()` generation, if
	// any. A teardown/shutdown/restart cancels it so the (possibly hung) start
	// bails at its next continuation checkpoint instead of adopting/publishing
	// into a generation that is being torn down. Cleared by `startGateway()`'s
	// `finally` only when it still points at that start's own token.
	private currentStart: StartGeneration | undefined

	// Deduplicates concurrent `teardownGateway()` calls (a SIGTERM-driven
	// `shutdown()` racing an `/api/restart`, say) onto one teardown, so the
	// gateway close and plugin destroy each run exactly once
	private readonly teardownFlight = new utils.SingleFlight()

	// Isolate BackupManager ownership between AppRuntime instances
	private readonly backupManagerOwner = Symbol('AppRuntime.backupManager')

	private defaultSnippets: utils.Snippet[] = []

	private readonly deps: AppRuntimeDeps

	// The Home Assistant subsystem's process-lifetime owner, created once here so
	// it exists before any MQTT/Z-Wave client is constructed in
	// `startGateway()`. It holds the live discovery/`@zwave-js/server` handles
	// the clients construct and own, so a gateway/client replaced mid-restart
	// gets a fresh generation with nothing stale surviving
	private readonly homeAssistant: HomeAssistantManager

	constructor(deps: AppRuntimeDeps) {
		this.deps = deps
		this._gateway = deps.gateway
		this._zniffer = deps.zniffer
		// An injected restart (createApp rebuilds the app with restarting=true)
		// starts out restarting, so `restarting` stays true until the subsequent
		// startGateway() completes.
		this._restarting = deps.restarting === true
		this.homeAssistant = new HomeAssistantManager({
			logger: loggers.module('HomeAssistant'),
		})
	}

	get gateway(): GatewayPort | undefined {
		return this._gateway
	}

	private setGateway(value: GatewayPort | undefined): void {
		this._gateway = value
	}

	ensureGateway(): GatewayPort {
		if (this._gateway === undefined) {
			throw new Error('Gateway is not initialized')
		}
		return this._gateway
	}

	ensureZWaveClient(): ZwaveClientPort {
		if (this._gateway?.zwave === undefined) {
			throw new Error('Z-Wave client not inited')
		}
		return this._gateway.zwave
	}

	get zniffer(): ZnifferPort | undefined {
		return this._zniffer
	}

	private setZniffer(value: ZnifferPort | undefined): void {
		this._zniffer = value
	}

	ensureZniffer(): ZnifferPort {
		if (this._zniffer === undefined) {
			throw new Error('Zniffer is not initialized')
		}
		return this._zniffer
	}

	get pluginsRouter(): Router | undefined {
		return this._pluginsRouter
	}

	private setPluginsRouter(value: Router | undefined): void {
		this._pluginsRouter = value
	}

	/**
	 * Whether a restart is in progress. Only an explicit restart sets this (and
	 * it stays set across the restart's teardown and its subsequent
	 * `startGateway()` until that start completes), so a boot-time start is not
	 * reported as restarting. Preserves the `/api/settings`, `/api/restart` and
	 * `/api/statistics` guard messages.
	 */
	get restarting(): boolean {
		return this._restarting
	}

	setRestarting(value: boolean): void {
		this._restarting = value
	}

	// Throw if a restart is in progress, so handlers reject overlapping requests
	assertNotRestarting(): void {
		if (this.restarting) {
			throw new Error(
				'Gateway is restarting, wait a moment before doing another request',
			)
		}
	}

	// Cancel only the debug session started by this runtime
	get ownsDebugSession(): boolean {
		return this._ownsDebugSession
	}

	setOwnsDebugSession(value: boolean): void {
		this._ownsDebugSession = value
	}

	// True once shutdown() has started, so callers can avoid re-teardown
	get isClosed(): boolean {
		return this._closed
	}

	private async readSnippetsFromDir(dir: string): Promise<utils.Snippet[]> {
		const snippets: utils.Snippet[] = []
		const files = await readdir(dir)
		for (const file of files) {
			const filePath = path.join(dir, file)

			if (await isSnippetFile(filePath)) {
				snippets.push({
					name: path.basename(filePath, '.js'),
					content: await readFile(filePath, 'utf8'),
				})
			}
		}
		return snippets
	}

	async loadSnippets(): Promise<void> {
		const localSnippetsDir = utils.joinPath(false, 'snippets')
		await utils.ensureDir(snippetsDir)
		this.defaultSnippets = await this.readSnippetsFromDir(localSnippetsDir)
	}

	async getSnippets(): Promise<utils.Snippet[]> {
		const snippets = await this.readSnippetsFromDir(snippetsDir)
		const snippetsCache = this._gateway?.zwave?.cacheSnippets ?? []
		return [...snippetsCache, ...this.defaultSnippets, ...snippets]
	}

	setupLogging(
		settings: { gateway?: utils.DeepPartial<GatewayConfig> } | undefined,
	): void {
		loggers.setupAll(settings?.gateway ?? {})
	}

	async startGateway(settings: PersistedSettings): Promise<void> {
		// Mint a fresh cancellation token for this start generation and publish
		// it synchronously, so a concurrent teardown/shutdown can cancel this
		// generation and detach promptly rather than serialize behind a
		// possibly-hung start. `runStartGateway()` runs up to its first `await`
		// (past `attachClients()`) before yielding, so the generation is attached
		// before any caller can observe cancellation
		const generation = new StartGeneration()
		this.currentStart = generation
		try {
			await this.runStartGateway(settings, generation)
		} catch (error) {
			// A rejection from a cancelled generation is an expected consequence
			// of the teardown (e.g. it closed the gateway out from under a hung
			// `gw.start()`), so swallow it: the teardown owns the cleanup, so it
			// neither surfaces here nor resets the restart marker below
			if (generation.cancelled) return
			throw error
		} finally {
			// Own the terminal restart transition here rather than trusting the
			// teardown to reach one: once this generation is no longer current
			// (nothing newer replaced it), clear the restart marker so a restart
			// never leaves `restarting` stuck true and locking out the API. A
			// cancelled generation leaves the marker to its replacement/teardown,
			// which owns the state
			if (this.currentStart === generation) {
				this.currentStart = undefined
				if (!generation.cancelled) this._restarting = false
			}
		}
	}

	private async runStartGateway(
		settings: PersistedSettings,
		generation: StartGeneration,
	): Promise<void> {
		// Take ownership of the Home Assistant subsystem before any client is
		// constructed. Idempotent, so a restart re-entering here is a no-op.
		this.homeAssistant.initialize()

		let mqtt: MqttClient | undefined
		let zwave: ZWaveClient | undefined

		if (isAuthEnabled() && !process.env.SESSION_SECRET) {
			logger.warn(
				'SESSION_SECRET env var is not set; using an auto-generated secret persisted in the store. ' +
					'Set SESSION_SECRET explicitly to control the secret across environments.',
			)
		}

		if (settings.mqtt) {
			mqtt = new MqttClient(settings.mqtt as MqttConfig)
		}

		if (settings.zwave) {
			zwave = new ZWaveClient(
				settings.zwave as ZwaveConfig,
				this.deps.getSocketServer(),
			)
		}

		backupManager.init(zwave, this.backupManagerOwner)

		const gw = this.deps.gatewayFactory.create(
			settings.gateway as GatewayConfig,
			zwave,
			mqtt,
		)
		this.setGateway(gw)

		// Adopt this generation's discovery + server handles (the clients own the
		// instances, constructed eagerly), before the clients start, so the
		// coordinator holds the very instances the clients drive at their locked
		// timing points (discovery at `Gateway.start()`, server at driver-ready)
		this.homeAssistant.attachClients({
			discovery: gw.mqttDiscovery,
			// no Z-Wave client this generation (settings.zwave absent) means no
			// server subsystem to own
			server: zwave?.zwaveServer,
		})

		try {
			await gw.start()
		} catch (error) {
			// If a concurrent teardown/shutdown cancelled this generation, the
			// rejection is an expected consequence of it closing the gateway
			// out from under the (possibly hung) start: the teardown owns the
			// cleanup, so bail without touching the shared state or rethrowing.
			if (generation.cancelled) {
				generation.logCancellationOnce(
					(msg) => logger.info(msg),
					'gw.start() rejected',
				)
				return
			}

			// Genuine startup failure: close the failed generation (quiesce the
			// partially-started HA subsystem, then close the gateway and destroy
			// any plugins) before propagating, so no producer, listener,
			// subscription, server port, or open client leaks past a failed
			// start. Cleanup errors are logged and aggregated, never replacing
			// the caller's original error
			await this.quiesceFailedStart(gw)
			throw error
		}

		// A teardown may have cancelled this generation while `gw.start()` was
		// resolving. The teardown does not await this start, so its `gw.close()`
		// may have landed before the connect finished — leaving a live driver,
		// MQTT connection and listeners. Close THIS generation's gateway (only
		// this specific one, never a newer generation the teardown/restart
		// installed) so nothing survives, then bail without starting HA,
		// adopting, or publishing
		if (generation.cancelled) {
			generation.logCancellationOnce(
				(msg) => logger.info(msg),
				'gw.start() resolved',
			)
			await this.closeCancelledStart(gw)
			return
		}

		// Confirm the subsystem is up now that the gateway (and, through it,
		// the discovery + `@zwave-js/server` sub-managers) has started.
		this.homeAssistant.start()

		await this.loadPlugins(settings, generation, { zwave, mqtt })
	}

	/**
	 * Load the configured plugins into this generation's plugin router. Kept out
	 * of `runStartGateway()` so its ordered startup steps and cancellation
	 * checkpoints read at a glance and plugin loading (unrelated to the HA
	 * lifecycle) stays self-contained. Each `import()` is a continuation
	 * checkpoint: a teardown that cancels this generation (before or during an
	 * import) stops loading rather than adopt plugins into a torn-down generation.
	 */
	private async loadPlugins(
		settings: PersistedSettings,
		generation: StartGeneration,
		clients: { zwave?: ZWaveClient; mqtt?: MqttClient },
	): Promise<void> {
		const pluginsConfig = settings.gateway?.plugins ?? null
		const pluginsRouter = express.Router()
		this.setPluginsRouter(pluginsRouter)

		if (!pluginsConfig || !Array.isArray(pluginsConfig)) return

		for (const plugin of pluginsConfig) {
			if (generation.cancelled) {
				generation.logCancellationOnce(
					(msg) => logger.info(msg),
					'before plugin import',
				)
				break
			}
			try {
				const pluginName = path.basename(plugin)
				const pluginsContext = {
					zwave: clients.zwave,
					mqtt: clients.mqtt,
					app: pluginsRouter,
					logger: loggers.module(pluginName),
				}
				const constructor = (await import(plugin))
					.default as PluginConstructor
				// The awaited import can settle (or hang and settle late) after
				// a teardown cancelled this generation: re-check before
				// constructing/adopting so a late completion cannot register a
				// plugin into the torn-down generation.
				if (generation.cancelled) {
					generation.logCancellationOnce(
						(msg) => logger.info(msg),
						'after plugin import',
					)
					break
				}
				const instance = createPlugin(
					constructor,
					pluginsContext,
					pluginName,
				)

				this.plugins.push(instance)
				logger.info(`Successfully loaded plugin ${instance.name}`)
			} catch (error) {
				logger.error(`Error while loading ${plugin} plugin`, error)
			}
		}
	}

	/**
	 * Close a start generation a concurrent teardown cancelled after its
	 * `gw.start()` had already resolved. Only this specific gateway is closed
	 * (never a newer generation the teardown/restart installed, and not the HA
	 * subsystem, which the teardown already quiesced and now owns for the current
	 * generation). Best-effort: a close failure here is logged, not propagated,
	 * since the caller's start already succeeded.
	 */
	private async closeCancelledStart(gw: GatewayPort): Promise<void> {
		try {
			await gw.close()
		} catch (error) {
			logger.error(
				'Error closing a cancelled gateway start (its start had already resolved)',
				error,
			)
		}
	}

	/**
	 * The single load-bearing teardown sequence for one gateway generation:
	 * quiesce Home Assistant (halt discovery, await the `@zwave-js/server`
	 * destroy) → close the gateway (Z-Wave client then MQTT) → destroy plugins.
	 * That order is a correctness contract (HA quiesced before the driver dies),
	 * so it lives in exactly one place. Each step is isolated so one failure
	 * cannot skip the next, and every error is collected and returned. Callers
	 * decide the disposition (log-and-continue vs rethrow).
	 *
	 * `destroyPlugins` is opt-out for the graceful shutdown path, which destroys
	 * plugins later (after the zniffer) to preserve the pre-refactor shutdown
	 * order; every other caller destroys them here, with the gateway.
	 */
	private async closeGeneration(
		gw: GatewayPort | undefined,
		options?: { destroyPlugins?: boolean },
	): Promise<unknown[]> {
		const errors: unknown[] = []

		try {
			await this.homeAssistant.stop()
		} catch (error) {
			errors.push(error)
		}

		try {
			if (gw) await gw.close()
		} catch (error) {
			errors.push(error)
		}

		if (options?.destroyPlugins !== false) {
			try {
				await this.destroyPlugins()
			} catch (error) {
				errors.push(error)
			}
		}

		return errors
	}

	/**
	 * Closes the gateway generation whose `gw.start()` just failed via the
	 * shared {@link closeGeneration} sequence, so no producer, listener, MQTT
	 * subscription, server port, or open client leaks past the failed start.
	 *
	 * Runs only on a genuine (uncancelled) startup failure; a start a concurrent
	 * teardown cancelled does not come here, since the teardown owns that
	 * generation's cleanup, keeping cleanup exactly-once.
	 *
	 * Cleanup errors may not replace the caller's original startup error: they
	 * are logged here, never rethrown.
	 */
	private async quiesceFailedStart(gw: GatewayPort): Promise<void> {
		const cleanupErrors = await this.closeGeneration(gw)

		for (const error of cleanupErrors) {
			logger.error(
				'Error while cleaning up a failed gateway start (original startup error is preserved)',
				error,
			)
		}
	}

	startZniffer(settings: utils.DeepPartial<ZnifferConfig> | undefined): void {
		this.setZniffer(
			settings
				? new ZnifferManager(
						settings as ZnifferConfig,
						this.deps.getSocketServer(),
					)
				: undefined,
		)
	}

	async destroyPlugins(): Promise<void> {
		while (this.plugins.length > 0) {
			const instance = this.plugins.pop()
			if (instance && typeof instance.destroy === 'function') {
				try {
					logger.info('Closing plugin ' + instance.name)
					await instance.destroy()
				} catch (error) {
					logger.error(
						`Error while closing plugin ${instance.name}`,
						error,
					)
				}
			}
		}
	}

	private async closeIfPresent(
		service: ManagedService | undefined,
	): Promise<void> {
		if (service) {
			await service.close()
		}
	}

	/**
	 * The single, centralized teardown of the current gateway generation. Every
	 * caller that closes the gateway (graceful {@link shutdown}, `/api/restart`,
	 * and a settings-change restart) routes through here for one identical order:
	 *
	 *  1. Cancel any in-flight `startGateway()` generation and detach from it.
	 *     The teardown never blocks on the start (a hung `gw.start()` or plugin
	 *     top-level `await import()` would never settle); cancelling the token
	 *     makes that start's continuation bail without adopting/publishing
	 *     whenever it settles. The start's own caller still observes any late
	 *     rejection through `startGateway()`, so no separate rejection sink is
	 *     needed. Closing the gateway below unblocks a hung `gw.start()` by
	 *     destroying the driver.
	 *  2. Quiesce Home Assistant, close the gateway, then destroy plugins via
	 *     the shared {@link closeGeneration} sequence (HA quiesced before the
	 *     driver dies; the server and its port gone before the driver).
	 *
	 * Deduplicated through {@link teardownFlight}, so a graceful `shutdown()`
	 * racing an `/api/restart` (or a second restart) shares one teardown and the
	 * gateway close and plugin destroy each run exactly once.
	 *
	 * `requireGateway` selects the close path: `/api/restart` passes `true`
	 * so a restart with no gateway attached surfaces as a caller error, while
	 * graceful shutdown omits it to close the gateway only when one is present.
	 *
	 * Every collected error is logged, then the first is rethrown so the caller
	 * still sees a failure while no error behind it is silently discarded.
	 */
	async teardownGateway(options?: {
		requireGateway?: boolean
		destroyPlugins?: boolean
	}): Promise<void> {
		return this.teardownFlight.run(async () => {
			// (1) Cancel the in-flight start's generation without awaiting it: a
			// hung `gw.start()`/plugin import would never settle, so awaiting
			// would hang the teardown. Cancellation guarantees the start's
			// continuation observes the cancelled token whenever it settles and
			// cannot adopt/publish into this torn-down generation; closing the
			// gateway below unblocks a hung `gw.start()`
			this.currentStart?.cancel()

			// (2) `requireGateway` surfaces a missing gateway as a caller error
			// (`/api/restart`); otherwise close only when one is present
			const gw = options?.requireGateway
				? this.ensureGateway()
				: this.gateway
			const teardownErrors = await this.closeGeneration(gw, {
				destroyPlugins: options?.destroyPlugins,
			})

			if (teardownErrors.length > 0) {
				for (const error of teardownErrors) {
					logger.error('Error while tearing down the gateway', error)
				}
				throw teardownErrors[0]
			}
		})
	}

	/**
	 * Closes the current gateway (if any), the zniffer, and destroys any loaded
	 * plugins - exactly what `gracefuShutdown()` in `api/app.ts` does on
	 * `SIGINT`/`SIGTERM`. Guarded by `_closed`, so overlapping signals collapse
	 * onto one shutdown.
	 *
	 * The gateway teardown routes through {@link teardownGateway} (which quiesces
	 * Home Assistant, cancels any in-flight start, and closes the gateway,
	 * deduplicated against a concurrent restart), but defers plugin destruction:
	 * plugins are destroyed after the zniffer here, preserving the pre-refactor
	 * shutdown order so a plugin's `destroy()` observes the same runtime state it
	 * did before. A restart still destroys plugins as part of its own teardown.
	 */
	async shutdown(): Promise<void> {
		if (this._closed) {
			return
		}
		this._closed = true

		try {
			// Defer plugin destruction to after the zniffer close below
			await this.teardownGateway({ destroyPlugins: false })
		} catch (error) {
			logger.error('Error while closing gateway', error)
		}

		try {
			this.deps.gatewayFactory.dispose()
		} catch (error) {
			logger.error('Error while disposing gateway factory', error)
		}

		try {
			await this.closeIfPresent(this._zniffer)
		} catch (error) {
			logger.error('Error while closing zniffer', error)
		}

		// Destroy plugins after the zniffer, matching the pre-refactor shutdown
		// order (a restart destroys them inside teardownGateway instead)
		try {
			await this.destroyPlugins()
		} catch (error) {
			logger.error('Error while destroying plugins', error)
		}

		try {
			backupManager.close(this.backupManagerOwner)
		} catch (error) {
			logger.error('Error while closing backup manager', error)
		}
	}
}

async function isSnippetFile(file: string): Promise<boolean> {
	return (await stat(file)).isFile() && file.endsWith('.js')
}
