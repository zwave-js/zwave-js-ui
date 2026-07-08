import express from 'express'
import { execFile } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { Server as HttpServer } from 'node:http'
import { createServer, request } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { io as ioClient } from 'socket.io-client'
import { afterEach, describe, expect, it } from 'vitest'
import { parseCidr } from '../../api/lib/ipUtils.ts'
import SocketManager from '../../api/lib/SocketManager.ts'
import {
	isTrustedRequest,
	isTrustedSocket,
	startTrustedListener,
	type TrustedListenerConfig,
} from '../../api/lib/trustedListener.ts'

function probeApp() {
	const app = express()
	app.get('/probe', (req, res) => {
		res.json({ trusted: isTrustedRequest(req) })
	})
	return app
}

function tcpConfig(allowedCidr: string): TrustedListenerConfig {
	return {
		kind: 'tcp',
		host: '127.0.0.1',
		// Ephemeral port, resolved via server.address() after listen
		port: 0,
		allowedIps: [parseCidr(allowedCidr)],
	}
}

function serverPort(server: HttpServer): number {
	return (server.address() as AddressInfo).port
}

describe('startTrustedListener', () => {
	const servers: HttpServer[] = []
	const cleanups: (() => Promise<void>)[] = []

	afterEach(async () => {
		for (const server of servers.splice(0)) {
			await new Promise((resolve) => server.close(resolve))
		}
		for (const cleanup of cleanups.splice(0)) {
			await cleanup()
		}
	})

	it('returns undefined without configuration', async () => {
		expect(
			await startTrustedListener(probeApp(), undefined),
		).toBeUndefined()
	})

	it('marks allowlisted TCP connections as trusted', async () => {
		const server = await startTrustedListener(
			probeApp(),
			tcpConfig('127.0.0.0/8'),
		)
		servers.push(server)

		const res = await fetch(`http://127.0.0.1:${serverPort(server)}/probe`)
		expect(await res.json()).toEqual({ trusted: true })
	})

	it('destroys connections from non-allowlisted peers, ignoring X-Forwarded-For', async () => {
		const server = await startTrustedListener(
			probeApp(),
			tcpConfig('10.0.0.0/8'),
		)
		servers.push(server)

		await expect(
			fetch(`http://127.0.0.1:${serverPort(server)}/probe`, {
				// A spoofed forwarding header must not defeat the peer allowlist
				headers: { 'X-Forwarded-For': '10.0.0.1' },
			}),
		).rejects.toThrow()
	})

	it('serves and trusts requests over a unix socket, replacing a stale socket', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'zui-trusted-'))
		cleanups.push(() => rm(dir, { recursive: true, force: true }))
		const socketPath = join(dir, 'api.sock')

		// A stale socket from an unclean shutdown must not prevent the bind;
		// exiting without close() leaves the socket file behind
		await new Promise<void>((resolve, reject) => {
			execFile(
				process.execPath,
				[
					'-e',
					'require("net").createServer().listen(process.argv[1], () => process.exit(0))',
					socketPath,
				],
				(err) => (err ? reject(err as Error) : resolve()),
			)
		})
		expect(existsSync(socketPath)).toBe(true)

		const server = await startTrustedListener(probeApp(), {
			kind: 'unix',
			path: socketPath,
		})

		const body = await new Promise<string>((resolve, reject) => {
			request({ socketPath, path: '/probe' }, (res) => {
				let data = ''
				res.on('data', (chunk) => (data += chunk))
				res.on('end', () => resolve(data))
			})
				.on('error', reject)
				.end()
		})
		expect(JSON.parse(body)).toEqual({ trusted: true })

		// Not world-accessible regardless of the ambient umask
		expect(statSync(socketPath).mode & 0o777).toBe(0o660)

		await new Promise((resolve) => server.close(resolve))
		expect(existsSync(socketPath)).toBe(false)
	})

	it('refuses to replace a non-socket file at the unix socket path', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'zui-trusted-'))
		cleanups.push(() => rm(dir, { recursive: true, force: true }))
		const socketPath = join(dir, 'api.sock')

		await writeFile(socketPath, 'important data')

		await expect(
			startTrustedListener(probeApp(), {
				kind: 'unix',
				path: socketPath,
			}),
		).rejects.toThrow(/not a socket/)
		expect(existsSync(socketPath)).toBe(true)
	})

	it('bypasses socket.io auth only on the trusted listener', async () => {
		const app = probeApp()

		const mainServer = createServer(app)
		servers.push(mainServer)
		await new Promise<void>((resolve) =>
			mainServer.listen(0, '127.0.0.1', resolve),
		)

		const trustedServer = await startTrustedListener(
			app,
			tcpConfig('127.0.0.0/8'),
		)
		servers.push(trustedServer)

		const socketManager = new SocketManager()
		socketManager.authMiddleware = (
			socket,
			next: (err?: Error) => void,
		) => {
			if (isTrustedSocket(socket.request?.socket)) {
				next()
			} else {
				next(new Error('Authentication error'))
			}
		}
		socketManager.bindServer(mainServer)
		socketManager.attachServer(trustedServer)
		cleanups.push(
			() =>
				new Promise<void>((resolve) =>
					socketManager.io.close(() => resolve()),
				),
		)

		const connect = (port: number, transport: string) =>
			new Promise<string>((resolve) => {
				const client = ioClient(`http://127.0.0.1:${port}`, {
					transports: [transport],
					reconnection: false,
				})
				client.on('connect', () => {
					client.close()
					resolve('connected')
				})
				client.on('connect_error', (err) => {
					client.close()
					resolve(err.message)
				})
			})

		expect(await connect(serverPort(trustedServer), 'polling')).toBe(
			'connected',
		)
		expect(await connect(serverPort(trustedServer), 'websocket')).toBe(
			'connected',
		)
		// Both engine.io transports have distinct handshake paths
		expect(await connect(serverPort(mainServer), 'polling')).toBe(
			'Authentication error',
		)
		expect(await connect(serverPort(mainServer), 'websocket')).toBe(
			'Authentication error',
		)
	})
})
