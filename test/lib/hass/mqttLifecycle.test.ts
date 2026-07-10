/**
 * Characterization tests for the HASS MQTT lifecycle: how `Gateway` publishes
 * and deletes discovery packets (QoS/retain/payload quirks), how it reacts to
 * broker-reconnect and Home-Assistant birth/will status, and how inbound MQTT
 * messages are routed through the REAL `MqttClient._onMessageReceived` into
 * the REAL `Gateway` write/broadcast/multicast/api handlers.
 *
 * Everything runs against the real `Gateway` + real `MqttClient`; only the
 * upstream `mqtt` package is mocked (see `mqttMock.ts`). Inbound packets are
 * delivered through the genuine `'message'`/`'connect'` client events, so the
 * production parsing/subscription/routing code is exercised end to end.
 *
 * Locked quirks:
 *  - deleting a discovery publishes the 2-byte literal `""` (an empty-string
 *    payload run through `stringifyJSON`), NOT a zero-length buffer.
 *  - discovery publishes carry `{ qos: 0, retain: config.retainedDiscovery }`.
 *  - HA online status is case-insensitive and keyed off the FIXED literal
 *    `homeassistant/status` (never prefixed).
 *  - broker reconnect (`brokerStatus true`) and HA `online` both trigger a
 *    full `rediscoverAll`.
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
import { mqttMockFactory } from './mqttMock.ts'
import {
	createGatewayHarness,
	cleanupGatewayHarnessEnv,
	discoverValueOnNode,
	type GatewayHarness,
} from './gatewayHarness.ts'
import { buildNode, buildValueId, addValue } from './fixtures.ts'
import type { HassDevice, ZUINode } from '../../../api/lib/ZwaveClient.ts'

vi.mock('mqtt', () => mqttMockFactory())

let harness: GatewayHarness

const tick = () => new Promise<void>((r) => setImmediate(r))

beforeAll(async () => {
	harness = await createGatewayHarness()
})

afterAll(async () => {
	await harness.close()
	cleanupGatewayHarnessEnv()
})

afterEach(() => {
	// restore any per-test config mutations
	harness.config.retainedDiscovery = false
	harness.config.manualDiscovery = false
})

/** Runs the real switch discovery and returns the produced HassDevice. */
function discoverSwitch(
	deviceId: string,
	id = 2,
): {
	node: ZUINode
	device: HassDevice
} {
	const node = buildNode({ id, name: 'Dev', deviceId })
	const key = addValue(
		node,
		buildValueId({
			nodeId: id,
			commandClass: 37, // Binary Switch
			endpoint: 0,
			property: 'currentValue',
			propertyName: 'currentValue',
			type: 'boolean',
			value: false,
			isCurrentValue: true,
		} as any),
	)
	const device = discoverValueOnNode(harness.gw, node, key)
	if (!device) throw new Error('switch discovery produced no device')
	return { node, device }
}

