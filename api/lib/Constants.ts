import { getCCName, getMeter, getMeterScale } from '@zwave-js/core'
import { join } from 'node:path'
import { storeDir } from '../config/app.ts'

interface IGenericMap {
	[key: number]: string
}

interface IHassClass {
	[type: string]: {
		[type: string]: string
	}
}

interface ISensorType {
	sensor: string
	objectId: string
	props: ISensorProps
}

interface ISensorProps {
	state_class?: string
	device_class?: string
	unit_of_measurement?: string
	icon?: string
}

interface ISensorMap {
	[type: string]: IGenericMap & {
		props?: ISensorProps
	}
}

interface IDeviceClassProps {
	generic: string
	specific: IGenericMap
}

interface IDeviceClass {
	[genericClass: number]: IDeviceClassProps
}

export interface IMeterCCSpecific {
	scale: number
	meterType: number
}

export const deviceConfigPriorityDir = join(storeDir, 'config')

// https://github.com/OpenZWave/open-zwave/blob/0d94c9427bbd19e47457578bccc60b16c6679b49/config/Localization.xml#L606
const _productionMap: IGenericMap = {
	0: 'instant',
	1: 'total',
	2: 'today',
	3: 'time',
}
export const deviceClass: IHassClass = {
	sensor_binary: {
		BATTERY: 'battery',
		COLD: 'cold',
		CONNECTIVITY: 'connectivity',
		DOOR: 'door',
		GARAGE_DOOR: 'garage_door',
		GAS: 'gas',
		HEAT: 'heat',
		LIGHT: 'light',
		LOCK: 'lock',
		MOISTURE: 'moisture',
		MOTION: 'motion',
		MOVING: 'moving',
		OCCUPANCY: 'occupancy',
		OPENING: 'opening',
		PLUG: 'plug',
		POWER: 'power',
		PRESENCE: 'presence',
		PROBLEM: 'problem',
		SAFETY: 'safety',
		SMOKE: 'smoke',
		SOUND: 'sound',
		VIBRATION: 'vibration',
		WINDOW: 'window',
	},
	sensor: {
		APPARENT_POWER: 'apparent_power',
		AQI: 'aqi',
		ATMOSPHERIC_PRESSURE: 'atmospheric_pressure',
		BATTERY: 'battery',
		CARBON_DIOXIDE: 'carbon_dioxide',
		CARBON_MONOXIDE: 'carbon_monoxide',
		CURRENT: 'current',
		DISTANCE: 'distance',
		ENERGY: 'energy',
		FREQUENCY: 'frequency',
		GAS: 'gas',
		HUMIDITY: 'humidity',
		ILLUMINANCE: 'illuminance',
		IRRADIANCE: 'irradiance',
		MOISTURE: 'moisture',
		NITROGEN_DIOXIDE: 'nitrogen_dioxide',
		NITROGEN_MONOXIDE: 'nitrogen_monoxide',
		NITROUS_OXIDE: 'nitrous_oxide',
		OZONE: 'ozone',
		PM1: 'pm1',
		PM10: 'pm10',
		PM25: 'pm25',
		POWER: 'power',
		POWER_FACTOR: 'power_factor',
		PRESSURE: 'pressure',
		REACTIVE_ENERGY: 'reactive_energy',
		REACTIVE_POWER: 'reactive_power',
		SIGNAL_STRENGTH: 'signal_strength',
		SOUND_PRESSURE: 'sound_pressure',
		SPEED: 'speed',
		SULPHUR_DIOXIDE: 'sulphur_dioxide',
		TEMPERATURE: 'temperature',
		TIMESTAMP: 'timestamp',
		VOLATILE_ORGANIC_COMPOUNDS: 'volatile_organic_compounds',
		VOLATILE_ORGANIC_COMPOUNDS_PARTS: 'volatile_organic_compounds_parts',
		VOLTAGE: 'voltage',
		VOLUME: 'volume',
		WATER: 'water',
		WEIGHT: 'weight',
		WIND_SPEED: 'wind_speed',
	},
	cover: {
		AWNING: 'awning',
		BLIND: 'blind',
		CURTAIN: 'curtain',
		DAMPER: 'damper',
		DOOR: 'door',
		GARAGE: 'garage',
		GATE: 'gate',
		SHADE: 'shade',
		SHUTTER: 'shutter',
		WINDOW: 'window',
	},
}

