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

/**
 * Thrown by {@link AppRuntime.startGateway} when a concurrent teardown aborted
 * the generation. Lets a caller report the cancellation instead of a success.
 */
export class GatewayStartCancelledError extends Error {
	constructor(
		message = 'Gateway start was cancelled by a concurrent teardown',
	) {
		super(message)
		this.name = 'GatewayStartCancelledError'
	}
}

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

export class AppRuntime {
	private _gateway?: GatewayPort
	private _zniffer?: ZnifferPort
	private _pluginsRouter?: Router
	private plugins: CustomPlugin[] = []
	// Only an explicit restart sets this, and it stays set across that restart's
	// teardown and start, so a boot-time start never reports as restarting and
	// keeps settings/statistics reachable during initial startup
	private _restarting = false
	private _ownsDebugSession = false
	private _closed = false

	// Cancels the in-flight `startGateway()` generation. A teardown aborts it so
	// the (possibly hung) start bails at its next checkpoint instead of
	// publishing into a generation that is being torn down
	private currentStart: AbortController | undefined

	// Deduplicates concurrent `teardownGateway()` calls (a SIGTERM-driven
	// `shutdown()` racing an `/api/restart`, say) onto one teardown, so the
	// gateway close and plugin destroy each run exactly once
	private readonly teardownFlight = new utils.SingleFlight()

	// Isolate BackupManager ownership between AppRuntime instances
	private readonly backupManagerOwner = Symbol('AppRuntime.backupManager')

	private defaultSnippets: utils.Snippet[] = []

	private readonly deps: AppRuntimeDeps

