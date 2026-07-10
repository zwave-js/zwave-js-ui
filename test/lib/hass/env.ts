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
 * Rather than duplicating the isolation logic, this module re-exports it, so
 * every suite shares one implementation and one behavioral contract.
 * Vitest's per-test-file module isolation means each HASS test file still
 * gets its own independent `storeDir`/`envSnapshot`.
 */
export {
	ensureTestEnv,
	getTestStoreDir,
	cleanupTestEnv,
	TEST_SESSION_SECRET,
} from '../http/env.ts'
