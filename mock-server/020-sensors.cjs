// @ts-check
// Battery-powered sensors: door/window contact, temp/humidity, illuminance.
const { CommandClasses } = require('@zwave-js/core')
const { ccCaps } = require('@zwave-js/testing')

/** @type {import('zwave-js/Testing').MockServerOptions['config']} */
module.exports.default = {
	nodes: [
		// Door / window contact (binary sensor)
		{
			id: 10,
			capabilities: {
				genericDeviceClass: 0x20,
				specificDeviceClass: 0x06,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Front Door Contact',
						location: 'Entrance',
					}),
					ccCaps({
						ccId: CommandClasses['Binary Sensor'],
						version: 2,
						supportedSensorTypes: [10],
					}),
					CommandClasses.Battery,
				],
			},
		},
		// Temperature & humidity sensor (multilevel)
		{
			id: 11,
			capabilities: {
				genericDeviceClass: 0x21,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Bedroom Climate',
						location: 'Bedroom',
					}),
					ccCaps({
						ccId: CommandClasses['Multilevel Sensor'],
						version: 11,
						sensors: {
							1: { supportedScales: [0] },
							5: { supportedScales: [1] },
						},
					}),
					CommandClasses.Battery,
				],
			},
		},
		// Multi-sensor: temperature + illuminance (motion handled via Notification CC on node 13)
		{
			id: 12,
			capabilities: {
				genericDeviceClass: 0x21,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Outdoor Weather',
						location: 'Garden',
					}),
					ccCaps({
						ccId: CommandClasses['Multilevel Sensor'],
						version: 11,
						sensors: {
							1: { supportedScales: [0] },
							3: { supportedScales: [1] },
							27: { supportedScales: [0] },
						},
					}),
					CommandClasses.Battery,
				],
			},
		},
	],
}
