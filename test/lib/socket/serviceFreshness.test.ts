/**
 * Real Socket.IO integration coverage for `api/socket/*.ts`'s per-call
 * gateway/zniffer freshness (Layer 6 of issue #4722) - the property
 * documented at the top of `registerSocketApi.ts`/`zwaveApi.ts`: every
 * inbound handler resolves the CURRENT gateway/zniffer via `runtime` on
 * every call, never a captured reference.
 *
 * `inboundApis.test.ts` already characterizes each handler's ack
 * envelope/wire contract against a gw/zniffer installed BEFORE the client
 * connects; this file instead swaps the collaborator via `testHooks`
 * WHILE a single client stays connected, proving the very next call (not
 * just the very next connection) observes the swap - and, separately,
 * that two concurrent in-flight calls each resolve independently (a call
 * already awaiting its gateway's response is never affected by a runtime
 * swap that happens after it started).
 *
 * One harness is shared per `describe` block (`beforeAll`/`afterAll` - see
 * `harness.ts`'s `close()` doc comment for why one harness can't be
 * recreated per file); `afterEach` disconnects clients and resets state.
 */
import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	afterEach,
	vi,
} from 'vitest'
import { createSocketHarness, type SocketHarness } from './harness.ts'
import {
	createFakeGateway,
	createFakeZniffer,
	createFakeZwaveClient,
} from './fakes.ts'

function emit<T = any>(
	client: ReturnType<SocketHarness['createClient']>,
	event: string,
	data: unknown,
): Promise<T> {
	return new Promise((resolve) => {
		client.emit(event, data, resolve)
	})
}

async function connectedClient(harness: SocketHarness) {
	const client = harness.createClient()
	await harness.connectClient(client)
	return client
}

describe('Socket contract: service freshness between calls on one connected client', () => {
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

	it('INITED resolves the gateway fresh on each call - a mid-session gateway swap is observed by the very next call, not the one the connection started with', async () => {
		const gwA = createFakeGateway({
			zwave: createFakeZwaveClient({
				getState: vi.fn(() => ({
					nodes: [],
					info: { label: 'A' },
					error: null,
				})),
			}),
		})
		harness.testHooks.setGateway(gwA as any)
		const client = await connectedClient(harness)

		const first = await emit(client, 'INITED', {})
		expect(first).toStrictEqual({
			nodes: [],
			info: { label: 'A' },
			error: null,
			debugCaptureActive: false,
		})

		const gwB = createFakeGateway({
			zwave: createFakeZwaveClient({
				getState: vi.fn(() => ({
					nodes: [],
					info: { label: 'B' },
					error: null,
				})),
			}),
		})
		harness.testHooks.setGateway(gwB as any)

		const second = await emit(client, 'INITED', {})
		expect(second).toStrictEqual({
			nodes: [],
			info: { label: 'B' },
			error: null,
			debugCaptureActive: false,
		})
		expect(gwA.zwave.getState).toHaveBeenCalledOnce()
		expect(gwB.zwave.getState).toHaveBeenCalledOnce()
	})

	it('ZWAVE_API resolves the gateway fresh on each call - a mid-session swap changes which gw.zwave.callApi() the very next call hits', async () => {
		const gwA = createFakeGateway({
			zwave: createFakeZwaveClient({
				callApi: vi.fn(() =>
					Promise.resolve({ success: true, message: 'from A' }),
				),
			}),
		})
		harness.testHooks.setGateway(gwA as any)
		const client = await connectedClient(harness)

		const first = await emit(client, 'ZWAVE_API', { api: 'x' })
		expect(first).toStrictEqual({
			success: true,
			message: 'from A',
			api: 'x',
		})

		const gwB = createFakeGateway({
			zwave: createFakeZwaveClient({
				callApi: vi.fn(() =>
					Promise.resolve({ success: true, message: 'from B' }),
				),
			}),
		})
		harness.testHooks.setGateway(gwB as any)

		const second = await emit(client, 'ZWAVE_API', { api: 'x' })
		expect(second).toStrictEqual({
			success: true,
			message: 'from B',
			api: 'x',
		})
		expect(gwA.zwave.callApi).toHaveBeenCalledTimes(1)
		expect(gwB.zwave.callApi).toHaveBeenCalledTimes(1)
	})

	it('ZNIFFER_API getFrames resolves the zniffer fresh on each call - a mid-session zniffer swap is observed immediately', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		const znifferA = createFakeZniffer({
			getFrames: vi.fn(() => ['frame-a']),
		})
		harness.testHooks.setZniffer(znifferA as any)
		const client = await connectedClient(harness)

		const first = await emit(client, 'ZNIFFER_API', {
			apiName: 'getFrames',
		})
		expect(first).toStrictEqual({
			success: true,
			message: 'Success ZNIFFER api call',
			result: ['frame-a'],
			api: 'getFrames',
		})

		const znifferB = createFakeZniffer({
			getFrames: vi.fn(() => ['frame-b']),
		})
		harness.testHooks.setZniffer(znifferB as any)

		const second = await emit(client, 'ZNIFFER_API', {
			apiName: 'getFrames',
		})
		expect(second).toStrictEqual({
			success: true,
			message: 'Success ZNIFFER api call',
			result: ['frame-b'],
			api: 'getFrames',
		})
	})
})

