/**
 * Closeable, ephemeral HTTP + Socket.IO test harness for `api/app.ts`'s
 * real-time transport.
 *
 * Builds directly on the HTTP contract suite's harness primitives
 * (`test/lib/http/harness.ts`) instead of re-implementing them: the same
 * `loadAppModule()`/`loadJsonStore()` loaders (so both suites share one
 * cached, isolated import of `api/app.ts` per test file - see
 * `./env.ts`), then layers Socket.IO-specific setup on top:
 *
 *  1. Wraps the plain Express `app` export in a real `http.Server` bound to
 *     an ephemeral port (`listen(0)`), exactly like the HTTP harness.
 *  2. Drives the app's `__testHooks.setupSocket()` test seam to bind the
 *     real `socketManager` (real Socket.IO server, real auth middleware,
 *     the real 7 inbound event handlers) to that server - the same
 *     production `setupSocket()` function `startServer()` calls, just
 *     invoked without also starting a real `ZWaveClient`/`MqttClient`/
 *     `Gateway`.
 *  3. Drives `__testHooks.setupInterceptor()` to wire the real log ->
 *     `debug` room interceptor.
 *  4. Exposes `createClient()`, backed by the real `socket.io-client`
 *     package (not a fake/mock transport), so tests exercise the exact
 *     same wire protocol/handshake/room-routing a real browser client
 *     would.
 *  5. Exposes `close()` to deterministically disconnect every client this
 *     harness created, tear down the interceptor listener, close the real
 *     Socket.IO server + HTTP server, reset every `__testHooks` seam, and
 *     restore ambient env vars - so nothing (sockets, rooms, listeners,
 *     timers, watchers, servers) leaks into whatever runs next in this
 *     worker process.
 */
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

/**
 * Lazily (and only once per test file) imports `api/lib/Gateway.ts` to
 * reach its module-level `closeWatchers()` - the same real `fs.watch()`
 * cleanup the HTTP harness relies on (see its doc comment). `api/app.ts`
 * imports this module transitively regardless of which suite runs, so a
 * Socket.IO-only test file still needs to release those watchers itself.
 */
async function loadGatewayModule() {
	if (!gatewayModulePromise) {
		gatewayModulePromise = import('../../../api/lib/Gateway.ts')
	}
	return gatewayModulePromise
}

export interface SocketHarness {
	app: Express
	testHooks: SocketAppTestHooks
	/** The real, bound `socket.io` server instance. */
	io: SocketIOServer
	jsonStore: JsonStoreModule['jsonStore']
	store: JsonStoreModule['store']
	server: HttpServer
	/** Base URL (`http://127.0.0.1:<ephemeral port>`) the server listens on. */
	url: string
	/**
	 * Creates a real `socket.io-client` `Socket` pointed at this harness's
	 * server (same `/socket.io` path production uses). `autoConnect` is
	 * `false` by default so tests can attach listeners (e.g.
	 * `connect_error`) before choosing to `.connect()` - pass
	 * `{ autoConnect: true }` to connect immediately. Every client created
	 * this way is tracked and force-disconnected by `close()`, so a test
	 * that forgets to disconnect its own clients still can't leak a socket
	 * past its file's suite.
	 */
	createClient(opts?: Record<string, unknown>): ClientSocket
	/** Connects `client` and resolves on `connect`, or rejects on `connect_error`. */
	connectClient(client: ClientSocket): Promise<ClientSocket>
	/** Polls the real server-side connected-socket count until it matches `count`. */
	waitForServerSocketCount(count: number, timeoutMs?: number): Promise<void>
	/**
	 * Disconnects every client this harness has created so far (and waits
	 * for the server to finish processing each disconnect), without
	 * closing the server itself. Intended for per-test cleanup
	 * (`afterEach`) in files that share ONE harness across many `it()`
	 * blocks via `beforeAll`/`afterAll` - see `close()`'s doc comment for
	 * why a harness must not be recreated per-test.
	 */
	disconnectAllClients(): Promise<void>
	/** Resets every `__testHooks` seam (gw/zniffer/etc.) to its harness default. */
	resetState(): void
	/**
	 * Fully tears the harness down: disconnects every client, removes the
	 * log interceptor, resets every seam, closes the real Socket.IO/HTTP
	 * server, releases `Gateway.ts`'s file watchers, clears the in-memory
	 * `jsonStore`, and restores ambient env vars.
	 *
	 * Call this AT MOST ONCE per test file (in `afterAll`), never per-test:
	 * `api/config/app.ts`'s `storeDir` (and everything derived from it,
	 * transitively including `jsonStore`) is computed once, the first time
	 * `api/app.ts` is imported, and stays fixed for this file's whole
	 * module graph - `close()` deletes that directory from disk, so a
	 * second `createSocketHarness()` call in the same file would silently
	 * keep operating against an already-deleted path. Share one harness
	 * per file (`beforeAll`/`afterAll`) and use `resetState()` +
	 * `disconnectAllClients()` for per-test cleanup instead. See
	 * `test/lib/http/harnessLifecycle.test.ts` for the HTTP suite's
	 * identical constraint/regression.
	 */
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
		// Socket tests never exercise `GET /api/serial-ports`; restoring the
		// production default here just guarantees this harness never leaves
		// a stray fake installed for some *other* test file/suite sharing
		// the module cache (defence in depth, mirrors the HTTP harness).
		__testHooks.setEnumerateSerialPorts(undefined)
	}
	resetState()

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

		// Best-effort: give the server a moment to process every client's
		// disconnect (so `SocketManager`'s internal `activeSockets` map -
		// and any `'clients'`/room-membership assertions a test just made
		// - are fully settled) before returning. Never throws: a test that
		// already asserted/awaited disconnection itself may have nothing
		// left to wait for.
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

			// `io.close()` also closes the underlying `http.Server` (see
			// https://socket.io/docs/v4/server-api/#serverclosecallback) -
			// calling `server.close()` afterwards would throw
			// `ERR_SERVER_NOT_RUNNING`, so this is the only close call
			// needed for both. `close()` itself returns a `Promise<void>`
			// that resolves once torn down.
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
