const appConfig = require('./app')

appConfig.base = appConfig.base && appConfig.base.replace(/\/?$/, '/')

const defaultConfig = {
  base: '/',
  title: 'ZWave To MQTT'
}

module.exports = {
  ...defaultConfig,
  ...appConfig
}
