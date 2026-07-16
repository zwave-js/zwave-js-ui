import type { Socket } from 'socket.io'
import * as loggers from '../lib/logger.ts'
import { getErrorMessage } from '../lib/errors.ts'
import { inboundEvents } from '../lib/SocketEvents.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { noop, type SocketAck } from './types.ts'

const logger = loggers.module('App')

export interface MqttApiRequest {
	api?: string
	args: unknown[]
}

export interface MqttApiAck {
	success: boolean
	message: string
	result: void
	api?: string
}

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
							const gateway = runtime.requireGateway()
							res = Reflect.apply(
								gateway.updateNodeTopics.bind(gateway),
								undefined,
								[data.args[0]],
							)
						}
						break
					case 'removeNodeRetained':
						{
							const gateway = runtime.requireGateway()
							res = Reflect.apply(
								gateway.removeNodeRetained.bind(gateway),
								undefined,
								[data.args[0]],
							)
						}
						break
					default:
						err = `Unknown MQTT api ${data.api}`
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
