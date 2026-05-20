// @ts-check
// Node 2 of the demo fleet — a Window Covering (blinds) device.
// Note: the e2e MQTT round-trip in .github/workflows/test-application.yml runs
// against the single-node `server_config.js` (npm run fake-stick), NOT this
// fleet. Node 2 here is just a realistic blinds example for the dev fleet.
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
