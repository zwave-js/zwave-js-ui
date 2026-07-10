/**
 * Characterizes: the 7 inbound (client -> server) Socket.IO event handlers
 * wired in `api/app.ts`'s `setupSocket()` - `INITED`, `ZWAVE_API`,
 * `MQTT_API`, `HASS_API`, `ZNIFFER_API`, `SUBSCRIBE`, `UNSUBSCRIBE`. Every
 * assertion is against the REAL ack envelope a real `socket.io-client`
 * receives over the wire, driving the REAL handler code in `api/app.ts`
 * (only its `gw`/`zniffer` collaborators are faked).
 *
 * Event names are hard-coded string literals here (not imported from
 * `api/lib/SocketEvents.ts`) - this file wire-tests what a real client
 * sends/receives, which by definition doesn't know about the server's
 * internal constant names.
 *
 * One harness is shared for the whole file (`beforeAll`/`afterAll` - see
 * `harness.ts`'s `close()` doc comment). Every test connects its own
 * client and installs its own `gw`/`zniffer` fakes; `afterEach` disconnects
 * clients and resets state so tests never see another test's wiring.
 *
 * Production always constructs `gw` (`new Gateway(...)`) before
 * `setupSocket()` is ever called, so a connected client can always reach
 * `gw` itself (never `undefined`) - every test below installs at least a
 * bare `createFakeGateway()`, varying only `.zwave`, to match that
 * invariant instead of exercising an impossible-in-production state.
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
import { createFakeGateway, createFakeZniffer } from './fakes.ts'

function emit<T = any>(
	client: ReturnType<SocketHarness['createClient']>,
	event: string,
	data: unknown,
): Promise<T> {
	return new Promise((resolve) => {
		client.emit(event, data, resolve)
	})
}

describe('Socket contract: inbound ACK APIs', () => {
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

	describe('INITED', () => {
		it('returns an empty-ish state when gw.zwave is not connected', async () => {
			harness.testHooks.setGateway(
				createFakeGateway({ zwave: undefined }) as any,
			)
			const client = await connectedClient()

			const state = await emit(client, 'INITED', {})
			expect(state).toStrictEqual({ debugCaptureActive: false })
		})

		it('returns gw.zwave.getState() plus debugCaptureActive when connected', async () => {
			const gateway = createFakeGateway()
			harness.testHooks.setGateway(gateway as any)
			const client = await connectedClient()

			const state = await emit(client, 'INITED', {})
			expect(gateway.zwave.getState).toHaveBeenCalledOnce()
			expect(state).toStrictEqual({
				nodes: [],
				info: {},
				error: null,
				debugCaptureActive: false,
			})
		})

		it('adds a zniffer key from zniffer.status() when a zniffer is set', async () => {
			harness.testHooks.setGateway(createFakeGateway() as any)
			const zniffer = createFakeZniffer({
				status: () => ({ active: true, frequency: 'us_lr' }) as any,
			})
			harness.testHooks.setZniffer(zniffer as any)
			const client = await connectedClient()

			const state = await emit<any>(client, 'INITED', {})
			expect(state.zniffer).toStrictEqual({
				active: true,
				frequency: 'us_lr',
			})
		})
	})

	describe('ZWAVE_API', () => {
		it('replies with exactly {success:false, message} and omits result/api when zwave is disconnected', async () => {
			harness.testHooks.setGateway(
				createFakeGateway({ zwave: undefined }) as any,
			)
			const client = await connectedClient()

			const result = await emit(client, 'ZWAVE_API', {
				api: 'anything',
				args: [],
			})
			expect(result).toStrictEqual({
				success: false,
				message: 'Zwave client not connected',
			})
		})

		it('calls gw.zwave.callApi(api, ...args), echoes back api, and defaults args to [] when omitted', async () => {
			const gateway = createFakeGateway()
			harness.testHooks.setGateway(gateway as any)
			const client = await connectedClient()

			const result = await emit(client, 'ZWAVE_API', {
				api: '_getScenes',
			})
			expect(gateway.zwave.callApi).toHaveBeenCalledWith('_getScenes')
			expect(result).toStrictEqual({
				success: true,
				message: 'OK',
				api: '_getScenes',
			})
		})

		it('echoes call arguments in order through to callApi', async () => {
			const gateway = createFakeGateway()
			harness.testHooks.setGateway(gateway as any)
			const client = await connectedClient()

			await emit(client, 'ZWAVE_API', {
				api: '_createScene',
				args: ['Party mode', 42],
			})
			expect(gateway.zwave.callApi).toHaveBeenCalledWith(
				'_createScene',
				'Party mode',
				42,
			)
		})
	})

	describe('MQTT_API', () => {
		it('calls gw.updateNodeTopics(args[0]) for the known "updateNodeTopics" action', async () => {
			const gateway = createFakeGateway()
			harness.testHooks.setGateway(gateway as any)
			const client = await connectedClient()

			const result = await emit(client, 'MQTT_API', {
				api: 'updateNodeTopics',
				args: [2],
			})
			expect(gateway.updateNodeTopics).toHaveBeenCalledWith(2)
			expect(result).toStrictEqual({
				success: true,
				message: 'Success MQTT api call',
				api: 'updateNodeTopics',
			})
		})

		it('quirk: an unknown action reports "Unknown MQTT api undefined" (default branch reads data.apiName, not data.api)', async () => {
			harness.testHooks.setGateway(createFakeGateway() as any)
			const client = await connectedClient()

			const result = await emit(client, 'MQTT_API', {
				api: 'notARealAction',
				args: [],
			})
			expect(result).toStrictEqual({
				success: false,
				message: 'Unknown MQTT api undefined',
				api: 'notARealAction',
			})
		})

		it('reports success:false with the thrown error message when the action throws', async () => {
			const gateway = createFakeGateway({
				updateNodeTopics: () => {
					throw new Error('boom')
				},
			} as any)
			harness.testHooks.setGateway(gateway as any)
			const client = await connectedClient()

			const result = await emit(client, 'MQTT_API', {
				api: 'updateNodeTopics',
				args: [2],
			})
			expect(result).toStrictEqual({
				success: false,
				message: 'boom',
				api: 'updateNodeTopics',
			})
		})
	})

	describe('HASS_API', () => {
		it('calls gw.rediscoverNode(nodeId) for the known "rediscoverNode" action and echoes apiName as api', async () => {
			const gateway = createFakeGateway({
				rediscoverNode: vi.fn(() => 'rediscovered'),
			} as any)
			harness.testHooks.setGateway(gateway as any)
			const client = await connectedClient()

			const result = await emit(client, 'HASS_API', {
				apiName: 'rediscoverNode',
				nodeId: 2,
			})
			expect(gateway.rediscoverNode).toHaveBeenCalledWith(2)
			expect(result).toStrictEqual({
				success: true,
				message: 'Success HASS api call',
				result: 'rediscovered',
				api: 'rediscoverNode',
			})
		})

		it('quirk: an unknown apiName silently "succeeds" (switch has no default case, res/err stay undefined)', async () => {
			harness.testHooks.setGateway(createFakeGateway() as any)
			const client = await connectedClient()

			const result = await emit(client, 'HASS_API', {
				apiName: 'notARealAction',
			})
			expect(result).toStrictEqual({
				success: true,
				message: 'Success HASS api call',
				api: 'notARealAction',
			})
		})

		it('reports success:false with the thrown error message when the action throws', async () => {
			const gateway = createFakeGateway({
				disableDiscovery: () => {
					throw new Error('hass boom')
				},
			} as any)
			harness.testHooks.setGateway(gateway as any)
			const client = await connectedClient()

			const result = await emit(client, 'HASS_API', {
				apiName: 'disableDiscovery',
				nodeId: 2,
			})
			expect(result).toStrictEqual({
				success: false,
				message: 'hass boom',
				api: 'disableDiscovery',
			})
		})
	})

	describe('ZNIFFER_API', () => {
		it('awaits zniffer.start() for the known "start" action', async () => {
			harness.testHooks.setGateway(createFakeGateway() as any)
			const zniffer = createFakeZniffer({
				start: vi.fn(() => Promise.resolve('started')),
			} as any)
			harness.testHooks.setZniffer(zniffer as any)
			const client = await connectedClient()

			const result = await emit(client, 'ZNIFFER_API', {
				apiName: 'start',
			})
			expect(zniffer.start).toHaveBeenCalledOnce()
			expect(result).toStrictEqual({
				success: true,
				message: 'Success ZNIFFER api call',
				result: 'started',
				api: 'start',
			})
		})

		it('reports success:false with "Unknown ZNIFFER api <name>" for an unknown apiName', async () => {
			harness.testHooks.setGateway(createFakeGateway() as any)
			harness.testHooks.setZniffer(createFakeZniffer() as any)
			const client = await connectedClient()

			const result = await emit(client, 'ZNIFFER_API', {
				apiName: 'notARealAction',
			})
			expect(result).toStrictEqual({
				success: false,
				message: 'Unknown ZNIFFER api notARealAction',
				api: 'notARealAction',
			})
		})

		it('quirk: loadCaptureFromBuffer is called WITHOUT await, so result is an unresolved Promise, not the resolved value', async () => {
			harness.testHooks.setGateway(createFakeGateway() as any)
			const zniffer = createFakeZniffer({
				loadCaptureFromBuffer: vi.fn(() =>
					Promise.resolve('parsed-capture'),
				),
			} as any)
			harness.testHooks.setZniffer(zniffer as any)
			const client = await connectedClient()

			const result = await emit<any>(client, 'ZNIFFER_API', {
				apiName: 'loadCaptureFromBuffer',
				buffer: [1, 2, 3],
			})
			expect(zniffer.loadCaptureFromBuffer).toHaveBeenCalledWith(
				Buffer.from([1, 2, 3]),
			)
			// The ack still reports success (no throw happened synchronously)
			// but `result` serializes to an empty object over the wire - it
			// is a Promise, not `'parsed-capture'` - proving the missing
			// `await` in production.
			expect(result.success).toBe(true)
			expect(result.result).toStrictEqual({})
			expect(result.result).not.toBe('parsed-capture')
		})
	})

	describe('SUBSCRIBE', () => {
		it('joins exactly the requested valid channel and acks with the current subscription list', async () => {
			harness.testHooks.setGateway(createFakeGateway() as any)
			const client = await connectedClient()

			const result = await emit<any>(client, 'SUBSCRIBE', {
				channels: ['nodes'],
			})
			expect(result).toStrictEqual({ channels: ['nodes'] })
		})

		it('filters out invalid channels while keeping valid ones from a mixed list', async () => {
			harness.testHooks.setGateway(createFakeGateway() as any)
			const client = await connectedClient()

			const result = await emit<any>(client, 'SUBSCRIBE', {
				channels: ['nodes', 'not-a-real-channel', 'values'],
			})
			expect(result.channels.sort()).toStrictEqual(['nodes', 'values'])
		})

		it('"all" expands to every channel, in channelMap declaration order', async () => {
			harness.testHooks.setGateway(createFakeGateway() as any)
			const client = await connectedClient()

			const result = await emit<any>(client, 'SUBSCRIBE', {
				channels: ['all'],
			})
			expect(result.channels).toStrictEqual([
				'controller',
				'nodes',
				'values',
				'statistics',
				'firmware',
				'debug',
				'znifferFrames',
				'znifferState',
				'rebuild',
				'diagnostics',
			])
		})

		it('acks with an empty channel list when data.channels is missing/not an array', async () => {
			harness.testHooks.setGateway(createFakeGateway() as any)
			const client = await connectedClient()

			const result = await emit<any>(client, 'SUBSCRIBE', {})
			expect(result).toStrictEqual({ channels: [] })
		})
	})

	describe('UNSUBSCRIBE', () => {
		it('leaves exactly the requested valid channel and acks with what remains', async () => {
			harness.testHooks.setGateway(createFakeGateway() as any)
			const client = await connectedClient()

			await emit(client, 'SUBSCRIBE', { channels: ['nodes', 'values'] })
			const result = await emit<any>(client, 'UNSUBSCRIBE', {
				channels: ['nodes'],
			})
			expect(result).toStrictEqual({ channels: ['values'] })
		})

		it('quirk: "all" is NOT special-cased for unsubscribe (asymmetric with subscribe) - it matches no real channel, so nothing is removed', async () => {
			harness.testHooks.setGateway(createFakeGateway() as any)
			const client = await connectedClient()

			await emit(client, 'SUBSCRIBE', { channels: ['nodes', 'values'] })
			const result = await emit<any>(client, 'UNSUBSCRIBE', {
				channels: ['all'],
			})
			expect(result.channels.sort()).toStrictEqual(['nodes', 'values'])
		})
	})
})
