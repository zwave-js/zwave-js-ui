import { describe, it, expect } from 'vitest'

import * as mod from '../../api/lib/Constants.ts'

describe('#Constants', () => {
	describe('#productionType()', () => {
		it('known', () =>
			expect(mod.productionType(1)).to.deep.equal({
				objectId: 'total',
				props: { device_class: 'power' },
				sensor: 'energy_production',
			}))
		it('unknown', () =>
			expect(mod.productionType(4)).to.deep.equal({
				objectId: 'unknown',
				props: { device_class: 'power' },
				sensor: 'energy_production',
			}))
		it('timestamp', () =>
			expect(mod.productionType(3)).to.deep.equal({
				objectId: 'time',
				props: { device_class: 'timestamp' },
				sensor: 'energy_production',
			}))
	})
	describe('#sensorType()', () => {
		it('known', () =>
			expect(mod.sensorType(1)).to.deep.equal({
				sensor: 'temperature',
				objectId: 'air',
				props: {
					device_class: 'temperature',
					state_class: 'measurement',
				},
			}))
		it('no props', () =>
			expect(mod.sensorType(2)).to.deep.equal({
				sensor: 'generic',
				objectId: 'general_purpose',
				props: {},
			}))
		it('unknown', () =>
			expect(mod.sensorType(90)).to.deep.equal({
				sensor: 'generic',
				objectId: 'unknown_90',
				props: {},
			}))
	})
	describe('#meterType()', () => {
		it('electric kWh → energy', () => {
			const result = mod.meterType({ meterType: 0x01, scale: 0x00 })
			expect(result.props).to.deep.equal({
				state_class: 'total_increasing',
				device_class: 'energy',
			})
		})
		it('electric W → power', () => {
			const result = mod.meterType({ meterType: 0x01, scale: 0x02 })
			expect(result.props).to.deep.equal({
				state_class: 'measurement',
				device_class: 'power',
			})
		})
		it('electric kVar → reactive_power', () => {
			const result = mod.meterType({ meterType: 0x01, scale: 0x07 })
			expect(result.props).to.deep.equal({
				state_class: 'measurement',
				device_class: 'reactive_power',
			})
		})
		it('electric Power Factor → power_factor', () => {
			const result = mod.meterType({ meterType: 0x01, scale: 0x06 })
			expect(result.props).to.deep.equal({
				state_class: 'measurement',
				device_class: 'power_factor',
				unit_of_measurement: null,
			})
		})
	})
	describe('#deviceClass', () => {
		it('sensor REACTIVE_POWER equals reactive_power', () =>
			expect(mod.deviceClass.sensor.REACTIVE_POWER).to.equal(
				'reactive_power',
			))
		it('sensor APPARENT_POWER equals apparent_power', () =>
			expect(mod.deviceClass.sensor.APPARENT_POWER).to.equal(
				'apparent_power',
			))
		it('sensor CARBON_DIOXIDE equals carbon_dioxide', () =>
			expect(mod.deviceClass.sensor.CARBON_DIOXIDE).to.equal(
				'carbon_dioxide',
			))
		it('existing POWER constant still present', () =>
			expect(mod.deviceClass.sensor.POWER).to.equal('power'))
	})
	describe('#commandClass()', () => {
		it('known', () => expect(mod.commandClass(0)).to.equal('no_operation'))
		it('unknown', () =>
			expect(mod.commandClass(-1)).to.equal('unknownClass_-1'))
		it('legacy name wins over the zwave-js one', () =>
			expect(mod.commandClass(0x26)).to.equal('switch_multilevel'))
		it('falls back to zwave-js for CCs not in the legacy map', () =>
			expect(mod.commandClass(0x6a)).to.equal('window_covering'))
		it('normalizes punctuation in zwave-js names', () =>
			expect(mod.commandClass(0x9f)).to.equal('security_2'))

		// Every name the hardcoded map returned before it was reduced to the
		// entries that actually differ from zwave-js. These end up in MQTT
		// topics, so a change here breaks users' subscriptions: if zwave-js
		// renames a command class, add it back to `_commandClassMap` instead
		// of updating this fixture.
		const LEGACY_NAMES = {
			0x00: 'no_operation',
			0x20: 'basic',
			0x21: 'controller_replication',
			0x22: 'application_status',
			0x23: 'zip_services',
			0x24: 'zip_server',
			0x25: 'switch_binary',
			0x26: 'switch_multilevel',
			0x27: 'switch_all',
			0x28: 'switch_toggle_binary',
			0x29: 'switch_toggle_multilevel',
			0x2a: 'chimney_fan',
			0x2b: 'scene_activation',
			0x2c: 'scene_actuator_conf',
			0x2d: 'scene_controller_conf',
			0x2e: 'zip_client',
			0x2f: 'zip_adv_services',
			0x30: 'sensor_binary',
			0x31: 'sensor_multilevel',
			0x32: 'meter',
			0x33: 'color',
			0x34: 'zip_adv_client',
			0x35: 'meter_pulse',
			0x3c: 'meter_tbl_config',
			0x3d: 'meter_tbl_monitor',
			0x3e: 'meter_tbl_pulse',
			0x38: 'thermostat_heating',
			0x40: 'thermostat_mode',
			0x42: 'thermostat_operating_state',
			0x43: 'thermostat_setpoint',
			0x44: 'thermostat_fan_mode',
			0x45: 'thermostat_fan_state',
			0x46: 'climate_control_schedule',
			0x47: 'thermostat_setback',
			0x4c: 'door_lock_logging',
			0x4e: 'schedule_entry_lock',
			0x50: 'basic_window_covering',
			0x51: 'mtp_window_covering',
			0x56: 'crc16_encap',
			0x5a: 'device_reset_locally',
			0x5b: 'central_scene',
			0x5e: 'zwave_plus_info',
			0x5d: 'antitheft',
			0x60: 'multi_instance',
			0x62: 'door_lock',
			0x63: 'user_code',
			0x66: 'barrier_operator',
			0x70: 'configuration',
			0x71: 'notification',
			0x72: 'manufacturer_specific',
			0x73: 'powerlevel',
			0x75: 'protection',
			0x76: 'lock',
			0x77: 'node_naming',
			0x79: 'sound_switch',
			0x7a: 'firmware_update_md',
			0x7b: 'grouping_name',
			0x7c: 'remote_association_activate',
			0x7d: 'remote_association',
			0x80: 'battery',
			0x81: 'clock',
			0x82: 'hail',
			0x84: 'wake_up',
			0x85: 'association',
			0x86: 'version',
			0x87: 'indicator',
			0x88: 'proprietary',
			0x89: 'language',
			0x8a: 'time',
			0x8b: 'time_parameters',
			0x8c: 'geographic_location',
			0x8d: 'composite',
			0x8e: 'multi_instance_association',
			0x8f: 'multi_cmd',
			0x90: 'energy_production',
			0x91: 'manufacturer_proprietary',
			0x92: 'screen_md',
			0x93: 'screen_attributes',
			0x94: 'simple_av_control',
			0x95: 'av_content_directory_md',
			0x96: 'av_renderer_status',
			0x97: 'av_content_search_md',
			0x98: 'security',
			0x99: 'av_tagging_md',
			0x9a: 'ip_configuration',
			0x9b: 'association_command_configuration',
			0x9c: 'sensor_alarm',
			0x9d: 'silence_alarm',
			0x9e: 'sensor_configuration',
			0xef: 'mark',
			0xf0: 'non_interoperable',
		}
		for (const [cc, name] of Object.entries(LEGACY_NAMES)) {
			it(`0x${Number(cc).toString(16).padStart(2, '0')} is still ${name}`, () =>
				expect(mod.commandClass(Number(cc))).to.equal(name))
		}
	})
	describe('#genericDeviceClass()', () => {
		it('known generic type', () =>
			expect(mod.genericDeviceClass(1)).to.equal(
				'generic_type_generic_controller',
			))
		it('unknown generic type', () =>
			expect(mod.genericDeviceClass(-1)).to.equal(
				'unknownGenericDeviceType_-1',
			))
	})
	describe('#specificDeviceClass()', () => {
		it('known specific type', () =>
			expect(mod.specificDeviceClass(1, 1)).to.equal(
				'specific_type_portable_controller',
			))
		it('unknown specific type', () =>
			expect(mod.specificDeviceClass(1, 8)).to.equal(
				'unknownSpecificDeviceType_8',
			))
		it('unknown generic type 260', () =>
			expect(mod.specificDeviceClass(260, 1)).to.equal(
				'unknownGenericDeviceType_260',
			))
	})
})
