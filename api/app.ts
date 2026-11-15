import type { Express, Request, RequestHandler, Response } from 'express'
import express from 'express'
import history from 'connect-history-api-fallback'
import cors from 'cors'
import compression from 'compression'
import morgan from 'morgan'
import store from './config/store.ts'
import { GatewayFactory } from './runtime/GatewayFactory.ts'
import hassDevices from './hass/devices.ts'
import jsonStore from './lib/jsonStore.ts'
import * as loggers from './lib/logger.ts'
<<<<<<< b8699475b929694dc42a654d72674bb20cca44da
=======
import { logContainer } from './lib/logger.ts'
import { loadCertKey } from './lib/tlsCert.ts'
import MqttClient from './lib/MqttClient.ts'
>>>>>>> 6098666744eb3d4de6c859b61168568bc61a4727
import SocketManager from './lib/SocketManager.ts'
import rateLimit, { MemoryStore } from 'express-rate-limit'
import session from 'express-session'
import type { Server as HttpServer } from 'node:http'
import { createServer as createHttpServer } from 'node:http'
import {
	createServer as createHttpsServer,
	Server as HttpsServer,
} from 'node:https'
import jwt from 'jsonwebtoken'
import type { VerifyErrors } from 'jsonwebtoken'
import path from 'node:path'
import sessionStore from 'session-file-store'
import type { Server as SocketIOServer, Socket } from 'socket.io'
import { inspect, promisify } from 'node:util'
import {
	defaultPsw,
	defaultUser,
	sessionSecret,
	sslDisabled,
	storeDir,
} from './config/app.ts'
import { socketEvents } from './lib/SocketEvents.ts'
import * as utils from './lib/utils.ts'
import {
	loadExternalSettings,
	mergeExternalSettings,
} from './lib/externalSettings.ts'
<<<<<<< b8699475b929694dc42a654d72674bb20cca44da
import { readFile, writeFile } from 'node:fs/promises'
import { generate } from 'selfsigned'
import { Driver } from 'zwave-js'
import debugManager from './lib/DebugManager.ts'
import { AppRuntime, isAuthEnabled } from './runtime/AppRuntime.ts'
import type { GatewayPort, ZnifferPort } from './runtime/ports.ts'
import type { JwtUserPayload } from './routes/auth.ts'
import { registerAuthRoutes } from './routes/auth.ts'
import { registerHealthRoutes } from './routes/health.ts'
import { registerSettingsRoutes } from './routes/settings.ts'
import { registerImportExportRoutes } from './routes/importExport.ts'
import { registerConfigurationTemplatesRoutes } from './routes/configurationTemplates.ts'
import { registerStoreRoutes } from './routes/store.ts'
import { registerDebugRoutes } from './routes/debug.ts'
import { registerSocketApi } from './socket/registerSocketApi.ts'

const createCertificate = promisify(generate)
=======
import {
	readFile,
	realpath,
	readdir,
	stat,
	rm,
	rename,
	writeFile,
	lstat,
	mkdir,
	mkdtemp,
	cp,
} from 'node:fs/promises'
import type { ZnifferConfig } from './lib/ZnifferManager.ts'
import ZnifferManager from './lib/ZnifferManager.ts'
import { getAllNamedScaleGroups, getAllSensors } from '@zwave-js/core'
import debugManager from './lib/DebugManager.ts'
import {
	getImportedNodeLocation,
	normalizeImportedNodesConfig,
} from './lib/importConfig.ts'
import {
	isTrustedRequest,
	isTrustedSocket,
	startTrustedListener,
} from './lib/trustedListener.ts'

declare module 'express-session' {
	export interface SessionData {
		user?: User
	}
}

function multerPromise(
	m: RequestHandler,
	req: Request,
	res: Response,
): Promise<void> {
	return new Promise((resolve, reject) => {
		m(req, res, (err: any) => {
			if (err) {
				reject(err as Error)
			} else {
				resolve()
			}
		})
	})
}

const Storage = diskStorage({
	async destination(reqD, file, callback) {
		await utils.ensureDir(tmpDir)
		callback(null, tmpDir)
	},
	filename(reqF, file, callback) {
		callback(null, file.originalname)
	},
})

const multerUpload = multer({
	storage: Storage,
}).array('upload', 1) // Field name and max count

>>>>>>> 6098666744eb3d4de6c859b61168568bc61a4727
const FileStore = sessionStore(session)

<<<<<<< b8699475b929694dc42a654d72674bb20cca44da
export interface AppInstance {
	app: Express
	attachSocket(server: HttpServer): void
	readonly io: SocketIOServer
	startServer: (port: number | string, host?: string) => Promise<HttpServer>
	loadSnippets(): Promise<void>
	installProcessHandlers: () => void
	close: () => Promise<void>
}

