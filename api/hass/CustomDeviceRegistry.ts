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
}

function cloneCatalog(catalog: HassDeviceCatalog): HassDeviceCatalog {
	return Object.fromEntries(
		Object.entries(catalog).map(([deviceId, devices]) => [
			deviceId,
			[...devices],
		]),
	)
}

/**
 * Instance-owned legacy customDevices.js/customDevices.json catalog.
 *
 * A registry loads before installing its two watchers, matching the original
 * Gateway module bootstrap. dispose() releases every watcher and is reentrant.
 */
export class CustomDeviceRegistry implements HassDeviceRegistryPort {
	private readonly baseDevices: HassDeviceCatalog
	private readonly logger: Pick<HassLogger, 'error' | 'info'>
	private readonly customDevicesPath: string
	private readonly customDevicesJsPath: string
	private readonly customDevicesJsonPath: string
	private readonly watchers = new Map<string, fs.FSWatcher>()
	private allDevices: HassDeviceCatalog
	private lastCustomDevicesLoad: string | null = null
	private started = false

	public constructor(options: CustomDeviceRegistryOptions) {
		this.baseDevices = cloneCatalog(options.devices ?? builtInDevices)
		this.allDevices = cloneCatalog(this.baseDevices)
		this.logger = options.logger
		this.customDevicesPath = path.join(options.storeDir, 'customDevices')
		this.customDevicesJsPath = this.customDevicesPath + '.js'
		this.customDevicesJsonPath = this.customDevicesPath + '.json'
	}

	public start(): void {
		if (this.started) return

		this.started = true
		this.load()
		this.watch(this.customDevicesJsPath)
		this.watch(this.customDevicesJsonPath)
	}

	public load(): void {
		let loaded = ''
		let devices: HassDeviceCatalog | null = null

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

		const sha = crypto
			.createHash('sha256')
			.update(JSON.stringify(devices))
			.digest('hex')
		if (this.lastCustomDevicesLoad === sha) return

		this.logger.info(`Loading custom devices from ${loaded}`)
		this.lastCustomDevicesLoad = sha

		if (devices === null) {
			throw new TypeError('Custom devices catalog must be an object')
		}

		this.allDevices = Object.assign(
			cloneCatalog(this.baseDevices),
			cloneCatalog(devices),
		)
		this.logger.info(
			`Loaded ${
				Object.keys(devices).length
			} custom Hass devices configurations`,
		)
	}

	public get(deviceId: string | undefined) {
		return deviceId ? (this.allDevices[deviceId] ?? []) : []
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

	public reset(): void {
		this.lastCustomDevicesLoad = null
		this.allDevices = cloneCatalog(this.baseDevices)
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
		this.started = true
		this.watch(this.customDevicesJsPath)
		this.watch(this.customDevicesJsonPath)
	}

	public dispose(): void {
		for (const watcher of this.watchers.values()) watcher.close()
		this.watchers.clear()
		this.started = false
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
