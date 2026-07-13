import { describe, expect, it, vi } from 'vitest'
import type { Socket as ClientSocket } from 'socket.io-client'
import type { ZnifferApiRequest } from '#api/socket/znifferApi'
import {
	createFakeGateway,
	createFakeZniffer,
	createFakeZwaveClient,
} from './fakes.ts'
import { type SocketHarness, useSocketHarness } from './harness.ts'
import { setSettings } from '../shared/authHelpers.ts'

async function connectedClient(
	currentHarness: SocketHarness,
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

async function restart(harness: SocketHarness): Promise<void> {
	const response = await fetch(`${harness.url}/api/restart`, {
		method: 'POST',
	})
	expect(response.status).toBe(200)
	await expect(response.json()).resolves.toMatchObject({ success: true })
}

describe('Socket protocol runtime freshness', () => {
	const getHarness = useSocketHarness()

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

		await restart(currentHarness)

		const replacementState = await emit<Record<string, unknown>>(
			client,
			'INITED',
			{},
		)
		expect(replacementState).not.toMatchObject({
			info: { source: 'initial' },
		})
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
		await restart(currentHarness)

		await expect(
			emit(client, 'ZWAVE_API', { api: 'afterRestart' }),
		).resolves.toStrictEqual({
			success: false,
			message: 'Z-Wave client not connected',
			args: [],
			api: 'afterRestart',
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

		await setSettings(currentHarness, { zniffer: { enabled: false } })
		await restart(currentHarness)

		const replacementResult = await emit<{
			success: boolean
			result: unknown
		}>(client, 'ZNIFFER_API', {
			apiName: 'getFrames',
		} satisfies ZnifferApiRequest)
		expect(replacementResult.success).toBe(false)
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

		await restart(currentHarness)

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
