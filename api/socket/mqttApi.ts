/**
 * Inbound `MQTT_API` Socket.IO handler, extracted verbatim (same behavior,
 * same wire contract) from `api/app.ts`'s `setupSocket()`.
 */
import type { Socket } from 'socket.io'
import * as loggers from '../lib/logger.ts'
import { getErrorMessage } from '../lib/errors.ts'
import { inboundEvents } from '../lib/SocketEvents.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { noop, type SocketAck } from './types.ts'

const logger = loggers.module('App')

/** Request payload accepted by the `MQTT_API` handler below. */
export interface MqttApiRequest {
	api?: string
	args: unknown[]
	/**
	 * Preserved quirk: only ever read for the "unknown MQTT api"
	 * error-message branch below. The real wire payload names the action
	 * `api`, not `apiName` - so an unknown `api` always reports
	 * "Unknown MQTT api undefined" (this field is never actually sent by
	 * the real client), not new behavior.
	 */
	apiName?: string
}

export interface MqttApiAck {
	success: boolean
	message: string
	result: void
	api?: string
}

/**
 * Registers the `MQTT_API` handler: dispatches `data.api` to the matching
 * `Gateway` method, or reports the "unknown api"/thrown-error quirks below
 * exactly as the original handler did.
 */
export function registerMqttApiHandler(
	socket: Socket,
	runtime: AppRuntime,
): void {
	socket.on(
		inboundEvents.mqtt,
		(data: MqttApiRequest, cb: SocketAck<MqttApiAck> = noop) => {
			logger.info(`Mqtt api call: ${data.api}`)

			let res: void
			let err: string | undefined

			try {
				switch (data.api) {
					case 'updateNodeTopics':
						{
							const gateway =
								runtime.requireGateway('updateNodeTopics')
							res = Reflect.apply(
								gateway.updateNodeTopics.bind(gateway),
								undefined,
								[data.args[0]],
							)
						}
						break
					case 'removeNodeRetained':
						{
							const gateway =
								runtime.requireGateway('removeNodeRetained')
							res = Reflect.apply(
								gateway.removeNodeRetained.bind(gateway),
								undefined,
								[data.args[0]],
							)
						}
						break
					default:
						err = `Unknown MQTT api ${data.apiName}`
				}
			} catch (error) {
				logger.error('Error while calling MQTT api', error)
				err = getErrorMessage(error)
			}

			cb({
				success: !err,
				message: err || 'Success MQTT api call',
				result: res,
				api: data.api,
			})
		},
	)
}
