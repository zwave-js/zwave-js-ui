/**
 * Characterizes climate and composite entity discovery. A thermostat node is
 * driven through the real producer (a nodeInited event runs the full discovery
 * pipeline), so the captured topics, templates, and payloads are what
 * production emits.
 *
 * Domain facts covered here:
 *  - a thermostat yields a single packet: the composite climate entity claims
 *    its member values, so the Air-temperature Multilevel Sensor is not
 *    published as its own sensor.
 *  - the mode-state and action templates are inverted/forward maps of the mode.
 *  - the temperature-state topic follows the active mode's setpoint topic, so
 *    it changes with the current mode.
 *  - a composite unique_id uses the capital _Node<id>_ infix, distinct from a
 *    per-value entity's identifiers.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CommandClasses } from '@zwave-js/core'
import { mqttMockFactory } from './mqttMock.ts'
import {
	useGatewayHarness,
	type GatewayHarness,
	type PublishedDiscovery,
} from './gatewayHarness.ts'
import {
	buildNode,
	buildValueId,
	addValue,
	state,
	requireDefined,
} from './fixtures.ts'
import type {
	HassDevice,
	ZUINode,
	ZUIValueIdState,
} from '#api/lib/ZwaveClient.ts'

vi.mock('mqtt', () => mqttMockFactory())

const gatewayHarness = useGatewayHarness()
let harness: GatewayHarness

beforeEach(async () => {
	harness = await gatewayHarness.get()
})

interface ThermostatOptions {
	id?: number
	name?: string
	deviceId: string
	modeStates?: ZUIValueIdState[]
	modeValue?: number
	includeMode?: boolean
	setpoints?: number[]
	withTemp?: boolean
	tempUnit?: string
	withAction?: boolean
}

/** Builds a thermostat `ZUINode` (generic device class 0x08). */
function buildThermostatNode(opts: ThermostatOptions): ZUINode {
	const {
		id = 2,
		name = 'Thermostat',
		deviceId,
		modeStates = [state(0, 'Off'), state(1, 'Heat'), state(2, 'Cool')],
		modeValue = 1,
		includeMode = true,
		setpoints = [1, 2],
		withTemp = true,
		tempUnit = '°C',
		withAction = true,
	} = opts

	const node = buildNode({
		id,
		name,
		deviceId,
		deviceClass: { basic: 0, generic: 0x08, specific: 0 },
	})

	if (includeMode) {
		addValue(
			node,
			buildValueId({
				nodeId: id,
				commandClass: CommandClasses['Thermostat Mode'],
				endpoint: 0,
				property: 'mode',
				propertyName: 'mode',
				type: 'number',
				value: modeValue,
				states: modeStates,
			}),
		)
	}

	for (const pk of setpoints) {
		addValue(
			node,
			buildValueId({
				nodeId: id,
				commandClass: CommandClasses['Thermostat Setpoint'],
				endpoint: 0,
				property: 'setpoint',
				propertyKey: pk,
				propertyName: 'setpoint',
				type: 'number',
				value: 20 + pk,
				unit: '°C',
			}),
		)
	}

	if (withTemp) {
		addValue(
			node,
			buildValueId({
				nodeId: id,
				commandClass: CommandClasses['Multilevel Sensor'],
				endpoint: 0,
				property: 'Air temperature',
				propertyName: 'Air temperature',
				type: 'number',
				value: 21.5,
				unit: tempUnit,
				ccSpecific: { sensorType: 1, scale: 0 },
			}),
		)
	}

	if (withAction) {
		addValue(
			node,
			buildValueId({
				nodeId: id,
				commandClass: CommandClasses['Thermostat Operating State'],
				endpoint: 0,
				property: 'state',
				propertyName: 'state',
				type: 'number',
				value: 1,
				states: [state(0, 'Idle'), state(1, 'Heating')],
			}),
		)
	}

	return node
}

/** Drives the REAL `_onNodeInited` discovery pipeline via the zwave event. */
function initNode(node: ZUINode): void {
	harness.zwave.nodes.set(node.id, node)
	harness.zwave.emit('nodeInited', node)
}

function requireHassDevice(node: ZUINode, key: string): HassDevice {
	return requireDefined(
		node.hassDevices?.[key],
		`Expected HASS device ${key}`,
	)
}

function climatePacket(nodeName = 'Thermostat'): PublishedDiscovery {
	return requireDefined(
		harness
			.publishedDiscoveries()
			.find(
				(p) =>
					p.topic ===
					`homeassistant/climate/${nodeName}/climate/config`,
			),
		`Expected climate discovery packet for ${nodeName}`,
	)
}

