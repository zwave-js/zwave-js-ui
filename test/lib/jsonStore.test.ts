/**
 * `api/lib/jsonStore.ts` statically imports `storeDir`/`storeBackupsDir`
 * from `../config/app.ts`, whose module-evaluation-time
 * `resolveSessionSecret()` call falls back to the REAL repository `store/`
 * directory and writes a `.session-secret` file there whenever `STORE_DIR`
 * isn't already set. A top-level `import { StorageHelper } from
 * '../../api/lib/jsonStore.ts'` is hoisted and evaluated before any of this
 * file's own code (including a `beforeAll`) could isolate that env var, so
 * it must be a dynamic `import()` performed AFTER `ensureTestEnv()` - see
 * `http/env.ts` for the full rationale. Every test below constructs its own
 * `StorageHelper` with injected `readFile`/`writeFile` fakes (no real disk
 * I/O through `StorageHelper` itself), but merely importing the module is
 * enough to trigger the real repo write, so isolation is required
 * regardless.
 */
import {
	describe,
	it,
	expect,
	beforeEach,
	beforeAll,
	afterAll,
	vi,
} from 'vitest'
import type { StorageHelper as StorageHelperClass } from '../../api/lib/jsonStore.ts'
import type { StoreFile, StoreKeys } from '../../api/config/store.ts'
import { ensureTestEnv, cleanupTestEnv } from './http/env.ts'

let StorageHelper: typeof StorageHelperClass

beforeAll(async () => {
	ensureTestEnv()
	;({ StorageHelper } = await import('../../api/lib/jsonStore.ts'))
})

afterAll(() => {
	cleanupTestEnv()
})

describe('#jsonStore', () => {
	describe('#getFile()', () => {
		const config = { file: 'foo', default: { foo: 'defaultbar' } }

		it("doesn't throw error", async () => {
			const mod = new StorageHelper({
				readFile: vi.fn().mockRejectedValue(Error('FOO')) as any,
			})
			await expect(mod._getFile(config)).resolves.toBeDefined()
		})

		it('data returned', async () => {
			const toReturn = {
				file: 'foo',
				data: { bar: 'mybar', a: 'a', b: 'c' },
			}
			const mod = new StorageHelper({
				readFile: vi.fn().mockResolvedValue(toReturn.data) as any,
			})

			await expect(mod._getFile(config)).resolves.toEqual({
				file: toReturn.file,
				data: { ...toReturn.data, ...config.default },
			})
		})

		it('no data, return default', async () => {
			const mod = new StorageHelper({
				readFile: vi.fn().mockResolvedValue(null) as any,
			})
			await expect(mod._getFile(config)).resolves.toEqual({
				file: 'foo',
				data: config.default,
			})
		})

		it('file not found, return default', async () => {
			const mod = new StorageHelper({
				readFile: vi.fn().mockRejectedValue({ code: 'ENOENT' }) as any,
			})
			await expect(mod._getFile(config)).resolves.toEqual({
				file: 'foo',
				data: config.default,
			})
		})
	})

	describe('#StorageHelper', () => {
		const fakeStore = {
			settings: { file: 'settings.json', default: {} },
		} as Record<StoreKeys, StoreFile>
		it('class test', () => {
			const jsonStore = new StorageHelper()
			expect(jsonStore.store).to.deep.equal({})
		})

		describe('#init()', () => {
			it('ok', async () => {
				const data = { foo: 'bar' }
				const mod = new StorageHelper({
					readFile: vi.fn().mockResolvedValue(data) as any,
				})

				await mod.init(fakeStore)

				expect(mod.store).to.deep.equal({
					[fakeStore.settings.file]: data,
				})
			})

			it('error', async () => {
				const mod = new StorageHelper({
					readFile: vi.fn().mockRejectedValue(Error('foo')) as any,
				})

				await mod.init(fakeStore)

				expect(mod.store).to.deep.equal({
					[fakeStore.settings.file]: fakeStore.settings.default,
				})
			})
		})

		describe('#get()', () => {
			let mod: StorageHelperClass

			beforeEach(async () => {
				mod = new StorageHelper({
					readFile: vi.fn().mockResolvedValue('bar') as any,
				})
				await mod.init(fakeStore)
			})

			it('known', () =>
				expect(
					mod.get({ file: fakeStore.settings.file } as StoreFile),
				).to.equal(fakeStore.settings.default))
			it('unknown', () => {
				try {
					mod.get({ file: 'unknown' } as StoreFile)
				} catch (error) {
					return expect((error as Error).message).to.equal(
						'Requested file not present in store: unknown',
					)
				}
			})
		})

		describe('#put()', () => {
			it('ok', async () => {
				const mod = new StorageHelper({
					writeFile: vi.fn().mockResolvedValue('bar') as any,
				})

				await expect(
					mod.put({ file: 'foo' } as StoreFile, 'bardata'),
				).resolves.toBe('bardata')
			})
			it('error', async () => {
				const mod = new StorageHelper({
					writeFile: vi.fn().mockRejectedValue(Error('foo')) as any,
				})

				await expect(
					mod.put({ file: 'foo' } as StoreFile, ''),
				).rejects.toThrow('foo')
			})
		})
	})
})
