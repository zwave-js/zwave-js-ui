/**
 * Inbound `ZNIFFER_API` Socket.IO handler, extracted verbatim (same
 * behavior, same wire contract) from `api/app.ts`'s `setupSocket()`.
 */
import type { Socket } from 'socket.io'
import * as loggers from '../lib/logger.ts'
import { inboundEvents } from '../lib/SocketEvents.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { getLegacyErrorMessage, noop, type SocketAck } from './types.ts'

const logger = loggers.module('App')

/**
 * Valid `ZNIFFER_API` request payloads. Actions without parameters omit
 * action-specific fields, while frequency, channel configuration, and capture
 * data are required only by the operation that consumes each one. Socket.IO
 * still performs no runtime validation, preserving malformed-wire behavior.
 */
interface ZnifferApiRequestBase {
	/**
	 * Preserved quirk: only ever read by this handler's log line below,
	 * never by the ack itself. The real wire payload names the action
	 * `apiName`, not `api` - so this always logs "Zniffer api call:
	 * undefined" (this field is never actually sent by the real client),
	 * not new behavior.
	 */
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

/**
 * Registers the `ZNIFFER_API` handler: dispatches `data.apiName` to the
 * matching `ZnifferManager` method. Preserved quirks:
 *  - `loadCaptureFromBuffer` is called WITHOUT `await` - `result` on the
 *    ack ends up an unresolved (and thus, over the wire, empty-object
 *    serialized) `Promise`, not the resolved value.
 *  - An unknown `apiName` throws (unlike HASS_API's silent-success quirk),
 *    reported as `Unknown ZNIFFER api <apiName>`.
 */
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
						// Preserved quirk: NOT awaited - `res` ends up the
						// pending `Promise` itself, not its resolved value.
						res = runtime
							.requireZniffer('loadCaptureFromBuffer')
							.loadCaptureFromBuffer(buffer)
						break
					}
					default:
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