describe('publishDiscovery wire behavior', () => {
	it('publishes with qos 0 and retain from config.retainedDiscovery', () => {
		harness.resetState()
		const { device } = discoverSwitch('dev-retain-off')
		const pub =
			harness.broker.published[harness.broker.published.length - 1]
		expect(pub.options).toEqual({ qos: 0, retain: false })

		// flip retainedDiscovery -> retain true
		harness.resetState()
		harness.config.retainedDiscovery = true
		const { device: d2 } = discoverSwitch('dev-retain-on', 3)
		const pub2 =
			harness.broker.published[harness.broker.published.length - 1]
		expect(pub2.options).toEqual({ qos: 0, retain: true })
		expect(d2.discovery_payload).toBeDefined()
	})

	it('deletes a discovery by publishing the literal empty-string payload ""', () => {
		harness.resetState()
		const { device } = discoverSwitch('dev-delete')
		harness.resetPublishes()

		harness.gw.publishDiscovery(device, 2, { deleteDevice: true })

		const pub =
			harness.broker.published[harness.broker.published.length - 1]
		// stringifyJSON('') === '""' (2-byte literal), a deliberate tombstone
		expect(pub.payload).toBe('""')
		expect(pub.topic).toBe('homeassistant/' + device.discoveryTopic)
		expect(pub.options).toEqual({ qos: 0, retain: false })
	})

	it('forceUpdate routes the device back through zwave.updateDevice', () => {
		harness.resetState()
		const { device } = discoverSwitch('dev-force')
		harness.zwave.updateDevice.mockClear()
		harness.resetPublishes()

		harness.gw.publishDiscovery(device, 2, { forceUpdate: true })

		expect(harness.broker.published).toHaveLength(1)
		expect(harness.zwave.updateDevice).toHaveBeenCalledWith(
			device,
			2,
			undefined,
		)
	})

	it('manualDiscovery suppresses the publish unless forceUpdate is set', () => {
		harness.resetState()
		const { device } = discoverSwitch('dev-manual')
		harness.resetPublishes()
		harness.config.manualDiscovery = true

		// no forceUpdate -> skipped
		harness.gw.publishDiscovery(device, 2)
		expect(harness.broker.published).toHaveLength(0)

		// forceUpdate -> published
		harness.gw.publishDiscovery(device, 2, { forceUpdate: true })
		expect(harness.broker.published).toHaveLength(1)
	})

	it('ignoreDiscovery on the device suppresses the publish', () => {
		harness.resetState()
		const { device } = discoverSwitch('dev-ignore')
		harness.resetPublishes()

		const ignored = { ...device, ignoreDiscovery: true } as HassDevice
		harness.gw.publishDiscovery(ignored, 2)
		expect(harness.broker.published).toHaveLength(0)
	})
})

describe('broker + Home Assistant status -> rediscoverAll', () => {
	/** Registers a node with one persistent discovered device in zwave.nodes. */
	function seedDiscoveredNode(id: number, deviceId: string): HassDevice {
		const { node, device } = discoverSwitch(deviceId, id)
		harness.zwave.nodes.set(id, node)
		return device
	}

	it('_onConnect subscribes to the fixed homeassistant/status literal + actions', () => {
		harness.resetState()
		harness.broker.subscribed.length = 0

		harness.broker.emit('connect')

		const topics = harness.broker.subscribed.map((s) => s.topic)
		// HASS will/birth topic is the fixed literal, never prefixed
		expect(topics).toContain('homeassistant/status')
		const cid = harness.mqtt.clientID
		expect(topics).toContain(`zwave/_CLIENTS/${cid}/broadcast/#`)
		expect(topics).toContain(`zwave/_CLIENTS/${cid}/api/#`)
		expect(topics).toContain(`zwave/_CLIENTS/${cid}/multicast/#`)
	})

	it('HA "online" (any case) republishes every node device', async () => {
		harness.resetState()
		harness.zwave.nodes.clear()
		seedDiscoveredNode(2, 'dev-online')
		harness.resetPublishes()

		harness.broker.deliver('homeassistant/status', 'online')
		await tick()
		expect(harness.broker.published.length).toBeGreaterThan(0)

		// uppercase is accepted too (case-insensitive)
		harness.resetPublishes()
		harness.broker.deliver('homeassistant/status', 'ONLINE')
		await tick()
		expect(harness.broker.published.length).toBeGreaterThan(0)
	})

	it('HA "offline" does NOT rediscover', async () => {
		harness.resetState()
		harness.zwave.nodes.clear()
		seedDiscoveredNode(2, 'dev-offline')
		harness.resetPublishes()

		harness.broker.deliver('homeassistant/status', 'offline')
		await tick()
		expect(harness.broker.published).toHaveLength(0)
	})

	it('broker reconnect (brokerStatus true) triggers rediscovery', async () => {
		harness.resetState()
		harness.zwave.nodes.clear()
		seedDiscoveredNode(2, 'dev-reconnect')
		harness.resetPublishes()

		// full connect cycle emits brokerStatus(true) after subscribing
		harness.broker.emit('connect')
		await tick()
		expect(harness.broker.published.length).toBeGreaterThan(0)
	})
})

