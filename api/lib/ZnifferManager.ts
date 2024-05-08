import { CommandClass, Frame, Zniffer, ZnifferOptions } from 'zwave-js'
import { TypedEventEmitter } from './EventEmitter'
import { module } from './logger'
import { Server as SocketServer } from 'socket.io'
import { socketEvents } from './SocketEvents'
import { ZwaveConfig } from './ZwaveClient'
import { base, logsDir, storeDir } from '../config/app'
import { joinPath, parseSecurityKeys } from './utils'
import { isDocker } from '@zwave-js/shared'
import { basename } from 'path'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const loglevels = require('triple-beam').configs.npm.levels

export type ZnifferConfig = Pick<
	ZwaveConfig,
	| 'securityKeys'
	| 'securityKeysLongRange'
	| 'maxFiles'
	| 'logEnabled'
	| 'logToFile'
	| 'logLevel'
> & {
	port: string
	enabled: boolean
	convertRSSI?: boolean
	defaultFrequency?: number
}

export interface ZnifferManagerEventCallbacks {}

const logger = module('ZnifferManager')

const ZNIFFER_LOG_FILE = joinPath(logsDir, 'zniffer_%DATE%.log')
const ZNIFFER_CAPTURE_FILE = joinPath(storeDir, 'zniffer_capture_%DATE%.zlf')

export type SocketFrame = Frame & { parsedPayload?: string; corrupted: boolean }

export default class ZnifferManager extends TypedEventEmitter<ZnifferManagerEventCallbacks> {
	private zniffer: Zniffer

	private config: ZnifferConfig

	private socket: SocketServer

	private error: string

	constructor(config: ZnifferConfig, socket: SocketServer) {
		super()

		this.config = config
		this.socket = socket

		if (!config.enabled) {
			logger.info('Zniffer is DISABLED')
			return
		}

		const znifferOptions: ZnifferOptions = {
			convertRSSI: config.convertRSSI,
			defaultFrequency: config.defaultFrequency,
			logConfig: {
				enabled: config.logEnabled,
				level: config.logLevel ? loglevels[config.logLevel] : 'info',
				logToFile: config.logToFile,
				filename: ZNIFFER_LOG_FILE,
				forceConsole: isDocker() ? !config.logToFile : false,
				maxFiles: config.maxFiles,
			},
		}

		parseSecurityKeys(config, znifferOptions)

		this.zniffer = new Zniffer(config.port, znifferOptions)

		logger.info('Initing Zniffer...')
		this.zniffer.init().catch((error) => this.onError(error))
	}

	private onError(error: Error) {
		logger.error('Zniffer error:', error)
		this.error = error.message
		this.socket.emit(socketEvents.znifferError, error)
	}

	public async close() {
		this.zniffer.removeAllListeners()
		await this.stop()
	}

	public async start() {
		logger.info('Starting...')
		await this.zniffer.start()

		logger.info('ZnifferManager started')

		this.zniffer.on('frame', (frame) => {
			const socketFrame: SocketFrame = { ...frame, corrupted: false }

			// try parsing payload to something human-readable
			const payload: CommandClass | Buffer = (frame as any).payload

			if (payload instanceof CommandClass) {
				socketFrame.parsedPayload = payload.toLogEntry(
					this.zniffer,
				).message
			}

			this.socket.emit(socketEvents.znifferFrame, socketFrame)
		})

		this.zniffer.on('corrupted frame', (frame) => {
			const socketFrame: SocketFrame = { ...frame, corrupted: true }

			this.socket.emit(socketEvents.znifferFrame, socketFrame)
		})

		this.zniffer.on('error', (error) => {
			this.onError(error)
		})

		this.zniffer.on('ready', () => {
			logger.info('Zniffer ready')
		})
	}

	public async stop() {
		logger.info('Stopping...')
		await this.zniffer.stop()

		logger.info('ZnifferManager stopped')
	}

	public async saveCaptureToFile() {
		const filePath = ZNIFFER_CAPTURE_FILE.replace(
			'%DATE%',
			new Date().toISOString(),
		)
		logger.info(`Saving capture to ${filePath}`)
		await this.zniffer.saveCaptureToFile(filePath)
		logger.info('Capture saved')
		return {
			path: filePath,
			name: basename(filePath),
		}
	}
}
