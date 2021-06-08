import * as appConfig from './app'

const base = appConfig.base && appConfig.base.replace(/\/?$/, '/')

const defaultConfig = {
  base: '/',
  title: 'ZWave To MQTT'
}

export const webConfig = {
  ...defaultConfig,
  ...appConfig,
  base
}
