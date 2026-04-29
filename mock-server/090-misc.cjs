// @ts-check
// Misc devices: siren (Sound Switch), status indicator, scene controller,
// and a configurable-parameters device for the Configuration UI.
const { CommandClasses } = require('@zwave-js/core')
const { ccCaps } = require('@zwave-js/testing')

/** @type {import('zwave-js/Testing').MockServerOptions['config']} */
module.exports.default = {
	nodes: [
		// Indoor siren — Sound Switch CC
		{
			id: 29,
			capabilities: {
				genericDeviceClass: 0x10,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Hallway Siren',
						location: 'Hallway',
					}),
					ccCaps({
						ccId: CommandClasses['Sound Switch'],
						version: 2,
						defaultToneId: 1,
						defaultVolume: 80,
						tones: [
							{ name: 'Burglar', duration: 30 },
							{ name: 'Fire', duration: 30 },
							{ name: 'Doorbell', duration: 5 },
							{ name: 'Chime', duration: 3 },
						],
					}),
				],
			},
		},
		// Status indicator — Indicator CC
		{
			id: 30,
			capabilities: {
				genericDeviceClass: 0x10,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Desk Indicator',
						location: 'Office',
					}),
					ccCaps({
						ccId: CommandClasses.Indicator,
						version: 4,
						indicators: {
							0x43: { properties: [0x03, 0x04, 0x05] },
							0x80: { properties: [0x01] },
						},
					}),
				],
			},
		},
		// Scene controller — Central Scene CC
		{
			id: 31,
			capabilities: {
				genericDeviceClass: 0x18,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Bedside Scene Pad',
						location: 'Bedroom',
					}),
					{ ccId: CommandClasses['Central Scene'], version: 3 },
					CommandClasses.Battery,
				],
			},
		},
		// Configurable-parameters device — exercises the Configuration UI
		{
			id: 32,
			capabilities: {
				genericDeviceClass: 0x10,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Config Demo Switch',
						location: 'Lab',
					}),
					ccCaps({
						ccId: CommandClasses['Binary Switch'],
						version: 2,
						defaultValue: false,
					}),
					ccCaps({
						ccId: CommandClasses.Configuration,
						version: 4,
						parameters: [
							{
								'#': 1,
								valueSize: 1,
								name: 'LED Brightness',
								info: 'Brightness of the status LED (0-100%)',
								minValue: 0,
								maxValue: 100,
								defaultValue: 50,
							},
							{
								'#': 2,
								valueSize: 1,
								name: 'Power-on State',
								info: '0 = Off, 1 = On, 2 = Last state',
								minValue: 0,
								maxValue: 2,
								defaultValue: 2,
							},
							{
								'#': 3,
								valueSize: 2,
								name: 'Auto-off Timer',
								info: 'Seconds before auto-off (0 = disabled)',
								minValue: 0,
								maxValue: 3600,
								defaultValue: 0,
							},
							{
								'#': 4,
								valueSize: 1,
								name: 'Operating Mode',
								info: 'Advanced operating mode',
								minValue: 0,
								maxValue: 3,
								defaultValue: 0,
								isAdvanced: true,
							},
						],
					}),
				],
			},
		},
	],
}
