import type { Express } from 'express'
import { createServer, type Server as HttpServer } from 'node:http'
import type { Socket as NetSocket } from 'node:net'
import { networkInterfaces } from 'node:os'
import { chmod, lstat, unlink } from 'node:fs/promises'
import {
	formatCidr,
	matchesCidr,
	parseCidr,
	parseIp,
	unwrapMappedIp,
	type ParsedCidr,
} from './ipUtils.ts'
import { module } from './logger.ts'

const logger = module('TrustedListener')

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
	const cidr = parseCidr(raw)
	if (!cidr) {
		throw new Error(`${context}: invalid CIDR "${raw}"`)
	}
	return cidr
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
	} else if (parseIp(rawHost)) {
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
		const addr = parseIp(trimmed)
		if (!addr) {
			throw new Error(`TRUSTED_API_ALLOWED_IPS: invalid IP "${trimmed}"`)
		}
		return { addr, prefix: addr.bytes.length * 8 }
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

// Sockets accepted by the trusted listener; keyed by the raw net.Socket so
// both plain requests and websocket upgrades (which reuse it) are covered
const trustedSockets = new WeakSet<NetSocket>()

// A single page load opens several TCP connections per remote address, so
// log at most one rejection per address per window instead of one per socket
const REJECTION_LOG_WINDOW_MS = 60_000
// Cap the map so a scan from many source addresses cannot grow it unbounded
const REJECTION_LOG_MAX_TRACKED = 100
const lastRejectionLogAt = new Map<string, number>()

function logRejection(remote: string) {
	const now = Date.now()
	const last = lastRejectionLogAt.get(remote)
	if (last !== undefined && now - last < REJECTION_LOG_WINDOW_MS) {
		return
	}
	// Re-insert so the map stays ordered by recency; evict the oldest when full
	lastRejectionLogAt.delete(remote)
	lastRejectionLogAt.set(remote, now)
	if (lastRejectionLogAt.size > REJECTION_LOG_MAX_TRACKED) {
		lastRejectionLogAt.delete(lastRejectionLogAt.keys().next().value)
	}
	logger.warn(`Trusted listener: rejected connection from ${remote}`)
}

export function isTrustedSocket(socket: unknown): boolean {
	return (
		!!socket &&
		typeof socket === 'object' &&
		trustedSockets.has(socket as NetSocket)
	)
}

// Skip req.ip / X-Forwarded-* because the host may itself be a proxy that
// forwards untrusted client addresses in those headers
export function isTrustedRequest(req: { socket?: unknown }): boolean {
	return isTrustedSocket(req?.socket)
}

export function isAllowedAddress(
	remote: string,
	allowed: ParsedCidr[],
): boolean {
	const parsed = parseIp(remote)
	if (!parsed) {
		return false
	}
	const addr = unwrapMappedIp(parsed)
	return allowed.some((cidr) => matchesCidr(addr, cidr))
}

/**
 * Resolve the local interface address inside `cidr`, so a host application
 * can name a (docker) network without knowing the container's dynamic IP
 */
export function resolveListenAddress(
	cidr: ParsedCidr,
	interfaces = networkInterfaces(),
): string {
	const candidates: string[] = []
	for (const addrs of Object.values(interfaces)) {
		for (const { address } of addrs ?? []) {
			if (isAllowedAddress(address, [cidr])) {
				candidates.push(address)
			}
		}
	}

	const unique = [...new Set(candidates)]
	const network = formatCidr(cidr)
	if (unique.length === 0) {
		const available = Object.values(interfaces)
			.flatMap((addrs) => addrs ?? [])
			.map((a) => a.address)
			.join(', ')
		throw new Error(
			`Trusted listener: no local address inside ${network}. Available addresses: ${available}`,
		)
	}
	if (unique.length > 1) {
		throw new Error(
			`Trusted listener: multiple local addresses inside ${network}: ${unique.join(
				', ',
			)}. Use a literal IP instead`,
		)
	}

	return unique[0]
}

function describeBinding(config: TrustedListenerConfig, host?: string): string {
	return config.kind === 'unix'
		? `unix socket ${config.path}`
		: `${host}:${config.port} (allowed peers: ${config.allowedIps
				.map(formatCidr)
				.join(', ')})`
}

function listenOrThrow(
	server: HttpServer,
	listen: (onListening: () => void) => void,
): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		// Reject on bind errors (EADDRINUSE, EACCES, ...) so the startup
		// failure surfaces through startServer instead of a hard exit
		const onError = (error: NodeJS.ErrnoException) =>
			reject(
				new Error(
					`Trusted listener: failed to bind (${error.code ?? error.message})`,
					{ cause: error },
				),
			)
		server.once('error', onError)
		listen(() => {
			server.removeListener('error', onError)
			resolve()
		})
	})
}

/**
 * Start the optional trusted (host API) listener: a plain-HTTP server for
 * the same express app, on which authentication is bypassed. Transport
 * security is the host application's responsibility.
 */
export async function startTrustedListener(
	app: Express,
	config: TrustedListenerConfig | undefined = trustedListener,
): Promise<HttpServer | undefined> {
	if (!config) {
		return undefined
	}

	const server = createServer(app)

	server.on('connection', (socket) => {
		if (config.kind === 'tcp') {
			const remote = socket.remoteAddress
			if (!remote || !isAllowedAddress(remote, config.allowedIps)) {
				logRejection(remote ?? 'unknown')
				socket.destroy()
				return
			}
		}
		trustedSockets.add(socket)
	})

	let host: string | undefined
	if (config.kind === 'unix') {
		// Remove stale socket left by an unclean shutdown so the bind succeeds
		const existing = await lstat(config.path).catch((error) => {
			if (error.code !== 'ENOENT') throw error
			return undefined
		})
		if (existing) {
			// Refuse to delete a non-socket so a misconfigured path can't destroy a file
			if (!existing.isSocket()) {
				throw new Error(
					`Trusted listener: ${config.path} exists and is not a socket, refusing to replace it`,
				)
			}
			await unlink(config.path)
			logger.warn(
				`Trusted listener: removed stale socket file ${config.path}`,
			)
		}
		await listenOrThrow(server, (cb) => server.listen(config.path, cb))
		// Restrict to owner+group because the ambient umask may leave it world-writable
		await chmod(config.path, 0o660)
	} else {
		host =
			typeof config.host === 'string'
				? config.host
				: resolveListenAddress(config.host)
		await listenOrThrow(server, (cb) =>
			server.listen(config.port, host, cb),
		)
	}

	const binding = describeBinding(config, host)

	// Log-only after a successful bind so a runtime error doesn't kill the gateway
	server.on('error', (error: NodeJS.ErrnoException) => {
		logger.error(
			`Trusted listener error on ${binding}: ${error.code ?? ''} ${
				error.syscall ?? ''
			} ${error.message}`.replace(/\s+/g, ' '),
		)
	})

	logger.warn(`Trusted (unauthenticated) API listening on ${binding}`)

	return server
}
