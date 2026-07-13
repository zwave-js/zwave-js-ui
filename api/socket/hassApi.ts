import type { Socket } from 'socket.io'
import type { StoreHassDevicesResult } from '../hass/types.ts'
import type { HassDevice } from '../lib/ZwaveClient.ts'
import { getErrorMessage } from '../lib/errors.ts'
import * as loggers from '../lib/logger.ts'
import { inboundEvents } from '../lib/SocketEvents.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import {
	createApiAck,
	safeOperationName,
	type ApiAck,
	type SocketAck,
} from './api.ts'

const logger = loggers.module('App')

export type HassApiRequest =
	| {
			apiName: 'delete' | 'discover' | 'update' | 'add'
			device: HassDevice
			nodeId: number
	  }
	| {
			apiName: 'rediscoverNode' | 'disableDiscovery'
			nodeId: number
	  }
	| {
			apiName: 'store'
			devices: Record<string, HassDevice>
			nodeId: number
			remove: boolean
	  }

export type HassApiAck = ApiAck<StoreHassDevicesResult | void>

export function registerHassApiHandler(
	socket: Socket,
	runtime: AppRuntime,
): void {
	socket.on(
		inboundEvents.hass,
		async (data: HassApiRequest, cb?: SocketAck<HassApiAck>) => {
			const apiName: string = data.apiName
			logger.info(`Hass api call: ${safeOperationName(apiName)}`)

			let res: StoreHassDevicesResult | void
			let err: string | undefined
			try {
				switch (data.apiName) {
					case 'delete':
						res = runtime
							.ensureGateway()
							.publishDiscovery(data.device, data.nodeId, {
								deleteDevice: true,
								forceUpdate: true,
							})
						break
					case 'discover':
						res = runtime
							.ensureGateway()
							.publishDiscovery(data.device, data.nodeId, {
								deleteDevice: false,
								forceUpdate: true,
							})
						break
					case 'rediscoverNode':
						res = runtime
							.ensureGateway()
							.rediscoverNode(data.nodeId)
						break
					case 'disableDiscovery':
						res = runtime
							.ensureGateway()
							.disableDiscovery(data.nodeId)
						break
					case 'update':
						res = runtime
							.ensureZWaveClient()
							.updateDevice(data.device, data.nodeId)
						break
					case 'add':
						res = runtime
							.ensureZWaveClient()
							.addDevice(data.device, data.nodeId)
						break
					case 'store':
						res = await runtime
							.ensureZWaveClient()
							.storeDevices(
								data.devices,
								data.nodeId,
								data.remove,
							)
						break
					default:
						err = `Unknown HASS api ${apiName}`
						logger.error(
							'Error while calling HASS api',
							new Error(
								`Unknown HASS api ${safeOperationName(apiName)}`,
							),
						)
				}
			} catch (error) {
				logger.error('Error while calling HASS api', error)
				err = getErrorMessage(error)
			}

			cb?.(createApiAck(apiName, res, err, 'Success HASS api call'))
		},
	)
}
