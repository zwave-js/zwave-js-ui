// Module loaders and the beforeAll/afterEach/afterAll lifecycle shared by both the HTTP and socket
// harnesses: one isolated createApp/jsonStore/store/closeWatchers context per test file, one fresh
// per-test instance torn down in afterEach. Each transport supplies its own createHarnessInstance()
// (Express+supertest vs. Express+Socket.IO) and layers any transport-only setup on top of this.
import { beforeAll, afterEach, afterAll } from 'vitest'
import type { Server as HttpServer } from 'node:http'
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

export function listenOnEphemeralPort(server: HttpServer): Promise<void> {
	return new Promise((resolve) => {
		server.listen(0, '127.0.0.1', resolve)
	})
}

/**
 * A single "current" instance managed across a test file: lazily created and
 * memoized per test, replaceable mid-test, and always closed in `afterEach`
 * (plus a final `afterAll` sweep). The reference is dropped *before* the close
 * is awaited, so a throw during close can't leave a half-closed instance for
 * the next teardown to reclose. `afterEachCleanup`/`afterAllCleanup` run in a
 * `finally`, so file-global teardown (registry/env resets) happens even if a
 * close throws.
 */
export interface ManagedCurrent<Instance, Options> {
	/** Create (once per test) and return the current instance. */
	get(options?: Options): Promise<Instance>
	/** Close the existing instance, then create and track a fresh one. */
	replace(options?: Options): Promise<Instance>
	/** The tracked instance, without creating one. */
	peek(): Instance | undefined
}

export function useManagedCurrent<Instance, Options>(
	create: (options: Options) => Promise<Instance>,
	close: (instance: Instance) => Promise<void> | void,
	hooks: {
		afterEachCleanup?: () => Promise<void> | void
		afterAllCleanup?: () => Promise<void> | void
	} = {},
): ManagedCurrent<Instance, Options> {
	let current: Instance | undefined

	async function closeCurrent(): Promise<void> {
		const instance = current
		// Drop the reference first so a throw below can't strand a closed
		// instance that a later teardown would try to close again
		current = undefined
		if (instance !== undefined) {
			await close(instance)
		}
	}

	afterEach(async () => {
		try {
			await closeCurrent()
		} finally {
			await hooks.afterEachCleanup?.()
		}
	})

	afterAll(async () => {
		try {
			await closeCurrent()
		} finally {
			await hooks.afterAllCleanup?.()
		}
	})

	return {
		async get(options: Options = {} as Options): Promise<Instance> {
			current ??= await create(options)
			return current
		},
		async replace(options: Options = {} as Options): Promise<Instance> {
			await closeCurrent()
			current = await create(options)
			return current
		},
		peek(): Instance | undefined {
			return current
		},
	}
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

	beforeAll(async () => {
		shared = await createSharedTestContext()
	})

	const managed = useManagedCurrent<Harness, Options>(
		(options) => {
			if (!shared) {
				throw new Error(
					'useHarnessLifecycle(): beforeAll has not run yet, call the accessor from within a test',
				)
			}
			return createHarnessInstance(shared, options)
		},
		(harness) => harness.closeInstance(),
		{
			afterAllCleanup() {
				if (!shared) return
				shared.closeWatchers()
				for (const key of Object.keys(shared.jsonStore.store)) {
					delete shared.jsonStore.store[key]
				}
				cleanupTestEnv()
			},
		},
	)

	return (options?: Options) => managed.get(options)
}
