import * as appConfig from './app'

const base = appConfig.base && appConfig.base.replace(/\/?$/, '/')

const defaultConfig = {
  base: '/',
  title: 'Z-Wave JS UI'
}

// don't use export default as it has an unexpected behaviour when used in js files require
export const webConfig = {
  ...defaultConfig,
  ...appConfig,
  base
}
