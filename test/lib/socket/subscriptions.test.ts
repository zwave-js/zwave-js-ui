/**
 * Characterizes: real Socket.IO room-based routing driven by `SUBSCRIBE`/
 * `UNSUBSCRIBE` (requirement 7) - the same room mechanism every outbound
 * producer relies on via `ZwaveClient.sendToSocket`'s
 * `this.socket.to(channel).emit(...)` (see `outboundProducers.test.ts` for
 * the producer side; this file proves the room-membership side with
 * multiple real, independently connected `socket.io-client`s).
 *
 * One harness is shared for the whole file (`beforeAll`/`afterAll`).
 */
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

/** Collects every payload received for `event` on `client` until closed. */
function collector(client: any, event: string): { received: unknown[] } {
	const box = { received: [] as unknown[] }
	client.on(event, (data: unknown) => box.received.push(data))
	return box
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

	it('routes an event only to clients subscribed to its channel', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		const clientA = await connectedClient()
		const clientB = await connectedClient()

		await subscribe(clientA, ['nodes'])
		await subscribe(clientB, ['values'])

		const nodesBoxA = collector(clientA, 'NODE_UPDATED')
		const nodesBoxB = collector(clientB, 'NODE_UPDATED')

		harness.io.to('nodes').emit('NODE_UPDATED', { id: 2, ready: true })
		await new Promise((resolve) => setTimeout(resolve, 20))

		expect(nodesBoxA.received).toEqual([{ id: 2, ready: true }])
		expect(nodesBoxB.received).toEqual([])
	})

	it('delivers an event to every client subscribed to the same channel', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		const clientA = await connectedClient()
		const clientB = await connectedClient()

		await subscribe(clientA, ['statistics'])
		await subscribe(clientB, ['statistics'])

		const boxA = collector(clientA, 'STATISTICS')
		const boxB = collector(clientB, 'STATISTICS')

		harness.io.to('statistics').emit('STATISTICS', { nodeId: 2 })
		await new Promise((resolve) => setTimeout(resolve, 20))

		expect(boxA.received).toEqual([{ nodeId: 2 }])
		expect(boxB.received).toEqual([{ nodeId: 2 }])
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

		const collectors = boxes.map(([, event]) => collector(client, event))

		for (const [channel, event, payload] of boxes) {
			harness.io.to(channel).emit(event, payload)
		}
		await new Promise((resolve) => setTimeout(resolve, 20))

		boxes.forEach(([, , payload], i) => {
			expect(collectors[i].received).toEqual([payload])
		})
	})

	it('ignores invalid channels mixed into a subscribe request, still routing the valid one', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		const client = await connectedClient()

		const ack = await subscribe(client, ['bogus-channel', 'rebuild'])
		expect(ack).toStrictEqual({ channels: ['rebuild'] })

		const box = collector(client, 'REBUILD_ROUTES_PROGRESS')
		harness.io.to('rebuild').emit('REBUILD_ROUTES_PROGRESS', { nodeId: 4 })
		await new Promise((resolve) => setTimeout(resolve, 20))

		expect(box.received).toEqual([{ nodeId: 4 }])
	})

	it('stops delivering events to a channel once the client unsubscribes from it', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		const client = await connectedClient()

		await subscribe(client, ['firmware'])
		const box = collector(client, 'OTW_FIRMWARE_UPDATE')

		harness.io.to('firmware').emit('OTW_FIRMWARE_UPDATE', { progress: 10 })
		await new Promise((resolve) => setTimeout(resolve, 20))
		expect(box.received).toEqual([{ progress: 10 }])

		const ack = await unsubscribe(client, ['firmware'])
		expect(ack).toStrictEqual({ channels: [] })

		harness.io.to('firmware').emit('OTW_FIRMWARE_UPDATE', { progress: 20 })
		await new Promise((resolve) => setTimeout(resolve, 20))

		// Still just the one event from before unsubscribing - nothing new
		// arrived for the room this client left.
		expect(box.received).toEqual([{ progress: 10 }])
	})

	it('a still-subscribed client keeps receiving events after an unrelated client unsubscribes', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		const clientA = await connectedClient()
		const clientB = await connectedClient()

		await subscribe(clientA, ['controller'])
		await subscribe(clientB, ['controller'])
		await unsubscribe(clientB, ['controller'])

		const boxA = collector(clientA, 'CONTROLLER_CMD')
		const boxB = collector(clientB, 'CONTROLLER_CMD')

		harness.io.to('controller').emit('CONTROLLER_CMD', { status: 'idle' })
		await new Promise((resolve) => setTimeout(resolve, 20))

		expect(boxA.received).toEqual([{ status: 'idle' }])
		expect(boxB.received).toEqual([])
	})
})