describe('climate thermostat discovery', () => {
	it('discovers a thermostat with mode, setpoint, and action mappings', () => {
		harness.resetPublishes()
		const node = buildThermostatNode({ deviceId: 'test-climate-full' })
		initNode(node)

		const climate = requireHassDevice(node, 'climate_climate')
		expect(climate).toBeDefined()
		expect(climate.type).toBe('climate')
		expect(climate.object_id).toBe('climate')
		expect(climate.persistent).toBe(false)
		expect(climate.ignoreDiscovery).toBe(false)
		expect(climate.discoveryTopic).toBe('climate/Thermostat/climate/config')

		expect(climate.mode_map).toEqual({ off: 0, heat: 1, cool: 2 })
		expect(climate.setpoint_topic).toEqual({
			1: '67-0-setpoint-1',
			2: '67-0-setpoint-2',
		})
		expect(climate.default_setpoint).toBe('67-0-setpoint-1')
		expect(climate.action_map).toEqual({ 0: 'idle', 1: 'heating' })
	})

	it('consolidates the thermostat member values into a single published entity', () => {
		harness.resetPublishes()
		const node = buildThermostatNode({ deviceId: 'test-climate-claim' })
		initNode(node)

		// The Air-temperature Multilevel Sensor is claimed as a climate member,
		// so it is not published separately and the node maps to a single
		// climate entity
		const all = harness.publishedDiscoveries()
		expect(all).toHaveLength(1)
		expect(all[0].topic).toBe(
			'homeassistant/climate/Thermostat/climate/config',
		)
	})

	it('resolves climate topics, templates, and QoS/retain from the value config', () => {
		harness.resetPublishes()
		const node = buildThermostatNode({ deviceId: 'test-climate-topics' })
		initNode(node)

		const packet = climatePacket()
		expect(packet).toBeDefined()
		expect(packet.options).toEqual({ qos: 0, retain: false })

		const p = packet.payload
		expect(p.modes).toEqual(['off', 'heat', 'cool'])
		expect(p.mode_state_topic).toBe(
			'zwave/Thermostat/thermostat_mode/endpoint_0/mode',
		)
		expect(p.mode_command_topic).toBe(
			'zwave/Thermostat/thermostat_mode/endpoint_0/mode/set',
		)
		expect(p.mode_state_template).toBe(
			'{{ {0: "off", 1: "heat", 2: "cool"}[value_json.value] | default(\'off\') }}',
		)

		// current mode Heat (value 1) -> temperature topic points at setpoint 1
		expect(p.temperature_state_topic).toBe(
			'zwave/Thermostat/thermostat_setpoint/endpoint_0/setpoint/1',
		)
		expect(p.temperature_command_topic).toBe(
			'zwave/Thermostat/thermostat_setpoint/endpoint_0/setpoint/1/set',
		)

		expect(p.action_topic).toBe(
			'zwave/Thermostat/thermostat_operating_state/endpoint_0/state',
		)
		expect(p.action_template).toBe(
			'{{ {0: "idle", 1: "heating"}[value_json.value] | default(\'idle\') }}',
		)

		expect(p.current_temperature_topic).toBe(
			'zwave/Thermostat/sensor_multilevel/endpoint_0/Air_temperature',
		)
		expect(p.temperature_unit).toBe('C')
		expect(p.precision).toBe(0.1)

		// carried-through catalog defaults
		expect(p.min_temp).toBe(5)
		expect(p.max_temp).toBe(40)
		expect(p.temp_step).toBe(0.5)
		expect(p.temperature_state_template).toBe('{{ value_json.value }}')
		expect(p.current_temperature_template).toBe('{{ value_json.value }}')

		expect(p.unique_id).toBe('zwavejs2mqtt_0xabcdef01_Node2_climate')
		expect(p.device.identifiers).toEqual(['zwavejs2mqtt_0xabcdef01_node2'])
		expect(p.name).toBe('Thermostat_climate')
		expect(p.availability_mode).toBe('all')
		expect(p.availability).toHaveLength(3)
	})

	it('follows the current mode when choosing the temperature setpoint topic', () => {
		harness.resetPublishes()
		const node = buildThermostatNode({
			deviceId: 'test-climate-cool',
			modeValue: 2, // Cool active
		})
		initNode(node)

		const p = climatePacket().payload
		// mode.value === 2 -> setpoint_topic[2] -> the cooling setpoint
		expect(p.temperature_state_topic).toBe(
			'zwave/Thermostat/thermostat_setpoint/endpoint_0/setpoint/2',
		)
	})

	it('exposes a default setpoint for a single-setpoint thermostat with no mode command class', () => {
		harness.resetPublishes()
		const node = buildThermostatNode({
			deviceId: 'test-climate-nomode',
			includeMode: false,
			setpoints: [1],
			withAction: false,
		})
		initNode(node)

		const climate = requireHassDevice(node, 'climate_climate')
		expect(climate).toBeDefined()
		// no mode CC -> modes + mode_state_template deleted, default_setpoint set
		expect(climate.default_setpoint).toBe('67-0-setpoint-1')
		const p = climatePacket().payload
		expect(p.modes).toBeUndefined()
		expect(p.mode_state_template).toBeUndefined()
		expect(p.mode_state_topic).toBeUndefined()
		// temperature still resolves from the default setpoint
		expect(p.temperature_state_topic).toBe(
			'zwave/Thermostat/thermostat_setpoint/endpoint_0/setpoint/1',
		)
	})

	it('omits current-temperature fields when the thermostat has no air-temperature value', () => {
		harness.resetPublishes()
		const node = buildThermostatNode({
			deviceId: 'test-climate-notemp',
			withTemp: false,
		})
		initNode(node)

		const p = climatePacket().payload
		// current_temperature_topic + template are deleted when no temperature id
		expect(p.current_temperature_topic).toBeUndefined()
		expect(p.current_temperature_template).toBeUndefined()
		expect(p.temperature_unit).toBeUndefined()
	})

	it('Fahrenheit air temperature maps temperature_unit to F', () => {
		harness.resetPublishes()
		const node = buildThermostatNode({
			deviceId: 'test-climate-f',
			tempUnit: '°F',
		})
		initNode(node)

		expect(climatePacket().payload.temperature_unit).toBe('F')
	})

	it('does not republish when the node pipeline runs again', () => {
		harness.resetPublishes()
		const node = buildThermostatNode({ deviceId: 'test-climate-idem' })
		initNode(node)
		expect(harness.publishedDiscoveries()).toHaveLength(1)

		// Re-init: the climate device and all member values already exist in
		// discovered, so nothing is republished
		harness.resetPublishes()
		harness.zwave.emit('nodeInited', node)
		expect(harness.publishedDiscoveries()).toHaveLength(0)
	})
})

