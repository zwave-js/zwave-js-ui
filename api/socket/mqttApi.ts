import type { Socket } from 'socket.io'
import * as loggers from '#api/lib/logger'
import { getErrorMessage } from '#api/lib/errors'
import { inboundEvents } from '#api/lib/SocketEvents'
import type { AppRuntime } from '#api/runtime/AppRuntime'
import { noop, type SocketAck } from '#api/socket/types'

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
