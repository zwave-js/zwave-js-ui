import {
	CommandClass,
	CorruptedFrame,
	Frame,
	isEncapsulatingCommandClass,
	isMultiEncapsulatingCommandClass,
	Zniffer,
	ZnifferOptions,
} from 'zwave-js'
import { TypedEventEmitter } from './EventEmitter'
import { module } from './logger'
import { Server as SocketServer } from 'socket.io'
import { socketEvents } from './SocketEvents'
import { ZwaveConfig } from './ZwaveClient'
import { logsDir, storeDir } from '../config/app'
import { buffer2hex, joinPath, parseSecurityKeys } from './utils'
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
	| 'nodeFilter'
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

export type SocketFrame = (Frame | CorruptedFrame) & {
	payload: string
	parsedPayload?: Record<string, any>
	corrupted: boolean
	timestamp: number
}

export interface FrameCCLogEntry {
	tags: string[]
	message?: {
		encapsulated?: FrameCCLogEntry[]
		[key: string]: string | number | boolean | FrameCCLogEntry[]
	}
}

export default class ZnifferManager extends TypedEventEmitter<ZnifferManagerEventCallbacks> {
	private zniffer: Zniffer

	private config: ZnifferConfig

	private socket: SocketServer

	private error: string

	private _started = false

	private restartTimeout: NodeJS.Timeout

	get started() {
		return this._started
	}

	set started(value: boolean) {
		this._started = value
		this.onStateChange()
	}

	constructor(config: ZnifferConfig, socket: SocketServer) {
		super()

		this.config = config
		this.socket = socket

		this.started = false

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
				maxFiles: config.maxFiles || 7,
				nodeFilter:
					config.nodeFilter && config.nodeFilter.length > 0
						? config.nodeFilter.map((n) => parseInt(n))
						: undefined,
			},
		}

		parseSecurityKeys(config, znifferOptions)

		this.zniffer = new Zniffer(config.port, znifferOptions)

		logger.info('Initing Zniffer...')
		this.init().catch(() => {})
	}

	private async init() {
		try {
			await this.zniffer.init()
		} catch (error) {
			this.onError(error)

			logger.info('Retrying in 5s...')

			await this.close()

			this.restartTimeout = setTimeout(() => {
				this.init().catch(() => {})
			}, 5000)
		}
	}

	private onError(error: Error) {
		logger.error('Zniffer error:', error)
		this.error = error.message
		this.onStateChange()
	}

	private onStateChange() {
		this.socket.emit(socketEvents.znifferState, this.status())
	}

	private checkReady() {
		if (!this.config.enabled || !this.zniffer) {
			throw new Error('Zniffer is not initialized')
		}
	}

	public status() {
		return {
			error: this.error,
			started: this.started,
		}
	}

	private ccToLogRecord(commandClass: CommandClass): Record<string, any> {
		const parsed: Record<string, any> = commandClass.toLogEntry(
			this.zniffer as any,
		)

		if (isEncapsulatingCommandClass(commandClass)) {
			parsed.encapsulated = [
				this.ccToLogRecord(commandClass.encapsulated),
			]
		} else if (isMultiEncapsulatingCommandClass(commandClass)) {
			parsed.encapsulated = [
				commandClass.encapsulated.map((cc) => this.ccToLogRecord(cc)),
			]
		}

		return parsed
	}

	public async close() {
		if (this.restartTimeout) clearTimeout(this.restartTimeout)

		if (this.zniffer) {
			this.zniffer.removeAllListeners()
			await this.stop()
		}
	}

	public async start() {
		this.checkReady()

		if (this.started) {
			logger.info('Zniffer already started')
			return
		}

		logger.info('Starting...')
		await this.zniffer.start()

		this.started = true

		logger.info('ZnifferManager started')

		this.zniffer.on('frame', (frame) => {
			const socketFrame: SocketFrame = {
				...frame,
				corrupted: false,
				payload: '' as any,
				timestamp: Date.now(),
			}

			if ('payload' in frame) {
				if (frame.payload instanceof CommandClass) {
					socketFrame.parsedPayload = this.ccToLogRecord(
						frame.payload,
					)
				} else {
					socketFrame.payload = buffer2hex(frame.payload)
				}
			}

			this.socket.emit(socketEvents.znifferFrame, socketFrame)
		})

		this.zniffer.on('corrupted frame', (frame) => {
			const socketFrame: SocketFrame = {
				...frame,
				corrupted: true,
				payload: buffer2hex(frame.payload) as any,
				timestamp: Date.now(),
			}

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
		this.checkReady()

		if (!this.started) {
			logger.info('Zniffer is already stopped')
			return
		}

		logger.info('Stopping...')
		await this.zniffer.stop()

		this.started = false

		logger.info('ZnifferManager stopped')
	}

	public async saveCaptureToFile() {
		this.checkReady()

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
