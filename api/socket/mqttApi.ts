import type { Socket } from 'socket.io'
import * as loggers from '#api/lib/logger'
import { getErrorMessage } from '#api/lib/errors'
import { inboundEvents } from '#api/lib/SocketEvents'
import type { AppRuntime } from '#api/runtime/AppRuntime'
import {
	createApiAck,
	safeOperationName,
	type ApiAck,
	type SocketAck,
} from '#api/socket/api'

const logger = loggers.module('App')

export type MqttApiRequest =
	| { api: 'updateNodeTopics'; args: [nodeId: number] }
	| { api: 'removeNodeRetained'; args: [nodeId: number] }

export type MqttApiAck = ApiAck<void>

export function registerMqttApiHandler(
	socket: Socket,
	runtime: AppRuntime,
): void {
	socket.on(
		inboundEvents.mqtt,
		(data: MqttApiRequest, cb?: SocketAck<MqttApiAck>) => {
			const api: string = data.api
			logger.info(`Mqtt api call: ${safeOperationName(api)}`)

			let res: void
			let err: string | undefined

			try {
				switch (data.api) {
					case 'updateNodeTopics':
						res = runtime
							.ensureGateway()
							.updateNodeTopics(data.args[0])
						break
					case 'removeNodeRetained':
						res = runtime
							.ensureGateway()
							.removeNodeRetained(data.args[0])
						break
					default:
						err = `Unknown MQTT api ${api}`
				}
			} catch (error) {
				logger.error('Error while calling MQTT api', error)
				err = getErrorMessage(error)
			}

			cb?.(createApiAck(api, res, err, 'Success MQTT api call'))
		},
	)
}
