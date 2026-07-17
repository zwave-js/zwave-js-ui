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
import type { GatewayPort, ZnifferPort, ZwaveClientPort } from './ports.ts'

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
}

export class AppRuntime {
	private _gateway?: GatewayPort
	private _zniffer?: ZnifferPort
	private _pluginsRouter?: Router
	private plugins: CustomPlugin[] = []
	private _restarting = false
	private _ownsDebugSession = false

	// Isolate BackupManager ownership between AppRuntime instances
	private readonly backupManagerOwner = Symbol('AppRuntime.backupManager')

	private defaultSnippets: utils.Snippet[] = []

	private readonly deps: AppRuntimeDeps

	constructor(deps: AppRuntimeDeps) {
		this.deps = deps
		this._gateway = deps.gateway
		this._zniffer = deps.zniffer
		this._restarting = deps.restarting ?? false
	}

	get gateway(): GatewayPort | undefined {
		return this._gateway
	}

	private setGateway(value: GatewayPort | undefined): void {
		this._gateway = value
	}

	requireGateway(): GatewayPort {
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

	requireZniffer(): ZnifferPort {
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

	// Cancel only the debug session started by this runtime
	get ownsDebugSession(): boolean {
		return this._ownsDebugSession
	}

	setOwnsDebugSession(value: boolean): void {
		this._ownsDebugSession = value
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

		const snippetsCache = this._gateway?.zwave?.cacheSnippets ?? []
		return [...snippetsCache, ...this.defaultSnippets, ...snippets]
	}

	setupLogging(
		settings: { gateway?: utils.DeepPartial<GatewayConfig> } | undefined,
	): void {
		loggers.setupAll(settings?.gateway ?? {})
	}

	async startGateway(settings: PersistedSettings): Promise<void> {
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

	async shutdown(): Promise<void> {
		try {
			await this.closeIfPresent(this._gateway)
		} catch (error) {
			logger.error('Error while closing gateway', error)
		}

		try {
			await this.closeIfPresent(this._zniffer)
		} catch (error) {
			logger.error('Error while closing zniffer', error)
		}

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
