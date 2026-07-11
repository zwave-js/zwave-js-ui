import { joinPath } from '../lib/utils.ts'
import { config } from 'dotenv'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

config({ path: './.env.app' })

// config/app.js
export const title: string = 'Z-Wave JS UI'
export const storeDir: string = process.env.STORE_DIR || joinPath(true, 'store')
export const logsDir: string =
	process.env.ZWAVEJS_LOGS_DIR || joinPath(storeDir, 'logs')
export const snippetsDir: string = joinPath(storeDir, 'snippets')

export const tmpDir: string = joinPath(storeDir, '.tmp')
export const backupsDir: string =
	process.env.BACKUPS_DIR || joinPath(storeDir, 'backups')
export const nvmBackupsDir: string = joinPath(backupsDir, 'nvm')
export const storeBackupsDir: string = joinPath(backupsDir, 'store')

export const configDbDir: string = joinPath(storeDir, '.config-db')

export const defaultUser: string = process.env.DEFAULT_USERNAME || 'admin'
export const defaultPsw: string = process.env.DEFAULT_PASSWORD || 'zwave'

// Legacy placeholder that must never be used to sign sessions/tokens.
const INSECURE_SESSION_SECRET = 'DEFAULT_SESSION_SECRET_CHANGE_ME'

/**
 * Resolve the secret used to sign session cookies and tokens.
 *
 * Order of preference:
 *  1. A strong `SESSION_SECRET` provided via the environment.
 *  2. A random secret previously generated and persisted to the store.
 *  3. A freshly generated random secret, persisted so sessions/tokens
 *     survive restarts.
 *
 * We never fall back to a shared, well-known constant. If no usable secret
 * can be provided or persisted we fail closed by throwing, so the process
 * does not start while accepting forgeable sessions/tokens.
 */
function resolveSessionSecret(): string {
	const fromEnv = process.env.SESSION_SECRET

	if (fromEnv && fromEnv !== INSECURE_SESSION_SECRET) {
		return fromEnv
	}

	const secretFile = joinPath(storeDir, '.session-secret')

	// Reuse a previously persisted secret if available.
	try {
		if (existsSync(secretFile)) {
			const persisted = readFileSync(secretFile, 'utf8').trim()
			if (persisted && persisted !== INSECURE_SESSION_SECRET) {
				return persisted
			}
		}
	} catch {
		// fall through to generation/persistence below
	}

	// First run (or unusable persisted value): generate a strong secret and
	// persist it so existing sessions/tokens remain valid across restarts.
	const generated = randomBytes(32).toString('hex')

	try {
		mkdirSync(dirname(secretFile), { recursive: true })
		writeFileSync(secretFile, generated, { mode: 0o600 })
	} catch (err) {
		throw new Error(
			`Unable to persist a generated session secret to ${secretFile}. ` +
				'Refusing to start with an insecure session secret. ' +
				'Provide a strong SESSION_SECRET environment variable or fix ' +
				`store directory permissions. Original error: ${
					(err as Error)?.message ?? err
				}`,
		)
	}

	return generated
}

// lgtm [js/hardcoded-credentials]
export const sessionSecret: string = resolveSessionSecret()
export const base: string = process.env.BASE_PATH || '/'
export const port: string | number = process.env.PORT || 8091
export const host: string | undefined = process.env.HOST // by default undefined, so it will listen on all interfaces both ipv4 and ipv6
