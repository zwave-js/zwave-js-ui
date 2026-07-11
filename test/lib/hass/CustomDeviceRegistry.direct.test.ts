import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CustomDeviceRegistry } from '../../../api/hass/CustomDeviceRegistry.ts'
import type { HassDeviceCatalog } from '../../../api/hass/types.ts'

const directories: string[] = []
const registries: CustomDeviceRegistry[] = []

function temporaryDirectory(): string {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hass-registry-'))
	directories.push(directory)
	return directory
}

function registry(storeDir: string) {
	const instance = new CustomDeviceRegistry({
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
	registries.push(instance)
	return instance
}

function watcherHandles(instance: CustomDeviceRegistry): fs.FSWatcher[] {
	return [
		...(
			Reflect.get(instance, 'watchers') as Map<string, fs.FSWatcher>
		).values(),
	]
}

function activeHandles(): unknown[] {
	return (
		process as typeof process & {
			_getActiveHandles(): unknown[]
		}
	)._getActiveHandles()
}

afterEach(() => {
	for (const instance of registries.splice(0)) instance.dispose()
	for (const directory of directories.splice(0)) {
		fs.rmSync(directory, { force: true, recursive: true })
	}
})

describe('CustomDeviceRegistry direct lifecycle', () => {
	it('replaces old watchers and reloads renamed, recreated, and changed files after rebinding', async () => {
		const storeDir = temporaryDirectory()
		const instance = registry(storeDir)
		const load = vi.spyOn(instance, 'load')
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
		const firstHash = instance.sha
		expect(firstHash).not.toBeNull()
		load.mockClear()

		const oldWatchers = watcherHandles(instance)
		instance.rebind()
		expect(instance.watcherCount).toBe(2)
		const reboundWatchers = watcherHandles(instance)
		expect(reboundWatchers).toHaveLength(2)
		expect(reboundWatchers).not.toEqual(oldWatchers)
		await vi.waitFor(() =>
			expect(
				oldWatchers.every(
					(watcher) => !activeHandles().includes(watcher),
				),
			).toBe(true),
		)

		fs.renameSync(filename, filename + '.moved')
		await vi.waitFor(() => expect(load).toHaveBeenCalled())

		const recreated = {
			custom: [{ ...custom.custom[0], object_id: 'recreated' }],
		}
		fs.writeFileSync(filename, JSON.stringify(recreated))
		await vi.waitFor(() => {
			expect(instance.get('custom')[0].object_id).toBe('recreated')
			expect(instance.sha).not.toBe(firstHash)
		})
		const recreatedHash = instance.sha
		const callsAfterRecreate = load.mock.calls.length

		const changed = {
			custom: [{ ...custom.custom[0], object_id: 'changed' }],
		}
		fs.writeFileSync(filename, JSON.stringify(changed))
		await vi.waitFor(() => {
			expect(instance.get('custom')[0].object_id).toBe('changed')
			expect(instance.sha).not.toBe(recreatedHash)
			expect(load.mock.calls.length).toBeGreaterThan(callsAfterRecreate)
		})

		instance.dispose()
		instance.dispose()
		expect(instance.watcherCount).toBe(0)
		await vi.waitFor(() =>
			expect(
				reboundWatchers.every(
					(watcher) => !activeHandles().includes(watcher),
				),
			).toBe(true),
		)
	})

	it('shallow-merges null and malformed catalog entries as no devices', () => {
		const storeDir = temporaryDirectory()
		fs.writeFileSync(path.join(storeDir, 'customDevices.json'), 'null')
		const instance = registry(storeDir)
		expect(() => instance.start()).not.toThrow()
		expect(instance.sha).not.toBeNull()
		expect(instance.get('builtIn')).toHaveLength(1)

		fs.writeFileSync(
			path.join(storeDir, 'customDevices.json'),
			JSON.stringify({
				nullEntry: null,
				objectEntry: { malformed: true },
				numberEntry: 7,
				validEntry: [
					{
						type: 'sensor',
						object_id: 'valid',
						discovery_payload: {},
						values: ['value'],
					},
				],
			}),
		)
		instance.load()
		expect(instance.get('nullEntry')).toEqual([])
		expect(instance.get('objectEntry')).toEqual([])
		expect(instance.get('numberEntry')).toEqual([])
		expect(instance.get('validEntry')).toHaveLength(1)
		expect(instance.get('builtIn')).toHaveLength(1)

		const snapshot = instance.snapshot()
		snapshot.builtIn[0].object_id = 'changed'
		expect(instance.get('builtIn')[0].object_id).toBe('built_in')
		expect(instance.get(undefined)).toEqual([])
		instance.set(undefined, [])
		instance.evictRequireCache()
		instance.dispose()
	})

	it('retries the same file when replacement catalog construction fails', () => {
		const storeDir = temporaryDirectory()
		const filename = path.join(storeDir, 'customDevices.js')
		fs.writeFileSync(
			filename,
			[
				'let reads = 0',
				'const catalog = { retry: [{ type: "sensor", object_id: "retry", discovery_payload: {}, values: ["value"] }] }',
				'module.exports = new Proxy(catalog, {',
				'  get(target, key, receiver) {',
				'    if (key === "retry" && ++reads === 2) throw new Error("replacement failed")',
				'    return Reflect.get(target, key, receiver)',
				'  }',
				'})',
			].join('\n'),
		)
		const instance = registry(storeDir)

		expect(() => instance.load()).not.toThrow()
		expect(instance.sha).toBeNull()
		expect(instance.get('retry')).toEqual([])

		instance.load()
		expect(instance.sha).not.toBeNull()
		expect(instance.get('retry')[0].object_id).toBe('retry')
		instance.evictRequireCache()
	})
})
