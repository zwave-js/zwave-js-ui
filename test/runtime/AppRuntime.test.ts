/**
 * Direct unit tests for `AppRuntime`, constructed without any Express/HTTP layer
 *
 * Covers the per-request-fresh resolution behavior (a gateway/zniffer
 * replaced mid-restart must be visible to the very next call, never a stale
 * reference), `startGateway()`/`startZniffer()`'s SESSION_SECRET warning
 * branch and plugin loading, snippet loading, and `shutdown()`'s guarded
 * gateway close plus plugin teardown.
 *
 * `Gateway`/`ZWaveClient`/`MqttClient`/`ZnifferManager` are mocked purely to
 * capture constructor arguments and avoid touching real hardware/MQTT
 * brokers; every other test constructs `AppRuntime` directly and swaps in
 * plain fake collaborators (`createFakeGateway`/`createFakeZwaveClient`).
 */
import {
	describe,
	it,
	expect,
	vi,
	beforeAll,
	afterAll,
	afterEach,
} from 'vitest'
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type Gateway from '#api/lib/Gateway.ts'
import type ZnifferManager from '#api/lib/ZnifferManager.ts'
import type JsonStoreModule from '#api/lib/jsonStore.ts'
import type StoreModule from '#api/config/store.ts'
import type {
	AppRuntime as AppRuntimeClass,
	AppRuntimeDeps,
} from '#api/runtime/AppRuntime.ts'
import {
	createFakeGateway,
	createFakeZwaveClient,
} from '../lib/shared/fakes.ts'
import { ensureTestEnv, cleanupTestEnv } from '../lib/shared/env.ts'

const mqttCtor = vi.fn()
const zwaveCtor = vi.fn()
const gatewayCtor = vi.fn()
const znifferCtor = vi.fn()
const gatewayStart = vi.fn(() => Promise.resolve())
// Separate from fakes.ts's createFakeGateway() so the real-plugin-loading shutdown() test can assert close() on a gateway built via the actual startGateway() path
const gatewayClose = vi.fn(() => Promise.resolve())

vi.mock('#api/lib/MqttClient.ts', () => ({
	default: class MockMqttClient {
		constructor(...args: unknown[]) {
			mqttCtor(...args)
		}
	},
}))

vi.mock('#api/lib/ZwaveClient.ts', () => ({
	default: class MockZWaveClient {
		constructor(...args: unknown[]) {
			zwaveCtor(...args)
		}
	},
}))

vi.mock('#api/lib/Gateway.ts', () => ({
	default: class MockGateway {
		constructor(...args: unknown[]) {
			gatewayCtor(...args)
		}
		start = gatewayStart
		close = gatewayClose
	},
}))

vi.mock('#api/lib/ZnifferManager.ts', () => ({
	default: class MockZnifferManager {
		constructor(...args: unknown[]) {
			znifferCtor(...args)
		}
	},
}))