	constructor(deps: AppRuntimeDeps) {
		this.deps = deps
		this._gateway = deps.gateway
		this._zniffer = deps.zniffer
		// Seed the marker from an injected restart; the `/api/restart` route owns
		// setting and clearing it from then on
		this._restarting = deps.restarting ?? false
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

	get restarting(): boolean {
		return this._restarting
	}

	setRestarting(value: boolean): void {
		this._restarting = value
	}

	// Throw if a restart is in progress, so handlers reject overlapping requests
	assertNotRestarting(): void {
		if (this._restarting) {
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
		// A shutdown has begun, so refuse to build or reopen anything. Report the
		// cancellation so a restart caller never claims success while exiting
		if (this._closed) {
			this.logStartAborted('runtime already shutting down')
			throw new GatewayStartCancelledError()
		}

		// Publish the token synchronously, so a concurrent teardown can abort this
		// generation and detach rather than serialize behind a possibly-hung start
		const generation = new AbortController()
		this.currentStart = generation
		try {
			await this.runStartGateway(settings, generation.signal)
		} finally {
			// Only this generation clears its own token, so a replacement start's
			// token is left intact
			if (this.currentStart === generation) {
				this.currentStart = undefined
			}
		}

		// A teardown aborted this generation, so report the cancellation rather
		// than resolve as a success. The restart marker is the caller's to clear
		if (generation.signal.aborted) {
			throw new GatewayStartCancelledError()
		}
	}

	/** Name the checkpoint that observed the abort; each one then returns or breaks, so a generation logs this at most once */
	private logStartAborted(step: string): void {
		logger.info(
			`Gateway start cancelled by a concurrent teardown (${step}); not starting or publishing`,
		)
	}

	private async runStartGateway(
		settings: PersistedSettings,
		cancelled: AbortSignal,
	): Promise<void> {
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

		try {
			await gw.start()
		} catch (error) {
			if (cancelled.aborted) {
				this.logStartAborted('gw.start() rejected')
				return
			}

			// Close the failed generation before propagating, so no producer,
			// listener, subscription, server port, or open client leaks past a
			// failed start. Cleanup errors may not replace the caller's original
			// startup error, so they are logged rather than rethrown
			for (const cleanupError of await this.closeGatewayCollectingErrors(
				gw,
			)) {
				logger.error(
					'Error while cleaning up a failed gateway start (original startup error is preserved)',
					cleanupError,
				)
			}
			await this.destroyPlugins()
			throw error
		}

		// The teardown does not await this start, so its `gw.close()` may have
		// landed before the connect finished, leaving a live driver, MQTT
		// connection and listeners. The teardown closes `this.gateway`, so only
		// close this generation's own gateway when the teardown never adopted it,
		// to avoid a second concurrent close of the same gateway
		if (cancelled.aborted) {
			this.logStartAborted('gw.start() resolved')
			if (this.gateway !== gw) {
				try {
					await gw.close()
				} catch (error) {
					logger.error(
						'Error closing a cancelled gateway start (its start had already resolved)',
						error,
					)
				}
			}
			return
		}

		await this.loadPlugins(settings, cancelled, { zwave, mqtt })
	}

	/**
	 * Load the configured plugins into this generation's plugin router. Each
	 * `import()` is a cancellation checkpoint, so a teardown stops the loading
	 * rather than register plugins into a torn-down generation.
	 */
	private async loadPlugins(
		settings: PersistedSettings,
		cancelled: AbortSignal,
		clients: { zwave?: ZWaveClient; mqtt?: MqttClient },
	): Promise<void> {
		const pluginsConfig = settings.gateway?.plugins ?? null
		const pluginsRouter = express.Router()
		this.setPluginsRouter(pluginsRouter)

		if (!pluginsConfig || !Array.isArray(pluginsConfig)) return

		for (const plugin of pluginsConfig) {
			if (cancelled.aborted) {
				this.logStartAborted('before plugin import')
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
				// The import can settle late, after a teardown aborted this
				// generation, so recheck before registering the plugin
				if (cancelled.aborted) {
					this.logStartAborted('after plugin import')
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
	 * Close one gateway generation's gateway, returning every error it collected
	 * so each caller picks its own disposition. A missing gateway is a no-op.
	 */
	private async closeGatewayCollectingErrors(
		gw: GatewayPort | undefined,
	): Promise<unknown[]> {
		const errors: unknown[] = []

		try {
			if (gw) await gw.close()
		} catch (error) {
			errors.push(error)
		}

		return errors
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
	 * The one teardown path for the current gateway generation, shared by graceful
	 * {@link shutdown}, `/api/restart` and a settings-change restart, so all three
	 * close the gateway in the same order. The latch dedups only the gateway
	 * close, so a `shutdown()` racing an `/api/restart` closes the gateway once.
	 *
	 * `requireGateway` is validated outside the latch, so a joiner's requirement
	 * is enforced instead of dropped. `destroyPlugins` runs per caller after the
	 * shared close, so a joiner's choice and ordering are never overridden by the
	 * caller that won the race. Graceful shutdown opts out and destroys plugins
	 * after the zniffer.
	 */
	async teardownGateway(options?: {
		requireGateway?: boolean
		destroyPlugins?: boolean
	}): Promise<void> {
		const gw = options?.requireGateway ? this.ensureGateway() : this.gateway

		try {
			await this.teardownFlight.run(async () => {
				// Abort the in-flight start rather than await it, because a hung
				// `gw.start()` or plugin import may never settle. Closing the
				// gateway below is what unblocks a hung start, by destroying the
				// driver
				this.currentStart?.abort()

				const errors = await this.closeGatewayCollectingErrors(gw)

				// Log every error before rethrowing the first, so nothing behind
				// it is silently discarded
				if (errors.length > 0) {
					for (const error of errors) {
						logger.error(
							'Error while tearing down the gateway',
							error,
						)
					}
					throw errors[0]
				}
			})
		} finally {
			// Destroy plugins even when the close rejected, matching the old
			// fall-through teardown. Idempotent, so joined callers can each run it
			if (options?.destroyPlugins !== false) {
				await this.destroyPlugins()
			}
		}
	}

	/**
	 * Closes the current gateway (if any), the zniffer, and destroys any loaded
	 * plugins - exactly what `gracefuShutdown()` in `api/app.ts` does on
	 * `SIGINT`/`SIGTERM`. Guarded by `_closed`, so overlapping signals collapse
	 * onto one shutdown.
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

		// Destroy plugins after the zniffer, so a plugin's `destroy()` observes the
		// same runtime state it always has
		await this.destroyPlugins()

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
