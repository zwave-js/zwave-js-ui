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
 * `api/app.ts`/`api/config/app.ts` also read a number of *other* env vars
 * directly (HTTPS/FORCE_DISABLE_SSL, TRUST_PROXY, SSL cert/key paths, the
 * `.env.app`-documented gateway settings, ...) at both module-evaluation
 * and per-request time. If the process running the test suite happens to
 * have any of these set ambiently (a developer's shell, a CI runner, a
 * leftover from another test file in the same worker, ...), the app under
 * test would silently behave differently than the deterministic contract
 * these suites characterize - e.g. `sslDisabled` flipping, session cookies
 * becoming `Secure`, serial port enumeration being skipped, or `tz`/`locale`
 * echoing an ambient value instead of `undefined`.
 *
 * This module MUST be imported (and `ensureTestEnv()` called) before any
 * dynamic `import()` of `api/app.ts` or its config, so every HTTP test file
 * gets its own throwaway store directory AND a normalized set of app-facing
 * env vars, instead of inheriting ambient process state.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let storeDir: string | undefined

/**
 * Every env var `api/app.ts` or `api/config/app.ts` reads directly (either
 * documented in `.env.app.example` or referenced via `process.env.*` in
 * those two files). Snapshotted before the first mutation and restored on
 * `cleanupTestEnv()`, so ambient values from the host shell/CI runner (or a
 * previous test file sharing this worker process) can never leak into - or
 * out of - the app under test.
 */
const APP_ENV_VARS = [
	// `.env.app.example`-documented gateway/session/network settings
	'HOST',
	'PORT',
	'STORE_DIR',
	'SESSION_SECRET',
	'ZWAVE_PORT',
	'ZWAVE_EXTERNAL_SETTINGS',
	'NETWORK_KEY',
	'HTTPS',
	'USE_SECURE_COOKIE',
	'ZWAVEJS_EXTERNAL_CONFIG',
	'TZ',
	'LOCALE',
	// Read directly in `api/app.ts` / `api/config/app.ts` but not listed in
	// `.env.app.example`
	'FORCE_DISABLE_SSL',
	'TRUST_PROXY',
	'SSL_CERTIFICATE',
	'SSL_KEY',
	'ZWAVEJS_LOGS_DIR',
	'BACKUPS_DIR',
	'DEFAULT_USERNAME',
	'DEFAULT_PASSWORD',
	'BASE_PATH',
	'TAG_NAME',
] as const

let envSnapshot: Record<string, string | undefined> | undefined

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
 *
 * Snapshots every entry in `APP_ENV_VARS` on first call, then clears all of
 * them (`normalize`) before setting only the two this harness itself needs
 * (`STORE_DIR`, `SESSION_SECRET`), so app behavior only ever depends on
 * what this file - or an individual test - explicitly sets, never on
 * ambient process state.
 */
export function ensureTestEnv(): string {
	if (!storeDir) {
		envSnapshot = {}
		for (const key of APP_ENV_VARS) {
			envSnapshot[key] = process.env[key]
			delete process.env[key]
		}

		storeDir = mkdtempSync(
			path.join(tmpdir(), 'zwave-js-ui-http-contract-'),
		)
		process.env.STORE_DIR = storeDir
		process.env.SESSION_SECRET = TEST_SESSION_SECRET
		// `ZWAVE_PORT` stays unset so `/api/serial-ports` takes the
		// enumeration branch; the real `Driver.enumerateSerialPorts`
		// collaborator itself is replaced per-test via the app's
		// `setEnumerateSerialPorts` test hook (see `harness.ts`), so no
		// real serial/mDNS I/O ever happens. `process.platform` is left
		// untouched so that branch's check stays honest too.
	}
	return storeDir
}

export function getTestStoreDir(): string {
	return ensureTestEnv()
}

/**
 * Best-effort cleanup of the throwaway store directory AND restoration of
 * every `APP_ENV_VARS` entry to its pre-`ensureTestEnv()` value (or removal,
 * if it was unset), so nothing leaks into whatever runs next in this
 * process.
 */
export function cleanupTestEnv(): void {
	if (storeDir) {
		rmSync(storeDir, { recursive: true, force: true })
		storeDir = undefined
	}
	if (envSnapshot) {
		for (const key of APP_ENV_VARS) {
			const original = envSnapshot[key]
			if (original === undefined) {
				delete process.env[key]
			} else {
				process.env[key] = original
			}
		}
		envSnapshot = undefined
	}
}
