var express = require('express')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'reqlib'.
var reqlib = require('app-root-path').require
var logger = require('morgan')
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')
var app = express()
var SerialPort = require('serialport')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'jsonStore'... Remove this comment to see the full error message
var jsonStore = reqlib('/lib/jsonStore.js')
var cors = require('cors')
var ZWaveClient = reqlib('/lib/ZwaveClient')
// @ts-expect-error ts-migrate(2300) FIXME: Duplicate identifier 'MqttClient'.
var MqttClient = reqlib('/lib/MqttClient')
// @ts-expect-error ts-migrate(2300) FIXME: Duplicate identifier 'Gateway'.
var Gateway = reqlib('/lib/Gateway')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'store'.
var store = reqlib('config/store.js')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'debug'.
var debug = reqlib('/lib/debug')('App')
// @ts-expect-error ts-migrate(2403) FIXME: Subsequent variable declarations must have the sam... Remove this comment to see the full error message
var history = require('connect-history-api-fallback')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'utils'.
var utils = reqlib('/lib/utils.js')
const renderIndex = reqlib('/lib/renderIndex')
var gw: any // the gateway instance
let io: any

debug('zwavejs2mqtt version: ' + require('./package.json').version)
debug('Application path:' + utils.getPath(true))

// view engine setup
app.set('views', utils.joinPath(false, 'views'))
app.set('view engine', 'ejs')

app.use(logger('dev'))
app.use(bodyParser.json({ limit: '50mb' }))
app.use(
  bodyParser.urlencoded({
    limit: '50mb',
    extended: true,
    parameterLimit: 50000
  })
)
app.use(cookieParser())

app.get('/', renderIndex)

app.use('/', express.static(utils.joinPath(false, 'dist')))

app.use(cors())

// @ts-expect-error ts-migrate(2349) FIXME: This expression is not callable.
app.use(history())

function startGateway () {
  var settings = jsonStore.get(store.settings)

  var mqtt, zwave

  if (settings.mqtt) {
    mqtt = new MqttClient(settings.mqtt)
  }

  if (settings.zwave) {
    zwave = new ZWaveClient(settings.zwave, io)
  }

  gw = new Gateway(settings.gateway, zwave, mqtt)
}

app.startSocket = function (server: any) {
  io = require('socket.io')(server)

  if (gw.zwave) gw.zwave.socket = io

  io.on('connection', function (socket: any) {
    debug('New connection', socket.id)

    socket.on('INITED', function () {
      if (gw.zwave) {
        socket.emit(gw.zwave.socketEvents.init, {
          nodes: gw.zwave.nodes,
          info: gw.zwave.ozwConfig,
          error: gw.zwave.error,
          cntStatus: gw.zwave.cntStatus
        })
      }
    })

    socket.on('ZWAVE_API', async function (data: any) {
      debug('Zwave api call:', data.api, data.args)
      if (gw.zwave) {
        var result = await gw.zwave.callApi(data.api, ...data.args)
        result.api = data.api
        socket.emit(gw.zwave.socketEvents.api, result)
      }
    })

    socket.on('HASS_API', async function (data: any) {
      switch (data.apiName) {
        case 'delete':
          gw.publishDiscovery(data.device, data.node_id, true, true)
          break
        case 'discover':
          gw.publishDiscovery(data.device, data.node_id, false, true)
          break
        case 'rediscoverNode':
          gw.rediscoverNode(data.node_id)
          break
        case 'disableDiscovery':
          gw.disableDiscovery(data.node_id)
          break
        case 'update':
          gw.zwave.updateDevice(data.device, data.node_id)
          break
        case 'add':
          gw.zwave.addDevice(data.device, data.node_id)
          break
        case 'store':
          await gw.zwave.storeDevices(data.devices, data.node_id, data.remove)
          break
      }
    })

    socket.on('disconnect', function () {
      debug('User disconnected', socket.id)
    })
  })

  const interceptor = function (write: any) {
    // @ts-expect-error ts-migrate(7019) FIXME: Rest parameter 'args' implicitly has an 'any[]' ty... Remove this comment to see the full error message
    return function (...args) {
      io.emit('DEBUG', args[0].toString())
      write.apply(process.stdout, args)
    }
  }

  // @ts-expect-error ts-migrate(2322) FIXME: Type '(...args: any[]) => void' is not assignable ... Remove this comment to see the full error message
  process.stdout.write = interceptor(process.stdout.write)
  // @ts-expect-error ts-migrate(2322) FIXME: Type '(...args: any[]) => void' is not assignable ... Remove this comment to see the full error message
  process.stderr.write = interceptor(process.stderr.write)
}

