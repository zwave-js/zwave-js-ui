import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import { createRequire } from 'node:module'
import * as path from 'node:path'
import type {
	HassDevice,
	HassDeviceCatalog,
	HassDeviceCatalogSource,
} from '#api/hass/types'
import type { HassDeviceRegistryPort, HassLogger } from '#api/hass/ports'

const require = createRequire(import.meta.url)

export interface CustomDeviceWatcher {
	close(): void
	on(event: 'error', listener: (error: Error) => void): this
}

export type CustomDeviceWatch = (
	filename: string,
	listener: fs.WatchListener<string>,
) => CustomDeviceWatcher

export interface CustomDeviceRegistryOptions {
	storeDir: string
	logger: Pick<HassLogger, 'error' | 'info'>
	devices?: HassDeviceCatalog
	source?: CustomDeviceRegistry
	watch?: CustomDeviceWatch
}

function copyCatalog(catalog: unknown): HassDeviceCatalogSource {
	const copy: HassDeviceCatalogSource = {}
	// Preserve malformed custom-JS entries so lookups can ignore them without rejecting the whole catalog
	return Object.assign(copy, Object(catalog))
}

function copyCatalogProjection(
	catalog: HassDeviceCatalogSource,
): HassDeviceCatalogSource {
	const projection = copyCatalog(catalog)
	// Clone device arrays so dynamic discovery in one fork cannot mutate its source or siblings
	for (const deviceId of Object.keys(projection)) {
		const devices = projection[deviceId]
		if (Array.isArray(devices)) projection[deviceId] = [...devices]
	}
	return projection
}

export class CustomDeviceRegistry implements HassDeviceRegistryPort {
	private readonly baseDevices: HassDeviceCatalogSource
	private readonly logger: Pick<HassLogger, 'error' | 'info'>
	private readonly customDevicesPath: string
	private readonly customDevicesJsPath: string
	private readonly customDevicesJsonPath: string
	private readonly watchFile: CustomDeviceWatch
	private readonly watchers = new Map<string, CustomDeviceWatcher>()
	private readonly listeners = new Set<() => void>()
	private readonly source: CustomDeviceRegistry | undefined
	private allDevices: HassDeviceCatalogSource
	private lastCustomDevicesLoad: string | null = null
	private unsubscribeSource: (() => void) | undefined
	private started = false

	public constructor(options: CustomDeviceRegistryOptions) {
		this.source = options.source
		this.baseDevices = copyCatalog(options.devices)
		this.allDevices = options.source
			? options.source.copyProjection()
			: copyCatalog(this.baseDevices)
		this.logger = options.logger
		this.customDevicesPath = path.join(options.storeDir, 'customDevices')
		this.customDevicesJsPath = this.customDevicesPath + '.js'
		this.customDevicesJsonPath = this.customDevicesPath + '.json'
		this.watchFile =
			options.watch ??
			((filename, listener) => fs.watch(filename, listener))
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

	private load(): void {
		let loaded = ''
		let source: Buffer
		let devices: unknown

		try {
			if (fs.existsSync(this.customDevicesJsPath)) {
				loaded = this.customDevicesJsPath
				source = fs.readFileSync(loaded)
				// Evict the resolved module so watcher reloads observe same-path JavaScript edits
				const modulePath = require.resolve(this.customDevicesPath)
				delete require.cache[modulePath]
				devices = require(modulePath)
			} else if (fs.existsSync(this.customDevicesJsonPath)) {
				loaded = this.customDevicesJsonPath
				source = fs.readFileSync(loaded)
				devices = JSON.parse(source.toString())
			} else {
				return
			}
		} catch (error) {
			this.logger.error(`Failed to load ${loaded}:`, error)
			return
		}

		try {
			const sha = crypto.createHash('sha256').update(source).digest('hex')
			if (this.lastCustomDevicesLoad === sha) return

			const replacement = Object.assign(
				copyCatalog(this.baseDevices),
				Object(devices),
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

	public fork(): CustomDeviceRegistry {
		return new CustomDeviceRegistry({
			storeDir: path.dirname(this.customDevicesPath),
			logger: this.logger,
			source: this,
		})
	}

	public dispose(): void {
		this.unsubscribeSource?.()
		this.unsubscribeSource = undefined
		for (const watcher of this.watchers.values()) watcher.close()
		this.watchers.clear()
		this.listeners.clear()
		this.started = false
	}

	private copyProjection(): HassDeviceCatalogSource {
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
			this.trackWatcher(
				filename,
				this.watchFile(filename, (event) => {
					this.load()
					if (event === 'rename') {
						this.watchers.get(filename)?.close()
						this.watch(filename)
					}
				}),
			)
		} catch {
			this.trackWatcher(
				filename,
				this.watchFile(
					path.dirname(filename),
					(_event, changedFilename) => {
						if (
							!changedFilename ||
							changedFilename ===
								path.basename(this.customDevicesJsPath) ||
							changedFilename ===
								path.basename(this.customDevicesJsonPath)
						) {
							this.watchers.get(filename)?.close()
							this.watch(filename)
							this.load()
						}
					},
				),
			)
		}
	}

	private trackWatcher(filename: string, watcher: CustomDeviceWatcher): void {
		this.watchers.set(filename, watcher)
		watcher.on('error', (error) => {
			if (this.watchers.get(filename) !== watcher) return
			this.logger.error(`Failed to watch ${filename}:`, error)
			watcher.close()
			this.watchers.delete(filename)
		})
	}
}