export interface CreateAppOptions {
	test?: {
		gateway?: GatewayPort
		zniffer?: ZnifferPort
		restarting?: boolean
		enumerateSerialPorts?: typeof Driver.enumerateSerialPorts
		logFatalError?: (message: string) => void
	}
}

function formatFatalErrorLog(
	eventName: 'uncaughtException' | 'unhandledRejection',
	reason: unknown,
): string {
	const label =
		eventName === 'uncaughtException'
			? 'Uncaught Exception'
			: 'Unhandled Rejection'
	const stack = reason instanceof Error ? reason.stack : undefined
	const message = reason instanceof Error ? reason.message : inspect(reason)
	return `${label}, reason: ${message}${stack ? `\n${stack}` : ''}`
}

export function createApp(options: CreateAppOptions = {}): AppInstance {
	const app = express()
	const logger = loggers.module('App')
	const testOptions =
		process.env.NODE_ENV === 'test' ? options.test : undefined

	const logFatalError =
		testOptions?.logFatalError ??
		((message: string) => logger.error(message))

	const storeLimiterStore = new MemoryStore()
	const loginLimiterStore = new MemoryStore()
	const apisLimiterStore = new MemoryStore()

	const storeLimiter = rateLimit({
		windowMs: 15 * 60 * 1000, // 15 minutes
		max: 100,
		store: storeLimiterStore,
		handler: function (req, res) {
=======
const verifyJWT = promisify(jwt.verify.bind(jwt))

// The trusted listener skips rate limiting: the host application is trusted,
// and over a unix socket req.ip is undefined which express-rate-limit rejects
const skipTrusted = (req: Request) => isTrustedRequest(req)

const storeLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100,
	skip: skipTrusted,
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
	skip: skipTrusted,
	handler: function (req, res) {
		res.json({ success: false, message: 'Max requests limit reached' })
	},
})

const apisLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // keep in memory for 1 hour
	max: 500, // start blocking after 500 requests
	skip: skipTrusted,
	handler: function (req, res) {
		res.json({ success: false, message: 'Max requests limit reached' })
	},
})

function sslDisabled() {
	return process.env.FORCE_DISABLE_SSL === 'true'
}

/**
 * Coerce a raw trust-proxy value into the type Express expects.
 * Accepts "true"/"false" (booleans), numeric strings (hop count),
 * and any other string (IP/CIDR list or preset name) verbatim.
 */
function parseTrustProxy(raw: string): boolean | number | string {
	const trimmed = raw.trim()
	if (trimmed === 'true') return true
	if (trimmed === 'false') return false
	if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10)
	return trimmed
}

/**
 * Configure Express `trust proxy` from the `TRUST_PROXY` env var.
 * An unset value leaves the default (false) in place.
 */
function configureTrustProxy() {
	const raw = process.env.TRUST_PROXY
	if (!raw) return
	const value = parseTrustProxy(raw)
	app.set('trust proxy', value)
	logger.info(`Express 'trust proxy' set to: ${value}`)
}

// apis response codes
const RESPONSE_CODES = {
	OK: 'OK',
	GENERAL_ERROR: 'General Error',
	INVALID: 'Invalid data',
	AUTH_FAILED: 'Authentication failed',
	PERMISSION_ERROR: 'Insufficient permissions',
} as const
type RESPONSE_CODES = (typeof RESPONSE_CODES)[keyof typeof RESPONSE_CODES]

export const socketManager = new SocketManager()

socketManager.authMiddleware = function (
	socket: Socket & { user?: User },
	next: (err?) => void,
) {
	if (isTrustedSocket(socket.request?.socket)) {
		next()
	} else if (!isAuthEnabled()) {
		next()
	} else if (socket.handshake.auth?.token || socket.handshake.query?.token) {
		const token = (socket.handshake.auth?.token ||
			socket.handshake.query.token) as string
		jwt.verify(token, sessionSecret, function (err, decoded: User) {
			if (err) return next(new Error('Authentication error'))
			socket.user = decoded
			next()
		})
	} else {
		next(new Error('Authentication error'))
	}
}

let gw: Gateway // the gateway instance
let zniffer: ZnifferManager // the zniffer instance
let trustedServer: HttpServer | undefined // the trusted (host API) listener
const plugins: CustomPlugin[] = []
let pluginsRouter: Router

// flag used to prevent multiple restarts while one is already in progress
let restarting = false

// ### UTILS

/**
 * Start http/https server and all the manager
 */
