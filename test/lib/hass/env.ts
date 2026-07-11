/**
 * Environment bootstrap for the Home Assistant (HASS) characterization
 * suite.
 *
 * The HASS integration code under characterization here
 * (`api/lib/Gateway.ts`, `api/lib/MqttClient.ts`, `api/lib/ZwaveClient.ts`)
 * needs the exact same isolated `STORE_DIR` / normalized env-var /
 * mocked-`dotenv` setup the HTTP and Socket.IO contract suites already
 * built in `test/lib/http/env.ts` (see that file's doc comment for the full
 * rationale).
 *
 * The reason is even more acute here than for the transport suites:
 * `api/lib/Gateway.ts` resolves `storeDir + '/customDevices'` and installs
 * real `fs.watch()` watchers on `customDevices.js`/`.json` at
 * module-evaluation time (see its module-level `loadCustomDevices()` /
 * `watch()` calls), and `api/config/app.ts` computes `storeDir` ONCE, the
 * first time it is imported. Any test that dynamically imports `Gateway.ts`
 * (or `ZwaveClient.ts`, or `MqttClient.ts`) BEFORE `ensureTestEnv()` has
 * pointed `STORE_DIR` at a throwaway directory would permanently bind those
 * modules to the real repository `store/` directory - installing watchers
 * on, and potentially writing customDevices/nodes.json into, real
 * application data.
 *
 * ### HASS-specific env vars (`HASS_ENV_VARS`)
 *
 * The HTTP suite's `APP_ENV_VARS` snapshot/clear/restore list covers every
 * var `api/app.ts`/`api/config/app.ts` read, but the HASS discovery modules
 * read THREE more that the transport code never touches:
 *
 *  - `UID_DISCOVERY_PREFIX` (`api/lib/Gateway.ts` module-level `const`,
 *    captured ONCE at import) - the prefix for every discovery `unique_id`
 *    and device `identifiers`. Because it is read at module-evaluation time,
 *    it MUST be cleared BEFORE `Gateway.ts` is dynamically imported, or an
 *    ambient value permanently poisons every `unique_id` the suite asserts.
 *  - `DISCOVERY_DISABLE_CC_CONFIGURATION` (`api/lib/Gateway.ts`, read at
 *    discovery time) - when `=== 'true'` it suppresses Configuration-CC
 *    entities. An ambient `'true'` would silently make config-CC discovery a
 *    no-op.
 *  - `MQTT_NAME` (`api/lib/MqttClient.ts`, read when the client id is built)
 *    - overrides `config.name` in the `ZWAVE_GATEWAY-<name>` client id, which
 *    the status/availability topics derive from. An ambient value would flip
 *    every asserted client id / status topic.
 *
 * `ensureTestEnv()` snapshots and clears these three BEFORE delegating to the
 * HTTP harness's `ensureTestEnv()` (which clears the rest and points
 * `STORE_DIR` at the throwaway dir), and `cleanupTestEnv()` restores them to
 * their exact pre-test values (or removes them if they were unset), so an
 * ambient value from the host shell/CI runner can neither leak INTO the app
 * under test nor OUT of it into whatever runs next in the worker.
 * `envIsolation.test.ts` proves this with hostile ambient values.
 */
import {
	ensureTestEnv as ensureHttpTestEnv,
	cleanupTestEnv as cleanupHttpTestEnv,
	TEST_SESSION_SECRET,
} from '../http/env.ts'

/**
 * Env vars the HASS discovery modules read directly that the HTTP suite's
 * `APP_ENV_VARS` list does NOT already cover. Snapshotted/cleared before the
 * HASS modules are imported and restored on cleanup. Exported so
 * `envIsolation.test.ts` can drive the exact same set it protects.
 */
export const HASS_ENV_VARS = [
	'UID_DISCOVERY_PREFIX',
	'DISCOVERY_DISABLE_CC_CONFIGURATION',
	'MQTT_NAME',
] as const

let hassEnvSnapshot: Record<string, string | undefined> | undefined

/**
 * Snapshot + clear the HASS-specific env vars (once), then delegate to the
 * HTTP harness's `ensureTestEnv()` for the shared `STORE_DIR` / `APP_ENV_VARS`
 * isolation. Safe to call multiple times. Returns the isolated store dir.
 *
 * Order matters: the HASS vars are cleared here FIRST, before any caller
 * dynamically imports `Gateway.ts` (whose module-level `UID_DISCOVERY_PREFIX`
 * const is captured at import), so the imported module sees the cleared
 * default, never an ambient value.
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
 * Restore the HTTP-suite env + `STORE_DIR`, then restore every
 * `HASS_ENV_VARS` entry to its exact pre-`ensureTestEnv()` value (or remove
 * it, if it was unset), so nothing leaks into whatever runs next.
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
