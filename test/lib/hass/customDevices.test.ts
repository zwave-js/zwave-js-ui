/**
 * Characterization tests for the custom-devices loader in `api/lib/Gateway.ts`
 * (`loadCustomDevices` + its `allDevices` projection + the `fs.watch`-backed
 * reload machinery).
 *
 * This state is module-global and normally mutated at import time and again
 * whenever an OS-level `fs.watch` event fires. To characterize the loader
 * DETERMINISTICALLY (without racing the notoriously unreliable `fs.watch`
 * event and without arbitrary sleeps), these tests:
 *   1. import the real module against an isolated STORE_DIR,
 *   2. snapshot the import-time watcher count, then `closeWatchers()` so no
 *      live watcher can fire mid-test,
 *   3. write real files into the isolated dir and re-invoke the REAL loader
 *      through the `__loadCustomDevicesForTests()` seam (the exact function
 *      the watcher would call), observing the projection via
 *      `__getAllDevicesForTests()`.
 *
 * Locked behavior:
 *  - `.js` takes precedence over `.json` when both exist.
 *  - no file -> loader is a no-op (projection stays the base catalog).
 *  - a parse/load failure is swallowed (projection unchanged, no throw).
 *  - an unchanged file is sha-deduped (projection object is NOT reassigned).
 *  - a changed file reloads (projection reassigned, merged over the catalog).
 *  - watchers are all releasable (`closeWatchers()` -> count 0, no leaks).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ensureTestEnv, cleanupTestEnv } from './env.ts'
import type * as GatewayModuleNS from '../../../api/lib/Gateway.ts'

type GatewayModule = typeof GatewayModuleNS

let mod: GatewayModule
let storeDir: string
let jsPath: string
let jsonPath: string
let importTimeWatcherCount: number

// a known key from the base `api/hass/devices.ts` catalog, used to prove the
// loader MERGES custom devices over the catalog rather than replacing it.
const CATALOG_KEY = '89-3-1'

beforeAll(async () => {
	storeDir = ensureTestEnv()
	mod = await import('../../../api/lib/Gateway.ts')
	// snapshot the watchers installed at import time (both customDevices.js and
	// .json fall back to watching the parent dir when the files are absent)
	importTimeWatcherCount = mod.__getWatcherCountForTests()
	// stop the live fs.watch handlers so the deterministic seam-driven tests
	// below are never perturbed by an asynchronous reload
	mod.closeWatchers()
	jsPath = join(storeDir, 'customDevices.js')
	jsonPath = join(storeDir, 'customDevices.json')
})

afterEach(() => {
	// reset process-global loader state + remove any files a test created
	mod.__resetCustomDevicesStateForTests()
	for (const p of [jsPath, jsonPath]) {
		if (existsSync(p)) rmSync(p, { force: true })
	}
})

afterAll(() => {
	mod.closeWatchers()
	cleanupTestEnv()
})

describe('loadCustomDevices projection', () => {
	it('installs two watchers at import time and releases them all', () => {
		// both customDevices.js and .json watchers were installed at import
		expect(importTimeWatcherCount).toBe(2)
		// and closeWatchers() (run in beforeAll) released every one
		expect(mod.__getWatcherCountForTests()).toBe(0)
	})

	it('is a no-op when no custom-devices file exists', () => {
		mod.__resetCustomDevicesStateForTests()
		const before = mod.__getAllDevicesForTests()
		mod.__loadCustomDevicesForTests()
		// projection is NOT reassigned (same reference) and has no custom key
		expect(mod.__getAllDevicesForTests()).toBe(before)
		expect(mod.__getAllDevicesForTests()['test-custom']).toBeUndefined()
	})

	it('loads a .json custom-devices file, merged over the base catalog', () => {
		const config = {
			'test-custom-json': [
				{
					type: 'sensor',
					object_id: 'custom',
					values: ['49-0-Air temperature'],
					discovery_payload: {
						state_topic: 'x',
						unit_of_measurement: '°C',
					},
				},
			],
		}
		writeFileSync(jsonPath, JSON.stringify(config))
		mod.__resetCustomDevicesStateForTests()
		mod.__loadCustomDevicesForTests()

		const all = mod.__getAllDevicesForTests()
		expect(all['test-custom-json']).toEqual(config['test-custom-json'])
		// base catalog is preserved by the merge
		expect(all[CATALOG_KEY]).toBeDefined()
	})

	it('prefers customDevices.js over customDevices.json when both exist', () => {
		writeFileSync(
			jsonPath,
			JSON.stringify({ 'test-precedence': [{ marker: 'json' }] }),
		)
		writeFileSync(
			jsPath,
			"module.exports = { 'test-precedence': [{ marker: 'js' }] }\n",
		)
		mod.__resetCustomDevicesStateForTests()
		mod.__loadCustomDevicesForTests()

		const all = mod.__getAllDevicesForTests()
		expect(all['test-precedence']).toBeDefined()
		expect((all['test-precedence'] as any)[0].marker).toBe('js')
	})

	it('swallows a JSON parse failure and leaves the projection unchanged', () => {
		writeFileSync(jsonPath, '{ this is not valid json ]')
		mod.__resetCustomDevicesStateForTests()
		const before = mod.__getAllDevicesForTests()

		// must not throw
		expect(() => mod.__loadCustomDevicesForTests()).not.toThrow()
		// projection was never reassigned
		expect(mod.__getAllDevicesForTests()).toBe(before)
		expect(mod.__getAllDevicesForTests()['test-bad']).toBeUndefined()
	})

	it('sha-dedups an unchanged file (no reassignment on second load)', () => {
		writeFileSync(jsonPath, JSON.stringify({ 'test-dedup': [{ v: 1 }] }))
		mod.__resetCustomDevicesStateForTests()

		mod.__loadCustomDevicesForTests()
		const afterFirst = mod.__getAllDevicesForTests()
		expect(afterFirst['test-dedup']).toBeDefined()

		// second load with identical content is deduped by sha -> the loader
		// returns before reassigning, so the projection is the SAME object
		mod.__loadCustomDevicesForTests()
		expect(mod.__getAllDevicesForTests()).toBe(afterFirst)
	})

	it('reloads when the file content changes (projection reassigned)', () => {
		writeFileSync(jsonPath, JSON.stringify({ 'test-reload': [{ v: 1 }] }))
		mod.__resetCustomDevicesStateForTests()
		mod.__loadCustomDevicesForTests()
		const afterFirst = mod.__getAllDevicesForTests()
		expect((afterFirst['test-reload'] as any)[0].v).toBe(1)

		// change the file -> different sha -> reload -> new projection object
		writeFileSync(jsonPath, JSON.stringify({ 'test-reload': [{ v: 2 }] }))
		mod.__loadCustomDevicesForTests()
		const afterSecond = mod.__getAllDevicesForTests()
		expect(afterSecond).not.toBe(afterFirst)
		expect((afterSecond['test-reload'] as any)[0].v).toBe(2)
	})

	it('reset clears the dedup sha so identical content re-applies', () => {
		writeFileSync(jsonPath, JSON.stringify({ 'test-reset': [{ v: 1 }] }))
		mod.__resetCustomDevicesStateForTests()
		mod.__loadCustomDevicesForTests()
		const first = mod.__getAllDevicesForTests()

		// resetting the process-global sha means an identical file re-applies
		// (new projection object) rather than being deduped
		mod.__resetCustomDevicesStateForTests()
		expect(mod.__getAllDevicesForTests()).not.toBe(first)
		mod.__loadCustomDevicesForTests()
		expect(mod.__getAllDevicesForTests()).not.toBe(first)
		expect(mod.__getAllDevicesForTests()['test-reset']).toBeDefined()
	})
})
