/**
 * Characterization tests for the custom-devices loader in `api/lib/Gateway.ts`.
 *
 * `loadCustomDevicesCatalog(basePath, baseCatalog)` is the pure core the
 * `fs.watch`-driven projection is built on: it resolves `<basePath>.js`
 * (preferred) or `<basePath>.json`, overlays the parsed entries onto
 * `baseCatalog`, and returns the merged catalog plus a dedup sha, the custom
 * count, and the resolved path - or null when neither file exists or parsing
 * fails. Driving it with an injected basePath/baseCatalog exercises the real
 * loader without reaching into the module-global `allDevices`/`fs.watch` state.
 * Gateway.ts is imported dynamically after `ensureTestEnv()` so its
 * module-evaluation watches the throwaway STORE_DIR, never the repo store/.
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

describe('loadCustomDevicesCatalog', () => {
	it('returns null when neither .js nor .json exists', () => {
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

	it('returns null (without throwing) on a JSON parse failure', () => {
		const base = freshBase()
		writeFileSync(base + '.json', '{ not valid json ]')

		let result: ReturnType<GatewayModule['loadCustomDevicesCatalog']>
		expect(() => {
			result = mod.loadCustomDevicesCatalog(base, baseCatalog)
		}).not.toThrow()
		expect(result).toBeNull()
	})

	it('derives a stable sha for identical bytes and a different sha when content changes', () => {
		const a = freshBase()
		writeFileSync(a + '.json', JSON.stringify({ x: [device('x')] }))
		const b = freshBase()
		writeFileSync(b + '.json', JSON.stringify({ x: [device('x')] }))
		const c = freshBase()
		writeFileSync(c + '.json', JSON.stringify({ x: [device('y')] }))

		const shaA = loadOrFail(a, baseCatalog).sha
		const shaB = loadOrFail(b, baseCatalog).sha
		const shaC = loadOrFail(c, baseCatalog).sha

		// Identical bytes hash equal - the invariant the production reload
		// dedup (`lastCustomDevicesLoad === sha`) relies on to skip no-op reloads
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
		// Omitting baseCatalog merges over the non-empty `hassDevices`, so the
		// result carries more than just the single custom entry
		expect(Object.keys(result.catalog).length).toBeGreaterThan(1)
		expect(result.catalog['custom-default']).toBeDefined()
	})
})
