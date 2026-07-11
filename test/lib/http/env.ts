import { vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

vi.mock('dotenv', () => ({
	config: () => ({ parsed: {} }),
}))

let storeDir: string | undefined

const APP_ENV_VARS = [
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

export const TEST_SESSION_SECRET =
	'http-contract-test-secret-do-not-use-in-production'

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
		// Keep TZ and LOCALE absent because the response distinguishes them from empty strings
	}
	return storeDir
}

export function getTestStoreDir(): string {
	return ensureTestEnv()
}

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
