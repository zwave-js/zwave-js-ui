/**
 * Wires every inbound (client -> server) Socket.IO handler onto a bound
 * `SocketManager` - the 7 events `api/app.ts` used to register directly in
 * `setupSocket()`: `INITED`, `ZWAVE_API`, `MQTT_API`, `HASS_API`,
 * `ZNIFFER_API`, `SUBSCRIBE`, `UNSUBSCRIBE`, plus the first/last-client
 * `setUserCallbacks()`/`removeUserCallbacks()` lifecycle hook.
 *
 * `SocketManager` itself remains the sole owner of the transport/auth/
 * rooms/connection lifecycle (binding, auth middleware, per-connection
 * bookkeeping) - this module only attaches the actual per-event business
 * logic, resolving the live gateway/zniffer through `runtime` on every
 * call/callback (never a captured reference), exactly like the original.
 */
import type SocketManager from '../lib/SocketManager.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { registerInitHandler, registerZwaveApiHandler } from './zwaveApi.ts'
import { registerMqttApiHandler } from './mqttApi.ts'
import { registerHassApiHandler } from './hassApi.ts'
import { registerZnifferApiHandler } from './znifferApi.ts'
import { registerSubscriptionHandlers } from './subscriptions.ts'

/**
 * Registers all inbound Socket.IO handlers on `socketManager`'s bound
 * `io` server, and the connect/disconnect client-lifecycle callback.
 * `socketManager.bindServer(server)` must already have been called (so
 * `socketManager.io` exists) before this runs.
 */
export function registerSocketApi(
	socketManager: SocketManager,
	runtime: AppRuntime,
): void {
	socketManager.io.on('connection', (socket) => {
		// Server: https://socket.io/docs/v4/server-application-structure/#all-event-handlers-are-registered-in-the-indexjs-file
		// Client: https://socket.io/docs/v4/client-api/#socketemiteventname-args
		registerInitHandler(socket, runtime)
		registerZwaveApiHandler(socket, runtime)
		registerMqttApiHandler(socket, runtime)
		registerHassApiHandler(socket, runtime)
		registerZnifferApiHandler(socket, runtime)
		registerSubscriptionHandlers(socket)
	})

	// emitted every time a new client connects/disconnects
	socketManager.on('clients', (event, activeSockets) => {
		const currentGw = runtime.requireGateway('zwave')
		if (event === 'connection' && activeSockets.size === 1) {
			currentGw.zwave?.setUserCallbacks()
		} else if (event === 'disconnect' && activeSockets.size === 0) {
			currentGw.zwave?.removeUserCallbacks()
		}
	})
}
