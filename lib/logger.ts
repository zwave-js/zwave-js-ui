import { joinPath, DeepPartial } from './utils'
import { storeDir } from '../config/app'
import { GatewayConfig } from './Gateway'
import winston = require('winston')

const { format, transports, addColors } = winston
const { combine, timestamp, label, printf, colorize, splat } = format

const colorizer = colorize()
const defaultLogFile = 'zwavejs2mqtt.log'

interface ModuleLogger extends winston.Logger {
	module: string
	setup(cfg: DeepPartial<GatewayConfig>): winston.Logger
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
const sanitizedConfig = (
	module: string,
	config: DeepPartial<GatewayConfig>
): LoggerConfig => {
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

// custom colors for timestamp and module
addColors({
	time: 'grey',
	module: 'bold',
})

/**
 * Return a custom logger format
 */
const customFormat = (config: LoggerConfig): winston.Logform.Format =>
	combine(
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
/**
 * Create the base transports based on settings provided
 */
const customTransports = (config: LoggerConfig): winston.transport[] => {
	const transportsList: winston.transport[] = [
		new transports.Console({
			format: customFormat(config),
			level: config.level,
			stderrLevels: ['error'],
		}),
	]
	if (config.logToFile) {
		const fileTransport = new transports.File({
			format: combine(customFormat(config), format.uncolorize()),
			filename: config.filePath,
			level: config.level,
		})

		transportsList.push(fileTransport)
	}
	return transportsList
}

/**
 * Setup a logger
 */
const setupLogger = (
	container: winston.Container,
	module: string,
	config?: DeepPartial<GatewayConfig>
): ModuleLogger => {
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
export function module(module: string): winston.Logger {
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
