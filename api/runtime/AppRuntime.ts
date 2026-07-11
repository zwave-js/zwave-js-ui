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
import MqttDiscoveryManager from '../hass/MqttDiscoveryManager.ts'
import ZwaveServerManager from '../hass/ZwaveServerManager.ts'
import jsonStore from '../lib/jsonStore.ts'
import store from '../config/store.ts'
import type { PersistedSettings } from '../config/store.ts'
import * as loggers from '../lib/logger.ts'
import * as utils from '../lib/utils.ts'
import { snippetsDir } from '../config/app.ts'
import type { GatewayPort, ZnifferPort, ZwaveClientPort } from './ports.ts'

const logger = loggers.module('Runtime')

export function isAuthEnabled(): boolean {
	return jsonStore.get(store.settings).gateway?.authEnabled === true
}

export interface ManagedService {
	close(): Promise<void>
}

/**
 * Explicit lifecycle states of the gateway generation `AppRuntime` owns. This
 * replaced the former lone `restarting` boolean so the restart/close
 * coordination (quiesce HA before closing clients) and concurrency
 * (shutdown-during-start) are driven by state rather than an ad-hoc flag:
 *
 *  - `idle`: no start attempted yet, or a restart was reset/aborted.
 *  - `starting`: a boot-time `startGateway()` is in progress.
 *  - `started`: a `startGateway()` completed successfully.
 *  - `stopping`: an explicit restart is in progress - from `setRestarting(true)`
 *    through its subsequent `startGateway()` - OR a teardown is quiescing.
 *    This is the only state `isRestarting()` reports, so a restart stays
 *    "restarting" across both its teardown and start phases exactly as the old
 *    boolean did, while a boot-time start (which never enters `stopping`) does
 *    not.
 *  - `failed`: the last `startGateway()` threw.
 */
export type GatewayLifecycleState =
	| 'idle'
	| 'starting'
	| 'started'
	| 'stopping'
	| 'failed'

export interface GatewayFactoryPort {
	create(
		config: GatewayConfig,
		zwave: ZWaveClient,
		mqtt: MqttClient,
	): GatewayPort
	dispose(): void
}

export interface AppRuntimeDeps {
	getSocketServer(): SocketServer
	gateway?: GatewayPort
	zniffer?: ZnifferPort
	restarting?: boolean
	gatewayFactory: GatewayFactoryPort
}

export class AppRuntime {
	private gateway?: GatewayPort
	private zniffer?: ZnifferPort
	private pluginsRouter?: Router
	private plugins: CustomPlugin[] = []

	// The gateway generation's lifecycle state - the explicit machine that
	// replaced the former lone `restarting` boolean. It drives the
	// quiesce-before-close ordering and the restart guard (see
	// `isRestarting()`/`setRestarting()` and `startGateway()`/
	// `teardownGateway()` below). `stopping` is only ever entered by an
	// explicit restart request, so boot-time startup is never observed as
	// "restarting" (preserving the original quirk that settings/statistics
	// stay reachable during initial startup).
	private lifecycle: GatewayLifecycleState = 'idle'
	// The in-flight `startGateway()` run, if any. Lets a concurrent
	// teardown/shutdown SERIALIZE against an in-progress start (await it, then
	// quiesce) instead of interleaving - the shutdown-during-start guarantee.
	private startInFlight: Promise<void> | undefined
	private ownsDebugSession = false

	// `BackupManager.init()`/`.close()`'s `owner` parameter doesn't exist in
	// this layer's own `BackupManager.ts` - it's this (base) layer's own,
	// independently-added ownership token. Scoping it per `AppRuntime`
	// instance (mirroring `api/app.ts`'s pre-extraction per-`createApp()`
	// local) keeps one instance's shutdown from tearing down a different,
	// concurrently-live instance's backup manager state (e.g. two
	// `AppRuntime`s constructed by separate test suites within the same
	// process).
	private readonly backupManagerOwner = Symbol('AppRuntime.backupManager')

	private defaultSnippets: utils.Snippet[] = []

	private readonly deps: AppRuntimeDeps

