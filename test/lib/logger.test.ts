import { expect } from 'chai'
import * as utils from '../../api/lib/utils.ts'
import { logsDir } from '../../api/config/app.ts'
import type { ModuleLogger } from '../../api/lib/logger.ts'
import {
	customTransports,
	defaultLogFile,
	sanitizedConfig,
	module,
	setupAll,
	stopCleanJob,
	wrapLoggerForServer,
} from '../../api/lib/logger.ts'
import winston from 'winston'
import { ZWaveError, ZWaveErrorCodes } from 'zwave-js'

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
			expect(logger1.transports.every((t) => !t.silent)).to.be.true)
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
		it('should disable logging', () =>
			expect(
				logger1.transports.some(
					(t) =>
						t instanceof winston.transports.Stream ||
						t.silent === true,
				),
			).to.be.true)
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
				logEnabled: true,
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
		it('should not create file transport when logEnabled is false', () => {
			logger1 = module('mod3').setup({
				logEnabled: true,
				logLevel: 'warn',
				logToFile: true,
			})
			// Test pre-conditions:
			expect(logger1.module).to.equal('mod3')
			expect(logger1.level).to.equal('warn')
			expect(logger1.transports.length).to.be.equal(3)
			// Change logger configuration:
			setupAll({
				logEnabled: false,
				logLevel: 'error',
				logToFile: true,
			})
			// Test post-conditions: file transport should not be created when logEnabled is false
			expect(logger1.module).to.equal('mod3')
			expect(logger1.level).to.equal('error')
			expect(logger1.transports.length).to.be.equal(2)
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

	describe('wrapLoggerForServer()', () => {
		/**
		 * Helper function to create a mocked logger that captures error calls
		 */
		function createMockedLogger(moduleName: string): {
			baseLogger: ModuleLogger
			wrappedLogger: ModuleLogger
			errorCalls: { message: string; args: unknown[] }[]
		} {
			const errorCalls: { message: string; args: unknown[] }[] = []
			const baseLogger = module(moduleName)
			const originalError = baseLogger.error.bind(baseLogger)
			baseLogger.error = ((
				message: string,
				...args: unknown[]
			): winston.Logger => {
				errorCalls.push({ message, args })
				return originalError(message, ...args)
			}) as typeof baseLogger.error
			const wrappedLogger = wrapLoggerForServer(baseLogger)
			return { baseLogger, wrappedLogger, errorCalls }
		}

		it('should pass through non-ZWaveError errors unchanged', () => {
			const { wrappedLogger, errorCalls } =
				createMockedLogger('test-server-1')

			const regularError = new Error('Regular error')
			wrappedLogger.error('Test message', regularError)
			expect(errorCalls).to.have.length(1)
			expect(errorCalls[0].args[0]).to.equal(regularError)
		})

		it('should pass through ZWaveError with non-suppressed code unchanged', () => {
			const { wrappedLogger, errorCalls } =
				createMockedLogger('test-server-2')

			const zwaveError = new ZWaveError(
				'Driver failed',
				ZWaveErrorCodes.Driver_Failed,
			)
			wrappedLogger.error('Test message', zwaveError)
			expect(errorCalls).to.have.length(1)
			expect(errorCalls[0].args[0]).to.equal(zwaveError)
		})

		it('should suppress stack for FWUpdateService_MissingInformation error', () => {
			const { wrappedLogger, errorCalls } =
				createMockedLogger('test-server-3')

			const zwaveError = new ZWaveError(
				'Cannot check for firmware updates for node 51: fingerprint or firmware version is unknown!',
				ZWaveErrorCodes.FWUpdateService_MissingInformation,
			)
			wrappedLogger.error('Z-Wave error', zwaveError)
			expect(errorCalls).to.have.length(1)
			// The error should be converted to just the message string
			expect(errorCalls[0].args[0]).to.equal(zwaveError.message)
		})

		it('should proxy other logger methods unchanged', () => {
			const baseLogger = module('test-server-4')
			const wrappedLogger = wrapLoggerForServer(baseLogger)
			expect(wrappedLogger.info).to.be.a('function')
			expect(wrappedLogger.debug).to.be.a('function')
			expect(wrappedLogger.warn).to.be.a('function')
		})

		it('should preserve logger properties', () => {
			const baseLogger = module('test-server-5')
			const wrappedLogger = wrapLoggerForServer(baseLogger)
			expect(wrappedLogger.module).to.equal('test-server-5')
		})
	})
})
