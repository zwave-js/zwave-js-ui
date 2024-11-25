import DailyRotateFile, {
	DailyRotateFileTransportOptions,
} from 'winston-daily-rotate-file'
import { ensureDirSync } from 'fs-extra'
import winston from 'winston'
import { logsDir, storeDir } from '../config/app'
import { GatewayConfig } from './Gateway'
import { DeepPartial, joinPath } from './utils'
import * as path from 'path'
import { readdir, stat, unlink } from 'fs/promises'
import { Stats } from 'fs'
import escapeStringRegexp from '@esm2cjs/escape-string-regexp'
import { PassThrough } from 'stream'

const { format, transports, addColors } = winston
const { combine, timestamp, printf, colorize, splat } = format

export const defaultLogFile = 'z-ui_%DATE%.log'

export const disableColors = process.env.NO_LOG_COLORS === 'true'

let transportsList: winston.transport[] = null

// ensure store and logs directories exist
ensureDirSync(storeDir)
ensureDirSync(logsDir)

// custom colors for timestamp and module
addColors({
	time: 'grey',
	module: 'bold',
})

const colorizer = colorize()

export interface ModuleLogger extends winston.Logger {
	module: string
	setup(cfg: DeepPartial<GatewayConfig>): ModuleLogger
}

export type LogLevel = 'silly' | 'verbose' | 'debug' | 'info' | 'warn' | 'error'

interface LoggerConfig {
	module: string
	enabled: boolean
	level: LogLevel
	logToFile: boolean
	filePath: string
}

/**
 * Generate logger configuration starting from settings.gateway
 */
export function sanitizedConfig(
	module: string,
	config: DeepPartial<GatewayConfig> | undefined,
): LoggerConfig {
	config = config || ({} as LoggerConfig)
	const filePath = joinPath(logsDir, config.logFileName || defaultLogFile)

	return {
		module: module || '-',
		enabled: config.logEnabled !== undefined ? config.logEnabled : true,
		level: config.logLevel || 'info',
		logToFile: config.logToFile !== undefined ? config.logToFile : false,
		filePath: filePath,
	}
}

/**
 * Return a custom logger format
 */
export function customFormat(noColor = false): winston.Logform.Format {
	noColor = noColor || disableColors
	const formats: winston.Logform.Format[] = [
		splat(), // used for formats like: logger.log('info', Message %s', strinVal)
		timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
		format((info) => {
			info.level = info.level.toUpperCase()
			return info
		})(),
	]

	if (!noColor) {
		formats.push(colorize({ level: true }))
	}

	// must be added at last
	formats.push(
		printf((info) => {
			info.module = info.module?.toUpperCase() || '-'
			if (!noColor) {
				info.timestamp = colorizer.colorize('time', info.timestamp)
				info.module = colorizer.colorize('module', info.module)
			}
			return `${info.timestamp} ${info.level} ${info.module}: ${
				info.message
			}${info.stack ? '\n' + info.stack : ''}`
		}),
	)

	return combine(...formats)
}

export const logStream = new PassThrough()

/**
 * Create the base transports based on settings provided
 */
export function customTransports(config: LoggerConfig): winston.transport[] {
	// setup transports only once (see issue #2937)
	if (transportsList) {
		return transportsList
	}

	transportsList = []

	if (process.env.ZUI_NO_CONSOLE !== 'true') {
		transportsList.push(
			new transports.Console({
				format: customFormat(),
				level: config.level,
				stderrLevels: ['error'],
			}),
		)
	}

	const streamTransport = new transports.Stream({
		format: customFormat(),
		level: config.level,
		stream: logStream,
	})

	transportsList.push(streamTransport)

	if (config.logToFile) {
		let fileTransport: winston.transport

		if (process.env.DISABLE_LOG_ROTATION === 'true') {
			fileTransport = new transports.File({
				format: customFormat(true),
				filename: config.filePath,
				level: config.level,
			})
		} else {
			const options: DailyRotateFileTransportOptions = {
				filename: config.filePath,
				auditFile: joinPath(logsDir, 'zui-logs.audit.json'),
				datePattern: 'YYYY-MM-DD',
				createSymlink: true,
				symlinkName: path
					.basename(config.filePath)
					.replace(`_%DATE%`, '_current'),
				zippedArchive: true,
				maxFiles: process.env.ZUI_LOG_MAXFILES || '7d',
				maxSize: process.env.ZUI_LOG_MAXSIZE || '50m',
				level: config.level,
				format: customFormat(true),
			}
			fileTransport = new DailyRotateFile(options)

			setupCleanJob(options)
		}

		transportsList.push(fileTransport)
	}

	// giving that we re-use transports, each module will subscribe to events
	// increeasing the default limit of 100 prevents warnings
	transportsList.forEach((t) => {
		t.setMaxListeners(100)
	})

	return transportsList
}

/**
 * Setup a logger
 */
