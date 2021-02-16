const { joinPath } = require('../lib/utils')
// config/app.js
module.exports = {
  title: 'ZWave To MQTT',
  storeDir: process.env.STORE_DIR || joinPath(true, 'store'),
  defaultUser: 'admin',
  defaultPsw: 'zwave',
  sessionSecret:
    process.env.SESSION_SECRET || 'DEFAULT_SESSION_SECRET_CHANGE_ME',
  base: '/',
  port: 8091
}
