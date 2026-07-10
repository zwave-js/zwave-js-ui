/**
 * Closeable, ephemeral HTTP test harness for `api/app.ts`.
 *
 * This intentionally does NOT call the exported `startServer()` - that
 * function constructs a real `Gateway`/`ZWaveClient`/`MqttClient` (real
 * hardware/network collaborators) and binds Socket.IO. Instead it:
 *
 *  1. Points the app's storage at a private throwaway directory (see
 *     `./env.ts`), so route handlers that touch `jsonStore`/session files
 *     never read or write real application data.
 *  2. Dynamically imports `api/app.ts` (after the env is set) and drives its
 *     `__testHooks` test-only seam to inject fake `gw`/`zniffer` collaborators.
 *  3. Wraps the plain Express `app` export in a real `http.Server` bound to
 *     an ephemeral port (`listen(0)`), so requests exercise the exact same
 *     middleware stack/route handlers as production, over a real socket.
 *  4. Exposes `close()` to shut the server down and reset the seam state,
 *     so nothing leaks between test files (each Vitest test file gets its
 *     own isolated module graph, but hygiene here also protects against
 *     future pool/isolation changes).
 */
import { createServer, type Server as HttpServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import type { Express } from 'express'
import supertest from 'supertest'
import { ensureTestEnv, getTestStoreDir } from './env.ts'
import type { FakeGateway } from './fakes.ts'

export interface AppTestHooks {
	setGateway(value: FakeGateway | undefined): void
	setZniffer(value: unknown): void
	setPluginsRouter(value: unknown): void
	setRestarting(value: boolean): void
	isRestarting(): boolean
}

interface AppModule {
	default: Express
	__testHooks: AppTestHooks
}

interface JsonStoreModule {
	jsonStore: {
		init: (config: unknown) => Promise<unknown>
		get: (model: { file: string }) => unknown
		put: (model: { file: string }, data: unknown) => Promise<unknown>
	}
	store: Record<string, { file: string; default: unknown }>
}

let appModulePromise: Promise<AppModule> | undefined
let jsonStoreModulePromise: Promise<JsonStoreModule> | undefined

/**
 * Loads (once per test file) the real `api/app.ts` module, after ensuring
 * its storage/session env vars point at an isolated throwaway directory.
 */
export async function loadAppModule(): Promise<AppModule> {
	ensureTestEnv()
	if (!appModulePromise) {
		appModulePromise = import(
			'../../../api/app.ts'
		) as unknown as Promise<AppModule>
	}
	return appModulePromise
}

/** Loads the same `jsonStore` singleton instance `api/app.ts` uses. */
export async function loadJsonStore(): Promise<JsonStoreModule> {
	ensureTestEnv()
	if (!jsonStoreModulePromise) {
		jsonStoreModulePromise = (async () => {
			const [jsonStoreMod, storeMod] = await Promise.all([
				import('../../../api/lib/jsonStore.ts'),
				import('../../../api/config/store.ts'),
			])
			return {
				jsonStore: jsonStoreMod.default as JsonStoreModule['jsonStore'],
				store: storeMod.default as JsonStoreModule['store'],
			}
		})()
	}
	return jsonStoreModulePromise
}

export interface HttpHarness {
	app: Express
	/** One-shot supertest requests against the live ephemeral server. */
	request: ReturnType<typeof supertest>
	/** Cookie-persisting agent, for session-based auth flows. */
	agent: ReturnType<typeof supertest.agent>
	testHooks: AppTestHooks
	jsonStore: JsonStoreModule['jsonStore']
	store: JsonStoreModule['store']
	server: HttpServer
	/** Resets the seam state (gw/zniffer/pluginsRouter/restarting). */
	resetState(): void
	close(): Promise<void>
}

export async function createHttpHarness(): Promise<HttpHarness> {
	const [{ default: app, __testHooks }, { jsonStore, store }] =
		await Promise.all([loadAppModule(), loadJsonStore()])

	await jsonStore.init(store)

	// Production only creates `storeDir/snippets` inside `loadSnippets()`,
	// which is only called from the real `startServer()` this harness
	// deliberately bypasses (see the file-level comment). Creating it here
	// is pure test-infra plumbing (a directory, no I/O side effects beyond
	// the isolated STORE_DIR) so `GET /api/snippet` behaves the same as it
	// would after a real startup instead of failing on a missing directory.
	mkdirSync(`${getTestStoreDir()}/snippets`, { recursive: true })

	const server = createServer(app)
	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', () => resolve())
	})

	function resetState() {
		__testHooks.setGateway(undefined)
		__testHooks.setZniffer(undefined)
		__testHooks.setPluginsRouter(undefined)
		__testHooks.setRestarting(false)
	}

	return {
		app,
		request: supertest(server),
		agent: supertest.agent(server),
		testHooks: __testHooks,
		jsonStore,
		store,
		server,
		resetState,
		async close() {
			resetState()
			await new Promise<void>((resolve, reject) => {
				server.close((err) => (err ? reject(err) : resolve()))
			})
		},
	}
}
