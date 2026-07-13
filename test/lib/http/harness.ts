import { createServer, type Server as HttpServer } from 'node:http'
import type { Express } from 'express'
import supertest, { type Test as SupertestTest } from 'supertest'
import { vi, beforeAll, afterEach, afterAll } from 'vitest'
import { cleanupTestEnv, ensureTestEnv } from './env.ts'
import type { FakeGateway } from './fakes.ts'
import type * as AppModuleNamespace from '#api/app.ts'
import type * as JsonStoreModuleNamespace from '#api/lib/jsonStore.ts'
import type * as StoreConfigModuleNamespace from '#api/config/store.ts'
import type * as GatewayModuleNamespace from '#api/lib/Gateway.ts'

type AppModule = typeof AppModuleNamespace
type JsonStoreModule = typeof JsonStoreModuleNamespace
type StoreConfigModule = typeof StoreConfigModuleNamespace
type GatewayModule = typeof GatewayModuleNamespace
type RealGateway = InstanceType<GatewayModule['default']>

// vi.mock hoists above this file's other statements, so the shared fn needs vi.hoisted too for a stable reference
const { enumerateSerialPorts } = vi.hoisted(() => ({
	enumerateSerialPorts: vi.fn(() => Promise.resolve<string[]>([])),
}))

vi.mock('#api/lib/serialPorts.ts', () => ({ enumerateSerialPorts }))

let appModulePromise: Promise<AppModule> | undefined
let jsonStoreModulePromise: Promise<JsonStoreModule> | undefined
let storeConfigModulePromise: Promise<StoreConfigModule> | undefined
let gatewayModulePromise: Promise<GatewayModule> | undefined

export async function loadAppModule(): Promise<AppModule> {
	ensureTestEnv()
	appModulePromise ??= import('#api/app.ts')
	return appModulePromise
}

export async function loadJsonStore() {
	ensureTestEnv()
	jsonStoreModulePromise ??= import('#api/lib/jsonStore.ts')
	storeConfigModulePromise ??= import('#api/config/store.ts')
	const [jsonStoreMod, storeMod] = await Promise.all([
		jsonStoreModulePromise,
		storeConfigModulePromise,
	])
	return { jsonStore: jsonStoreMod.default, store: storeMod.default }
}

async function loadGatewayModule(): Promise<GatewayModule> {
	gatewayModulePromise ??= import('#api/lib/Gateway.ts')
	return gatewayModulePromise
}

export interface HttpHarness {
	app: Express
	request: ReturnType<typeof supertest>
	agent: ReturnType<typeof supertest.agent>
	jsonStore: JsonStoreModule['default']
	store: StoreConfigModule['default']
	server: HttpServer
	loadSnippets(): Promise<void>
}

// Buffers the raw bytes because Superagent's default parser corrupts binary bodies served with a JSON-like content type
export function bufferResponse(req: SupertestTest): SupertestTest {
	return req.buffer(true).parse((response, callback) => {
		const chunks: Buffer[] = []
		response.on('data', (chunk: Buffer) => chunks.push(chunk))
		response.on('end', () => callback(null, Buffer.concat(chunks)))
	})
}

export interface HttpHarnessOptions {
	gateway?: FakeGateway
	restarting?: boolean
}

interface SharedTestContext {
	createApp: AppModule['createApp']
	jsonStore: JsonStoreModule['default']
	store: StoreConfigModule['default']
	closeWatchers: GatewayModule['closeWatchers']
}

async function createSharedTestContext(): Promise<SharedTestContext> {
	const [{ createApp }, { jsonStore, store }, { closeWatchers }] =
		await Promise.all([
			loadAppModule(),
			loadJsonStore(),
			loadGatewayModule(),
		])
	await jsonStore.init(store)
	return { createApp, jsonStore, store, closeWatchers }
}

async function createHarnessInstance(
	shared: SharedTestContext,
	options: HttpHarnessOptions,
): Promise<HttpHarness & { closeInstance(): Promise<void> }> {
	const instance = shared.createApp({
		// Gateway has private fields, so a structural mock like FakeGateway needs this cast to satisfy it
		gateway: options.gateway as unknown as RealGateway | undefined,
		restarting: options.restarting,
	})
	await instance.loadSnippets()

	const server = createServer(instance.app)
	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', () => resolve())
	})

	return {
		app: instance.app,
		request: supertest(server),
		agent: supertest.agent(server),
		jsonStore: shared.jsonStore,
		store: shared.store,
		server,
		loadSnippets: () => instance.loadSnippets(),
		async closeInstance() {
			await new Promise<void>((resolve, reject) => {
				server.close((err) => (err ? reject(err) : resolve()))
			})
		},
	}
}

// Gives each test a fresh createApp() instance + server, so tests never leak state and need no reset hooks
export function useHttpHarness(): (
	options?: HttpHarnessOptions,
) => Promise<HttpHarness> {
	let shared: SharedTestContext | undefined
	let current: (HttpHarness & { closeInstance(): Promise<void> }) | undefined

	beforeAll(async () => {
		shared = await createSharedTestContext()
	})

	afterEach(async () => {
		enumerateSerialPorts.mockReset()
		enumerateSerialPorts.mockResolvedValue([])
		if (current) {
			await current.closeInstance()
			current = undefined
		}
	})

	afterAll(() => {
		if (!shared) return
		shared.closeWatchers()
		for (const key of Object.keys(shared.jsonStore.store)) {
			delete shared.jsonStore.store[key]
		}
		cleanupTestEnv()
	})

	return async function getHarness(
		options: HttpHarnessOptions = {},
	): Promise<HttpHarness> {
		if (!shared) {
			throw new Error(
				'useHttpHarness(): beforeAll has not run yet, call the accessor from within a test',
			)
		}
		current ??= await createHarnessInstance(shared, options)
		return current
	}
}
