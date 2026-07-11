import { createServer, type Server as HttpServer } from 'node:http'
import type { Express } from 'express'
import supertest from 'supertest'
import { vi } from 'vitest'
import { cleanupTestEnv, ensureTestEnv } from './env.ts'
import type { FakeGateway } from './fakes.ts'
import type * as AppModuleNamespace from '#api/app.ts'
import type * as JsonStoreModuleNamespace from '#api/lib/jsonStore.ts'
import type * as StoreConfigModuleNamespace from '#api/config/store.ts'
import type * as GatewayModuleNamespace from '#api/lib/Gateway.ts'

type AppModule = typeof AppModuleNamespace
type AppInstance = ReturnType<AppModule['createApp']>
type JsonStoreModule = typeof JsonStoreModuleNamespace
type StoreConfigModule = typeof StoreConfigModuleNamespace
type GatewayModule = typeof GatewayModuleNamespace

type TestHooks = Omit<AppInstance, 'setGateway'> & {
	setGateway(value: FakeGateway | undefined): void
}

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
	testHooks: TestHooks
	jsonStore: JsonStoreModule['default']
	store: StoreConfigModule['default']
	server: HttpServer
	resetState(): void
	close(): Promise<void>
}

export async function createHttpHarness(): Promise<HttpHarness> {
	const [{ createApp }, { jsonStore, store }, { closeWatchers }] =
		await Promise.all([
			loadAppModule(),
			loadJsonStore(),
			loadGatewayModule(),
		])

	await jsonStore.init(store)

	const instance = createApp()
	await instance.loadSnippets()

	const server = createServer(instance.app)
	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', () => resolve())
	})

	function resetState() {
		instance.setGateway(undefined)
		instance.setZnifferManager(undefined)
		instance.setPluginsRouter(undefined)
		instance.setRestarting(false)
		enumerateSerialPorts.mockReset()
		enumerateSerialPorts.mockResolvedValue([])
	}

	resetState()

	return {
		app: instance.app,
		request: supertest(server),
		agent: supertest.agent(server),
		testHooks: instance,
		jsonStore,
		store,
		server,
		resetState,
		async close() {
			resetState()
			await new Promise<void>((resolve, reject) => {
				server.close((err) => (err ? reject(err) : resolve()))
			})
			closeWatchers()
			for (const key of Object.keys(jsonStore.store)) {
				delete jsonStore.store[key]
			}
			cleanupTestEnv()
		},
	}
}
