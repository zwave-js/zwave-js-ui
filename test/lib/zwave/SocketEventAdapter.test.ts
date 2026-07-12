import { describe, expect, it, vi } from 'vitest'

import { socketEvents } from '../../../api/lib/SocketEvents.ts'
import { SocketEventAdapter } from '../../../api/lib/zwave/SocketEventAdapter.ts'

describe('SocketEventAdapter', () => {
	it('preserves room, payload arity, order, and next-tick timing', async () => {
		const emit = vi.fn()
		const to = vi.fn(() => ({ emit }))
		const socket = { to, emit: vi.fn() }
		let generation = 4
		const adapter = new SocketEventAdapter(
			{
				getSocket: () => socket as any,
				getGeneration: () => generation,
				isCurrent: (captured, identity) =>
					captured === generation && identity === socket,
			},
			{ info: vi.fn(), warn: vi.fn(), error: vi.fn() },
		)

		adapter.send(socketEvents.nodeUpdated, { id: 2 }, true, 'tail')
		expect(to).not.toHaveBeenCalled()
		await new Promise<void>((resolve) => process.nextTick(resolve))
		expect(to).toHaveBeenCalledWith('nodes')
		expect(emit).toHaveBeenCalledWith(
			socketEvents.nodeUpdated,
			{ id: 2 },
			true,
			'tail',
		)

		generation++
		adapter.send(socketEvents.valueUpdated, { id: 'value' })
		generation++
		await new Promise<void>((resolve) => process.nextTick(resolve))
		expect(emit).toHaveBeenCalledTimes(1)
	})

	it('fences socket identity replacement and tolerates no socket', async () => {
		const oldSocket = { to: vi.fn(), emit: vi.fn() }
		let socket: any = oldSocket
		const adapter = new SocketEventAdapter(
			{
				getSocket: () => socket,
				getGeneration: () => 1,
				isCurrent: (_generation, identity) => identity === socket,
			},
			{ info: vi.fn(), warn: vi.fn(), error: vi.fn() },
		)
		adapter.send(socketEvents.nodeAdded, { id: 2 })
		socket = { to: vi.fn(), emit: vi.fn() }
		await new Promise<void>((resolve) => process.nextTick(resolve))
		expect(oldSocket.to).not.toHaveBeenCalled()

		socket = null
		adapter.send(socketEvents.nodeAdded, { id: 3 })
		await new Promise<void>((resolve) => process.nextTick(resolve))
		expect(oldSocket.emit).not.toHaveBeenCalled()
	})

	it('warns and broadcasts unmapped events with every argument', async () => {
		const socket = { to: vi.fn(), emit: vi.fn() }
		const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
		const adapter = new SocketEventAdapter(
			{
				getSocket: () => socket as any,
				getGeneration: () => 1,
				isCurrent: () => true,
			},
			logger,
		)
		adapter.send('UNMAPPED', { value: 1 }, 'second', 3)
		await new Promise<void>((resolve) => process.nextTick(resolve))
		expect(logger.warn).toHaveBeenCalledWith(
			'No channel mapping for event UNMAPPED, broadcasting to all clients',
		)
		expect(socket.emit).toHaveBeenCalledWith(
			'UNMAPPED',
			{ value: 1 },
			'second',
			3,
		)
		expect(socket.to).not.toHaveBeenCalled()
	})
})
