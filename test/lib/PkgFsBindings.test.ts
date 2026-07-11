import { describe, it, expect, vi, beforeEach } from 'vitest'

const nodeFsMock = {
	readFile: vi.fn(),
	writeFile: vi.fn(),
	copyFile: vi.fn(),
	open: vi.fn(),
	readDir: vi.fn(),
	stat: vi.fn(),
	ensureDir: vi.fn(),
	deleteDir: vi.fn(),
	makeTempDir: vi.fn(),
}

vi.mock('@zwave-js/core/bindings/fs/node', () => ({
	fs: nodeFsMock,
}))

const { PkgFsBindings } = await import('../../api/lib/PkgFsBindings.ts')

describe('#PkgFsBindings', () => {
	let bindings: InstanceType<typeof PkgFsBindings>

	beforeEach(() => {
		vi.clearAllMocks()
		bindings = new PkgFsBindings()
	})

	describe('#readFile()', () => {
		it('remaps paths under /config to the pkg-embedded config dir', async () => {
			nodeFsMock.readFile.mockResolvedValue(new Uint8Array())
			await bindings.readFile('/config/foo.json')

			expect(nodeFsMock.readFile).toHaveBeenCalledTimes(1)
			const calledWith = nodeFsMock.readFile.mock.calls[0][0] as string
			expect(calledWith).not.toBe('/config/foo.json')
			expect(
				calledWith.endsWith(
					`node_modules/@zwave-js/config/config/foo.json`,
				),
			).toBe(true)
		})

		it('leaves other paths untouched', async () => {
			nodeFsMock.readFile.mockResolvedValue(new Uint8Array())
			await bindings.readFile('/tmp/foo.json')

			expect(nodeFsMock.readFile).toHaveBeenCalledWith('/tmp/foo.json')
		})
	})

	describe('#writeFile()', () => {
		it('is a no-op for paths under /config (readonly pkg assets)', async () => {
			await bindings.writeFile('/config/foo.json', new Uint8Array())

			expect(nodeFsMock.writeFile).not.toHaveBeenCalled()
		})

		it('delegates to the underlying fs for other paths', async () => {
			const data = new Uint8Array([1, 2, 3])
			await bindings.writeFile('/tmp/foo.json', data)

			expect(nodeFsMock.writeFile).toHaveBeenCalledWith(
				'/tmp/foo.json',
				data,
			)
		})
	})

	describe('#copyFile()', () => {
		it('is a no-op when the destination is under /config', async () => {
			await bindings.copyFile('/tmp/foo.json', '/config/foo.json')

			expect(nodeFsMock.copyFile).not.toHaveBeenCalled()
		})

		it('remaps a source path under /config to the pkg-embedded config dir', async () => {
			await bindings.copyFile('/config/foo.json', '/tmp/foo.json')

			expect(nodeFsMock.copyFile).toHaveBeenCalledTimes(1)
			const [source, dest] = nodeFsMock.copyFile.mock.calls[0]
			expect(
				source.endsWith(
					`node_modules/@zwave-js/config/config/foo.json`,
				),
			).toBe(true)
			expect(dest).toBe('/tmp/foo.json')
		})

		it('delegates unchanged paths to the underlying fs', async () => {
			await bindings.copyFile('/tmp/a.json', '/tmp/b.json')

			expect(nodeFsMock.copyFile).toHaveBeenCalledWith(
				'/tmp/a.json',
				'/tmp/b.json',
			)
		})
	})

	describe('#ensureDir()', () => {
		it('is a no-op for paths under /config', async () => {
			await bindings.ensureDir('/config/sub')

			expect(nodeFsMock.ensureDir).not.toHaveBeenCalled()
		})

		it('delegates to the underlying fs for other paths', async () => {
			await bindings.ensureDir('/tmp/sub')

			expect(nodeFsMock.ensureDir).toHaveBeenCalledWith('/tmp/sub')
		})
	})

	describe('#deleteDir()', () => {
		it('is a no-op for paths under /config', async () => {
			await bindings.deleteDir('/config/sub')

			expect(nodeFsMock.deleteDir).not.toHaveBeenCalled()
		})

		it('delegates to the underlying fs for other paths', async () => {
			await bindings.deleteDir('/tmp/sub')

			expect(nodeFsMock.deleteDir).toHaveBeenCalledWith('/tmp/sub')
		})
	})

	describe('#open()', () => {
		it('throws when opening a /config path for writing', () => {
			expect(() =>
				bindings.open('/config/foo.json', {
					read: false,
					write: true,
					create: false,
					truncate: false,
				}),
			).toThrow(/not writable/)

			expect(nodeFsMock.open).not.toHaveBeenCalled()
		})

		it('remaps a /config path for reading', async () => {
			nodeFsMock.open.mockResolvedValue({})
			await bindings.open('/config/foo.json', {
				read: true,
				write: false,
				create: false,
				truncate: false,
			})

			expect(nodeFsMock.open).toHaveBeenCalledTimes(1)
			const calledWith = nodeFsMock.open.mock.calls[0][0] as string
			expect(
				calledWith.endsWith(
					`node_modules/@zwave-js/config/config/foo.json`,
				),
			).toBe(true)
		})
	})

	describe('#readDir()', () => {
		it('remaps paths under /config', async () => {
			nodeFsMock.readDir.mockResolvedValue([])
			await bindings.readDir('/config/sub')

			const calledWith = nodeFsMock.readDir.mock.calls[0][0] as string
			expect(
				calledWith.endsWith(`node_modules/@zwave-js/config/config/sub`),
			).toBe(true)
		})
	})

	describe('#stat()', () => {
		it('remaps paths under /config', async () => {
			nodeFsMock.stat.mockResolvedValue({})
			await bindings.stat('/config/foo.json')

			const calledWith = nodeFsMock.stat.mock.calls[0][0] as string
			expect(
				calledWith.endsWith(
					`node_modules/@zwave-js/config/config/foo.json`,
				),
			).toBe(true)
		})
	})

	describe('#makeTempDir()', () => {
		it('delegates directly to the underlying fs', async () => {
			nodeFsMock.makeTempDir.mockResolvedValue('/tmp/xyz')
			await expect(bindings.makeTempDir('zwave-')).resolves.toBe(
				'/tmp/xyz',
			)
			expect(nodeFsMock.makeTempDir).toHaveBeenCalledWith('zwave-')
		})
	})
})
