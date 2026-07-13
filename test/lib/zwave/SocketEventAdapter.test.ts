import { describe, expect, it, vi } from 'vitest'

import { socketEvents } from '../../../api/lib/SocketEvents.ts'
import {
	SocketEventAdapter,
	type SocketEventAdapterPort,
	type SocketServerPort,
} from '../../../api/lib/zwave/SocketEventAdapter.ts'
import { createServiceLogger } from './nodeFixtures.ts'

function createSocket() {
	const emit = vi.fn()
	const to = vi.fn(() => ({ emit }))
	return {
		emit,
		to,
		socket: { emit, to } satisfies SocketServerPort,
	}
}

describe('SocketEventAdapter', () => {
	it('delivers current room events asynchronously with all arguments', async () => {
		const { emit, socket, to } = createSocket()
		let generation = 4
		const adapter = new SocketEventAdapter(
			{
				getSocket: () => socket,
				getGeneration: () => generation,
				isCurrent: (captured) => captured === generation,
			},
			createServiceLogger(),
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

	it('does nothing when no socket is available', () => {
		const port: SocketEventAdapterPort = {
			getSocket: () => null,
			getGeneration: () => 1,
			isCurrent: () => true,
		}
		const adapter = new SocketEventAdapter(port, createServiceLogger())
		expect(() =>
			adapter.send(socketEvents.nodeAdded, { id: 3 }),
		).not.toThrow()
	})

	it('warns and broadcasts unmapped events with every argument', async () => {
		const { emit, socket, to } = createSocket()
		const logger = createServiceLogger()
		const adapter = new SocketEventAdapter(
			{
				getSocket: () => socket,
				getGeneration: () => 1,
				isCurrent: () => true,
			},
			logger,
		)
		adapter.send('UNMAPPED', { value: 1 }, 'second', 3)
		await new Promise<void>((resolve) => process.nextTick(resolve))
		expect(logger.warn.mock.calls).toHaveLength(1)
		expect(emit).toHaveBeenCalledWith('UNMAPPED', { value: 1 }, 'second', 3)
		expect(to).not.toHaveBeenCalled()
	})
})
