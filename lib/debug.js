var log = require('debug')
var debug

function init () {
  if (!process.env.DEBUG) {
    log.enable('z2m:*')
  }
  debug = log('z2m')

  debug.log = console.log.bind(console)
}
init()
module.exports = function (namespace) { return debug.extend(namespace) }
