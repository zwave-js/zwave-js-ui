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

let harness: SocketHarness

// Share one harness because the cached SocketManager retains each clients listener for the file lifetime
beforeAll(async () => {
	harness = await createSocketHarness()
})

afterEach(async () => {
	await harness.disconnectAllClients()
	harness.resetState()
})

afterAll(async () => {
	await harness.close()
})

describe('Socket contract: service freshness between calls on one connected client', () => {
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
	it('a slow ZWAVE_API call already in flight when the gateway is swapped still resolves against the gateway it started with, while a call started after the swap resolves against the new one', async () => {
		let resolveSlow!: (value: unknown) => void
		const slow = new Promise((resolve) => {
			resolveSlow = resolve
		})
		// Wait for call #1 to enter callApi before swapping because network delivery is asynchronous
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

		const firstAck = emit(client, 'ZWAVE_API', { api: 'slowOp' })
		await callApiStarted

		const gwB = createFakeGateway({
			zwave: createFakeZwaveClient({
				callApi: vi.fn(() =>
					Promise.resolve({ success: true, message: 'fast' }),
				),
			}),
		})
		harness.testHooks.setGateway(gwB as any)

		const secondAck = await emit(client, 'ZWAVE_API', { api: 'fastOp' })
		expect(secondAck).toStrictEqual({
			success: true,
			message: 'fast',
			api: 'fastOp',
		})
		expect(gwB.zwave.callApi).toHaveBeenCalledWith('fastOp')
		expect(gwA.zwave.callApi).not.toHaveBeenCalledWith('fastOp')

		// Resolve the first call after the swap to prove its gateway remains stable across await
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
	it('processes ZWAVE_API side effects even when the client supplies no ack callback at all (defaults to the shared no-op)', async () => {
		const gateway = createFakeGateway()
		harness.testHooks.setGateway(gateway as any)
		const client = await connectedClient(harness)

		client.emit('ZWAVE_API', { api: 'fireAndForget' })

		// Use the acknowledged second call as a FIFO barrier for the unacknowledged call
		await emit(client, 'ZWAVE_API', { api: 'barrier' })

		expect(gateway.zwave.callApi).toHaveBeenCalledWith('fireAndForget')
	})
})
