/**
 * Direct unit tests for `AppRuntime` (`api/runtime/AppRuntime.ts`) - the
 * typed owner of every backend collaborator whose identity/presence
 * changes across the process's lifetime (Layer 5 of issue #4722).
 *
 * These construct `AppRuntime` directly (no Express app/HTTP layer
 * involved) and cover:
 *  - plain accessor/mutator round-trips for every piece of state it owns,
 *  - the core "per-request-fresh resolution" regression: a gateway/zniffer
 *    replaced mid-restart (or via a test swapping it directly) must be
 *    visible to the very next call, never a stale captured reference,
 *  - `startGateway()`/`startZniffer()`'s SESSION_SECRET warning branch and
 *    plugin loading (success, failure, and `destroyPlugins()`），
 *  - snippet loading (`loadSnippets()`/`getSnippets()`), and
 *  - `shutdown()`'s guarded gateway close + plugin teardown.
 *
 * `Gateway`/`ZWaveClient`/`MqttClient`/`ZnifferManager` are mocked (this
 * file's own isolated module graph - the same, pre-established pattern as
 * `test/lib/http/settingsConstructorBoundary.test.ts`) purely to capture
 * constructor arguments and avoid touching real hardware/MQTT brokers;
 * every other test constructs `AppRuntime` directly and swaps in plain fake
 * collaborators (`createFakeGateway`/`createFakeZwaveClient`) - no HTTP
 * layer/Express app involved anywhere in this file.
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
import type Gateway from '../../api/lib/Gateway.ts'
import type ZnifferManager from '../../api/lib/ZnifferManager.ts'
import type JsonStoreModule from '../../api/lib/jsonStore.ts'
import type StoreModule from '../../api/config/store.ts'
import type {
	AppRuntime as AppRuntimeClass,
	AppRuntimeDeps,
} from '../../api/runtime/AppRuntime.ts'
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
// Tracked separately from `test/lib/http/fakes.ts`'s `createFakeGateway()`
// (used by the OTHER `shutdown()` test, which sets a fake gateway directly)
// so the "real plugin loading path" `shutdown()` regression below can drive
// a gateway constructed through the actual `startGateway()` production path
// - the same mocked `Gateway` class every other test in this file already
// goes through - while still asserting its `close()` was invoked.
const gatewayClose = vi.fn(() => Promise.resolve())

vi.mock('../../api/lib/MqttClient.ts', () => ({
	default: class MockMqttClient {
		constructor(...args: unknown[]) {
			mqttCtor(...args)
		}
	},
}))

vi.mock('../../api/lib/ZwaveClient.ts', () => ({
	default: class MockZWaveClient {
		constructor(...args: unknown[]) {
			zwaveCtor(...args)
		}
	},
}))

vi.mock('../../api/lib/Gateway.ts', () => ({
	default: class MockGateway {
		constructor(...args: unknown[]) {
			gatewayCtor(...args)
		}
		start = gatewayStart
		close = gatewayClose
	},
}))

vi.mock('../../api/lib/ZnifferManager.ts', () => ({
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

		// Dynamic imports, deliberately AFTER `ensureTestEnv()`:
		// `AppRuntime.ts` statically imports `../config/app.ts`, which
		// touches the real filesystem at module-evaluation time (session
		// secret file, store/log dirs). A static top-level import here
		// would evaluate before `ensureTestEnv()` could run, due to ES
		// module import hoisting - see `test/lib/http/harness.ts` for the
		// same pattern applied to `api/app.ts`.
		const runtimeMod = await import('../../api/runtime/AppRuntime.ts')
		AppRuntimeCtor = runtimeMod.AppRuntime

		const [{ default: jsonStore }, { default: store }] = await Promise.all([
			import('../../api/lib/jsonStore.ts'),
			import('../../api/config/store.ts'),
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

	describe('gateway get/set/require', () => {
		it('has no gateway until one is set', () => {
			const runtime = createRuntime()
			expect(runtime.getGateway()).toBeUndefined()
		})

		it('returns exactly what was set, round-trip', () => {
			const runtime = createRuntime()
			const gw = createFakeGateway() as unknown as Gateway
			runtime.setGateway(gw)
			expect(runtime.getGateway()).toBe(gw)
			expect(runtime.requireGateway('zwave')).toBe(gw)
		})

		it('setGateway(undefined) clears a previously-set gateway', () => {
			const runtime = createRuntime()
			runtime.setGateway(createFakeGateway() as unknown as Gateway)
			runtime.setGateway(undefined)
			expect(runtime.getGateway()).toBeUndefined()
		})

		it('requireGateway() throws the native TypeError when absent (preserved quirk, no guard added)', () => {
			const runtime = createRuntime()
			expect(() => runtime.requireGateway('zwave')).toThrow(
				"Cannot read properties of undefined (reading 'zwave')",
			)
		})
	})

	describe('zniffer get/set/require', () => {
		it('has no zniffer until one is set', () => {
			const runtime = createRuntime()
			expect(runtime.getZniffer()).toBeUndefined()
		})

		it('returns exactly what was set, round-trip', () => {
			const runtime = createRuntime()
			const zniffer = {} as unknown as ZnifferManager
			runtime.setZniffer(zniffer)
			expect(runtime.getZniffer()).toBe(zniffer)
			expect(runtime.requireZniffer('start')).toBe(zniffer)
		})

		it('setZniffer(undefined) clears a previously-set zniffer', () => {
			const runtime = createRuntime()
			runtime.setZniffer({} as unknown as ZnifferManager)
			runtime.setZniffer(undefined)
			expect(runtime.getZniffer()).toBeUndefined()
		})

		it('requireZniffer() throws the native TypeError when absent (preserved quirk, no guard added)', () => {
			const runtime = createRuntime()
			expect(() => runtime.requireZniffer('start')).toThrow(
				"Cannot read properties of undefined (reading 'start')",
			)
		})
	})

	describe('per-request-fresh resolution (no stale capture across a swap) - the core Layer 5 regression', () => {
		it('a later call observes a replaced gateway, not a cached earlier one', () => {
			const runtime = createRuntime()
			const gwA = createFakeGateway({
				zwave: createFakeZwaveClient({
					devices: { 1: { name: 'device A' } },
				}),
			}) as unknown as Gateway
			const gwB = createFakeGateway({
				zwave: createFakeZwaveClient({
					devices: { 2: { name: 'device B' } },
				}),
			}) as unknown as Gateway

			runtime.setGateway(gwA)
			expect(runtime.getGateway()).toBe(gwA)
			expect(runtime.requireGateway('zwave').zwave?.devices).toEqual({
				1: { name: 'device A' },
			})

			// Simulate a restart/swap: a brand new gateway replaces the old one.
			runtime.setGateway(gwB)

			// Every accessor - not just getGateway() - must resolve the NEW
			// instance on the very next call; nothing captured gwA.
			expect(runtime.getGateway()).toBe(gwB)
			expect(runtime.getGateway()).not.toBe(gwA)
			expect(runtime.requireGateway('zwave')).toBe(gwB)
			expect(runtime.requireGateway('zwave').zwave?.devices).toEqual({
				2: { name: 'device B' },
			})
		})

		it('a later call observes a replaced zniffer, not a cached earlier one', () => {
			const runtime = createRuntime()
			const znifferA = { id: 'A' } as unknown as ZnifferManager
			const znifferB = { id: 'B' } as unknown as ZnifferManager

			runtime.setZniffer(znifferA)
			expect(runtime.getZniffer()).toBe(znifferA)

			runtime.setZniffer(znifferB)
			expect(runtime.getZniffer()).toBe(znifferB)
			expect(runtime.getZniffer()).not.toBe(znifferA)
			expect(runtime.requireZniffer('start')).toBe(znifferB)
		})

		it('startGateway() (a restart) replaces the gateway in place, immediately visible to the very next call', async () => {
			const runtime = createRuntime()
			const gwOld = createFakeGateway() as unknown as Gateway
			runtime.setGateway(gwOld)

			await runtime.startGateway({})

			expect(runtime.getGateway()).not.toBe(gwOld)
			expect(runtime.requireGateway('zwave')).not.toBe(gwOld)
			expect(gatewayCtor).toHaveBeenCalledOnce()
		})

		it('startZniffer() replaces the zniffer in place, immediately visible to the very next call', () => {
			const runtime = createRuntime()
			const znifferOld = { id: 'old' } as unknown as ZnifferManager
			runtime.setZniffer(znifferOld)

			runtime.startZniffer({ enabled: true })

			expect(runtime.getZniffer()).not.toBe(znifferOld)
			expect(runtime.requireZniffer('start')).not.toBe(znifferOld)
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

	describe('plugins / plugin router accessors', () => {
		it('starts with no plugins and no router', () => {
			const runtime = createRuntime()
			expect(runtime.getPlugins()).toEqual([])
			expect(runtime.getPluginsRouter()).toBeUndefined()
		})

		it('getPluginsRouter()/setPluginsRouter() round-trip', () => {
			const runtime = createRuntime()
			const router = {} as ReturnType<typeof runtime.getPluginsRouter>
			runtime.setPluginsRouter(router)
			expect(runtime.getPluginsRouter()).toBe(router)
			runtime.setPluginsRouter(undefined)
			expect(runtime.getPluginsRouter()).toBeUndefined()
		})
	})

	describe('restart state', () => {
		it('isRestarting()/setRestarting() round-trip, defaulting to false', () => {
			const runtime = createRuntime()
			expect(runtime.isRestarting()).toBe(false)
			runtime.setRestarting(true)
			expect(runtime.isRestarting()).toBe(true)
			runtime.setRestarting(false)
			expect(runtime.isRestarting()).toBe(false)
		})
	})

	describe('serial port enumerator seam', () => {
		it('defaults to the production Driver.enumerateSerialPorts implementation', () => {
			const runtime = createRuntime()
			expect(runtime.isEnumerateSerialPortsProductionDefault()).toBe(true)
			expect(typeof runtime.getEnumerateSerialPorts()).toBe('function')
		})

		it('replaces the enumerator with a test fake, then restores the production default on undefined', () => {
			const runtime = createRuntime()
			const productionFn = runtime.getEnumerateSerialPorts()
			const fake = vi.fn(() =>
				Promise.resolve([]),
			) as unknown as typeof productionFn

			runtime.setEnumerateSerialPorts(fake)
			expect(runtime.getEnumerateSerialPorts()).toBe(fake)
			expect(runtime.isEnumerateSerialPortsProductionDefault()).toBe(
				false,
			)

			runtime.setEnumerateSerialPorts(undefined)
			expect(runtime.getEnumerateSerialPorts()).not.toBe(fake)
			expect(runtime.isEnumerateSerialPortsProductionDefault()).toBe(true)
		})
	})

	describe('backup / debug manager access', () => {
		it('getBackupManager()/getDebugManager() return the stable singleton instances', async () => {
			const runtime = createRuntime()
			const { default: backupManager } = await import(
				'../../api/lib/BackupManager.ts'
			)
			const { default: debugManager } = await import(
				'../../api/lib/DebugManager.ts'
			)
			expect(runtime.getBackupManager()).toBe(backupManager)
			expect(runtime.getDebugManager()).toBe(debugManager)
		})
	})

	describe('getSettings()', () => {
		it('reads through to the current persisted settings via jsonStore', async () => {
			const runtime = createRuntime()
			await jsonStoreMod.put(storeMod.settings, {
				zwave: { port: '/dev/ttyTEST' },
			})
			expect(runtime.getSettings()).toEqual(
				expect.objectContaining({
					zwave: { port: '/dev/ttyTEST' },
				}),
			)
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
			const { snippetsDir } = await import('../../api/config/app.ts')
			mkdirSync(snippetsDir, { recursive: true })
			writeFileSync(
				path.join(snippetsDir, 'unit-test-on-disk.js'),
				'// on disk\n',
			)
			// A non-.js file must be excluded - not just any dir entry.
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

		it('getSnippets() throws the native TypeError when no gateway is attached at all (preserved quirk)', async () => {
			const runtime = createRuntime()
			// Ensures `snippetsDir` exists as a side effect, so the throw we
			// assert on is genuinely the unguarded `gw.zwave` access - not an
			// unrelated ENOENT from a missing directory.
			await runtime.loadSnippets()
			await expect(runtime.getSnippets()).rejects.toThrow(
				/Cannot read properties of undefined \(reading 'zwave'\)/,
			)
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

			const { module: loggerModule } = await import(
				'../../api/lib/logger.ts'
			)
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

			const { module: loggerModule } = await import(
				'../../api/lib/logger.ts'
			)
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

			const { module: loggerModule } = await import(
				'../../api/lib/logger.ts'
			)
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
					// Deliberately malformed - not an array - to exercise the
					// `Array.isArray(pluginsConfig)` guard's false side.
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
			// bad-plugin.mjs's instance genuinely has no destroy method -
			// confirm that shape before relying on destroyPlugins() to
			// tolerate it via its `typeof instance.destroy === 'function'`
			// guard.
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
					// Real production path - identical to the "plugin
					// loading (startGateway())" describe block above:
					// startGateway() constructs the gateway (the same
					// module-mocked `Gateway`/`gatewayClose` every other
					// test in this file already goes through) AND
					// dynamically imports/registers each plugin exactly as
					// a real deployment would. This regression can only
					// pass if destroyPlugins()/shutdown() actually walks
					// the plugins startGateway() itself loaded - there is
					// no way to "fake" a plugin into AppRuntime's private
					// list any other way.
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

					// shutdown() closes the gateway, THEN destroys plugins
					// (`closeIfPresent` runs before `destroyPlugins()`).
					expect(
						gatewayClose.mock.invocationCallOrder[0],
					).toBeLessThan(destroyA.mock.invocationCallOrder[0])
					expect(
						gatewayClose.mock.invocationCallOrder[0],
					).toBeLessThan(destroyB.mock.invocationCallOrder[0])
					// destroyPlugins() pops from the end of the list, so
					// the LAST-loaded plugin is destroyed FIRST (LIFO).
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
