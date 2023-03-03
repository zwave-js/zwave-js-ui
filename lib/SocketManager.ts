'use strict'

import { Server as HttpServer } from 'http'
import { module } from './logger'
import { Server as SocketServer, Socket } from 'socket.io'
import { TypedEventEmitter } from './EventEmitter'
import { inboundEvents } from './SocketEvents'

const logger = module('Socket')

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

		// https://socket.io/docs/v4/server-socket-instance/#events
		socket.on('disconnect', function (reason) {
			logger.debug(`User disconnected from ${socket.id}: ${reason}`)
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
