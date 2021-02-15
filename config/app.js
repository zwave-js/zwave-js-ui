const { joinPath } = require('../lib/utils')
// config/app.js
module.exports = {
  title: 'ZWave To MQTT',
  storeDir: process.env.STORE_DIR || joinPath(true, 'store'),
  credentialsFile: 'credentials.json',
  credentialsKey: 'credentials.key',
  defaultUser: 'admin',
  defaultPsw: 'zwave',
  sessionSecret: process.env.SESSION_SECRET || 'G1FoTIfjhsPO80MpJSUx9oaDDHueTkW1',
  base: '/',
  port: 8091
}
