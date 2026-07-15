// Module loaders and the beforeAll/afterEach/afterAll lifecycle shared by both the HTTP and socket
// harnesses: one isolated createApp/jsonStore/store/closeWatchers context per test file, one fresh
// per-test instance torn down in afterEach. Each transport supplies its own createHarnessInstance()
// (Express+supertest vs. Express+Socket.IO) and layers any transport-only setup on top of this.
import { beforeAll, afterEach, afterAll } from 'vitest'
import { ensureTestEnv, cleanupTestEnv } from './env.ts'
import type * as AppModuleNamespace from '#api/app.ts'
import type * as JsonStoreModuleNamespace from '#api/lib/jsonStore.ts'
import type * as StoreConfigModuleNamespace from '#api/config/store.ts'
import type * as GatewayModuleNamespace from '#api/lib/Gateway.ts'

export type AppModule = typeof AppModuleNamespace
export type JsonStoreModule = typeof JsonStoreModuleNamespace
export type StoreConfigModule = typeof StoreConfigModuleNamespace
export type GatewayModule = typeof GatewayModuleNamespace

let appModulePromise: Promise<AppModule> | undefined
let jsonStoreModulePromise: Promise<JsonStoreModule> | undefined
let storeConfigModulePromise: Promise<StoreConfigModule> | undefined
let gatewayModulePromise: Promise<GatewayModule> | undefined

export async function loadAppModule(): Promise<AppModule> {
	ensureTestEnv()
	appModulePromise ??= import('#api/app.ts')
	return appModulePromise
}

export async function loadJsonStore(): Promise<{
	jsonStore: JsonStoreModule['default']
	store: StoreConfigModule['default']
}> {
	ensureTestEnv()
	jsonStoreModulePromise ??= import('#api/lib/jsonStore.ts')
	storeConfigModulePromise ??= import('#api/config/store.ts')
	const [jsonStoreMod, storeMod] = await Promise.all([
		jsonStoreModulePromise,
		storeConfigModulePromise,
	])
	return { jsonStore: jsonStoreMod.default, store: storeMod.default }
}

// Releases the Gateway.ts fs.watch() watchers since api/app.ts always pulls this module in transitively
export async function loadGatewayModule(): Promise<GatewayModule> {
	gatewayModulePromise ??= import('#api/lib/Gateway.ts')
	return gatewayModulePromise
}

export interface SharedTestContext {
	createApp: AppModule['createApp']
	jsonStore: JsonStoreModule['default']
	store: StoreConfigModule['default']
	closeWatchers: GatewayModule['closeWatchers']
}

export async function createSharedTestContext(): Promise<SharedTestContext> {
	const [{ createApp }, { jsonStore, store }, { closeWatchers }] =
		await Promise.all([
			loadAppModule(),
			loadJsonStore(),
			loadGatewayModule(),
		])
	await jsonStore.init(store)
	return { createApp, jsonStore, store, closeWatchers }
}

// Wires the beforeAll/afterEach/afterAll lifecycle shared by both transports: one real createApp()
// instance per test (torn down via afterEach's closeInstance()), one shared module/jsonStore context
// per test file (beforeAll/afterAll).
export function useHarnessLifecycle<
	Harness extends { closeInstance(): Promise<void> },
	Options,
>(
	createHarnessInstance: (
		shared: SharedTestContext,
		options: Options,
	) => Promise<Harness>,
): (options?: Options) => Promise<Harness> {
	let shared: SharedTestContext | undefined
	let current: Harness | undefined

	beforeAll(async () => {
		shared = await createSharedTestContext()
	})

	afterEach(async () => {
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
		options: Options = {} as Options,
	): Promise<Harness> {
		if (!shared) {
			throw new Error(
				'useHarnessLifecycle(): beforeAll has not run yet, call the accessor from within a test',
			)
		}
		current ??= await createHarnessInstance(shared, options)
		return current
	}
}
