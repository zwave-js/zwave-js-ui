import type { Socket } from 'socket.io'
import * as loggers from '../lib/logger.ts'
import { getErrorMessage } from '../lib/errors.ts'
import { inboundEvents } from '../lib/SocketEvents.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import {
	createApiAck,
	safeOperationName,
	type ApiAck,
	type SocketAck,
} from './api.ts'

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
