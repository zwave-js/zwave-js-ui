// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'chai'.
const chai = require('chai')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'sinon'.
const sinon = require('sinon')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'rewire'.
const rewire = require('rewire')

chai.use(require('chai-as-promised'))
chai.use(require('sinon-chai'))
const should = chai.should()

// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'mod'.
const mod = rewire('../../lib/jsonStore')

// @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
describe('#jsonStore', () => {
  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('#getFile()', () => {
    const fun = mod.__get__('getFile')
    const config = { file: 'foo', default: 'defaultbar' }
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'beforeEach'.
    beforeEach(() => {
      sinon.stub(mod.__get__('utils'), 'joinPath')
      sinon.stub(mod.__get__('jsonfile'), 'readFile')
    })
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'afterEach'.
    afterEach(() => {
      mod.__get__('utils').joinPath.restore()
      mod.__get__('jsonfile').readFile.restore()
    })

    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('uncaught error', () => {
      mod
        .__get__('jsonfile')
        .readFile.callsArgWith(1, new Error('FOO'), 'mybar')
      return fun(config).should.eventually.be.rejectedWith(Error, 'FOO')
    })

    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('data returned', () => {
      mod.__get__('jsonfile').readFile.callsArgWith(1, false, 'mybar')
      return fun(config).should.eventually.deep.equal({
        file: 'foo',
        data: 'mybar'
      })
    })

    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('no data, return default', () => {
      mod.__get__('jsonfile').readFile.callsArgWith(1, false, null)
      return fun(config).should.eventually.deep.equal({
        file: 'foo',
        data: 'defaultbar'
      })
    })

    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('file not found, return default', () => {
      mod.__get__('jsonfile').readFile.callsArgWith(1, { code: 'ENOENT' }, null)
      return fun(config).should.eventually.deep.equal({
        file: 'foo',
        data: 'defaultbar'
      })
    })
  })

  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('#StorageHelper', () => {
    const StorageHelper = mod.__get__('StorageHelper')
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('class test', () => {
      const ins = new StorageHelper()
      ins.store.should.deep.equal({})
    })

    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
    describe('#init()', () => {
      let getFile: any
      // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'beforeEach'.
      beforeEach(() => {
        mod.store = { known: 'no', foobar: 'foo' }
        getFile = mod.__get__('getFile')
        mod.__set__(
          'getFile',
          sinon.stub().resolves({ file: 'foo', data: 'bar' })
        )
      })
      // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'afterEach'.
      afterEach(() => {
        mod.__set__('getFile', getFile)
      })
      // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
      it('ok', () =>
        mod.init({ file: 'foobar' }).should.eventually.deep.equal({
          known: 'no',
          foobar: 'foo',
          foo: 'bar'
        }))
      // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
      it('error', () => {
        mod.__set__('getFile', sinon.stub().rejects('fo'))
        return mod.init({ file: 'foobar' }).should.eventually.be.rejected
      })
    })

    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
    describe('#get()', () => {
      // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'beforeEach'.
      beforeEach(() => {
        mod.store = { known: 'foo' }
      })
      // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
      it('known', () => mod.get({ file: 'known' }).should.equal('foo'))
      // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
      it('unknown', () =>
        should.Throw(
          () => mod.get({ file: 'unknown' }),
          'Requested file not present in store: unknown'
        ))
    })

    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
    describe('#put()', () => {
      // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'beforeEach'.
      beforeEach(() => {
        sinon.stub(mod.__get__('jsonfile'), 'writeFile')
      })
      // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'afterEach'.
      afterEach(() => {
        mod.__get__('jsonfile').writeFile.restore()
      })
      // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
      it('ok', () => {
        mod.__get__('jsonfile').writeFile.callsArgWith(2, null)
        return mod
          .put({ file: 'foo' }, 'bardata')
          .should.eventually.equal('bardata')
      })
      // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
      it('error', () => {
        mod.__get__('jsonfile').writeFile.callsArgWith(2, new Error('bar'))
        mod.put({ file: 'foo' }).should.be.rejectedWith('bar')
      })
    })
  })
})
