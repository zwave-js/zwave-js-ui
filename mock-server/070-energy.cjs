// @ts-check
// Energy / metering devices: whole-house electric meter, gas meter,
// and a solar inverter exposing Energy Production CC.
const { CommandClasses } = require('@zwave-js/core')
const { ccCaps } = require('@zwave-js/testing')
const { RateType } = require('zwave-js')

/** @type {import('zwave-js/Testing').MockServerOptions['config']} */
module.exports.default = {
	nodes: [
		// Whole-house electric meter
		{
			id: 24,
			capabilities: {
				genericDeviceClass: 0x31,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Main Electric Meter',
						location: 'Utility Room',
					}),
					ccCaps({
						ccId: CommandClasses.Meter,
						version: 6,
						meterType: 1,
						supportedScales: [0, 2, 4, 5, 6],
						supportedRateTypes: [
							RateType.Consumed,
							RateType.Produced,
						],
						supportsReset: true,
					}),
				],
			},
		},
		// Gas meter
		{
			id: 25,
			capabilities: {
				genericDeviceClass: 0x31,
				specificDeviceClass: 0x03,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Gas Meter',
						location: 'Utility Room',
					}),
					ccCaps({
						ccId: CommandClasses.Meter,
						version: 4,
						meterType: 3,
						supportedScales: [0, 1],
						supportedRateTypes: [RateType.Consumed],
						supportsReset: false,
					}),
				],
			},
		},
		// Solar inverter — Energy Production CC
		{
			id: 26,
			capabilities: {
				genericDeviceClass: 0x31,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Roof Solar Inverter',
						location: 'Roof',
					}),
					ccCaps({
						ccId: CommandClasses['Energy Production'],
						version: 1,
						values: {
							Power: { value: 1250, scale: 0 },
							'Production Total': { value: 4823000, scale: 0 },
							'Production Today': { value: 8400, scale: 0 },
							'Total Time': { value: 18540, scale: 1 },
						},
					}),
				],
			},
		},
	],
}
