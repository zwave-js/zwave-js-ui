const express = require('express')
const reqlib = require('app-root-path').require
const morgan = require('morgan')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const app = express()
const SerialPort = require('serialport')
const jsonStore = reqlib('/lib/jsonStore.js')
const cors = require('cors')
const ZWaveClient = reqlib('/lib/ZwaveClient')
const MqttClient = reqlib('/lib/MqttClient')
const Gateway = reqlib('/lib/Gateway')
const store = reqlib('config/store.js')
const loggers = reqlib('/lib/logger.js')
const logger = loggers.module('App')
const history = require('connect-history-api-fallback')
const SocketManager = reqlib('/lib/SocketManager')
const { inboundEvents, socketEvents } = reqlib('/lib/SocketManager.js')
const utils = reqlib('/lib/utils.js')
const renderIndex = reqlib('/lib/renderIndex')

const socketManager = new SocketManager()

let gw // the gateway instance

// flag used to prevent multiple restarts while one is already in progress
let restarting = false

// ### UTILS

function hasProperty (obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop)
}

function start (server) {
  setupSocket(server)
  setupInterceptor()
  startGateway()
}

// use a function so we don't mess the default settings object
const defaultSettings = () => {
  return {
    gateway: {
      logEnabled: true,
      logLevel: 'info',
      logToFile: false,
      logFilename: 'zwavejs2mqtt.log'
    }
  }
}

function setupLogging (settings) {
  settings = settings
    ? Object.assign(defaultSettings(), settings)
    : defaultSettings()
  loggers.setupAll(settings)
}

function startGateway () {
  const settings = jsonStore.get(store.settings)

  let mqtt
  let zwave

  setupLogging(settings)

  if (settings.mqtt) {
    mqtt = new MqttClient(settings.mqtt)
  }

  if (settings.zwave) {
    zwave = new ZWaveClient(settings.zwave, socketManager.io)
  }

  gw = new Gateway(settings.gateway, zwave, mqtt)

  gw.start()

  restarting = false
}

function setupInterceptor () {
  // intercept logs and redirect them to socket
  const interceptor = function (write) {
    return function (...args) {
      socketManager.io.emit('DEBUG', args[0].toString())
      write.apply(process.stdout, args)
    }
  }

  process.stdout.write = interceptor(process.stdout.write)
  process.stderr.write = interceptor(process.stderr.write)
}

// print actual application version (with git short sha is git is installed)
function printVersion () {
  let rev

  try {
    rev = require('child_process')
      .execSync('git rev-parse --short HEAD')
      .toString()
      .trim()
  } catch (error) {
    // git not installed
  }
  logger.info(
    `Version: ${require('./package.json').version}${rev ? '.' + rev : ''}`
  )
}

// ### EXPRESS SETUP

printVersion()
logger.info('Application path:' + utils.getPath(true))

// view engine setup
app.set('views', utils.joinPath(false, 'views'))
app.set('view engine', 'ejs')

app.use(morgan('dev', { stream: { write: msg => logger.info(msg.trimEnd()) } }))
app.use(bodyParser.json({ limit: '50mb' }))
app.use(
  bodyParser.urlencoded({
    limit: '50mb',
    extended: true,
    parameterLimit: 50000
  })
)
app.use(cookieParser())

app.use(
  history({
    index: '/'
  })
)

app.get('/', renderIndex)

app.use('/', express.static(utils.joinPath(false, 'dist')))

app.use(cors())

// ### SOCKET SETUP

/**
 * Binds socketManager to `server`
 *
 * @param {HttpServer} server
 */
