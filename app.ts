import express, { Request, RequestHandler, Response, Router } from 'express'

import history from 'connect-history-api-fallback'
import cors from 'cors'
import csrf from 'csurf'
import morgan from 'morgan'
import store, { Settings, User } from './config/store'
import Gateway, { GatewayConfig } from './lib/Gateway'
import jsonStore from './lib/jsonStore'
import * as loggers from './lib/logger'
import MqttClient from './lib/MqttClient'
import SocketManager from './lib/SocketManager'
import ZWaveClient, {
	CallAPIResult,
	configManager,
	loadManager,
	SensorTypeScale,
} from './lib/ZwaveClient'
import multer, { diskStorage } from 'multer'
import extract from 'extract-zip'
import { serverVersion } from '@zwave-js/server'
import archiver from 'archiver'
import rateLimit from 'express-rate-limit'
import session from 'express-session'
import fs, { mkdirp, move, readdir, rm, stat } from 'fs-extra'
import { createServer as createHttpServer, Server as HttpServer } from 'http'
import { createServer as createHttpsServer } from 'https'
import jwt from 'jsonwebtoken'
import path from 'path'
import sessionStore from 'session-file-store'
import { Socket } from 'socket.io'
import { promisify } from 'util'
import { Driver, libVersion } from 'zwave-js'
import {
	defaultPsw,
	defaultUser,
	sessionSecret,
	snippetsDir,
	storeDir,
	tmpDir,
} from './config/app'
import {
	createPlugin,
	CustomPlugin,
	PluginConstructor,
} from './lib/CustomPlugin'
import renderIndex from './lib/renderIndex'
import { inboundEvents, socketEvents } from './lib/SocketEvents'
import * as utils from './lib/utils'
import backupManager from './lib/BackupManager'
import { readFile, realpath } from 'fs/promises'
import { generate } from 'selfsigned'
import { writeFile } from 'fs'

const createCertificate = promisify(generate)

declare module 'express-session' {
	export interface SessionData {
		user?: User
	}
}

function multerPromise(
	m: RequestHandler,
	req: Request,
	res: Response
): Promise<void> {
	return new Promise((resolve, reject) => {
		m(req, res, (err: any) => {
			if (err) {
				reject(err)
			} else {
				resolve()
			}
		})
	})
}

const Storage = diskStorage({
	async destination(reqD, file, callback) {
		await mkdirp(tmpDir)
		callback(null, tmpDir)
	},
	filename(reqF, file, callback) {
		callback(null, file.originalname)
	},
})

const multerUpload = multer({
	storage: Storage,
}).array('upload', 1) // Field name and max count

const FileStore = sessionStore(session)
const app = express()
const logger = loggers.module('App')

const verifyJWT = promisify(jwt.verify.bind(jwt))

const storeLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100,
	handler: function (req, res) {
		res.json({
			success: false,
			message:
				'Request limit reached. You can make only 100 requests every 15 minutes',
		})
	},
})

const loginLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // keep in memory for 1 hour
	max: 5, // start blocking after 5 requests
	handler: function (req, res) {
		res.json({ success: false, message: 'Max requests limit reached' })
	},
})

const apisLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // keep in memory for 1 hour
	max: 500, // start blocking after 500 requests
	handler: function (req, res) {
		res.json({ success: false, message: 'Max requests limit reached' })
	},
})

function sslDisabled() {
	return process.env.FORCE_DISABLE_SSL === 'true'
}

// apis response codes
enum RESPONSE_CODES {
	OK = 'OK',
	GENERAL_ERROR = 'General Error',
	INVALID = 'Invalid data',
	AUTH_FAILED = 'Authentication failed',
	PERMISSION_ERROR = 'Insufficient permissions',
}

const socketManager = new SocketManager()

socketManager.authMiddleware = function (
	socket: Socket & { user?: User },
	next: (err?) => void
) {
	if (!isAuthEnabled()) {
		next()
	} else if (socket.handshake.query && socket.handshake.query.token) {
		jwt.verify(
			socket.handshake.query.token as string,
			sessionSecret,
			function (err, decoded: User) {
				if (err) return next(new Error('Authentication error'))
				socket.user = decoded
				next()
			}
		)
	} else {
		next(new Error('Authentication error'))
	}
}

