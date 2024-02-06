// Place here repeated patterns

import { HassDevice } from '../lib/ZwaveClient'

const FAN_DIMMER: HassDevice = {
	type: 'fan',
	object_id: 'dimmer',
	values: ['38-0-currentValue', '38-0-targetValue'],
	discovery_payload: {
		command_topic: '38-0-targetValue',
		speed_command_topic: '38-0-targetValue',
		speed_state_topic: '38-0-currentValue',
		state_topic: '38-0-currentValue',
		speeds: ['off', 'low', 'medium', 'high'],
		payload_low_speed: 24,
		payload_medium_speed: 50,
		payload_high_speed: 99,
		payload_off: 0,
		payload_on: 255,
		state_value_template:
			'{% if (value_json.value | int) == 0 %} 0 {% else %} 255 {% endif %}',
		speed_value_template:
			'{% if (value_json.value | int) == 0 %} 0 {% elif (value_json.value | int) <= 32 %} 24 {% elif (value_json.value | int) <= 66 %} 50 {% elif (value_json.value | int) <= 99 %} 99 {% endif %}',
	},
}

const THERMOSTAT_DANFOSS: HassDevice = {
	type: 'climate',
	object_id: 'thermostat',
	values: ['67-0-setpoint-1', '67-0-setpoint-2', '67-0-setpoint-10'],
	setpoint_topic: {
		1: '67-0-setpoint-1',
		2: '67-0-setpoint-2',
		10: '67-0-setpoint-10',
	},
	default_setpoint: '67-0-setpoint-1',
	discovery_payload: {
		max_temp: 40,
		min_temp: 0,
		temp_step: 0.1,
		temperature_state_template: '{{ value_json.value }}',
		temperature_state_topic: '67-0-setpoint-1',
		temperature_unit: 'C',
		temperature_command_topic: true,
	},
}

// Radio Thermostat / 2GIG CT32, CT100 and CT101
const THERMOSTAT_2GIG: HassDevice = {
	type: 'climate',
	object_id: 'thermostat',
	values: [
		'49-0-Air temperature',
		'64-0-mode',
		'66-0-state',
		'67-0-setpoint-1',
		'67-0-setpoint-2',
		'68-0-mode',
	],
	action_map: {
		0: 'idle',
		1: 'heating',
		2: 'cooling',
		3: 'fan',
	},
	mode_map: {
		off: 0,
		heat: 1,
		cool: 2,
	},
	fan_mode_map: {
		auto: 0,
		on: 1,
	},
	setpoint_topic: {
		1: '67-0-setpoint-1',
		2: '67-0-setpoint-2',
	},
	default_setpoint: '67-0-setpoint-1',
	discovery_payload: {
		min_temp: 50,
		max_temp: 85,
		modes: ['off', 'heat', 'cool'],
		fan_modes: ['auto', 'on'],
		action_topic: '66-0-state',
		current_temperature_topic: '49-0-Air temperature',
		current_temperature_template: '{{ value_json.value }}',
		fan_mode_state_topic: '68-0-mode',
		fan_mode_command_topic: true,
		mode_state_topic: '64-0-mode',
		mode_command_topic: true,
		temperature_state_template: '{{ value_json.value }}',
		temperature_command_topic: true,
	},
}

// Eurotronic Stella Z-Wave Thermostat
//   https://products.z-wavealliance.org/products/826
const STELLA_ZWAVE: HassDevice = {
	type: 'climate',
	object_id: 'thermostat',
	values: [
		'64-0-mode',
		'49-0-Air temperature',
		'67-0-setpoint-1',
		'67-0-setpoint-11',
	],
	mode_map: { off: 0, heat: 1, cool: 11 },
	setpoint_topic: {
		1: '67-0-setpoint-1',
		11: '67-0-setpoint-11',
	},
	default_setpoint: '67-0-setpoint-1',
	discovery_payload: {
		min_temp: 0,
		max_temp: 50,
		modes: ['off', 'heat', 'cool'],
		mode_state_topic: '64-0-mode',
		mode_command_topic: true,
		current_temperature_topic: '49-0-Air temperature',
		temp_step: 0.5,
		current_temperature_template: '{{ value_json.value }}',
		temperature_state_template: '{{ value_json.value }}',
		temperature_command_topic: true,
	},
}

