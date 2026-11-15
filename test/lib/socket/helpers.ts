// Shared Socket.IO client helpers for the socket contract suite (auth/inboundApis/subscriptions/
// outboundProducers/clientLifecycle): connecting/subscribing clients, awaiting events, and
// collecting/barrier-flushing delivery. Kept transport-specific - app/gateway fakes live in
// ./fakes.ts, cross-suite (HTTP+socket) fakes in ../shared/fakes.ts.
import type { Socket as ClientSocket } from 'socket.io-client'
import type { SocketHarness } from './harness.ts'

// Emits event with an ack callback and resolves with whatever the server acked, the same shape a
// real client's callback-style emit uses (INITED/SUBSCRIBE/UNSUBSCRIBE/ZWAVE_API/...)
export function emit<T = unknown>(
	client: ClientSocket,
	event: string,
	data: unknown,
): Promise<T> {
	return new Promise((resolve) => {
		client.emit(event, data, resolve)
	})
}

// Subscribes client to channels and resolves once the ack lands
export function subscribe(
	client: ClientSocket,
	channels: string[],
): Promise<{ channels: string[] }> {
	return emit(client, 'SUBSCRIBE', { channels })
}

// Unsubscribes client from channels and resolves once the ack lands
export function unsubscribe(
	client: ClientSocket,
	channels: string[],
): Promise<{ channels: string[] }> {
	return emit(client, 'UNSUBSCRIBE', { channels })
}

// Connects a bare client with no channel subscription
export async function connectedClient(
	harness: SocketHarness,
): Promise<ClientSocket> {
	const client = harness.createClient()
	await harness.connectClient(client)
	return client
}

// Connects a client and subscribes it to a single channel
export async function connectedSubscriber(
	harness: SocketHarness,
	channel: string,
): Promise<ClientSocket> {
	const client = await connectedClient(harness)
	await subscribe(client, [channel])
	return client
}

// Resolves with the payload the next time event is received on client, so delivery assertions are
// event-driven instead of timer-based
export function waitForEvent<T = unknown>(
	client: ClientSocket,
	event: string,
): Promise<T> {
	return new Promise((resolve) => client.once(event, resolve))
}

// Like waitForEvent, but captures every argument for events that pass more than one, e.g.
// NODE_UPDATED's (node, isPartial)
export function waitForArgs(
	client: ClientSocket,
	event: string,
): Promise<unknown[]> {
	return new Promise((resolve) =>
		client.once(event, (...args: unknown[]) => resolve(args)),
	)
}

// Collects every payload received for event on client
export function collector(
	client: ClientSocket,
	event: string,
): { received: unknown[] } {
	const box = { received: [] as unknown[] }
	client.on(event, (data: unknown) => box.received.push(data))
	return box
}

// Uses Socket.IO's documented automatic per-socket-id room so this marker rides the same
// per-room ordered delivery as the event under test, guaranteeing it arrives after.
export function barrier(
	harness: SocketHarness,
	client: ClientSocket,
): Promise<void> {
	const arrived = waitForEvent(client, '__TEST_BARRIER__')
	harness.io.to(client.id).emit('__TEST_BARRIER__')
	return arrived.then(() => undefined)
}