export async function startServer(port: number | string, host?: string) {
	let server: HttpServer

	const settings = jsonStore.get(store.settings)

	// Merge external settings into zwave config (if external settings exist)
	if (loadExternalSettings()) {
		settings.zwave ??= {}
		mergeExternalSettings(settings.zwave as Record<string, unknown>)
	}

	// as the really first thing setup loggers so all logs will go to file if specified in settings
	setupLogging(settings)

	configureTrustProxy()

	const httpsEnabled = process.env.HTTPS || settings?.gateway?.https

	if (httpsEnabled) {
		if (!sslDisabled()) {
			logger.info('HTTPS is enabled. Loading cert and keys')
			const { cert, key } = await loadCertKey(
				storeDir,
				process.env.SSL_CERTIFICATE,
				process.env.SSL_KEY,
			)

			if (cert && key) {
				server = createHttpsServer(
					{
						key,
						cert,
						rejectUnauthorized: false,
					},
					app,
				)
			} else {
				logger.warn(
					'HTTPS is enabled but cert or key cannot be generated. Falling back to HTTP',
				)
			}
		} else {
			logger.warn(
				'HTTPS enabled but FORCE_DISABLE_SSL env var is set. Falling back to HTTP',
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
			`Listening on ${bind}${host ? 'host ' + host : ''} protocol ${
				server instanceof HttpsServer ? 'HTTPS' : 'HTTP'
			}`,
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
	trustedServer = await startTrustedListener(app)
	if (trustedServer) {
		socketManager.attachServer(trustedServer)
	}
	setupInterceptor()
	await loadSnippets()
	startZniffer(settings.zniffer)
	await debugManager.init() // Clean up any old debug temp files
	await startGateway(settings)
}

const defaultSnippets: utils.Snippet[] = []

async function loadSnippets() {
	const localSnippetsDir = utils.joinPath(false, 'snippets')
	await utils.ensureDir(snippetsDir)

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
	const snippets: utils.Snippet[] = []
	for (const file of files) {
		const filePath = path.join(snippetsDir, file)

		if (await isSnippet(filePath)) {
			snippets.push({
				name: file.replace('.js', ''),
				content: await readFile(filePath, 'utf8'),
			})
		}
	}

	const snippetsCache = gw.zwave?.cacheSnippets ?? []
	return [...snippetsCache, ...defaultSnippets, ...snippets]
}

/**
 * Get the `path` param from a request. Throws if the path is not safe - that is if it escapes the storeDir.
 */
async function getSafePath(req: Request | string, resolveReal = true) {
	const reqPath = typeof req === 'string' ? req : req.query.path
	return utils.resolveSafeStorePath(reqPath, storeDir, resolveReal)
}

function setupLogging(settings: { gateway: utils.DeepPartial<GatewayConfig> }) {
	loggers.setupAll(settings ? settings.gateway : null)
}

async function startGateway(settings: Settings) {
	let mqtt: MqttClient
	let zwave: ZWaveClient

	if (isAuthEnabled() && !process.env.SESSION_SECRET) {
		logger.warn(
			'SESSION_SECRET env var is not set; using an auto-generated secret persisted in the store. ' +
				'Set SESSION_SECRET explicitly to control the secret across environments.',
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
				const constructor = (await import(plugin))
					.default as PluginConstructor
				const instance = createPlugin(
					constructor,
					pluginsContext,
					pluginName,
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

function startZniffer(settings: ZnifferConfig) {
	if (settings) {
		zniffer = new ZnifferManager(settings, socketManager.io)
	}
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
	loggers.logStream.on('data', (chunk) => {
		socketManager.io.to('debug').emit(socketEvents.debug, chunk.toString())
	})
}

async function parseDir(dir: string): Promise<StoreFileEntry[]> {
	const toReturn = []
	const files = await readdir(dir)
	for (const file of files) {
		try {
			const entry: StoreFileEntry = {
				name: path.basename(file),
				path: utils.joinPath(dir, file),
			}
			const stats = await lstat(entry.path)
			if (stats.isDirectory()) {
				if (entry.path === process.env.ZWAVEJS_EXTERNAL_CONFIG) {
					// hide config-db
					continue
				}
				entry.children = []
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
logger.info('Store path:' + storeDir)

app.use(
	morgan(
		':remote-addr :method :url :status :res[content-length] - :response-time ms',
		{
			stream: { write: (msg: string) => logger.info(msg.trimEnd()) },
		},
	) as RequestHandler,
)
// Enable compression for all responses
app.use(
	compression({
		threshold: 1024, // Only compress responses larger than 1KB
		level: 6, // Balanced compression level (0-9, higher = more compression but slower)
	}),
)
app.use(express.json({ limit: '5mb' }) as RequestHandler)
app.use(
	express.urlencoded({
		limit: '5mb',
		extended: true,
		parameterLimit: 50000,
	}) as RequestHandler,
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
	// @ts-expect-error types not matching
	history({
		index: '/',
	}),
)

// fix back compatibility with old history mode after switching to hash mode
const redirectPaths = [
	'/control-panel',
	'/smart-start',
	'/settings',
	'/scenes',
	'/debug',
	'/store',
	'/mesh',
]
app.use('/', (req, res, next) => {
	if (redirectPaths.includes(req.originalUrl)) {
		// get path when running behind a proxy
		const path = req.header('X-External-Path')?.replace(/\/$/, '') ?? ''

		res.redirect(`${path}/#${req.originalUrl}`)
	} else {
		next()
	}
})

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
	}),
)

// ### SOCKET SETUP

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
			let state = {} as any

			if (gw.zwave) {
				state = gw.zwave.getState()
			}

			if (zniffer) {
				state.zniffer = zniffer.status()
			}

			// Add debug session status
			state.debugCaptureActive = debugManager.isSessionActive()

			cb(state)
		})

		socket.on(
			inboundEvents.zwave,

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
			},
		)

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
							data.remove,
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

		socket.on(inboundEvents.subscribe, async (data, cb = noop) => {
			const channels: string[] = Array.isArray(data?.channels)
				? data.channels.filter((c: unknown) => typeof c === 'string')
				: []

			const isAll = channels.includes('all')
			const validChannels = isAll
				? ALL_CHANNELS
				: channels.filter((c) => Object.hasOwn(channelMap, c))

			for (const channel of validChannels) {
				await socket.join(channel)
			}

			// report current subscriptions (exclude socket's auto-joined room)
			const subscribed = [...socket.rooms].filter(
				(r) => r !== socket.id && Object.hasOwn(channelMap, r),
			)
			cb({ channels: subscribed })
		})

		socket.on(inboundEvents.unsubscribe, async (data, cb = noop) => {
			const channels: string[] = Array.isArray(data?.channels)
				? data.channels.filter((c: unknown) => typeof c === 'string')
				: []

			const validChannels = channels.filter((c) =>
				Object.hasOwn(channelMap, c),
			)

			for (const channel of validChannels) {
				await socket.leave(channel)
			}

			const subscribed = [...socket.rooms].filter(
				(r) => r !== socket.id && Object.hasOwn(channelMap, r),
			)
			cb({ channels: subscribed })
		})

		socket.on(inboundEvents.zniffer, async (data, cb = noop) => {
			logger.info(`Zniffer api call: ${data.api}`)

			let res: any, err: string
			try {
				switch (data.apiName) {
					case 'start':
						res = await zniffer.start()
						break
					case 'stop':
						res = await zniffer.stop()
						break
					case 'clear':
						res = zniffer.clear()
						break
					case 'getFrames':
						res = zniffer.getFrames()
						break
					case 'setFrequency':
						res = await zniffer.setFrequency(data.frequency)
						break
					case 'setLRChannelConfig':
						res = await zniffer.setLRChannelConfig(
							data.channelConfig,
						)
						break
					case 'saveCaptureToFile':
						res = await zniffer.saveCaptureToFile()
						break
					case 'loadCaptureFromBuffer': {
						const buffer = Buffer.from(data.buffer)
						res = zniffer.loadCaptureFromBuffer(buffer)
						break
					}
					default:
						throw new Error(`Unknown ZNIFFER api ${data.apiName}`)
				}
			} catch (error) {
				logger.error('Error while calling ZNIFFER api', error)
				err = (error as Error).message
			}

			const result = {
				success: !err,
				message: err || 'Success ZNIFFER api call',
				result: res,
				api: data.apiName,
			}

			cb(result)
		})
	})

	// emitted every time a new client connects/disconnects
	socketManager.on('clients', (event, activeSockets) => {
		if (event === 'connection' && activeSockets.size === 1) {
			gw.zwave?.setUserCallbacks()
		} else if (event === 'disconnect' && activeSockets.size === 0) {
			gw.zwave?.removeUserCallbacks()
		}
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
	if (isTrustedRequest(req) || req?.session?.user || !isAuthEnabled()) {
		return next()
	}

	// third-party cookies must be allowed in order to work
	try {
		const user = await parseJWT(req)
		req.session.user = user
		next()
	} catch (error) {
		logger.debug('Authentication failed', error)

		res.json({
			success: false,
			message: RESPONSE_CODES.GENERAL_ERROR,
			code: 3,
		})
	}
}

// logout the user
app.get('/api/auth-enabled', apisLimiter, function (req, res) {
	res.json({
		success: true,
		data: isTrustedRequest(req) ? false : isAuthEnabled(),
	})
})

// api to authenticate user
app.post('/api/authenticate', loginLimiter, async function (req, res) {
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

			if (user && !(await utils.verifyPsw(password, user.passwordHash))) {
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
				`User ${user.username} logged in successfully from ${req.ip}`,
			)
		} else {
			result.code = 3
			result.message = RESPONSE_CODES.GENERAL_ERROR
			logger.error(
				`User ${
					user?.username || req.body.username
				} failed to login from ${req.ip}: wrong credentials`,
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
			} failed to login from ${req.ip}: ${error.message}`,
		)
	}
})

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

			// don't leak the password hash to the client (mirrors /api/authenticate)
			const userData: User = Object.assign({}, oldUser)
			delete userData.passwordHash

			res.json({
				success: true,
				message: 'Password updated',
				user: userData,
			})
		} catch (error) {
>>>>>>> 6098666744eb3d4de6c859b61168568bc61a4727
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
		store: loginLimiterStore,
		handler: function (req, res) {
			res.json({ success: false, message: 'Max requests limit reached' })
		},
	})

	const apisLimiter = rateLimit({
		windowMs: 60 * 60 * 1000, // keep in memory for 1 hour
		max: 500, // start blocking after 500 requests
		store: apisLimiterStore,
		handler: function (req, res) {
			res.json({ success: false, message: 'Max requests limit reached' })
		},
	})

	/**
	 * Coerce a raw trust-proxy value into the type Express expects.
	 * Accepts "true"/"false" (booleans), numeric strings (hop count),
	 * and any other string (IP/CIDR list or preset name) verbatim.
	 */
	function parseTrustProxy(raw: string): boolean | number | string {
		const trimmed = raw.trim()
		if (trimmed === 'true') return true
		if (trimmed === 'false') return false
		if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10)
		return trimmed
	}

	/**
	 * Configure Express `trust proxy` from the `TRUST_PROXY` env var.
	 * An unset value leaves the default (false) in place.
	 */
	function configureTrustProxy() {
		const raw = process.env.TRUST_PROXY
		if (!raw) return
		const value = parseTrustProxy(raw)
		app.set('trust proxy', value)
		logger.info(`Express 'trust proxy' set to: ${value}`)
	}

	const socketManager = new SocketManager()

	const runtime = new AppRuntime({
		getSocketServer: () => socketManager.io,
		gatewayFactory: new GatewayFactory({
			storeDir,
			logger: loggers.module('HASS'),
			devices: hassDevices,
		}),
		gateway: testOptions?.gateway,
		zniffer: testOptions?.zniffer,
		restarting: testOptions?.restarting,
	})

	socketManager.authMiddleware = function (
		socket: Socket & { user?: JwtUserPayload },
		next: (err?: Error) => void,
	) {
		if (!isAuthEnabled()) {
			next()
		} else if (
			socket.handshake.auth?.token ||
			socket.handshake.query?.token
		) {
			const token = (socket.handshake.auth?.token ||
				socket.handshake.query.token) as string
			jwt.verify(
				token,
				sessionSecret,
				(err: VerifyErrors | null, decoded) => {
					if (err || !decoded || typeof decoded === 'string') {
						next(new Error('Authentication error'))
						return
					}
					socket.user = decoded as JwtUserPayload
					next()
				},
			)
		} else {
			next(new Error('Authentication error'))
		}
	}

	let logStreamInterceptor: ((chunk: Buffer | string) => void) | undefined

	// ### UTILS

	function installProcessHandlers() {
		if (runtime.isClosed) {
			throw new Error(
				'Cannot install process handlers after the app is closed',
			)
		}
		process.removeListener('uncaughtException', handleUncaughtException)
		process.on('uncaughtException', handleUncaughtException)
		process.removeListener('unhandledRejection', handleUnhandledRejection)
		process.on('unhandledRejection', handleUnhandledRejection)
		for (const signal of ['SIGINT', 'SIGTERM'] as NodeJS.Signals[]) {
			// Drop our own listener before re-adding so repeated calls can't stack duplicates
			process.removeListener(signal, gracefuShutdown)
			process.once(signal, gracefuShutdown)
		}
	}

	function uninstallProcessHandlers() {
		process.removeListener('uncaughtException', handleUncaughtException)
		process.removeListener('unhandledRejection', handleUnhandledRejection)
		process.removeListener('SIGINT', gracefuShutdown)
		process.removeListener('SIGTERM', gracefuShutdown)
	}

	/**
	 * Start http/https server and all the manager
	 */
	async function startServer(port: number | string, host?: string) {
		let server: HttpServer

		installProcessHandlers()

		try {
			const settings = jsonStore.get(store.settings)

			// Merge external settings into zwave config (if external settings exist)
			if (loadExternalSettings()) {
				settings.zwave ??= {}
				mergeExternalSettings(settings.zwave as Record<string, unknown>)
			}

			// as the really first thing setup loggers so all logs will go to file if specified in settings
			runtime.setupLogging(settings)

			configureTrustProxy()

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
							app,
						)
					} else {
						logger.warn(
							'HTTPS is enabled but cert or key cannot be generated. Falling back to HTTP',
						)
					}
				} else {
					logger.warn(
						'HTTPS enabled but FORCE_DISABLE_SSL env var is set. Falling back to HTTP',
					)
				}
			}

			if (!server) {
				server = createHttpServer(app)
			}

			attachSocket(server)
			server.listen(port as number, host, function () {
				const addr = server.address()
				const bind =
					typeof addr === 'string'
						? 'pipe ' + addr
						: 'port ' + addr?.port
				logger.info(
					`Listening on ${bind}${host ? 'host ' + host : ''} protocol ${
						httpsEnabled ? 'HTTPS' : 'HTTP'
					}`,
				)
			})

			server.on('error', function (error: NodeJS.ErrnoException) {
				if (error.syscall !== 'listen') {
					throw error
				}

				const bind =
					typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port

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

			const users = jsonStore.get(store.users)

			if (users.length === 0) {
				users.push({
					username: defaultUser,
					passwordHash: await utils.hashPsw(defaultPsw),
				})

				await jsonStore.put(store.users, users)
			}

			await runtime.loadSnippets()
			runtime.startZniffer(settings.zniffer)
			await debugManager.init() // Clean up any old debug temp files
			await runtime.startGateway(settings)

			return server
		} catch (error) {
			try {
				await close()
			} catch (cleanupError) {
				logger.error(
					'Error while cleaning up failed startup',
					cleanupError,
				)
			}
			throw error
		}
	}

	async function loadCertKey(): Promise<{
		cert: string
		key: string
	}> {
		const certFile =
			process.env.SSL_CERTIFICATE || utils.joinPath(storeDir, 'cert.pem')
		const keyFile =
			process.env.SSL_KEY || utils.joinPath(storeDir, 'key.pem')

		let key: string
		let cert: string

		try {
			cert = await readFile(certFile, 'utf8')
			key = await readFile(keyFile, 'utf8')
		} catch (error) {
			// noop
		}

		if (!cert || !key) {
			logger.info(
				'Cert and key not found in store, generating fresh new ones...',
			)

			try {
				const result = await createCertificate([], {
					days: 99999,
					keySize: 2048,
				})

				key = result.private
				cert = result.cert

				// restrict the private key (and cert) to the owner so a permissive
				// umask can't leave the self-signed TLS key world/group-readable
				await writeFile(utils.joinPath(storeDir, 'key.pem'), key, {
					mode: 0o600,
				})
				await writeFile(utils.joinPath(storeDir, 'cert.pem'), cert, {
					mode: 0o600,
				})
				logger.info('New cert and key created')
			} catch (error) {
				logger.error('Error creating cert and key for HTTPS', error)
			}
		}

		return { cert, key }
	}

	function setupInterceptor(server: HttpServer) {
		// Replace this instance's interceptor because the log stream is shared
		if (logStreamInterceptor) {
			loggers.logStream.off('data', logStreamInterceptor)
		}

		// intercept logs and redirect them to socket
		const interceptor: (chunk: Buffer | string) => void = (chunk) => {
			socketManager.io
				.to('debug')
				.emit(socketEvents.debug, chunk.toString())
		}
		logStreamInterceptor = interceptor
		loggers.logStream.on('data', interceptor)
		// The shared log stream can outlive multiple server instances.
		server.once('close', () => {
			loggers.logStream.off('data', interceptor)
		})
	}

	// ### EXPRESS SETUP

	logger.info(`Version: ${utils.getVersion()}`)
	logger.info('Application path:' + utils.getPath(true))
	logger.info('Store path:' + storeDir)

	app.use(
		morgan(
			':remote-addr :method :url :status :res[content-length] - :response-time ms',
			{
				stream: { write: (msg: string) => logger.info(msg.trimEnd()) },
			},
		) as RequestHandler,
	)
	// Enable compression for all responses
	app.use(
		compression({
			threshold: 1024, // Only compress responses larger than 1KB
			level: 6, // Balanced compression level (0-9, higher = more compression but slower)
		}),
	)
	app.use(express.json({ limit: '5mb' }) as RequestHandler)
	app.use(
		express.urlencoded({
			limit: '5mb',
			extended: true,
			parameterLimit: 50000,
		}) as RequestHandler,
	)

	// must be placed before history middleware
	app.use(function (req, res, next) {
		const pluginsRouter = runtime.pluginsRouter
		if (pluginsRouter !== undefined) {
			pluginsRouter(req, res, next)
		} else {
			next()
		}
	})

	app.use(
		// @ts-expect-error types not matching
		history({
			index: '/',
		}),
	)

	// fix back compatibility with old history mode after switching to hash mode
	const redirectPaths = [
		'/control-panel',
		'/smart-start',
		'/settings',
		'/scenes',
		'/debug',
		'/store',
		'/mesh',
	]
	app.use('/', (req, res, next) => {
		if (redirectPaths.includes(req.originalUrl)) {
			// get path when running behind a proxy
			const path = req.header('X-External-Path')?.replace(/\/$/, '') ?? ''

			res.redirect(`${path}/#${req.originalUrl}`)
		} else {
			next()
		}
	})

	app.use('/', express.static(utils.joinPath(false, 'dist')))

	app.use(cors({ credentials: true, origin: true }))

	const sessionStoreOptions: sessionStore.Options = {
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
	}

	// enable sessions management
	app.use(
		session({
			name: 'zwave-js-ui-session',
			secret: sessionSecret,
			resave: false,
			saveUninitialized: false,
			store: new FileStore(sessionStoreOptions),
			cookie: {
				secure: !!process.env.HTTPS || !!process.env.USE_SECURE_COOKIE,
				httpOnly: true, // prevents cookie to be sent by client javascript
				maxAge: 24 * 60 * 60 * 1000, // one day
			},
		}),
	)

	// ### SOCKET SETUP

	function setupSocket(server: HttpServer) {
		socketManager.bindServer(server)
		registerSocketApi(socketManager, runtime)
	}

	function attachSocket(server: HttpServer) {
		if (runtime.isClosed) {
			throw new Error('Cannot attach Socket.IO after the app is closed')
		}
		if (socketManager.io) {
			throw new Error('Socket.IO is already attached')
		}
		setupSocket(server)
		setupInterceptor(server)
	}

	// ### APIs

	registerAuthRoutes(app, { apisLimiter, loginLimiter })
	registerHealthRoutes(app, runtime, { apisLimiter })
	registerSettingsRoutes(app, runtime, {
		apisLimiter,
		enumerateSerialPorts:
			testOptions?.enumerateSerialPorts ??
			Driver.enumerateSerialPorts.bind(Driver),
	})
	registerImportExportRoutes(app, runtime, { apisLimiter })
	registerConfigurationTemplatesRoutes(app, runtime, { apisLimiter })
	registerStoreRoutes(app, runtime, { apisLimiter, storeLimiter })
	registerDebugRoutes(app, runtime, { apisLimiter })

	// ### ERROR HANDLERS

	interface HttpError extends NodeJS.ErrnoException {
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
		logger.error(
			`${req.method} ${req.url} ${err.status} - Error: ${err.message}`,
		)

		// render the error page
		res.status(err.status || 500)
		res.redirect('/')
	})

	async function close(): Promise<void> {
		if (runtime.isClosed) return

		uninstallProcessHandlers()

		if (logStreamInterceptor) {
			loggers.logStream.off('data', logStreamInterceptor)
			logStreamInterceptor = undefined
		}

		try {
			if (runtime.ownsDebugSession && debugManager.isSessionActive()) {
				// Release ownership before awaiting so a concurrent close()
				// can't cancel the same session twice
				runtime.setOwnsDebugSession(false)
				await debugManager.cancelSession()
			}
		} catch (error) {
			logger.error('Error while cancelling debug session', error)
		}

		try {
			await runtime.shutdown()
		} finally {
			storeLimiterStore.shutdown()
			loginLimiterStore.shutdown()
			apisLimiterStore.shutdown()
			clearInterval(sessionStoreOptions.reapIntervalObject)
			sessionStoreOptions.reapIntervalObject = undefined

			try {
				await socketManager.close()
			} catch (error) {
				logger.error('Error while closing socket.io server', error)
			}
		}
<<<<<<< b8699475b929694dc42a654d72674bb20cca44da
=======

		await archive.finalize()
	},
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
	},
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
			const folder = req.body.folder

			file = req.files[0]

			if (!file || !file.path) {
				throw Error('No file uploaded')
			}

			if (isRestore) {
				// Stage, reject symlinks escaping the store, then merge in.
				const stageDir = await mkdtemp(path.join(storeDir, '.restore-'))
				try {
					await extract(file.path, { dir: stageDir })
					await utils.assertNoEscapingSymlinks(stageDir, stageDir)
					await cp(stageDir, storeDir, {
						recursive: true,
						// keep in-store links (e.g. *_current.log) as links, don't copy their targets
						verbatimSymlinks: true,
					})
				} finally {
					await rm(stageDir, { recursive: true, force: true })
				}
			} else {
				const destinationPath = await getSafePath(
					path.join(storeDir, folder, file.originalname),
				)
				await rename(file.path, destinationPath)
			}

			res.json({ success: true })
		} catch (err) {
			res.json({ success: false, message: err.message })
		}

		if (file && isRestore) {
			await rm(file.path)
		}
	},
)