	// The built-in Home Assistant subsystem's process-lifetime owner. Created
	// once here so it exists BEFORE any MQTT/Z-Wave client is constructed in
	// `startGateway()`; it genuinely owns the live discovery/`@zwave-js/server`
	// sub-managers (constructed through factories that also adopt them into the
	// current `Gateway`/`ZwaveClient`), so a gateway/client replaced
	// mid-restart gets a brand-new generation with nothing stale surviving.
	private readonly homeAssistant: HomeAssistantManager

	constructor(deps: AppRuntimeDeps) {
		this.deps = deps
		this.gateway = deps.gateway
		this.zniffer = deps.zniffer
		// An injected restart (createApp rebuilds the app with restarting=true)
		// starts the lifecycle in `stopping`, so isRestarting() stays true until
		// the subsequent startGateway() completes.
		this.lifecycle = deps.restarting ? 'stopping' : 'idle'
		this.homeAssistant = new HomeAssistantManager({
			logger: loggers.module('HomeAssistant'),
		})
	}

	// ### Home Assistant subsystem ###

	getHomeAssistant(): HomeAssistantManager {
		return this.homeAssistant
	}

	getGateway(): GatewayPort | undefined {
		return this.gateway
	}

	private setGateway(value: GatewayPort | undefined): void {
		this.gateway = value
	}

	requireGateway(): GatewayPort {
		if (this.gateway === undefined) {
			throw new Error('Gateway is not initialized')
		}
		return this.gateway
	}

	requireZwaveClient(): ZwaveClientPort {
		if (this.gateway?.zwave === undefined) {
			throw new Error('Z-Wave client not inited')
		}
		return this.gateway.zwave
	}

	getZniffer(): ZnifferPort | undefined {
		return this.zniffer
	}

	private setZniffer(value: ZnifferPort | undefined): void {
		this.zniffer = value
	}

	requireZniffer(): ZnifferPort {
		if (this.zniffer === undefined) {
			throw new Error('Zniffer is not initialized')
		}
		return this.zniffer
	}

	getPluginsRouter(): Router | undefined {
		return this.pluginsRouter
	}

	private setPluginsRouter(value: Router | undefined): void {
		this.pluginsRouter = value
	}

	/**
	 * Whether a restart is in progress. Backed by the lifecycle machine: only
	 * an explicit restart drives the state into `stopping` (and it stays there
	 * across the restart's teardown AND its subsequent `startGateway()`, until
	 * that start completes), so this reproduces the old boolean's exact
	 * observable behavior - including that a boot-time start is NOT reported as
	 * restarting. Preserves the `/api/settings`, `/api/restart` and
	 * `/api/statistics` guard messages verbatim.
	 */
	isRestarting(): boolean {
		return this.lifecycle === 'stopping'
	}

	setRestarting(value: boolean): void {
		this.lifecycle = value ? 'stopping' : 'idle'
	}

	// Tracks whether this instance's own routes started the currently-active
	// debug session, so shutdown only auto-cancels a session it owns instead
	// of a different, concurrently-live instance's active capture.
	isOwningDebugSession(): boolean {
		return this.ownsDebugSession
	}

	setOwnsDebugSession(value: boolean): void {
		this.ownsDebugSession = value
	}

	async loadSnippets(): Promise<void> {
		this.defaultSnippets.length = 0
		const localSnippetsDir = utils.joinPath(false, 'snippets')
		await utils.ensureDir(snippetsDir)

		const files = await readdir(localSnippetsDir)
		for (const file of files) {
			const filePath = path.join(localSnippetsDir, file)

			if (await isSnippetFile(filePath)) {
				const content = await readFile(filePath, 'utf8')
				const name = path.basename(filePath, '.js')
				this.defaultSnippets.push({ name, content })
			}
		}
	}

	async getSnippets(): Promise<utils.Snippet[]> {
		const files = await readdir(snippetsDir)
		const snippets: utils.Snippet[] = []
		for (const file of files) {
			const filePath = path.join(snippetsDir, file)

			if (await isSnippetFile(filePath)) {
				snippets.push({
					name: file.replace('.js', ''),
					content: await readFile(filePath, 'utf8'),
				})
			}
		}

		const snippetsCache = this.gateway?.zwave?.cacheSnippets ?? []
		return [...snippetsCache, ...this.defaultSnippets, ...snippets]
	}

