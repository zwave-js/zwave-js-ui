const winston = require('winston')
const { format, transports } = winston
const { combine, timestamp, label, printf } = format

// Custom logging format
const customFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label || '-'}] ${level}: ${message}`
})

// Custom combined logging format:
const customCombinedFormat = module =>
  combine(
    format.colorize({ all: true }),
    label({ label: module }),
    timestamp(),
    customFormat
  )

// Custom transports:
const customTransports = () => [new transports.Console()]

// Container to provide different pre-configured loggers
const logContainer = new winston.Container()

// Example: Pre-configured module logger with special properties
logContainer.add('ZWC', {
  format: customCombinedFormat('ZWC'),
  transports: customTransports()
})

// Default logger for modules:
logContainer.module = module => {
  if (!logContainer.has(module)) {
    logContainer.add(module, {
      format: customCombinedFormat(module),
      transports: customTransports()
    })
  }
  return logContainer.get(module)
}

module.exports = logContainer