let gw: Gateway // the gateway instance
const plugins: CustomPlugin[] = []
let pluginsRouter: Router

// flag used to prevent multiple restarts while one is already in progress
let restarting = false

// ### UTILS

/**
 * Start http/https server and all the manager
 */
export async function startServer(host: string, port: number | string) {
	let server: HttpServer

	const settings = jsonStore.get(store.settings)

	// as the really first thing setup loggers so all logs will go to file if specified in settings
	setupLogging(settings)

	const httpsEnabled = process.env.HTTPS || settings?.gateway?.https

	if (httpsEnabled) {
		if (!sslDisabled()) {
			logger.info('HTTPS is enabled. Loading cert and keys')
			const { cert, key } = await loadCertKey()

			if (cert && key) {
				server = createHttpsServer(
					{
						key,
						cert,
						rejectUnauthorized: false,
					},
					app
				)
			} else {
				logger.warn(
					'HTTPS is enabled but cert or key cannot be generated. Falling back to HTTP'
				)
			}
		} else {
			logger.warn(
				'HTTPS enabled but FORCE_DISABLE_SSL env var is set. Falling back to HTTP'
			)
		}
	}

	if (!server) {
		server = createHttpServer(app)
	}

	server.listen(port as number, host, function () {
		const addr = server.address()
		const bind =
			typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr?.port
		logger.info(
			`Listening on ${bind} host ${host} protocol ${
				httpsEnabled ? 'HTTPS' : 'HTTP'
			}`
		)
	})

	server.on('error', function (error: utils.ErrnoException) {
		if (error.syscall !== 'listen') {
			throw error
		}

		const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port

		// handle specific listen errors with friendly messages
		switch (error.code) {
			case 'EACCES':
				logger.error(bind + ' requires elevated privileges')
				process.exit(1)
				break
			case 'EADDRINUSE':
				logger.error(bind + ' is already in use')
				process.exit(1)
				break
			default:
				throw error
		}
	})

	const users = jsonStore.get(store.users) as User[]

	if (users.length === 0) {
		users.push({
			username: defaultUser,
			passwordHash: await utils.hashPsw(defaultPsw),
		})

		await jsonStore.put(store.users, users)
	}

	setupSocket(server)
	setupInterceptor()
	await loadSnippets()
	await loadManager()
	await startGateway(settings)
}

interface Snippet {
	name: string
	content: string
}

const defaultSnippets: Snippet[] = []

async function loadSnippets() {
	const localSnippetsDir = utils.joinPath(false, 'snippets')
	await mkdirp(snippetsDir)

	const files = await readdir(localSnippetsDir)
	for (const file of files) {
		const filePath = path.join(localSnippetsDir, file)

		if (await isSnippet(filePath)) {
			const content = await readFile(filePath, 'utf8')
			const name = path.basename(filePath, '.js')
			defaultSnippets.push({ name, content })
		}
	}
}

async function isSnippet(file: string): Promise<boolean> {
	return (await stat(file)).isFile() && file.endsWith('.js')
}

async function getSnippets() {
	const files = await readdir(snippetsDir)
	const snippets: Snippet[] = []
	for (const file of files) {
		const filePath = path.join(snippetsDir, file)

		if (await isSnippet(filePath)) {
			snippets.push({
				name: file.replace('.js', ''),
				content: await readFile(filePath, 'utf8'),
			})
		}
	}
	return [...defaultSnippets, ...snippets]
}

/**
 * Get the `path` param from a request. Throws if the path is not safe
 */
function getSafePath(req: Request | string) {
	let reqPath = typeof req === 'string' ? req : req.query.path

	if (typeof reqPath !== 'string') {
		throw Error('Invalid path')
	}

	reqPath = path.normalize(reqPath)

	if (!reqPath.startsWith(storeDir) || reqPath === storeDir) {
		throw Error('Path not allowed')
	}

	return reqPath
}

