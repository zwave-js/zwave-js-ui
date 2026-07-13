import type { Socket } from 'socket.io'
import type { HassDevice } from '../lib/ZwaveClient.ts'
import * as loggers from '../lib/logger.ts'
import { inboundEvents } from '../lib/SocketEvents.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { getLegacyErrorMessage, noop, type SocketAck } from './types.ts'

const logger = loggers.module('App')

// Optional action fields mirror the unvalidated wire payload
export interface HassApiRequest {
	apiName?: string
	device?: HassDevice
	nodeId?: number
	devices?: Record<string, HassDevice>
	remove?: unknown
}

export interface HassApiAck {
	success: boolean
	message: unknown
	result: void
	api?: string
}

export function registerHassApiHandler(
	socket: Socket,
	runtime: AppRuntime,
): void {
	socket.on(
		inboundEvents.hass,
		async (data: HassApiRequest, cb: SocketAck<HassApiAck> = noop) => {
			logger.info(`Hass api call: ${data.apiName}`)

			let res: void
			let err: unknown = undefined
			try {
				// No default case so an unknown apiName silently succeeds with res/err undefined
				switch (data.apiName) {
					case 'delete':
						{
							const gateway =
								runtime.requireGateway('publishDiscovery')
							res = Reflect.apply(
								gateway.publishDiscovery.bind(gateway),
								undefined,
								[
									data.device,
									data.nodeId,
									{
										deleteDevice: true,
										forceUpdate: true,
									},
								],
							)
						}
						break
					case 'discover':
						{
							const gateway =
								runtime.requireGateway('publishDiscovery')
							res = Reflect.apply(
								gateway.publishDiscovery.bind(gateway),
								undefined,
								[
									data.device,
									data.nodeId,
									{
										deleteDevice: false,
										forceUpdate: true,
									},
								],
							)
						}
						break
					case 'rediscoverNode':
						{
							const gateway =
								runtime.requireGateway('rediscoverNode')
							res = Reflect.apply(
								gateway.rediscoverNode.bind(gateway),
								undefined,
								[data.nodeId],
							)
						}
						break
					case 'disableDiscovery':
						{
							const gateway =
								runtime.requireGateway('disableDiscovery')
							res = Reflect.apply(
								gateway.disableDiscovery.bind(gateway),
								undefined,
								[data.nodeId],
							)
						}
						break
					case 'update':
						{
							const zwave = runtime.requireGateway('zwave').zwave
							res = Reflect.apply(
								zwave.updateDevice.bind(zwave),
								undefined,
								[data.device, data.nodeId],
							)
						}
						break
					case 'add':
						{
							const zwave = runtime.requireGateway('zwave').zwave
							res = Reflect.apply(
								zwave.addDevice.bind(zwave),
								undefined,
								[data.device, data.nodeId],
							)
						}
						break
					case 'store':
						{
							const zwave = runtime.requireGateway('zwave').zwave
							res = await Reflect.apply(
								zwave.storeDevices.bind(zwave),
								undefined,
								[data.devices, data.nodeId, data.remove],
							)
						}
						break
				}
			} catch (error) {
				logger.error('Error while calling HASS api', error)
				err = getLegacyErrorMessage(error)
			}

			cb({
				success: !err,
				message: err || 'Success HASS api call',
				result: res,
				api: data.apiName,
			})
		},
	)
}
