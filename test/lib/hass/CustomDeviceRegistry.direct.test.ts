import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	CustomDeviceRegistry,
	type CustomDeviceRegistryOptions,
} from '#api/hass/CustomDeviceRegistry'
import type { HassDevice, HassDeviceCatalog } from '#api/hass/types'

function device(name: string): HassDevice {
	return {
		type: 'sensor',
		object_id: name,
		discovery_payload: { name },
		values: [],
	}
}

describe('CustomDeviceRegistry', () => {
	const directories: string[] = []
	const registries: CustomDeviceRegistry[] = []

	function createRegistry(catalogs: HassDeviceCatalog = {}): {
		registry: CustomDeviceRegistry
		storeDir: string
		logger: CustomDeviceRegistryOptions['logger']
	} {
		const storeDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'zui-custom-devices-'),
		)
		const logger = {
			error: vi.fn(),
			info: vi.fn(),
		}
		const registry = new CustomDeviceRegistry({
			storeDir,
			logger,
			devices: catalogs,
		})
		directories.push(storeDir)
		registries.push(registry)
		return { registry, storeDir, logger }
	}

	afterEach(() => {
		for (const registry of registries.splice(0)) registry.dispose()
		for (const directory of directories.splice(0)) {
			fs.rmSync(directory, { recursive: true, force: true })
		}
	})

	it('prefers custom JSON over configured devices', () => {
		const builtIn = device('built-in')
		const custom = device('custom')
		const { registry, storeDir } = createRegistry({
			'built-in-id': [builtIn],
		})
		fs.writeFileSync(
			path.join(storeDir, 'customDevices.json'),
			JSON.stringify({ 'custom-id': [custom] }),
		)

		registry.start()

		expect(registry.get('built-in-id')).toEqual([builtIn])
		expect(registry.get('custom-id')).toEqual([custom])
	})

	it('prefers JavaScript catalogs over JSON catalogs', () => {
		const fromJson = device('from-json')
		const fromJavaScript = device('from-javascript')
		const { registry, storeDir } = createRegistry()
		fs.writeFileSync(
			path.join(storeDir, 'customDevices.json'),
			JSON.stringify({ preferred: [fromJson] }),
		)
		fs.writeFileSync(
			path.join(storeDir, 'customDevices.js'),
			`module.exports = ${JSON.stringify({ preferred: [fromJavaScript] })}`,
		)
		registry.start()

		expect(registry.get('preferred')).toEqual([fromJavaScript])
	})

	it('keeps configured devices when custom JSON is invalid', () => {
		const configured = device('configured')
		const { registry, storeDir, logger } = createRegistry({
			stable: [configured],
		})
		fs.writeFileSync(
			path.join(storeDir, 'customDevices.json'),
			'{ invalid JSON',
		)

		expect(() => registry.start()).not.toThrow()
		expect(registry.get('stable')).toEqual([configured])
		expect(logger.error).toHaveBeenCalled()
	})

	it('ignores malformed JavaScript entries without rejecting valid ones', () => {
		const configured = device('configured')
		const { registry, storeDir } = createRegistry()
		fs.writeFileSync(
			path.join(storeDir, 'customDevices.js'),
			`module.exports = ${JSON.stringify({
				valid: [configured],
				malformed: 'not-a-device-list',
			})}`,
		)

		registry.start()

		expect(registry.get('valid')).toEqual([configured])
		expect(registry.get('malformed')).toEqual([])
	})

	it('serves changed JSON after file updates', async () => {
		const first = device('first')
		const second = device('second')
		const { registry, storeDir } = createRegistry()
		const filename = path.join(storeDir, 'customDevices.json')
		fs.writeFileSync(filename, JSON.stringify({ thermostat: [first] }))
		registry.start()
		const gatewayRegistry = registry.fork()
		registries.push(gatewayRegistry)
		gatewayRegistry.start()

		expect(gatewayRegistry.get('thermostat')).toEqual([first])

		fs.writeFileSync(filename, JSON.stringify({ thermostat: [second] }))

		await vi.waitFor(() => {
			expect(gatewayRegistry.get('thermostat')).toEqual([second])
		})
	})

	it('serves changed JavaScript after file updates', async () => {
		const first = device('first')
		const second = device('second')
		const { registry, storeDir } = createRegistry()
		const filename = path.join(storeDir, 'customDevices.js')
		fs.writeFileSync(
			filename,
			`module.exports = ${JSON.stringify({ thermostat: [first] })}`,
		)
		registry.start()
		const gatewayRegistry = registry.fork()
		registries.push(gatewayRegistry)
		gatewayRegistry.start()

		expect(gatewayRegistry.get('thermostat')).toEqual([first])

		fs.writeFileSync(
			filename,
			`module.exports = ${JSON.stringify({ thermostat: [second] })}`,
		)

		await vi.waitFor(() => {
			expect(gatewayRegistry.get('thermostat')).toEqual([second])
		})
	})

	it('ignores file changes after closing', async () => {
		const beforeDispose = device('before-dispose')
		const afterDispose = device('after-dispose')
		const { registry, storeDir } = createRegistry()
		const filename = path.join(storeDir, 'customDevices.json')
		fs.writeFileSync(
			filename,
			JSON.stringify({ multilevel: [beforeDispose] }),
		)
		registry.start()
		const gatewayRegistry = registry.fork()
		registries.push(gatewayRegistry)
		gatewayRegistry.start()
		registry.dispose()

		fs.writeFileSync(
			filename,
			JSON.stringify({ multilevel: [afterDispose] }),
		)
		await new Promise((resolve) => setTimeout(resolve, 50))

		expect(gatewayRegistry.get('multilevel')).toEqual([beforeDispose])
	})

	it('keeps discoveries isolated between registries', () => {
		const configured = device('configured')
		const discovered = device('discovered')
		const { registry } = createRegistry({ dimmer: [configured] })
		registry.start()
		const firstGateway = registry.fork()
		const secondGateway = registry.fork()
		registries.push(firstGateway, secondGateway)
		firstGateway.start()
		secondGateway.start()

		firstGateway.set('dimmer', [configured, discovered])

		expect(firstGateway.get('dimmer')).toEqual([configured, discovered])
		expect(secondGateway.get('dimmer')).toEqual([configured])
		expect(registry.get('dimmer')).toEqual([configured])
	})
})
