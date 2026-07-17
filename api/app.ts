import type { Express, Request, RequestHandler, Response } from 'express'
import express from 'express'
import history from 'connect-history-api-fallback'
import cors from 'cors'
import compression from 'compression'
import morgan from 'morgan'
import store from './config/store.ts'
import jsonStore from './lib/jsonStore.ts'
import * as loggers from './lib/logger.ts'
import SocketManager from './lib/SocketManager.ts'
import type { CallAPIResult } from './lib/ZwaveClient.ts'
import rateLimit from 'express-rate-limit'
import session from 'express-session'
import type { Server as HttpServer } from 'node:http'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
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
import {
	ALL_CHANNELS,
	channelMap,
	inboundEvents,
	socketEvents,
} from './lib/SocketEvents.ts'
import * as utils from './lib/utils.ts'
import {
	loadExternalSettings,
	mergeExternalSettings,
} from './lib/externalSettings.ts'
import { readFile, writeFile } from 'node:fs/promises'
import { generate } from 'selfsigned'
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

const createCertificate = promisify(generate)
const FileStore = sessionStore(session)

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

	let closed = false
	let socketAttached = false
	let logStreamInterceptor: ((chunk: Buffer | string) => void) | undefined

	// ### UTILS

	function installProcessHandlers() {
		if (closed) {
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
		const pluginsRouter = runtime.getPluginsRouter()
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
						args.filter((a) => a.indexOf('ENOENT') >= 0).length ===
							0
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
				const currentGw = runtime.requireGateway()
				const currentZniffer = runtime.getZniffer()
				cb({
					...(currentGw.zwave?.getState() ?? {}),
					...(currentZniffer
						? { zniffer: currentZniffer.status() }
						: {}),
					debugCaptureActive: debugManager.isSessionActive(),
				})
			})

			socket.on(
				inboundEvents.zwave,

				async (data, cb = noop) => {
					const currentGw = runtime.requireGateway()
					if (currentGw.zwave) {
						if (!data.args) data.args = []
						const result: CallAPIResult<any> & {
							api?: string
						} = await currentGw.zwave.callApi(
							data.api,
							...data.args,
						)
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
							res = runtime
								.requireGateway()
								.updateNodeTopics(data.args[0])
							break
						case 'removeNodeRetained':
							res = runtime
								.requireGateway()
								.removeNodeRetained(data.args[0])
							break
						default:
							err = `Unknown MQTT api ${data.api}`
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
							res = runtime
								.requireGateway()
								.publishDiscovery(data.device, data.nodeId, {
									deleteDevice: true,
									forceUpdate: true,
								})
							break
						case 'discover':
							res = runtime
								.requireGateway()
								.publishDiscovery(data.device, data.nodeId, {
									deleteDevice: false,
									forceUpdate: true,
								})
							break
						case 'rediscoverNode':
							res = runtime
								.requireGateway()
								.rediscoverNode(data.nodeId)
							break
						case 'disableDiscovery':
							res = runtime
								.requireGateway()
								.disableDiscovery(data.nodeId)
							break
						case 'update':
							res = runtime
								.requireZwaveClient()
								.updateDevice(data.device, data.nodeId)
							break
						case 'add':
							res = runtime
								.requireZwaveClient()
								.addDevice(data.device, data.nodeId)
							break
						case 'store':
							res = await runtime
								.requireZwaveClient()
								.storeDevices(
									data.devices,
									data.nodeId,
									data.remove,
								)
							break
						default:
							throw new Error(`Unknown HASS api ${data.apiName}`)
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
					? data.channels.filter(
							(c: unknown) => typeof c === 'string',
						)
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
					? data.channels.filter(
							(c: unknown) => typeof c === 'string',
						)
					: []

				const isAll = channels.includes('all')
				const validChannels = isAll
					? ALL_CHANNELS
					: channels.filter((c) => Object.hasOwn(channelMap, c))

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
							res = await runtime.requireZniffer().start()
							break
						case 'stop':
							res = await runtime.requireZniffer().stop()
							break
						case 'clear':
							res = runtime.requireZniffer().clear()
							break
						case 'getFrames':
							res = runtime.requireZniffer().getFrames()
							break
						case 'setFrequency':
							res = await runtime
								.requireZniffer()
								.setFrequency(data.frequency)
							break
						case 'setLRChannelConfig':
							res = await runtime
								.requireZniffer()
								.setLRChannelConfig(data.channelConfig)
							break
						case 'saveCaptureToFile':
							res = await runtime
								.requireZniffer()
								.saveCaptureToFile()
							break
						case 'loadCaptureFromBuffer': {
							const buffer = Buffer.from(data.buffer)
							res = await runtime
								.requireZniffer()
								.loadCaptureFromBuffer(buffer)
							break
						}
						default:
							throw new Error(
								`Unknown ZNIFFER api ${data.apiName}`,
							)
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
			const currentGw = runtime.requireGateway()
			if (event === 'connection' && activeSockets.size === 1) {
				currentGw.zwave?.setUserCallbacks()
			} else if (event === 'disconnect' && activeSockets.size === 0) {
				currentGw.zwave?.removeUserCallbacks()
			}
		})
	}

	function attachSocket(server: HttpServer) {
		if (closed) {
			throw new Error('Cannot attach Socket.IO after the app is closed')
		}
		if (socketAttached) {
			throw new Error('Socket.IO is already attached')
		}
		socketAttached = true
		setupSocket(server)
		setupInterceptor(server)
	}

	// ### APIs

	registerAuthRoutes(app, { apisLimiter, loginLimiter })
	registerHealthRoutes(app, runtime, { apisLimiter })
	registerSettingsRoutes(app, runtime, { apisLimiter })
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
		if (closed) return
		closed = true

		uninstallProcessHandlers()

		if (logStreamInterceptor) {
			loggers.logStream.off('data', logStreamInterceptor)
			logStreamInterceptor = undefined
		}

		try {
			if (
				runtime.isOwningDebugSession() &&
				debugManager.isSessionActive()
			) {
				await debugManager.cancelSession()
				runtime.setOwnsDebugSession(false)
			}
		} catch (error) {
			logger.error('Error while cancelling debug session', error)
		}

		await runtime.shutdown()

		try {
			await socketManager.close()
		} catch (error) {
			logger.error('Error while closing socket.io server', error)
		}
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
