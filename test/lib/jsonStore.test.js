const jsonStore = require('../../lib/jsonStore')
const jsonFile = require('jsonfile')
// const utils = require('../../lib/utils')

describe('#jsonStore', () => {
  describe('#getFile()', () => {
    const config = { file: 'foo', default: 'defaultbar' }
    beforeEach(() => {
      jest.mock('jsonfile')
    })
    afterEach(() => {
      jest.restoreAllMocks()
    })
    test('uncaught error', () => {
      jsonFile.readFile.rejects(Error('FOO'))
      return expect(jsonStore._getFile(config)).rejects.toThrowError('FOO')
    })

    test('data returned', () => {
      const toReturn = {
        file: 'foo',
        data: 'mybar'
      }
      jsonFile.readFile.resolves(toReturn.data)
      return expect(jsonStore._getFile(config)).resolves.toEqual(toReturn)
    })

    test('no data, return default', () => {
      jsonFile.readFile.resolves(null)
      return expect(jsonStore._getFile(config)).resolves.toEqual({
        file: 'foo',
        data: 'defaultbar'
      })
    })

    test('file not found, return default', () => {
      jsonFile.readFile.rejects({ code: 'ENOENT' })
      return expect(jsonStore._getFile(config)).resolves.toEqual({
        file: 'foo',
        data: 'defaultbar'
      })
    })
  })

  //   describe('#StorageHelper', () => {
  //     const StorageHelper = mod.__get__('StorageHelper')
  //     test('class test', () => {
  //       const ins = new StorageHelper()
  //       expect(ins.store).toEqual({})
  //     })

  //     describe('#init()', () => {
  //       beforeEach(() => {
  //         mod.store = { known: 'no', foobar: 'foo' }
  //         getFile = mod.__get__('_getFile')
  //         mod.__set__(
  //           '_getFile',
  //           jest.fn().mockResolvedValue({ file: 'foo', data: 'bar' })
  //         )
  //       })
  //       afterEach(() => {
  //         jsonStore._getFile.restore()
  //       })
  //       test('ok', () =>
  //         expect(mod.init({ file: 'foobar' })).resolves.toEqual({
  //           known: 'no',
  //           foobar: 'foo',
  //           foo: 'bar'
  //         }))
  //       test('error', () => {
  //         mod.__set__('_getFile', jest.fn().mockRejectedValue(Error('foo')))
  //         return expect(mod.init({ file: 'foobar' })).rejects.toThrowError('foo')
  //       })
  //     })

  //     describe('#get()', () => {
  //       beforeEach(() => {
  //         jsonStore.store = { known: 'foo' }
  //       })
  //       test('known', () => expect(mod.get({ file: 'known' })).toBe('foo'))
  //       test('unknown', () =>
  //         expect(() => mod.get({ file: 'unknown' })).toThrowError(
  //           'Requested file not present in store: unknown'
  //         ))
  //     })

  //     describe('#put()', () => {
  //       beforeEach(() => {
  //         sinon.stub(mod.__get__('jsonfile'), 'writeFile')
  //       })
  //       afterEach(() => {
  //         mod.__get__('jsonfile').writeFile.restore()
  //       })
  //       test('ok', () => {
  //         mod.__get__('jsonfile').writeFile.resolves()
  //         return expect(mod.put({ file: 'foo' }, 'bardata')).resolves.toBe(
  //           'bardata'
  //         )
  //       })
  //       test('error', () => {
  //         mod.__get__('jsonfile').writeFile.rejects(Error('bar'))
  //         expect(mod.put({ file: 'foo' })).rejects.toThrowError('bar')
  //       })
  //     })
  //   })
})
