const sinon = require('sinon')
const rewire = require('rewire')

const mod = rewire('../../lib/jsonStore')

describe('#jsonStore', () => {
  describe('#getFile()', () => {
    const fun = mod.__get__('getFile')
    const config = { file: 'foo', default: 'defaultbar' }
    beforeEach(() => {
      sinon.stub(mod.__get__('utils'), 'joinPath')
      sinon.stub(mod.__get__('jsonfile'), 'readFile')
    })
    afterEach(() => {
      mod.__get__('utils').joinPath.restore()
      mod.__get__('jsonfile').readFile.restore()
    })
    test('uncaught error', () => {
      mod.__get__('jsonfile').readFile.rejects(Error('FOO'))
      return expect(fun(config)).rejects.toThrowError('FOO')
    })

    test('data returned', () => {
      const toReturn = {
        file: 'foo',
        data: 'mybar'
      }
      mod.__get__('jsonfile').readFile.resolves(toReturn.data)
      return expect(fun(config)).resolves.toEqual(toReturn)
    })

    test('no data, return default', () => {
      mod.__get__('jsonfile').readFile.resolves(null)
      return expect(fun(config)).resolves.toEqual({
        file: 'foo',
        data: 'defaultbar'
      })
    })

    test('file not found, return default', () => {
      mod.__get__('jsonfile').readFile.rejects({ code: 'ENOENT' })
      return expect(fun(config)).resolves.toEqual({
        file: 'foo',
        data: 'defaultbar'
      })
    })
  })

  describe('#StorageHelper', () => {
    const StorageHelper = mod.__get__('StorageHelper')
    test('class test', () => {
      const ins = new StorageHelper()
      expect(ins.store).toEqual({})
    })

    describe('#init()', () => {
      let getFile
      beforeEach(() => {
        mod.store = { known: 'no', foobar: 'foo' }
        getFile = mod.__get__('getFile')
        mod.__set__(
          'getFile',
          jest.fn().mockResolvedValue({ file: 'foo', data: 'bar' })
        )
      })
      afterEach(() => {
        mod.__set__('getFile', getFile)
      })
      test('ok', () =>
        expect(mod.init({ file: 'foobar' })).resolves.toEqual({
          known: 'no',
          foobar: 'foo',
          foo: 'bar'
        }))
      test('error', () => {
        mod.__set__('getFile', jest.fn().mockRejectedValue(Error('foo')))
        return expect(mod.init({ file: 'foobar' })).rejects.toThrowError('foo')
      })
    })

    describe('#get()', () => {
      beforeEach(() => {
        mod.store = { known: 'foo' }
      })
      test('known', () => expect(mod.get({ file: 'known' })).toBe('foo'))
      test('unknown', () => expect(() => mod.get({ file: 'unknown' })).toThrowError('Requested file not present in store: unknown'))
    })

    describe('#put()', () => {
      beforeEach(() => {
        sinon.stub(mod.__get__('jsonfile'), 'writeFile')
      })
      afterEach(() => {
        mod.__get__('jsonfile').writeFile.restore()
      })
      test('ok', () => {
        mod.__get__('jsonfile').writeFile.resolves()
        return expect(mod
          .put({ file: 'foo' }, 'bardata')).resolves.toBe('bardata')
      })
      test('error', () => {
        mod.__get__('jsonfile').writeFile.rejects(Error('bar'))
        expect(mod.put({ file: 'foo' })).rejects.toThrowError('bar')
      })
    })
  })
})
