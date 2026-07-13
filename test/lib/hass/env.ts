/**
 * Environment bootstrap for the HASS characterization suite, layered on
 * `test/lib/http/env.ts`'s isolated `STORE_DIR`/env/`dotenv` setup.
 *
 * `Gateway.ts` installs real `fs.watch()` watchers under `storeDir` at
 * module-evaluation time and `api/config/app.ts` computes `storeDir` once at
 * first import, so any dynamic import of `Gateway.ts` before `ensureTestEnv()`
 * would permanently bind these modules to the real `store/` directory.
 *
 * The HASS modules also read three env vars the transport suites don't
 * (`HASS_ENV_VARS`): `UID_DISCOVERY_PREFIX` (a module-level const in
 * `Gateway.ts`, so it must be cleared before import),
 * `DISCOVERY_DISABLE_CC_CONFIGURATION`, and `MQTT_NAME`. `ensureTestEnv()`
 * snapshots and clears them before delegating; `cleanupTestEnv()` restores
 * them, so ambient values can't leak in or out.
 */
import {
	ensureTestEnv as ensureHttpTestEnv,
	cleanupTestEnv as cleanupHttpTestEnv,
	TEST_SESSION_SECRET,
} from '../http/env.ts'

/**
 * Env vars the HASS discovery modules read that the HTTP suite's
 * `APP_ENV_VARS` doesn't cover, snapshotted and cleared before any HASS module
 * imports so an ambient value can't repoint a discovery prefix, disable
 * Configuration-CC discovery, or rewrite the MQTT client id.
 */
const HASS_ENV_VARS = [
	'UID_DISCOVERY_PREFIX',
	'DISCOVERY_DISABLE_CC_CONFIGURATION',
	'MQTT_NAME',
] as const

let hassEnvSnapshot: Record<string, string | undefined> | undefined

/**
 * Snapshot and clear the HASS env vars, then delegate to the HTTP harness's
 * `ensureTestEnv()`. Clearing happens first, before any caller imports
 * `Gateway.ts`, so its module-level `UID_DISCOVERY_PREFIX` sees the cleared
 * default. Idempotent; returns the isolated store dir.
 */
export function ensureTestEnv(): string {
	if (!hassEnvSnapshot) {
		hassEnvSnapshot = {}
		for (const key of HASS_ENV_VARS) {
			hassEnvSnapshot[key] = process.env[key]
			delete process.env[key]
		}
	}
	return ensureHttpTestEnv()
}

export function getTestStoreDir(): string {
	return ensureTestEnv()
}

/**
 * Restore the HTTP-suite env and each `HASS_ENV_VARS` entry to its
 * pre-`ensureTestEnv()` value (or remove it), so nothing leaks into whatever
 * runs next.
 */
export function cleanupTestEnv(): void {
	cleanupHttpTestEnv()
	if (hassEnvSnapshot) {
		for (const key of HASS_ENV_VARS) {
			const original = hassEnvSnapshot[key]
			if (original === undefined) {
				delete process.env[key]
			} else {
				process.env[key] = original
			}
		}
		hassEnvSnapshot = undefined
	}
}

export { TEST_SESSION_SECRET }
