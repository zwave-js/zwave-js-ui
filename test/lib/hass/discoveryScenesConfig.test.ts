/**
 * Characterization of `Gateway.discoverValue` for Central Scene / Scene
 * Activation and the Configuration CC, plus the shared "common tail" behavior
 * every family runs through: endpoint object-id suffixing, duplicate object-id
 * indexing, entity-name templating, location handling, the discovered de-dup
 * guard, and the early-return guards (not ready / virtual / hass disabled /
 * unknown CC).
 *
 * Real `Gateway` + real `MqttClient`; only `mqtt` is mocked.
 */
import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	beforeEach,
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
import { buildNode, buildValueId, addValue } from './fixtures.ts'
import type { ZUINode, ZUIValueId } from '../../../api/lib/ZwaveClient.ts'

vi.mock('mqtt', () => mqttMockFactory())

let harness: GatewayHarness

beforeAll(async () => {
	harness = await createGatewayHarness({ zwave: { homeHex: '0xabcdef01' } })
})

afterAll(async () => {
	await harness.close()
	cleanupGatewayHarnessEnv()
})

beforeEach(() => {
	harness.resetState()
	// restore config knobs individual tests may have toggled
	harness.config.hassDiscovery = true
	harness.config.entityTemplate = undefined
	harness.config.ignoreLoc = undefined
	harness.config.values = []
})

function readyNode(over: Partial<ZUINode> = {}): ZUINode {
	return buildNode({ id: 2, name: 'Dev', firmwareVersion: '1.0.0', ...over })
}

function discover(value: ZUIValueId, node = readyNode()) {
	const key = addValue(node, value)
	const device = discoverValueOnNode(harness.gw, node, key)
	return {
		device,
		node,
		key,
		payload: device ? harness.lastDiscovery() : null,
	}
}

describe('discoverValue - Central Scene / Scene Activation', () => {
	it('maps a central scene to a scene_state sensor', () => {
		const { device, payload } = discover(
			buildValueId({
				commandClass: CommandClasses['Central Scene'],
				property: 'scene',
				propertyName: 'scene',
				propertyKey: 1,
			}),
		)
		expect(device.type).toBe('sensor')
		expect(device.object_id).toBe('scene_state_scene_1')
		expect(payload.payload.value_template).toBe(
			"{{ value_json.value | default('') }}",
		)
		expect(payload.payload.state_topic).toBe(
			'zwave/Dev/central_scene/endpoint_0/scene/1',
		)
		expect(payload.topic).toBe(
			'homeassistant/sensor/Dev/scene_state_scene_1/config',
		)
	})

	it('maps a numeric Scene Activation sceneId with the plain (non-nested) template', () => {
		// `sceneId` is ALWAYS a plain number on Scene Activation CC, so it
		// takes the default, non-nested template. (This is the production-real
		// counterpart to the nested case below - the previous fixture forced a
		// unit onto `sceneId`, which cannot happen in production.)
		const { device, payload } = discover(
			buildValueId({
				commandClass: CommandClasses['Scene Activation'],
				property: 'sceneId',
				propertyName: 'sceneId',
				value: 3,
			} as any),
		)
		expect(device.type).toBe('sensor')
		expect(device.object_id).toBe('scene_state_sceneid')
		expect(payload.payload.value_template).toBe(
			"{{ value_json.value | default('') }}",
		)
	})

	it('uses a nested value template when a Scene Activation value carries a unit (dimmingDuration)', () => {
		// The ONLY Scene Activation CC value that carries a unit is
		// `dimmingDuration`, a zwave-js Duration (`{ value, unit }`). Drive the
		// nested `value_json.value.value` template branch with that real,
		// production-possible value instead of an impossible unit-bearing
		// `sceneId`.
		const { device, payload } = discover(
			buildValueId({
				commandClass: CommandClasses['Scene Activation'],
				property: 'dimmingDuration',
				propertyName: 'dimmingDuration',
				value: { value: 10, unit: 'seconds' } as any,
			}),
		)
		expect(device.type).toBe('sensor')
		expect(device.object_id).toBe('scene_state_dimmingduration')
		expect(payload.payload.value_template).toBe(
			"{{ value_json.value.value | default('') }}",
		)
	})
})

