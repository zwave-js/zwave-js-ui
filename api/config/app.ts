import { joinPath } from '../lib/utils.ts'
import { config } from 'dotenv'
import ipaddr from 'ipaddr.js'
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
export const host: string = process.env.HOST // by default undefined, so it will listen on all interfaces both ipv4 and ipv6

export type ParsedCidr = [ipaddr.IPv4 | ipaddr.IPv6, number]

export type TrustedListenerConfig =
	| {
			kind: 'tcp'
			// Literal IP, or a network CIDR resolved to the local interface address at bind time
			host: string | ParsedCidr
			port: number
			allowedIps: ParsedCidr[]
	  }
	| { kind: 'unix'; path: string }

function parseCidrOrThrow(raw: string, context: string): ParsedCidr {
	try {
		return ipaddr.parseCIDR(raw)
	} catch {
		throw new Error(`${context}: invalid CIDR "${raw}"`)
	}
}

/**
 * Parse the trusted (host API) listener configuration from the environment.
 *
 * `TRUSTED_API_LISTEN` enables the listener:
 *  - `/path` — unix socket path
 *  - `host:port` — bind exactly this IP (IPv6 in brackets)
 *  - `cidr:port` — bind the local interface address inside this network,
 *    resolved at startup, so the host application can name a (docker)
 *    network without either side knowing the container's dynamic IP
 *
 * A bare port is rejected: the trusted listener is never bound to all
 * interfaces. TCP bindings additionally require `TRUSTED_API_ALLOWED_IPS`
 * (comma-separated IPs/CIDRs) because the listener bypasses authentication —
 * the TCP peer allowlist is the only gate. Throws on any misconfiguration
 * so the process fails to start instead of silently degrading.
 */
export function parseTrustedListenerConfig(env: {
	TRUSTED_API_LISTEN?: string
	TRUSTED_API_ALLOWED_IPS?: string
}): TrustedListenerConfig | undefined {
	const listen = env.TRUSTED_API_LISTEN?.trim()
	if (!listen) {
		return undefined
	}

	if (listen.startsWith('/')) {
		return { kind: 'unix', path: listen }
	}

	const match = listen.match(/^(?:\[([^\]]+)\]|([^:\][]+)):(\d+)$/)
	if (!match) {
		throw new Error(
			`TRUSTED_API_LISTEN must be a unix socket path, "host:port" or "cidr:port" (IPv6 in brackets), got "${listen}"`,
		)
	}

	const rawHost = match[1] ?? match[2]
	const listenPort = parseInt(match[3], 10)
	if (listenPort < 1 || listenPort > 65535) {
		throw new Error(`TRUSTED_API_LISTEN: invalid port "${match[3]}"`)
	}

	let listenHost: string | ParsedCidr
	if (rawHost.includes('/')) {
		listenHost = parseCidrOrThrow(rawHost, 'TRUSTED_API_LISTEN')
	} else if (ipaddr.isValid(rawHost)) {
		listenHost = rawHost
	} else {
		throw new Error(
			`TRUSTED_API_LISTEN: host must be a literal IP or CIDR, got "${rawHost}"`,
		)
	}

	const allowedRaw = env.TRUSTED_API_ALLOWED_IPS?.trim()
	if (!allowedRaw) {
		throw new Error(
			'TRUSTED_API_ALLOWED_IPS is required when TRUSTED_API_LISTEN binds TCP: the trusted listener bypasses authentication and must not accept commands from arbitrary peers',
		)
	}

	const allowedIps = allowedRaw.split(',').map((entry): ParsedCidr => {
		const trimmed = entry.trim()
		if (trimmed.includes('/')) {
			return parseCidrOrThrow(trimmed, 'TRUSTED_API_ALLOWED_IPS')
		}
		try {
			const addr = ipaddr.parse(trimmed)
			return [addr, addr.kind() === 'ipv4' ? 32 : 128]
		} catch {
			throw new Error(`TRUSTED_API_ALLOWED_IPS: invalid IP "${trimmed}"`)
		}
	})

	return { kind: 'tcp', host: listenHost, port: listenPort, allowedIps }
}

export const trustedListener: TrustedListenerConfig | undefined =
	parseTrustedListenerConfig({
		// Only access the two desired environment variables to avoid accidentally
		// leaking up the process environment to an error log downstream
		TRUSTED_API_LISTEN: process.env.TRUSTED_API_LISTEN,
		TRUSTED_API_ALLOWED_IPS: process.env.TRUSTED_API_ALLOWED_IPS,
	})