app.get(
	'/api/snippet',
	apisLimiter,
	isAuthenticated,
	async function (req, res) {
		try {
			const snippets = await getSnippets()
			res.json({ success: true, data: snippets })
		} catch (err) {
			res.json({ success: false, message: err.message })
		}
	},
)

// Debug capture endpoints
app.get('/api/debug/status', apisLimiter, isAuthenticated, function (req, res) {
	res.json({
		success: true,
		active: debugManager.isSessionActive(),
	})
})

app.post(
	'/api/debug/start',
	apisLimiter,
	isAuthenticated,
	async function (req, res) {
		try {
			if (debugManager.isSessionActive()) {
				return res.json({
					success: false,
					message: 'A debug session is already active',
				})
			}

			const settings: Settings =
				jsonStore.get(store.settings) || ({} as Settings)
			const originalLogLevel = settings.gateway?.logLevel || 'info'
			const restartDriver = req.body.restartDriver || false

			await debugManager.startSession(
				gw.zwave,
				originalLogLevel,
				restartDriver,
			)

			res.json({
				success: true,
				message: 'Debug capture started',
			})
		} catch (err) {
			logger.error('Error starting debug session:', err)
			res.json({
				success: false,
				message: err.message,
			})
		}
	},
)

app.post(
	'/api/debug/stop',
	apisLimiter,
	isAuthenticated,
	async function (req, res) {
		try {
			if (!debugManager.isSessionActive()) {
				return res.json({
					success: false,
					message: 'No active debug session',
				})
			}

			const nodeIds: number[] = req.body.nodeIds || []

			const { archive, cleanup } = await debugManager.stopSession(nodeIds)

			const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
			res.attachment(`zwave-debug-${timestamp}.zip`)
			res.setHeader('Content-Type', 'application/zip')

			// Clean up temp files after the archive has been sent
			archive.on('end', async () => {
				await cleanup()
			})

			archive.pipe(res)
		} catch (err) {
			logger.error('Error stopping debug session:', err)
			res.json({
				success: false,
				message: err.message,
			})
		}
	},
)

