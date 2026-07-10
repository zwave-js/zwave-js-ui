/**
 * Characterizes: real Socket.IO room-based routing driven by `SUBSCRIBE`/
 * `UNSUBSCRIBE` (requirement 7) - the same room mechanism every outbound
 * producer relies on via `ZwaveClient.sendToSocket`'s
 * `this.socket.to(channel).emit(...)` (see `outboundProducers.test.ts` for
 * the producer side; this file proves the room-membership side with
 * multiple real, independently connected `socket.io-client`s).
 *
 * One harness is shared for the whole file (`beforeAll`/`afterAll`).
 *
 * Determinism: every "client X does NOT receive event Y" assertion below
 * is proven with a `barrier()` round-trip rather than a fixed sleep. Every
 * connected socket auto-joins a private room named after its own `id`
 * (Socket.IO's built-in behavior, independent of `SUBSCRIBE`/`channelMap`),
 * so `barrier()` sends that one client a distinguishable event directly to
 * its own room and awaits it client-side. Per-connection delivery over a
 * single transport is FIFO, so by the time the barrier event is observed,
 * any real room-routed event emitted (server-side) *before* the barrier
 * has already been delivered (or definitively was never routed at all) -
 * no arbitrary wait window, no flakiness under load.
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

	/**
	 * Deterministically waits for everything already in flight to `client`
	 * to have arrived, by round-tripping a marker event through that
	 * client's own private auto-joined room (see file doc comment).
	 */
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

		// The client is still subscribed to 'controller', so re-emitting to
		// the now-unsubscribed 'firmware' room and then barrier-ing on
		// 'controller' proves - deterministically, not by timing - that
		// nothing new arrived for the room this client left: FIFO delivery
		// means an (incorrectly) routed firmware event would already be in
		// `box.received` by the time the barrier resolves.
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
