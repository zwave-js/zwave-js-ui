import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CustomDeviceRegistry } from '../../../api/hass/CustomDeviceRegistry.ts'
import type { HassDeviceCatalog } from '../../../api/hass/types.ts'

const directories: string[] = []

function temporaryDirectory(): string {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hass-registry-'))
	directories.push(directory)
	return directory
}

function registry(storeDir: string) {
	return new CustomDeviceRegistry({
		storeDir,
		logger: { error: vi.fn(), info: vi.fn() },
		devices: {
			builtIn: [
				{
					type: 'sensor',
					object_id: 'built_in',
					discovery_payload: {},
					values: ['value'],
				},
			],
		},
	})
}

afterEach(() => {
	for (const directory of directories.splice(0)) {
		fs.rmSync(directory, { force: true, recursive: true })
	}
})

describe('CustomDeviceRegistry direct lifecycle', () => {
	it('is idempotent and reloads through directory and file watcher rebinding', async () => {
		const storeDir = temporaryDirectory()
		const instance = registry(storeDir)
		instance.start()
		instance.start()
		expect(instance.watcherCount).toBe(2)

		const custom: HassDeviceCatalog = {
			custom: [
				{
					type: 'switch',
					object_id: 'custom',
					discovery_payload: {},
					values: ['value'],
				},
			],
		}
		const filename = path.join(storeDir, 'customDevices.json')
		fs.writeFileSync(filename, JSON.stringify(custom))
		await vi.waitFor(() => expect(instance.get('custom')).toHaveLength(1))

		instance.rebind()
		expect(instance.watcherCount).toBe(2)
		fs.renameSync(filename, filename + '.moved')
		await vi.waitFor(() => expect(instance.watcherCount).toBe(2))

		instance.dispose()
		instance.dispose()
		expect(instance.watcherCount).toBe(0)
	})

	it('rejects a null catalog after hashing and isolates snapshots', () => {
		const storeDir = temporaryDirectory()
		fs.writeFileSync(path.join(storeDir, 'customDevices.json'), 'null')
		const instance = registry(storeDir)
		expect(() => instance.load()).toThrow(TypeError)
		expect(instance.sha).not.toBeNull()

		instance.reset()
		const snapshot = instance.snapshot()
		snapshot.builtIn[0].object_id = 'changed'
		expect(instance.get('builtIn')[0].object_id).toBe('built_in')
		expect(instance.get(undefined)).toEqual([])
		instance.set(undefined, [])
		instance.evictRequireCache()
	})
})
