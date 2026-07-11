/**
 * Characterization tests for the HASS MQTT lifecycle: how `Gateway` publishes
 * and deletes discovery packets (QoS/retain/payload quirks), how it reacts to
 * broker-reconnect and Home-Assistant birth/will status, and how inbound MQTT
 * messages are routed through the REAL `MqttClient._onMessageReceived` into
 * the REAL `Gateway` write/broadcast/multicast/api handlers.
 *
 * Everything runs against the real `Gateway` + real `MqttClient`; only the
 * upstream `mqtt` package is mocked (see `mqttMock.ts`). The fake broker is
 * production-faithful about connection state: it starts DISCONNECTED, only
 * routes inbound packets once `triggerConnect()` has fired AND a matching
 * subscription exists, and models `offline`/`reconnect` transitions. Inbound
 * packets are delivered through the genuine `'message'`/`'connect'` client
 * events, so the production parsing/subscription/routing code is exercised
 * end to end.
 *
 * Locked quirks (characterized here, NOT endorsed):
 *  - INVALID RETAINED-DELETION QUIRK: deleting a discovery publishes the
 *    2-byte literal `""` (an empty JSON string run through `stringifyJSON`),
 *    NOT the zero-length payload a real HA discovery deletion requires, and
 *    with `retain` taken from `config.retainedDiscovery` (default `false`).
 *    A correct deletion would publish an empty (zero-byte) payload with
 *    `retain: true` so the broker evicts the retained config; this does
 *    neither, so a retained discovery message is NOT actually cleared. These
 *    tests pin the exact broken wire bytes so a future fix is forced to change
 *    them - they must NOT be read as validating correct MQTT deletion.
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
	beforeEach,
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

/**
 * The exact discovery-config topic the seeded switch node ('Dev') republishes
 * on a `rediscoverAll`. Hard-coded (not derived from a producer helper) so the
 * rediscovery assertions pin the real wire topic - version/status publishes,
 * which also land during a connect, can never satisfy it.
 */
const SWITCH_DISCOVERY_TOPIC = 'homeassistant/switch/Dev/switch/config'

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

