const log = require('debug')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'debug'.
let debug

function init () {
  if (!process.env.DEBUG) {
    log.enable('z2m:*')
  }
  debug = log('z2m')

  debug.log = console.log.bind(console)
}
init()
module.exports = function (namespace: any) {
  return debug.extend(namespace)
}
