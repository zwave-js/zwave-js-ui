'use strict'

import { Server as HttpServer } from 'http'
import { module } from './logger'
import { Server as SocketServer, Socket } from 'socket.io'
import { TypedEventEmitter } from './EventEmitter'

const logger = module('Socket')

// FIXME: this constants are duplicated on /src/plugins/socket.js. When converting this to ES6 module that can be removed
// events from server ---> client
export enum socketEvents {
	init = 'INIT', // automatically sent when a new client connects to the socket
	controller = 'CONTROLLER_CMD', // controller status updates
	connected = 'CONNECTED', // socket status
	nodeAdded = 'NODE_ADDED',
	nodeRemoved = 'NODE_REMOVED',
	nodeUpdated = 'NODE_UPDATED',
	valueUpdated = 'VALUE_UPDATED',
	valueRemoved = 'VALUE_REMOVED',
	healProgress = 'HEAL_PROGRESS',
	healthCheckProgress = 'HEALTH_CHECK_PROGRESS',
	info = 'INFO',
	api = 'API_RETURN', // api results
	debug = 'DEBUG',
	statistics = 'STATISTICS',
	grantSecurityClasses = 'GRANT_SECURITY_CLASSES',
	validateDSK = 'VALIDATE_DSK',
	inclusionAborted = 'INCLUSION_ABORTED',
}

// events from client ---> server
export enum inboundEvents {
	init = 'INITED', // get all nodes
	zwave = 'ZWAVE_API', // call a zwave api
	hass = 'HASS_API', // call an hass api
	mqtt = 'MQTT_API', // call an mqtt api
}

export interface SocketManagerEventCallbacks {
	[inboundEvents.init]: (socket: Socket) => void
	[inboundEvents.zwave]: (socket: Socket, data: any) => void
	[inboundEvents.hass]: (socket: Socket, data: any) => void
	[inboundEvents.mqtt]: (socket: Socket, data: any) => void
}

export type SocketManagerEvents = Extract<
	keyof SocketManagerEventCallbacks,
	inboundEvents
>

/**
 * The constructor
 */
class SocketManager extends TypedEventEmitter<SocketManagerEventCallbacks> {
	public io: SocketServer

	authMiddleware: (socket: Socket, next: () => void) => void | undefined

	/**
	 * Binds socket.io to `server`
	 *
	 */
	bindServer(server: HttpServer) {
		this.io = new SocketServer(server)

		this.io
			.use(this._authMiddleware())
			.on('connection', this._onConnection.bind(this))
	}

	private _authMiddleware(): (socket: Socket, next: () => void) => void {
		return (socket: Socket, next: () => void) => {
			if (this.authMiddleware !== undefined) {
				this.authMiddleware(socket, next)
			} else {
				next()
			}
		}
	}

	/**
	 * Handles new socket connections
	 *
	 */
	private _onConnection(socket: Socket) {
		logger.debug(`New connection ${socket.id}`)

		// register inbound events from this socket
		for (const k in inboundEvents) {
			const eventName = inboundEvents[k]
			// pass socket reference as first parameter
			socket.on(eventName, this._emitEvent.bind(this, eventName, socket))
		}

		socket.on('disconnect', function () {
			logger.debug(`User disconnected ${socket.id}`)
		})
	}

	/**
	 * Logs and emits the `eventName` with `socket` and `args` as parameters
	 *
	 */
	private _emitEvent(eventName: inboundEvents, socket: Socket, data: any) {
		logger.debug(`Event ${eventName} emitted to ${socket.id}`)
		this.emit(eventName, socket, data)
	}
}

export default SocketManager
