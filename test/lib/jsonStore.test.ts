/**
 * jsonStore.ts statically imports storeDir/storeBackupsDir from
 * config/app.ts, which writes a session-secret file to the real repo
 * store/ dir if STORE_DIR isn't set yet - importing the module (even
 * though every test here injects its own readFile/writeFile fakes, with no
 * real disk I/O through StorageHelper itself) is enough to trigger that, so
 * it must be a dynamic import() after ensureTestEnv() (see shared/env.ts)
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import type {
	JFReadOptions,
	JFWriteOptions,
	Path,
	ReadCallback,
	WriteCallback,
} from 'jsonfile'
import type {
	StorageHelper as StorageHelperClass,
	StorageHelperDeps,
	StoreConfig,
} from '#api/lib/jsonStore.ts'
import type { StoreFile } from '#api/config/store.ts'
import { ensureTestEnv, cleanupTestEnv } from './shared/env.ts'

let StorageHelper: typeof StorageHelperClass

type ReadFile = NonNullable<StorageHelperDeps['readFile']>
type WriteFile = NonNullable<StorageHelperDeps['writeFile']>

function toNodeError(error: unknown): NodeJS.ErrnoException {
	if (error instanceof Error) return error
	if (typeof error === 'string') return new Error(error)
	return new Error('Unknown fake file-system error')
}

function createReadFile(getResult: () => Promise<unknown>): ReadFile {
	function readFile(
		_file: Path,
		_options: JFReadOptions,
		callback: ReadCallback,
	): void
	function readFile(_file: Path, callback: ReadCallback): void
	function readFile(_file: Path, _options?: JFReadOptions): Promise<unknown>
	function readFile(
		_file: Path,
		optionsOrCallback?: JFReadOptions | ReadCallback,
		callback?: ReadCallback,
	): void | Promise<unknown> {
		const resolvedCallback =
			typeof optionsOrCallback === 'function'
				? optionsOrCallback
				: callback
		const result = getResult()
		if (resolvedCallback) {
			void result.then(
				(data) => resolvedCallback(null, data),
				(error: unknown) =>
					resolvedCallback(toNodeError(error), undefined),
			)
			return
		}
		return result
	}
	return readFile
}

function readFileResolves(data: unknown): ReadFile {
	return createReadFile(() => Promise.resolve(data))
}

function readFileRejects(error: unknown): ReadFile {
	return createReadFile(() => Promise.reject(toNodeError(error)))
}

function createWriteFile(getResult: () => Promise<void>): WriteFile {
	function writeFile(
		_file: Path,
		_data: unknown,
		_options: JFWriteOptions,
		callback: WriteCallback,
	): void
	function writeFile(
		_file: Path,
		_data: unknown,
		callback: WriteCallback,
	): void
	function writeFile(
		_file: Path,
		_data: unknown,
		_options?: JFWriteOptions,
	): Promise<void>
	function writeFile(
		_file: Path,
		_data: unknown,
		optionsOrCallback?: JFWriteOptions | WriteCallback,
		callback?: WriteCallback,
	): void | Promise<void> {
		const resolvedCallback =
			typeof optionsOrCallback === 'function'
				? optionsOrCallback
				: callback
		const result = getResult()
		if (resolvedCallback) {
			void result.then(
				() => resolvedCallback(null),
				(error: unknown) => resolvedCallback(toNodeError(error)),
			)
			return
		}
		return result
	}
	return writeFile
}

function writeFileResolves(): WriteFile {
	return createWriteFile(() => Promise.resolve())
}

function writeFileRejects(error: unknown): WriteFile {
	return createWriteFile(() => Promise.reject(toNodeError(error)))
}

function createStoreConfig<T>(
	config: StoreFile<T>,
): StoreConfig & { settings: StoreFile<T> } {
	return {
		settings: config,
		scenes: config,
		nodes: config,
		users: config,
		groups: config,
		configurationTemplates: config,
	}
}

async function loadFile<T>(
	mod: StorageHelperClass,
	config: StoreFile<T>,
): Promise<unknown> {
	await mod.init(createStoreConfig(config))
	return mod.store[config.file]
}

beforeAll(async () => {
	ensureTestEnv()
	;({ StorageHelper } = await import('#api/lib/jsonStore.ts'))
})

afterAll(() => {
	cleanupTestEnv()
})

describe('#jsonStore', () => {
	describe('#getFile()', () => {
		const config = { file: 'foo', default: { foo: 'defaultbar' } }

		it("doesn't throw error", async () => {
			const mod = new StorageHelper({
				readFile: readFileRejects(Error('FOO')),
			})
			await expect(loadFile(mod, config)).resolves.toBeDefined()
		})

		it('data returned', async () => {
			const data = { bar: 'mybar', a: 'a', b: 'c' }
			const mod = new StorageHelper({
				readFile: readFileResolves(data),
			})

			await expect(loadFile(mod, config)).resolves.toEqual({
				...data,
				...config.default,
			})
		})

		it('no data, return default', async () => {
			const mod = new StorageHelper({
				readFile: readFileResolves(null),
			})
			await expect(loadFile(mod, config)).resolves.toEqual(config.default)
		})

		it('file not found, return default', async () => {
			const mod = new StorageHelper({
				readFile: readFileRejects(
					Object.assign(new Error('not found'), { code: 'ENOENT' }),
				),
			})
			await expect(loadFile(mod, config)).resolves.toEqual(config.default)
		})
	})

	describe('#StorageHelper', () => {
		const fakeStore = createStoreConfig({
			file: 'settings.json',
			default: {},
		})
		it('class test', () => {
			const jsonStore = new StorageHelper()
			expect(jsonStore.store).to.deep.equal({})
		})

		describe('#init()', () => {
			it('ok', async () => {
				const data = { foo: 'bar' }
				const mod = new StorageHelper({
					readFile: readFileResolves(data),
				})

				await mod.init(fakeStore)

				expect(mod.store).to.deep.equal({
					[fakeStore.settings.file]: data,
				})
			})

			it('error', async () => {
				const mod = new StorageHelper({
					readFile: readFileRejects(Error('foo')),
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
					readFile: readFileResolves('bar'),
				})
				await mod.init(fakeStore)
			})

			it('known', () =>
				expect(mod.get(fakeStore.settings)).to.equal(
					fakeStore.settings.default,
				))
			it('unknown', () =>
				expect(() => mod.get({ file: 'unknown', default: {} })).toThrow(
					'Requested file not present in store: unknown',
				))
		})

		describe('#put()', () => {
			it('ok', async () => {
				const mod = new StorageHelper({
					writeFile: writeFileResolves(),
				})

				await expect(
					mod.put({ file: 'foo', default: '' }, 'bardata'),
				).resolves.toBe('bardata')
			})
			it('error', async () => {
				const mod = new StorageHelper({
					writeFile: writeFileRejects(Error('foo')),
				})

				await expect(
					mod.put({ file: 'foo', default: '' }, ''),
				).rejects.toThrow('foo')
			})
		})
	})
})