describe('generic composite device discovery', () => {
	it('resolves value ids to topics and appends /set for command topics', () => {
		harness.resetPublishes()
		const node = buildNode({
			id: 7,
			name: 'Composite',
			deviceId: 'test-composite',
		})
		const tempKey = addValue(
			node,
			buildValueId({
				nodeId: 7,
				commandClass: CommandClasses['Multilevel Sensor'],
				endpoint: 0,
				property: 'Air temperature',
				propertyName: 'Air temperature',
				type: 'number',
				value: 21,
				unit: '°C',
				ccSpecific: { sensorType: 1, scale: 0 },
			}),
		)

		const composite: HassDevice = {
			type: 'sensor',
			object_id: 'composite',
			values: [tempKey],
			discovery_payload: {
				state_topic: tempKey,
				command_topic: tempKey,
				json_attributes_topic: tempKey,
				unit_of_measurement: '°C',
			},
		}

		harness.gw.discoverDevice(node, composite)

		const stored = requireHassDevice(node, 'sensor_composite')
		expect(stored).toBeDefined()
		const p = stored.discovery_payload
		const base =
			'zwave/Composite/sensor_multilevel/endpoint_0/Air_temperature'
		// state/json_attributes topics resolved, no /set suffix
		expect(p.state_topic).toBe(base)
		expect(p.json_attributes_topic).toBe(base)
		// command topic resolved WITH /set suffix
		expect(p.command_topic).toBe(base + '/set')
		// non-topic keys untouched
		expect(p.unit_of_measurement).toBe('°C')
		// composite unique_id uses the capital `_Node<id>_` infix
		expect(p.unique_id).toBe('zwavejs2mqtt_0xabcdef01_Node7_composite')
	})

	it('is skipped when the device already exists on the node', () => {
		harness.resetPublishes()
		const node = buildNode({
			id: 8,
			name: 'Composite2',
			deviceId: 'test-composite-2',
		})
		const tempKey = addValue(
			node,
			buildValueId({
				nodeId: 8,
				commandClass: CommandClasses['Multilevel Sensor'],
				endpoint: 0,
				property: 'Air temperature',
				propertyName: 'Air temperature',
				value: 21,
				unit: '°C',
				ccSpecific: { sensorType: 1, scale: 0 },
			}),
		)
		const composite: HassDevice = {
			type: 'sensor',
			object_id: 'dup',
			values: [tempKey],
			discovery_payload: { state_topic: tempKey },
		}

		harness.gw.discoverDevice(node, composite)
		expect(harness.publishedDiscoveries()).toHaveLength(1)

		// second call: sensor_dup already set -> no-op
		harness.resetPublishes()
		harness.gw.discoverDevice(node, composite)
		expect(harness.publishedDiscoveries()).toHaveLength(0)
	})
})