// ----- APIs ------

app.get('/health', async function (req: any, res: any) {
  var mqtt = false
  var zwave = false

  if (gw) {
    mqtt = gw.mqtt ? gw.mqtt.getStatus().status : false
    zwave = gw.zwave ? gw.zwave.getStatus().status : false
  }

  var status = mqtt && zwave

  res.status(status ? 200 : 500).send(status ? 'Ok' : 'Error')
})

app.get('/health/:client', async function (req: any, res: any) {
  var client = req.params.client
  var status

  if (client !== 'zwave' && client !== 'mqtt') {
    res.status(500).send("Requested client doesn 't exist")
  } else {
    status = gw && gw[client] ? gw[client].getStatus().status : false
  }

  res.status(status ? 200 : 500).send(status ? 'Ok' : 'Error')
})

// get settings
app.get('/api/settings', async function (req: any, res: any) {
  var data = {
    success: true,
    settings: jsonStore.get(store.settings),
    devices: gw.zwave ? gw.zwave.devices : {},
    serial_ports: []
  }
  if (process.platform !== 'sunos') {
    try {
      var ports = await SerialPort.list()
    } catch (error) {
      debug(error)
    }

    data.serial_ports = ports ? ports.map((p: any) => p.path) : []
    res.json(data)
  } else res.json(data)
})

// get config
app.get('/api/exportConfig', function (req: any, res: any) {
  return res.json({
    success: true,
    data: jsonStore.get(store.nodes),
    message: 'Successfully exported nodes JSON configuration'
  })
})

// import config
app.post('/api/importConfig', async function (req: any, res: any) {
  var config = req.body.data
  try {
    if (!gw.zwave) throw Error('Zwave client not inited')

    if (!Array.isArray(config)) throw Error('Configuration not valid')
    else {
      for (let i = 0; i < config.length; i++) {
        const e = config[i]
        if (e && (!e.hasOwnProperty('name') || !e.hasOwnProperty('loc'))) {
          throw Error('Configuration not valid')
        } else if (e) {
          await gw.zwave.callApi('_setNodeName', i, e.name || '')
          await gw.zwave.callApi('_setNodeLocation', i, e.loc || '')
          if (e.hassDevices)
            await gw.zwave.storeDevices(e.hassDevices, i, false)
        }
      }
    }

    res.json({ success: true, message: 'Configuration imported successfully' })
  } catch (error) {
    debug(error.message)
    return res.json({ success: false, message: error.message })
  }
})

// update settings
app.post('/api/settings', function (req: any, res: any) {
  jsonStore
    .put(store.settings, req.body)
    .then((data: any) => {
      res.json({ success: true, message: 'Configuration updated successfully' })
      return gw.close()
    })
    .then(() => startGateway())
    .catch((err: any) => {
      debug(err)
      res.json({ success: false, message: err.message })
    })
})

// catch 404 and forward to error handler
app.use(function (req: any, res: any, next: any) {
  var err = new Error('Not Found')
  // @ts-expect-error ts-migrate(2339) FIXME: Property 'status' does not exist on type 'Error'.
  err.status = 404
  next(err)
})

// error handler
app.use(function (err: any, req: any, res: any, next: any) {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  console.log(
    '%s %s %d - Error: %s',
    req.method,
    req.url,
    err.status,
    err.message
  )

  // render the error page
  res.status(err.status || 500)
  res.redirect('/')
})

startGateway()

process.removeAllListeners('SIGINT')

process.on('SIGINT', function () {
  debug('Closing...')
  gw.close()
  process.exit()
})

module.exports = app
