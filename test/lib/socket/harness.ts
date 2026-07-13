// Shares the HTTP suite's loadAppModule/loadJsonStore loaders so both suites reuse one isolated import per test file, then layers Socket.IO setup on top
import { createServer, type Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Express } from 'express'
import type { Server as SocketIOServer } from 'socket.io'
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'
import { cleanupTestEnv } from './env.ts'
import { loadAppModule, loadJsonStore } from '../http/harness.ts'
import type { FakeGateway, FakeZniffer } from './fakes.ts'

export interface SocketAppTestHooks {
	setGateway(value: FakeGateway | undefined): void
	setZniffer(value: FakeZniffer | undefined): void
	setPluginsRouter(value: unknown): void
	setRestarting(value: boolean): void
	setEnumerateSerialPorts(value: unknown): void
	setupSocket(server: HttpServer): void
	setupInterceptor(): void
	teardownInterceptor(): void
	getSocketManager(): { io: SocketIOServer; authMiddleware: unknown }
	loadSnippets(): Promise<void>
}

interface SocketAppModule {
	default: Express
	__testHooks: SocketAppTestHooks
}

interface JsonStoreModule {
	jsonStore: {
		init: (config: unknown) => Promise<unknown>
		get: (model: { file: string }) => unknown
		put: (model: { file: string }, data: unknown) => Promise<unknown>
		store: Record<string, unknown>
	}
	store: Record<string, { file: string; default: unknown }>
}

let gatewayModulePromise: Promise<{ closeWatchers: () => void }> | undefined

// Releases the Gateway.ts fs.watch() watchers since api/app.ts always pulls this module in transitively
async function loadGatewayModule() {
	if (!gatewayModulePromise) {
		gatewayModulePromise = import('../../../api/lib/Gateway.ts')
	}
	return gatewayModulePromise
}

export interface SocketHarness {
	app: Express
	testHooks: SocketAppTestHooks
	io: SocketIOServer
	jsonStore: JsonStoreModule['jsonStore']
	store: JsonStoreModule['store']
	server: HttpServer
	// Base URL is http://127.0.0.1:<ephemeral port>
	url: string
	// autoConnect defaults false so tests can attach connect_error listeners before connecting; every client is tracked and force-disconnected by close()
	createClient(opts?: Record<string, unknown>): ClientSocket
	// Connects client and resolves on connect, or rejects on connect_error
	connectClient(client: ClientSocket): Promise<ClientSocket>
	// Polls the real server-side connected-socket count until it matches count
	waitForServerSocketCount(count: number, timeoutMs?: number): Promise<void>
	// Per-test cleanup for files that share one harness across it() blocks via beforeAll/afterAll instead of recreating it per test
	disconnectAllClients(): Promise<void>
	// Resets every __testHooks seam (gw/zniffer/etc.) to its harness default
	resetState(): void
	// Call this at most once per file in afterAll because storeDir is computed once per module graph and close() deletes it from disk
	close(): Promise<void>
}

export async function createSocketHarness(): Promise<SocketHarness> {
	const [{ default: app, __testHooks }, { jsonStore, store }] =
		await Promise.all([
			loadAppModule().then((mod) => mod as unknown as SocketAppModule),
			loadJsonStore().then((mod) => mod as unknown as JsonStoreModule),
		])

	await jsonStore.init(store)

	const server = createServer(app)
	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', () => resolve())
	})
	const port = (server.address() as AddressInfo).port
	const url = `http://127.0.0.1:${port}`

	function resetState() {
		__testHooks.setGateway(undefined)
		__testHooks.setZniffer(undefined)
		__testHooks.setPluginsRouter(undefined)
		__testHooks.setRestarting(false)
		// Guards against a stray fake leaking in from another test file sharing the module cache, since socket tests never hit GET /api/serial-ports
		__testHooks.setEnumerateSerialPorts(undefined)
	}
	resetState()

	// Bind the server before reading socketManager.io because SocketManager initializes io during bindServer()
	__testHooks.setupSocket(server)
	__testHooks.setupInterceptor()

	const { io } = __testHooks.getSocketManager()

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
		app,
		testHooks: __testHooks,
		io,
		jsonStore,
		store,
		server,
		url,
		createClient,
		connectClient,
		waitForServerSocketCount,
		disconnectAllClients,
		resetState,
		async close() {
			await disconnectAllClients()

			__testHooks.teardownInterceptor()
			resetState()

			// io.close() also closes the underlying http.Server, so calling server.close() afterwards would throw ERR_SERVER_NOT_RUNNING
			await io.close()

			const { closeWatchers } = await loadGatewayModule()
			closeWatchers()

			for (const key of Object.keys(jsonStore.store)) {
				delete jsonStore.store[key]
			}

			cleanupTestEnv()
		},
	}
}
