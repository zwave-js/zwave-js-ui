// @ts-check
// Multi-channel devices: 4-outlet power strip and an in-wall double dimmer.
const { CommandClasses } = require('@zwave-js/core')
const { ccCaps } = require('@zwave-js/testing')
const { RateType, SwitchType } = require('zwave-js')

// Endpoint capabilities are produced by factories so each endpoint gets a
// fresh object — sharing references is brittle if MockNode ever mutates them.
const binarySwitchEndpoint = () => ({
	genericDeviceClass: 0x10,
	specificDeviceClass: 0x01,
	commandClasses: [
		ccCaps({
			ccId: CommandClasses['Binary Switch'],
			version: 2,
			defaultValue: false,
		}),
		ccCaps({
			ccId: CommandClasses.Meter,
			version: 4,
			meterType: 1,
			supportedScales: [0, 2],
			supportedRateTypes: [RateType.Consumed],
			supportsReset: true,
		}),
	],
})

const dimmerEndpoint = () => ({
	genericDeviceClass: 0x11,
	specificDeviceClass: 0x01,
	commandClasses: [
		ccCaps({
			ccId: CommandClasses['Multilevel Switch'],
			version: 4,
			primarySwitchType: SwitchType['Off/On'],
			defaultValue: 0,
		}),
	],
})

/** @type {import('zwave-js/Testing').MockServerOptions['config']} */
module.exports.default = {
	nodes: [
		// 4-outlet power strip with per-outlet metering
		{
			id: 27,
			capabilities: {
				genericDeviceClass: 0x10,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Office Power Strip',
						location: 'Office',
					}),
					{ ccId: CommandClasses['Multi Channel'], version: 4 },
					ccCaps({
						ccId: CommandClasses['Binary Switch'],
						version: 2,
						defaultValue: false,
					}),
				],
				endpoints: [
					binarySwitchEndpoint(),
					binarySwitchEndpoint(),
					binarySwitchEndpoint(),
					binarySwitchEndpoint(),
				],
			},
		},
		// In-wall double dimmer (two endpoints)
		{
			id: 28,
			capabilities: {
				genericDeviceClass: 0x11,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Stairwell Dual Dimmer',
						location: 'Stairwell',
					}),
					{ ccId: CommandClasses['Multi Channel'], version: 4 },
					ccCaps({
						ccId: CommandClasses['Multilevel Switch'],
						version: 4,
						primarySwitchType: SwitchType['Off/On'],
						defaultValue: 0,
					}),
				],
				endpoints: [dimmerEndpoint(), dimmerEndpoint()],
			},
		},
	],
}