async function loadCertKey(): Promise<{
	cert: string
	key: string
}> {
	const certFile =
		process.env.SSL_CERTIFICATE || utils.joinPath(storeDir, 'cert.pem')
	const keyFile = process.env.SSL_KEY || utils.joinPath(storeDir, 'key.pem')

	let key: string
	let cert: string

	try {
		cert = await fs.readFile(certFile, 'utf8')
		key = await fs.readFile(keyFile, 'utf8')
	} catch (error) {
		// noop
	}

	if (!cert || !key) {
		logger.info(
			'Cert and key not found in store, generating fresh new ones...'
		)

		try {
			const result = await createCertificate([], {
				days: 99999,
			})

			key = result.private
			cert = result.cert

			await fs.writeFile(utils.joinPath(storeDir, 'key.pem'), key)
			await fs.writeFile(utils.joinPath(storeDir, 'cert.pem'), cert)
			logger.info('New cert and key created')
		} catch (error) {
			logger.error('Error creating cert and key for HTTPS', error)
		}
	}

	return { cert, key }
}

function setupLogging(settings: { gateway: utils.DeepPartial<GatewayConfig> }) {
	loggers.setupAll(settings ? settings.gateway : null)
}

async function startGateway(settings: Settings) {
	let mqtt: MqttClient
	let zwave: ZWaveClient

	if (
		isAuthEnabled() &&
		sessionSecret === 'DEFAULT_SESSION_SECRET_CHANGE_ME'
	) {
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

	backupManager.init(zwave)

	gw = new Gateway(settings.gateway, zwave, mqtt)

	await gw.start()

	const pluginsConfig = settings.gateway?.plugins ?? null
	pluginsRouter = express.Router()

	// load custom plugins
	if (pluginsConfig && Array.isArray(pluginsConfig)) {
		for (const plugin of pluginsConfig) {
			try {
				const pluginName = path.basename(plugin)
				const pluginsContext = {
					zwave,
					mqtt,
					app: pluginsRouter,
					logger: loggers.module(pluginName),
				}
				const instance = createPlugin(
					// eslint-disable-next-line @typescript-eslint/no-var-requires
					require(plugin) as PluginConstructor,
					pluginsContext,
					pluginName
				)

				plugins.push(instance)
				logger.info(`Successfully loaded plugin ${instance.name}`)
			} catch (error) {
				logger.error(`Error while loading ${plugin} plugin`, error)
			}
		}
	}

	restarting = false
}

async function destroyPlugins() {
	while (plugins.length > 0) {
		const instance = plugins.pop()
		if (instance && typeof instance.destroy === 'function') {
			logger.info('Closing plugin ' + instance.name)
			await instance.destroy()
		}
	}
}

function setupInterceptor() {
	// intercept logs and redirect them to socket
	const interceptor = (
		write: (buffer: string | Uint8Array, cb?: (err?: Error) => void) => void
	) => {
		return function (...args: any[]): boolean {
			socketManager.io.emit(socketEvents.debug, args[0]?.toString())
			return write.apply(process.stdout, args)
		}
	}

	process.stdout.write = interceptor(
		process.stdout.write.bind(process.stdout)
	)
	process.stderr.write = interceptor(
		process.stderr.write.bind(process.stderr)
	)
}

async function parseDir(dir: string): Promise<StoreFileEntry[]> {
	const toReturn = []
	const files = await fs.readdir(dir)
	for (const file of files) {
		try {
			const entry: StoreFileEntry = {
				name: path.basename(file),
				path: utils.joinPath(dir, file),
			}
			const stats = await fs.lstat(entry.path)
			if (stats.isDirectory()) {
				if (entry.path === process.env.ZWAVEJS_EXTERNAL_CONFIG) {
					// hide config-db
					continue
				}
				entry.children = await parseDir(entry.path)
				sortStore(entry.children)
			} else {
				entry.ext = file.split('.').pop()
			}

			entry.size = utils.humanSize(stats.size)
			toReturn.push(entry)
		} catch (error) {
			logger.error(`Error while parsing ${file} in ${dir}`, error)
		}
	}

	sortStore(toReturn)

	return toReturn
}

/**
 *
 * Sort children folders first and files after
 */
function sortStore(store: StoreFileEntry[]) {
	return store.sort((a, b) => {
		if (a.children && !b.children) {
			return -1
		}
		if (!a.children && b.children) {
			return 1
		}
		return 0
	})
}

// ### EXPRESS SETUP

logger.info(`Version: ${utils.getVersion()}`)
logger.info('Application path:' + utils.getPath(true))

// view engine setup
app.set('views', utils.joinPath(false, 'views'))
app.set('view engine', 'ejs')

app.use(
	morgan(loggers.disableColors ? 'tiny' : 'dev', {
		stream: { write: (msg: string) => logger.info(msg.trimEnd()) },
	}) as RequestHandler
)
app.use(express.json({ limit: '50mb' }) as RequestHandler)
app.use(
	express.urlencoded({
		limit: '50mb',
		extended: true,
		parameterLimit: 50000,
	}) as RequestHandler
)

// must be placed before history middleware
app.use(function (req, res, next) {
	if (pluginsRouter !== undefined) {
		pluginsRouter(req, res, next)
	} else {
		next()
	}
})

app.use(
	history({
		index: '/',
	})
)

app.get('/', apisLimiter, renderIndex)

app.use('/', express.static(utils.joinPath(false, 'dist')))

app.use(cors({ credentials: true, origin: true }))

// enable sessions management
app.use(
	session({
		name: 'zwave-js-ui-session',
		secret: sessionSecret,
		resave: false,
		saveUninitialized: false,
		store: new FileStore({
			path: path.join(storeDir, 'sessions'),
			logFn: (...args: any[]) => {
				// skip ENOENT errors
				if (
					args &&
					args.filter((a) => a.indexOf('ENOENT') >= 0).length === 0
				) {
					logger.debug(args[0])
				}
			},
		}),
		cookie: {
			secure: !!process.env.HTTPS || !!process.env.USE_SECURE_COOKIE,
			httpOnly: true, // prevents cookie to be sent by client javascript
			maxAge: 24 * 60 * 60 * 1000, // one day
		},
	})
)

// Node.js CSRF protection middleware.
// Requires either a session middleware or cookie-parser to be initialized first.
const csrfProtection = csrf({
	value: (req) => req.csrfToken(),
})

// ### SOCKET SETUP

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {}

/**
 * Binds socketManager to `server`
 */
function setupSocket(server: HttpServer) {
	socketManager.bindServer(server)

	socketManager.io.on('connection', (socket) => {
		// Server: https://socket.io/docs/v4/server-application-structure/#all-event-handlers-are-registered-in-the-indexjs-file
		// Client: https://socket.io/docs/v4/client-api/#socketemiteventname-args
		socket.on(inboundEvents.init, (data, cb = noop) => {
			if (gw.zwave) {
				const state = gw.zwave.getState()
				cb(state)
			}
		})

		socket.on(
			inboundEvents.zwave,
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			async (data, cb = noop) => {
				if (gw.zwave) {
					if (!data.args) data.args = []
					const result: CallAPIResult<any> & {
						api?: string
					} = await gw.zwave.callApi(data.api, ...data.args)
					result.api = data.api
					cb(result)
				} else {
					cb({
						success: false,
						message: 'Zwave client not connected',
					})
				}
			}
		)

		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		socket.on(inboundEvents.mqtt, (data, cb = noop) => {
			logger.info(`Mqtt api call: ${data.api}`)

			let res: void, err: string

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
				result: res,
				api: data.api,
			}

			cb(result)
		})

		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		socket.on(inboundEvents.hass, async (data, cb = noop) => {
			logger.info(`Hass api call: ${data.apiName}`)

			let res: any, err: string
			try {
				switch (data.apiName) {
					case 'delete':
						res = gw.publishDiscovery(data.device, data.nodeId, {
							deleteDevice: true,
							forceUpdate: true,
						})
						break
					case 'discover':
						res = gw.publishDiscovery(data.device, data.nodeId, {
							deleteDevice: false,
							forceUpdate: true,
						})
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
				result: res,
				api: data.apiName,
			}

			cb(result)
		})
	})
}

// ### APIs

function isAuthEnabled() {
	const settings = jsonStore.get(store.settings) as Settings
	return settings.gateway?.authEnabled === true
}

async function parseJWT(req: Request) {
	// if not authenticated check if he has a valid token
	let token = req.headers['x-access-token'] || req.headers.authorization // Express headers are auto converted to lowercase
	token = Array.isArray(token) ? token[0] : token
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
	const users = jsonStore.get(store.users) as User[]

	const user = users.find((u) => u.username === decoded.username)

	if (user) {
		return user
	} else {
		throw Error('User not found')
	}
}

// middleware to check if user is authenticated
async function isAuthenticated(req: Request, res: Response, next: () => void) {
	// if user is authenticated in the session, carry on
	if (req?.session?.user || !isAuthEnabled()) {
		return next()
	}

	// third-party cookies must be allowed in order to work
	try {
		const user = await parseJWT(req)
		req.session.user = user
		next()
	} catch (error) {
		logger.debug('Authentication failed', error)
	}

	res.json({
		success: false,
		message: RESPONSE_CODES.GENERAL_ERROR,
		code: 3,
	})
}

// logout the user
app.get('/api/auth-enabled', apisLimiter, function (req, res) {
	res.json({ success: true, data: isAuthEnabled() })
})

// api to authenticate user
app.post(
	'/api/authenticate',
	loginLimiter,
	csrfProtection,
	async function (req, res) {
		const token = req.body.token
		let user: User

		try {
			// token auth, mostly used to restore sessions when user refresh the page
			if (token) {
				const decoded = await verifyJWT(token, sessionSecret)

				// Successfully authenticated, token is valid and the user _id of its content
				// is the same of the current session
				const users = jsonStore.get(store.users) as User[]

				user = users.find((u) => u.username === decoded.username)
			} else {
				// credentials auth
				const users = jsonStore.get(store.users) as User[]

				const username = req.body.username
				const password = req.body.password

				user = users.find((u) => u.username === username)

				if (
					user &&
					!(await utils.verifyPsw(password, user.passwordHash))
				) {
					user = null
				}
			}

			const result = {
				success: !!user,
				code: undefined,
				message: '',
				user: undefined,
			}

			if (result.success) {
				// don't edit the original user object, remove the password from jwt payload
				const userData: User = Object.assign({}, user)
				delete userData.passwordHash

				const token = jwt.sign(userData, sessionSecret, {
					expiresIn: '1d',
				})
				userData.token = token
				req.session.user = userData
				result.user = userData
				loginLimiter.resetKey(req.ip)
				logger.info(
					`User ${user.username} logged in successfully from ${req.ip}`
				)
			} else {
				result.code = 3
				result.message = RESPONSE_CODES.GENERAL_ERROR
				logger.error(
					`User ${
						user?.username || req.body.username
					} failed to login from ${req.ip}: wrong credentials`
				)
			}

			res.json(result)
		} catch (error) {
			res.json({
				success: false,
				message: 'Authentication failed',
				code: 3,
			})

			logger.error(
				`User ${
					user?.username || req.body.username
				} failed to login from ${req.ip}: ${error.message}`
			)
		}
	}
)

// logout the user
app.get('/api/logout', apisLimiter, isAuthenticated, function (req, res) {
	req.session.destroy((err) => {
		if (err) {
			res.json({ success: false, message: err.message })
		} else {
			res.json({ success: true, message: 'User logged out' })
		}
	})
})

// update user password
app.put(
	'/api/password',
	apisLimiter,
	csrfProtection,
	isAuthenticated,
	async function (req, res) {
		try {
			const users = jsonStore.get(store.users) as User[]

			const user = req.session.user
			const oldUser = users.find((u) => u.username === user.username)

			if (!oldUser) {
				return res.json({ success: false, message: 'User not found' })
			}

			if (
				!(await utils.verifyPsw(req.body.current, oldUser.passwordHash))
			) {
				return res.json({
					success: false,
					message: 'Current password is wrong',
				})
			}

			if (req.body.new !== req.body.confirmNew) {
				return res.json({
					success: false,
					message: "Passwords doesn't match",
				})
			}

			oldUser.passwordHash = await utils.hashPsw(req.body.new)

			req.session.user = oldUser

			await jsonStore.put(store.users, users)

			res.json({
				success: true,
				message: 'Password updated',
				user: oldUser,
			})
		} catch (error) {
			res.json({
				success: false,
				message: 'Error while updating passwords',
				error: error.message,
			})
			logger.error('Error while updating password', error)
		}
	}
)

app.get('/health', apisLimiter, function (req, res) {
	let mqtt: Record<string, any> | boolean
	let zwave: boolean

	if (gw) {
		mqtt = gw.mqtt?.getStatus() ?? false
		zwave = gw.zwave?.getStatus().status ?? false
	}

	// if mqtt is disabled, return true. Fixes #469
	if (mqtt && typeof mqtt !== 'boolean') {
		mqtt = mqtt.status || mqtt.config.disabled
	}

	const status = mqtt && zwave

	res.status(status ? 200 : 500).send(status ? 'Ok' : 'Error')
})

app.get('/health/:client', apisLimiter, function (req, res) {
	const client = req.params.client
	let status: boolean

	if (client !== 'zwave' && client !== 'mqtt') {
		res.status(500).send("Requested client doesn 't exist")
	} else {
		status = gw?.[client]?.getStatus().status ?? false
	}

	res.status(status ? 200 : 500).send(status ? 'Ok' : 'Error')
})

app.get('/version', apisLimiter, function (req, res) {
	res.json({
		appVersion: utils.getVersion(),
		zwavejs: libVersion,
		zwavejsServer: serverVersion,
	})
})

// get settings
app.get(
	'/api/settings',
	apisLimiter,
	isAuthenticated,
	async function (req, res) {
		const sensorTypes = configManager.sensorTypes
		const sensorScalesGroups = configManager.namedScales

		const scales: SensorTypeScale[] = []

		for (const [key, group] of sensorScalesGroups) {
			for (const [, scale] of group) {
				scales.push({
					key: key,
					sensor: group.name,
					unit: scale.unit,
					label: scale.label,
					description: scale.description,
				})
			}
		}

		for (const [, sensor] of sensorTypes) {
			for (const [, scale] of sensor.scales) {
				scales.push({
					key: sensor.key,
					sensor: sensor.label,
					label: scale.label,
					unit: scale.unit,
					description: scale.description,
				})
			}
		}

		const settings = jsonStore.get(store.settings)

		const data = {
			success: true,
			settings,
			devices: gw?.zwave?.devices ?? {},
			serial_ports: [],
			scales: scales,
			sslDisabled: sslDisabled(),
			deprecationWarning: process.env.TAG_NAME === 'zwavejs2mqtt',
		}

		if (process.platform !== 'sunos') {
			try {
				data.serial_ports = await Driver.enumerateSerialPorts()
			} catch (error) {
				logger.error(error)
				data.serial_ports = []
			}
			res.json(data)
		} else res.json(data)
	}
)

// update settings
app.post(
	'/api/settings',
	apisLimiter,
	isAuthenticated,
	async function (req, res) {
		try {
			if (restarting) {
				throw Error(
					'Gateway is restarting, wait a moment before doing another request'
				)
			}
			// TODO: validate settings using calss-validator
			const settings = req.body
			restarting = true
			await jsonStore.put(store.settings, settings)
			await gw.close()
			await destroyPlugins()
			// reload loggers settings
			setupLogging(settings)
			// restart clients and gateway
			await startGateway(settings)
			backupManager.init(gw.zwave)

			res.json({
				success: true,
				message: 'Configuration updated successfully',
				data: settings,
			})
		} catch (error) {
			logger.error(error)
			res.json({ success: false, message: error.message })
		}
	}
)

// update settings
app.post(
	'/api/statistics',
	apisLimiter,
	isAuthenticated,
	async function (req, res) {
		try {
			if (restarting) {
				throw Error(
					'Gateway is restarting, wait a moment before doing another request'
				)
			}
			const { enableStatistics } = req.body

			const settings: Settings =
				jsonStore.get(store.settings) || ({} as Settings)

			if (!settings.zwave) {
				settings.zwave = {}
			}

			settings.zwave.enableStatistics = enableStatistics
			settings.zwave.disclaimerVersion = 1

			await jsonStore.put(store.settings, settings)

			if (gw && gw.zwave) {
				if (enableStatistics) {
					gw.zwave.enableStatistics()
				} else {
					gw.zwave.disableStatistics()
				}
			}

			res.json({
				success: true,
				enabled: enableStatistics,
				message: 'Statistics configuration updated successfully',
			})
		} catch (error) {
			logger.error(error)
			res.json({ success: false, message: error.message })
		}
	}
)

// get config
app.get('/api/exportConfig', apisLimiter, isAuthenticated, function (req, res) {
	return res.json({
		success: true,
		data: jsonStore.get(store.nodes),
		message: 'Successfully exported nodes JSON configuration',
	})
})

// import config
app.post(
	'/api/importConfig',
	apisLimiter,
	isAuthenticated,
	async function (req, res) {
		let config = req.body.data
		try {
			if (!gw.zwave) throw Error('Z-Wave client not inited')

			// try convert to node object
			if (Array.isArray(config)) {
				const parsed = {}

				for (let i = 0; i < config.length; i++) {
					if (config[i]) {
						parsed[i] = config[i]
					}
				}

				config = parsed
			}

			for (const nodeId in config) {
				const node = config[nodeId]
				if (!node || typeof node !== 'object') continue

				// All API calls expect nodeId to be a number, so convert it here.
				const nodeIdNumber = Number(nodeId)
				if (utils.hasProperty(node, 'name')) {
					await gw.zwave.callApi(
						'setNodeName',
						nodeIdNumber,
						node.name || ''
					)
				}

				if (utils.hasProperty(node, 'loc')) {
					await gw.zwave.callApi(
						'setNodeLocation',
						nodeIdNumber,
						node.loc || ''
					)
				}

				if (node.hassDevices) {
					await gw.zwave.storeDevices(
						node.hassDevices,
						nodeIdNumber,
						false
					)
				}
			}

			res.json({
				success: true,
				message: 'Configuration imported successfully',
			})
		} catch (error) {
			logger.error(error.message)
			return res.json({ success: false, message: error.message })
		}
	}
)

interface StoreFileEntry {
	children?: StoreFileEntry[]
	name: string
	path: string
	ext?: string
	size?: string
	isRoot?: boolean
}

// if no path provided return all store dir files/folders, otherwise return the file content
app.get('/api/store', storeLimiter, isAuthenticated, async function (req, res) {
	try {
		let data: StoreFileEntry[] | string
		if (req.query.path) {
			const reqPath = getSafePath(req)
			// lgtm [js/path-injection]
			let stat = await fs.lstat(reqPath)

			// check symlink is secure
			if (stat.isSymbolicLink()) {
				const realPath = await realpath(reqPath)
				getSafePath(realPath)
				stat = await fs.lstat(realPath)
			}

			if (stat.isFile()) {
				// lgtm [js/path-injection]
				data = await fs.readFile(reqPath, 'utf8')
			} else {
				throw Error('Path is not a file')
			}
		} else {
			data = [
				{
					name: 'store',
					path: storeDir,
					isRoot: true,
					children: await parseDir(storeDir),
				},
			]
		}

		res.json({ success: true, data: data })
	} catch (error) {
		logger.error(error.message)
		return res.json({ success: false, message: error.message })
	}
})

app.put('/api/store', storeLimiter, isAuthenticated, async function (req, res) {
	try {
		const reqPath = getSafePath(req)

		const isNew = req.query.isNew === 'true'
		const isDirectory = req.query.isDirectory === 'true'

		if (!isNew) {
			// lgtm [js/path-injection]
			const stat = await fs.lstat(reqPath)

			if (!stat.isFile()) {
				throw Error('Path is not a file')
			}
		}

		if (!isDirectory) {
			// lgtm [js/path-injection]
			await fs.writeFile(reqPath, req.body.content, 'utf8')
		} else {
			// lgtm [js/path-injection]
			await fs.mkdir(reqPath)
		}

		res.json({ success: true })
	} catch (error) {
		logger.error(error.message)
		return res.json({ success: false, message: error.message })
	}
})

app.delete(
	'/api/store',
	storeLimiter,
	isAuthenticated,
	async function (req, res) {
		try {
			const reqPath = getSafePath(req)

			// lgtm [js/path-injection]
			await fs.remove(reqPath)

			res.json({ success: true })
		} catch (error) {
			logger.error(error.message)
			return res.json({ success: false, message: error.message })
		}
	}
)

app.put(
	'/api/store-multi',
	storeLimiter,
	isAuthenticated,
	async function (req, res) {
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
	}
)

app.post(
	'/api/store-multi',
	storeLimiter,
	isAuthenticated,
	async function (req, res) {
		const files = req.body.files || []

		const archive = archiver('zip')

		archive.on('error', function (err: utils.ErrnoException) {
			res.status(500).send({
				error: err.message,
			})
		})

		// on stream closed we can end the request
		archive.on('end', function () {
			logger.debug('zip archive ready')
		})

		// set the archive name
		res.attachment('zwave-js-ui-store.zip')
		res.setHeader('Content-Type', 'application/zip')

		// use res as stream so I don't need to create a temp file
		archive.pipe(res)

		for (const f of files) {
			const s = await fs.lstat(f)
			const name = f.replace(storeDir, '')
			if (s.isFile()) {
				archive.file(f, { name })
			} else if (s.isSymbolicLink()) {
				const targetPath = await realpath(f)
				try {
					// check path is secure, if so add it as file
					getSafePath(targetPath)
					archive.file(targetPath, { name })
				} catch (e) {
					// ignore
				}
			}
		}

		await archive.finalize()
	}
)

app.get(
	'/api/store/backup',
	storeLimiter,
	isAuthenticated,
	async function (req, res) {
		try {
			await jsonStore.backup(res)
		} catch (error) {
			res.status(500).send({
				error: error.message,
			})
		}
	}
)

app.post(
	'/api/store/upload',
	storeLimiter,
	isAuthenticated,
	async function (req, res) {
		let file: any
		let isRestore = false
		try {
			// read files from request
			await multerPromise(multerUpload, req, res)

			isRestore = req.body.restore === 'true'

			file = req.files[0]

			if (!file || !file.path) {
				throw Error('No file uploaded')
			}

			if (isRestore) {
				await extract(file.path, { dir: storeDir })
			} else {
				await move(file.path, path.join(storeDir, file.originalname))
			}

			res.json({ success: true })
		} catch (err) {
			res.json({ success: false, message: err.message })
		}

		if (file && isRestore) {
			await rm(file.path)
		}
	}
)

app.get('/api/snippet', apisLimiter, async function (req, res) {
	try {
		const snippets = await getSnippets()
		res.json({ success: true, data: snippets })
	} catch (err) {
		res.json({ success: false, message: err.message })
	}
})

// ### ERROR HANDLERS

interface HttpError extends utils.ErrnoException {
	status?: number
}

// catch 404 and forward to error handler
app.use(function (req, res, next) {
	const err: HttpError = new Error('Not Found')
	err.status = 404
	next(err)
})

// error handler
app.use(function (err: HttpError, req: Request, res: Response) {
	// set locals, only providing error in development
	res.locals.message = err.message
	res.locals.error = req.app.get('env') === 'development' ? err : {}

	logger.error(
		`${req.method} ${req.url} ${err.status} - Error: ${err.message}`
	)

	// render the error page
	res.status(err.status || 500)
	res.redirect('/')
})

process.removeAllListeners('SIGINT')

async function gracefuShutdown() {
	logger.warn('Shutdown detected: closing clients...')
	try {
		if (gw) await gw.close()
		await destroyPlugins()
	} catch (error) {
		logger.error('Error while closing clients', error)
	}

	return process.exit()
}

process.on('unhandledRejection', (reason) => {
	logger.error(`Unhandled Rejection, reason: ${reason}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
	// eslint-disable-next-line @typescript-eslint/no-misused-promises
	process.once(signal as NodeJS.Signals, gracefuShutdown)
}

export default app
