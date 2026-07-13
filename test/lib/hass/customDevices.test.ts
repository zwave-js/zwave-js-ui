/**
 * Characterization tests for the custom-devices loader in `api/lib/Gateway.ts`
 * (`loadCustomDevices` + its `allDevices` projection + the `fs.watch` reload).
 *
 * The state is module-global, mutated at import and on `fs.watch` events. To
 * characterize the loader deterministically without racing `fs.watch`, these
 * tests import the real module against an isolated STORE_DIR, `closeWatchers()`
 * so no live watcher fires mid-test, then write real files and re-invoke the
 * real loader through `__loadCustomDevicesForTests()`, observing the projection
 * via `__getAllDevicesForTests()`.
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

// A known key from the base `api/hass/devices.ts` catalog, used to prove the
// loader merges custom devices over the catalog rather than replacing it
const CATALOG_KEY = '89-3-1'

beforeAll(async () => {
	storeDir = ensureTestEnv()
	mod = await import('../../../api/lib/Gateway.ts')
	// Snapshot the watchers installed at import time (with the files absent,
	// both fall back to watching the parent dir)
	importTimeWatcherCount = mod.__getWatcherCountForTests()
	// Stop the live fs.watch handlers so an async reload can't perturb the
	// deterministic seam-driven tests below
	mod.closeWatchers()
	jsPath = join(storeDir, 'customDevices.js')
	jsonPath = join(storeDir, 'customDevices.json')
})

afterEach(() => {
	// Reset process-global loader state and remove any files a test created
	mod.__resetCustomDevicesStateForTests()
	// Evict any require.cache entry a .js fixture created so a later test's
	// require() re-reads from disk; do this before removing the file, while
	// it's still resolvable
	mod.__evictCustomDevicesRequireCacheForTests()
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
		expect(importTimeWatcherCount).toBe(2)
		expect(mod.__getWatcherCountForTests()).toBe(0)
	})

	it('is a no-op when no custom-devices file exists', () => {
		mod.__resetCustomDevicesStateForTests()
		expect(mod.__getCustomDevicesShaForTests()).toBeNull()
		mod.__loadCustomDevicesForTests()
		expect(mod.__getCustomDevicesShaForTests()).toBeNull()
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

		expect(() => mod.__loadCustomDevicesForTests()).not.toThrow()
		expect(mod.__getCustomDevicesShaForTests()).toBeNull()
		expect(mod.__getAllDevicesForTests()).toEqual(before)
		expect(mod.__getAllDevicesForTests()['test-bad']).toBeUndefined()
	})

	it('sha-dedups an unchanged file (no reassignment on second load)', () => {
		writeFileSync(jsonPath, JSON.stringify({ 'test-dedup': [{ v: 1 }] }))
		mod.__resetCustomDevicesStateForTests()

		mod.__loadCustomDevicesForTests()
		const shaAfterFirst = mod.__getCustomDevicesShaForTests()
		expect(shaAfterFirst).not.toBeNull()
		expect(mod.__getAllDevicesForTests()['test-dedup']).toBeDefined()

		mod.__loadCustomDevicesForTests()
		expect(mod.__getCustomDevicesShaForTests()).toBe(shaAfterFirst)
	})

	it('reloads when the file content changes (dedup sha changes)', () => {
		writeFileSync(jsonPath, JSON.stringify({ 'test-reload': [{ v: 1 }] }))
		mod.__resetCustomDevicesStateForTests()
		mod.__loadCustomDevicesForTests()
		const shaAfterFirst = mod.__getCustomDevicesShaForTests()
		expect((mod.__getAllDevicesForTests()['test-reload'] as any)[0].v).toBe(
			1,
		)

		writeFileSync(jsonPath, JSON.stringify({ 'test-reload': [{ v: 2 }] }))
		mod.__loadCustomDevicesForTests()
		expect(mod.__getCustomDevicesShaForTests()).not.toBe(shaAfterFirst)
		expect((mod.__getAllDevicesForTests()['test-reload'] as any)[0].v).toBe(
			2,
		)
	})

	it('reset clears the dedup sha so identical content re-applies', () => {
		writeFileSync(jsonPath, JSON.stringify({ 'test-reset': [{ v: 1 }] }))
		mod.__resetCustomDevicesStateForTests()
		mod.__loadCustomDevicesForTests()
		expect(mod.__getCustomDevicesShaForTests()).not.toBeNull()

		mod.__resetCustomDevicesStateForTests()
		expect(mod.__getCustomDevicesShaForTests()).toBeNull()
		mod.__loadCustomDevicesForTests()
		expect(mod.__getCustomDevicesShaForTests()).not.toBeNull()
		expect(mod.__getAllDevicesForTests()['test-reset']).toBeDefined()
	})
})

describe('preferred .js loader require.cache staleness (finding 2)', () => {
	it('QUIRK: a rewritten customDevices.js is served STALE from require.cache on reload', () => {
		writeFileSync(jsPath, "module.exports = { 'js-stale': [{ v: 1 }] }\n")
		mod.__resetCustomDevicesStateForTests()
		mod.__loadCustomDevicesForTests()
		expect((mod.__getAllDevicesForTests()['js-stale'] as any)[0].v).toBe(1)

		// Rewrite the same .js with v2 and reload; reset the dedup sha first so
		// sha-dedup can't be what suppresses the change, isolating the
		// require.cache effect
		writeFileSync(jsPath, "module.exports = { 'js-stale': [{ v: 2 }] }\n")
		mod.__resetCustomDevicesStateForTests()
		mod.__loadCustomDevicesForTests()

		// QUIRK (pinned, not endorsed): the projection is still v1. require()
		// caches by resolved path, so rewriting the .js in-process isn't
		// observed. Production loads customDevices once per process (a runtime
		// .js change already needs a restart), so this never surfaces at runtime
		expect((mod.__getAllDevicesForTests()['js-stale'] as any)[0].v).toBe(1)

		// The eviction seam is what refreshes it, proving the staleness is
		// precisely require.cache and that teardown's eviction re-reads from
		// disk; production reload semantics are unchanged
		mod.__evictCustomDevicesRequireCacheForTests()
		mod.__resetCustomDevicesStateForTests()
		mod.__loadCustomDevicesForTests()
		expect((mod.__getAllDevicesForTests()['js-stale'] as any)[0].v).toBe(2)
	})

	it('a .json rewrite is NOT stale (read fresh via fs, contrasting the .js quirk)', () => {
		// The .json fallback uses fs.readFileSync, not require, so it has no
		// cache and always reflects the current file, the contrast that makes
		// the .js staleness a genuine quirk
		writeFileSync(jsonPath, JSON.stringify({ 'json-fresh': [{ v: 1 }] }))
		mod.__resetCustomDevicesStateForTests()
		mod.__loadCustomDevicesForTests()
		expect((mod.__getAllDevicesForTests()['json-fresh'] as any)[0].v).toBe(
			1,
		)

		writeFileSync(jsonPath, JSON.stringify({ 'json-fresh': [{ v: 2 }] }))
		mod.__resetCustomDevicesStateForTests()
		mod.__loadCustomDevicesForTests()
		expect((mod.__getAllDevicesForTests()['json-fresh'] as any)[0].v).toBe(
			2,
		)
	})
})
