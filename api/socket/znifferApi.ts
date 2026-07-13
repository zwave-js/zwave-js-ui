import type { Socket } from 'socket.io'
import * as loggers from '../lib/logger.ts'
import { inboundEvents } from '../lib/SocketEvents.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { getLegacyErrorMessage, noop, type SocketAck } from './types.ts'

const logger = loggers.module('App')

interface ZnifferApiRequestBase {
	api?: string
}

export type ZnifferApiRequest = ZnifferApiRequestBase &
	(
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
	)

export interface ZnifferApiAck {
	success: boolean
	message: unknown
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
			// Client sends "apiName" not "api" so this always logs undefined
			logger.info(`Zniffer api call: ${data.api}`)

			const apiName: string = data.apiName
			let res: unknown
			let err: unknown = undefined
			try {
				switch (data.apiName) {
					case 'start':
						res = await runtime.requireZniffer('start').start()
						break
					case 'stop':
						res = await runtime.requireZniffer('stop').stop()
						break
					case 'clear':
						res = runtime.requireZniffer('clear').clear()
						break
					case 'getFrames':
						res = runtime.requireZniffer('getFrames').getFrames()
						break
					case 'setFrequency':
						{
							const zniffer =
								runtime.requireZniffer('setFrequency')
							res = await Reflect.apply(
								zniffer.setFrequency.bind(zniffer),
								undefined,
								[data.frequency],
							)
						}
						break
					case 'setLRChannelConfig':
						{
							const zniffer =
								runtime.requireZniffer('setLRChannelConfig')
							res = await Reflect.apply(
								zniffer.setLRChannelConfig.bind(zniffer),
								undefined,
								[data.channelConfig],
							)
						}
						break
					case 'saveCaptureToFile':
						res = await runtime
							.requireZniffer('saveCaptureToFile')
							.saveCaptureToFile()
						break
					case 'loadCaptureFromBuffer': {
						const buffer = Buffer.from(data.buffer)
						// Deliberately not awaited so res is the pending promise, not the resolved value
						res = runtime
							.requireZniffer('loadCaptureFromBuffer')
							.loadCaptureFromBuffer(buffer)
						break
					}
					default:
						// Unknown actions fail here while HASS_API silently succeeds
						throw new Error(`Unknown ZNIFFER api ${apiName}`)
				}
			} catch (error) {
				logger.error('Error while calling ZNIFFER api', error)
				err = getLegacyErrorMessage(error)
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
