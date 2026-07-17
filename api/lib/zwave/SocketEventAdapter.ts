import { eventToChannel } from '#api/lib/SocketEvents'
import type { ServiceLogger } from '#api/lib/zwave/ports'

export interface SocketServerPort {
	to(channel: string): {
		emit(eventName: string, data: unknown, ...args: unknown[]): unknown
	}
	emit(eventName: string, data: unknown, ...args: unknown[]): unknown
}

export interface SocketEventAdapterPort {
	getSocket(): SocketServerPort | null
	getGeneration(): number
	isCurrent(generation: number, socket: SocketServerPort): boolean
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
		// Defer delivery to break synchronous feedback loops (#2676) and revalidate restart state
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
