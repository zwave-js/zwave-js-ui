// @ts-check
// Notification-based safety devices: motion, smoke, water leak, CO.
// Notification type IDs follow the Z-Wave spec:
//   1 = Smoke alarm, 2 = CO alarm, 5 = Water alarm,
//   6 = Access Control, 7 = Home Security
const { CommandClasses } = require('@zwave-js/core')
const { ccCaps } = require('@zwave-js/testing')

/** @type {import('zwave-js/Testing').MockServerOptions['config']} */
module.exports.default = {
	nodes: [
		// PIR motion + tamper + glass break
		{
			id: 13,
			capabilities: {
				genericDeviceClass: 0x07,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Hallway Motion',
						location: 'Hallway',
					}),
					ccCaps({
						ccId: CommandClasses.Notification,
						version: 8,
						supportsV1Alarm: false,
						notificationTypesAndEvents: {
							7: [3, 8],
						},
					}),
					CommandClasses.Battery,
				],
			},
		},
		// Smoke alarm
		{
			id: 14,
			capabilities: {
				genericDeviceClass: 0x07,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Kitchen Smoke',
						location: 'Kitchen',
					}),
					ccCaps({
						ccId: CommandClasses.Notification,
						version: 8,
						supportsV1Alarm: false,
						notificationTypesAndEvents: {
							1: [1, 2, 3, 4],
						},
					}),
					CommandClasses.Battery,
				],
			},
		},
		// Water leak sensor
		{
			id: 15,
			capabilities: {
				genericDeviceClass: 0x07,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Basement Leak',
						location: 'Basement',
					}),
					ccCaps({
						ccId: CommandClasses.Notification,
						version: 8,
						supportsV1Alarm: false,
						notificationTypesAndEvents: {
							5: [2, 3, 4],
						},
					}),
					CommandClasses.Battery,
				],
			},
		},
		// CO alarm
		{
			id: 16,
			capabilities: {
				genericDeviceClass: 0x07,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Garage CO',
						location: 'Garage',
					}),
					ccCaps({
						ccId: CommandClasses.Notification,
						version: 8,
						supportsV1Alarm: false,
						notificationTypesAndEvents: {
							2: [1, 2, 3],
						},
					}),
					CommandClasses.Battery,
				],
			},
		},
	],
}
