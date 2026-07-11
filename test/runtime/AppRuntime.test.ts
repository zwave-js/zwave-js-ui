import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from 'vitest'
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type {
	AppRuntime as AppRuntimeClass,
	AppRuntimeDeps,
} from '#api/runtime/AppRuntime.ts'
import type JsonStoreModule from '#api/lib/jsonStore.ts'
import type StoreModule from '#api/config/store.ts'
import backupManager from '#api/lib/BackupManager.ts'
import {
	createFakeGateway,
	createFakeZniffer,
	createFakeZwaveClient,
} from '../lib/shared/fakes.ts'
import { cleanupTestEnv, ensureTestEnv } from '../lib/shared/env.ts'

describe('App runtime behavior', () => {
	let AppRuntimeCtor: typeof AppRuntimeClass
	let jsonStore: typeof JsonStoreModule
	let store: typeof StoreModule
	const originalSecret = process.env.SESSION_SECRET

	beforeAll(async () => {
		ensureTestEnv()
		const [runtimeModule, jsonStoreModule, storeModule] = await Promise.all(
			[
				import('#api/runtime/AppRuntime.ts'),
				import('#api/lib/jsonStore.ts'),
				import('#api/config/store.ts'),
			],
		)
		AppRuntimeCtor = runtimeModule.AppRuntime
		jsonStore = jsonStoreModule.default
		store = storeModule.default
		await jsonStore.init(store)
	})

	afterEach(async () => {
		await jsonStore.put(store.settings, store.settings.default)
		if (originalSecret === undefined) {
			delete process.env.SESSION_SECRET
		} else {
			process.env.SESSION_SECRET = originalSecret
		}
	})

	afterAll(() => {
		for (const key of Object.keys(jsonStore.store)) {
			delete jsonStore.store[key]
		}
		cleanupTestEnv()
	})

	function createRuntime(
		deps: Partial<AppRuntimeDeps> = {},
	): AppRuntimeClass {
		return new AppRuntimeCtor({
			getSocketServer: () => {
				throw new Error('Socket server is not used by this test')
			},
			gatewayFactory: {
				create: () => createFakeGateway(),
				dispose: () => undefined,
			},
			...deps,
		})
	}

	it('returns cached and user-provided JavaScript snippets', async () => {
		const { snippetsDir } = await import('#api/config/app.ts')
		mkdirSync(snippetsDir, { recursive: true })
		const snippetPath = path.join(snippetsDir, 'runtime-user-snippet.js')
		const ignoredPath = path.join(snippetsDir, 'runtime-user-snippet.txt')
		writeFileSync(snippetPath, '// user snippet\n')
		writeFileSync(ignoredPath, 'not JavaScript')

		try {
			const runtime = createRuntime({
				gateway: createFakeGateway({
					zwave: createFakeZwaveClient({
						cacheSnippets: [
							{ name: 'cached-snippet', content: '// cached' },
						],
					}),
				}),
			})
			await runtime.loadSnippets()

			const snippets = await runtime.getSnippets()

			expect(snippets).toEqual(
				expect.arrayContaining([
					{ name: 'cached-snippet', content: '// cached' },
					{
						name: 'runtime-user-snippet',
						content: '// user snippet\n',
					},
				]),
			)
			expect(snippets.map(({ name }) => name)).not.toContain(
				'runtime-user-snippet.txt',
			)
		} finally {
			rmSync(snippetPath, { force: true })
			rmSync(ignoredPath, { force: true })
		}
	})

	it('does not duplicate bundled snippets when they are reloaded', async () => {
		const runtime = createRuntime()
		await runtime.loadSnippets()
		const firstLoad = await runtime.getSnippets()

		await runtime.loadSnippets()

		expect(await runtime.getSnippets()).toEqual(firstLoad)
	})

	it('warns when authentication relies on a generated session secret', async () => {
		await jsonStore.put(store.settings, {
			gateway: { authEnabled: true },
		})
		delete process.env.SESSION_SECRET
		const { module: createLogger } = await import('#api/lib/logger.ts')
		const warn = vi.spyOn(createLogger('Runtime'), 'warn')

		try {
			await createRuntime().startGateway({})

			expect(warn).toHaveBeenCalledWith(
				expect.stringContaining('SESSION_SECRET'),
			)
		} finally {
			warn.mockRestore()
		}
	})

	it('does not warn when authentication has an explicit session secret', async () => {
		await jsonStore.put(store.settings, {
			gateway: { authEnabled: true },
		})
		process.env.SESSION_SECRET = 'test-session-secret'
		const { module: createLogger } = await import('#api/lib/logger.ts')
		const warn = vi.spyOn(createLogger('Runtime'), 'warn')

		try {
			await createRuntime().startGateway({})

			expect(warn).not.toHaveBeenCalledWith(
				expect.stringContaining('SESSION_SECRET'),
			)
		} finally {
			warn.mockRestore()
		}
	})

	it('loads configured plugins and destroys them during shutdown', async () => {
		const pluginDir = mkdtempSync(path.join(tmpdir(), 'runtime-plugin-'))
		const marker = path.join(pluginDir, 'events.txt')
		const plugin = path.join(pluginDir, 'observable-plugin.mjs')
		writeFileSync(
			plugin,
			`import { appendFileSync } from 'node:fs'
export default class ObservablePlugin {
	constructor() { appendFileSync(${JSON.stringify(marker)}, 'loaded\\n') }
	async destroy() { appendFileSync(${JSON.stringify(marker)}, 'destroyed\\n') }
}
`,
		)

		try {
			const runtime = createRuntime()
			await runtime.startGateway({
				gateway: { plugins: [plugin] },
			})
			await runtime.shutdown()

			expect(readFileSync(marker, 'utf8')).toBe('loaded\ndestroyed\n')
		} finally {
			rmSync(pluginDir, { recursive: true, force: true })
		}
	})

	it('continues shutdown after the gateway fails to close', async () => {
		const gateway = createFakeGateway({
			close: vi.fn().mockRejectedValue(new Error('gateway close failed')),
		})
		const zniffer = createFakeZniffer({
			close: vi.fn().mockResolvedValue(undefined),
		})
		const closeBackup = vi.spyOn(backupManager, 'close')
		const disposeGatewayFactory = vi.fn()
		const runtime = createRuntime({
			gateway,
			zniffer,
			gatewayFactory: {
				create: () => createFakeGateway(),
				dispose: disposeGatewayFactory,
			},
		})

		try {
			await expect(runtime.shutdown()).resolves.toBeUndefined()

			expect(gateway.close).toHaveBeenCalledOnce()
			expect(disposeGatewayFactory).toHaveBeenCalledOnce()
			expect(zniffer.close).toHaveBeenCalledOnce()
			expect(closeBackup).toHaveBeenCalledOnce()
		} finally {
			closeBackup.mockRestore()
		}
	})

	it('continues loading plugins after one fails', async () => {
		const pluginDir = mkdtempSync(path.join(tmpdir(), 'runtime-plugin-'))
		const marker = path.join(pluginDir, 'loaded.txt')
		const plugin = path.join(pluginDir, 'working-plugin.mjs')
		writeFileSync(
			plugin,
			`import { appendFileSync } from 'node:fs'
export default class WorkingPlugin {
	constructor() { appendFileSync(${JSON.stringify(marker)}, 'loaded') }
}
`,
		)

		try {
			const runtime = createRuntime()
			await runtime.startGateway({
				gateway: {
					plugins: [
						path.join(pluginDir, 'missing-plugin.mjs'),
						plugin,
					],
				},
			})

			expect(readFileSync(marker, 'utf8')).toBe('loaded')
			await runtime.shutdown()
		} finally {
			rmSync(pluginDir, { recursive: true, force: true })
		}
	})

	describe('Home Assistant subsystem lifecycle', () => {
		it('exposes a single process-lifetime coordinator', () => {
			const runtime = createRuntime()
			const ha = runtime.getHomeAssistant()
			// Same instance every call - owned once, for the whole process.
			expect(runtime.getHomeAssistant()).toBe(ha)
			// Owned but dormant until startGateway() runs.
			expect(ha.initialized).toBe(false)
			expect(ha.started).toBe(false)
		})

		it('initializes then starts the subsystem across startGateway()', async () => {
			const runtime = createRuntime()
			const ha = runtime.getHomeAssistant()

			await runtime.startGateway({})

			// initialize() (before the clients) + start() (after gw.start())
			// both ran. The mocked Gateway exposes neither `mqttDiscovery` nor
			// `zwave.zwaveServer`, so the resolvers report both subsystems
			// absent without throwing (partial-presence tolerance).
			expect(ha.initialized).toBe(true)
			expect(ha.started).toBe(true)
			expect(ha.discovery).toBeUndefined()
			expect(ha.server).toBeUndefined()
		})

		it('tolerates being driven with no gateway resolvable (resolvers short-circuit)', () => {
			const runtime = createRuntime()
			const ha = runtime.getHomeAssistant()

			// No gateway set: the AppRuntime-provided resolvers must
			// short-circuit on the absent gateway rather than throw.
			expect(() => {
				ha.initialize()
				ha.start()
			}).not.toThrow()
			expect(ha.started).toBe(true)
			expect(ha.discovery).toBeUndefined()
			expect(ha.server).toBeUndefined()
		})

		it('stops the subsystem BEFORE the gateway is closed on shutdown()', async () => {
			const runtime = createRuntime()
			const order: string[] = []
			const disposeStatus = vi.fn(() => {
				order.push('ha-stop')
			})
			const gw = createFakeGateway({
				close: vi.fn(() => {
					order.push('gateway-close')
					return Promise.resolve(undefined)
				}),
			})
			// Give the resolver a live discovery subsystem to quiesce.
			;(
				gw as unknown as {
					mqttDiscovery: { disposeStatus: () => void }
				}
			).mqttDiscovery = { disposeStatus }
			runtime.setGateway(gw as unknown as Gateway)

			const ha = runtime.getHomeAssistant()
			ha.initialize()
			ha.start()

			await runtime.shutdown()

			// The HA status subscription is quiesced first, THEN the gateway
			// (and its structural discovery/server teardown) is closed.
			expect(disposeStatus).toHaveBeenCalledOnce()
			expect(gw.close).toHaveBeenCalledOnce()
			expect(order).toEqual(['ha-stop', 'gateway-close'])
		})

		it('resolves the CURRENT gateway sub-managers, never a stale capture', () => {
			const runtime = createRuntime()
			const ha = runtime.getHomeAssistant()

			const firstDiscovery = { disposeStatus: vi.fn() }
			const first = createFakeGateway()
			;(first as unknown as { mqttDiscovery: unknown }).mqttDiscovery =
				firstDiscovery
			runtime.setGateway(first as unknown as Gateway)
			expect(ha.discovery).toBe(firstDiscovery)

			// A restart swaps in a brand-new gateway; the coordinator must
			// observe the new sub-manager immediately with no re-bind.
			const secondDiscovery = { disposeStatus: vi.fn() }
			const second = createFakeGateway()
			;(second as unknown as { mqttDiscovery: unknown }).mqttDiscovery =
				secondDiscovery
			runtime.setGateway(second as unknown as Gateway)
			expect(ha.discovery).toBe(secondDiscovery)
		})
	})
})
