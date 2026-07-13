// Event names are hard-coded literals, not imported from SocketEvents.ts, since a real client's wire format doesn't know the server's internal constant names
// The real 'clients' callback calls gw.zwave?.setUserCallbacks() on every connect and throws
// if gw is undefined, so every test installs at least a bare gateway fake
import { describe, it, expect, beforeAll, vi } from 'vitest'
import type { Driver } from 'zwave-js'
import { ALL_CHANNELS } from '#api/lib/SocketEvents.ts'
import type ZWaveClientType from '#api/lib/ZwaveClient.ts'
import { useSocketHarness } from './harness.ts'
import {
	createFakeGateway,
	createFakeZniffer,
	type FakeGateway,
} from './fakes.ts'
import { connectedClient, emit } from './helpers.ts'

describe('Socket contract: inbound ACK APIs', () => {
	const getHarness = useSocketHarness()
	let ZWaveClient: typeof ZWaveClientType

	beforeAll(async () => {
		// Registered after useSocketHarness()'s beforeAll, so STORE_DIR is isolated first
		;({ default: ZWaveClient } = await import('#api/lib/ZwaveClient.ts'))
	})

	describe('INITED', () => {
		it('returns an empty-ish state when gw.zwave is not connected', async () => {
			const harness = await getHarness({
				gateway: createFakeGateway({ zwave: undefined }),
			})
			const client = await connectedClient(harness)

			const state = await emit(client, 'INITED', {})
			expect(state).toStrictEqual({ debugCaptureActive: false })
		})

		it('returns gw.zwave.getState() plus debugCaptureActive when connected', async () => {
			const gateway = createFakeGateway()
			const harness = await getHarness({ gateway })
			const client = await connectedClient(harness)

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
			const zniffer = createFakeZniffer({
				status: vi.fn(() => ({ active: true, frequency: 'us_lr' })),
			})
			const harness = await getHarness({
				gateway: createFakeGateway(),
				zniffer,
			})
			const client = await connectedClient(harness)

			const state = await emit<{
				zniffer: { active: boolean; frequency: string }
			}>(client, 'INITED', {})
			expect(state.zniffer).toStrictEqual({
				active: true,
				frequency: 'us_lr',
			})
		})
	})

	describe('ZWAVE_API', () => {
		it('replies with exactly {success:false, message} and omits result/api when zwave is disconnected', async () => {
			const harness = await getHarness({
				gateway: createFakeGateway({ zwave: undefined }),
			})
			const client = await connectedClient(harness)

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
			const harness = await getHarness({ gateway })
			const client = await connectedClient(harness)

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
			const harness = await getHarness({ gateway })
			const client = await connectedClient(harness)

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

		it('routes through the REAL ZwaveClient.callApi() dispatcher (not a mocked gw.zwave.callApi) for a real allowed method, echoing its real success/result/args', async () => {
			// Every other test in this block uses createFakeGateway()'s mocked zwave.callApi.
			// This one wires a real ZWaveClient so the real dispatcher actually runs.
			const gateway = createFakeGateway({ zwave: undefined })
			const harness = await getHarness({ gateway })
			const zwave = new ZWaveClient({}, harness.io)
			zwave['scenes'] = [{ sceneid: 1, label: 'Party', values: [] }]
			zwave['_driver'] = {} as unknown as Driver
			zwave.driverReady = true
			// gw, held by the already-running app, is this same gateway object, so mutating it
			// here mimics a live reconnect with no post-construction app/harness API involved
			// FakeGateway's zwave is a mock-shaped interface a real ZWaveClient instance doesn't structurally satisfy, hence the cast
			gateway.zwave = zwave as unknown as FakeGateway['zwave']
			const client = await connectedClient(harness)

			const result = await emit(client, 'ZWAVE_API', {
				api: '_sceneGetValues',
				args: [1],
			})

			expect(result).toStrictEqual({
				success: true,
				message: 'Success zwave api call',
				result: [],
				args: [1],
				api: '_sceneGetValues',
			})
		})
	})

	describe('MQTT_API', () => {
		it('calls gw.updateNodeTopics(args[0]) for the known "updateNodeTopics" action', async () => {
			const gateway = createFakeGateway()
			const harness = await getHarness({ gateway })
			const client = await connectedClient(harness)

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

		// Regression coverage for the #4740 dispatch bug: the default branch used to read the
		// nonexistent data.apiName, always reporting "undefined" regardless of the actual action
		it('reports "Unknown MQTT api <api>" for an unrecognized action', async () => {
			const harness = await getHarness({ gateway: createFakeGateway() })
			const client = await connectedClient(harness)

			const result = await emit(client, 'MQTT_API', {
				api: 'notARealAction',
				args: [],
			})
			expect(result).toStrictEqual({
				success: false,
				message: 'Unknown MQTT api notARealAction',
				api: 'notARealAction',
			})
		})

		it('reports success:false with the thrown error message when the action throws', async () => {
			const gateway = createFakeGateway({
				updateNodeTopics: vi.fn(() => {
					throw new Error('boom')
				}),
			})
			const harness = await getHarness({ gateway })
			const client = await connectedClient(harness)

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
		it('calls gw.rediscoverNode(nodeId) for the known "rediscoverNode" action - real signature is void, so `result` is stripped from the wire ack', async () => {
			// Matches the real void signature so Socket.IO's ack serialization strips the undefined result key entirely, instead of masking a regression behind a fake string return
			const gateway = createFakeGateway({
				rediscoverNode: vi.fn(),
			})
			const harness = await getHarness({ gateway })
			const client = await connectedClient(harness)

			const result = await emit(client, 'HASS_API', {
				apiName: 'rediscoverNode',
				nodeId: 2,
			})
			expect(gateway.rediscoverNode).toHaveBeenCalledWith(2)
			expect(result).toStrictEqual({
				success: true,
				message: 'Success HASS api call',
				api: 'rediscoverNode',
			})
			expect('result' in result).toBe(false)
		})

		// See #4740 for the tracked follow-up on this asymmetry
		it('quirk: an unknown apiName silently "succeeds" (switch has no default case, res/err stay undefined)', async () => {
			const harness = await getHarness({ gateway: createFakeGateway() })
			const client = await connectedClient(harness)

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
				disableDiscovery: vi.fn(() => {
					throw new Error('hass boom')
				}),
			})
			const harness = await getHarness({ gateway })
			const client = await connectedClient(harness)

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
		it('awaits zniffer.start() for the known "start" action - real signature is Promise<void>, so `result` is stripped from the wire ack', async () => {
			// Matches the real Promise<void> signature so the ack strips the undefined result key, the same regression-masking risk as rediscoverNode above
			const zniffer = createFakeZniffer({
				start: vi.fn(() => Promise.resolve(undefined)),
			})
			const harness = await getHarness({
				gateway: createFakeGateway(),
				zniffer,
			})
			const client = await connectedClient(harness)

			const result = await emit(client, 'ZNIFFER_API', {
				apiName: 'start',
			})
			expect(zniffer.start).toHaveBeenCalledOnce()
			expect(result).toStrictEqual({
				success: true,
				message: 'Success ZNIFFER api call',
				api: 'start',
			})
			expect('result' in result).toBe(false)
		})

		it('reports success:false with "Unknown ZNIFFER api <name>" for an unknown apiName', async () => {
			const harness = await getHarness({
				gateway: createFakeGateway(),
				zniffer: createFakeZniffer(),
			})
			const client = await connectedClient(harness)

			const result = await emit(client, 'ZNIFFER_API', {
				apiName: 'notARealAction',
			})
			expect(result).toStrictEqual({
				success: false,
				message: 'Unknown ZNIFFER api notARealAction',
				api: 'notARealAction',
			})
		})

		// See #4740 for the tracked follow-up on this bug
		it('quirk: loadCaptureFromBuffer is called WITHOUT await, so result is an unresolved Promise, not the resolved value', async () => {
			const zniffer = createFakeZniffer({
				loadCaptureFromBuffer: vi.fn(() =>
					Promise.resolve('parsed-capture'),
				),
			})
			const harness = await getHarness({
				gateway: createFakeGateway(),
				zniffer,
			})
			const client = await connectedClient(harness)

			const result = await emit<{ success: boolean; result: unknown }>(
				client,
				'ZNIFFER_API',
				{
					apiName: 'loadCaptureFromBuffer',
					buffer: [1, 2, 3],
				},
			)
			expect(zniffer.loadCaptureFromBuffer).toHaveBeenCalledWith(
				Buffer.from([1, 2, 3]),
			)
			// Proves the missing await in production: result serializes to an empty object over the wire rather than the resolved value
			expect(result.success).toBe(true)
			expect(result.result).toStrictEqual({})
			expect(result.result).not.toBe('parsed-capture')
		})
	})

	describe('SUBSCRIBE', () => {
		it('joins exactly the requested valid channel and acks with the current subscription list', async () => {
			const harness = await getHarness({ gateway: createFakeGateway() })
			const client = await connectedClient(harness)

			const result = await emit<{ channels: string[] }>(
				client,
				'SUBSCRIBE',
				{ channels: ['nodes'] },
			)
			expect(result).toStrictEqual({ channels: ['nodes'] })
		})

		it('filters out invalid channels while keeping valid ones from a mixed list', async () => {
			const harness = await getHarness({ gateway: createFakeGateway() })
			const client = await connectedClient(harness)

			const result = await emit<{ channels: string[] }>(
				client,
				'SUBSCRIBE',
				{ channels: ['nodes', 'not-a-real-channel', 'values'] },
			)
			expect(result.channels.sort()).toStrictEqual(['nodes', 'values'])
		})

		it('"all" expands to every channel, in channelMap declaration order', async () => {
			const harness = await getHarness({ gateway: createFakeGateway() })
			const client = await connectedClient(harness)

			const result = await emit<{ channels: string[] }>(
				client,
				'SUBSCRIBE',
				{ channels: ['all'] },
			)
			expect(result.channels).toStrictEqual(ALL_CHANNELS)
		})

		it('acks with an empty channel list when data.channels is missing/not an array', async () => {
			const harness = await getHarness({ gateway: createFakeGateway() })
			const client = await connectedClient(harness)

			const result = await emit<{ channels: string[] }>(
				client,
				'SUBSCRIBE',
				{},
			)
			expect(result).toStrictEqual({ channels: [] })
		})
	})

	describe('UNSUBSCRIBE', () => {
		it('leaves exactly the requested valid channel and acks with what remains', async () => {
			const harness = await getHarness({ gateway: createFakeGateway() })
			const client = await connectedClient(harness)

			await emit(client, 'SUBSCRIBE', { channels: ['nodes', 'values'] })
			const result = await emit<{ channels: string[] }>(
				client,
				'UNSUBSCRIBE',
				{ channels: ['nodes'] },
			)
			expect(result).toStrictEqual({ channels: ['values'] })
		})

		// See #4740 for the tracked follow-up on this asymmetry
		it('quirk: "all" is NOT special-cased for unsubscribe (asymmetric with subscribe) - it matches no real channel, so nothing is removed', async () => {
			const harness = await getHarness({ gateway: createFakeGateway() })
			const client = await connectedClient(harness)

			await emit(client, 'SUBSCRIBE', { channels: ['nodes', 'values'] })
			const result = await emit<{ channels: string[] }>(
				client,
				'UNSUBSCRIBE',
				{ channels: ['all'] },
			)
			expect(result.channels.sort()).toStrictEqual(['nodes', 'values'])
		})
	})
})
