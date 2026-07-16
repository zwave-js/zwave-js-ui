import type SocketManager from '../lib/SocketManager.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { registerInitHandler, registerZwaveApiHandler } from './zwaveApi.ts'
import { registerMqttApiHandler } from './mqttApi.ts'
import { registerHassApiHandler } from './hassApi.ts'
import { registerZnifferApiHandler } from './znifferApi.ts'
import { registerSubscriptionHandlers } from './subscriptions.ts'

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
