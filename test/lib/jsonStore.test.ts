import chai, { expect } from 'chai'
import { StorageHelper } from '../../api/lib/jsonStore.ts'
import sinon from 'sinon'
import type { StoreFile, StoreKeys } from '../../api/config/store.ts'
import sinonChai from 'sinon-chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(sinonChai)
chai.use(chaiAsPromised)

describe('#jsonStore', () => {
	describe('#getFile()', () => {
		const config = { file: 'foo', default: { foo: 'defaultbar' } }

		it("doesn't throw error", () => {
			const mod = new StorageHelper({
				readFile: sinon.stub().rejects(Error('FOO')) as any,
			})
			return expect(mod._getFile(config)).to.not.be.rejected
		})

		it('data returned', () => {
			const toReturn = {
				file: 'foo',
				data: { bar: 'mybar', a: 'a', b: 'c' },
			}
			const mod = new StorageHelper({
				readFile: sinon.stub().resolves(toReturn.data) as any,
			})

			return expect(mod._getFile(config)).to.eventually.deep.equal({
				file: toReturn.file,
				data: { ...toReturn.data, ...config.default },
			})
		})

		it('no data, return default', () => {
			const mod = new StorageHelper({
				readFile: sinon.stub().resolves(null) as any,
			})
			return expect(mod._getFile(config)).to.eventually.deep.equal({
				file: 'foo',
				data: config.default,
			})
		})

		it('file not found, return default', () => {
			const mod = new StorageHelper({
				readFile: sinon.stub().rejects({ code: 'ENOENT' }) as any,
			})
			return expect(mod._getFile(config)).to.eventually.deep.equal({
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
			return expect(jsonStore.store).to.deep.equal({})
		})

		describe('#init()', () => {
			it('ok', async () => {
				const data = { foo: 'bar' }
				const mod = new StorageHelper({
					readFile: sinon.stub().resolves(data) as any,
				})

				await mod.init(fakeStore)

				return expect(mod.store).to.deep.equal({
					[fakeStore.settings.file]: data,
				})
			})

			it('error', async () => {
				const mod = new StorageHelper({
					readFile: sinon.stub().rejects(Error('foo')) as any,
				})

				await mod.init(fakeStore)

				return expect(mod.store).to.deep.equal({
					[fakeStore.settings.file]: fakeStore.settings.default,
				})
			})
		})

		describe('#get()', () => {
			const mod = new StorageHelper({
				readFile: sinon.stub().resolves('bar') as any,
			})

			beforeEach(async () => await mod.init(fakeStore))

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
			it('ok', () => {
				const mod = new StorageHelper({
					writeFile: sinon.stub().resolves('bar') as any,
				})

				return expect(
					mod.put({ file: 'foo' } as StoreFile, 'bardata'),
				).to.eventually.equal('bardata')
			})
			it('error', () => {
				const mod = new StorageHelper({
					writeFile: sinon.stub().rejects(Error('foo')) as any,
				})

				return expect(
					mod.put({ file: 'foo' } as StoreFile, ''),
				).to.be.rejectedWith('foo')
			})
		})
	})
})
