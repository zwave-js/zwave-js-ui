/**
 * Characterizes actuator entity discovery for the command classes the Gateway
 * handles: Binary/All/Binary-Toggle Switch, Barrier Operator, Multilevel Switch
 * (cover-position vs light-dimmer), Door Lock, Sound Switch (volume), Color
 * Switch (RGB).
 *
 * Runs the real Gateway + real MqttClient (only mqtt is mocked), so every
 * asserted topic, template, payload, device, and availability block is the
 * production output captured at the broker publish boundary.
 */
import {
	describe,
	it,
	expect,
	afterAll,
	beforeEach,
	afterEach,
	vi,
} from 'vitest'
import { CommandClasses } from '@zwave-js/core'
import { mqttMockFactory } from './mqttMock.ts'
import {
	createGatewayHarness,
	cleanupGatewayHarnessEnv,
	discoverValueOnNode,
	type GatewayHarness,
} from './gatewayHarness.ts'
import { buildNode, buildValueId, addValue, valueMapKey } from './fixtures.ts'
import type { ZUINode, ZUIValueId } from '#api/lib/ZwaveClient.ts'

vi.mock('mqtt', () => mqttMockFactory())

const HOME_HEX = '0xabcdef01'

let harness: GatewayHarness

beforeEach(async () => {
	harness = await createGatewayHarness({ zwave: { homeHex: HOME_HEX } })
})

afterEach(async () => {
	await harness.close()
})

afterAll(() => {
	cleanupGatewayHarnessEnv()
})

/** A ready, physical node with deterministic identity fields. */
function readyNode(over: Partial<ZUINode> = {}): ZUINode {
	return buildNode({
		id: 2,
		name: 'Dev',
		manufacturer: 'Acme',
		productDescription: 'Widget',
		productLabel: 'WID',
		firmwareVersion: '1.0.0',
		...over,
	})
}

/**
 * Registers a currentValue/targetValue sibling pair (the shape ZwaveClient
 * produces for actuator CCs) and returns the current value's map key.
 */
function addCurrentTargetPair(
	node: ZUINode,
	opts: {
		cc: number
		endpoint?: number
		currentProperty?: string
		targetProperty?: string
		extra?: Partial<ZUIValueId>
	},
): string {
	const endpoint = opts.endpoint ?? 0
	const currentProperty = opts.currentProperty ?? 'currentValue'
	const targetProperty = opts.targetProperty ?? 'targetValue'

	const target = buildValueId({
		nodeId: node.id,
		commandClass: opts.cc,
		endpoint,
		property: targetProperty,
		propertyName: targetProperty,
	})
	addValue(node, target)

	const current = buildValueId({
		nodeId: node.id,
		commandClass: opts.cc,
		endpoint,
		property: currentProperty,
		propertyName: currentProperty,
		isCurrentValue: true,
		targetValue: valueMapKey(target),
		...opts.extra,
	})
	return addValue(node, current)
}

describe('Binary Switch discovery', () => {
	it('builds the binary switch discovery entity', () => {
		const node = readyNode()
		const key = addCurrentTargetPair(node, {
			cc: CommandClasses['Binary Switch'],
		})

		const device = discoverValueOnNode(harness.gw, node, key)
		expect(device).toBeDefined()
		expect(device.type).toBe('switch')
		expect(device.object_id).toBe('switch')

		const published = harness.lastDiscovery()
		expect(published.topic).toBe('homeassistant/switch/Dev/switch/config')
		expect(published.options).toEqual({ qos: 0, retain: false })

		expect(published.payload).toEqual({
			payload_off: false,
			payload_on: true,
			value_template: '{{ value_json.value }}',
			command_topic: 'zwave/Dev/switch_binary/endpoint_0/targetValue/set',
			state_topic: 'zwave/Dev/switch_binary/endpoint_0/currentValue',
			availability: [
				{
					payload_available: 'true',
					payload_not_available: 'false',
					topic: 'zwave/Dev/status',
					value_template:
						"{{'true' if value_json.value else 'false'}}",
				},
				{
					// This status topic is emitted verbatim by the producer; the
					// assertion below checks it stays this fixed value
					topic: 'zwave/_CLIENTS/ZWAVE_GATEWAY-test/status',
					value_template:
						"{{'online' if value_json.value else 'offline'}}",
				},
				{
					payload_available: 'true',
					payload_not_available: 'false',
					topic: 'zwave/driver/status',
				},
			],
			availability_mode: 'all',
			device: {
				identifiers: ['zwavejs2mqtt_0xabcdef01_node2'],
				manufacturer: 'Acme',
				model: 'Widget (WID)',
				name: 'Dev',
				sw_version: '1.0.0',
			},
			name: 'Dev_switch',
			unique_id: 'zwavejs2mqtt_0xabcdef01_2-37-0-currentValue',
		})

		// Check the producer helper resolves the same status topic independently,
		// so neither value derives from the other
		expect(harness.mqtt.getStatusTopic()).toBe(
			'zwave/_CLIENTS/ZWAVE_GATEWAY-test/status',
		)
	})

	it('skips non-current values (targetValue alone) on switch CC', () => {
		const node = readyNode()
		const target = buildValueId({
			nodeId: node.id,
			commandClass: CommandClasses['Binary Switch'],
			property: 'targetValue',
			propertyName: 'targetValue',
		})
		const key = addValue(node, target)

		const device = discoverValueOnNode(harness.gw, node, key)
		expect(device).toBeUndefined()
		expect(harness.publishedDiscoveries()).toHaveLength(0)
	})

	it('treats All Switch and Binary Toggle Switch like Binary Switch', () => {
		for (const cc of [
			CommandClasses['All Switch'],
			CommandClasses['Binary Toggle Switch'],
		]) {
			harness.resetState()
			const node = readyNode()
			const key = addCurrentTargetPair(node, { cc })
			const device = discoverValueOnNode(harness.gw, node, key)
			expect(device.type).toBe('switch')
			expect(device.object_id).toBe('switch')
		}
	})
})

