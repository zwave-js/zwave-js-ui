import type { Socket } from 'socket.io'
import { getErrorMessage } from '../lib/errors.ts'
import * as loggers from '../lib/logger.ts'
import { inboundEvents } from '../lib/SocketEvents.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { noop, type SocketAck } from './types.ts'

const logger = loggers.module('App')

export type ZnifferApiRequest =
	| {
			apiName:
				| 'start'
				| 'stop'
				| 'clear'
				| 'getFrames'
				| 'saveCaptureToFile'
	  }
	| { apiName: 'setFrequency'; frequency: number }
	| { apiName: 'setLRChannelConfig'; channelConfig: number }
	| { apiName: 'loadCaptureFromBuffer'; buffer: number[] }

export interface ZnifferApiAck {
	success: boolean
	message: string
	result: unknown
	api?: string
}

export function registerZnifferApiHandler(
	socket: Socket,
	runtime: AppRuntime,
): void {
	socket.on(
		inboundEvents.zniffer,
		async (
			data: ZnifferApiRequest,
			cb: SocketAck<ZnifferApiAck> = noop,
		) => {
			const apiName: string = data.apiName
			logger.info(`Zniffer api call: ${apiName}`)
			let res: unknown
			let err: string | undefined
			try {
				switch (data.apiName) {
					case 'start':
						res = await runtime.ensureZniffer().start()
						break
					case 'stop':
						res = await runtime.ensureZniffer().stop()
						break
					case 'clear':
						res = runtime.ensureZniffer().clear()
						break
					case 'getFrames':
						res = runtime.ensureZniffer().getFrames()
						break
					case 'setFrequency':
						{
							const zniffer = runtime.ensureZniffer()
							res = await Reflect.apply(
								zniffer.setFrequency.bind(zniffer),
								undefined,
								[data.frequency],
							)
						}
						break
					case 'setLRChannelConfig':
						{
							const zniffer = runtime.ensureZniffer()
							res = await Reflect.apply(
								zniffer.setLRChannelConfig.bind(zniffer),
								undefined,
								[data.channelConfig],
							)
						}
						break
					case 'saveCaptureToFile':
						res = await runtime.ensureZniffer().saveCaptureToFile()
						break
					case 'loadCaptureFromBuffer': {
						const buffer = Buffer.from(data.buffer)
						res = await runtime
							.ensureZniffer()
							.loadCaptureFromBuffer(buffer)
						break
					}
					default:
						throw new Error(`Unknown ZNIFFER api ${apiName}`)
				}
			} catch (error) {
				logger.error('Error while calling ZNIFFER api', error)
				err = getErrorMessage(error)
			}

			cb({
				success: !err,
				message: err || 'Success ZNIFFER api call',
				result: res,
				api: apiName,
			})
		},
	)
}
