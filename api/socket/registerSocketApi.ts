import type SocketManager from '#api/lib/SocketManager'
import type { AppRuntime } from '#api/runtime/AppRuntime'
import {
	registerInitHandler,
	registerZwaveApiHandler,
} from '#api/socket/zwaveApi'
import { registerMqttApiHandler } from '#api/socket/mqttApi'
import { registerHassApiHandler } from '#api/socket/hassApi'
import { registerZnifferApiHandler } from '#api/socket/znifferApi'
import { registerSubscriptionHandlers } from '#api/socket/subscriptions'

// SocketManager owns transport and connection lifecycle while handlers resolve services through runtime
// Requires bindServer to initialize socketManager.io before registration
export function registerSocketApi(
	socketManager: SocketManager,
	runtime: AppRuntime,
): void {
	const io = socketManager.io
	if (!io) {
		throw new Error('Socket manager is not bound')
	}

	io.on('connection', (socket) => {
		registerInitHandler(socket, runtime)
		registerZwaveApiHandler(socket, runtime)
		registerMqttApiHandler(socket, runtime)
		registerHassApiHandler(socket, runtime)
		registerZnifferApiHandler(socket, runtime)
		registerSubscriptionHandlers(socket)
	})

	socketManager.on('clients', (event, activeSockets) => {
		const currentGw = runtime.requireGateway()
		if (event === 'connection' && activeSockets.size === 1) {
			currentGw.zwave?.setUserCallbacks()
		} else if (event === 'disconnect' && activeSockets.size === 0) {
			currentGw.zwave?.removeUserCallbacks()
		}
	})
}
