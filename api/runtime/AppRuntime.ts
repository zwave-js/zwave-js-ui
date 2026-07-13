import type { Router } from 'express'
import express from 'express'
import path from 'node:path'
import { readdir, readFile, stat } from 'node:fs/promises'
import type { Server as SocketServer } from 'socket.io'
import type { GatewayConfig } from '../lib/Gateway.ts'
import Gateway from '../lib/Gateway.ts'
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

const logger = loggers.module('Runtime')

// `BackupManager.init()`/`.close()`'s `owner` parameter doesn't exist in
// this layer's own `BackupManager.ts` - it's this (base) layer's own,
// independently-added ownership token. A single shared constant (mirroring
// how `api/app.ts`'s pre-extraction code passes its own module-level
// `backupManagerOwner` to the same calls) is the minimal way to keep every
// `backupManager.init()` call site (here and in `routes/settings.ts`)
// type-checking against it.
export const backupManagerOwner = Symbol()

// Standalone rather than an AppRuntime method so routes and the runtime can both call it without a circular import
export function isAuthEnabled(): boolean {
	return jsonStore.get(store.settings).gateway?.authEnabled === true
}

// Structural type for anything AppRuntime shuts down (Gateway, ZnifferManager), used only by the shutdown helper below
export interface ManagedService {
	close(): Promise<void>
}

export interface AppRuntimeDeps {
	// Getter, not a direct value, since AppRuntime is constructed before setupSocket() binds the real server
	getSocketServer(): SocketServer
}

// Owns the backend collaborators whose identity changes across the process lifetime (gateway, zniffer, plugins)
// Accessors always resolve the current value rather than caching, so a mid-restart replacement is immediately visible to every consumer
export class AppRuntime {
	private gateway?: Gateway
	private zniffer?: ZnifferManager
	private pluginsRouter?: Router
	private plugins: CustomPlugin[] = []
	private restarting = false

	private defaultSnippets: utils.Snippet[] = []

	private readonly deps: AppRuntimeDeps

	constructor(deps: AppRuntimeDeps) {
		this.deps = deps
	}

	getGateway(): Gateway | undefined {
		return this.gateway
	}

	setGateway(value: Gateway | undefined): void {
		this.gateway = value
	}

	requireGateway(): Gateway {
		if (this.gateway === undefined) {
			throw new Error('Gateway is not initialized')
		}
		return this.gateway
	}

	// Covers both "no gateway attached" and "gateway attached without a zwave client" in one clean typed failure
	requireZwaveClient(): ZWaveClient {
		if (this.gateway?.zwave === undefined) {
			throw new Error('Z-Wave client not inited')
		}
		return this.gateway.zwave
	}

	getZniffer(): ZnifferManager | undefined {
		return this.zniffer
	}

	setZniffer(value: ZnifferManager | undefined): void {
		this.zniffer = value
	}

	requireZniffer(): ZnifferManager {
		if (this.zniffer === undefined) {
			throw new Error('Zniffer is not initialized')
		}
		return this.zniffer
	}

	getPluginsRouter(): Router | undefined {
		return this.pluginsRouter
	}

	setPluginsRouter(value: Router | undefined): void {
		this.pluginsRouter = value
	}

	getPlugins(): readonly CustomPlugin[] {
		return this.plugins
	}

	isRestarting(): boolean {
		return this.restarting
	}

	setRestarting(value: boolean): void {
		this.restarting = value
	}

	// Clears defaultSnippets first so repeated calls can't duplicate entries, though production only calls this once at startup
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
		// sanitizedConfig() normalizes null, undefined, and {} identically, so falling back to {} here is safe
		loggers.setupAll(settings?.gateway ?? {})
	}

	async startGateway(settings: PersistedSettings): Promise<void> {
		// Definite assignment (!) centralizes a known type/runtime mismatch here instead of scattering | undefined handling across each call site below
		let mqtt!: MqttClient
		let zwave!: ZWaveClient

		if (isAuthEnabled() && !process.env.SESSION_SECRET) {
			logger.warn(
				'SESSION_SECRET env var is not set; using an auto-generated secret persisted in the store. ' +
					'Set SESSION_SECRET explicitly to control the secret across environments.',
			)
		}

		if (settings.mqtt) {
			// Cast is safe since the frontend always persists a complete mqtt section, never a sparse partial
			mqtt = new MqttClient(settings.mqtt as MqttConfig)
		}

		if (settings.zwave) {
			// Same boundary as settings.mqtt above, for ZwaveConfig
			zwave = new ZWaveClient(
				settings.zwave as ZwaveConfig,
				this.deps.getSocketServer(),
			)
		}

		// zwave/mqtt may be undefined here despite their non-optional type; the mismatch is tolerated, matching BackupManager/Gateway's own accepted types
		backupManager.init(zwave, backupManagerOwner)

		// Gateway is always constructed, unlike mqtt/zwave, since its constructor already accepts GatewayConfig | undefined
		const gw = new Gateway(settings.gateway as GatewayConfig, zwave, mqtt)
		this.setGateway(gw)

		await gw.start()

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

		this.setRestarting(false)
	}

	startZniffer(settings: utils.DeepPartial<ZnifferConfig> | undefined): void {
		if (settings) {
			// Same cast boundary as startGateway's mqtt/zwave construction, for ZnifferConfig
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

	// Guards for a missing gateway, unlike requireGateway's throw, matching gracefulShutdown's existing pattern
	async shutdown(): Promise<void> {
		await this.closeIfPresent(this.gateway)
		await this.destroyPlugins()
	}
}

async function isSnippetFile(file: string): Promise<boolean> {
	return (await stat(file)).isFile() && file.endsWith('.js')
}
