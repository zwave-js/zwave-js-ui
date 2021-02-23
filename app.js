const express = require('express')
const reqlib = require('app-root-path').require
const morgan = require('morgan')
const bodyParser = require('body-parser')
const csrf = require('csurf')
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
const fs = require('fs-extra')
const path = require('path')
const { storeDir, sessionSecret, defaultUser, defaultPsw } = reqlib(
  'config/app.js'
)
const renderIndex = reqlib('/lib/renderIndex')
const session = require('express-session')
const archiver = require('archiver')
const { createCertificate } = require('pem').promisified
const rateLimit = require('express-rate-limit')
const jwt = require('jsonwebtoken')
const { promisify } = require('util')

const verifyJWT = promisify(jwt.verify.bind(jwt))

const storeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  handler: function (req, res) {
    res.json({
      success: false,
      message:
        'Request limit reached. You can make only 100 reqests every 15 minutes'
    })
  }
})

const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // keep in memory for 1 hour
  max: 5, // start blocking after 5 requests
  handler: function (req, res) {
    res.json({ success: false, message: 'Max requests limit reached' })
  }
})

const apisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // keep in memory for 1 hour
  max: 500, // start blocking after 500 requests
  handler: function (req, res) {
    res.json({ success: false, message: 'Max requests limit reached' })
  }
})

// apis response codes
const RESPONSE_CODES = {
  0: 'OK',
  1: 'General Error',
  2: 'Invalid data',
  3: 'Authentication failed',
  4: 'Insufficient permissions'
}

const socketManager = new SocketManager()

socketManager.authMiddleware = function (socket, next) {
  if (!isAuthEnabled()) {
    next()
  } else if (socket.handshake.query && socket.handshake.query.token) {
    jwt.verify(socket.handshake.query.token, sessionSecret, function (
      err,
      decoded
    ) {
      if (err) return next(new Error('Authentication error'))
      socket.user = decoded
      next()
    })
  } else {
    next(new Error('Authentication error'))
  }
}

let gw // the gateway instance

// flag used to prevent multiple restarts while one is already in progress
let restarting = false

// ### UTILS

/**
 * Start http/https server and all the manager
 *
 * @param {string} host
 * @param {number} port
 */
async function startServer (host, port) {
  let server

  const settings = jsonStore.get(store.settings)

  // as the really first thing setup loggers so all logs will go to file if specified in settings
  setupLogging(settings)

  if (process.env.HTTPS) {
    logger.info('HTTPS is enabled. Loading cert and keys from store...')
    const { cert, key } = await loadCertKey()
    server = require('https').createServer(
      {
        key,
        cert,
        rejectUnauthorized: false
      },
      app
    )
  } else {
    server = require('http').createServer(app)
  }

  server.listen(port, host, function () {
    const addr = server.address()
    const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port
    logger.info(
      `Listening on ${bind} host ${host} protocol ${
        process.env.HTTPS ? 'HTTPS' : 'HTTP'
      }`
    )
  })

  server.on('error', function (error) {
    if (error.syscall !== 'listen') {
      throw error
    }

    const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port

    // handle specific listen errors with friendly messages
    switch (error.code) {
      case 'EACCES':
        logger.error(bind + ' requires elevated privileges')
        process.exit(1)
      case 'EADDRINUSE':
        logger.error(bind + ' is already in use')
        process.exit(1)
      default:
        throw error
    }
  })

  const users = jsonStore.get(store.users)

  if (users.length === 0) {
    users.push({
      username: defaultUser,
      passwordHash: await utils.hashPsw(defaultPsw)
    })

    await jsonStore.put(store.users, users)
  }

  setupSocket(server)
  setupInterceptor()
  startGateway(settings)
}

/**
 * Get the `path` param from a request. Throws if the path is not safe
 *
 * @param {Express.Request} req
 * @returns {string} The path is it's safe, thorws otherwise
 */
function getSafePath (req) {
  let reqPath = req.params.path

  if (typeof reqPath !== 'string') {
    throw Error('Invalid path')
  }

  reqPath = path.normalize(reqPath)

  if (!reqPath.startsWith(storeDir)) {
    throw Error('Path not allowed')
  }

  return reqPath
}

async function loadCertKey () {
  const certFile = utils.joinPath(storeDir, 'cert.pem')
  const keyFile = utils.joinPath(storeDir, 'key.pem')

  let key
  let cert

  try {
    cert = await fs.readFile(certFile)
    key = await fs.readFile(keyFile)
  } catch (error) {}

  if (!cert || !key) {
    logger.info('Cert and key not found in store, generating fresh new ones...')

    const result = await createCertificate({
      days: 99999,
      selfSigned: true
    })

    key = result.serviceKey
    cert = result.certificate

    await fs.writeFile(keyFile, result.serviceKey)
    await fs.writeFile(certFile, result.certificate)
    logger.info('New cert and key created')
  }

  return { cert, key }
}

