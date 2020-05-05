const chai = require('chai')
const sinon = require('sinon')
const rewire = require('rewire')

chai.use(require('chai-as-promised'))
chai.use(require('sinon-chai'))
const should = chai.should()

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

    it('uncaught error', () => {
      mod.__get__('jsonfile').readFile.callsArgWith(1, new Error('FOO'), 'mybar')
      return fun(config).should.eventually.be.rejectedWith(Error, 'FOO')
    })

    it('data returned', () => {
      mod.__get__('jsonfile').readFile.callsArgWith(1, false, 'mybar')
      return fun(config).should.eventually.deep.equal({ file: 'foo', data: 'mybar' })
    })

    it('no data, return default', () => {
      mod.__get__('jsonfile').readFile.callsArgWith(1, false, null)
      return fun(config).should.eventually.deep.equal({ file: 'foo', data: 'defaultbar' })
    })

    it('file not found, return default', () => {
      mod.__get__('jsonfile').readFile.callsArgWith(1, { code: 'ENOENT' }, null)
      return fun(config).should.eventually.deep.equal({ file: 'foo', data: 'defaultbar' })
    })
  })

  describe('#StorageHelper', () => {
    const StorageHelper = mod.__get__('StorageHelper')
    it('class test', () => {
      const ins = new StorageHelper()
      ins.store.should.deep.equal({})
    })

    describe('#init()', () => {
      let getFile
      beforeEach(() => {
        mod.store = { known: 'no', foobar: 'foo' }
        getFile = mod.__get__('getFile')
        mod.__set__('getFile', sinon.stub().resolves({ file: 'foo', data: 'bar' }))
      })
      afterEach(() => {
        mod.__set__('getFile', getFile)
      })
      it('ok', () =>
        mod.init({ file: 'foobar' }).should.eventually.deep.equal({ known: 'no', foobar: 'foo', foo: 'bar' })
      )
      it('error', () => {
        mod.__set__('getFile', sinon.stub().rejects('fo'))
        return mod.init({ file: 'foobar' }).should.eventually.be.rejected
      })
    })

    describe('#get()', () => {
      beforeEach(() => {
        mod.store = { known: 'foo' }
      })
      it('known', () =>
        mod.get({ file: 'known' }).should.equal('foo')
      )
      it('unknown', () =>
        should.Throw(() => mod.get({ file: 'unknown' }), 'Requested file not present in store: unknown')
      )
    })

    describe('#put()', () => {
      beforeEach(() => {
        sinon.stub(mod.__get__('jsonfile'), 'writeFile')
      })
      afterEach(() => {
        mod.__get__('jsonfile').writeFile.restore()
      })
      it('ok', () => {
        mod.__get__('jsonfile').writeFile.callsArgWith(2, null)
        return mod.put({ file: 'foo' }, 'bardata').should.eventually.equal('bardata')
      })
      it('error', () => {
        mod.__get__('jsonfile').writeFile.callsArgWith(2, new Error('bar'))
        mod.put({ file: 'foo' }).should.be.rejectedWith('bar')
      })
    })
  })
})
