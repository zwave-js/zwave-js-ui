/**
 * Characterizes how custom Home Assistant device definitions are loaded: the
 * loader resolves a `.js` file (preferred) or `.json`, overlays its entries onto
 * the base catalog, and reports the merged catalog, a dedup hash, the
 * custom-device count, and which file was used - or nothing when neither file
 * exists or the JSON is malformed. Tests inject a base path and base catalog so
 * they drive the real loader against throwaway fixtures under an isolated store
 * dir, never the repo store/.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ensureTestEnv, cleanupTestEnv } from './env.ts'
import type * as GatewayModuleNS from '#api/lib/Gateway.ts'
import type { HassDevice } from '#api/lib/ZwaveClient.ts'

type GatewayModule = typeof GatewayModuleNS

let mod: GatewayModule
let storeDir: string
let counter = 0

// A distinct base path per test: `require()` caches a loaded `.js` by resolved
// path, so a fresh path guarantees each `.js` fixture is read from disk
function freshBase(): string {
	return join(storeDir, `customDevices-${counter++}`)
}

function device(objectId: string): HassDevice {
	return { type: 'sensor', object_id: objectId, discovery_payload: {} }
}

// Injected base catalog so the merge assertions don't depend on the real
// `hassDevices` contents
const baseCatalog: Record<string, HassDevice[]> = {
	'base-only': [device('base')],
}

function loadOrFail(base: string, cat?: Record<string, HassDevice[]>) {
	const result = mod.loadCustomDevicesCatalog(base, cat)
	if (!result) {
		throw new Error(`expected a custom-devices catalog for ${base}`)
	}
	return result
}

beforeAll(async () => {
	storeDir = ensureTestEnv()
	mod = await import('#api/lib/Gateway.ts')
	// Stop the live fs.watch handlers the module installs so an async reload
	// can't perturb these deterministic file-driven loads
	mod.closeWatchers()
})

afterAll(() => {
	mod.closeWatchers()
	cleanupTestEnv()
})

describe('loading the custom devices catalog', () => {
	it('loads nothing when neither a .js nor .json file exists', () => {
		expect(
			mod.loadCustomDevicesCatalog(freshBase(), baseCatalog),
		).toBeNull()
	})

	it('loads a .json file overlaid on the base catalog', () => {
		const base = freshBase()
		writeFileSync(
			base + '.json',
			JSON.stringify({ 'custom-json': [device('c')] }),
		)

		const result = loadOrFail(base, baseCatalog)

		expect(result.loaded).toBe(base + '.json')
		expect(result.customCount).toBe(1)
		// The base entry survives and the custom entry is added
		expect(result.catalog['base-only']).toEqual(baseCatalog['base-only'])
		expect(result.catalog['custom-json']).toEqual([device('c')])
	})

	it('prefers a .js file over .json when both exist', () => {
		const base = freshBase()
		writeFileSync(
			base + '.json',
			JSON.stringify({ shared: [device('json')] }),
		)
		writeFileSync(
			base + '.js',
			"module.exports = { shared: [{ type: 'sensor', object_id: 'js', discovery_payload: {} }] }\n",
		)

		const result = loadOrFail(base, baseCatalog)

		expect(result.loaded).toBe(base + '.js')
		expect(result.catalog.shared[0].object_id).toBe('js')
	})

	it('ignores a malformed JSON file instead of throwing', () => {
		const base = freshBase()
		writeFileSync(base + '.json', '{ not valid json ]')

		let result: ReturnType<GatewayModule['loadCustomDevicesCatalog']>
		expect(() => {
			result = mod.loadCustomDevicesCatalog(base, baseCatalog)
		}).not.toThrow()
		expect(result).toBeNull()
	})

	it('derives a stable hash for identical bytes and a new one when content changes', () => {
		const a = freshBase()
		writeFileSync(a + '.json', JSON.stringify({ x: [device('x')] }))
		const b = freshBase()
		writeFileSync(b + '.json', JSON.stringify({ x: [device('x')] }))
		const c = freshBase()
		writeFileSync(c + '.json', JSON.stringify({ x: [device('y')] }))

		const shaA = loadOrFail(a, baseCatalog).sha
		const shaB = loadOrFail(b, baseCatalog).sha
		const shaC = loadOrFail(c, baseCatalog).sha

		// Identical bytes hash equal, which is what lets an unchanged file skip
		// a no-op reload
		expect(shaB).toBe(shaA)
		expect(shaC).not.toBe(shaA)
	})

	it('overlays onto the real hass catalog when no base catalog is injected', () => {
		const base = freshBase()
		writeFileSync(
			base + '.json',
			JSON.stringify({ 'custom-default': [device('d')] }),
		)

		const result = loadOrFail(base)

		expect(result.customCount).toBe(1)
		// Omitting baseCatalog merges over the real `hassDevices`, so the custom
		// entry lands alongside the shipped catalog rather than a bare object
		expect(result.catalog['custom-default']).toBeDefined()
	})

	it('reflects on-disk edits to a .js custom-devices file across reloads', () => {
		// The .js loader is CommonJS and Node caches require() by resolved path,
		// so a reload after an edit only sees new bytes if the cache is evicted.
		// Reuse ONE base path (unlike freshBase) so the second load would hit
		// that cache; a regression that dropped the eviction would keep 'first'.
		const base = join(storeDir, 'customDevices-reload')
		writeFileSync(
			base + '.js',
			"module.exports = { reload: [{ type: 'sensor', object_id: 'first', discovery_payload: {} }] }\n",
		)
		const first = loadOrFail(base, baseCatalog)
		expect(first.catalog.reload[0].object_id).toBe('first')

		writeFileSync(
			base + '.js',
			"module.exports = { reload: [{ type: 'sensor', object_id: 'second', discovery_payload: {} }] }\n",
		)
		const second = loadOrFail(base, baseCatalog)

		// The edited entry is observed, and the changed bytes yield a fresh sha
		// so loadCustomDevices() re-projects instead of skipping the reload
		expect(second.catalog.reload[0].object_id).toBe('second')
		expect(second.sha).not.toBe(first.sha)
	})
})