	setupLogging(
		settings: { gateway?: utils.DeepPartial<GatewayConfig> } | undefined,
	): void {
		loggers.setupAll(settings?.gateway ?? {})
	}

	async startGateway(settings: PersistedSettings): Promise<void> {
		// A restart drives the machine into `stopping` (via
		// `setRestarting(true)`) and keeps reporting "restarting" across both
		// its teardown AND this start, until the start settles; a boot-time
		// start (lifecycle `idle`) instead moves through `starting`, which is
		// NOT reported as restarting - preserving the original quirk that
		// settings/statistics stay reachable during initial startup.
		const isRestart = this.lifecycle === 'stopping'
		if (!isRestart) this.lifecycle = 'starting'

		// Publish the in-flight run so a concurrent teardown/shutdown SERIALIZES
		// against it (awaits it, then quiesces) instead of interleaving. Set
		// synchronously: `runStartGateway()` executes up to its first `await`
		// (past `attachClients()`) before yielding, so the generation is
		// attached by the time any caller can observe `startInFlight`.
		const run = this.runStartGateway(settings)
		this.startInFlight = run
		try {
			await run
			this.lifecycle = 'started'
		} catch (error) {
			this.lifecycle = 'failed'
			throw error
		} finally {
			this.startInFlight = undefined
		}
	}

