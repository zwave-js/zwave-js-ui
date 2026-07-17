import type { CorruptedFrame, Frame, ZnifferOptions } from 'zwave-js'
import {
	CommandClass,
	isEncapsulatingCommandClass,
	isMultiEncapsulatingCommandClass,
	Zniffer,
} from 'zwave-js'
import { TypedEventEmitter } from '#api/lib/EventEmitter'
import { module } from '#api/lib/logger'
import type { Server as SocketServer } from 'socket.io'
import { socketEvents } from '#api/lib/SocketEvents'
import type { ZwaveConfig } from '#api/lib/ZwaveClient'
import { logsDir, storeDir } from '#api/config/app'
import { buffer2hex, joinPath, parseSecurityKeys } from '#api/lib/utils'
import { isDocker } from '#api/lib/utils'
import { basename } from 'node:path'
import { readFile } from 'node:fs/promises'
import tripleBeam from 'triple-beam'
import { getErrorMessage } from '#api/lib/errors'

const loglevels = tripleBeam.configs.npm.levels

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

export type ZnifferManagerEventCallbacks = Record<string, never>

const logger = module('ZnifferManager')

const ZNIFFER_LOG_FILE = joinPath(logsDir, 'zniffer_%DATE%.log')
const ZNIFFER_CAPTURE_FILE = joinPath(storeDir, 'zniffer_capture_%DATE%.zlf')

export type SocketFrame = (Frame | CorruptedFrame) & {
	payload: string
	parsedPayload?: Record<string, any>
	corrupted: boolean
	timestamp: number
	raw: string
}

export interface FrameCCLogEntry {
	tags: string[]
	message?: {
		encapsulated?: FrameCCLogEntry[]
		[key: string]: string | number | boolean | FrameCCLogEntry[] | undefined
	}
}

export default class ZnifferManager extends TypedEventEmitter<ZnifferManagerEventCallbacks> {
	private zniffer?: Zniffer

	private config: ZnifferConfig

	private socket: SocketServer | undefined

	private error?: string

	private restartTimeout?: NodeJS.Timeout

	get started() {
		return !!this.zniffer?.active
	}