export function productionType(index: number): Record<string, any> {
	return {
		sensor: 'energy_production',
		objectId: _productionMap[index] || 'unknown',
		props: {
			device_class: index === 3 ? 'timestamp' : 'power',
		},
	}
}
export function meterType(ccSpecific: IMeterCCSpecific): any {
	const meter = getMeter(ccSpecific.meterType)
	const scale = getMeterScale(ccSpecific.meterType, ccSpecific.scale)

	const cfg = {
		sensor: meter?.name || 'unknown',
		objectId: scale?.label || `unknown${ccSpecific.scale}`,
		props: {},
	}

	// https://github.com/zwave-js/node-zwave-js/blob/master/packages/config/config/meters.json
	switch (ccSpecific.meterType) {
		case 0x01: // electric
			switch (ccSpecific.scale) {
				case 0x00: // kWh
					cfg.props = {
						state_class: 'total_increasing',
						device_class: 'energy',
					}
					break
				case 0x02: // W
					cfg.props = {
						state_class: 'measurement',
						device_class: 'power',
					}
					break
				case 0x04: // V
					cfg.props = {
						state_class: 'measurement',
						device_class: 'voltage',
					}
					break
				case 0x05: // A
					cfg.props = {
						state_class: 'measurement',
						device_class: 'current',
					}
					break
				case 0x06: // Power factor
					cfg.props = {
						state_class: 'measurement',
						device_class: 'power_factor',
						unit_of_measurement: null, // https://github.com/home-assistant/core/blob/00627b82e0f791c01146f49c9e12e878395366f4/homeassistant/components/sensor/const.py#L314-L318
					}
					break
				case 0x07: // kVar (reactive power)
					cfg.props = {
						state_class: 'measurement',
						device_class: 'reactive_power',
					}
					break
				case 0x08: // kVarh (reactive energy)
					cfg.props = {
						state_class: 'total_increasing',
						device_class: 'reactive_energy',
					}
					break
				default:
					cfg.props = {
						device_class: 'power',
					}
					break
			}
			break
		case 0x02: // gas
			cfg.props = {
				icon: 'mdi:thought-bubble',
				device_class: 'gas',
			}
			break
		case 0x03: // water
			cfg.props = {
				icon: 'mdi:water',
			}
			break
		case 0x04: // heating
			cfg.props = {
				icon: 'mdi:fire',
			}
			break
		case 0x05: // cooling
			cfg.props = {
				icon: 'mdi:snowflake',
			}
			break
	}

	return cfg
}
export const _sensorMap: ISensorMap = {
	temperature: {
		1: 'air',
		11: 'dew_point',
		23: 'water',
		24: 'soil',
		34: 'target',
		62: 'boiler_water',
		63: 'domestic_hot_water',
		64: 'outside',
		65: 'exhaust',
		72: 'return_air',
		73: 'supply_air',
		74: 'condenser_coil',
		75: 'evaporator_coil',
		76: 'liquid_line',
		77: 'discharge_line',
		80: 'defrost',
		props: {
			state_class: 'measurement',
			device_class: 'temperature',
		},
	},
	illuminance: {
		3: '', // illuminance
		props: {
			state_class: 'measurement',
			device_class: 'illuminance',
			unit_of_measurement: 'lx',
		},
	},
	power: {
		4: 'power',
		props: {
			state_class: 'measurement',
			device_class: 'power',
		},
	},
	voltage: {
		15: 'voltage',
		props: {
			state_class: 'measurement',
			device_class: 'voltage',
		},
	},
	current: {
		16: 'current',
		props: {
			state_class: 'measurement',
			device_class: 'current',
		},
	},
	electricity: {
		28: 'resistivity',
		29: 'conductivity',
		props: {
			state_class: 'measurement',
			device_class: 'power',
		},
	},
	humidity: {
		5: 'air', // humidity
		41: 'soil',
		props: {
			state_class: 'measurement',
			device_class: 'humidity',
		},
	},
	speed: {
		6: 'velocity', // ?
		52: 'x_acceleration',
		53: 'y_acceleration',
		54: 'z_acceleration',
		props: {
			icon: 'mdi:speedometer',
		},
	},
	direction: {
		7: '', // direction
		21: 'angle_position', // ?
		props: {
			icon: 'mdi:compass',
		},
	},
	pressure: {
		8: 'atmospheric',
		9: 'barometric',
		57: 'water',
		props: {
			state_class: 'measurement',
			device_class: 'pressure',
		},
	},
	sun: {
		10: 'solar_radiation',
		27: 'ultraviolet',
		props: {
			icon: 'mdi:white-balance-sunny',
		},
	},
	water: {
		12: 'rain_rate',
		13: 'tide_level',
		19: 'tank_capacity',
		56: 'flow',
		props: {
			icon: 'mdi:water',
		},
	},
	weight: {
		14: '', // weight
		46: 'muscle_mass',
		47: 'bone_mass',
		48: 'fat_mass',
		49: 'total_body_water',
		51: 'body_mass_index',
		66: 'water_chlorine',
		67: 'water_acidity',
		68: 'water_oxidation_potential',
		props: {
			icon: 'mdi:weight',
		},
	},
	gas: {
		17: 'carbon_dioxide',
		40: 'carbon_monoxide',
		55: 'smoke_density',
		props: {
			icon: 'mdi:thought-bubble',
		},
	},
	air: {
		18: 'flow',
		props: {
			icon: 'mdi:air-filter',
		},
	},
	frequency: {
		22: 'rotation',
		32: '',
		props: {},
	},
	sound: {
		30: 'loudness',
		props: {
			icon: 'mdi:volume-high',
		},
	},
	signal: {
		58: 'strength',
		props: {
			state_class: 'measurement',
			device_class: 'signal_strength',
		},
	},
	timestamp: {
		33: '', // time,
		props: {
			device_class: 'timestamp',
		},
	},
	heart: {
		44: 'rate',
		45: 'blood_pressure',
		50: 'basic_metabolic_rate',
		60: 'respiratory_rate',
		69: 'lf_lh_ratio',
		props: {
			icon: 'mdi:heart',
		},
	},
	generic: {
		2: 'general_purpose',
		20: 'distance',
		25: 'seismic_intensity',
		26: 'seismic_magnitude',
		31: 'moisture',
		35: 'particulate_matter_25',
		36: 'formaldehyde',
		37: 'radon_concentration',
		38: 'methane_density',
		39: 'volatile_organic_compound',
		42: 'soil_reactivity',
		43: 'soil_salinity',
		59: 'particulate_matter',
		61: 'relative_modulation',
		70: 'motion_direction',
		71: 'applied_force',
		78: 'suction',
		79: 'discharge',
		81: 'ozone',
		82: 'sulfur_dioxide',
		83: 'nitrogen_dioxide',
		84: 'ammonia',
		85: 'lead',
		86: 'particulate_matter',
	},
}
export function sensorType(index: number): ISensorType {
	const sensorType = {
		sensor: 'generic',
		objectId: 'unknown_' + index,
		props: {},
	}

	for (const sensor in _sensorMap) {
		const objectId = _sensorMap[sensor][index]
		if (objectId !== undefined) {
			sensorType.sensor = sensor
			sensorType.objectId = objectId
			sensorType.props = _sensorMap[sensor].props || {}
			break
		}
	}

	return sensorType
}
// Only the command classes whose legacy (OpenZWave) name differs from the
// zwave-js one. Renaming these would break existing MQTT topics, so they win
// over `getCCName()`. Every other CC is resolved by `commandClass()` below.
const _commandClassMap = {
	0x23: 'zip_services',
	0x24: 'zip_server',
	0x25: 'switch_binary',
	0x26: 'switch_multilevel',
	0x27: 'switch_all',
	0x28: 'switch_toggle_binary',
	0x29: 'switch_toggle_multilevel',
	0x2a: 'chimney_fan',
	0x2c: 'scene_actuator_conf',
	0x2d: 'scene_controller_conf',
	0x2e: 'zip_client',
	0x2f: 'zip_adv_services',
	0x30: 'sensor_binary',
	0x31: 'sensor_multilevel',
	0x33: 'color',
	0x34: 'zip_adv_client',
	0x35: 'meter_pulse',
	0x3c: 'meter_tbl_config',
	0x3d: 'meter_tbl_monitor',
	0x3e: 'meter_tbl_pulse',
	0x38: 'thermostat_heating',
	0x51: 'mtp_window_covering',
	0x56: 'crc16_encap',
	0x5e: 'zwave_plus_info',
	0x5d: 'antitheft',
	0x60: 'multi_instance',
	0x77: 'node_naming',
	0x7a: 'firmware_update_md',
	0x7c: 'remote_association_activate',
	0x7d: 'remote_association',
	0x8d: 'composite',
	0x8e: 'multi_instance_association',
	0x8f: 'multi_cmd',
	0x92: 'screen_md',
	0x95: 'av_content_directory_md',
	0x96: 'av_renderer_status',
	0x97: 'av_content_search_md',
	0x99: 'av_tagging_md',
	0x9c: 'sensor_alarm',
	0x9d: 'silence_alarm',
	0xef: 'mark',
	0xf0: 'non_interoperable',
}
export function commandClass(cmd: number): string {
	if (_commandClassMap[cmd]) return _commandClassMap[cmd]

	const name = getCCName(cmd)
	// getCCName returns `unknown (0x24)` for CCs it doesn't know
	if (name.startsWith('unknown')) return `unknownClass_${cmd}`

	return name
		.replace(/[^A-Za-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.toLowerCase()
}
const _genericDeviceClassMap: IDeviceClass = {
	// https://github.com/OpenZWave/open-zwave/blob/master/config/device_classes.xml
	// https://github.com/home-assistant/core/blob/dev/homeassistant/components/zwave/const.py#L196
	// 0x00: specific_type_not_used // Available in all Generic types
	0x01: {
		generic: 'generic_type_generic_controller',
		specific: {
			0x01: 'specific_type_portable_controller',
			0x02: 'specific_type_portable_scene_controller',
			0x03: 'specific_type_portable_installer_tool',
			0x04: 'specific_type_control_av',
			0x06: 'specific_type_control_simple',
		},
	},
	0x02: {
		generic: 'generic_type_static_controller',
		specific: {
			0x01: 'specific_type_pc_controller',
			0x02: 'specific_type_scene_controller',
			0x03: 'specific_type_static_installer_tool',
			0x04: 'specific_type_set_top_box',
			0x05: 'specific_type_sub_system_controller',
			0x06: 'specific_type_tv',
			0x07: 'specific_type_gateway',
		},
	},
	0x03: {
		generic: 'generic_type_av_control_point',
		specific: {
			0x01: 'specific_type_sound_switch',
			0x04: 'specific_type_satellite_receiver',
			0x11: 'specific_type_satellite_receiver_v2',
			0x12: 'specific_type_doorbell',
		},
	},
	0x04: {
		generic: 'generic_type_display',
		specific: {
			0x01: 'specific_type_simple_display',
		},
	},
	0x05: {
		generic: 'generic_type_network_extender',
		specific: {
			0x01: 'specific_type_secure_extender',
		},
	},
	0x06: {
		generic: 'generic_type_appliance',
		specific: {
			0x01: 'specific_type_general_appliance',
			0x02: 'specific_type_kitchen_appliance',
			0x03: 'specific_type_laundry_appliance',
		},
	},
	0x07: {
		generic: 'generic_type_sensor_notification',
		specific: {
			0x01: 'specific_type_notification_sensor',
		},
	},
	0x08: {
		generic: 'generic_type_thermostat',
		specific: {
			0x01: 'specific_type_thermostat_heating',
			0x02: 'specific_type_thermostat_general',
			0x03: 'specific_type_setback_schedule_thermostat',
			0x04: 'specific_type_setpoint_thermostat',
			0x05: 'specific_type_setback_thermostat',
			0x06: 'specific_type_thermostat_general_v2',
		},
	},
	0x09: {
		generic: 'generic_type_windows_covering',
		specific: {
			0x01: 'specific_type_simple_window_covering',
		},
	},
	0x0f: {
		generic: 'generic_type_repeater_slave',
		specific: {
			0x01: 'specific_type_repeater_slave',
			0x02: 'specific_type_virtual_node',
		},
	},
	0x10: {
		generic: 'generic_type_switch_binary',
		specific: {
			0x01: 'specific_type_power_switch_binary',
			0x02: 'specific_type_color_tunable_binary',
			0x03: 'specific_type_scene_switch_binary',
			0x04: 'specific_type_power_strip',
			0x05: 'specific_type_siren',
			0x06: 'specific_type_valve_open_close',
			0x07: 'specific_type_irrigation_controller',
		},
	},
	0x11: {
		generic: 'generic_type_switch_multilevel',
		specific: {
			0x01: 'specific_type_power_switch_multilevel',
			0x02: 'specific_type_color_tunable_multilevel',
			0x03: 'specific_type_motor_multiposition',
			0x04: 'specific_type_scene_switch_multilevel',
			0x05: 'specific_type_class_a_motor_control',
			0x06: 'specific_type_class_b_motor_control',
			0x07: 'specific_type_class_c_motor_control',
			0x08: 'specific_type_fan_switch',
		},
	},
	0x12: {
		generic: 'generic_type_switch_remote',
		specific: {
			0x01: 'specific_type_remote_binary',
			0x02: 'specific_type_remote_multilevel',
			0x03: 'specific_type_remove_toggle_binary',
			0x04: 'specific_type_remote_toggle_multilevel',
		},
	},
	0x13: {
		generic: 'generic_type_switch_toggle',
		specific: {
			0x01: 'specific_type_switch_toggle_binary',
			0x02: 'specific_type_switch_toggle_multilevel',
		},
	},
	0x14: {
		generic: 'generic_type_zip_gateway',
		specific: {
			0x01: 'specific_type_zip_tun_gateway',
			0x02: 'specific_type_zip_adv_gateway',
		},
	},
	0x15: {
		generic: 'generic_type_zip_node',
		specific: {
			0x01: 'specific_type_zip_tun_node',
			0x02: 'specific_type_zip_adv_node',
		},
	},
	0x16: {
		generic: 'generic_type_ventilation',
		specific: {
			0x01: 'specific_type_residential_hrv',
		},
	},
	0x17: {
		generic: 'generic_type_security_panel',
		specific: {
			0x01: 'specific_type_zoned_security_panel',
		},
	},
	0x18: {
		generic: 'generic_type_wall_controller',
		specific: {
			0x01: 'specific_type_basic_wall_controller',
		},
	},
	0x20: {
		generic: 'generic_type_sensor_binary',
		specific: {
			0x01: 'specific_type_routing_sensor_binary',
		},
	},
	0x21: {
		generic: 'generic_type_sensor_multilevel',
		specific: {
			0x01: 'specific_type_routing_sensor_multilevel',
			0x02: 'specific_type_chimney_fan',
		},
	},
	0x30: {
		generic: 'generic_type_meter_pulse',
		specific: {},
	},
	0x31: {
		generic: 'generic_type_meter',
		specific: {
			0x01: 'specific_type_simple_meter',
			0x02: 'specific_type_adv_energy_control',
			0x03: 'specific_type_whole_home_meter_simple',
		},
	},
	0x40: {
		generic: 'generic_type_entry_control',
		specific: {
			0x01: 'specific_type_door_lock',
			0x02: 'specific_type_advanced_door_lock',
			0x03: 'specific_type_secure_keypad_door_lock',
			0x04: 'specific_type_secure_keypad_door_lock_deadbolt',
			0x05: 'specific_type_secure_door',
			0x06: 'specific_type_secure_gate',
			0x07: 'specific_type_secure_barrier_addon',
			0x08: 'specific_type_secure_barrier_open_only',
			0x09: 'specific_type_secure_barrier_close_only',
			0x0a: 'specific_type_secure_lockbox',
			0x0b: 'specific_type_secure_keypad',
		},
	},
	0x50: {
		generic: 'generic_type_semi_interoperable',
		specific: {
			0x01: 'specific_type_energy_production',
		},
	},
	0xa1: {
		generic: 'generic_type_sensor_alarm',
		specific: {
			0x01: 'specific_type_basic_routing_alarm_sensor',
			0x02: 'specific_type_routing_alarm_sensor',
			0x03: 'specific_type_basic_zensor_net_alarm_sensor',
			0x04: 'specific_type_zensor_net_alarm_sensor',
			0x05: 'specific_type_adv_zensor_net_alarm_sensor',
			0x06: 'specific_type_basic_routing_smoke_sensor',
			0x07: 'specific_type_routing_smoke_sensor',
			0x08: 'specific_type_basic_zensor_net_smoke_sensor',
			0x09: 'specific_type_zensor_net_smoke_sensor',
			0x0a: 'specific_type_adv_zensor_net_smoke_sensor',
			0x0b: 'specific_type_alarm_sensor',
		},
	},
	0xff: {
		generic: 'generic_type_non_interoperable',
		specific: {},
	},
}
export function genericDeviceClassAttributes(cls: number): IDeviceClassProps {
	return _genericDeviceClassMap[cls]
}
export function genericDeviceClass(cls: number): string {
	const clsAttr = genericDeviceClassAttributes(cls)
	if (clsAttr) {
		return clsAttr.generic
	} else {
		return 'unknownGenericDeviceType_' + cls
	}
}
export function specificDeviceClass(
	genericCls: number,
	specificCls: number,
): string {
	const clsAttr = genericDeviceClassAttributes(genericCls)
	if (clsAttr) {
		return (
			clsAttr.specific[specificCls] ||
			`unknownSpecificDeviceType_${specificCls}`
		)
	} else {
		return `unknownGenericDeviceType_${genericCls}`
	}
}
