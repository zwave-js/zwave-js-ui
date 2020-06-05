const chai = require('chai')
const rewire = require('rewire')
chai.should()

describe('#debug', () => {
  const mod = rewire('../../lib/debug')
  const fun = mod.__get__('init')

  it('returns debug extend', () => mod('foo').namespace.should.equal('z2m:foo'))

  describe('set process.env.DEBUG', () => {
    before(() => {
      mod.__get__('log').disable()
      process.env.DEBUG = 'ff'
      fun()
    })
    it('should disable logging', () =>
      mod.__get__('log').enabled('z2m:aa').should.be.false)
  })
  describe('unset process.env.DEBUG', () => {
    before(() => {
      mod.__get__('log').disable()
      delete process.env.DEBUG
      fun()
    })
    it('should enable logging', () => {
      return mod.__get__('log').enabled('z2m:aa').should.be.true
    })
  })
})
