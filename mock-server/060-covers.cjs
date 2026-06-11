// @ts-check
// Covers: roller shutter (multilevel switch type) and Venetian blinds
// (Window Covering with multiple parameters). Garage opener uses Binary Switch.
const { CommandClasses } = require('@zwave-js/core')
const { ccCaps } = require('@zwave-js/testing')
const { SwitchType, WindowCoveringParameter } = require('zwave-js')

/** @type {import('zwave-js/Testing').MockServerOptions['config']} */
module.exports.default = {
	nodes: [
		// Roller shutter — multilevel switch with up/down semantics
		{
			id: 21,
			capabilities: {
				genericDeviceClass: 0x11,
				specificDeviceClass: 0x06,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Bedroom Shutter',
						location: 'Bedroom',
					}),
					ccCaps({
						ccId: CommandClasses['Multilevel Switch'],
						version: 4,
						primarySwitchType: SwitchType['Down/Up'],
						defaultValue: 0,
					}),
				],
			},
		},
		// Venetian blinds — Window Covering CC with position + slat angle
		{
			id: 22,
			capabilities: {
				genericDeviceClass: 0x09,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Office Blinds',
						location: 'Office',
					}),
					ccCaps({
						ccId: CommandClasses['Window Covering'],
						version: 1,
						supportedParameters: [
							WindowCoveringParameter['Outbound Bottom'],
							WindowCoveringParameter['Horizontal Slats Angle'],
						],
					}),
				],
			},
		},
		// Garage door opener — modeled as binary switch + door notification
		{
			id: 23,
			capabilities: {
				genericDeviceClass: 0x10,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Garage Door',
						location: 'Garage',
					}),
					ccCaps({
						ccId: CommandClasses['Binary Switch'],
						version: 2,
						defaultValue: false,
					}),
					ccCaps({
						ccId: CommandClasses.Notification,
						version: 8,
						supportsV1Alarm: false,
						notificationTypesAndEvents: {
							6: [22, 23],
						},
					}),
				],
			},
		},
	],
}
