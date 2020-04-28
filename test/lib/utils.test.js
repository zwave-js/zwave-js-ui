const chai = require('chai')
const rewire = require('rewire')
const sinon = require('sinon')
chai.use(require('sinon-chai'))
chai.should()

let mod = rewire('../../lib/utils')

describe('#utils', () => {
  describe('#getPath()', () => {
    mod.__set__('appRoot', {toString: () => 'foo'})
    it('write && process.pkg', () => {
      process.pkg = true
      mod.getPath(true).should.equal(process.cwd())
    })
    it('write && !process.pkg', () => {
      process.pkg = false
      mod.getPath(true).should.equal('foo')
    })
    it('!write && process.pkg', () => {
      process.pkg = true
      mod.getPath(false).should.equal('foo')
    })
    it('!write && !process.pkg', () => {
      process.pkg = false
      mod.getPath(false).should.equal('foo')
    })
  })
  describe('#joinPath()', () => {
    let path
    before(() => {
      path = {join: sinon.stub()}
      mod.__set__('path', path)
      sinon.stub(mod, 'getPath').returns('foo')
    })
    after(() => {
      mod.getPath.restore()
    })

    it('zero length', () => {
      mod.joinPath()
      return path.join.should.have.been.calledWith()
    })
    it('1 length', () => {
      mod.joinPath('foo')
      return path.join.should.have.been.calledWith('foo')
    })
    it('first arg bool gets new path 0', () => {
      mod.joinPath(true, 'bar')
      return path.join.should.have.been.calledWithExactly('foo', 'bar')
    })
  })
})
