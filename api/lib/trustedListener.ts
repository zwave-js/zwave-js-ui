import type { Express } from 'express'
import ipaddr from 'ipaddr.js'
import { createServer, type Server as HttpServer } from 'node:http'
import type { Socket as NetSocket } from 'node:net'
import { networkInterfaces } from 'node:os'
import { unlink } from 'node:fs/promises'
import type { ParsedCidr, TrustedListenerConfig } from '../config/app.ts'
import { trustedListener } from '../config/app.ts'
import { module } from './logger.ts'

const logger = module('TrustedListener')

// Sockets accepted by the trusted listener; keyed by the raw net.Socket so
// both plain requests and websocket upgrades (which reuse it) are covered
const trustedSockets = new WeakSet<NetSocket>()

// A single page load opens several TCP connections per remote address, so
// log at most one rejection per address per window instead of one per socket
const REJECTION_LOG_WINDOW_MS = 60_000
const lastRejectionLogAt = new Map<string, number>()

function logRejection(remote: string) {
	const now = Date.now()
	const last = lastRejectionLogAt.get(remote)
	if (last !== undefined && now - last < REJECTION_LOG_WINDOW_MS) {
		return
	}
	lastRejectionLogAt.set(remote, now)
	logger.warn(`Trusted listener: rejected connection from ${remote}`)
}

export function isTrustedSocket(socket: unknown): boolean {
	return (
		!!socket &&
		typeof socket === 'object' &&
		trustedSockets.has(socket as NetSocket)
	)
}

// The trust decision never involves req.ip or X-Forwarded-* headers: the
// host application may itself be a proxy (e.g. HA Supervisor ingress) that
// forwards untrusted client addresses in headers
export function isTrustedRequest(req: { socket?: unknown }): boolean {
	return isTrustedSocket(req?.socket)
}

export function isAllowedAddress(
	remote: string,
	allowed: ParsedCidr[],
): boolean {
	let addr: ipaddr.IPv4 | ipaddr.IPv6
	try {
		// process() unwraps IPv4-mapped IPv6 (::ffff:a.b.c.d)
		addr = ipaddr.process(remote)
	} catch {
		return false
	}
	return allowed.some(
		([net, prefix]) =>
			addr.kind() === net.kind() &&
			(addr as ipaddr.IPv4).match(net as ipaddr.IPv4, prefix),
	)
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
	const network = `${cidr[0].toString()}/${cidr[1]}`
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
				.map(([net, prefix]) => `${net.toString()}/${prefix}`)
				.join(', ')})`
}

/**
 * Start the optional trusted (host API) listener: a plain-HTTP server for
 * the same express app, on which authentication is bypassed. Transport
 * security is the host application's responsibility (a private docker
 * network or a unix socket); for TCP the peer allowlist is the only gate,
 * enforced on the kernel-reported TCP peer address before any HTTP parsing
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

	server.on('error', (error: NodeJS.ErrnoException) => {
		logger.error(`Trusted listener error: ${error.message}`)
		process.exit(1)
	})

	let host: string | undefined
	if (config.kind === 'unix') {
		// Node only unlinks the socket file on server.close(), so a previous
		// unclean shutdown leaves a stale file that would fail the bind
		await unlink(config.path).catch((error) => {
			if (error.code !== 'ENOENT') throw error
		})
		await new Promise<void>((resolve) =>
			server.listen(config.path, resolve),
		)
	} else {
		host =
			typeof config.host === 'string'
				? config.host
				: resolveListenAddress(config.host)
		await new Promise<void>((resolve) =>
			server.listen(config.port, host, resolve),
		)
	}

	logger.info(
		`Trusted (unauthenticated) API listening on ${describeBinding(config, host)}`,
	)

	return server
}
