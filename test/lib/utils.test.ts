// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'chai'.
const chai = require('chai')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'rewire'.
const rewire = require('rewire')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'sinon'.
const sinon = require('sinon')
chai.use(require('sinon-chai'))
chai.should()

// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'mod'.
const mod = rewire('../../lib/utils')

// @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
describe('#utils', () => {
  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('#getPath()', () => {
    mod.__set__('appRoot', { toString: () => 'foo' })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('write && process.pkg', () => {
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'pkg' does not exist on type 'Process'.
      process.pkg = true
      mod.getPath(true).should.equal(process.cwd())
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('write && !process.pkg', () => {
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'pkg' does not exist on type 'Process'.
      process.pkg = false
      mod.getPath(true).should.equal('foo')
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('!write && process.pkg', () => {
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'pkg' does not exist on type 'Process'.
      process.pkg = true
      mod.getPath(false).should.equal('foo')
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('!write && !process.pkg', () => {
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'pkg' does not exist on type 'Process'.
      process.pkg = false
      mod.getPath(false).should.equal('foo')
    })
  })
  // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
  describe('#joinPath()', () => {
    let path: any
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'before'.
    before(() => {
      path = { join: sinon.stub() }
      mod.__set__('path', path)
      sinon.stub(mod, 'getPath').returns('foo')
    })
    // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'after'.
    after(() => {
      mod.getPath.restore()
    })

    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('zero length', () => {
      mod.joinPath()
      return path.join.should.have.been.calledWith()
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('1 length', () => {
      mod.joinPath('foo')
      return path.join.should.have.been.calledWith('foo')
    })
    // @ts-expect-error ts-migrate(2582) FIXME: Cannot find name 'it'. Do you need to install type... Remove this comment to see the full error message
    it('first arg bool gets new path 0', () => {
      mod.joinPath(true, 'bar')
      return path.join.should.have.been.calledWithExactly('foo', 'bar')
    })
  })
})
