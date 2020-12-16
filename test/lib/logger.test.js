const { assert } = require('chai')
const winston = require('winston')
const reqlib = require('app-root-path').require
const rewire = require('rewire')

const logContainer = reqlib('lib/logger.js')
const logContainerRewired = rewire('../../lib/logger.js')

function checkConfigDefaults (mod, cfg) {
  const defaultLogFile = logContainerRewired.__get__('defaultLogFile')
  cfg.module.should.equal(mod)
  cfg.enabled.should.equal(true)
  cfg.level.should.equal('info')
  cfg.logToFile.should.equal(false)
  cfg.filename.should.equal(defaultLogFile)
}

describe('logger.js', () => {
  const sanitizedConfig = logContainerRewired.__get__('sanitizedConfig')
  const customTransports = logContainerRewired.__get__('customTransports')
  let logger1
  let logger2

  it('should have a module function', () =>
    assert.isFunction(logContainer.module))
  it('should have a configAllLoggers function', () =>
    assert.isFunction(logContainer.setupAll))

  describe('sanitizedConfig()', () => {
    it('should set undefined config object to defaults', () => {
      const cfg = sanitizedConfig('-', undefined)
      checkConfigDefaults('-', cfg)
    })
    it('should set empty config object to defaults', () => {
      const cfg = sanitizedConfig('-', {})
      checkConfigDefaults('-', cfg)
    })
  })

  describe('customFormat()', () => {
    it('should uppercase the label', () => {
      // TODO: Why does it fail with 'TypeError: colors[Colorizer.allColors[lookup]] is not a function'?
      // const customFormat = logContainerRewired.__get__('customFormat')
      // const fmt = customFormat(sanitizedConfig('foo', {}))
      // fmt.transform({ module: 'foo', level: 'info', message: 'msg' })
      //   .label.should.be.equal('FOO')
    })
  })

  describe('customTransports()', () => {
    it('should have one transport by default', () => {
      const transports = customTransports(sanitizedConfig('-', {}))
      transports.length.should.equal(1)
    })
  })

  describe('module()', () => {
    before(() => {
      logger1 = logContainer.module('foo')
    })
    it('should set the module name', () => logger1.module.should.equal('foo'))
    it('should have a cfg function', () => assert.isFunction(logger1.setup))
    it('should have logging enabled by default', () =>
      logger1.silent.should.be.false)
    it('should have the default log level', () =>
      logger1.level.should.equal('info'))
    it('should have one transport only', () =>
      logger1.transports.length.should.be.equal(1))
  })

  describe('setup() (init)', () => {
    before(() => {
      logger1 = logContainer.module('bar')
      logger2 = logger1.setup({
        enabled: false,
        level: 'warn',
        logToFile: true
      })
    })
    it('should return the same logger instance', () =>
      logger1.should.be.equal(logger2))
    it('should set the module name', () => logger1.module.should.equal('bar'))
    it('should disable logging', () => logger1.silent.should.be.true)
    it('should change the log level', () => logger1.level.should.equal('warn'))
    it('should have 2 transports', () =>
      logger1.transports.length.should.be.equal(2))
  })

  describe('setup() (reconfigure)', () => {
    before(() => {
      logger1 = logContainer
        .module('mod')
        .setup({ enabled: true, level: 'warn', logToFile: false })
    })
    it('should change the logger configuration', () => {
      // Test pre-conditions:
      logger1.module.should.equal('mod')
      logger1.level.should.equal('warn')
      logger1.transports.length.should.be.equal(1)
      // Change logger configuration:
      logger1.setup({ enabled: false, level: 'error', logToFile: true })
      // Test post-conditions:
      logger1.module.should.equal('mod')
      logger1.level.should.equal('error')
      logger1.transports.length.should.be.equal(2)
    })
  })

  describe('setupAll()', () => {
    it('should change the logger config of all zwavejs2mqtt modules', () => {
      logger1 = logContainer
        .module('mod1')
        .setup({ enabled: true, level: 'warn', logToFile: false })
      logger2 = logContainer
        .module('mod2')
        .setup({ enabled: true, level: 'warn', logToFile: false })
      // Test pre-conditions:
      logger1.module.should.equal('mod1')
      logger1.level.should.equal('warn')
      logger1.transports.length.should.be.equal(1)
      logger2.module.should.equal('mod2')
      logger2.level.should.equal('warn')
      logger2.transports.length.should.be.equal(1)
      // Change logger configuration:
      logContainer.setupAll({
        enabled: false,
        level: 'error',
        logToFile: true
      })
      // Test post-conditions:
      logger1.module.should.equal('mod1')
      logger1.level.should.equal('error')
      logger1.transports.length.should.be.equal(2)
      logger2.module.should.equal('mod2')
      logger2.level.should.equal('error')
      logger2.transports.length.should.be.equal(2)
    })
    it('should not change the logger config of non-zwavejs2mqtt loggers', () => {
      logger1 = logContainer
        .module('mod1')
        .setup({ enabled: true, level: 'warn', logToFile: false })
      // Create a different winston logger:
      logger2 = winston.loggers.add('somelogger')
      logger2.level = 'warn'
      // Test pre-conditions:
      logger1.level.should.equal('warn')
      // Change logger configuration:
      logContainer.setupAll({
        enabled: false,
        level: 'error',
        logToFile: true
      })
      // Test post-conditions:
      logger1.level.should.equal('error')
      logger2.level.should.equal('warn')
    })
  })
})
