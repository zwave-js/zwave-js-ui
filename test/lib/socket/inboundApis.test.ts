// Event names are hard-coded literals, not imported from SocketEvents.ts, since a real client's wire format doesn't know the server's internal constant names
// The real 'clients' callback calls gw.zwave?.setUserCallbacks() on every connect and throws
// if gw is undefined, so every test installs at least a bare gateway fake
import { describe, it, expect, vi } from 'vitest'
import { ALL_CHANNELS } from '#api/lib/SocketEvents.ts'
import { useSocketHarness } from './harness.ts'
import {
	createFakeGateway,
	createFakeZniffer,
	createFakeZwaveClient,
} from './fakes.ts'
import { connectedClient, emit } from './helpers.ts'

describe('Socket contract: inbound ACK APIs', () => {
	const getHarness = useSocketHarness()

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
		})

		it('reports success:false with "Unknown HASS api <name>" for an unknown apiName', async () => {
			const harness = await getHarness({ gateway: createFakeGateway() })
			const client = await connectedClient(harness)

			const result = await emit(client, 'HASS_API', {
				apiName: 'notARealAction',
			})
			expect(result).toStrictEqual({
				success: false,
				message: 'Unknown HASS api notARealAction',
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

		it('"delete" removes the device discovery and acks success without a result field', async () => {
			const device = { id: 'switch_sw', type: 'switch' }
			const gateway = createFakeGateway({ publishDiscovery: vi.fn() })
			const harness = await getHarness({ gateway })
			const client = await connectedClient(harness)

			const result = await emit(client, 'HASS_API', {
				apiName: 'delete',
				device,
				nodeId: 2,
			})
			expect(gateway.publishDiscovery).toHaveBeenCalledWith(device, 2, {
				deleteDevice: true,
				forceUpdate: true,
			})
			// The delete handler returns nothing, so the success ack omits the result field
			expect(result).toStrictEqual({
				success: true,
				message: 'Success HASS api call',
				api: 'delete',
			})
		})

		// delete and discover differ only by whether the entity is removed or republished
		it('"discover" republishes the device discovery and acks success', async () => {
			const device = { id: 'switch_sw', type: 'switch' }
			const gateway = createFakeGateway({ publishDiscovery: vi.fn() })
			const harness = await getHarness({ gateway })
			const client = await connectedClient(harness)

			const result = await emit(client, 'HASS_API', {
				apiName: 'discover',
				device,
				nodeId: 2,
			})
			expect(gateway.publishDiscovery).toHaveBeenCalledWith(device, 2, {
				deleteDevice: false,
				forceUpdate: true,
			})
			expect(result).toStrictEqual({
				success: true,
				message: 'Success HASS api call',
				api: 'discover',
			})
		})

		it('"update" applies the edited device to the node and acks success', async () => {
			const device = { id: 'switch_sw', type: 'switch' }
			const gateway = createFakeGateway()
			const harness = await getHarness({ gateway })
			const client = await connectedClient(harness)

			const result = await emit(client, 'HASS_API', {
				apiName: 'update',
				device,
				nodeId: 2,
			})
			expect(gateway.zwave.updateDevice).toHaveBeenCalledWith(device, 2)
			expect(result).toStrictEqual({
				success: true,
				message: 'Success HASS api call',
				api: 'update',
			})
		})

		it('"add" attaches a new device to the node and acks success', async () => {
			const device = { id: 'switch_sw', type: 'switch' }
			const gateway = createFakeGateway()
			const harness = await getHarness({ gateway })
			const client = await connectedClient(harness)

			const result = await emit(client, 'HASS_API', {
				apiName: 'add',
				device,
				nodeId: 2,
			})
			expect(gateway.zwave.addDevice).toHaveBeenCalledWith(device, 2)
			expect(result).toStrictEqual({
				success: true,
				message: 'Success HASS api call',
				api: 'add',
			})
		})

		it('returns the typed result from the awaited "store" operation', async () => {
			const devices = { switch_sw: { type: 'switch' } }
			const gateway = createFakeGateway()
			const harness = await getHarness({ gateway })
			const client = await connectedClient(harness)

			const result = await emit(client, 'HASS_API', {
				apiName: 'store',
				devices,
				nodeId: 2,
				remove: false,
			})
			expect(gateway.zwave.storeDevices).toHaveBeenCalledWith(
				devices,
				2,
				false,
			)
			expect(result).toStrictEqual({
				success: true,
				message: 'Success HASS api call',
				result: { status: 'stored' },
				api: 'store',
			})

			gateway.zwave.storeDevices.mockResolvedValueOnce({
				status: 'invalid-stored-node',
			})
			const failedResult = await emit(client, 'HASS_API', {
				apiName: 'store',
				devices,
				nodeId: 2,
				remove: false,
			})
			expect(failedResult).toStrictEqual({
				success: false,
				message:
					'Unable to store Home Assistant devices: stored node is invalid',
				result: { status: 'invalid-stored-node' },
				api: 'store',
			})
		})

		it('"store" is awaited so a rejected persistence acks failure', async () => {
			// store is the only awaited HASS action, so a rejected write must surface as a failure ack rather than a success
			const gateway = createFakeGateway({
				zwave: createFakeZwaveClient({
					storeDevices: vi.fn(() =>
						Promise.reject(new Error('store boom')),
					),
				}),
			})
			const harness = await getHarness({ gateway })
			const client = await connectedClient(harness)

			const result = await emit(client, 'HASS_API', {
				apiName: 'store',
				devices: {},
				nodeId: 2,
				remove: true,
			})
			expect(result).toStrictEqual({
				success: false,
				message: 'store boom',
				api: 'store',
			})
		})

		it('reports success:false with "Unknown HASS api <name>" for an unknown apiName', async () => {
			// An unrecognized action must surface a failure ack, not silently
			// succeed by falling through the switch with an undefined result
			const harness = await getHarness({ gateway: createFakeGateway() })
			const client = await connectedClient(harness)

			const result = await emit(client, 'HASS_API', {
				apiName: 'notARealAction',
			})
			expect(result).toStrictEqual({
				success: false,
				message: 'Unknown HASS api notARealAction',
				api: 'notARealAction',
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

		it('awaits zniffer.loadCaptureFromBuffer so its resolved value reaches the ack', async () => {
			// The real method resolves a value (undefined on success, { error }
			// on failure) instead of rejecting, so production must await it for
			// that value to reach the client; an un-awaited promise serializes
			// to {} over the wire.
			const loaded = { error: 'bad capture' }
			const zniffer = createFakeZniffer({
				loadCaptureFromBuffer: vi.fn(() => Promise.resolve(loaded)),
			})
			const harness = await getHarness({
				gateway: createFakeGateway(),
				zniffer,
			})
			const client = await connectedClient(harness)

			const result = await emit(client, 'ZNIFFER_API', {
				apiName: 'loadCaptureFromBuffer',
				buffer: [1, 2, 3],
			})
			expect(zniffer.loadCaptureFromBuffer).toHaveBeenCalledOnce()
			// production wraps data.buffer in Buffer.from before handing it over
			expect(
				Buffer.isBuffer(zniffer.loadCaptureFromBuffer.mock.calls[0][0]),
			).toBe(true)
			expect(result).toStrictEqual({
				success: true,
				message: 'Success ZNIFFER api call',
				result: loaded,
				api: 'loadCaptureFromBuffer',
			})
		})

		it('loadCaptureFromBuffer resolves before its result is sent back over the wire', async () => {
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

			const result = await emit<any>(client, 'ZNIFFER_API', {
				apiName: 'loadCaptureFromBuffer',
				buffer: [1, 2, 3],
			})
			expect(zniffer.loadCaptureFromBuffer).toHaveBeenCalledWith(
				Buffer.from([1, 2, 3]),
			)
			expect(result.success).toBe(true)
			expect(result.result).toBe('parsed-capture')
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

		it('"all" expands to every real channel', async () => {
			const harness = await getHarness({ gateway: createFakeGateway() })
			const client = await connectedClient(harness)

			const result = await emit<{ channels: string[] }>(
				client,
				'SUBSCRIBE',
				{ channels: ['all'] },
			)
			expect(result.channels.sort()).toStrictEqual(
				[...ALL_CHANNELS].sort(),
			)
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

		it('"all" also expands to every channel for unsubscribe, symmetric with subscribe', async () => {
			const harness = await getHarness({ gateway: createFakeGateway() })
			const client = await connectedClient(harness)

			await emit(client, 'SUBSCRIBE', { channels: ['nodes', 'values'] })
			const result = await emit<any>(client, 'UNSUBSCRIBE', {
				channels: ['all'],
			})
			expect(result.channels).toStrictEqual([])
		})
	})
})