describe('MQTT connection lifecycle (production-faithful fake)', () => {
	// The harness broker is constructed ONCE (file-level `beforeAll`) and shared,
	// so its `connected` flag accumulates across tests. Every scenario in this
	// describe models a specific connection transition and drives its own
	// `triggerConnect()` when it needs a live link, so re-establishing the
	// freshly-constructed DISCONNECTED precondition before each test makes them
	// order-independent (a prior test leaving the shared broker connected must
	// not bleed into the "starts DISCONNECTED" characterization under shuffle).
	beforeEach(() => {
		harness.broker.forceDisconnected()
	})

	/** Seeds one node with a persistent discovered switch device. */
	function seed(id: number, deviceId: string): void {
		const { node } = discoverSwitch(deviceId, id)
		harness.zwave.nodes.set(id, node)
	}

	it('starts DISCONNECTED; publishes work but inbound is dropped pre-connect', async () => {
		harness.resetState()
		harness.zwave.nodes.clear()

		// A freshly constructed client is not yet connected, exactly like the
		// real `mqtt` client before its handshake completes.
		expect(harness.broker.connected).toBe(false)

		// Publishing does NOT require a connection (the real `MqttClient.publish`
		// only checks `this.client`), so discovery still records a packet.
		seed(2, 'dev-pre-connect')
		expect(
			harness.broker.published.some(
				(p) => p.topic === SWITCH_DISCOVERY_TOPIC,
			),
		).toBe(true)

		// Inbound, however, is dropped while offline: a real broker never
		// pushes a packet to a disconnected client.
		harness.resetPublishes()
		harness.broker.deliver('homeassistant/status', 'online')
		await tick()
		expect(harness.broker.published).toHaveLength(0)
	})

	it('connect subscribes, flips brokerStatus true, and enables inbound routing', async () => {
		harness.resetState()
		harness.zwave.nodes.clear()
		seed(2, 'dev-connect')
		harness.broker.subscribed.length = 0

		harness.broker.triggerConnect()
		expect(harness.broker.connected).toBe(true)
		// _onConnect subscribed the fixed HA status topic + the action wildcards
		expect(harness.broker.subscribed.map((s) => s.topic)).toContain(
			'homeassistant/status',
		)
		await tick()

		// The connect itself rediscovered (brokerStatus true) - clear it so we
		// isolate the ONLINE-triggered republish below.
		harness.resetPublishes()
		harness.broker.deliver('homeassistant/status', 'online')
		await tick()
		expect(
			harness.broker.published.some(
				(p) => p.topic === SWITCH_DISCOVERY_TOPIC,
			),
		).toBe(true)
	})

	it('offline transition disconnects and stops inbound routing again', async () => {
		harness.resetState()
		harness.zwave.nodes.clear()
		seed(2, 'dev-offline-cycle')
		harness.broker.triggerConnect()
		await tick()

		harness.broker.triggerOffline()
		expect(harness.broker.connected).toBe(false)

		harness.resetPublishes()
		harness.broker.deliver('homeassistant/status', 'online')
		await tick()
		expect(harness.broker.published).toHaveLength(0)

		// a subsequent reconnect restores routing (models the real reconnect)
		harness.broker.triggerReconnect()
		harness.broker.triggerConnect()
		await tick()
		harness.resetPublishes()
		harness.broker.deliver('homeassistant/status', 'online')
		await tick()
		expect(
			harness.broker.published.some(
				(p) => p.topic === SWITCH_DISCOVERY_TOPIC,
			),
		).toBe(true)
	})
})

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

	it('QUIRK: "deletion" publishes the invalid 2-byte "" payload, NOT a real tombstone', () => {
		harness.resetState()
		const { device } = discoverSwitch('dev-delete')
		harness.resetPublishes()

		harness.gw.publishDiscovery(device, 2, { deleteDevice: true })

		const pub =
			harness.broker.published[harness.broker.published.length - 1]
		// INVALID RETAINED-DELETION QUIRK: a correct HA discovery deletion must
		// publish a ZERO-LENGTH payload so the broker evicts the retained
		// config. Instead the producer runs `''` through `stringifyJSON`, which
		// yields the 2-byte, NON-empty literal `""`. Pin the exact broken bytes
		// (length 2, not 0) so a future correct fix is forced to change them.
		expect(pub.payload).toBe('""')
		expect(pub.payload.length).toBe(2)
		expect(pub.payload.length).not.toBe(0)
		expect(pub.topic).toBe('homeassistant/' + device.discoveryTopic)
		// ...and by default it is not even retained, so nothing is cleared.
		expect(pub.options).toEqual({ qos: 0, retain: false })
	})

	it('QUIRK: even with retainedDiscovery the deletion is still the non-tombstone ""', () => {
		harness.resetState()
		harness.config.retainedDiscovery = true
		const { device } = discoverSwitch('dev-delete-retained', 4)
		harness.resetPublishes()

		harness.gw.publishDiscovery(device, 4, { deleteDevice: true })

		const pub =
			harness.broker.published[harness.broker.published.length - 1]
		// retain now follows config (true), but the payload is STILL the 2-byte
		// `""` rather than an empty buffer - so the retained discovery message
		// is overwritten with a bogus `""` body instead of being deleted. This
		// remains broken; the test documents it and must not be read as proof
		// of a correct retained deletion.
		expect(pub.payload).toBe('""')
		expect(pub.options).toEqual({ qos: 0, retain: true })
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

		// triggerConnect() sets connected BEFORE firing 'connect' so the real
		// `subscribe()` (which rejects when the client is offline) succeeds.
		harness.broker.triggerConnect()

		const topics = harness.broker.subscribed.map((s) => s.topic)
		// HASS will/birth topic is the fixed literal, never prefixed
		expect(topics).toContain('homeassistant/status')
		const cid = harness.mqtt.clientID
		expect(topics).toContain(`zwave/_CLIENTS/${cid}/broadcast/#`)
		expect(topics).toContain(`zwave/_CLIENTS/${cid}/api/#`)
		expect(topics).toContain(`zwave/_CLIENTS/${cid}/multicast/#`)
	})

	it('HA "online" (any case) republishes the exact device discovery topic', async () => {
		harness.resetState()
		harness.zwave.nodes.clear()
		seedDiscoveredNode(2, 'dev-online')

		// connect first so `homeassistant/status` is subscribed and routable,
		// then clear the connect-time rediscovery to isolate the ONLINE one.
		harness.broker.triggerConnect()
		await tick()
		harness.resetPublishes()

		harness.broker.deliver('homeassistant/status', 'online')
		await tick()
		// exact rediscovered discovery topic - NOT `length > 0`, which the
		// version/status publishes emitted on connect would also satisfy.
		expect(
			harness.broker.published.some(
				(p) => p.topic === SWITCH_DISCOVERY_TOPIC,
			),
		).toBe(true)

		// uppercase is accepted too (case-insensitive)
		harness.resetPublishes()
		harness.broker.deliver('homeassistant/status', 'ONLINE')
		await tick()
		expect(
			harness.broker.published.some(
				(p) => p.topic === SWITCH_DISCOVERY_TOPIC,
			),
		).toBe(true)
	})

	it('HA "offline" does NOT rediscover', async () => {
		harness.resetState()
		harness.zwave.nodes.clear()
		seedDiscoveredNode(2, 'dev-offline')

		harness.broker.triggerConnect()
		await tick()
		harness.resetPublishes()

		harness.broker.deliver('homeassistant/status', 'offline')
		await tick()
		expect(
			harness.broker.published.some(
				(p) => p.topic === SWITCH_DISCOVERY_TOPIC,
			),
		).toBe(false)
	})

	it('broker reconnect (brokerStatus true) republishes the exact discovery topic', async () => {
		harness.resetState()
		harness.zwave.nodes.clear()
		seedDiscoveredNode(2, 'dev-reconnect')
		harness.resetPublishes()

		// a full connect cycle emits brokerStatus(true) after subscribing,
		// which drives rediscoverAll.
		harness.broker.triggerConnect()
		await tick()
		expect(
			harness.broker.published.some(
				(p) => p.topic === SWITCH_DISCOVERY_TOPIC,
			),
		).toBe(true)
	})
})

