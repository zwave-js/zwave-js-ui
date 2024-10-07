import { expect } from 'chai'
import * as utils from '../../api/lib/utils'
import { logsDir } from '../../api/config/app'
import {
	customTransports,
	defaultLogFile,
	ModuleLogger,
	sanitizedConfig,
	module,
	setupAll,
	stopCleanJob,
} from '../../api/lib/logger'
import winston from 'winston'

function checkConfigDefaults(mod, cfg) {
	expect(cfg.module).to.equal(mod)
	expect(cfg.enabled).to.equal(true)
	expect(cfg.level).to.equal('info')
	expect(cfg.logToFile).to.equal(false)
	expect(cfg.filePath).to.equal(utils.joinPath(logsDir, defaultLogFile))
}

describe('logger.js', () => {
	let logger1: ModuleLogger
	let logger2: ModuleLogger

	afterEach(() => {
		stopCleanJob()
	})

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

	// describe('customFormat()', () => {
	// 	it('should uppercase the label', () => {
	// 		const fmt = customFormat(sanitizedConfig('foo', {}))
	// 		expect(
	// 			(
	// 				fmt.transform({
	// 					level: 'info',
	// 					message: 'msg',
	// 				}) as Logform.TransformableInfo
	// 			).label
	// 		).to.be.equal('FOO')
	// 	})
	// })

	describe('customTransports()', () => {
		it('should have one transport by default', () => {
			const transports = customTransports(sanitizedConfig('-', {}))
			return expect(transports.length).to.equal(2)
		})
	})

	describe('module()', () => {
		before(() => {
			logger1 = module('foo')
		})
		it('should set the module name', () =>
			expect(logger1.module).to.equal('foo'))
		it('should have a cfg function', () =>
			expect(typeof logger1.setup).to.equal('function'))
		it('should have logging enabled by default', () =>
			expect(logger1.silent).to.be.false)
		it('should have the default log level', () =>
			expect(logger1.level).to.equal('info'))
		it('should have one transport only', () =>
			expect(logger1.transports.length).to.be.equal(2))
	})

	describe('setup() (init)', () => {
		before(() => {
			logger1 = module('bar')
			logger2 = logger1.setup({
				logEnabled: false,
				logLevel: 'warn',
				logToFile: true,
			})
		})
		it('should return the same logger instance', () =>
			expect(logger1).to.be.equal(logger2))
		it('should set the module name', () =>
			expect(logger1.module).to.equal('bar'))
		it('should disable logging', () => expect(logger1.silent).to.be.true)
		it('should change the log level', () =>
			expect(logger1.level).to.equal('warn'))
		it('should have 2 transports', () =>
			expect(logger1.transports.length).to.be.equal(2))
	})

	describe('setup() (reconfigure)', () => {
		before(() => {
			logger1 = module('mod').setup({
				logEnabled: true,
				logLevel: 'warn',
				logToFile: false,
			})
		})
		it('should change the logger configuration', () => {
			// Test pre-conditions:
			expect(logger1.module).to.equal('mod')
			expect(logger1.level).to.equal('warn')
			expect(logger1.transports.length).to.be.equal(2)
			// Change logger configuration:
			logger1.setup({
				logEnabled: false,
				logLevel: 'error',
				logToFile: true,
			})
			// Test post-conditions:
			expect(logger1.module).to.equal('mod')
			expect(logger1.level).to.equal('error')
			expect(logger1.transports.length).to.be.equal(2)
		})
	})

	describe('setupAll()', () => {
		it('should change the logger config of all zwave-js-ui modules', () => {
			logger1 = module('mod1').setup({
				logEnabled: true,
				logLevel: 'warn',
				logToFile: false,
			})
			logger2 = module('mod2').setup({
				logEnabled: true,
				logLevel: 'warn',
				logToFile: false,
			})
			// Test pre-conditions:
			expect(logger1.module).to.equal('mod1')
			expect(logger1.level).to.equal('warn')
			expect(logger1.transports.length).to.be.equal(2)
			expect(logger2.module).to.equal('mod2')
			expect(logger2.level).to.equal('warn')
			expect(logger2.transports.length).to.be.equal(2)
			// Change logger configuration:
			setupAll({
				logEnabled: false,
				logLevel: 'error',
				logToFile: true,
			})
			// Test post-conditions:
			expect(logger1.module).to.equal('mod1')
			expect(logger1.level).to.equal('error')
			expect(logger1.transports.length).to.be.equal(3)
			expect(logger2.module).to.equal('mod2')
			expect(logger2.level).to.equal('error')
			expect(logger2.transports.length).to.be.equal(3)
		})
		it('should not change the logger config of non-zwave-js-ui loggers', () => {
			logger1 = module('mod1').setup({
				logEnabled: true,
				logLevel: 'warn',
				logToFile: false,
			})
			// Create a different winston logger:
			logger2 = winston.loggers.add('somelogger') as ModuleLogger
			logger2.level = 'warn'
			// Test pre-conditions:
			expect(logger1.level).to.equal('warn')
			// Change logger configuration:
			setupAll({
				logEnabled: false,
				logLevel: 'error',
				logToFile: true,
			})
			// Test post-conditions:
			expect(logger1.level).to.equal('error')
			expect(logger2.level).to.equal('warn')
		})
	})
})
