'use strict'
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'merge'.
const { merge } = require('webpack-merge')
const prodEnv = require('./prod.env')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'appConfig'... Remove this comment to see the full error message
const appConfig = require('./app.js')

module.exports = merge(prodEnv, {
  NODE_ENV: '"development"',
  PORT: appConfig.port
})
