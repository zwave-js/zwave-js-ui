/**
 * Shared, isolated environment bootstrap for the HTTP contract suite.
 *
 * `api/app.ts` (transitively, via `api/config/app.ts` and `api/lib/logger.ts`)
 * touches the filesystem at module-evaluation time: it resolves/creates a
 * `STORE_DIR`, persists a session secret, and ensures the store/logs
 * directories exist. If we let that default to the repository's real
 * `store/` directory, running these tests would pollute real application
 * data (session secret file, session store, log directory, ...).
 *
 * This module MUST be imported (and `ensureTestEnv()` called) before any
 * dynamic `import()` of `api/app.ts` or its config, so every HTTP test file
 * gets its own throwaway store directory instead of touching real data.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let storeDir: string | undefined

/**
 * Deterministic, non-production secret so JWTs signed/verified across
 * requests in a test are stable and never depend on a persisted file.
 * Exported so tests can sign their own tokens with `jsonwebtoken` to
 * characterize the `/api/authenticate` token flow and the `isAuthenticated`
 * JWT-header fallback.
 */
export const TEST_SESSION_SECRET =
	'http-contract-test-secret-do-not-use-in-production'

/**
 * Create (once per test file / module instance) an isolated STORE_DIR and
 * point the app's env vars at it. Safe to call multiple times.
 */
export function ensureTestEnv(): string {
	if (!storeDir) {
		storeDir = mkdtempSync(
			path.join(tmpdir(), 'zwave-js-ui-http-contract-'),
		)
		process.env.STORE_DIR = storeDir
		process.env.SESSION_SECRET = TEST_SESSION_SECRET
		// Never actually enumerated during these tests (ZWAVE_PORT unset,
		// serial ports are only listed by /api/serial-ports), but keep the
		// platform check honest by leaving process.platform untouched.
	}
	return storeDir
}

export function getTestStoreDir(): string {
	return ensureTestEnv()
}

/** Best-effort cleanup of the throwaway store directory. */
export function cleanupTestEnv(): void {
	if (storeDir) {
		rmSync(storeDir, { recursive: true, force: true })
	}
}
