import { describe, expect, it, vi } from 'vitest'
import type { Socket as ClientSocket } from 'socket.io-client'
import type { AppRuntime } from '#api/runtime/AppRuntime.ts'
import type { ZnifferApiRequest } from '#api/socket/znifferApi.ts'
import {
	createFakeGateway,
	createFakeZniffer,
	createFakeZwaveClient,
	type FakeGateway,
	type FakeZniffer,
} from './fakes.ts'
import { createSocketTransport, type SocketTransport } from './harness.ts'
import {
	useHarnessLifecycle,
	type SharedTestContext,
} from '../shared/harness.ts'

interface RuntimeHarnessOptions {
	gateway: FakeGateway
	zniffer?: FakeZniffer
}

type RuntimeHarness = SocketTransport<AppRuntime> & {
	closeInstance(): Promise<void>
}

async function createRuntimeHarness(
	_shared: SharedTestContext,
	options: RuntimeHarnessOptions,
): Promise<RuntimeHarness> {
	const [{ AppRuntime }, { default: SocketManager }, { registerSocketApi }] =
		await Promise.all([
			import('#api/runtime/AppRuntime.ts'),
			import('#api/lib/SocketManager.ts'),
			import('#api/socket/registerSocketApi.ts'),
		])
	const transport = await createSocketTransport((server) => {
		const socketManager = new SocketManager()
		socketManager.bindServer(server)
		const runtime = new AppRuntime({
			getSocketServer: () => socketManager.io,
			gateway: options.gateway,
			zniffer: options.zniffer,
		})
		registerSocketApi(socketManager, runtime)
		return {
			context: runtime,
			io: socketManager.io,
			close: () => socketManager.close(),
		}
	})
	return {
		...transport,
		async closeInstance() {
			await transport.close()
			await transport.context.getZniffer()?.close()
			await transport.context.shutdown()
		},
	}
}

async function connectedClient(
	currentHarness: SocketTransport<AppRuntime>,
): Promise<ClientSocket> {
	const client = currentHarness.createClient()
	await currentHarness.connectClient(client)
	return client
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

describe('Socket protocol runtime freshness', () => {
	const getHarness = useHarnessLifecycle(createRuntimeHarness)

	it.each([
		['false', false],
		['zero', 0],
		['empty string', ''],
		['null', null],
		['undefined', undefined],
	])('defaults %s Z-Wave args to an empty list', async (_label, args) => {
		const gateway = createFakeGateway()
		const currentHarness = await getHarness({ gateway })
		const client = await connectedClient(currentHarness)

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
		const currentHarness = await getHarness({ gateway })
		const client = await connectedClient(currentHarness)

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

	it('resolves a replacement gateway on the next request', async () => {
		const gateway = createFakeGateway({
			zwave: createFakeZwaveClient({
				getState: vi.fn(() => ({
					nodes: [],
					info: { source: 'initial' },
					error: null,
				})),
			}),
		})
		const currentHarness = await getHarness({ gateway })
		const client = await connectedClient(currentHarness)

		await expect(emit(client, 'INITED', {})).resolves.toMatchObject({
			info: { source: 'initial' },
		})

		await currentHarness.context.startGateway({})

		const replacementState = await emit<Record<string, unknown>>(
			client,
			'INITED',
			{},
		)
		expect(replacementState).not.toHaveProperty('info')
		expect(gateway.zwave.getState).toHaveBeenCalledOnce()
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
		const gateway = createFakeGateway({
			zwave: createFakeZwaveClient({
				callApi: vi.fn(() => {
					markStarted()
					return slowResult
				}),
			}),
		})
		const currentHarness = await getHarness({ gateway })
		const client = await connectedClient(currentHarness)

		const firstAck = emit(client, 'ZWAVE_API', { api: 'slow' })
		await started
		await currentHarness.context.startGateway({})

		await expect(
			emit(client, 'ZWAVE_API', { api: 'afterRestart' }),
		).resolves.toStrictEqual({
			success: false,
			message: 'Zwave client not connected',
		})

		resolveSlow({ success: true, message: 'slow' })
		await expect(firstAck).resolves.toStrictEqual({
			success: true,
			message: 'slow',
			api: 'slow',
		})
		expect(gateway.zwave.callApi).toHaveBeenCalledOnce()
	})

	it('resolves a replacement Zniffer on the next request', async () => {
		const gateway = createFakeGateway()
		const zniffer = createFakeZniffer({
			getFrames: vi.fn(() => ['frame-a']),
		})
		const currentHarness = await getHarness({ gateway, zniffer })
		const client = await connectedClient(currentHarness)

		await expect(
			emit(client, 'ZNIFFER_API', {
				apiName: 'getFrames',
			} satisfies ZnifferApiRequest),
		).resolves.toMatchObject({ result: ['frame-a'] })

		currentHarness.context.startZniffer({ enabled: false })

		await expect(
			emit(client, 'ZNIFFER_API', {
				apiName: 'getFrames',
			} satisfies ZnifferApiRequest),
		).resolves.toMatchObject({
			success: false,
			message: 'Zniffer is not initialized',
		})
		expect(zniffer.getFrames).toHaveBeenCalledOnce()
	})

	it('accepts a stop request without a buffer', async () => {
		const gateway = createFakeGateway()
		const zniffer = createFakeZniffer()
		const currentHarness = await getHarness({ gateway, zniffer })
		const client = await connectedClient(currentHarness)

		await emit(client, 'ZNIFFER_API', {
			apiName: 'stop',
		} satisfies ZnifferApiRequest)

		expect(zniffer.stop).toHaveBeenCalledOnce()
	})

	it('accepts a clear request without a buffer', async () => {
		const gateway = createFakeGateway()
		const zniffer = createFakeZniffer()
		const currentHarness = await getHarness({ gateway, zniffer })
		const client = await connectedClient(currentHarness)

		await emit(client, 'ZNIFFER_API', {
			apiName: 'clear',
		} satisfies ZnifferApiRequest)

		expect(zniffer.clear).toHaveBeenCalledOnce()
	})

	it('uses the current gateway as clients connect and disconnect', async () => {
		const gateway = createFakeGateway()
		const currentHarness = await getHarness({ gateway })
		const clientA = await connectedClient(currentHarness)
		expect(gateway.zwave.setUserCallbacks).toHaveBeenCalledOnce()

		clientA.disconnect()
		await currentHarness.waitForServerSocketCount(0)
		expect(gateway.zwave.removeUserCallbacks).toHaveBeenCalledOnce()

		await currentHarness.context.startGateway({})

		const clientB = await connectedClient(currentHarness)
		clientB.disconnect()
		await currentHarness.waitForServerSocketCount(0)
		expect(gateway.zwave.setUserCallbacks).toHaveBeenCalledOnce()
		expect(gateway.zwave.removeUserCallbacks).toHaveBeenCalledOnce()
	})

	it('processes a request without an acknowledgement callback', async () => {
		const gateway = createFakeGateway()
		const currentHarness = await getHarness({ gateway })
		const client = await connectedClient(currentHarness)

		client.emit('ZWAVE_API', { api: 'fireAndForget' })
		// Socket.IO guarantees ordering, so the acknowledged call flushes the earlier request
		await emit(client, 'ZWAVE_API', { api: 'barrier' })

		expect(gateway.zwave.callApi).toHaveBeenCalledWith('fireAndForget')
	})
})
