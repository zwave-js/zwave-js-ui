const { joinPath } = require('../lib/utils')
// config/app.js
module.exports = {
  title: 'ZWave To MQTT',
  storeDir: process.env.STORE_DIR || joinPath(true, 'store'),
  credentialsFile: 'credentials.json',
  credentialsKey: 'credentials.key',
  base: '/',
  port: 8091
}
