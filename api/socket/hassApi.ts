import type { Socket } from 'socket.io'
import type { StoreHassDevicesResult } from '../hass/types.ts'
import type { HassDevice } from '../lib/ZwaveClient.ts'
import { getErrorMessage } from '../lib/errors.ts'
import * as loggers from '../lib/logger.ts'
import { inboundEvents } from '../lib/SocketEvents.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { noop, type SocketAck } from './types.ts'

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
	message: string
	result: StoreHassDevicesResult | void
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

			let res: StoreHassDevicesResult | undefined
			let err: string | undefined
			try {
				switch (data.apiName) {
					case 'delete':
						{
							const gateway = runtime.requireGateway()
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
							const gateway = runtime.requireGateway()
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
							const gateway = runtime.requireGateway()
							res = Reflect.apply(
								gateway.rediscoverNode.bind(gateway),
								undefined,
								[data.nodeId],
							)
						}
						break
					case 'disableDiscovery':
						{
							const gateway = runtime.requireGateway()
							res = Reflect.apply(
								gateway.disableDiscovery.bind(gateway),
								undefined,
								[data.nodeId],
							)
						}
						break
					case 'update':
						{
							const zwave = runtime.requireZwaveClient()
							res = Reflect.apply(
								zwave.updateDevice.bind(zwave),
								undefined,
								[data.device, data.nodeId],
							)
						}
						break
					case 'add':
						{
							const zwave = runtime.requireZwaveClient()
							res = Reflect.apply(
								zwave.addDevice.bind(zwave),
								undefined,
								[data.device, data.nodeId],
							)
						}
						break
					case 'store':
						{
							const zwave = runtime.requireZwaveClient()
							res = await Reflect.apply(
								zwave.storeDevices.bind(zwave),
								undefined,
								[data.devices, data.nodeId, data.remove],
							)
							if (res?.status === 'node-not-found') {
								err =
									'Unable to store Home Assistant devices: node not found'
							} else if (res?.status === 'invalid-stored-node') {
								err =
									'Unable to store Home Assistant devices: stored node is invalid'
							}
						}
						break
					default:
						err = `Unknown HASS api ${data.apiName}`
				}
			} catch (error) {
				logger.error('Error while calling HASS api', error)
				err = getErrorMessage(error)
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