// Eurotronic Spirit Z-Wave Plus Thermostat
const SPIRIT_ZWAVE_PLUS: HassDevice = {
	type: 'climate',
	object_id: 'thermostat',
	values: [
		'64-0-mode',
		'49-0-Air temperature',
		'67-0-setpoint-1',
		'67-0-setpoint-11',
	],
	mode_map: { off: 0, heat: 1, cool: 11 },
	setpoint_topic: {
		1: '67-0-setpoint-1',
		11: '67-0-setpoint-11',
	},
	default_setpoint: '67-0-setpoint-1',
	discovery_payload: {
		min_temp: 8,
		max_temp: 28,
		modes: ['off', 'heat', 'cool'],
		mode_state_topic: '64-0-mode',
		mode_command_topic: true,
		current_temperature_topic: '49-0-Air temperature',
		temp_step: 0.5,
		current_temperature_template: '{{ value_json.value }}',
		temperature_state_template: '{{ value_json.value }}',
		temperature_command_topic: true,
	},
}

const COVER: HassDevice = {
	type: 'cover',
	object_id: 'position',
	values: ['38-0-currentValue', '38-0-targetValue'],
	discovery_payload: {
		command_topic: '38-0-targetValue',
		position_topic: '38-0-currentValue',
		set_position_topic: '38-0-targetValue',
		position_template: '{{ (value_json.value / 99 * 100) | round(0) }}',
		position_open: 99,
		position_closed: 0,
		payload_open: '99',
		payload_close: '0',
	},
}

const AEROPAC: HassDevice = {
	type: 'fan',
	object_id: 'dimmer',
	values: ['38-0-currentValue', '38-0-targetValue'],
	discovery_payload: {
		command_topic: '38-0-targetValue',
		state_topic: '38-0-currentValue',
		preset_mode_command_topic: '38-0-targetValue',
		preset_mode_state_topic: '38-0-currentValue',
		percentage_command_topic: '38-0-targetValue',
		percentage_state_topic: '38-0-currentValue',
		preset_modes: [
			'off',
			'silent',
			'very low',
			'low',
			'medium',
			'high',
			'very high',
			'turbo',
		],
		speed_range_min: 1,
		speed_range_max: 7,
		percentage_value_template:
			'{{ {0:0, 16: 1, 32: 2, 48: 3, 64: 4, 80: 5, 96: 6, 99: 7}[value_json.value] }}',
		percentage_command_template:
			'{{ {0:0, 1: 16, 2: 32, 3: 48, 4: 64, 5: 80, 6: 96, 7: 99}[value] }}',
		state_value_template: '{{ OFF if value_json.value == 0 else ON }}',
		preset_mode_command_template:
			"{{ {'off': 0, 'silent': 16, 'very low': 32, 'low':48, 'medium': 64, 'high': 80, 'very high': 96, 'turbo': 99}[value] }}",
		preset_mode_value_template:
			"{{ {0:'off', 16: 'silent', 32: 'very low', 48: 'low', 64: 'medium', 80: 'high', 96: 'very high', 99: 'turbo'}[value_json.value] }}",
	},
}

