import DailyRotateFile from '@zwave-js/winston-daily-rotate-file'
import winston from 'winston'
import { storeDir } from '../config/app'
import { GatewayConfig } from './Gateway'
import { DeepPartial, joinPath } from './utils'

const { format, transports, addColors } = winston
const { combine, timestamp, label, printf, colorize, splat } = format

export const defaultLogFile = 'zwavejs2mqtt_%DATE%.log'

export const disableColors = process.env.NO_LOG_COLORS === 'true'

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
	config: DeepPartial<GatewayConfig> | undefined
): LoggerConfig {
	config = config || ({} as LoggerConfig)
	const filePath = joinPath(storeDir, config.logFileName || defaultLogFile)

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
export function customFormat(
	config: LoggerConfig,
	noColor = false
): winston.Logform.Format {
	noColor = noColor || disableColors
	const formats: winston.Logform.Format[] = [
		splat(), // used for formats like: logger.log('info', Message %s', strinVal)
		timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
		format((info) => {
			info.level = info.level.toUpperCase()
			return info
		})(),
		label({ label: config.module.toUpperCase() }),
	]

	if (!noColor) {
		formats.push(colorize({ level: true }))
	}

	// must be added at last
	formats.push(
		printf((info) => {
			if (!noColor) {
				info.timestamp = colorizer.colorize('time', info.timestamp)
				info.label = colorizer.colorize('module', info.label || '-')
			}
			return `${info.timestamp} ${info.level} ${info.label}: ${
				info.message
			}${info.stack ? '\n' + info.stack : ''}`
		})
	)

	return combine(...formats)
}
/**
 * Create the base transports based on settings provided
 */
export function customTransports(config: LoggerConfig): winston.transport[] {
	const transportsList: winston.transport[] = [
		new transports.Console({
			format: customFormat(config),
			level: config.level,
			stderrLevels: ['error'],
		}),
	]
	if (config.logToFile) {
		let fileTransport
		if (process.env.DISABLE_LOG_ROTATION === 'true') {
			fileTransport = new transports.File({
				format: customFormat(config, true),
				filename: config.filePath,
				level: config.level,
			})
		} else {
			fileTransport = new DailyRotateFile({
				filename: config.filePath,
				auditFile: 'z2m-logs.audit.json',
				datePattern: 'YYYY-MM-DD',
				zippedArchive: true,
				maxFiles: process.env.Z2M_LOG_MAXFILES || '7d',
				maxSize: process.env.Z2M_LOG_MAXSIZE || '50m',
				level: config.level,
				format: customFormat(config, true),
			})
		}

		transportsList.push(fileTransport)
	}
	return transportsList
}

/**
 * Setup a logger
 */
export function setupLogger(
	container: winston.Container,
	module: string,
	config?: DeepPartial<GatewayConfig>
): ModuleLogger {
	const sanitized = sanitizedConfig(module, config)
	// Winston automatically reuses an existing module logger
	const logger = container.add(module) as ModuleLogger
	logger.configure({
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
	logContainer.loggers.forEach((logger: ModuleLogger) => {
		logger.setup(config)
	})
}

export default logContainer.loggers
