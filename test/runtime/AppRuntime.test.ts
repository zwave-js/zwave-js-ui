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
	existsSync,
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

	it('destroys plugins after an earlier shutdown step fails', async () => {
		const pluginDir = mkdtempSync(path.join(tmpdir(), 'runtime-plugin-'))
		const marker = path.join(pluginDir, 'events.txt')
		const plugin = path.join(pluginDir, 'observable-plugin.mjs')
		// A gateway whose close rejects is an earlier teardown step failing; the
		// plugin must still be destroyed afterwards (errors are aggregated, not
		// fatal), proving cleanup continues past a failed step
		const gateway = createFakeGateway({
			close: vi.fn().mockRejectedValue(new Error('gateway close failed')),
		})
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
			const runtime = createRuntime({
				gatewayFactory: {
					create: () => gateway,
					dispose: () => undefined,
				},
			})
			await runtime.startGateway({
				gateway: { plugins: [plugin] },
			})
			await runtime.shutdown()

			expect(readFileSync(marker, 'utf8')).toBe('loaded\ndestroyed\n')
			expect(gateway.close).toHaveBeenCalledOnce()
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

	it('clears the previous Zniffer when settings omit it', () => {
		const runtime = createRuntime({ zniffer: createFakeZniffer() })

		runtime.startZniffer(undefined)

		expect(runtime.zniffer).toBeUndefined()
		expect(() => runtime.ensureZniffer()).toThrow(
			'Zniffer is not initialized',
		)
	})

	it('closes collaborators once during concurrent shutdowns', async () => {
		let releaseGateway: (() => void) | undefined
		const gatewayClosed = new Promise<void>((resolve) => {
			releaseGateway = resolve
		})
		const gateway = createFakeGateway({
			close: vi.fn(() => gatewayClosed),
		})
		const disposeGatewayFactory = vi.fn()
		const runtime = createRuntime({
			gateway,
			gatewayFactory: {
				create: () => createFakeGateway(),
				dispose: disposeGatewayFactory,
			},
		})

		const first = runtime.shutdown()
		const second = runtime.shutdown()
		releaseGateway?.()
		await Promise.all([first, second])

		expect(gateway.close).toHaveBeenCalledOnce()
		expect(disposeGatewayFactory).toHaveBeenCalledOnce()
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

	it('closes the gateway when a boot-time start fails', async () => {
		const failure = new Error('gateway start failed')
		const close = vi.fn(() => Promise.resolve(undefined))
		const gateway = createFakeGateway({
			start: vi.fn(() => Promise.reject(failure)),
			close,
		})
		const runtime = createRuntime({
			gatewayFactory: { create: () => gateway, dispose: vi.fn() },
		})

		// the original startup error propagates to the caller...
		await expect(runtime.startGateway({})).rejects.toBe(failure)

		// ...and the failed generation is cleaned up so nothing leaks past it:
		// the gateway is closed
		expect(close).toHaveBeenCalled()
	})

	it('completes shutdown while a gateway start is still hanging, without resurrecting the cancelled generation', async () => {
		const pluginDir = mkdtempSync(path.join(tmpdir(), 'runtime-plugin-'))
		const marker = path.join(pluginDir, 'loaded.txt')
		const plugin = path.join(pluginDir, 'late-plugin.mjs')
		// A plugin whose constructor writes a marker: it loads only if the
		// cancelled generation's continuation runs past the hung start, so its
		// ABSENCE proves the cancellation actually bailed the continuation
		writeFileSync(
			plugin,
			`import { appendFileSync } from 'node:fs'
export default class LatePlugin {
	constructor() { appendFileSync(${JSON.stringify(marker)}, 'loaded') }
}
`,
		)
		let releaseStart = (): void => {}
		const startHang = new Promise<void>((resolve) => {
			releaseStart = resolve
		})
		const close = vi.fn(() => Promise.resolve(undefined))
		const gateway = createFakeGateway({
			start: vi.fn(() => startHang),
			close,
		})
		const runtime = createRuntime({
			gatewayFactory: { create: () => gateway, dispose: vi.fn() },
		})

		try {
			// the start never settles on its own, so the teardown must not block
			// on it; closing the gateway is what unblocks a real hung start
			const starting = runtime.startGateway({
				gateway: { plugins: [plugin] },
			})
			await runtime.shutdown()

			expect(close).toHaveBeenCalled()

			// releasing the hung start lets its continuation observe the
			// cancelled generation and finish without throwing or resurrecting
			// the gateway — and crucially without loading the plugin
			releaseStart()
			await expect(starting).resolves.toBeUndefined()

			// The plugin was never loaded: the cancelled continuation bailed
			// before plugin loading. If cancellation were a no-op, the marker
			// would exist
			expect(existsSync(marker)).toBe(false)
		} finally {
			rmSync(pluginDir, { recursive: true, force: true })
		}
	})

	it('runs the gateway close and plugin destroy once under concurrent teardowns', async () => {
		let releaseClose = (): void => {}
		const closeGate = new Promise<void>((resolve) => {
			releaseClose = resolve
		})
		const close = vi.fn(() => closeGate)
		const gateway = createFakeGateway({ close })
		const runtime = createRuntime({
			gateway,
			gatewayFactory: {
				create: () => createFakeGateway(),
				dispose: vi.fn(),
			},
		})

		// Two teardowns overlap (a settings restart racing a graceful shutdown):
		// gate the gateway close so both callers are in flight before either
		// finishes, then release
		const first = runtime.teardownGateway({ requireGateway: true })
		const second = runtime.teardownGateway()
		releaseClose()
		await Promise.all([first, second])

		// The shared in-flight teardown collapses both callers, so the gateway
		// close runs exactly once
		expect(close).toHaveBeenCalledOnce()
	})
})