export function setupLogger(
	container: winston.Container,
	module: string,
	config?: DeepPartial<GatewayConfig>,
): ModuleLogger {
	const sanitized = sanitizedConfig(module, config)
	// Winston automatically reuses an existing module logger
	const logger = container.add(module) as ModuleLogger
	logger.configure({
		format: combine(
			format((info) => {
				info.module = logger.module
				return info
			})(),
			format.errors({ stack: true }),
			format.json(),
		), // to correctly parse errors
		silent: !sanitized.enabled,
		level: sanitized.level,
		transports: customTransports(sanitized),
	})
	logger.module = module
	logger.setup = (cfg) => setupLogger(container, module, cfg)
	return logger
}

const logContainer = new winston.Container()

/**
 * Create a new logger for a specific module
 */
export function module(module: string): ModuleLogger {
	return setupLogger(logContainer, module)
}

/**
 * Setup all loggers starting from config
 */
export function setupAll(config: DeepPartial<GatewayConfig>) {
	stopCleanJob()

	transportsList.forEach((t) => {
		if (typeof t.close === 'function') {
			t.close()
		}
	})

	transportsList = null

	logContainer.loggers.forEach((logger: ModuleLogger) => {
		logger.setup(config)
	})
}

let cleanJob: NodeJS.Timeout

export function setupCleanJob(settings: DailyRotateFileTransportOptions) {
	if (cleanJob) {
		return
	}

	let maxFilesMs: number
	let maxFiles: number
	let maxSizeBytes: number

	const logger = module('LOGGER')

	// convert maxFiles to milliseconds
	if (settings.maxFiles !== undefined) {
		const matches = settings.maxFiles.toString().match(/(\d+)([dhm])/)

		if (settings.maxFiles) {
			const value = parseInt(matches[1])
			const unit = matches[2]
			switch (unit) {
				case 'd':
					maxFilesMs = value * 24 * 60 * 60 * 1000
					break
				case 'h':
					maxFilesMs = value * 60 * 60 * 1000
					break
				case 'm':
					maxFilesMs = value * 60 * 1000
					break
			}
		} else {
			maxFiles = Number(settings.maxFiles)
		}
	}

	if (settings.maxSize !== undefined) {
		// convert maxSize to bytes
		const matches2 = settings.maxSize.toString().match(/(\d+)([kmg])/)
		if (matches2) {
			const value = parseInt(matches2[1])
			const unit = matches2[2]
			switch (unit) {
				case 'k':
					maxSizeBytes = value * 1024
					break
				case 'm':
					maxSizeBytes = value * 1024 * 1024
					break
				case 'g':
					maxSizeBytes = value * 1024 * 1024 * 1024
					break
			}
		} else {
			maxSizeBytes = Number(settings.maxSize)
		}
	}

	// clean up old log files based on maxFiles and maxSize

	const filePathRegExp = new RegExp(
		escapeStringRegexp(path.basename(settings.filename)).replace(
			/%DATE%/g,
			'(.*)',
		),
	)

	const logsDir = path.dirname(settings.filename)

	const deleteFile = async (filePath: string) => {
		logger.info(`Deleting log file: ${filePath}`)
		return unlink(filePath).catch((e) => {
			if (e.code !== 'ENOENT') {
				logger.error(`Error deleting log file: ${filePath}`, e)
			}
		})
	}

	const clean = async () => {
		try {
			logger.info('Cleaning up log files...')
			const files = await readdir(logsDir)
			const logFiles = files.filter(
				(file) =>
					file !== settings.symlinkName && filePathRegExp.test(file),
			)

			const fileStats = await Promise.allSettled<{
				file: string
				stats: Stats
			}>(
				logFiles.map(async (file) => ({
					file,
					stats: await stat(path.join(logsDir, file)),
				})),
			)

			const logFilesStats: {
				file: string
				stats: Stats
			}[] = []

			for (const res of fileStats) {
				if (res.status === 'fulfilled') {
					logFilesStats.push(res.value)
				} else {
					logger.error('Error getting file stats:', res.reason)
				}
			}

			logFilesStats.sort((a, b) => a.stats.mtimeMs - b.stats.mtimeMs)

			// sort by mtime

			let totalSize = 0
			let deletedFiles = 0
			for (const { file, stats } of logFilesStats) {
				const filePath = path.join(logsDir, file)
				totalSize += stats.size

				// last modified time in milliseconds
				const fileMs = stats.mtimeMs

				const shouldDelete =
					(maxSizeBytes && totalSize > maxSizeBytes) ||
					(maxFiles && logFiles.length - deletedFiles > maxFiles) ||
					(maxFilesMs && fileMs && Date.now() - fileMs > maxFilesMs)

				if (shouldDelete) {
					await deleteFile(filePath)
					deletedFiles++
				}
			}
		} catch (e) {
			logger.error('Error cleaning up log files:', e)
		}
	}

	cleanJob = setInterval(clean, 60 * 60 * 1000)
	clean().catch(() => {})
}

export function stopCleanJob() {
	if (cleanJob) {
		clearInterval(cleanJob)
		cleanJob = undefined
	}
}

export default logContainer.loggers
