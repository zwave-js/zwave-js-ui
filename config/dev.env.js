'use strict'
const { merge } = require('webpack-merge')
const prodEnv = require('./prod.env')
const appConfig = require('../server/config/app.js')

module.exports = merge(prodEnv, {
  NODE_ENV: '"development"',
  PORT: appConfig.port
})