	private async runStartGateway(settings: PersistedSettings): Promise<void> {
		// Take ownership of the Home Assistant subsystem before any client is
		// constructed. Idempotent, so a restart re-entering here is a no-op.
		this.homeAssistant.initialize()

		let mqtt!: MqttClient
		let zwave!: ZWaveClient

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

		// Backup initialization is valid when Z-Wave is disabled.
		backupManager.init(zwave, this.backupManagerOwner)

		const gw = this.deps.gatewayFactory.create(
			settings.gateway as GatewayConfig,
			zwave,
			mqtt,
		)
		this.setGateway(gw)

		// Construct + adopt a fresh HA-owned generation of the discovery and
		// `@zwave-js/server` managers into the just-built clients BEFORE they
		// start, so the sub-managers the clients drive at their locked timing
		// points (discovery at `Gateway.start()`, server at driver-ready) are
		// the very instances the coordinator owns. Each factory constructs the
		// concrete manager against this generation's clients and adopts it into
		// them; the coordinator holds the returned handle. A restart re-enters
		// with brand-new clients, so this always wires a fresh generation with
		// nothing stale surviving.
		this.homeAssistant.attachClients({
			createDiscovery: () => {
				const discovery = new MqttDiscoveryManager(
					gw.buildDiscoveryOptions(),
				)
				gw.adoptDiscoveryManager(discovery)
				return discovery
			},
			createServer: () => {
				// No Z-Wave client this generation (settings.zwave absent) ->
				// no server subsystem to own.
				if (!zwave) return undefined
				const server = new ZwaveServerManager(zwave.buildServerHost())
				zwave.adoptServerManager(server)
				return server
			},
		})

		try {
			await gw.start()
		} catch (error) {
			// Startup failure: quiesce the partially-started HA subsystem (halt
			// discovery, await the server destroy) BEFORE propagating, so no
			// producer/listener/subscription or server (port) leaks past a
			// failed start. Then rethrow to preserve the caller's error flow.
			this.homeAssistant.markFailed()
			await this.homeAssistant.stop()
			throw error
		}

		// Confirm the subsystem is up now that the gateway (and, through it,
		// the discovery + `@zwave-js/server` sub-managers) has started.
		this.homeAssistant.start()

		const pluginsConfig = settings.gateway?.plugins ?? null
		const pluginsRouter = express.Router()
		this.setPluginsRouter(pluginsRouter)

		if (pluginsConfig && Array.isArray(pluginsConfig)) {
			for (const plugin of pluginsConfig) {
				try {
					const pluginName = path.basename(plugin)
					const pluginsContext = {
						zwave,
						mqtt,
						app: pluginsRouter,
						logger: loggers.module(pluginName),
					}
					const constructor = (await import(plugin))
						.default as PluginConstructor
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
	}

	startZniffer(settings: utils.DeepPartial<ZnifferConfig> | undefined): void {
		if (settings) {
			this.setZniffer(
				new ZnifferManager(
					settings as ZnifferConfig,
					this.deps.getSocketServer(),
				),
			)
		}
	}

	async destroyPlugins(): Promise<void> {
		while (this.plugins.length > 0) {
			const instance = this.plugins.pop()
			if (instance && typeof instance.destroy === 'function') {
				logger.info('Closing plugin ' + instance.name)
				await instance.destroy()
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
	 * caller that closes the gateway - graceful {@link shutdown}, `/api/restart`,
	 * and a settings-change restart - routes through here so the ordering is
	 * always identical:
	 *
	 *  1. SERIALIZE against any in-flight `startGateway()` (await it), so a
	 *     shutdown/restart that races an in-progress start quiesces AFTER the
	 *     start settles rather than interleaving with it - no half-started
	 *     subscription/server can leak past the teardown.
	 *  2. QUIESCE the Home Assistant subsystem: halt every discovery producer/
	 *     listener/subscription and AWAIT the `@zwave-js/server` destroy, so no
	 *     rediscovery races the shutdown and the server (and its port) is gone
	 *     before the driver.
	 *  3. CLOSE the gateway (which closes the Z-Wave client - driver destroy -
	 *     then the MQTT client), then DESTROY the plugins.
	 *
	 * `requireProperty` selects the historical close-quirk: `/api/restart`
	 * passes `'close'` to preserve the native `TypeError` when no gateway is
	 * attached; graceful shutdown omits it to keep the pre-existing guarded
	 * `if (gw) await gw.close()` behavior.
	 */
	async teardownGateway(options?: {
		requireProperty?: string
	}): Promise<void> {
		// (1) Serialize against an in-flight start. Swallow its error here - the
		// start's own caller observes/handles the rejection; teardown only
		// needs the start to have settled before it quiesces.
		if (this.startInFlight) {
			await this.startInFlight.catch(() => undefined)
		}

		// Mark that a teardown is in progress so a concurrent request observes
		// "restarting" (the graceful-shutdown path has no HTTP surface, but
		// `/api/restart` already set this; keeping it here makes the invariant
		// hold for every caller).
		this.lifecycle = 'stopping'

		// (2) Quiesce HA before closing the clients.
		await this.homeAssistant.stop()

		// (3) Close the current gateway, then destroy plugins.
		if (options?.requireProperty !== undefined) {
			await this.requireGateway(options.requireProperty).close()
		} else {
			await this.closeIfPresent(this.gateway)
		}
		await this.destroyPlugins()
	}

	/**
	 * Closes the current gateway (if any) and destroys any loaded plugins -
	 * exactly what `gracefuShutdown()` in `api/app.ts` does on
	 * `SIGINT`/`SIGTERM`. Safe (guarded) - unlike route access above,
	 * `gracefuShutdown()`'s pre-existing `if (gw) await gw.close()` already
	 * guards against a missing gateway, so this preserves that same
	 * guarded behavior rather than the unguarded quirk.
	 *
	 * The Home Assistant subsystem is stopped BEFORE the collaborators are
	 * closed, quiescing its discovery producers/subscriptions and awaiting the
	 * `@zwave-js/server` destroy so no rediscovery races the client shutdown
	 * and the server is gone before the driver; the structural discovery/server
	 * teardown still runs inside `Gateway.close()`/`ZwaveClient.close()` at
	 * their locked positions (idempotent second passes).
	 */
	async shutdown(): Promise<void> {
		try {
			await this.teardownGateway()
		} catch (error) {
			logger.error('Error while closing gateway', error)
		}

		try {
			this.deps.gatewayFactory.dispose()
		} catch (error) {
			logger.error('Error while disposing gateway factory', error)
		}

		try {
			await this.closeIfPresent(this.zniffer)
		} catch (error) {
			logger.error('Error while closing zniffer', error)
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