	constructor(config: ZnifferConfig, socket: SocketServer | undefined) {
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
				maxFiles: config.maxFiles || 7,
				nodeFilter:
					config.nodeFilter && config.nodeFilter.length > 0
						? config.nodeFilter.map((n) => parseInt(n))
						: undefined,
			},
		}

		parseSecurityKeys(config, znifferOptions)

		this.zniffer = new Zniffer(config.port, znifferOptions)
		this.zniffer.on('error', (error) => {
			this.onError(error)
		})

		this.zniffer.on('frame', (frame, rawData) => {
			const socketFrame = this.parseFrame(frame, rawData)

			this.requireSocket()
				.to('znifferFrames')
				.emit(socketEvents.znifferFrame, socketFrame)
		})

		this.zniffer.on('corrupted frame', (frame, rawData) => {
			const socketFrame = this.parseFrame(frame, rawData)

			this.requireSocket()
				.to('znifferFrames')
				.emit(socketEvents.znifferFrame, socketFrame)
		})

		this.zniffer.on('ready', () => {
			logger.info('Zniffer ready')
		})

		logger.info('Initing Zniffer...')
		this.init().catch(() => {})
	}

	private requireSocket(): SocketServer {
		const socket = this.socket
		if (!socket) {
			throw new Error('Socket.IO is not attached')
		}
		return socket
	}

	private async init() {
		const zniffer = this.ensureReady()
		try {
			await zniffer.init()
		} catch (error) {
			logger.info('Retrying in 5s...')
			this.restartTimeout = setTimeout(() => {
				this.init().catch(() => {})
			}, 5000)
		}

		this.onStateChange()
	}

	private parseFrame(
		frame: Frame | CorruptedFrame,
		rawData: Uint8Array<ArrayBuffer>,
		timestamp = Date.now(),
	): SocketFrame {
		const socketFrame: SocketFrame = {
			...frame,
			corrupted: !('protocol' in frame),
			payload: '' as any,
			timestamp,
			raw: buffer2hex(rawData),
		}

		if ('payload' in frame) {
			if (frame.payload instanceof CommandClass) {
				socketFrame.parsedPayload = this.ccToLogRecord(frame.payload)
			} else {
				socketFrame.payload = buffer2hex(frame.payload)
			}
		}

		return socketFrame
	}

	private onError(error: Error) {
		logger.error('Zniffer error:', error)
		this.error = error.message
		this.onStateChange()
	}

	private onStateChange() {
		this.requireSocket()
			.to('znifferState')
			.emit(socketEvents.znifferState, this.status())
	}

	private ensureReady(): Zniffer {
		if (!this.config.enabled || !this.zniffer) {
			throw new Error('Zniffer is not initialized')
		}
		return this.zniffer
	}

	public status() {
		return {
			error: this.error,
			started: this.started,
			supportedFrequencies: Object.fromEntries(
				this.zniffer?.supportedFrequencies ?? [],
			),
			frequency: this.zniffer?.currentFrequency,
			lrRegions: Array.from(this.zniffer?.lrRegions ?? []),
			supportedLRChannelConfigs: Object.fromEntries(
				this.zniffer?.supportedLRChannelConfigs ?? [],
			),
			lrChannelConfig: this.zniffer?.currentLRChannelConfig,
		}
	}

	public getFrames() {
		const zniffer = this.ensureReady()

		return zniffer.capturedFrames.map((frame) => {
			return this.parseFrame(
				frame.parsedFrame,
				Buffer.from(frame.frameData),
				frame.timestamp.getTime(),
			)
		})
	}

	public async setFrequency(frequency: number) {
		const zniffer = this.ensureReady()

		logger.info(`Setting Zniffer frequency to ${frequency}`)
		await zniffer.setFrequency(frequency)

		this.onStateChange()

		logger.info(`Zniffer frequency set to ${frequency}`)
	}

	public async setLRChannelConfig(channelConfig: number) {
		const zniffer = this.ensureReady()

		logger.info(
			`Setting Zniffer LR channel configuration to ${channelConfig}`,
		)
		await zniffer.setLRChannelConfig(channelConfig)

		this.onStateChange()

		logger.info(`Zniffer LR channel configuration set to ${channelConfig}`)
	}

	private ccToLogRecord(commandClass: CommandClass): Record<string, any> {
		try {
			const parsed: Record<string, any> = commandClass.toLogEntry()

			if (isEncapsulatingCommandClass(commandClass)) {
				parsed.encapsulated = [
					this.ccToLogRecord(commandClass.encapsulated),
				]
			} else if (isMultiEncapsulatingCommandClass(commandClass)) {
				parsed.encapsulated = [
					commandClass.encapsulated.map((cc) =>
						this.ccToLogRecord(cc),
					),
				]
			}
			return parsed
		} catch (error) {
			logger.error('Error parsing command class:', error)
			return {
				error: getErrorMessage(error),
			}
		}
	}

	public async close() {
		if (this.restartTimeout) clearTimeout(this.restartTimeout)

		if (this.zniffer) {
			this.zniffer.removeAllListeners()
			await this.stop()
			await this.zniffer.destroy()
		}
	}

	public async start() {
		const zniffer = this.ensureReady()

		if (this.started) {
			logger.info('Zniffer already started')
			return
		}

		logger.info('Starting...')
		await zniffer.start()

		this.onStateChange()

		logger.info('Started')
	}

	public async stop() {
		const zniffer = this.ensureReady()

		if (!this.started) {
			logger.info('Zniffer is already stopped')
			return
		}

		logger.info('Stopping...')
		await zniffer.stop()

		this.onStateChange()

		logger.info('Stopped')
	}

	public clear() {
		const zniffer = this.ensureReady()

		logger.info('Clearing...')
		zniffer.clearCapturedFrames()

		logger.info('Frames cleared')
	}

	public async loadCaptureFromBuffer(buffer: Buffer) {
		const zniffer = this.ensureReady()

		logger.info(`Loading capture from buffer (${buffer.length} bytes)`)

		try {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-expect-error
			await zniffer.loadCaptureFromBuffer(buffer)

			logger.info(`Successfully loaded capture`)
		} catch (error) {
			logger.error('Error loading capture:', error)
			return {
				error: `Failed to load capture: ${getErrorMessage(error)}`,
			}
		}
	}

	public async saveCaptureToFile() {
		const zniffer = this.ensureReady()

		const filePath = ZNIFFER_CAPTURE_FILE.replace(
			'%DATE%',
			new Date().toISOString(),
		)
		logger.info(`Saving capture to ${filePath}`)
		await zniffer.saveCaptureToFile(filePath)
		logger.info('Capture saved')

		// Read the saved file to return its content for download
		const data = await readFile(filePath)

		return {
			path: filePath,
			name: basename(filePath),
			data: data,
		}
	}
}
