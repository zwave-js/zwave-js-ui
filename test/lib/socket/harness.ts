// Shares the module loaders and beforeAll/afterEach/afterAll lifecycle from shared/harness.ts, then
// layers Socket.IO-specific setup (server, io, client helpers) on top.
import { createServer, type Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Express, Router } from 'express'
import type { Server as SocketIOServer } from 'socket.io'
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'
import type { FakeGateway, FakeZniffer } from './fakes.ts'
import SocketManager from '#api/lib/SocketManager.ts'
import type * as ZnifferModuleNamespace from '#api/lib/ZnifferManager.ts'
import type * as LoggerModuleNamespace from '#api/lib/logger.ts'
import {
	useHarnessLifecycle,
	type GatewayModule,
	type SharedTestContext,
} from '../shared/harness.ts'

type ZnifferModule = typeof ZnifferModuleNamespace
type RealGateway = InstanceType<GatewayModule['default']>
type RealZniffer = InstanceType<ZnifferModule['default']>

let loggerModulePromise: Promise<typeof LoggerModuleNamespace> | undefined

// Loaded lazily (api/app.ts already pulled it in by the time this can run) so files that never use the `interceptor` option don't force it
async function loadLoggerModule(): Promise<typeof LoggerModuleNamespace> {
	loggerModulePromise ??= import('#api/lib/logger.ts')
	return loggerModulePromise
}

export interface SocketHarnessOptions {
	gateway?: FakeGateway
	zniffer?: FakeZniffer
	pluginsRouter?: Router
	restarting?: boolean
	// Mirrors startServer()'s log interceptor wiring so debug-room tests see real socketEvents.debug emissions; opt-in since logStream is a shared per-process singleton most tests don't touch
	interceptor?: boolean
}

export interface SocketHarness {
	app: Express
	io: SocketIOServer
	jsonStore: SharedTestContext['jsonStore']
	store: SharedTestContext['store']
	server: HttpServer
	// Base URL is http://127.0.0.1:<ephemeral port>
	url: string
	// autoConnect defaults false so tests can attach connect_error listeners before connecting; every client is tracked and force-disconnected on teardown
	createClient(opts?: Record<string, unknown>): ClientSocket
	// Connects client and resolves on connect, or rejects on connect_error
	connectClient(client: ClientSocket): Promise<ClientSocket>
	// Polls the real server-side connected-socket count until it matches count
	waitForServerSocketCount(count: number, timeoutMs?: number): Promise<void>
	disconnectAllClients(): Promise<void>
}

async function createHarnessInstance(
	shared: SharedTestContext,
	options: SocketHarnessOptions,
): Promise<SocketHarness & { closeInstance(): Promise<void> }> {
	// No request listener yet - createApp() attaches socket.io, then we attach the Express app right below
	const server = createServer()
	const socketManager = new SocketManager()

	const instance = shared.createApp({
		test: {
			// Gateway/ZnifferManager have private fields, so structural mocks like FakeGateway/FakeZniffer need this cast to satisfy them
			gateway: options.gateway as unknown as RealGateway | undefined,
			zniffer: options.zniffer as unknown as RealZniffer | undefined,
			pluginsRouter: options.pluginsRouter,
			restarting: options.restarting,
			socketManager,
			server,
			interceptor: options.interceptor,
		},
	})
	await instance.loadSnippets()

	server.on('request', instance.app)
	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', () => resolve())
	})
	const port = (server.address() as AddressInfo).port
	const url = `http://127.0.0.1:${port}`

	// createApp() already bound this via bindServer() before returning, since test.server was set above
	const { io } = socketManager
	const clients = new Set<ClientSocket>()

	function createClient(opts: Record<string, unknown> = {}): ClientSocket {
		const client = ioClient(url, {
			path: '/socket.io',
			autoConnect: false,
			reconnection: false,
			transports: ['websocket'],
			...opts,
		})
		clients.add(client)
		return client
	}

	function connectClient(client: ClientSocket): Promise<ClientSocket> {
		return new Promise((resolve, reject) => {
			client.once('connect', () => resolve(client))
			client.once('connect_error', (err: Error) => reject(err))
			client.connect()
		})
	}

	async function waitForServerSocketCount(
		count: number,
		timeoutMs = 2000,
	): Promise<void> {
		const start = Date.now()
		while (io.sockets.sockets.size !== count) {
			if (Date.now() - start > timeoutMs) {
				throw new Error(
					`Timed out waiting for server socket count to reach ${count} ` +
						`(currently ${io.sockets.sockets.size})`,
				)
			}
			await new Promise((resolve) => setTimeout(resolve, 10))
		}
	}

	async function disconnectAllClients(): Promise<void> {
		for (const client of clients) {
			client.removeAllListeners()
			if (client.connected || client.active) {
				client.disconnect()
			}
		}
		clients.clear()

		// Best-effort: lets the server finish settling activeSockets/room membership before returning, but a test that already awaited its own disconnect may have nothing left to wait for
		try {
			await waitForServerSocketCount(0, 1000)
		} catch {
			// ignore - see above
		}
	}

	return {
		app: instance.app,
		io,
		jsonStore: shared.jsonStore,
		store: shared.store,
		server,
		url,
		createClient,
		connectClient,
		waitForServerSocketCount,
		disconnectAllClients,
		async closeInstance() {
			await disconnectAllClients()

			// io.close() also closes the underlying http.Server, so calling server.close() afterwards would throw ERR_SERVER_NOT_RUNNING
			await io.close()

			// Removes this instance's interceptor listener (if any) from the shared logStream singleton before the next instance is created; a no-op when `interceptor` was never requested
			const { logStream } = await loadLoggerModule()
			logStream.removeAllListeners('data')
		},
	}
}

// Gives each test a fresh createApp() instance + server, so tests never leak state and need no reset hooks
export function useSocketHarness(): (
	options?: SocketHarnessOptions,
) => Promise<SocketHarness> {
	return useHarnessLifecycle(createHarnessInstance)
}