describe('inbound MQTT routing through real MqttClient -> Gateway', () => {
	it('a write request reaches zwave.writeValue with the parsed value', async () => {
		harness.resetState()
		const id = 5
		const node = buildNode({ id, name: 'Dev', deviceId: 'dev-write' })
		const targetValue = buildValueId({
			nodeId: id,
			commandClass: 38, // Multilevel Switch
			endpoint: 0,
			property: 'targetValue',
			propertyName: 'targetValue',
			type: 'number',
			writeable: true,
			value: 0,
		})
		addValue(node, targetValue)
		harness.zwave.nodes.set(id, node)

		// real producer: value change registers topicValues + subscribes
		harness.zwave.emit('valueChanged', targetValue, node, true)

		const topic = harness.gw.valueTopic(node, targetValue) as string
		const setTopic = harness.mqtt.getTopic(topic, true)

		harness.zwave.writeValue.mockClear()
		harness.broker.deliver(setTopic, '42')
		await tick()

		expect(harness.zwave.writeValue).toHaveBeenCalledTimes(1)
		const [vId, value] = harness.zwave.writeValue.mock.calls[0]
		expect(value).toBe(42)
		expect(vId.property).toBe('targetValue')
	})

	it('a broadcast request reaches zwave.writeBroadcast and echoes feedback', async () => {
		harness.resetState()
		const cid = harness.mqtt.clientID
		harness.zwave.writeBroadcast.mockClear()

		const payload = {
			commandClass: 37,
			endpoint: 0,
			property: 'targetValue',
			value: true,
		}
		harness.broker.deliver(
			`zwave/_CLIENTS/${cid}/broadcast/set`,
			JSON.stringify(payload),
		)
		await tick()

		expect(harness.zwave.writeBroadcast).toHaveBeenCalledTimes(1)
		const [vId, value] = harness.zwave.writeBroadcast.mock.calls[0]
		expect(value).toBe(true)
		expect(vId.commandClass).toBe(37)

		// feedback echoed to the same topic without /set
		const echoed = harness.broker.published.find(
			(p) => p.topic === `zwave/_CLIENTS/${cid}/broadcast`,
		)
		expect(echoed).toBeDefined()
	})

	it('a multicast request reaches zwave.writeMulticast', async () => {
		harness.resetState()
		const cid = harness.mqtt.clientID
		harness.zwave.writeMulticast.mockClear()

		const payload = {
			nodes: [2, 3],
			commandClass: 37,
			endpoint: 0,
			property: 'targetValue',
			value: true,
		}
		harness.broker.deliver(
			`zwave/_CLIENTS/${cid}/multicast/set`,
			JSON.stringify(payload),
		)
		await tick()

		expect(harness.zwave.writeMulticast).toHaveBeenCalledTimes(1)
		const [nodes, vId, value] = harness.zwave.writeMulticast.mock.calls[0]
		expect(nodes).toEqual([2, 3])
		expect(value).toBe(true)
		expect(vId.commandClass).toBe(37)
	})

	it('an api request reaches zwave.callApi and publishes the ACK envelope', async () => {
		harness.resetState()
		const cid = harness.mqtt.clientID
		harness.zwave.callApi.mockClear()

		const payload = { args: [] }
		harness.broker.deliver(
			`zwave/_CLIENTS/${cid}/api/getNodes/set`,
			JSON.stringify(payload),
		)
		await tick()

		expect(harness.zwave.callApi).toHaveBeenCalledWith('getNodes')

		const ackTopic = `zwave/_CLIENTS/${cid}/api/getNodes`
		const ack = harness.broker.published.find((p) => p.topic === ackTopic)
		expect(ack).toBeDefined()
		const parsed = JSON.parse(ack.payload)
		expect(parsed.success).toBe(true)
		// the original request is echoed back as `origin`
		expect(parsed.origin).toEqual(payload)
	})

	it('ignores actions addressed to a different client id', async () => {
		harness.resetState()
		harness.zwave.callApi.mockClear()

		harness.broker.deliver(
			`zwave/_CLIENTS/ZWAVE_GATEWAY-someone-else/api/getNodes/set`,
			JSON.stringify({ args: [] }),
		)
		await tick()

		expect(harness.zwave.callApi).not.toHaveBeenCalled()
	})
})
