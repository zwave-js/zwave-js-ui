/**
 * Characterizes sensor and metering entity discovery: Binary Sensor, Alarm
 * Sensor, Basic/Notification (2-state binary and >2-state mapped sensor),
 * Multilevel Sensor, Meter, Pulse Meter, Time, Energy Production (unsupported),
 * and Battery (level sensor + isLow binary).
 *
 * Real Gateway + real MqttClient; only mqtt is mocked. Covers the object ids,
 * device/state classes, units (including abbreviation), templates, payload
 * on/off inversions, and the "no ccSpecific -> skip" guards.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CommandClasses } from '@zwave-js/core'
import { AlarmSensorType } from 'zwave-js'
import { mqttMockFactory } from './mqttMock.ts'
import {
	useGatewayHarness,
	discoverValueOnNode,
	type GatewayHarness,
} from './gatewayHarness.ts'
import { buildNode, buildValueId, addValue, state } from './fixtures.ts'
import type { ZUINode, ZUIValueId } from '#api/lib/ZwaveClient.ts'

vi.mock('mqtt', () => mqttMockFactory())

const gatewayHarness = useGatewayHarness()
let harness: GatewayHarness

beforeEach(async () => {
	harness = await gatewayHarness.get({
		zwave: { homeHex: '0xabcdef01' },
	})
})

function readyNode(over: Partial<ZUINode> = {}): ZUINode {
	return buildNode({ id: 2, name: 'Dev', firmwareVersion: '1.0.0', ...over })
}

function discover(value: ZUIValueId, node = readyNode()) {
	const key = addValue(node, value)
	const device = discoverValueOnNode(harness.gw, node, key)
	return { device, node, payload: device ? harness.lastDiscovery() : null }
}

describe('Binary Sensor discovery', () => {
	const cc = CommandClasses['Binary Sensor']

	it('maps the safety group (tamper) to a safety binary_sensor', () => {
		const { device, payload } = discover(
			buildValueId({
				commandClass: cc,
				property: 'Tamper',
				propertyName: 'Tamper',
				type: 'boolean',
			}),
		)
		expect(device.type).toBe('binary_sensor')
		expect(device.object_id).toBe('tamper')
		expect(payload.payload.device_class).toBe('safety')
		expect(payload.payload.payload_on).toBe(true)
		expect(payload.payload.payload_off).toBe(false)
		expect(payload.payload.value_template).toBe('{{ value_json.value }}')
		expect(payload.topic).toBe(
			'homeassistant/binary_sensor/Dev/tamper/config',
		)
		expect(payload.payload.json_attributes_topic).toBe(
			payload.payload.state_topic,
		)
	})

	it('maps water/contact to moisture', () => {
		const { device, payload } = discover(
			buildValueId({
				commandClass: cc,
				property: 'Water',
				propertyName: 'Water',
			}),
		)
		expect(device.object_id).toBe('water')
		expect(payload.payload.device_class).toBe('moisture')
	})

	it('reverses payloads for the lock sensor type', () => {
		const { payload } = discover(
			buildValueId({
				commandClass: cc,
				property: 'lock',
				propertyName: 'lock',
			}),
		)
		expect(payload.payload.device_class).toBe('lock')
		expect(payload.payload.payload_on).toBe(false)
		expect(payload.payload.payload_off).toBe(true)
	})

	it('falls back to a plain binary_sensor for unknown types', () => {
		const { device, payload } = discover(
			buildValueId({
				commandClass: cc,
				property: 'Motion',
				propertyName: 'Motion',
			}),
		)
		expect(device.object_id).toBe('motion')
		expect('device_class' in payload.payload).toBe(false)
	})
})

describe('Alarm Sensor discovery', () => {
	const cc = CommandClasses['Alarm Sensor']

	it('maps state to a problem binary_sensor with the alarm-type suffix', () => {
		const propertyKey = 1 // AlarmSensorType.Smoke
		const { device, payload } = discover(
			buildValueId({
				commandClass: cc,
				property: 'state',
				propertyName: 'state',
				propertyKey,
			}),
		)
		expect(device.type).toBe('binary_sensor')
		// 'event_' + AlarmSensorType[key], lowercased in the common tail.
		// The oracle uses locale-independent toLowerCase so it can't drift
		// across CI locales (the value is ASCII, so it matches production).
		const expectedObjectId = (
			'event_' + AlarmSensorType[propertyKey]
		).toLowerCase()
		expect(device.object_id).toBe(expectedObjectId)
		expect(payload.payload.device_class).toBe('problem')
	})

	it('skips non-state Alarm Sensor properties', () => {
		const { device } = discover(
			buildValueId({
				commandClass: cc,
				property: 'severity',
				propertyName: 'severity',
			}),
		)
		expect(device).toBeUndefined()
	})
})

describe('Basic and Notification discovery', () => {
	it('maps a 2-state Access Control notification to a reversed-off lock sensor', () => {
		const { device, payload } = discover(
			buildValueId({
				commandClass: CommandClasses.Notification,
				property: 'Access Control',
				propertyName: 'Access Control',
				propertyKey: 'Door state',
				propertyKeyName: 'Access Control',
				states: [state(23, 'closed'), state(22, 'open')],
			}),
		)
		expect(device.type).toBe('binary_sensor')
		expect(payload.payload.device_class).toBe('lock')
		// off value 23 is stateKeys[0] -> payload_off:23, payload_on:22
		expect(payload.payload.payload_off).toBe(23)
		expect(payload.payload.payload_on).toBe(22)
	})

	it('maps a >2-state notification to a mapped-state sensor', () => {
		const states = [
			state(0, 'idle'),
			state(1, 'detected'),
			state(2, 'unknown'),
		]
		const { device, payload } = discover(
			buildValueId({
				commandClass: CommandClasses.Notification,
				property: 'Home Security',
				propertyName: 'Home Security',
				propertyKey: 'Motion sensor status',
				states,
				default: 0,
			}),
		)
		expect(device.type).toBe('sensor')
		expect(device.object_id).toBe(
			'notification_home_security_motion_sensor_status',
		)
		expect(payload.payload.icon).toBe('mdi:motion-sensor')
		expect(payload.payload.value_template).toBe(
			'{{ {0: "idle",1: "detected",2: "unknown"}[value_json.value] | default(\'idle\') }}',
		)
	})

	it('skips a Basic value that is not an event', () => {
		const { device } = discover(
			buildValueId({
				commandClass: CommandClasses.Basic,
				property: 'currentValue',
				propertyName: 'currentValue',
			}),
		)
		expect(device).toBeUndefined()
	})
})

describe('Multilevel Sensor discovery', () => {
	const cc = CommandClasses['Multilevel Sensor']

	it('maps an air-temperature sensor with unit and device class', () => {
		const { device, payload } = discover(
			buildValueId({
				commandClass: cc,
				property: 'Air temperature',
				propertyName: 'Air temperature',
				ccSpecific: { sensorType: 1 },
				unit: '°C',
			}),
		)
		expect(device.type).toBe('sensor')
		expect(device.object_id).toBe('temperature_air')
		expect(payload.payload.device_class).toBe('temperature')
		expect(payload.payload.state_class).toBe('measurement')
		expect(payload.payload.unit_of_measurement).toBe('°C')
		expect(payload.payload.state_topic).toBe(
			'zwave/Dev/sensor_multilevel/endpoint_0/Air_temperature',
		)
	})

	it('abbreviates verbose time units (seconds -> s)', () => {
		const { payload } = discover(
			buildValueId({
				commandClass: cc,
				property: 'foo',
				propertyName: 'foo',
				ccSpecific: { sensorType: 1 },
				unit: 'seconds',
			}),
		)
		expect(payload.payload.unit_of_measurement).toBe('s')
	})

	it('skips a multilevel value with no ccSpecific', () => {
		const { device } = discover(
			buildValueId({
				commandClass: cc,
				property: 'reset',
				propertyName: 'reset',
				ccSpecific: null,
			}),
		)
		expect(device).toBeUndefined()
	})
})

describe('Meter and Pulse Meter discovery', () => {
	it('maps an electric kWh meter with the property-suffixed object id', () => {
		const { device, payload } = discover(
			buildValueId({
				commandClass: CommandClasses.Meter,
				property: 'value',
				propertyName: 'value',
				ccSpecific: { meterType: 0x01, scale: 0x00, rateType: 1 },
				unit: 'kWh',
			}),
		)
		expect(device.type).toBe('sensor')
		expect(device.object_id).toBe('electric_kwh_value')
		expect(payload.payload.device_class).toBe('energy')
		expect(payload.payload.state_class).toBe('total_increasing')
		expect(payload.payload.unit_of_measurement).toBe('kWh')
	})

	it('skips a Meter value with no ccSpecific', () => {
		const { device } = discover(
			buildValueId({
				commandClass: CommandClasses.Meter,
				property: 'reset',
				propertyName: 'reset',
				ccSpecific: null,
			}),
		)
		expect(device).toBeUndefined()
	})

	it('maps a Pulse Meter to a pulse_meter sensor', () => {
		const { device } = discover(
			buildValueId({
				commandClass: CommandClasses['Pulse Meter'],
				property: 'value',
				propertyName: 'value',
			}),
		)
		expect(device.type).toBe('sensor')
		expect(device.object_id).toBe('pulse_meter')
	})
})

describe('Time discovery', () => {
	it('maps the current time to a timestamp date sensor', () => {
		const { device, payload } = discover(
			buildValueId({
				commandClass: CommandClasses.Time,
				property: 'currentTime',
				propertyName: 'currentTime',
				isCurrentValue: true,
			}),
		)
		expect(device.type).toBe('sensor')
		expect(device.object_id).toBe('date_current')
		expect(payload.payload.device_class).toBe('timestamp')
	})

	it('skips non-current Time values', () => {
		const { device } = discover(
			buildValueId({
				commandClass: CommandClasses.Time,
				property: 'other',
				propertyName: 'other',
				isCurrentValue: false,
			}),
		)
		expect(device).toBeUndefined()
	})
})

describe('Energy Production discovery', () => {
	it('does not discover any entity', () => {
		const { device } = discover(
			buildValueId({
				commandClass: CommandClasses['Energy Production'],
				property: 'value',
				propertyName: 'value',
			}),
		)
		expect(device).toBeUndefined()
		expect(harness.publishedDiscoveries()).toHaveLength(0)
	})
})

describe('Battery discovery', () => {
	it('maps level to a battery percentage sensor', () => {
		const { device, payload } = discover(
			buildValueId({
				commandClass: CommandClasses.Battery,
				property: 'level',
				propertyName: 'level',
			}),
		)
		expect(device.type).toBe('sensor')
		expect(device.object_id).toBe('battery_level')
		expect(payload.payload.device_class).toBe('battery')
		expect(payload.payload.unit_of_measurement).toBe('%')
	})

	it('maps isLow to a battery binary_sensor', () => {
		const { device, payload } = discover(
			buildValueId({
				commandClass: CommandClasses.Battery,
				property: 'isLow',
				propertyName: 'isLow',
			}),
		)
		expect(device.type).toBe('binary_sensor')
		expect(device.object_id).toBe('battery_islow')
		expect(payload.payload.device_class).toBe('battery')
		expect(payload.payload.payload_on).toBe(true)
		expect(payload.payload.payload_off).toBe(false)
	})

	it('skips other Battery properties', () => {
		const { device } = discover(
			buildValueId({
				commandClass: CommandClasses.Battery,
				property: 'maximumCapacity',
				propertyName: 'maximumCapacity',
			}),
		)
		expect(device).toBeUndefined()
	})
})
