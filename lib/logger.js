const winston = require('winston')
const { format, transports } = winston
const { combine, timestamp, label, printf, errors } = format

// Usage examples:
// Simple logger setup with module name and default config:
//   const logger = require('./logger.js').setup('zwc')
// Logger setup with module name and specific config:
//   const logger = require('./logger.js').setup('zwc',
//     { enabled: true, level: 'info', logToFile: true, filename: "zwavejs2mqtt.log" }
//   )

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

// Setup logger for modules:
logContainer.setup = (module, config) => {
  config = sanitizedConfig(module, config)
  if (!logContainer.has(config.module)) {
    logContainer.add(config.module, {
      silent: !config.enabled,
      level: config.level,
      format: customFormat(config),
      transports: customTransports(config)
    })
  }
  return logContainer.get(config.module)
}

module.exports = logContainer
