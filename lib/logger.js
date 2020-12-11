const winston = require('winston')
const { format, transports } = winston
const { combine, timestamp, label, printf, errors } = format

// Usage examples:
// Simple logger setup with module name and default config:
//   const logger = require('./logger.js').module('Zwave')
// Logger setup with module name and specific config:
//   const logger = require('./logger.js').module('Zwave').setup(
//     { enabled: true, level: 'info', logToFile: true, filename: "zwavejs2mqtt.log" }
//   )
// Change logger config during runtime:
//   let logger = require('./logger.js').module('Zwave')
//   log.info('This will be shown by default')
//   logger = logger.setup({ level: 'warn' })
//   log.info('Now this won't be shown anymore')

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

// Format loglevel upper-case:
const upperCaseLevel = format(info => {
  info.level = info.level.toUpperCase()
  return info
})

// Custom combined logging format:
const customFormat = config =>
  combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    upperCaseLevel(),
    label({ label: config.module.toUpperCase() }),
    printf(({ level, message, label, timestamp }) => {
      return `${timestamp} ${level} ${label || '-'}: ${message}`
    })
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

// Container for loggers of all modules:
const logContainer = new winston.Container()

// Re-create a new module logger
const setupNewLogger = (module, container, config) => {
  config = sanitizedConfig(module, config)
  if (container.has(module)) {
    container.close(module)
  }
  const logger = container.add(module, {
    silent: !config.enabled,
    level: config.level,
    format: customFormat(config),
    transports: customTransports(config)
  })

  // Workaround to allow logger config changes during runtime:
  logger.container = container
  logger.setup = config => setupNewLogger(module, container, config)

  return logger
}

// Get logger for module with default config:
logContainer.module = module => {
  return setupNewLogger(module, logContainer, {})
}

module.exports = logContainer
