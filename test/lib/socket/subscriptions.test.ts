// Proves an event is absent using barrier(): a client's own private id-room gets a distinguishable event, and FIFO per-connection delivery guarantees anything routed earlier already arrived by the time that resolves
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { createSocketHarness, type SocketHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'

function subscribe(client: any, channels: string[]): Promise<any> {
	return new Promise((resolve) => {
		client.emit('SUBSCRIBE', { channels }, resolve)
	})
}

function unsubscribe(client: any, channels: string[]): Promise<any> {
	return new Promise((resolve) => {
		client.emit('UNSUBSCRIBE', { channels }, resolve)
	})
}

// Collects every payload received for event on client
function collector(client: any, event: string): { received: unknown[] } {
	const box = { received: [] as unknown[] }
	client.on(event, (data: unknown) => box.received.push(data))
	return box
}

/** Resolves the next time `event` fires on `client`, with its payload. */
function waitForEvent<T = unknown>(client: any, event: string): Promise<T> {
	return new Promise((resolve) => client.once(event, resolve))
}

describe('Socket contract: multi-client room routing', () => {
	let harness: SocketHarness

	beforeAll(async () => {
		harness = await createSocketHarness()
	})

	afterAll(async () => {
		await harness.close()
	})

	afterEach(async () => {
		await harness.disconnectAllClients()
		harness.resetState()
	})

	async function connectedClient() {
		const client = harness.createClient()
		await harness.connectClient(client)
		return client
	}

	// Every socket auto-joins a room named after its own id as a Socket.IO built-in, unrelated to SUBSCRIBE/channelMap
	// Round-trips a marker event through client's own private auto-joined room to deterministically flush anything already in flight
	function barrier(client: any): Promise<void> {
		const arrived = waitForEvent(client, '__TEST_BARRIER__')
		harness.io.to(client.id).emit('__TEST_BARRIER__')
		return arrived.then(() => undefined)
	}

	it('routes an event only to clients subscribed to its channel', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		const clientA = await connectedClient()
		const clientB = await connectedClient()

		await subscribe(clientA, ['nodes'])
		await subscribe(clientB, ['values'])

		const nodesBoxB = collector(clientB, 'NODE_UPDATED')
		const receivedA = waitForEvent(clientA, 'NODE_UPDATED')

		harness.io.to('nodes').emit('NODE_UPDATED', { id: 2, ready: true })

		expect(await receivedA).toEqual({ id: 2, ready: true })
		await barrier(clientB)
		expect(nodesBoxB.received).toEqual([])
	})

	it('delivers an event to every client subscribed to the same channel', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		const clientA = await connectedClient()
		const clientB = await connectedClient()

		await subscribe(clientA, ['statistics'])
		await subscribe(clientB, ['statistics'])

		const receivedA = waitForEvent(clientA, 'STATISTICS')
		const receivedB = waitForEvent(clientB, 'STATISTICS')

		harness.io.to('statistics').emit('STATISTICS', { nodeId: 2 })

		expect(await receivedA).toEqual({ nodeId: 2 })
		expect(await receivedB).toEqual({ nodeId: 2 })
	})

	it('"all" subscribes a client to every real channel at once', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		const client = await connectedClient()

		await subscribe(client, ['all'])

		const boxes = [
			['nodes', 'NODE_ADDED', { id: 3 }],
			['values', 'VALUE_UPDATED', { commandClass: 37 }],
			['debug', 'DEBUG', { data: 'log line' }],
			['diagnostics', 'LINK_RELIABILITY', { nodeId: 3 }],
		] as const

		const received = boxes.map(([, event]) => waitForEvent(client, event))

		for (const [channel, event, payload] of boxes) {
			harness.io.to(channel).emit(event, payload)
		}

		const results = await Promise.all(received)
		boxes.forEach(([, , payload], i) => {
			expect(results[i]).toEqual(payload)
		})
	})

	it('ignores invalid channels mixed into a subscribe request, still routing the valid one', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		const client = await connectedClient()

		const ack = await subscribe(client, ['bogus-channel', 'rebuild'])
		expect(ack).toStrictEqual({ channels: ['rebuild'] })

		const received = waitForEvent(client, 'REBUILD_ROUTES_PROGRESS')
		harness.io.to('rebuild').emit('REBUILD_ROUTES_PROGRESS', { nodeId: 4 })

		expect(await received).toEqual({ nodeId: 4 })
	})

	it('stops delivering events to a channel once the client unsubscribes from it', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		const client = await connectedClient()

		await subscribe(client, ['firmware', 'controller'])
		const box = collector(client, 'OTW_FIRMWARE_UPDATE')

		const receivedFirst = waitForEvent(client, 'OTW_FIRMWARE_UPDATE')
		harness.io.to('firmware').emit('OTW_FIRMWARE_UPDATE', { progress: 10 })
		expect(await receivedFirst).toEqual({ progress: 10 })
		expect(box.received).toEqual([{ progress: 10 }])

		const ack = await unsubscribe(client, ['firmware'])
		expect(ack).toStrictEqual({ channels: ['controller'] })

		// FIFO delivery means a firmware event routed to this client would already be in box.received once the barrier resolves
		harness.io.to('firmware').emit('OTW_FIRMWARE_UPDATE', { progress: 20 })
		await barrier(client)

		expect(box.received).toEqual([{ progress: 10 }])
	})

	it('a still-subscribed client keeps receiving events after an unrelated client unsubscribes', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		const clientA = await connectedClient()
		const clientB = await connectedClient()

		await subscribe(clientA, ['controller'])
		await subscribe(clientB, ['controller'])
		await unsubscribe(clientB, ['controller'])

		const boxB = collector(clientB, 'CONTROLLER_CMD')
		const receivedA = waitForEvent(clientA, 'CONTROLLER_CMD')

		harness.io.to('controller').emit('CONTROLLER_CMD', { status: 'idle' })

		expect(await receivedA).toEqual({ status: 'idle' })
		await barrier(clientB)
		expect(boxB.received).toEqual([])
	})
})
