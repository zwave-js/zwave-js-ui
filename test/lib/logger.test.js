const { assert } = require('chai')
const chai = require('chai')
const rewire = require('rewire')
chai.should()

describe('#logger', () => {
  const mod = rewire('../../lib/logger.js')
  let logger

  it('has a module function', () => assert.isFunction(mod.module))

  describe('#module', () => {
    before(() => {
      logger = mod.module('foo')
    })
    it('should have a setup function', () => assert.isFunction(logger.setup))
    it('should have logging enabled', () => logger.silent.should.be.false)
    it('should have log level info', () => logger.level.should.equal('info'))
  })
  describe('#setup', () => {
    before(() => {
      logger = mod.module('foo').setup({ level: 'warn' })
    })
    it('should have log level warn', () => logger.level.should.equal('warn'))
  })
})
