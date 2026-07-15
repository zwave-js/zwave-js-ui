import { vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

export const TEST_SESSION_SECRET =
	'http-contract-test-secret-do-not-use-in-production'

let storeDir: string | undefined

// Mocking the whole config module replaces its dotenv.config('./.env.app') call, so isolation
// doesn't depend on mirroring every process.env.* name the app reads
vi.mock('#api/config/app.ts', () => ({
	title: 'Z-Wave JS UI',
	get storeDir() {
		return getTestStoreDir()
	},
	get logsDir() {
		return path.join(getTestStoreDir(), 'logs')
	},
	get snippetsDir() {
		return path.join(getTestStoreDir(), 'snippets')
	},
	get tmpDir() {
		return path.join(getTestStoreDir(), '.tmp')
	},
	get backupsDir() {
		return path.join(getTestStoreDir(), 'backups')
	},
	get nvmBackupsDir() {
		return path.join(getTestStoreDir(), 'backups', 'nvm')
	},
	get storeBackupsDir() {
		return path.join(getTestStoreDir(), 'backups', 'store')
	},
	get configDbDir() {
		return path.join(getTestStoreDir(), '.config-db')
	},
	defaultUser: 'admin',
	defaultPsw: 'zwave',
	sessionSecret: TEST_SESSION_SECRET,
	base: '/',
	port: 0,
	host: undefined,
}))

export function ensureTestEnv(): string {
	storeDir ??= mkdtempSync(path.join(tmpdir(), 'zwave-js-ui-http-contract-'))
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
}
