/* eslint-disable @typescript-eslint/no-floating-promises */
import chai, { expect } from 'chai'
import proxyquire from 'proxyquire'
import { StorageHelper } from '../../lib/jsonStore'
import sinon from 'sinon'
import { StoreFile, StoreKeys } from '../../config/store'

// eslint-disable-next-line @typescript-eslint/no-var-requires
chai.use(require('chai-as-promised'))
// eslint-disable-next-line @typescript-eslint/no-var-requires
chai.use(require('sinon-chai'))

describe('#jsonStore', () => {
	describe('#getFile()', () => {
		const config = { file: 'foo', default: 'defaultbar' }

		it('uncaught error', () => {
			const mod: StorageHelper = proxyquire('../../lib/jsonStore.ts', {
				jsonfile: {
					readFile: sinon.stub().rejects(Error('FOO')),
				},
			}).default
			return expect(mod['_getFile'](config)).to.be.rejectedWith(
				Error,
				'FOO'
			)
		})

		it('data returned', () => {
			const toReturn = {
				file: 'foo',
				data: 'mybar',
			}
			const mod: StorageHelper = proxyquire('../../lib/jsonStore.ts', {
				jsonfile: {
					readFile: sinon.stub().resolves(toReturn.data),
				},
			}).default

			return expect(mod['_getFile'](config)).to.eventually.deep.equal(
				toReturn
			)
		})

		it('no data, return default', () => {
			const mod: StorageHelper = proxyquire('../../lib/jsonStore.ts', {
				jsonfile: {
					readFile: sinon.stub().resolves(null),
				},
			}).default
			return expect(mod['_getFile'](config)).to.eventually.deep.equal({
				file: 'foo',
				data: 'defaultbar',
			})
		})

		it('file not found, return default', () => {
			const mod: StorageHelper = proxyquire('../../lib/jsonStore.ts', {
				jsonfile: {
					readFile: sinon.stub().rejects({ code: 'ENOENT' }),
				},
			}).default
			return expect(mod['_getFile'](config)).to.eventually.deep.equal({
				file: 'foo',
				data: 'defaultbar',
			})
		})
	})

	describe('#StorageHelper', () => {
		const fakeStore = {
			foo: { file: 'foo', default: {} },
		} as unknown as Record<StoreKeys, StoreFile>
		it('class test', () => {
			const jsonStore = new StorageHelper()
			return expect(jsonStore.store).to.deep.equal({})
		})

		describe('#init()', () => {
			it('ok', async () => {
				const mod: StorageHelper = proxyquire(
					'../../lib/jsonStore.ts',
					{
						jsonfile: {
							readFile: sinon.stub().resolves('bar'),
						},
					}
				).default

				await mod.init(fakeStore)

				return expect(mod.store).to.deep.equal({
					foo: 'bar',
				})
			})

			it('error', () => {
				const mod: StorageHelper = proxyquire(
					'../../lib/jsonStore.ts',
					{
						jsonfile: {
							readFile: sinon.stub().rejects(Error('foo')),
						},
					}
				).default

				return expect(mod.init(fakeStore)).to.be.rejectedWith('foo')
			})
		})

		describe('#get()', () => {
			const mod: StorageHelper = proxyquire('../../lib/jsonStore.ts', {
				jsonfile: {
					readFile: sinon.stub().resolves('bar'),
				},
			}).default

			beforeEach(async () => await mod.init(fakeStore))

			it('known', () =>
				expect(mod.get({ file: 'foo' } as StoreFile)).to.equal('bar'))
			it('unknown', () => {
				try {
					mod.get({ file: 'unknown' } as StoreFile)
				} catch (error) {
					return expect(error.message).to.equal(
						'Requested file not present in store: unknown'
					)
				}
			})
		})

		describe('#put()', () => {
			it('ok', () => {
				const mod: StorageHelper = proxyquire(
					'../../lib/jsonStore.ts',
					{
						jsonfile: {
							writeFile: sinon.stub().resolves('bar'),
						},
					}
				).default

				return expect(
					mod.put({ file: 'foo' } as StoreFile, 'bardata')
				).to.eventually.equal('bardata')
			})
			it('error', () => {
				const mod: StorageHelper = proxyquire(
					'../../lib/jsonStore.ts',
					{
						jsonfile: {
							writeFile: sinon.stub().rejects(Error('foo')),
						},
					}
				).default

				return expect(
					mod.put({ file: 'foo' } as StoreFile, '')
				).to.be.rejectedWith('foo')
			})
		})
	})
})
