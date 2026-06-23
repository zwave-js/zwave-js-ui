// @ts-check
// Lighting devices: in-wall switch, smart plug w/ meter, dimmers, color bulbs.
const { CommandClasses } = require('@zwave-js/core')
const { ccCaps } = require('@zwave-js/testing')
const { ColorComponent, RateType, SwitchType } = require('zwave-js')

/** @type {import('zwave-js/Testing').MockServerOptions['config']} */
module.exports.default = {
	nodes: [
		// In-wall binary switch
		{
			id: 3,
			capabilities: {
				genericDeviceClass: 0x10,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Hallway Light',
						location: 'Hallway',
					}),
					ccCaps({
						ccId: CommandClasses['Binary Switch'],
						version: 2,
						defaultValue: false,
					}),
				],
			},
		},
		// Smart plug with energy metering
		{
			id: 4,
			capabilities: {
				genericDeviceClass: 0x10,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'TV Smart Plug',
						location: 'Living Room',
					}),
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
			},
		},
		// In-wall dimmer
		{
			id: 5,
			capabilities: {
				genericDeviceClass: 0x11,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Kitchen Dimmer',
						location: 'Kitchen',
					}),
					ccCaps({
						ccId: CommandClasses['Multilevel Switch'],
						version: 4,
						primarySwitchType: SwitchType['Off/On'],
						defaultValue: 0,
					}),
				],
			},
		},
		// Ceiling dimmer with metering
		{
			id: 6,
			capabilities: {
				genericDeviceClass: 0x11,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Bedroom Ceiling',
						location: 'Bedroom',
					}),
					ccCaps({
						ccId: CommandClasses['Multilevel Switch'],
						version: 4,
						primarySwitchType: SwitchType['Off/On'],
						defaultValue: 0,
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
			},
		},
		// RGB bulb
		{
			id: 7,
			capabilities: {
				genericDeviceClass: 0x11,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Living Room Lamp',
						location: 'Living Room',
					}),
					ccCaps({
						ccId: CommandClasses['Multilevel Switch'],
						version: 4,
						primarySwitchType: SwitchType['Off/On'],
						defaultValue: 0,
					}),
					ccCaps({
						ccId: CommandClasses['Color Switch'],
						version: 3,
						colorComponents: {
							[ColorComponent.Red]: 255,
							[ColorComponent.Green]: 255,
							[ColorComponent.Blue]: 255,
						},
					}),
				],
			},
		},
		// RGBW LED strip (Warm White + RGB)
		{
			id: 8,
			capabilities: {
				genericDeviceClass: 0x11,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'TV Backlight',
						location: 'Living Room',
					}),
					ccCaps({
						ccId: CommandClasses['Multilevel Switch'],
						version: 4,
						primarySwitchType: SwitchType['Off/On'],
						defaultValue: 0,
					}),
					ccCaps({
						ccId: CommandClasses['Color Switch'],
						version: 3,
						colorComponents: {
							[ColorComponent['Warm White']]: 0,
							[ColorComponent.Red]: 0,
							[ColorComponent.Green]: 0,
							[ColorComponent.Blue]: 0,
						},
					}),
				],
			},
		},
		// Ceiling fan (multilevel switch)
		{
			id: 9,
			capabilities: {
				genericDeviceClass: 0x11,
				specificDeviceClass: 0x08,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Bedroom Fan',
						location: 'Bedroom',
					}),
					ccCaps({
						ccId: CommandClasses['Multilevel Switch'],
						version: 4,
						primarySwitchType: SwitchType['Off/On'],
						defaultValue: 0,
					}),
				],
			},
		},
	],
}