describe('discoverValue - Configuration CC', () => {
	const cc = CommandClasses.Configuration

	it('maps a 0..1 numeric parameter to a config_switch', () => {
		const { device, payload } = discover(
			buildValueId({
				commandClass: cc,
				property: 3,
				propertyName: '3',
				type: 'number',
				min: 0,
				max: 1,
			} as any),
		)
		expect(device.type).toBe('switch')
		expect(device.object_id).toBe('config_switch_3')
		expect(payload.payload.payload_off).toBe('0')
		expect(payload.payload.payload_on).toBe('1')
		expect(payload.payload.entity_category).toBe('config')
		expect(payload.payload.enabled_by_default).toBe(false)
		expect(payload.payload.command_topic).toBe(
			'zwave/Dev/configuration/endpoint_0/3/set',
		)
	})

	it('maps a wider numeric parameter to a config_number with min/max', () => {
		const { device, payload } = discover(
			buildValueId({
				commandClass: cc,
				property: 5,
				propertyName: '5',
				type: 'number',
				min: 5,
				max: 50,
			} as any),
		)
		expect(device.type).toBe('number')
		expect(device.object_id).toBe('config_number_5')
		expect(payload.payload.min).toBe(5)
		expect(payload.payload.max).toBe(50)
	})

	it('omits min/max at the 1..100 defaults', () => {
		const { payload } = discover(
			buildValueId({
				commandClass: cc,
				property: 6,
				propertyName: '6',
				type: 'number',
				min: 1,
				max: 100,
			} as any),
		)
		expect('min' in payload.payload).toBe(false)
		expect('max' in payload.payload).toBe(false)
	})

	it('skips a non-writeable configuration value', () => {
		const { device } = discover(
			buildValueId({
				commandClass: cc,
				property: 7,
				propertyName: '7',
				type: 'number',
				min: 0,
				max: 1,
				writeable: false,
			} as any),
		)
		expect(device).toBeUndefined()
	})

	it('respects the DISCOVERY_DISABLE_CC_CONFIGURATION env flag', () => {
		const prev = process.env.DISCOVERY_DISABLE_CC_CONFIGURATION
		process.env.DISCOVERY_DISABLE_CC_CONFIGURATION = 'true'
		try {
			const { device } = discover(
				buildValueId({
					commandClass: cc,
					property: 8,
					propertyName: '8',
					type: 'number',
					min: 0,
					max: 1,
				} as any),
			)
			expect(device).toBeUndefined()
		} finally {
			if (prev === undefined) {
				delete process.env.DISCOVERY_DISABLE_CC_CONFIGURATION
			} else {
				process.env.DISCOVERY_DISABLE_CC_CONFIGURATION = prev
			}
		}
	})

	it('enables the entity when ccConfigEnableDiscovery is set on the value config', () => {
		const node = readyNode({ deviceId: '111-2-3' })
		harness.config.values = [
			{
				device: '111-2-3',
				value: { id: '112-0-9' } as any,
				ccConfigEnableDiscovery: true,
			},
		]
		const value = buildValueId({
			commandClass: cc,
			property: 9,
			propertyName: '9',
			type: 'number',
			min: 0,
			max: 1,
		} as any)
		const key = addValue(node, value)
		const device = discoverValueOnNode(harness.gw, node, key)
		expect(device.discovery_payload.enabled_by_default).toBe(true)
	})
})