describe('inbound MQTT routing through real MqttClient -> Gateway', () => {
	// Inbound routing requires a live subscription, which in turn requires the
	// client to be connected (the real `subscribe()` rejects while offline).
	// Connect once up front so `_onConnect` subscribes the action wildcards and
	// per-value `valueChanged` subscriptions land.
	beforeAll(async () => {
		harness.broker.triggerConnect()
		await tick()
	})

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

		// real producer: value change registers topicValues + subscribes the
		// `zwave/+/+/+/+/set` wildcard (needs the connection established above).
		harness.zwave.emit('valueChanged', targetValue, node, true)
		await tick()

		// Hard-coded delivery topic (NOT computed from a producer helper) so the
		// test pins the exact wire topic a real broker would route. The two
		// pins below independently assert the producer still builds that topic.
		const setTopic =
			'zwave/Dev/switch_multilevel/endpoint_0/targetValue/set'
		expect(harness.gw.valueTopic(node, targetValue)).toBe(
			'Dev/switch_multilevel/endpoint_0/targetValue',
		)
		expect(
			harness.mqtt.getTopic(
				harness.gw.valueTopic(node, targetValue) as string,
				true,
			),
		).toBe(setTopic)

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

		// deliverRaw BYPASSES the broker's subscription filter, handing the
		// foreign-addressed packet straight to `_onMessageReceived`. That proves
		// `MqttClient`'s OWN guard (`parts[1] !== this._clientID`) drops it -
		// not merely that the fake broker never routed a non-matching topic.
		harness.broker.deliverRaw(
			`zwave/_CLIENTS/ZWAVE_GATEWAY-someone-else/api/getNodes/set`,
			JSON.stringify({ args: [] }),
		)
		await tick()

		expect(harness.zwave.callApi).not.toHaveBeenCalled()
	})
})
