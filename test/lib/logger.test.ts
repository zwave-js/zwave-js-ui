/**
 * logger.ts statically imports logsDir/storeDir from config/app.ts, which
 * writes a session-secret file and creates a real logs/ dir under the repo
 * store/ if STORE_DIR isn't set yet; logger.ts/config/app.ts/utils.ts must
 * all be dynamic import()s performed after ensureTestEnv() (see
 * shared/env.ts).
 *
 * logger.ts also memoizes its transports list and keeps every named logger
 * in a module-level winston.Container singleton for the lifetime of the
 * process (see issue #2937's "setup transports only once" comment) - both
 * deliberate, process-lifetime production singletons, not test artifacts.
 * Rather than add a production-only reset seam, each describe block below
 * calls `freshLogger()`, which `vi.resetModules()`s the whole module graph
 * and re-imports logger.ts fresh - giving that block its own isolated
 * module instance instead of resetting shared state. `vi.resetModules()`
 * gives `winston` itself a new module identity too, not just first-party
 * files, so `freshLogger()` re-imports it in the same cycle as logger.ts
 * and returns it alongside, keeping any `instanceof winston.transports.X`
 * check comparing classes from the same generation. This is what makes
 * assertions on transport count/silent/level hold regardless of
 * `--sequence.seed`/run order.
 *
 * DISABLE_LOG_ROTATION=true makes the logToFile: true scenarios use a plain
 * winston.transports.File instead of DailyRotateFile, whose
 * setupCleanJob() fires an un-awaited clean() promise - sharing this
 * file's transports cache via its own logger.info(...) calls - that can
 * still be in flight when afterAll deletes the throwaway STORE_DIR, a
 * pre-existing characteristic otherwise surfacing as noisy ENOENT
 * rejections.
 */
import {
	describe,
	it,
	expect,
	vi,
	beforeAll,
	beforeEach,
	afterEach,
	afterAll,
} from 'vitest'
import type * as UtilsModule from '../../api/lib/utils.ts'
import type { ModuleLogger } from '../../api/lib/logger.ts'
import type * as LoggerModule from '../../api/lib/logger.ts'
import type * as WinstonModule from 'winston'
import { ensureTestEnv, cleanupTestEnv } from './shared/env.ts'

let utils: typeof UtilsModule
let logsDir: string

const ORIGINAL_DISABLE_LOG_ROTATION = process.env.DISABLE_LOG_ROTATION

beforeAll(async () => {
	ensureTestEnv()
	process.env.DISABLE_LOG_ROTATION = 'true'
	const [utilsModule, configModule] = await Promise.all([
		import('../../api/lib/utils.ts'),
		import('../../api/config/app.ts'),
	])
	utils = utilsModule
	logsDir = configModule.logsDir
})

afterAll(() => {
	if (ORIGINAL_DISABLE_LOG_ROTATION === undefined) {
		delete process.env.DISABLE_LOG_ROTATION
	} else {
		process.env.DISABLE_LOG_ROTATION = ORIGINAL_DISABLE_LOG_ROTATION
	}
	cleanupTestEnv()
})

/**
 * Resets the module graph and re-imports logger.ts fresh, together with
 * `winston` in the same cycle (see file doc comment for why both).
 */
async function freshLogger(): Promise<
	typeof LoggerModule & { winston: typeof WinstonModule }
> {
	vi.resetModules()
	const [loggerModule, winstonModule] = await Promise.all([
		import('../../api/lib/logger.ts'),
		import('winston'),
	])
	return { ...loggerModule, winston: winstonModule }
}

function checkConfigDefaults(
	mod: string,
	cfg: ReturnType<typeof LoggerModule.sanitizedConfig>,
	defaultLogFile: typeof LoggerModule.defaultLogFile,
) {
	expect(cfg.module).to.equal(mod)
	expect(cfg.enabled).to.equal(true)
	expect(cfg.level).to.equal('info')
	expect(cfg.logToFile).to.equal(false)
	expect(cfg.filePath).to.equal(utils.joinPath(logsDir, defaultLogFile))
}

describe('logger.js', () => {
	describe('sanitizedConfig()', () => {
		let sanitizedConfig: typeof LoggerModule.sanitizedConfig
		let defaultLogFile: typeof LoggerModule.defaultLogFile

		beforeAll(async () => {
			;({ sanitizedConfig, defaultLogFile } = await freshLogger())
		})

		it('should set undefined config object to defaults', () => {
			const cfg = sanitizedConfig('-', undefined)
			checkConfigDefaults('-', cfg, defaultLogFile)
		})
		it('should set empty config object to defaults', () => {
			const cfg = sanitizedConfig('-', {})
			checkConfigDefaults('-', cfg, defaultLogFile)
		})
	})

	describe('customTransports()', () => {
		let customTransports: typeof LoggerModule.customTransports
		let sanitizedConfig: typeof LoggerModule.sanitizedConfig

		beforeEach(async () => {
			;({ customTransports, sanitizedConfig } = await freshLogger())
		})

		it('should have one transport by default', () => {
			const transports = customTransports(sanitizedConfig('-', {}))
			return expect(transports.length).to.equal(2)
		})
	})

	describe('module()', () => {
		let logger1: ModuleLogger

		beforeAll(async () => {
			const { module } = await freshLogger()
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
		let logger1: ModuleLogger
		let logger2: ModuleLogger
		let winston: typeof WinstonModule

		beforeAll(async () => {
			const fresh = await freshLogger()
			winston = fresh.winston
			logger1 = fresh.module('bar')
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
		let logger1: ModuleLogger

		beforeAll(async () => {
			const { module } = await freshLogger()
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
		let module: typeof LoggerModule.module
		let setupAll: typeof LoggerModule.setupAll
		let stopCleanJob: typeof LoggerModule.stopCleanJob
		let winston: typeof WinstonModule
		let logger1: ModuleLogger
		let logger2: ModuleLogger

		beforeEach(async () => {
			;({ module, setupAll, stopCleanJob, winston } = await freshLogger())
		})

		afterEach(() => {
			stopCleanJob()
		})

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
			// Explicit setupAll() establishes this test's starting state instead of relying on a sibling test's leftover transports cache
			logger1 = module('mod3')
			setupAll({
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
			// Create a different winston logger, from the same generation as `module`/`setupAll` above, so this proves setupAll() only touches logContainer.loggers and not winston's own default container
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
		it('should configure modules created after setupAll', () => {
			setupAll({
				logEnabled: true,
				logLevel: 'error',
				logToFile: true,
			})

			const logger = module('late-module')

			expect(logger.level).to.equal('error')
			expect(logger.transports.length).to.equal(3)
			expect(
				logger.transports.every((transport) => !transport.silent),
			).toBe(true)
		})
	})
})