const devices: { [deviceId: string]: HassDevice[] } = {
	'89-3-1': [
		{
			type: 'climate',
			object_id: 'HRT4-ZW',
			values: ['49-0-Air temperature', '67-0-setpoint-1'],
			mode_map: {
				off: 0,
				heat: 1,
			},
			setpoint_topic: { 1: '67-0-setpoint-1' },
			default_setpoint: '67-0-setpoint-1',
			discovery_payload: {
				min_temp: 5,
				max_temp: 30,
				modes: ['off', 'heat'],
				current_temperature_topic: '49-0-Air temperature',
				current_temperature_template: '{{ value_json.value }}',
				temperature_state_template: '{{ value_json.value }}',
				temperature_command_topic: true,
			},
		},
	],
	'411-1-1': [
		// Heatit Thermostat TF 021 (ThermoFloor AS)
		{
			type: 'climate',
			object_id: 'thermostat',
			values: [
				'64-0-mode',
				'49-0-Air temperature',
				'67-0-setpoint-1',
				'67-0-setpoint-2',
			],
			mode_map: { off: 0, heat: 1, cool: 2 },
			setpoint_topic: {
				1: '67-0-setpoint-1',
				2: '67-0-setpoint-2',
			},
			default_setpoint: '67-0-setpoint-1',
			discovery_payload: {
				min_temp: 15,
				max_temp: 30,
				modes: ['off', 'heat', 'cool'],
				mode_state_topic: '64-0-mode',
				mode_command_topic: true,
				current_temperature_topic: '49-0-Air temperature',
				current_temperature_template: '{{ value_json.value }}',
				temperature_state_template: '{{ value_json.value }}',
				temperature_command_topic: true,
			},
		},
	],
	'798-1-5': [
		// Inovelli LZW42 Multi-Color Bulb
		{
			type: 'light',
			object_id: 'rgbw_bulb',
			values: [
				'38-0-currentValue',
				'38-0-targetValue',
				'51-0-currentColor',
				'51-0-targetColor',
			],
			discovery_payload: {
				state_topic: '38-0-currentValue',
				command_topic: '38-0-targetValue',
				on_command_type: 'brightness',
				brightness_state_topic: '38-0-currentValue',
				brightness_command_topic: '38-0-targetValue',
				state_value_template:
					'{{ "on" if value_json.value|int > 0 else "0" }}',
				brightness_value_template:
					'{{ (value_json.value|int) | round(0) }}',
				brightness_scale: '99',
				color_temp_state_topic: '51-0-currentColor',
				color_temp_command_template:
					"{{ {'warmWhite': ((0.7349 * (value - 153))|round(0)), 'coldWhite': (255 - (0.7349 * (value - 153))|round(0)), 'red': 255, 'green': 255, 'blue': 255}|to_json }}",
				color_temp_command_topic: '51-0-targetColor',
				color_temp_value_template:
					"{{ '%03d%03d' | format((value_json.value.warmWhite), (value_json.value.coldWhite)) }}",
				rgb_command_template:
					"{{ {'warmWhite': 0, 'coldWhite': 0, 'red': red, 'green': green, 'blue': blue}|to_json }}",
				rgb_command_topic: '51-0-targetColor',
				rgb_state_topic: '51-0-currentColor',
				rgb_value_template:
					'{{ value_json.value.red }},{{ value_json.value.green }},{{ value_json.value.blue }}',
				min_mireds: 153,
				max_mireds: 500,
				payload_on: 'on',
				payload_off: '0',
			},
		},
	],
	'5-1619-20549': [
		// Intermatic PE653 MultiWave Receiver
		{
			type: 'climate',
			object_id: 'pool_thermostat',
			values: ['49-0-Air temperature', '67-0-setpoint-1'],
			default_setpoint: '67-0-setpoint-1',
			discovery_payload: {
				min_temp: 40,
				max_temp: 104,
				modes: ['heat'],
				temperature_unit: 'F',
				current_temperature_topic: '49-0-Air temperature',
				current_temperature_template: '{{ value_json.value }}',
				temperature_command_topic: true,
				temperature_state_template: '{{ value_json.value }}',
			},
		},
		{
			type: 'climate',
			object_id: 'spa_thermostat',
			values: ['49-0-Air temperature', '67-0-Furnace'],
			default_setpoint: '67-0-Furnace',
			discovery_payload: {
				min_temp: 40,
				max_temp: 104,
				modes: ['heat'],
				temperature_unit: 'F',
				current_temperature_topic: '49-0-Air temperature',
				current_temperature_template: '{{ value_json.value }}',
				temperature_command_topic: true,
				temperature_state_template: '{{ value_json.value }}',
			},
		},
		{
			type: 'switch',
			object_id: 'circuit_1',
			values: ['37-1-currentValue', '37-1-targetValue'],
			discovery_payload: {
				payload_off: false,
				payload_on: true,
				state_topic: '37-1-currentValue',
				command_topic: '37-1-targetValue',
				value_template: '{{ value_json.value }}',
			},
		},
		{
			type: 'switch',
			object_id: 'circuit_2',
			values: ['37-2-currentValue', '37-2-targetValue'],
			discovery_payload: {
				payload_off: false,
				payload_on: true,
				state_topic: '37-2-currentValue',
				command_topic: '37-2-targetValue',
				value_template: '{{ value_json.value }}',
			},
		},
		{
			type: 'switch',
			object_id: 'circuit_3',
			values: ['37-3-currentValue', '37-3-targetValue'],
			discovery_payload: {
				payload_off: false,
				payload_on: true,
				state_topic: '37-3-currentValue',
				command_topic: '37-3-targetValue',
				value_template: '{{ value_json.value }}',
			},
		},
		{
			type: 'switch',
			object_id: 'circuit_4',
			values: ['37-4-currentValue', '37-4-targetValue'],
			discovery_payload: {
				payload_off: false,
				payload_on: true,
				state_topic: '37-1-currentValue',
				command_topic: '37-4-targetValue',
				value_template: '{{ value_json.value }}',
			},
		},
		{
			type: 'switch',
			object_id: 'circuit_5',
			values: ['37-5-currentValue', '37-5-targetValue'],
			discovery_payload: {
				payload_off: false,
				payload_on: true,
				state_topic: '37-5-currentValue',
				command_topic: '37-5-targetValue',
				value_template: '{{ value_json.value }}',
			},
		},
	],
	'57-12593-18756': [FAN_DIMMER], // Honeywell 39358 In-Wall Fan Control
	'99-12340-18756': [FAN_DIMMER], // GE 1724 Dimmer
	'99-12593-18756': [FAN_DIMMER], // GE 1724 Dimmer
	'99-12600-18756': [FAN_DIMMER], // GE 14314 Dimmer (Older variant)
	'99-12850-18756': [FAN_DIMMER], // GE 14314 Dimmer (Newer variant coming with FW 5.22)
	'152-12-25857': [THERMOSTAT_2GIG], // Radio Thermostat / 2GIG CT101
	'152-263-25601': [THERMOSTAT_2GIG], // Radio Thermostat / 2GIG CT100
	'152-256-8194': [THERMOSTAT_2GIG], // Radio Thermostat / 2GIG CT32
	'271-4096-770': [COVER], // Fibaro FGS222
	'328-1-1': [STELLA_ZWAVE],
	'328-1-3': [SPIRIT_ZWAVE_PLUS],
	'328-2-3': [SPIRIT_ZWAVE_PLUS],
	'328-3-3': [SPIRIT_ZWAVE_PLUS],
	'345-82-3': [COVER], // Qubino flush shutter
	'622-23089-17235': [COVER], // Graber/Bali/Spring Fashion Covers
	'881-21-2': [SPIRIT_ZWAVE_PLUS], // Eurotronic Spirit / Aeotec ZWA021
	'129-1-20': [AEROPAC], //Siegenia Aeropac
	'2-32784-3': [THERMOSTAT_DANFOSS], // Danfoss Room Thermostat (MT2649 / DRS21) https://products.z-wavealliance.org/products/1062
}

export default devices