describe('Barrier Operator discovery', () => {
	it('maps to a garage cover with numeric position/state', () => {
		const node = readyNode()
		const key = addCurrentTargetPair(node, {
			cc: CommandClasses['Barrier Operator'],
		})

		const device = discoverValueOnNode(harness.gw, node, key)
		expect(device.type).toBe('cover')
		expect(device.object_id).toBe('barrier_state')

		const p = harness.lastDiscovery().payload
		expect(p.device_class).toBe('garage')
		expect(p.position_topic).toBe(
			'zwave/Dev/barrier_operator/endpoint_0/currentValue',
		)
		expect(p.command_topic).toBe(
			'zwave/Dev/barrier_operator/endpoint_0/targetValue/set',
		)
		expect(p.state_topic).toBe(
			'zwave/Dev/barrier_operator/endpoint_0/currentValue',
		)
		expect(p.payload_open).toBe(255)
		expect(p.payload_close).toBe(0)
		expect(p.payload_stop).toBe(253)
		expect(p.state_open).toBe(255)
		expect(p.state_opening).toBe(254)
		expect(p.state_closed).toBe(0)
		expect(p.state_closing).toBe(252)
		expect(harness.lastDiscovery().topic).toBe(
			'homeassistant/cover/Dev/barrier_state/config',
		)
	})
})

describe('Multilevel Switch discovery', () => {
	it('maps a motor-control device to cover_position', () => {
		const node = readyNode({
			// generic_type_switch_multilevel + class-A motor control
			deviceClass: { basic: 0, generic: 0x11, specific: 0x05 },
		})
		const key = addCurrentTargetPair(node, {
			cc: CommandClasses['Multilevel Switch'],
		})

		const device = discoverValueOnNode(harness.gw, node, key)
		expect(device.type).toBe('cover')
		expect(device.object_id).toBe('position')

		const p = harness.lastDiscovery().payload
		expect(p.command_topic).toBe(
			'zwave/Dev/switch_multilevel/endpoint_0/targetValue/set',
		)
		expect(p.position_topic).toBe(
			'zwave/Dev/switch_multilevel/endpoint_0/currentValue',
		)
		// set_position_topic mirrors command_topic
		expect(p.set_position_topic).toBe(p.command_topic)
		expect(p.position_template).toBe('{{ value_json.value | round(0) }}')
		expect(p.position_open).toBe(99)
		expect(p.position_closed).toBe(0)
		expect(p.payload_open).toBe(99)
		expect(p.payload_close).toBe(0)
		// cover_position sets state_topic:false -> omitted
		expect('state_topic' in p).toBe(false)
	})

	it('maps a non-motor device to a brightness light_dimmer', () => {
		const node = readyNode()
		const key = addCurrentTargetPair(node, {
			cc: CommandClasses['Multilevel Switch'],
		})

		const device = discoverValueOnNode(harness.gw, node, key)
		expect(device.type).toBe('light')
		expect(device.object_id).toBe('dimmer')

		const p = harness.lastDiscovery().payload
		expect(p.supported_color_modes).toEqual(['brightness'])
		expect(p.brightness_state_topic).toBe(
			'zwave/Dev/switch_multilevel/endpoint_0/currentValue',
		)
		expect(p.brightness_command_topic).toBe(
			'zwave/Dev/switch_multilevel/endpoint_0/targetValue/set',
		)
		expect(p.command_topic).toBe(
			'zwave/Dev/switch_multilevel/endpoint_0/targetValue/set',
		)
		expect(p.state_topic).toBe(
			'zwave/Dev/switch_multilevel/endpoint_0/currentValue',
		)
		expect(p.brightness_scale).toBe(99)
		expect(p.on_command_type).toBe('brightness')
		expect(p.state_value_template).toBe(
			'{{ "OFF" if value_json.value == 0 else "ON" }}',
		)
	})

	it('maps the 615-0-258 device to a cover through its compatibility override', () => {
		// This device reports as a Multilevel Switch but is physically a motor
		// cover; the bundled device config overrides the mapping (#3088)
		const node = readyNode({ deviceId: '615-0-258' })
		const key = addCurrentTargetPair(node, {
			cc: CommandClasses['Multilevel Switch'],
		})
		const device = discoverValueOnNode(harness.gw, node, key)
		expect(device.type).toBe('cover')
		expect(device.object_id).toBe('position')
	})
})

