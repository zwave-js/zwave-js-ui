// @ts-check
// Node 2 is pinned by the e2e workflow (.github/workflows/test-application.yml).
// It must keep Window Covering CC parameter 3 supported, otherwise the MQTT
// round-trip test (zwave/nodeID_2/106/0/targetValue/3) breaks.
const { CommandClasses } = require('@zwave-js/core')
const { ccCaps } = require('@zwave-js/testing')
const { WindowCoveringParameter } = require('zwave-js')

/** @type {import('zwave-js/Testing').MockServerOptions['config']} */
module.exports.default = {
	nodes: [
		{
			id: 2,
			capabilities: {
				genericDeviceClass: 0x09,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Living Room: Blinds',
						location: 'Living Room',
					}),
					ccCaps({
						ccId: CommandClasses['Window Covering'],
						version: 1,
						supportedParameters: [
							WindowCoveringParameter['Outbound Left'],
							WindowCoveringParameter['Outbound Right'],
							WindowCoveringParameter['Inbound Left/Right'],
							WindowCoveringParameter['Horizontal Slats Angle'],
						],
					}),
					ccCaps({
						ccId: CommandClasses['User Code'],
						version: 2,
						numUsers: 5,
						supportedASCIIChars: '0123456789ABCDEF',
					}),
					ccCaps({
						ccId: CommandClasses['Schedule Entry Lock'],
						version: 3,
						numDailyRepeatingSlots: 1,
						numWeekDaySlots: 1,
						numYearDaySlots: 1,
					}),
				],
			},
		},
	],
}
