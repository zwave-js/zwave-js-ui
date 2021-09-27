import { joinPath, DeepPartial } from './utils'
import { storeDir } from '../config/app'
import { GatewayConfig } from './Gateway'
import winston from 'winston'
import DailyRotateFile from '@zwave-js/winston-daily-rotate-file'

const { format, transports, addColors } = winston
const { combine, timestamp, label, printf, colorize, splat } = format

export const defaultLogFile = 'zwavejs2mqtt.log'

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
	config: DeepPartial<GatewayConfig>
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
export function customFormat(config: LoggerConfig): winston.Logform.Format {
	return combine(
		splat(), // used for formats like: logger.log('info', Message %s', strinVal)
		timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
		format((info) => {
			info.level = info.level.toUpperCase()
			return info
		})(),
		label({ label: config.module.toUpperCase() }),
		colorize({ level: true }),
		printf((info) => {
			info.timestamp = colorizer.colorize('time', info.timestamp)
			info.label = colorizer.colorize('module', info.label || '-')
			return `${info.timestamp} ${info.level} ${info.label}: ${
				info.message
			}${info.stack ? '\n' + info.stack : ''}`
		})
	)
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
		const fileTransport = new DailyRotateFile({
			filename: config.filePath,
			datePattern: 'YYYY-MM-DD',
			zippedArchive: true,
			maxFiles: '7d',
			maxSize: '100m',
			level: config.level,
			format: combine(customFormat(config), format.uncolorize()),
		})

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