app.post(
	'/api/debug/cancel',
	apisLimiter,
	isAuthenticated,
	async function (req, res) {
		try {
			if (!debugManager.isSessionActive()) {
				return res.json({
					success: false,
					message: 'No active debug session',
				})
			}

			await debugManager.cancelSession()

			res.json({
				success: true,
				message: 'Debug capture cancelled',
			})
		} catch (err) {
			logger.error('Error cancelling debug session:', err)
			res.json({
				success: false,
				message: err.message,
			})
		}
	},
)

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
	logger.error(
		`${req.method} ${req.url} ${err.status} - Error: ${err.message}`,
	)

	// render the error page
	res.status(err.status || 500)
	res.redirect('/')
})

process.removeAllListeners('SIGINT')

async function gracefuShutdown() {
	logger.warn('Shutdown detected: closing clients...')
	try {
		if (trustedServer) {
			// Await the close so a unix socket file is unlinked before exit
			const server = trustedServer
			await new Promise((resolve) => server.close(resolve))
		}
		if (gw) await gw.close()
		await destroyPlugins()
	} catch (error) {
		logger.error('Error while closing clients', error)
>>>>>>> 6098666744eb3d4de6c859b61168568bc61a4727
	}

	async function gracefuShutdown() {
		logger.warn('Shutdown detected: closing clients...')
		try {
			await close()
		} catch (error) {
			logger.error('Error while closing clients', error)
		}

		return process.exit()
	}

	function handleUncaughtException(reason: unknown) {
		logFatalError(formatFatalErrorLog('uncaughtException', reason))
	}

	function handleUnhandledRejection(reason: unknown) {
		logFatalError(formatFatalErrorLog('unhandledRejection', reason))
	}

	return {
		app,
		attachSocket,
		get io() {
			if (!socketManager.io) {
				throw new Error('Socket.IO is not attached')
			}
			return socketManager.io
		},
		startServer,
		loadSnippets: () => runtime.loadSnippets(),
		installProcessHandlers,
		close,
	}
}