describe('Door Lock discovery', () => {
	it('maps the current lock state to a lock entity', () => {
		const node = readyNode()
		const key = addCurrentTargetPair(node, {
			cc: CommandClasses['Door Lock'],
		})

		const device = discoverValueOnNode(harness.gw, node, key)
		expect(device.type).toBe('lock')
		expect(device.object_id).toBe('lock')

		const p = harness.lastDiscovery().payload
		expect(p.state_locked).toBe(255)
		expect(p.state_unlocked).toBe(0)
		expect(p.payload_lock).toBe(255)
		expect(p.payload_unlock).toBe(0)
		expect(p.value_template).toBe('{{ value_json.value }}')
		expect(p.command_topic).toBe(
			'zwave/Dev/door_lock/endpoint_0/targetValue/set',
		)
		expect(p.state_topic).toBe(
			'zwave/Dev/door_lock/endpoint_0/currentValue',
		)
		expect(p.json_attributes_topic).toBe(p.state_topic)
	})
})

describe('Sound Switch volume discovery', () => {
	it('maps the volume property to a volume_dimmer light', () => {
		const node = readyNode()
		const value = buildValueId({
			nodeId: node.id,
			commandClass: CommandClasses['Sound Switch'],
			property: 'volume',
			propertyName: 'volume',
		})
		const key = addValue(node, value)

		const device = discoverValueOnNode(harness.gw, node, key)
		expect(device.type).toBe('light')
		expect(device.object_id).toBe('volume_dimmer')

		const p = harness.lastDiscovery().payload
		expect(p.brightness_state_topic).toBe(
			'zwave/Dev/sound_switch/endpoint_0/volume',
		)
		// command_topic is getTopic + '/set' (no targetValue sibling)
		expect(p.command_topic).toBe(
			'zwave/Dev/sound_switch/endpoint_0/volume/set',
		)
		expect(p.brightness_command_topic).toBe(p.command_topic)
		expect(p.brightness_scale).toBe(100)
		expect(p.on_command_type).toBe('last')
		expect(p.payload_off).toBe(0)
		expect(p.payload_on).toBe(25)
		// volume_dimmer sets state_topic:false -> omitted
		expect('state_topic' in p).toBe(false)
	})

	it('skips non-volume Sound Switch properties', () => {
		const node = readyNode()
		const value = buildValueId({
			nodeId: node.id,
			commandClass: CommandClasses['Sound Switch'],
			property: 'toneId',
			propertyName: 'toneId',
		})
		const key = addValue(node, value)
		expect(discoverValueOnNode(harness.gw, node, key)).toBeUndefined()
	})
})

describe('Color Switch RGB discovery', () => {
	it('maps currentColor to an rgb light with brightness from ML switch', () => {
		const node = readyNode()

		// brightness control on Multilevel Switch (endpoint 0)
		addCurrentTargetPair(node, {
			cc: CommandClasses['Multilevel Switch'],
		})

		// targetColor sibling so valueTopic can resolve rgb_command_topic
		const targetColor = buildValueId({
			nodeId: node.id,
			commandClass: CommandClasses['Color Switch'],
			property: 'targetColor',
			propertyName: 'targetColor',
		})
		addValue(node, targetColor)

		const currentColor = buildValueId({
			nodeId: node.id,
			commandClass: CommandClasses['Color Switch'],
			property: 'currentColor',
			propertyName: 'currentColor',
			targetValue: valueMapKey(targetColor),
		})
		const key = addValue(node, currentColor)

		const device = discoverValueOnNode(harness.gw, node, key)
		expect(device.type).toBe('light')
		expect(device.object_id).toBe('rgb_dimmer')

		const p = harness.lastDiscovery().payload
		expect(p.supported_color_modes).toEqual(['rgb', 'brightness'])
		expect(p.rgb_state_topic).toBe(
			'zwave/Dev/color/endpoint_0/currentColor',
		)
		expect(p.rgb_command_topic).toBe(
			'zwave/Dev/color/endpoint_0/targetColor/set',
		)
		expect(p.brightness_state_topic).toBe(
			'zwave/Dev/switch_multilevel/endpoint_0/currentValue',
		)
		expect(p.brightness_command_topic).toBe(
			'zwave/Dev/switch_multilevel/endpoint_0/targetValue/set',
		)
		expect(p.rgb_value_template).toBe(
			'{{ value_json.value.red }},{{ value_json.value.green }},{{ value_json.value.blue }}',
		)
		expect(harness.lastDiscovery().topic).toBe(
			'homeassistant/light/Dev/rgb_dimmer/config',
		)
	})

	it('skips a currentColor channel component (propertyKey defined)', () => {
		const node = readyNode()
		const value = buildValueId({
			nodeId: node.id,
			commandClass: CommandClasses['Color Switch'],
			property: 'currentColor',
			propertyName: 'currentColor',
			propertyKey: 2,
		})
		const key = addValue(node, value)
		expect(discoverValueOnNode(harness.gw, node, key)).toBeUndefined()
	})
})
