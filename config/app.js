const { joinPath } = require('../lib/utils')
require('dotenv').config()

// config/app.js
module.exports = {
  title: 'ZWave To MQTT',
  storeDir: process.env.STORE_DIR || joinPath(true, 'store'),
  defaultUser: 'admin',
  defaultPsw: 'zwave',
  sessionSecret:
    process.env.SESSION_SECRET || 'DEFAULT_SESSION_SECRET_CHANGE_ME',
  base: '/',
  port: process.env.PORT || 8091,
  host: process.env.HOST || '0.0.0.0'
}