describe('discoverValue - common tail behavior', () => {
	it('appends the endpoint to the object id for multi-instance devices', () => {
		const node = readyNode()
		const target = buildValueId({
			commandClass: CommandClasses['Binary Switch'],
			endpoint: 2,
			property: 'targetValue',
			propertyName: 'targetValue',
		})
		addValue(node, target)
		const current = buildValueId({
			commandClass: CommandClasses['Binary Switch'],
			endpoint: 2,
			property: 'currentValue',
			propertyName: 'currentValue',
			isCurrentValue: true,
			targetValue: '37-2-targetValue',
		})
		const key = addValue(node, current)
		const device = discoverValueOnNode(harness.gw, node, key)
		expect(device.object_id).toBe('switch_2')
		expect(harness.lastDiscovery().payload.state_topic).toBe(
			'zwave/Dev/switch_binary/endpoint_2/currentValue',
		)
		expect(harness.lastDiscovery().payload.unique_id).toBe(
			'zwavejs2mqtt_0xabcdef01_2-37-2-currentValue',
		)
	})

	it('indexes a duplicate type+object_id with the endpoint', () => {
		// Pre-seed a colliding hass device so the dedup branch triggers.
		const node = readyNode()
		node.hassDevices['binary_sensor_tamper'] = { placeholder: true } as any
		const { device } = discover(
			buildValueId({
				commandClass: CommandClasses['Binary Sensor'],
				property: 'Tamper',
				propertyName: 'Tamper',
			}),
			node,
		)
		expect(device.object_id).toBe('tamper_0')
	})

	it('honors a custom entity name template', () => {
		harness.config.entityTemplate = '%n - %o (%nid)'
		const node = readyNode()
		const key = addValue(
			node,
			buildValueId({
				commandClass: CommandClasses.Battery,
				property: 'level',
				propertyName: 'level',
			}),
		)
		discoverValueOnNode(harness.gw, node, key)
		expect(harness.lastDiscovery().payload.name).toBe(
			'Dev - battery_level (nodeID_2)',
		)
	})

	it('prefixes topics and node name with the location', () => {
		const node = readyNode({ loc: 'Kitchen' })
		const key = addValue(
			node,
			buildValueId({
				commandClass: CommandClasses.Battery,
				property: 'level',
				propertyName: 'level',
			}),
		)
		const device = discoverValueOnNode(harness.gw, node, key)
		expect(harness.lastDiscovery().payload.state_topic).toBe(
			'zwave/Kitchen/Dev/battery/endpoint_0/level',
		)
		// node name (and hence discovery topic) is location-prefixed
		expect(harness.lastDiscovery().topic).toBe(
			'homeassistant/sensor/Kitchen-Dev/battery_level/config',
		)
		expect(device.discovery_payload.device.name).toBe('Kitchen-Dev')
	})

	it('drops the location when ignoreLoc is set', () => {
		harness.config.ignoreLoc = true
		const node = readyNode({ loc: 'Kitchen' })
		const key = addValue(
			node,
			buildValueId({
				commandClass: CommandClasses.Battery,
				property: 'level',
				propertyName: 'level',
			}),
		)
		discoverValueOnNode(harness.gw, node, key)
		expect(harness.lastDiscovery().payload.state_topic).toBe(
			'zwave/Dev/battery/endpoint_0/level',
		)
	})
})

describe('discoverValue - guards', () => {
	it('skips an unknown command class', () => {
		const { device } = discover(
			buildValueId({
				commandClass: CommandClasses['Manufacturer Specific'],
				property: 'manufacturerId',
				propertyName: 'manufacturerId',
			}),
		)
		expect(device).toBeUndefined()
		expect(harness.publishedDiscoveries()).toHaveLength(0)
	})

	it('does not re-discover an already-discovered value', () => {
		const node = readyNode()
		const key = addValue(
			node,
			buildValueId({
				commandClass: CommandClasses.Battery,
				property: 'level',
				propertyName: 'level',
			}),
		)
		harness.gw.discoverValue(node, key)
		expect(harness.publishedDiscoveries()).toHaveLength(1)
		// second call is a no-op (discovered de-dup guard)
		harness.gw.discoverValue(node, key)
		expect(harness.publishedDiscoveries()).toHaveLength(1)
	})

	it('skips a value on a not-ready node', () => {
		const node = readyNode({ ready: false })
		const key = addValue(
			node,
			buildValueId({
				commandClass: CommandClasses.Battery,
				property: 'level',
				propertyName: 'level',
			}),
		)
		harness.gw.discoverValue(node, key)
		expect(harness.publishedDiscoveries()).toHaveLength(0)
	})

	it('skips a virtual node', () => {
		const node = readyNode({ virtual: true })
		const key = addValue(
			node,
			buildValueId({
				commandClass: CommandClasses.Battery,
				property: 'level',
				propertyName: 'level',
			}),
		)
		harness.gw.discoverValue(node, key)
		expect(harness.publishedDiscoveries()).toHaveLength(0)
	})

	it('skips discovery when hassDiscovery is disabled', () => {
		harness.config.hassDiscovery = false
		const node = readyNode()
		const key = addValue(
			node,
			buildValueId({
				commandClass: CommandClasses.Battery,
				property: 'level',
				propertyName: 'level',
			}),
		)
		harness.gw.discoverValue(node, key)
		expect(harness.publishedDiscoveries()).toHaveLength(0)
	})
})
