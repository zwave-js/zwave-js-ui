import type { Server as SocketServer } from 'socket.io'

import { eventToChannel } from '../SocketEvents.ts'
import type { ServiceLogger } from './ports.ts'

export interface SocketEventAdapterPort {
	getSocket(): SocketServer | null
	getGeneration(): number
	isCurrent(generation: number, socket: SocketServer): boolean
}

export class SocketEventAdapter {
	private readonly port: SocketEventAdapterPort
	private readonly logger: ServiceLogger

	constructor(port: SocketEventAdapterPort, logger: ServiceLogger) {
		this.port = port
		this.logger = logger
	}

	send(eventName: string, data: unknown, ...args: unknown[]): void {
		const socket = this.port.getSocket()
		if (!socket) return

		const generation = this.port.getGeneration()
		process.nextTick(() => {
			if (!this.port.isCurrent(generation, socket)) return

			const channel = eventToChannel[eventName]
			if (channel) {
				socket.to(channel).emit(eventName, data, ...args)
			} else {
				this.logger.warn(
					`No channel mapping for event ${eventName}, broadcasting to all clients`,
				)
				socket.emit(eventName, data, ...args)
			}
		})
	}
}