function setupSocket (server) {
  server.on('listening', function () {
    const addr = server.address()
    const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port
    logger.info(`Listening on ${bind}`)
  })

  socketManager.bindServer(server)

  socketManager.on(inboundEvents.init, function (socket) {
    if (gw.zwave) {
      socket.emit(socketEvents.init, {
        nodes: gw.zwave.nodes,
        info: gw.zwave.ozwConfig,
        error: gw.zwave.error,
        cntStatus: gw.zwave.cntStatus
      })
    }
  })

  socketManager.on(inboundEvents.zwave, async function (socket, data) {
    logger.info(`Zwave api call: ${data.api} ${JSON.stringify(data.args)}`)
    if (gw.zwave) {
      const result = await gw.zwave.callApi(data.api, ...data.args)
      result.api = data.api
      socket.emit(socketEvents.api, result)
    }
  })

  socketManager.on(inboundEvents.hass, async function (socket, data) {
    logger.info(`Hass api call: ${data.apiName}`)
    switch (data.apiName) {
      case 'delete':
        gw.publishDiscovery(data.device, data.nodeId, true, true)
        break
      case 'discover':
        gw.publishDiscovery(data.device, data.nodeId, false, true)
        break
      case 'rediscoverNode':
        gw.rediscoverNode(data.nodeId)
        break
      case 'disableDiscovery':
        gw.disableDiscovery(data.nodeId)
        break
      case 'update':
        gw.zwave.updateDevice(data.device, data.nodeId)
        break
      case 'add':
        gw.zwave.addDevice(data.device, data.nodeId)
        break
      case 'store':
        await gw.zwave.storeDevices(data.devices, data.nodeId, data.remove)
        break
    }
  })
}

// ### APIs

app.get('/health', async function (req, res) {
  let mqtt = false
  let zwave = false

  if (gw) {
    mqtt = gw.mqtt ? gw.mqtt.getStatus().status : false
    zwave = gw.zwave ? gw.zwave.getStatus().status : false
  }

  const status = mqtt && zwave

  res.status(status ? 200 : 500).send(status ? 'Ok' : 'Error')
})

app.get('/health/:client', async function (req, res) {
  const client = req.params.client
  let status

  if (client !== 'zwave' && client !== 'mqtt') {
    res.status(500).send("Requested client doesn 't exist")
  } else {
    status = gw && gw[client] ? gw[client].getStatus().status : false
  }

  res.status(status ? 200 : 500).send(status ? 'Ok' : 'Error')
})

// get settings
app.get('/api/settings', async function (req, res) {
  const data = {
    success: true,
    settings: jsonStore.get(store.settings),
    devices: gw.zwave ? gw.zwave.devices : {},
    serial_ports: []
  }

  let ports
  if (process.platform !== 'sunos') {
    try {
      ports = await SerialPort.list()
    } catch (error) {
      logger.error(error)
    }

    data.serial_ports = ports ? ports.map(p => p.path) : []
    res.json(data)
  } else res.json(data)
})

// get config
app.get('/api/exportConfig', function (req, res) {
  return res.json({
    success: true,
    data: jsonStore.get(store.nodes),
    message: 'Successfully exported nodes JSON configuration'
  })
})

// import config
app.post('/api/importConfig', async function (req, res) {
  const config = req.body.data
  try {
    if (!gw.zwave) throw Error('Zwave client not inited')

    if (!Array.isArray(config)) throw Error('Configuration not valid')
    else {
      for (let i = 0; i < config.length; i++) {
        const e = config[i]
        if (e && (!hasProperty(e, 'name') || !hasProperty(e, 'loc'))) {
          throw Error('Configuration not valid')
        } else if (e) {
          await gw.zwave.callApi('_setNodeName', i, e.name || '')
          await gw.zwave.callApi('_setNodeLocation', i, e.loc || '')
          if (e.hassDevices) {
            await gw.zwave.storeDevices(e.hassDevices, i, false)
          }
        }
      }
    }

    res.json({ success: true, message: 'Configuration imported successfully' })
  } catch (error) {
    logger.error(error.message)
    return res.json({ success: false, message: error.message })
  }
})

// update settings
app.post('/api/settings', async function (req, res) {
  try {
    if (restarting) {
      throw Error(
        'Gateway is restarting, wait a moment before doing another request'
      )
    }
    restarting = true
    await jsonStore.put(store.settings, req.body)
    setupLogging(req.body)
    await gw.close()
    startGateway()
    res.json({ success: true, message: 'Configuration updated successfully' })
  } catch (error) {
    logger.error(error)
    res.json({ success: false, message: error.message })
  }
})

// ### ERROR HANDLERS

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  const err = new Error('Not Found')
  err.status = 404
  next(err)
})

// error handler
app.use(function (err, req, res) {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  logger.error(`${req.method} ${req.url} ${err.status} - Error: ${err.message}`)

  // render the error page
  res.status(err.status || 500)
  res.redirect('/')
})

process.removeAllListeners('SIGINT')

process.on('SIGINT', function () {
  logger.info('Closing clients...')
  gw.close()
    .catch(err => {
      logger.error('Error while closing clients', err)
    })
    .finally(() => {
      process.exit()
    })
})

module.exports = { app, start }
