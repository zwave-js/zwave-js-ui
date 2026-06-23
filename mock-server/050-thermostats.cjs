// @ts-check
// HVAC: a heating-only thermostat and a full HVAC thermostat with humidity.
const { CommandClasses } = require('@zwave-js/core')
const { ccCaps } = require('@zwave-js/testing')
const { ThermostatMode, ThermostatSetpointType } = require('zwave-js')

/** @type {import('zwave-js/Testing').MockServerOptions['config']} */
module.exports.default = {
	nodes: [
		// Heating-only thermostat (e.g. radiator valve)
		{
			id: 19,
			capabilities: {
				genericDeviceClass: 0x08,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Bedroom Radiator',
						location: 'Bedroom',
					}),
					ccCaps({
						ccId: CommandClasses['Thermostat Mode'],
						version: 3,
						supportedModes: [
							ThermostatMode.Off,
							ThermostatMode.Heat,
						],
					}),
					ccCaps({
						ccId: CommandClasses['Thermostat Setpoint'],
						version: 3,
						setpoints: {
							[ThermostatSetpointType.Heating]: {
								minValue: 5,
								maxValue: 30,
								defaultValue: 21,
								scale: '°C',
							},
						},
					}),
					CommandClasses.Battery,
				],
			},
		},
		// Full HVAC thermostat (heat + cool + auto + fan)
		{
			id: 20,
			capabilities: {
				genericDeviceClass: 0x08,
				specificDeviceClass: 0x06,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Living Room HVAC',
						location: 'Living Room',
					}),
					ccCaps({
						ccId: CommandClasses['Thermostat Mode'],
						version: 3,
						supportedModes: [
							ThermostatMode.Off,
							ThermostatMode.Heat,
							ThermostatMode.Cool,
							ThermostatMode.Auto,
							ThermostatMode.Fan,
						],
					}),
					ccCaps({
						ccId: CommandClasses['Thermostat Setpoint'],
						version: 3,
						setpoints: {
							[ThermostatSetpointType.Heating]: {
								minValue: 10,
								maxValue: 30,
								defaultValue: 21,
								scale: '°C',
							},
							[ThermostatSetpointType.Cooling]: {
								minValue: 18,
								maxValue: 28,
								defaultValue: 24,
								scale: '°C',
							},
						},
					}),
					ccCaps({
						ccId: CommandClasses['Multilevel Sensor'],
						version: 11,
						sensors: {
							1: { supportedScales: [0] },
							5: { supportedScales: [1] },
						},
					}),
				],
			},
		},
	],
}