function setupLogging (settings) {
  loggers.setupAll(settings ? settings.gateway : null)
}

function startGateway (settings) {
  let mqtt
  let zwave

  if (isAuthEnabled() && sessionSecret === 'DEFAULT_SESSION_SECRET_CHANGE_ME') {
    logger.error(
      'Session secret is the default one. For security reasons you should change it by using SESSION_SECRET env var'
    )
  }

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

// ### EXPRESS SETUP

logger.info(`Version: ${utils.getVersion()}`)
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

app.use(
  history({
    index: '/'
  })
)

app.get('/', apisLimiter, renderIndex)

app.use('/', express.static(utils.joinPath(false, 'dist')))

app.use(cors({ credentials: true, origin: true }))

// enable sessions management
app.use(
  session({
    name: 'zwavejs2mqtt-session',
    secret: sessionSecret,
    resave: true,
    saveUninitialized: true,
    cookie: {
      secure: !!process.env.HTTPS || !!process.env.USE_SECURE_COOKIE,
      httpOnly: true, // prevents cookie to be sent by client javascript
      maxAge: 24 * 60 * 60 * 1000 // one day
    }
  })
)

// Node.js CSRF protection middleware.
// Requires either a session middleware or cookie-parser to be initialized first.
const csrfProtection = csrf({
  value: req => req.csrfToken()
})

// ### SOCKET SETUP

/**
 * Binds socketManager to `server`
 *
 * @param {HttpServer} server
 */
function setupSocket (server) {
  socketManager.bindServer(server)

  socketManager.on(inboundEvents.init, function (socket) {
    if (gw.zwave) {
      socket.emit(socketEvents.init, {
        nodes: gw.zwave.nodes,
        info: gw.zwave.getInfo(),
        error: gw.zwave.error,
        cntStatus: gw.zwave.cntStatus
      })
    }
  })

  socketManager.on(inboundEvents.zwave, async function (socket, data) {
    if (gw.zwave) {
      const result = await gw.zwave.callApi(data.api, ...data.args)
      result.api = data.api
      socket.emit(socketEvents.api, result)
    }
  })

  socketManager.on(inboundEvents.mqtt, async function (socket, data) {
    logger.info(`Mqtt api call: ${data.apiName}`)

    let res, err

    try {
      switch (data.api) {
        case 'updateNodeTopics':
          res = gw.updateNodeTopics(data.args[0])
          break
        case 'removeNodeRetained':
          res = gw.removeNodeRetained(data.args[0])
          break
        default:
          err = `Unknown MQTT api ${data.apiName}`
      }
    } catch (error) {
      logger.error('Error while calling MQTT api', error)
      err = error.message
    }

    const result = {
      success: !err,
      message: err || 'Success MQTT api call',
      result: res
    }
    result.api = data.api

    socket.emit(socketEvents.api, result)
  })

  socketManager.on(inboundEvents.hass, async function (socket, data) {
    logger.info(`Hass api call: ${data.apiName}`)

    let res, err
    try {
      switch (data.apiName) {
        case 'delete':
          res = gw.publishDiscovery(data.device, data.nodeId, true, true)
          break
        case 'discover':
          res = gw.publishDiscovery(data.device, data.nodeId, false, true)
          break
        case 'rediscoverNode':
          res = gw.rediscoverNode(data.nodeId)
          break
        case 'disableDiscovery':
          res = gw.disableDiscovery(data.nodeId)
          break
        case 'update':
          res = gw.zwave.updateDevice(data.device, data.nodeId)
          break
        case 'add':
          res = gw.zwave.addDevice(data.device, data.nodeId)
          break
        case 'store':
          res = await gw.zwave.storeDevices(
            data.devices,
            data.nodeId,
            data.remove
          )
          break
      }
    } catch (error) {
      logger.error('Error while calling HASS api', error)
      err = error.message
    }

    const result = {
      success: !err,
      message: err || 'Success HASS api call',
      result: res
    }
    result.api = data.apiName

    socket.emit(socketEvents.api, result)
  })
}

// ### APIs

function isAuthEnabled () {
  const settings = jsonStore.get(store.settings)
  return settings.gateway && settings.gateway.authEnabled === true
}

async function parseJWT (req) {
  // if not authenticated check if he has a valid token
  let token = req.headers['x-access-token'] || req.headers.authorization // Express headers are auto converted to lowercase
  if (token && token.startsWith('Bearer ')) {
    // Remove Bearer from string
    token = token.slice(7, token.length)
  }

  // third-party cookies must be allowed in order to work
  if (!token) {
    throw Error('Invalid token header')
  }
  const decoded = await verifyJWT(token, sessionSecret)

  // Successfully authenticated, token is valid and the user _id of its content
  // is the same of the current session
  const users = jsonStore.get(store.users)

  const user = users.find(u => u.username === decoded.username)

  if (user) {
    return user
  } else {
    throw Error('User not found')
  }
}

// middleware to check if user is authenticated
async function isAuthenticated (req, res, next) {
  // if user is authenticated in the session, carry on
  if (req.session.user || !isAuthEnabled()) {
    return next()
  }

  // third-party cookies must be allowed in order to work
  try {
    const user = await parseJWT(req)
    req.user = user
    next()
  } catch (error) {
    logger.debug('Authentication failed', error)
  }

  res.json({
    success: false,
    message: RESPONSE_CODES['3'],
    code: 3
  })
}

// logout the user
app.get('/api/auth-enabled', apisLimiter, async function (req, res) {
  res.json({ success: true, data: isAuthEnabled() })
})

// api to authenticate user
app.post('/api/authenticate', loginLimiter, csrfProtection, async function (
  req,
  res
) {
  const token = req.body.token
  let user

  try {
    // token auth, mostly used to restore sessions when user refresh the page
    if (token) {
      const decoded = await verifyJWT(token, sessionSecret)

      // Successfully authenticated, token is valid and the user _id of its content
      // is the same of the current session
      const users = jsonStore.get(store.users)

      user = users.find(u => u.username === decoded.username)
    } else {
      // credentials auth
      const users = jsonStore.get(store.users)

      const username = req.body.username
      const password = req.body.password

      user = users.find(u => u.username === username)

      if (user && !(await utils.verifyPsw(password, user.passwordHash))) {
        user = null
      }
    }

    const result = {
      success: !!user
    }

    if (result.success) {
      // don't edit the original user object, remove the password from jwt payload
      const userData = Object.assign({}, user)
      delete userData.passwordHash

      const token = jwt.sign(userData, sessionSecret, {
        expiresIn: '1d'
      })
      userData.token = token
      req.session.user = userData
      result.user = userData
      loginLimiter.resetKey(req.ip)
    } else {
      result.code = 3
      result.message = RESPONSE_CODES['3']
    }

    res.json(result)
  } catch (error) {
    res.json({ success: false, message: 'Authentication failed', code: 3 })
  }
})

// logout the user
app.get('/api/logout', apisLimiter, isAuthenticated, async function (req, res) {
  req.session.destroy()
  res.json({ success: true, message: 'User logged out' })
})

// update user password
app.put(
  '/api/password',
  apisLimiter,
  csrfProtection,
  isAuthenticated,
  async function (req, res) {
    try {
      const users = jsonStore.get(store.users)

      const user = req.session.user
      const oldUser = users.find(u => u._id === user._id)

      if (!oldUser) {
        return res.json({ success: false, message: 'User not found' })
      }

      if (!(await utils.verifyPsw(req.body.current, oldUser.passwordHash))) {
        return res.json({
          success: false,
          message: 'Current password is wrong'
        })
      }

      if (req.body.new !== req.body.confirmNew) {
        return res.json({ success: false, message: "Passwords doesn't match" })
      }

      oldUser.passwordHash = await utils.hashPsw(req.body.new)

      req.session.user = oldUser

      await jsonStore.put(store.users, users)

      res.json({ success: true, message: 'Password updated', user: oldUser })
    } catch (error) {
      res.json({
        success: false,
        message: 'Error while updating passwords',
        error: error.message
      })
      logger.error('Error while updating password', error)
    }
  }
)

app.get('/health', apisLimiter, async function (req, res) {
  let mqtt = false
  let zwave = false

  if (gw) {
    mqtt = gw.mqtt ? gw.mqtt.getStatus() : false
    zwave = gw.zwave ? gw.zwave.getStatus().status : false
  }

  // if mqtt is disabled, return true. Fixes #469
  if (mqtt) {
    mqtt = mqtt.status || mqtt.config.disabled
  }

  const status = mqtt && zwave

  res.status(status ? 200 : 500).send(status ? 'Ok' : 'Error')
})

app.get('/health/:client', apisLimiter, async function (req, res) {
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
app.get('/api/settings', apisLimiter, isAuthenticated, async function (
  req,
  res
) {
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
app.get('/api/exportConfig', apisLimiter, isAuthenticated, function (req, res) {
  return res.json({
    success: true,
    data: jsonStore.get(store.nodes),
    message: 'Successfully exported nodes JSON configuration'
  })
})

// import config
app.post('/api/importConfig', apisLimiter, isAuthenticated, async function (
  req,
  res
) {
  const config = req.body.data
  try {
    if (!gw.zwave) throw Error('Zwave client not inited')

    if (!Array.isArray(config)) throw Error('Configuration not valid')
    else {
      for (let i = 0; i < config.length; i++) {
        const e = config[i]
        if (
          e &&
          (!utils.hasProperty(e, 'name') || !utils.hasProperty(e, 'loc'))
        ) {
          continue
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

// get config
app.get('/api/store', storeLimiter, isAuthenticated, async function (req, res) {
  try {
    async function parseDir (dir) {
      const toReturn = []
      const files = await fs.readdir(dir)
      for (const file of files) {
        const entry = {
          name: path.basename(file),
          path: utils.joinPath(dir, file)
        }
        const stats = await fs.lstat(entry.path)
        if (stats.isDirectory()) {
          entry.children = await parseDir(entry.path)
        } else {
          entry.ext = file.split('.').pop()
        }

        entry.size = utils.humanSize(stats.size)
        toReturn.push(entry)
      }
      return toReturn
    }

    const data = await parseDir(storeDir)

    res.json({ success: true, data: data })
  } catch (error) {
    logger.error(error.message)
    return res.json({ success: false, message: error.message })
  }
})

app.get('/api/store/:path', storeLimiter, isAuthenticated, async function (
  req,
  res
) {
  try {
    const reqPath = getSafePath(req)

    const stat = await fs.lstat(reqPath)

    if (!stat.isFile()) {
      throw Error('Path is not a file')
    }

    const data = await fs.readFile(reqPath, 'utf8')

    res.json({ success: true, data: data })
  } catch (error) {
    logger.error(error.message)
    return res.json({ success: false, message: error.message })
  }
})

app.put('/api/store/:path', storeLimiter, isAuthenticated, async function (
  req,
  res
) {
  try {
    const reqPath = getSafePath(req)

    const stat = await fs.lstat(reqPath)

    if (!stat.isFile()) {
      throw Error('Path is not a file')
    }

    await fs.writeFile(reqPath, req.body.content, 'utf8')

    res.json({ success: true })
  } catch (error) {
    logger.error(error.message)
    return res.json({ success: false, message: error.message })
  }
})

app.delete('/api/store/:path', storeLimiter, isAuthenticated, async function (
  req,
  res
) {
  try {
    const reqPath = getSafePath(req)

    await fs.remove(reqPath)

    res.json({ success: true })
  } catch (error) {
    logger.error(error.message)
    return res.json({ success: false, message: error.message })
  }
})

app.put('/api/store-multi', storeLimiter, isAuthenticated, async function (
  req,
  res
) {
  try {
    const files = req.body.files || []
    for (const f of files) {
      await fs.remove(f)
    }
    res.json({ success: true })
  } catch (error) {
    logger.error(error.message)
    return res.json({ success: false, message: error.message })
  }
})

app.post('/api/store-multi', storeLimiter, isAuthenticated, function (
  req,
  res
) {
  const files = req.body.files || []

  const archive = archiver('zip')

  archive.on('error', function (err) {
    res.status(500).send({
      error: err.message
    })
  })

  // on stream closed we can end the request
  archive.on('end', function () {
    logger.debug('zip archive ready')
  })

  // set the archive name
  res.attachment('zwavejs2mqtt-store.zip')
  res.setHeader('Content-Type', 'application/zip')

  // use res as stream so I don't need to create a temp file
  archive.pipe(res)

  for (const f of files) {
    archive.file(f, { name: f.replace(storeDir, '') })
  }

  archive.finalize()
})

// update settings
app.post('/api/settings', apisLimiter, isAuthenticated, async function (
  req,
  res
) {
  try {
    if (restarting) {
      throw Error(
        'Gateway is restarting, wait a moment before doing another request'
      )
    }
    // TODO: validate settings using ajv
    const settings = req.body
    restarting = true
    await jsonStore.put(store.settings, settings)
    await gw.close()
    // reload loggers settings
    setupLogging(settings)
    // restart clients and gateway
    startGateway(settings)
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: settings
    })
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

async function gracefuShutdown () {
  logger.warn('Shutdown detected: closing clients...')
  try {
    await gw.close()
  } catch (error) {
    logger.error('Error while closing clients', error)
  }

  return process.exit()
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, gracefuShutdown)
}

module.exports = { app, startServer }
