import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from 'vitest'
import {
	io as createSocketClient,
	type Socket as ClientSocket,
} from 'socket.io-client'
import type Gateway from '#api/lib/Gateway.ts'
import type ZnifferManager from '#api/lib/ZnifferManager.ts'
import type SocketManager from '#api/lib/SocketManager.ts'
import type { AppRuntime } from '#api/runtime/AppRuntime.ts'
import type { ZnifferApiRequest } from '#api/socket/znifferApi.ts'
import { cleanupTestEnv, ensureTestEnv } from './env.ts'
import {
	createFakeGateway,
	createFakeZniffer,
	createFakeZwaveClient,
	type FakeGateway,
	type FakeZniffer,
} from './fakes.ts'

interface RuntimeSocketHarness {
	runtime: AppRuntime
	socketManager: SocketManager
	url: string
	clients: Set<ClientSocket>
}

function asGateway(value: FakeGateway): Gateway {
	return value as unknown as Gateway
}

function asZniffer(value: FakeZniffer): ZnifferManager {
	return value as unknown as ZnifferManager
}

async function createRuntimeSocketHarness(): Promise<RuntimeSocketHarness> {
	ensureTestEnv()

	const [{ AppRuntime }, { default: SocketManager }, { registerSocketApi }] =
		await Promise.all([
			import('#api/runtime/AppRuntime.ts'),
			import('#api/lib/SocketManager.ts'),
			import('#api/socket/registerSocketApi.ts'),
		])

	const server = createServer()
	const socketManager = new SocketManager()
	socketManager.bindServer(server)
	const runtime = new AppRuntime({
		getSocketServer: () => socketManager.io,
	})
	registerSocketApi(socketManager, runtime)

	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', resolve)
	})

	const port = (server.address() as AddressInfo).port
	return {
		runtime,
		socketManager,
		url: `http://127.0.0.1:${port}`,
		clients: new Set(),
	}
}

function createClient(harness: RuntimeSocketHarness): ClientSocket {
	const client = createSocketClient(harness.url, {
		path: '/socket.io',
		autoConnect: false,
		reconnection: false,
		transports: ['websocket'],
	})
	harness.clients.add(client)
	return client
}

function connect(client: ClientSocket): Promise<void> {
	return new Promise((resolve, reject) => {
		client.once('connect', resolve)
		client.once('connect_error', reject)
		client.connect()
	})
}

function emit<T>(
	client: ClientSocket,
	event: string,
	data: unknown,
): Promise<T> {
	return new Promise((resolve) => {
		client.emit(event, data, resolve)
	})
}

async function waitForSocketCount(
	harness: RuntimeSocketHarness,
	count: number,
): Promise<void> {
	const deadline = Date.now() + 2000
	while (harness.socketManager.io.sockets.sockets.size !== count) {
		if (Date.now() >= deadline) {
			throw new Error(`Timed out waiting for ${count} connected sockets`)
		}
		await new Promise((resolve) => setTimeout(resolve, 10))
	}
}

async function disconnectClients(harness: RuntimeSocketHarness): Promise<void> {
	for (const client of harness.clients) {
		client.removeAllListeners()
		client.disconnect()
	}
	harness.clients.clear()
	await waitForSocketCount(harness, 0)
}

let harness: RuntimeSocketHarness

beforeAll(async () => {
	harness = await createRuntimeSocketHarness()
})

afterEach(async () => {
	await disconnectClients(harness)
	harness.runtime.setGateway(undefined)
	harness.runtime.setZniffer(undefined)
})

afterAll(async () => {
	await harness.socketManager.io.close()
	const { closeWatchers } = await import('#api/lib/Gateway.ts')
	closeWatchers()
	cleanupTestEnv()
})

