const winston = require('winston')
const { format, transports } = winston
const { combine, timestamp, label, printf, errors } = format
const loggerPrefix = 'zwavejs2mqtt.'

// Make sure every config value is defined
const sanitizedConfig = (module, config) => {
  config = config || {}
  return {
    module: module !== undefined ? module : '-',
    enabled: config.enabled !== undefined ? config.enabled : true,
    level: config.level !== undefined ? config.level : 'info',
    logToFile: config.logToFile !== undefined ? config.logToFile : false,
    filename:
      config.filename !== undefined ? config.filename : 'zwavejs2mqtt.log'
  }
}

// Custom logging format:
const customFormat = config =>
  combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    format(info => {
      info.level = info.level.toUpperCase()
      return info
    })(),
    label({ label: config.module.toUpperCase() }),
    printf(
      info =>
        `${info.timestamp} ${info.level} ${info.label || '-'}: ${info.message}`
    )
  )

// Custom transports:
const customTransports = config => {
  const transportsList = [
    new transports.Console({
      format: format.colorize({ all: true }),
      level: config.level
    })
  ]
  if (config.logToFile) {
    transportsList.push(
      new transports.File({
        format: customFormat(config),
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
    format: customFormat(config),
    transports: customTransports(config)
  })
  logger.module = module
  logger.setup = cfg =>
    setupLogger(container, module, cfg)
  return logger
}

// Setup a logger for a certain module:
winston.loggers.module = (module) => {
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
