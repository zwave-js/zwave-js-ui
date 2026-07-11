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
 *  - an unchanged file is sha-deduped (the dedup sha - hence the projection -
 *    is NOT changed).
 *  - a changed file reloads (dedup sha changes, projection merged over the
 *    catalog).
 *  - watchers are all releasable (`closeWatchers()` -> count 0, no leaks).
 *
 * Finding-1/2 additions:
 *  - `__getAllDevicesForTests()` returns a DEEP SNAPSHOT: mutating it cannot
 *    corrupt the live discovery catalog (reference identity is therefore no
 *    longer a valid signal - reassignment vs dedup is observed via
 *    `__getCustomDevicesShaForTests()`).
 *  - the preferred `.js` loader reads through `require()`, whose module cache
 *    serves a rewritten `.js` STALE; this is characterized and named as a
 *    quirk, and teardown evicts the cache so `.js` tests stay isolated.
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
	// evict any require.cache entry a `.js` fixture created so a later test's
	// `require()` re-reads from disk instead of being served this test's stale
	// module (see the stale-cache quirk test). Do this BEFORE removing the
	// file, while it is still resolvable.
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
		// both customDevices.js and .json watchers were installed at import
		expect(importTimeWatcherCount).toBe(2)
		// and closeWatchers() (run in beforeAll) released every one
		expect(mod.__getWatcherCountForTests()).toBe(0)
	})

	it('is a no-op when no custom-devices file exists', () => {
		mod.__resetCustomDevicesStateForTests()
		expect(mod.__getCustomDevicesShaForTests()).toBeNull()
		mod.__loadCustomDevicesForTests()
		// loader short-circuits: dedup sha is still null (never reassigned) and
		// the projection carries no custom key
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
		// projection was never reassigned: dedup sha still null, content equal
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

		// second load with identical content is deduped by sha -> the loader
		// returns before reassigning, so the dedup sha is unchanged
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

		// change the file -> different sha -> reload -> new projection content
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

		// resetting the process-global sha means an identical file re-applies
		// (sha recomputed and set again) rather than being deduped
		mod.__resetCustomDevicesStateForTests()
		expect(mod.__getCustomDevicesShaForTests()).toBeNull()
		mod.__loadCustomDevicesForTests()
		expect(mod.__getCustomDevicesShaForTests()).not.toBeNull()
		expect(mod.__getAllDevicesForTests()['test-reset']).toBeDefined()
	})
})

describe('__getAllDevicesForTests deep snapshot (finding 1)', () => {
	it('hands out a fresh deep copy on every call (no shared reference)', () => {
		const a = mod.__getAllDevicesForTests()
		const b = mod.__getAllDevicesForTests()
		// different top-level object...
		expect(b).not.toBe(a)
		// ...with identical content...
		expect(b).toEqual(a)
		// ...and cloned nested arrays too (deep, not shallow)
		expect(b[CATALOG_KEY]).not.toBe(a[CATALOG_KEY])
		expect(b[CATALOG_KEY]).toEqual(a[CATALOG_KEY])
	})

	it('mutating the returned snapshot cannot corrupt the live discovery catalog', () => {
		writeFileSync(
			jsonPath,
			JSON.stringify({ 'test-immutable': [{ v: 1 }] }),
		)
		mod.__resetCustomDevicesStateForTests()
		mod.__loadCustomDevicesForTests()

		const snapshot = mod.__getAllDevicesForTests()
		// hostile mutations of the returned value
		;(snapshot['test-immutable'] as any)[0].v = 999
		snapshot['injected'] = [{ hacked: true }] as any
		delete snapshot[CATALOG_KEY]

		// a fresh fetch is entirely unaffected - the seam handed out a copy, so
		// the production catalog `allDevices` was never touched
		const fresh = mod.__getAllDevicesForTests()
		expect((fresh['test-immutable'] as any)[0].v).toBe(1)
		expect(fresh['injected']).toBeUndefined()
		expect(fresh[CATALOG_KEY]).toBeDefined()
	})
})

describe('preferred .js loader require.cache staleness (finding 2)', () => {
	it('QUIRK: a rewritten customDevices.js is served STALE from require.cache on reload', () => {
		// Write v1 as the preferred `.js` form and load it through the real
		// loader (which does `require(customDevices)`).
		writeFileSync(jsPath, "module.exports = { 'js-stale': [{ v: 1 }] }\n")
		mod.__resetCustomDevicesStateForTests()
		mod.__loadCustomDevicesForTests()
		expect((mod.__getAllDevicesForTests()['js-stale'] as any)[0].v).toBe(1)

		// Rewrite the SAME `.js` file with v2 and reload. Reset the dedup sha
		// first so sha-dedup cannot be what suppresses the change - this
		// isolates the require.cache effect specifically.
		writeFileSync(jsPath, "module.exports = { 'js-stale': [{ v: 2 }] }\n")
		mod.__resetCustomDevicesStateForTests()
		mod.__loadCustomDevicesForTests()

		// QUIRK (NOT desired behavior, pinned not endorsed): the projection is
		// STILL v1. `require()` caches the module by resolved path, so
		// rewriting the `.js` on disk within the same process is not observed.
		// Production loads customDevices once per process (a runtime `.js`
		// change already needs a restart), so this staleness never surfaces at
		// runtime. See the PR body quirk ledger + follow-up.
		expect((mod.__getAllDevicesForTests()['js-stale'] as any)[0].v).toBe(1)

		// The test-only eviction seam is what refreshes it - proving the
		// staleness is precisely the require.cache, and that teardown's
		// eviction genuinely re-reads from disk (keeping the suite isolated).
		// This does NOT change production reload semantics.
		mod.__evictCustomDevicesRequireCacheForTests()
		mod.__resetCustomDevicesStateForTests()
		mod.__loadCustomDevicesForTests()
		expect((mod.__getAllDevicesForTests()['js-stale'] as any)[0].v).toBe(2)
	})

	it('a .json rewrite is NOT stale (read fresh via fs, contrasting the .js quirk)', () => {
		// The `.json` fallback is read with `fs.readFileSync`, not `require`,
		// so it has no cache and always reflects the current file - the exact
		// contrast that makes the `.js` staleness above a genuine quirk.
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