describe('Socket contract: per-call service freshness under concurrent in-flight requests', () => {
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

	it('a slow ZWAVE_API call already in flight when the gateway is swapped still resolves against the gateway it started with, while a call started after the swap resolves against the new one', async () => {
		let resolveSlow!: (value: unknown) => void
		const slow = new Promise((resolve) => {
			resolveSlow = resolve
		})
		// `emit()`'s real network round trip means the client-side test
		// code below has no inherent ordering guarantee against WHEN the
		// server actually receives/starts handling call #1 - so the swap
		// must wait on an explicit signal that call #1's handler already
		// resolved gwA and invoked its callApi(), not just "the test fired
		// the emit()". Without this, the swap could race ahead of the
		// server ever processing call #1 at all, defeating the test.
		let markCallApiStarted!: () => void
		const callApiStarted = new Promise<void>((resolve) => {
			markCallApiStarted = resolve
		})
		const gwA = createFakeGateway({
			zwave: createFakeZwaveClient({
				callApi: vi.fn(() => {
					markCallApiStarted()
					return slow
				}),
			}),
		})
		harness.testHooks.setGateway(gwA as any)
		const client = await connectedClient(harness)

		// Fire call #1 against gwA - its callApi() won't resolve until the
		// test explicitly tells it to, further down.
		const firstAck = emit(client, 'ZWAVE_API', { api: 'slowOp' })
		await callApiStarted

		// Swap the gateway WHILE call #1 is still awaiting its response.
		const gwB = createFakeGateway({
			zwave: createFakeZwaveClient({
				callApi: vi.fn(() =>
					Promise.resolve({ success: true, message: 'fast' }),
				),
			}),
		})
		harness.testHooks.setGateway(gwB as any)

		// Call #2, fired strictly after the swap, must hit gwB - and, being
		// fast, resolves well before call #1 does.
		const secondAck = await emit(client, 'ZWAVE_API', { api: 'fastOp' })
		expect(secondAck).toStrictEqual({
			success: true,
			message: 'fast',
			api: 'fastOp',
		})
		expect(gwB.zwave.callApi).toHaveBeenCalledWith('fastOp')
		expect(gwA.zwave.callApi).not.toHaveBeenCalledWith('fastOp')

		// Now let call #1 finish - it must still reflect gwA (the gateway
		// live when the ZWAVE_API handler originally resolved it for THAT
		// call), proving there is no shared "current gateway" mutated
		// mid-await by the later swap; each call snapshots its own gateway
		// once, up front, exactly like the original inline handler did.
		resolveSlow({ success: true, message: 'slow-done' })
		const firstResult = await firstAck
		expect(firstResult).toStrictEqual({
			success: true,
			message: 'slow-done',
			api: 'slowOp',
		})
		expect(gwA.zwave.callApi).toHaveBeenCalledWith('slowOp')
		expect(gwB.zwave.callApi).not.toHaveBeenCalledWith('slowOp')
	})
})

describe('Socket contract: default (no-op) ACK when a client omits the callback', () => {
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

	it('processes ZWAVE_API side effects even when the client supplies no ack callback at all (defaults to the shared no-op)', async () => {
		const gateway = createFakeGateway()
		harness.testHooks.setGateway(gateway as any)
		const client = await connectedClient(harness)

		// No callback argument at all - production's `cb = noop` default
		// must absorb this without throwing/hanging, while still driving
		// the real side effect (calling through to `gw.zwave.callApi`).
		client.emit('ZWAVE_API', { api: 'fireAndForget' })

		// A second, ack'd call on the same (FIFO, single-transport)
		// connection is a deterministic barrier: by the time ITS ack
		// arrives, the no-cb call above has already been fully processed
		// server-side.
		await emit(client, 'ZWAVE_API', { api: 'barrier' })

		expect(gateway.zwave.callApi).toHaveBeenCalledWith('fireAndForget')
	})
})
