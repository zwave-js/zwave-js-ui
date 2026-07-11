/**
 * Inbound `HASS_API` Socket.IO handler, extracted verbatim (same behavior,
 * same wire contract) from `api/app.ts`'s `setupSocket()`.
 */
import type { Socket } from 'socket.io'
import type { HassDevice } from '../lib/ZwaveClient.ts'
import * as loggers from '../lib/logger.ts'
import { getErrorMessage } from '../lib/errors.ts'
import { inboundEvents } from '../lib/SocketEvents.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { noop, type SocketAck } from './types.ts'

const logger = loggers.module('App')

/**
 * Request payload accepted by the `HASS_API` handler below. Every field
 * beyond `apiName` is only meaningful for a subset of actions (see the
 * switch below) - all are optional here, reflecting that the real wire
 * payload is never validated before use, exactly like the original
 * untyped handler.
 */
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
	result: void
	api?: string
}

/**
 * Registers the `HASS_API` handler: dispatches `data.apiName` to the
 * matching `Gateway`/`ZwaveClient` method. Preserved quirk: the `switch` has
 * no `default` case, so an unknown `apiName` silently "succeeds" (`res`/
 * `err` both stay `undefined`).
 */
export function registerHassApiHandler(
	socket: Socket,
	runtime: AppRuntime,
): void {
	socket.on(
		inboundEvents.hass,
		async (data: HassApiRequest, cb: SocketAck<HassApiAck> = noop) => {
			logger.info(`Hass api call: ${data.apiName}`)

			let res: void
			let err: string | undefined
			try {
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