describe('Socket protocol runtime freshness', () => {
	it.each([
		['false', false],
		['zero', 0],
		['empty string', ''],
		['null', null],
		['undefined', undefined],
	])('defaults %s Z-Wave args to an empty list', async (_label, args) => {
		const gateway = createFakeGateway()
		harness.runtime.setGateway(asGateway(gateway))
		const client = createClient(harness)
		await connect(client)

		await expect(
			emit(client, 'ZWAVE_API', {
				api: '_getScenes',
				args,
			}),
		).resolves.toStrictEqual({
			success: true,
			message: 'OK',
			api: '_getScenes',
		})
		expect(gateway.zwave.callApi).toHaveBeenCalledWith('_getScenes')
	})

	it('passes malformed iterable Z-Wave args in wire order', async () => {
		const gateway = createFakeGateway()
		harness.runtime.setGateway(asGateway(gateway))
		const client = createClient(harness)
		await connect(client)

		await emit(client, 'ZWAVE_API', {
			api: '_createScene',
			args: 'ab',
		})

		expect(gateway.zwave.callApi).toHaveBeenCalledWith(
			'_createScene',
			'a',
			'b',
		)
	})

	it('resolves a replacement gateway on the next ZWAVE_API call', async () => {
		const gatewayA = createFakeGateway({
			zwave: createFakeZwaveClient({
				callApi: vi.fn(() =>
					Promise.resolve({ success: true, message: 'from A' }),
				),
			}),
		})
		harness.runtime.setGateway(asGateway(gatewayA))
		const client = createClient(harness)
		await connect(client)

		await expect(
			emit(client, 'ZWAVE_API', { api: 'status' }),
		).resolves.toStrictEqual({
			success: true,
			message: 'from A',
			api: 'status',
		})

		const gatewayB = createFakeGateway({
			zwave: createFakeZwaveClient({
				callApi: vi.fn(() =>
					Promise.resolve({ success: true, message: 'from B' }),
				),
			}),
		})
		harness.runtime.setGateway(asGateway(gatewayB))

		await expect(
			emit(client, 'ZWAVE_API', { api: 'status' }),
		).resolves.toStrictEqual({
			success: true,
			message: 'from B',
			api: 'status',
		})
		expect(gatewayA.zwave.callApi).toHaveBeenCalledOnce()
		expect(gatewayB.zwave.callApi).toHaveBeenCalledOnce()
	})

	it('keeps an in-flight call on its original gateway after replacement', async () => {
		let resolveSlow!: (value: unknown) => void
		const slowResult = new Promise((resolve) => {
			resolveSlow = resolve
		})
		let markStarted!: () => void
		const started = new Promise<void>((resolve) => {
			markStarted = resolve
		})
		const gatewayA = createFakeGateway({
			zwave: createFakeZwaveClient({
				callApi: vi.fn(() => {
					markStarted()
					return slowResult
				}),
			}),
		})
		harness.runtime.setGateway(asGateway(gatewayA))
		const client = createClient(harness)
		await connect(client)

		const firstAck = emit(client, 'ZWAVE_API', { api: 'slow' })
		await started

		const gatewayB = createFakeGateway({
			zwave: createFakeZwaveClient({
				callApi: vi.fn(() =>
					Promise.resolve({ success: true, message: 'fast' }),
				),
			}),
		})
		harness.runtime.setGateway(asGateway(gatewayB))

		await expect(
			emit(client, 'ZWAVE_API', { api: 'fast' }),
		).resolves.toStrictEqual({
			success: true,
			message: 'fast',
			api: 'fast',
		})

		resolveSlow({ success: true, message: 'slow' })
		await expect(firstAck).resolves.toStrictEqual({
			success: true,
			message: 'slow',
			api: 'slow',
		})
		expect(gatewayA.zwave.callApi).toHaveBeenCalledWith('slow')
		expect(gatewayB.zwave.callApi).toHaveBeenCalledWith('fast')
	})

	it('resolves a replacement Zniffer on the next ZNIFFER_API call', async () => {
		const gateway = createFakeGateway()
		const znifferA = createFakeZniffer({
			getFrames: vi.fn(() => ['frame-a']),
		})
		harness.runtime.setGateway(asGateway(gateway))
		harness.runtime.setZniffer(asZniffer(znifferA))
		const client = createClient(harness)
		await connect(client)

		await expect(
			emit(client, 'ZNIFFER_API', {
				apiName: 'getFrames',
			} satisfies ZnifferApiRequest),
		).resolves.toMatchObject({ result: ['frame-a'] })

		const znifferB = createFakeZniffer({
			getFrames: vi.fn(() => ['frame-b']),
		})
		harness.runtime.setZniffer(asZniffer(znifferB))

		await expect(
			emit(client, 'ZNIFFER_API', {
				apiName: 'getFrames',
			} satisfies ZnifferApiRequest),
		).resolves.toMatchObject({ result: ['frame-b'] })
	})

	it('accepts a stop request without a buffer', async () => {
		const gateway = createFakeGateway()
		const zniffer = createFakeZniffer()
		harness.runtime.setGateway(asGateway(gateway))
		harness.runtime.setZniffer(asZniffer(zniffer))
		const client = createClient(harness)
		await connect(client)

		await emit(client, 'ZNIFFER_API', {
			apiName: 'stop',
		} satisfies ZnifferApiRequest)

		expect(zniffer.stop).toHaveBeenCalledOnce()
	})

	it('accepts a clear request without a buffer', async () => {
		const gateway = createFakeGateway()
		const zniffer = createFakeZniffer()
		harness.runtime.setGateway(asGateway(gateway))
		harness.runtime.setZniffer(asZniffer(zniffer))
		const client = createClient(harness)
		await connect(client)

		await emit(client, 'ZNIFFER_API', {
			apiName: 'clear',
		} satisfies ZnifferApiRequest)

		expect(zniffer.clear).toHaveBeenCalledOnce()
	})

	it('uses the current gateway for each first-client and last-client event', async () => {
		const gatewayA = createFakeGateway()
		harness.runtime.setGateway(asGateway(gatewayA))
		const clientA = createClient(harness)
		await connect(clientA)
		expect(gatewayA.zwave.setUserCallbacks).toHaveBeenCalledOnce()

		clientA.disconnect()
		await waitForSocketCount(harness, 0)
		expect(gatewayA.zwave.removeUserCallbacks).toHaveBeenCalledOnce()

		const gatewayB = createFakeGateway()
		harness.runtime.setGateway(asGateway(gatewayB))
		const clientB = createClient(harness)
		await connect(clientB)
		expect(gatewayB.zwave.setUserCallbacks).toHaveBeenCalledOnce()

		clientB.disconnect()
		await waitForSocketCount(harness, 0)
		expect(gatewayB.zwave.removeUserCallbacks).toHaveBeenCalledOnce()
		expect(gatewayA.zwave.removeUserCallbacks).toHaveBeenCalledOnce()
	})

	it('processes an event without an acknowledgement callback', async () => {
		const gateway = createFakeGateway()
		harness.runtime.setGateway(asGateway(gateway))
		const client = createClient(harness)
		await connect(client)

		client.emit('ZWAVE_API', { api: 'fireAndForget' })

		// The acknowledged call is a FIFO barrier for the unacknowledged event
		await emit(client, 'ZWAVE_API', { api: 'barrier' })
		expect(gateway.zwave.callApi).toHaveBeenCalledWith('fireAndForget')
	})
})
