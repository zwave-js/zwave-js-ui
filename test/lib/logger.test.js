// const { assert } = require('chai')
const winston = require('winston')
const rewire = require('rewire')
const logContainer = rewire('../../lib/logger.js')
const utils = require('../../lib/utils')
const { storeDir } = require('../../config/app.js')

function checkConfigDefaults (mod, cfg) {
  const defaultLogFile = utils.joinPath(
    storeDir,
    logContainer.__get__('defaultLogFile')
  )
  return expect(cfg).toEqual(expect.objectContaining({
    module: mod,
    enabled: true,
    level: 'info',
    logToFile: false,
    filePath: defaultLogFile
  }))
}

describe('logger.js', () => {
  const sanitizedConfig = logContainer.__get__('sanitizedConfig')
  const customTransports = logContainer.__get__('customTransports')
  let logger1
  let logger2

  test.only('should have a module function', () =>
    expect(typeof logContainer.module).toBe('function'))
  test.only('should have a configAllLoggers function', () =>
    expect(typeof logContainer.setupAll).toBe('function'))

  describe('sanitizedConfig()', () => {
    test.only('should set undefined config object to defaults', () => {
      const cfg = sanitizedConfig('-', undefined)
      return checkConfigDefaults('-', cfg)
    })
    test.only('should set empty config object to defaults', () => {
      const cfg = sanitizedConfig('-', {})
      return checkConfigDefaults('-', cfg)
    })
  })

  describe('customFormat()', () => {
    test.skip('should uppercase the label', () => {
      // TODO: Why does it fail with 'TypeError: colors[Colorizer.allColors[lookup]] is not a function'?
      const customFormat = logContainer.__get__('customFormat')
      const fmt = customFormat(sanitizedConfig('foo', {}))
      return expect(fmt.transform({ level: 'info', message: 'msg' }).label).toEqual('FOO')
    })
  })

  describe('customTransports()', () => {
    test.only('should have one transport by default', () => {
      const transports = customTransports(sanitizedConfig('-', {}))
      expect(transports.length).toEqual(1)
    })
  })

  describe('module()', () => {
    beforeAll(() => {
      logger1 = logContainer.module('foo')
    })
    test.only('should set the module name', () => expect(logger1.module).toEqual('foo'))
    test.only('should have a cfg function', () => expect(typeof logger1.setup).toBe('function'))
    test.only('should have logging enabled by default', () =>
      expect(logger1.silent).toBe(false))
    test.only('should have the default log level', () =>
      expect(logger1.level).toEqual('info'))
    test.only('should have one transport only', () =>
      expect(logger1.transports).toHaveLength(1))
  })

  describe('setup() (init)', () => {
    beforeAll(() => {
      logger1 = logContainer.module('bar')
      logger2 = logger1.setup({
        logEnabled: false,
        logLevel: 'warn',
        logToFile: true
      })
    })
    test.only('should return the same logger instance', () =>
      expect(logger1).toEqual(logger2))
    test.only('should set the module name', () => expect(logger1.module).toEqual('bar'))
    test.only('should disable logging', () => expect(logger1.silent).toBe(true))
    test.only('should change the log level', () => expect(logger1.level).toEqual('warn'))
    test.only('should have 2 transports', () =>
      expect(logger1.transports).toHaveLength(2))
  })

  describe('setup() (reconfigure)', () => {
    beforeAll(() => {
      logger1 = logContainer
        .module('mod')
        .setup({ logEnabled: true, logLevel: 'warn', logToFile: false })
    })
    test.only('should change the logger configuration', () => {
      // Test pre-conditions:
      // expect(logger1.module).toEqual('mod')
      // expect(logger1.level).toEqual('warn')
      // expect(logger1.transports.length).toEqual(1)
      // Change logger configuration:
      logger1.setup({ logEnabled: false, logLevel: 'error', logToFile: true })
      // Test post-conditions:
      return expect(logger1).toBe(expect.objectContaining({
        module: 'mod',
        level: 'error'
        // transports: []
      }))
      // expect(logger1.module).toEqual('mod')
      // expect(logger1.level).toEqual('error')
      expect(logger1.transports.length).toEqual(2)
    })
  })

  describe('setupAll()', () => {
    test('should change the logger config of all zwavejs2mqtt modules', () => {
      logger1 = logContainer
        .module('mod1')
        .setup({ logEnabled: true, logLevel: 'warn', logToFile: false })
      logger2 = logContainer
        .module('mod2')
        .setup({ logEnabled: true, logLevel: 'warn', logToFile: false })
      // Test pre-conditions:
      expect(logger1.module).toEqual('mod1')
      expect(logger1.level).toEqual('warn')
      expect(logger1.transports.length).toEqual(1)
      expect(logger2.module).toEqual('mod2')
      expect(logger2.level).toEqual('warn')
      expect(logger2.transports.length).toEqual(1)
      // Change logger configuration:
      logContainer.setupAll({
        logEnabled: false,
        logLevel: 'error',
        logToFile: true
      })
      // Test post-conditions:
      expect(logger1.module).toEqual('mod1')
      expect(logger1.level).toEqual('error')
      expect(logger1.transports.length).toEqual(2)
      expect(logger2.module).toEqual('mod2')
      expect(logger2.level).toEqual('error')
      expect(logger2.transports.length).toEqual(2)
    })
    test('should not change the logger config of non-zwavejs2mqtt loggers', () => {
      logger1 = logContainer
        .module('mod1')
        .setup({ logEnabled: true, logLevel: 'warn', logToFile: false })
      // Create a different winston logger:
      logger2 = winston.loggers.add('somelogger')
      logger2.level = 'warn'
      // Test pre-conditions:
      expect(logger1.level).toEqual('warn')
      // Change logger configuration:
      logContainer.setupAll({
        logEnabled: false,
        logLevel: 'error',
        logToFile: true
      })
      // Test post-conditions:
      expect(logger1.level).toEqual('error')
      expect(logger2.level).toEqual('warn')
    })
  })
})
