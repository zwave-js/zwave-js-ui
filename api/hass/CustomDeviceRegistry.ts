import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import { createRequire } from 'node:module'
import * as path from 'node:path'
import builtInDevices from './devices.ts'
import type { HassDevice, HassDeviceCatalog } from './types.ts'
import type { HassDeviceRegistryPort, HassLogger } from './ports.ts'

const require = createRequire(import.meta.url)

export interface CustomDeviceRegistryOptions {
	storeDir: string
	logger: Pick<HassLogger, 'error' | 'info'>
	devices?: HassDeviceCatalog
	source?: CustomDeviceRegistry
}

function copyCatalog(catalog: unknown): HassDeviceCatalog {
	// Copy shallowly so malformed entries remain visible while get() treats them as empty
	return Object.assign({}, catalog) as HassDeviceCatalog
}

function copyCatalogProjection(catalog: HassDeviceCatalog): HassDeviceCatalog {
	const projection = copyCatalog(catalog)
	// Clone each device array so mutations in one fork cannot reach its source or siblings
	for (const deviceId of Object.keys(projection)) {
		const devices = projection[deviceId]
		if (Array.isArray(devices)) projection[deviceId] = [...devices]
	}
	return projection
}

export class CustomDeviceRegistry implements HassDeviceRegistryPort {
	private readonly baseDevices: HassDeviceCatalog
	private readonly logger: Pick<HassLogger, 'error' | 'info'>
	private readonly customDevicesPath: string
	private readonly customDevicesJsPath: string
	private readonly customDevicesJsonPath: string
	private readonly watchers = new Map<string, fs.FSWatcher>()
	private readonly listeners = new Set<() => void>()
	private readonly source: CustomDeviceRegistry | undefined
	private allDevices: HassDeviceCatalog
	private lastCustomDevicesLoad: string | null = null
	private unsubscribeSource: (() => void) | undefined
	private started = false

	public constructor(options: CustomDeviceRegistryOptions) {
		this.source = options.source
		this.baseDevices = copyCatalog(options.devices ?? builtInDevices)
		this.allDevices = options.source
			? options.source.copyProjection()
			: copyCatalog(this.baseDevices)
		this.logger = options.logger
		this.customDevicesPath = path.join(options.storeDir, 'customDevices')
		this.customDevicesJsPath = this.customDevicesPath + '.js'
		this.customDevicesJsonPath = this.customDevicesPath + '.json'
	}

	public start(): void {
		if (this.started) return

		this.started = true
		if (this.source) {
			this.allDevices = this.source.copyProjection()
			this.unsubscribeSource = this.source.subscribe(() => {
				this.allDevices = this.source?.copyProjection() ?? {}
			})
			return
		}

		// Load before watching both catalog paths to preserve import-time bootstrap semantics
		this.load()
		this.watch(this.customDevicesJsPath)
		this.watch(this.customDevicesJsonPath)
	}

	public load(): void {
		let loaded = ''
		let devices: unknown

		try {
			if (fs.existsSync(this.customDevicesJsPath)) {
				loaded = this.customDevicesJsPath
				devices = require(this.customDevicesPath)
			} else if (fs.existsSync(this.customDevicesJsonPath)) {
				loaded = this.customDevicesJsonPath
				devices = JSON.parse(fs.readFileSync(loaded).toString())
			} else {
				return
			}
		} catch (error) {
			this.logger.error(`Failed to load ${loaded}:`, error)
			return
		}

		try {
			const sha = crypto
				.createHash('sha256')
				.update(JSON.stringify(devices))
				.digest('hex')
			if (this.lastCustomDevicesLoad === sha) return

			const replacement = Object.assign(
				copyCatalog(this.baseDevices),
				devices,
			)
			const loadedCount =
				devices !== null &&
				(typeof devices === 'object' || typeof devices === 'function')
					? Object.keys(devices).length
					: 0

			this.logger.info(`Loading custom devices from ${loaded}`)
			this.allDevices = replacement
			this.lastCustomDevicesLoad = sha
			this.notify()
			this.logger.info(
				`Loaded ${loadedCount} custom Hass devices configurations`,
			)
		} catch (error) {
			this.logger.error(`Failed to load ${loaded}:`, error)
		}
	}

	public get(deviceId: string | undefined) {
		const devices = deviceId ? this.allDevices[deviceId] : undefined
		return Array.isArray(devices) ? devices : []
	}

	public set(deviceId: string | undefined, devices: HassDevice[]): void {
		if (deviceId !== undefined) this.allDevices[deviceId] = devices
	}

	public snapshot(): HassDeviceCatalog {
		return structuredClone(this.allDevices)
	}

	public get sha(): string | null {
		return this.lastCustomDevicesLoad
	}

	public get watcherCount(): number {
		return this.watchers.size
	}

	public get activeWatcherCount(): number {
		const getActiveHandles = Reflect.get(process, '_getActiveHandles')
		if (typeof getActiveHandles !== 'function') return 0
		const activeHandles: unknown[] = Reflect.apply(
			getActiveHandles,
			process,
			[],
		)
		return [...this.watchers.values()].filter((watcher) =>
			activeHandles.includes(watcher),
		).length
	}

	public get watcherPaths(): string[] {
		return [...this.watchers.keys()]
	}

	public get subscriberCount(): number {
		return this.listeners.size
	}

	public fork(): CustomDeviceRegistry {
		return new CustomDeviceRegistry({
			storeDir: path.dirname(this.customDevicesPath),
			logger: this.logger,
			source: this,
		})
	}

	public reset(): void {
		this.lastCustomDevicesLoad = null
		this.allDevices = copyCatalog(this.baseDevices)
		this.notify()
	}

	public evictRequireCache(): void {
		for (const key of [
			this.customDevicesJsPath,
			this.customDevicesJsonPath,
		]) {
			delete require.cache[key]
		}
	}

	public rebind(): void {
		this.dispose()
		this.start()
	}

	public dispose(): void {
		this.unsubscribeSource?.()
		this.unsubscribeSource = undefined
		for (const watcher of this.watchers.values()) watcher.close()
		this.watchers.clear()
		this.started = false
	}

	private copyProjection(): HassDeviceCatalog {
		return copyCatalogProjection(this.allDevices)
	}

	private subscribe(listener: () => void): () => void {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	private notify(): void {
		for (const listener of this.listeners) listener()
	}

	private watch(filename: string): void {
		try {
			this.watchers.set(
				filename,
				fs.watch(filename, (event: string) => {
					this.load()
					if (event === 'rename') {
						this.watchers.get(filename)?.close()
						this.watch(filename)
					}
				}),
			)
		} catch {
			this.watchers.set(
				filename,
				fs.watch(path.dirname(filename), (_event, changedFilename) => {
					if (
						!changedFilename ||
						changedFilename === 'customDevices.js' ||
						changedFilename === 'customDevices.json'
					) {
						this.watchers.get(filename)?.close()
						this.watch(filename)
						this.load()
					}
				}),
			)
		}
	}
}
