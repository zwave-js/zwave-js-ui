// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'appConfig'... Remove this comment to see the full error message
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