describe('AppRuntime', () => {
	let AppRuntimeCtor: typeof AppRuntimeClass
	let jsonStoreMod: typeof JsonStoreModule
	let storeMod: typeof StoreModule

	beforeAll(async () => {
		ensureTestEnv()

		// Dynamic import, after ensureTestEnv(), since AppRuntime.ts's static config/app.ts import touches the filesystem at module-evaluation time
		const runtimeMod = await import('#api/runtime/AppRuntime.ts')
		AppRuntimeCtor = runtimeMod.AppRuntime

		const [{ default: jsonStore }, { default: store }] = await Promise.all([
			import('#api/lib/jsonStore.ts'),
			import('#api/config/store.ts'),
		])
		jsonStoreMod = jsonStore
		storeMod = store
		await jsonStoreMod.init(storeMod)
	})

	afterAll(() => {
		cleanupTestEnv()
	})

	afterEach(() => {
		mqttCtor.mockClear()
		zwaveCtor.mockClear()
		gatewayCtor.mockClear()
		znifferCtor.mockClear()
		gatewayStart.mockClear()
		gatewayClose.mockClear()
	})

	function createRuntime(
		deps: Partial<AppRuntimeDeps> = {},
	): AppRuntimeClass {
		return new AppRuntimeCtor({
			getSocketServer: () => ({}) as never,
			...deps,
		})
	}

	describe('per-request-fresh resolution (no stale capture across a swap)', () => {
		it('startGateway() (a restart) replaces the gateway in place, immediately visible to the very next call', async () => {
			const runtime = createRuntime()
			const gwOld = createFakeGateway() as unknown as Gateway
			runtime.setGateway(gwOld)

			await runtime.startGateway({})

			expect(runtime.getGateway()).not.toBe(gwOld)
			expect(runtime.requireGateway()).not.toBe(gwOld)
			expect(gatewayCtor).toHaveBeenCalledOnce()
		})

		it('startZniffer() replaces the zniffer in place, immediately visible to the very next call', () => {
			const runtime = createRuntime()
			const znifferOld = { id: 'old' } as unknown as ZnifferManager
			runtime.setZniffer(znifferOld)

			runtime.startZniffer({ enabled: true })

			expect(runtime.getZniffer()).not.toBe(znifferOld)
			expect(runtime.requireZniffer()).not.toBe(znifferOld)
			expect(znifferCtor).toHaveBeenCalledOnce()
		})

		it('startZniffer(undefined) leaves the current zniffer untouched (no-op)', () => {
			const runtime = createRuntime()
			const zniffer = { id: 'kept' } as unknown as ZnifferManager
			runtime.setZniffer(zniffer)

			runtime.startZniffer(undefined)

			expect(runtime.getZniffer()).toBe(zniffer)
			expect(znifferCtor).not.toHaveBeenCalled()
		})
	})

	describe('loadSnippets() / getSnippets()', () => {
		it('loadSnippets() populates defaultSnippets from every real .js file bundled under the repo snippets/ dir', async () => {
			const runtime = createRuntime()
			await runtime.loadSnippets()
			runtime.setGateway(
				createFakeGateway({
					zwave: createFakeZwaveClient({ cacheSnippets: [] }),
				}) as unknown as Gateway,
			)
			const snippets = await runtime.getSnippets()
			const names = snippets.map((s) => s.name)
			expect(names).toEqual(
				expect.arrayContaining([
					'access-store-dir',
					'clone-config',
					'pingNodes',
					'reinterview-nodes',
				]),
			)
		})

		it('loadSnippets() is idempotent - calling it twice never duplicates entries', async () => {
			const runtime = createRuntime()
			await runtime.loadSnippets()
			await runtime.loadSnippets()
			runtime.setGateway(
				createFakeGateway({
					zwave: createFakeZwaveClient({ cacheSnippets: [] }),
				}) as unknown as Gateway,
			)
			const snippets = await runtime.getSnippets()
			const names = snippets.map((s) => s.name)
			const countOfPing = names.filter((n) => n === 'pingNodes').length
			expect(countOfPing).toBe(1)
		})

		it('getSnippets() merges the live gateway cacheSnippets, the bundled defaults, and any real on-disk snippet file under the configured snippetsDir - excluding non-.js entries', async () => {
			const { snippetsDir } = await import('#api/config/app.ts')
			mkdirSync(snippetsDir, { recursive: true })
			writeFileSync(
				path.join(snippetsDir, 'unit-test-on-disk.js'),
				'// on disk\n',
			)
			// A non-.js file must be excluded, not just any dir entry
			writeFileSync(
				path.join(snippetsDir, 'ignore-me.txt'),
				'not a snippet',
			)

			const runtime = createRuntime()
			await runtime.loadSnippets()
			runtime.setGateway(
				createFakeGateway({
					zwave: createFakeZwaveClient({
						cacheSnippets: [{ name: 'cached', content: '//x' }],
					}),
				}) as unknown as Gateway,
			)

			const snippets = await runtime.getSnippets()
			expect(snippets).toEqual(
				expect.arrayContaining([
					{ name: 'cached', content: '//x' },
					{ name: 'unit-test-on-disk', content: '// on disk\n' },
				]),
			)
			const names = snippets.map((s) => s.name)
			expect(names).not.toContain('ignore-me')
			expect(names).not.toContain('ignore-me.txt')
		})

		it('getSnippets() defaults to an empty cache array when the gateway has no zwave client (?? [] fallback)', async () => {
			const runtime = createRuntime()
			await runtime.loadSnippets()
			runtime.setGateway(
				createFakeGateway({ zwave: undefined }) as unknown as Gateway,
			)
			const snippets = await runtime.getSnippets()
			expect(snippets.filter((s) => s.name === 'cached')).toEqual([])
		})

		it('getSnippets() defaults to an empty cache array when no gateway is attached at all (?? [] fallback)', async () => {
			const runtime = createRuntime()
			await runtime.loadSnippets()
			const snippets = await runtime.getSnippets()
			expect(snippets.filter((s) => s.name === 'cached')).toEqual([])
		})
	})

	describe('startGateway() SESSION_SECRET warning branch', () => {
		const originalSecret = process.env.SESSION_SECRET

		afterEach(() => {
			if (originalSecret === undefined) {
				delete process.env.SESSION_SECRET
			} else {
				process.env.SESSION_SECRET = originalSecret
			}
		})

		it('warns when auth is enabled and SESSION_SECRET is unset', async () => {
			await jsonStoreMod.put(storeMod.settings, {
				gateway: { authEnabled: true },
			})
			delete process.env.SESSION_SECRET

			const { module: loggerModule } = await import('#api/lib/logger.ts')
			// Winston reuses an existing module logger by name, so this is
			// the exact same instance `AppRuntime.ts`'s top-level
			// `const logger = loggers.module('Runtime')` already holds.
			const runtimeLogger = loggerModule('Runtime')
			const warnSpy = vi.spyOn(runtimeLogger, 'warn')

			const runtime = createRuntime()
			await runtime.startGateway({})

			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('SESSION_SECRET'),
			)
			warnSpy.mockRestore()
		})

		it('does not warn when auth is enabled and SESSION_SECRET IS set', async () => {
			await jsonStoreMod.put(storeMod.settings, {
				gateway: { authEnabled: true },
			})
			process.env.SESSION_SECRET = 'a-real-secret'

			const { module: loggerModule } = await import('#api/lib/logger.ts')
			const runtimeLogger = loggerModule('Runtime')
			const warnSpy = vi.spyOn(runtimeLogger, 'warn')

			const runtime = createRuntime()
			await runtime.startGateway({})

			expect(warnSpy).not.toHaveBeenCalledWith(
				expect.stringContaining('SESSION_SECRET'),
			)
			warnSpy.mockRestore()
		})

		it('does not warn when auth is disabled, even with SESSION_SECRET unset', async () => {
			await jsonStoreMod.put(storeMod.settings, {
				gateway: { authEnabled: false },
			})
			delete process.env.SESSION_SECRET

			const { module: loggerModule } = await import('#api/lib/logger.ts')
			const runtimeLogger = loggerModule('Runtime')
			const warnSpy = vi.spyOn(runtimeLogger, 'warn')

			const runtime = createRuntime()
			await runtime.startGateway({})

			expect(warnSpy).not.toHaveBeenCalledWith(
				expect.stringContaining('SESSION_SECRET'),
			)
			warnSpy.mockRestore()
		})
	})

	describe('startGateway() mqtt/zwave/gateway construction', () => {
		it('constructs Gateway even when settings.gateway/mqtt/zwave are all absent', async () => {
			const runtime = createRuntime()
			await runtime.startGateway({})
			expect(mqttCtor).not.toHaveBeenCalled()
			expect(zwaveCtor).not.toHaveBeenCalled()
			expect(gatewayCtor).toHaveBeenCalledOnce()
			expect(gatewayStart).toHaveBeenCalledOnce()
		})

		it('resets the restarting flag to false after a successful start', async () => {
			const runtime = createRuntime()
			runtime.setRestarting(true)
			await runtime.startGateway({})
			expect(runtime.isRestarting()).toBe(false)
		})
	})

	describe('plugin loading (startGateway())', () => {
		let pluginDir: string

		beforeAll(() => {
			pluginDir = mkdtempSync(path.join(tmpdir(), 'apprun-plugins-test-'))
			writeFileSync(
				path.join(pluginDir, 'good-plugin.mjs'),
				'export default class GoodPlugin {\n' +
					'  constructor(context) { this.context = context }\n' +
					'  async destroy() {}\n' +
					'}\n',
			)
			writeFileSync(
				path.join(pluginDir, 'bad-plugin.mjs'),
				'export default class BadPlugin {\n' +
					'  constructor(context) { this.context = context }\n' +
					'}\n',
			)
		})

		afterAll(() => {
			rmSync(pluginDir, { recursive: true, force: true })
		})

		it('loads every configured plugin, exposing each through getPlugins(), and creates a plugin router', async () => {
			const runtime = createRuntime()
			await runtime.startGateway({
				gateway: {
					plugins: [
						path.join(pluginDir, 'good-plugin.mjs'),
						path.join(pluginDir, 'bad-plugin.mjs'),
					],
				},
			})

			const plugins = runtime.getPlugins()
			expect(plugins).toHaveLength(2)
			expect(plugins.map((p) => p.name)).toEqual([
				'good-plugin.mjs',
				'bad-plugin.mjs',
			])
			expect(runtime.getPluginsRouter()).toBeDefined()
		})

		it('logs and skips a plugin that fails to load, without aborting the rest of startup', async () => {
			const runtime = createRuntime()
			await runtime.startGateway({
				gateway: {
					plugins: [
						'/definitely/not/a/real/plugin/path.mjs',
						path.join(pluginDir, 'good-plugin.mjs'),
					],
				},
			})

			const plugins = runtime.getPlugins()
			expect(plugins.map((p) => p.name)).toEqual(['good-plugin.mjs'])
		})

		it('ignores a non-array plugins config (defensive ?? null / Array.isArray guard)', async () => {
			const runtime = createRuntime()
			await runtime.startGateway({
				gateway: {
					// Deliberately malformed, not an array, to exercise the Array.isArray(pluginsConfig) guard's false side
					plugins: 'not-an-array' as unknown as string[],
				},
			})

			expect(runtime.getPlugins()).toEqual([])
			expect(runtime.getPluginsRouter()).toBeDefined()
		})

		it('destroyPlugins() calls destroy() on every plugin that has one, then empties the list - tolerating plugins without one', async () => {
			const runtime = createRuntime()
			await runtime.startGateway({
				gateway: {
					plugins: [
						path.join(pluginDir, 'good-plugin.mjs'),
						path.join(pluginDir, 'bad-plugin.mjs'),
					],
				},
			})

			const [goodInstance, badInstance] = runtime.getPlugins()
			const destroySpy = vi.spyOn(goodInstance, 'destroy')
			// Confirms bad-plugin.mjs genuinely has no destroy method before relying on destroyPlugins()'s typeof guard to tolerate it
			expect(
				(badInstance as { destroy?: unknown }).destroy,
			).toBeUndefined()

			await runtime.destroyPlugins()

			expect(destroySpy).toHaveBeenCalledOnce()
			expect(runtime.getPlugins()).toEqual([])
		})

		it('destroyPlugins() on an empty plugin list is a safe no-op', async () => {
			const runtime = createRuntime()
			await expect(runtime.destroyPlugins()).resolves.toBeUndefined()
			expect(runtime.getPlugins()).toEqual([])
		})
	})

	describe('shutdown()', () => {
		it('closes the current gateway (if any); a shutdown with no loaded plugins is a no-op for plugin teardown', async () => {
			const runtime = createRuntime()
			const gw = createFakeGateway()
			runtime.setGateway(gw as unknown as Gateway)

			await runtime.shutdown()

			expect(gw.close).toHaveBeenCalledOnce()
			expect(runtime.getPlugins()).toEqual([])
		})

		it(
			'tears down every plugin loaded through the REAL startGateway() plugin-loading/registration ' +
				'path - not a hand-pushed fake bypassing it (there is no such seam: AppRuntime only ever ' +
				"populates its plugin list from startGateway()'s dynamic import/createPlugin() call) - " +
				"destroying each exactly once, in destroyPlugins()'s LIFO order, only after the gateway " +
				'itself has been closed',
			async () => {
				const pluginDir = mkdtempSync(
					path.join(tmpdir(), 'apprun-shutdown-plugin-test-'),
				)
				try {
					writeFileSync(
						path.join(pluginDir, 'shutdown-plugin-a.mjs'),
						'export default class ShutdownPluginA {\n' +
							'  constructor(context) { this.context = context }\n' +
							'  async destroy() {}\n' +
							'}\n',
					)
					writeFileSync(
						path.join(pluginDir, 'shutdown-plugin-b.mjs'),
						'export default class ShutdownPluginB {\n' +
							'  constructor(context) { this.context = context }\n' +
							'  async destroy() {}\n' +
							'}\n',
					)

					const runtime = createRuntime()
					// Real production path: startGateway() constructs the gateway and dynamically imports/registers each plugin exactly as a real deployment would, since there is no other seam to push a plugin into AppRuntime's private list
					await runtime.startGateway({
						gateway: {
							plugins: [
								path.join(pluginDir, 'shutdown-plugin-a.mjs'),
								path.join(pluginDir, 'shutdown-plugin-b.mjs'),
							],
						},
					})

					const [pluginA, pluginB] = runtime.getPlugins()
					expect(pluginA.name).toBe('shutdown-plugin-a.mjs')
					expect(pluginB.name).toBe('shutdown-plugin-b.mjs')
					const destroyA = vi.spyOn(pluginA, 'destroy')
					const destroyB = vi.spyOn(pluginB, 'destroy')

					await runtime.shutdown()

					expect(gatewayClose).toHaveBeenCalledOnce()
					expect(destroyA).toHaveBeenCalledOnce()
					expect(destroyB).toHaveBeenCalledOnce()
					expect(runtime.getPlugins()).toEqual([])

					// shutdown() closes the gateway before destroying plugins (closeIfPresent runs before destroyPlugins())
					expect(
						gatewayClose.mock.invocationCallOrder[0],
					).toBeLessThan(destroyA.mock.invocationCallOrder[0])
					expect(
						gatewayClose.mock.invocationCallOrder[0],
					).toBeLessThan(destroyB.mock.invocationCallOrder[0])
					// destroyPlugins() pops from the end of the list, so the last-loaded plugin is destroyed first (LIFO)
					expect(destroyB.mock.invocationCallOrder[0]).toBeLessThan(
						destroyA.mock.invocationCallOrder[0],
					)
				} finally {
					rmSync(pluginDir, { recursive: true, force: true })
				}
			},
		)

		it('shutdown() with no gateway attached does not throw (guarded close)', async () => {
			const runtime = createRuntime()
			await expect(runtime.shutdown()).resolves.toBeUndefined()
		})
	})
})
