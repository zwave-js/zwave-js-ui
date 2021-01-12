const winston = require('winston')
const { format, transports, addColors } = winston
const { combine, timestamp, label, printf, colorize, splat } = format
const utils = require('./utils')
const { storeDir } = require('../config/app.js')

const colorizer = colorize()
const defaultLogFile = 'zwavejs2mqtt.log'

/**
 * Generate logger configuration starting from settings.gateway
 *
 * @param {string} module Module name
 * @param {any} config settings.gateway configuration
 * @returns
 */
const sanitizedConfig = (module, config) => {
  config = config || {}
  const filePath = utils.joinPath(
    true,
    storeDir,
    config.logFileName || defaultLogFile
  )

  return {
    module: module || '-',
    enabled: config.logEnabled !== undefined ? config.logEnabled : true,
    level: config.logLevel || 'info',
    logToFile: config.logToFile !== undefined ? config.logToFile : false,
    filePath: filePath
  }
}

// custom colors for timestamp and module
addColors({
  time: 'grey',
  module: 'bold'
})

/**
 * Return a custom logger format
 *
 * @param {any} config logger configuration configuration
 * @returns {winston.Logform.Format}
 */
const customFormat = config =>
  combine(
    splat(), // used for formats like: logger.log('info', Message %s', strinVal)
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    format(info => {
      info.level = info.level.toUpperCase()
      return info
    })(),
    label({ label: config.module.toUpperCase() }),
    colorize({ level: true }),
    printf(info => {
      info.timestamp = colorizer.colorize('time', info.timestamp)
      info.label = colorizer.colorize('module', info.label || '-')
      return `${info.timestamp} ${info.level} ${info.label}: ${info.message}${
        info.stack ? '\n' + info.stack : ''
      }`
    })
  )
/**
 * Create the base transports based on settings provided
 *
 * @param {any} config logger configuration
 * @returns {winston.transport[]}
 */
const customTransports = config => {
  const transportsList = [
    new transports.Console({
      format: customFormat(config),
      level: config.level,
      stderrLevels: ['error']
    })
  ]
  if (config.logToFile) {
    transportsList.push(
      new transports.File({
        format: combine(customFormat(config), format.uncolorize()),
        filename: config.filePath,
        level: config.level
      })
    )
  }
  return transportsList
}

/**
 * Setup a logger
 *
 * @param {winston.Container} container winston container
 * @param {string} module module name
 * @param {any} config settings.gateway configuration
 * @returns {winston.Logger}
 */
const setupLogger = (container, module, config) => {
  config = sanitizedConfig(module, config)
  const logger = container.add(module) // Winston automatically reuses an existing module logger
  logger.configure({
    silent: !config.enabled,
    level: config.level,
    transports: customTransports(config)
  })
  logger.module = module
  logger.setup = cfg => setupLogger(container, module, cfg)
  return logger
}

const logContainer = new winston.Container()

/**
 * Create a new logger for a specific module
 *
 * @param {string} module module name
 * @returns {winston.Logger}
 */
logContainer.loggers.module = module => {
  return setupLogger(logContainer, module)
}

/**
 * Setup all loggers starting from config
 *
 * @param {any} config settings.gateway configuration
 */
logContainer.loggers.setupAll = config => {
  logContainer.loggers.forEach(logger => {
    logger.setup(config)
  })
}

module.exports = logContainer.loggers
