const winston = require('winston')
const { format, transports, addColors } = winston
const { combine, timestamp, label, printf, errors, colorize } = format
const loggerPrefix = 'zwavejs2mqtt.'
const utils = require('./utils')
const { storeDir } = require('../config/app.js')

const colorizer = colorize()
const defaultLogFile = utils.joinPath(true, storeDir, 'zwavejs2mqtt.log')

// Make sure every config value is defined
const sanitizedConfig = (module, config) => {
  config = config || {}
  return {
    module: module !== undefined ? module : '-',
    enabled: config.enabled !== undefined ? config.enabled : true,
    level: config.level !== undefined ? config.level : 'info',
    logToFile: config.logToFile !== undefined ? config.logToFile : false,
    filename: config.filename !== undefined ? config.filename : defaultLogFile
  }
}

addColors({
  time: 'grey',
  module: 'bold'
})

// Custom logging format:
const customFormat = (config, useColors) =>
  combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    format(info => {
      info.level = info.level.toUpperCase()
      return info
    })(),
    label({ label: config.module.toUpperCase() }),
    colorize({ level: useColors }),
    printf(info => {
      info.timestamp = useColors
        ? colorizer.colorize('time', info.timestamp)
        : info.timestamp
      info.label = useColors
        ? colorizer.colorize('module', info.label || '-')
        : info.label

      return `${info.timestamp} ${info.level} ${info.label}: ${info.message}`
    })
  )

// Custom transports:
const customTransports = config => {
  const transportsList = [
    new transports.Console({
      format: customFormat(config, true),
      level: config.level,
      stderrLevels: ['error']
    })
  ]
  if (config.logToFile) {
    transportsList.push(
      new transports.File({
        format: customFormat(config, false),
        filename: config.filename,
        level: config.level
      })
    )
  }
  return transportsList
}

// Helper function to setup a logger:
const setupLogger = (container, module, config) => {
  config = sanitizedConfig(module, config)
  const logger = container.add(loggerPrefix + module) // NOTE: Winston automatically reuses an existing module logger
  logger.configure({
    silent: !config.enabled,
    level: config.level,
    transports: customTransports(config)
  })
  logger.module = module
  logger.setup = cfg => setupLogger(container, module, cfg)
  return logger
}

// Setup a logger for a certain module:
winston.loggers.module = module => {
  return setupLogger(winston.loggers, module)
}

// Setup loggers for all modules
winston.loggers.setupAll = config => {
  for (const [key, logger] of winston.loggers.loggers) {
    // Make sure, only winston loggers created from this logger module are modified:
    if (key.startsWith(loggerPrefix)) {
      logger.setup(config)
    }
  }
}

module.exports = winston.loggers
