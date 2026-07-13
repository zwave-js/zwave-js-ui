/**
 * Characterizes the HASS MQTT lifecycle: how Gateway publishes and deletes
 * discovery packets, reacts to broker-reconnect and Home-Assistant birth/will
 * status, and routes inbound MQTT through the real MqttClient into the real
 * Gateway handlers.
 *
 * Everything runs against the real Gateway + real MqttClient; only the upstream
 * mqtt package is mocked (mqttMock.ts). The fake broker is production-faithful
 * about connection state: starts DISCONNECTED, routes inbound only after
 * triggerConnect() and a matching subscription, and models offline/reconnect.
 *
 * Domain facts:
 *  - Discovery publishes carry { qos: 0, retain: config.retainedDiscovery }.
 *  - HA online status is case-insensitive, keyed off the fixed literal
 *    homeassistant/status (never prefixed).
 *  - Broker reconnect and HA coming online both re-announce every device.
 *  - The retained-discovery delete payload shape is tracked in #4737.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CommandClasses } from '@zwave-js/core'
import { mqttMockFactory } from './mqttMock.ts'
import {
	useGatewayHarness,
	discoverValueOnNode,
	type GatewayHarness,
} from './gatewayHarness.ts'
import { buildNode, buildValueId, addValue } from './fixtures.ts'
import type { HassDevice, ZUINode } from '#api/lib/ZwaveClient.ts'
import type { GatewayConfig } from '#api/lib/Gateway.ts'

vi.mock('mqtt', () => mqttMockFactory())

const gatewayHarness = useGatewayHarness()
let harness: GatewayHarness

const tick = () => new Promise<void>((r) => setImmediate(r))

/**
 * The discovery-config topic the seeded 'Dev' switch republishes on reconnect.
 * Hard-coded so assertions match the real wire topic; the version and status
 * publishes that also land on connect don't.
 */
const SWITCH_DISCOVERY_TOPIC = 'homeassistant/switch/Dev/switch/config'

beforeEach(async () => {
	harness = await gatewayHarness.get()
})

async function replaceHarness(config: Partial<GatewayConfig>) {
	harness = await gatewayHarness.replace({ config })
}

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
			commandClass: CommandClasses['Binary Switch'],
			endpoint: 0,
			property: 'currentValue',
			propertyName: 'currentValue',
			type: 'boolean',
			value: false,
			isCurrentValue: true,
		}),
	)
	const device = discoverValueOnNode(harness.gw, node, key)
	if (!device) throw new Error('switch discovery produced no device')
	return { node, device }
}

