import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { createHttpHarness } from './harness.ts'
import { getTestStoreDir } from './env.ts'

/**
 * Regression coverage for `HttpHarness.close()`'s teardown, isolated in its
 * own file so it can safely create and close exactly ONE harness for the
 * whole suite.
 *
 * `routeContract.test.ts` previously created a SECOND harness, in the same
 * file, after the first one's `close()` had already run. That's unsafe:
 * `harness.ts`'s `appModulePromise`/`jsonStoreModulePromise`/
 * `gatewayModulePromise` are cached once per test file (so a second
 * `createHttpHarness()` call reuses the already-evaluated `api/app.ts`/
 * `api/lib/Gateway.ts` modules instead of re-importing them), while
 * `env.ts`'s `ensureTestEnv()` happily mints a brand new throwaway
 * `STORE_DIR` every time `storeDir` is `undefined`. The result: the
 * (cached) app's `config/app.ts`-derived `storeDir` constant keeps
 * pointing at the FIRST harness's directory - which the first `close()`
 * already deleted via `rmSync` - while `Gateway.ts`'s file watchers stay
 * bound to that same deleted path, and `defaultSnippets` would have kept
 * growing across `loadSnippets()` calls (fixed separately in `api/app.ts`
 * to clear itself first). None of that is fixable by "just create a
 * second harness carefully" - it's a structural mismatch between
 * per-file-cached modules and a lifecycle that assumes each harness owns
 * its own fresh module graph. So the actual fix (in `routeContract.test.ts`)
 * is to share ONE harness across that whole file; the fix here is to keep
 * this file's own single harness/close() pair, and assert its actual
 * observable teardown effects deterministically (no polling, no reliance
 * on `fs.watch` event timing) rather than assuming they happened.
 *
 * `api/lib/Gateway.ts` is deliberately imported dynamically INSIDE the test
 * below, not statically at this file's top - a static top-level import
 * would evaluate `Gateway.ts` (and transitively `api/config/app.ts`'s
 * `storeDir`, computed from `process.env.STORE_DIR`) before
 * `createHttpHarness()` ever calls `ensureTestEnv()`, freezing `storeDir`
 * at the wrong (real, non-isolated) value for this whole file - the exact
 * class of module-evaluation-order bug this suite exists to guard against.
 */
describe('HTTP harness teardown', () => {
	it(
		'close() restores the production serial-port enumerator default, ' +
			'removes the throwaway STORE_DIR from disk, and releases every ' +
			'Gateway file watcher it opened',
		async () => {
			const harness = await createHttpHarness()

			// Safe to import dynamically now: `createHttpHarness()` above
			// already called `ensureTestEnv()` (via `loadAppModule()`)
			// before importing anything that reads `storeDir`, and this
			// resolves to the exact same cached module instance the
			// harness itself already loaded.
			const { __getWatcherCountForTests } = await import(
				'../../../api/lib/Gateway.ts'
			)

			// Prove each piece of state this test asserts on post-close is
			// actually exercised beforehand - not vacuously true - so a
			// regression in `close()` itself can't hide behind assertions
			// that would have passed either way.
			harness.testHooks.setEnumerateSerialPorts(() =>
				Promise.resolve(['/dev/ttyFAKE']),
			)
			expect(
				harness.testHooks.isEnumerateSerialPortsProductionDefault(),
			).toBe(false)

			const storeDir = getTestStoreDir()
			expect(existsSync(storeDir)).toBe(true)
			expect(__getWatcherCountForTests()).toBeGreaterThan(0)

			await harness.close()

			expect(
				harness.testHooks.isEnumerateSerialPortsProductionDefault(),
			).toBe(true)
			expect(existsSync(storeDir)).toBe(false)
			expect(__getWatcherCountForTests()).toBe(0)
		},
	)
})
