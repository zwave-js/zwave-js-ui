import * as appConfig from './app'

const base = appConfig.base && appConfig.base.replace(/\/?$/, '/')

const defaultConfig = {
  base: '/',
  title: 'ZWave To MQTT'
}

const webConfig = {
  ...defaultConfig,
  ...appConfig,
  base
}

export default webConfig