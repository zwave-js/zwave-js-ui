/* eslint-disable @typescript-eslint/no-floating-promises */
import chai, { expect } from 'chai'
import proxyquire from 'proxyquire'
import { StorageHelper } from '../../api/lib/jsonStore'
import sinon from 'sinon'
import { StoreFile, StoreKeys } from '../../api/config/store'
import sinonChai from 'sinon-chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(sinonChai)
chai.use(chaiAsPromised)

describe('#jsonStore', () => {
	describe('#getFile()', () => {
		const config = { file: 'foo', default: { foo: 'defaultbar' } }

		it("doesn't throw error", () => {
			const mod: StorageHelper = proxyquire(
				'../../api/lib/jsonStore.ts',
				{
					jsonfile: {
						readFile: sinon.stub().rejects(Error('FOO')),
					},
				},
			).default
			return expect(mod['_getFile'](config)).to.not.be.rejected
		})

		it('data returned', () => {
			const toReturn = {
				file: 'foo',
				data: { bar: 'mybar', a: 'a', b: 'c' },
			}
			const mod: StorageHelper = proxyquire(
				'../../api/lib/jsonStore.ts',
				{
					jsonfile: {
						readFile: sinon.stub().resolves(toReturn.data),
					},
				},
			).default

			return expect(mod['_getFile'](config)).to.eventually.deep.equal({
				file: toReturn.file,
				data: { ...toReturn.data, ...config.default },
			})
		})

		it('no data, return default', () => {
			const mod: StorageHelper = proxyquire(
				'../../api/lib/jsonStore.ts',
				{
					jsonfile: {
						readFile: sinon.stub().resolves(null),
					},
				},
			).default
			return expect(mod['_getFile'](config)).to.eventually.deep.equal({
				file: 'foo',
				data: config.default,
			})
		})

		it('file not found, return default', () => {
			const mod: StorageHelper = proxyquire(
				'../../api/lib/jsonStore.ts',
				{
					jsonfile: {
						readFile: sinon.stub().rejects({ code: 'ENOENT' }),
					},
				},
			).default
			return expect(mod['_getFile'](config)).to.eventually.deep.equal({
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
				const mod: StorageHelper = proxyquire(
					'../../api/lib/jsonStore.ts',
					{
						jsonfile: {
							readFile: sinon.stub().resolves(data),
						},
					},
				).default

				await mod.init(fakeStore)

				return expect(mod.store).to.deep.equal({
					[fakeStore.settings.file]: data,
				})
			})

			it('error', async () => {
				const mod: StorageHelper = proxyquire(
					'../../api/lib/jsonStore.ts',
					{
						jsonfile: {
							readFile: sinon.stub().rejects(Error('foo')),
						},
					},
				).default

				await mod.init(fakeStore)

				return expect(mod.store).to.deep.equal({
					[fakeStore.settings.file]: fakeStore.settings.default,
				})
			})
		})

		describe('#get()', () => {
			const mod: StorageHelper = proxyquire(
				'../../api/lib/jsonStore.ts',
				{
					jsonfile: {
						readFile: sinon.stub().resolves('bar'),
					},
				},
			).default

			beforeEach(async () => await mod.init(fakeStore))

			it('known', () =>
				expect(
					mod.get({ file: fakeStore.settings.file } as StoreFile),
				).to.equal(fakeStore.settings.default))
			it('unknown', () => {
				try {
					mod.get({ file: 'unknown' } as StoreFile)
				} catch (error) {
					return expect(error.message).to.equal(
						'Requested file not present in store: unknown',
					)
				}
			})
		})

		describe('#put()', () => {
			it('ok', () => {
				const mod: StorageHelper = proxyquire(
					'../../api/lib/jsonStore.ts',
					{
						jsonfile: {
							writeFile: sinon.stub().resolves('bar'),
						},
					},
				).default

				return expect(
					mod.put({ file: 'foo' } as StoreFile, 'bardata'),
				).to.eventually.equal('bardata')
			})
			it('error', () => {
				const mod: StorageHelper = proxyquire(
					'../../api/lib/jsonStore.ts',
					{
						jsonfile: {
							writeFile: sinon.stub().rejects(Error('foo')),
						},
					},
				).default

				return expect(
					mod.put({ file: 'foo' } as StoreFile, ''),
				).to.be.rejectedWith('foo')
			})
		})
	})
})