describe('MQTT connection lifecycle', () => {
	/** Seeds one node with a persistent discovered switch device. */
	function seed(id: number, deviceId: string): void {
		const { node } = discoverSwitch(deviceId, id)
		harness.zwave.nodes.set(id, node)
	}

	it('outgoing discovery still publishes before the client connects', () => {
		harness.resetPublishes()
		harness.zwave.nodes.clear()

		// A fresh client is not yet connected, like the real mqtt client
		// pre-handshake
		expect(harness.broker.connected).toBe(false)

		// Publishing doesn't require a connection (real MqttClient.publish only
		// checks this.client), so discovery still records a packet
		seed(2, 'dev-pre-connect')
		expect(
			harness.broker.published.some(
				(p) => p.topic === SWITCH_DISCOVERY_TOPIC,
			),
		).toBe(true)
	})

	it('connecting subscribes and enables inbound routing', async () => {
		harness.resetPublishes()
		harness.zwave.nodes.clear()
		seed(2, 'dev-connect')
		harness.broker.subscribed.length = 0

		harness.broker.triggerConnect()
		expect(harness.broker.connected).toBe(true)
		// connecting subscribed the fixed HA status topic and action wildcards
		expect(harness.broker.subscribed.map((s) => s.topic)).toContain(
			'homeassistant/status',
		)
		await tick()

		// Connect itself rediscovered (brokerStatus true); clear it to isolate
		// the ONLINE republish below
		harness.resetPublishes()
		harness.broker.deliver('homeassistant/status', 'online')
		await tick()
		expect(
			harness.broker.published.some(
				(p) => p.topic === SWITCH_DISCOVERY_TOPIC,
			),
		).toBe(true)
	})

	it('an offline then reconnect cycle restores routing so HA online re-announces', async () => {
		harness.resetPublishes()
		harness.zwave.nodes.clear()
		seed(2, 'dev-offline-cycle')
		harness.broker.triggerConnect()
		await tick()

		// Drive the real link-loss then recovery: the client fires 'offline'
		// and later 'reconnect'/'connect', re-running the real _onConnect
		// subscribe path so inbound routing is live again
		harness.broker.triggerOffline()
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

describe('HASS discovery publish and delete over MQTT', () => {
	it('publishes with qos 0 and retain from config.retainedDiscovery', async () => {
		harness.resetPublishes()
		discoverSwitch('dev-retain-off')
		const pub =
			harness.broker.published[harness.broker.published.length - 1]
		expect(pub.options).toEqual({ qos: 0, retain: false })

		await replaceHarness({ retainedDiscovery: true })
		discoverSwitch('dev-retain-on', 3)
		const pub2 =
			harness.broker.published[harness.broker.published.length - 1]
		expect(pub2.options).toEqual({ qos: 0, retain: true })
	})

	it('a delete request publishes to the device discovery topic with retain following config', async () => {
		harness.resetPublishes()
		const { device } = discoverSwitch('dev-delete')
		harness.resetPublishes()

		harness.gw.publishDiscovery(device, 2, { deleteDevice: true })

		const pub =
			harness.broker.published[harness.broker.published.length - 1]
		expect(pub.topic).toBe('homeassistant/' + device.discoveryTopic)
		// Default config leaves discovery unretained; the delete payload shape is tracked in #4737
		expect(pub.options).toEqual({ qos: 0, retain: false })

		await replaceHarness({ retainedDiscovery: true })
		const { device: d2 } = discoverSwitch('dev-delete-retained', 4)
		harness.resetPublishes()

		harness.gw.publishDiscovery(d2, 4, { deleteDevice: true })

		const pub2 =
			harness.broker.published[harness.broker.published.length - 1]
		expect(pub2.topic).toBe('homeassistant/' + d2.discoveryTopic)
		expect(pub2.options).toEqual({ qos: 0, retain: true })
	})

	it('forceUpdate re-applies the device and republishes discovery', () => {
		harness.resetPublishes()
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

	it('manualDiscovery suppresses the publish unless forceUpdate is set', async () => {
		await replaceHarness({ manualDiscovery: true })
		const { device } = discoverSwitch('dev-manual')
		harness.resetPublishes()

		harness.gw.publishDiscovery(device, 2)
		expect(harness.broker.published).toHaveLength(0)

		harness.gw.publishDiscovery(device, 2, { forceUpdate: true })
		expect(harness.broker.published).toHaveLength(1)
	})

	it('ignoreDiscovery on the device suppresses the publish', () => {
		harness.resetPublishes()
		const { device } = discoverSwitch('dev-ignore')
		harness.resetPublishes()

		const ignored = { ...device, ignoreDiscovery: true } as HassDevice
		harness.gw.publishDiscovery(ignored, 2)
		expect(harness.broker.published).toHaveLength(0)
	})
})

describe('Home Assistant status and broker reconnect re-announce all devices', () => {
	/** Registers a node with one persistent discovered device in zwave.nodes. */
	function seedDiscoveredNode(id: number, deviceId: string): HassDevice {
		const { node, device } = discoverSwitch(deviceId, id)
		harness.zwave.nodes.set(id, node)
		return device
	}

	it('on connect, subscribes to the fixed homeassistant/status topic and client actions', () => {
		harness.resetPublishes()
		harness.broker.subscribed.length = 0

		// triggerConnect() sets connected before firing 'connect' so the real
		// subscribe() (which rejects offline) succeeds
		harness.broker.triggerConnect()

		const topics = harness.broker.subscribed.map((s) => s.topic)
		// HASS will/birth topic is the fixed literal, never prefixed
		expect(topics).toContain('homeassistant/status')
		const cid = harness.mqtt.clientID
		expect(topics).toContain(`zwave/_CLIENTS/${cid}/broadcast/#`)
		expect(topics).toContain(`zwave/_CLIENTS/${cid}/api/#`)
		expect(topics).toContain(`zwave/_CLIENTS/${cid}/multicast/#`)
	})

	it('HA "online" (any case) republishes the device discovery topic', async () => {
		harness.resetPublishes()
		harness.zwave.nodes.clear()
		seedDiscoveredNode(2, 'dev-online')

		// Connect first so homeassistant/status is routable, then clear the
		// connect-time rediscovery to isolate the ONLINE one
		harness.broker.triggerConnect()
		await tick()
		harness.resetPublishes()

		harness.broker.deliver('homeassistant/status', 'online')
		await tick()
		// Exact rediscovered topic, not length > 0 which connect-time
		// version/status publishes would also satisfy
		expect(
			harness.broker.published.some(
				(p) => p.topic === SWITCH_DISCOVERY_TOPIC,
			),
		).toBe(true)

		harness.resetPublishes()
		harness.broker.deliver('homeassistant/status', 'ONLINE')
		await tick()
		expect(
			harness.broker.published.some(
				(p) => p.topic === SWITCH_DISCOVERY_TOPIC,
			),
		).toBe(true)
	})

	it('HA "offline" does not rediscover', async () => {
		harness.resetPublishes()
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

	it('broker reconnect republishes the discovery topic', async () => {
		harness.resetPublishes()
		harness.zwave.nodes.clear()
		seedDiscoveredNode(2, 'dev-reconnect')
		harness.resetPublishes()

		// A full connect cycle, after subscribing, re-announces every device
		harness.broker.triggerConnect()
		await tick()
		expect(
			harness.broker.published.some(
				(p) => p.topic === SWITCH_DISCOVERY_TOPIC,
			),
		).toBe(true)
	})

	it('a plugin-style mqtt.on(hassStatus) sees each status once, with no duplicate across reconnect', async () => {
		harness.resetState()
		harness.zwave.nodes.clear()

		// A plugin subscribes the public compatibility event through the concrete
		// MqttClient
		const emits: boolean[] = []
		const listener = (online: boolean): void => {
			emits.push(online)
		}
		harness.mqtt.on('hassStatus', listener)
		try {
			harness.broker.triggerConnect()
			await tick()

			harness.broker.deliver('homeassistant/status', 'online')
			harness.broker.deliver('homeassistant/status', 'offline')
			harness.broker.deliver('homeassistant/status', 'ONLINE')
			await tick()
			expect(emits).toEqual([true, false, true])

			// A broker reconnect re-subscribes the topic but must not surface a
			// spurious hassStatus, since that path emits only brokerStatus
			harness.broker.triggerReconnect()
			harness.broker.triggerConnect()
			await tick()
			expect(emits).toEqual([true, false, true])

			// The single manager-owned subscription still delivers the next real
			// message once, proving no duplicate listener leaked
			harness.broker.deliver('homeassistant/status', 'offline')
			await tick()
			expect(emits).toEqual([true, false, true, false])
		} finally {
			harness.mqtt.off('hassStatus', listener)
		}
	})
})

describe('inbound MQTT requests drive Z-Wave actions', () => {
	// Inbound routing needs a live subscription, which needs a connected client
	// (subscribing rejects while offline). Connect so the action wildcards and
	// per-value valueChanged subscriptions land.
	beforeEach(async () => {
		harness.broker.triggerConnect()
		await tick()
	})

	it('a write request writes the parsed value to the addressed node', async () => {
		harness.resetPublishes()
		const id = 5
		const node = buildNode({ id, name: 'Dev', deviceId: 'dev-write' })
		const targetValue = buildValueId({
			nodeId: id,
			commandClass: CommandClasses['Multilevel Switch'],
			endpoint: 0,
			property: 'targetValue',
			propertyName: 'targetValue',
			type: 'number',
			writeable: true,
			value: 0,
		})
		addValue(node, targetValue)
		harness.zwave.nodes.set(id, node)

		// Real producer: valueChanged registers topicValues and subscribes the
		// set wildcard (needs the connection above)
		harness.zwave.emit('valueChanged', targetValue, node, true)
		await tick()

		// Hard-coded delivery topic; the two assertions below check the producer
		// builds this same wire topic
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

	it('a broadcast request writes to every node and echoes feedback', async () => {
		harness.resetPublishes()
		const cid = harness.mqtt.clientID
		harness.zwave.writeBroadcast.mockClear()

		const payload = {
			commandClass: CommandClasses['Binary Switch'],
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
		expect(vId.commandClass).toBe(CommandClasses['Binary Switch'])

		// Feedback echoed to the same topic without /set, carrying the exact
		// request body back verbatim (broadcast re-publishes the parsed payload)
		const echoed = harness.broker.published.find(
			(p) => p.topic === `zwave/_CLIENTS/${cid}/broadcast`,
		)
		expect(echoed).toBeDefined()
		expect(JSON.parse(echoed.payload)).toEqual(payload)
	})

	it('a multicast request writes to the addressed nodes', async () => {
		harness.resetPublishes()
		const cid = harness.mqtt.clientID
		harness.zwave.writeMulticast.mockClear()

		const payload = {
			nodes: [2, 3],
			commandClass: CommandClasses['Binary Switch'],
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
		expect(vId.commandClass).toBe(CommandClasses['Binary Switch'])
	})

	it('an api request publishes the callApi result verbatim with the origin envelope', async () => {
		harness.resetPublishes()
		const cid = harness.mqtt.clientID
		harness.zwave.callApi.mockClear()
		// Drive a NON-default result so the ACK proves the gateway passes the
		// real callApi return through verbatim rather than echoing a fixture
		const apiResult = {
			success: false,
			message: 'boom',
			result: { echoed: 42 },
		}
		harness.zwave.callApi.mockResolvedValueOnce(apiResult)

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
		// Exact wire body: the callApi result verbatim plus the request as origin
		expect(JSON.parse(ack.payload)).toEqual({
			...apiResult,
			origin: payload,
		})
		// Published unretained (qos from config), independent of the body
		expect(ack.options).toEqual({ qos: 0, retain: false })
	})

	it('ignores actions addressed to a different client id', async () => {
		harness.resetPublishes()
		harness.zwave.callApi.mockClear()

		// deliverRaw bypasses the broker's subscription filter, handing the
		// foreign packet straight to _onMessageReceived, so this proves
		// MqttClient's own guard (parts[1] !== this._clientID) drops it
		harness.broker.deliverRaw(
			`zwave/_CLIENTS/ZWAVE_GATEWAY-someone-else/api/getNodes/set`,
			JSON.stringify({ args: [] }),
		)
		await tick()

		expect(harness.zwave.callApi).not.toHaveBeenCalled()
	})
})
