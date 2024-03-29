// @ts-check
const { CommandClasses } = require('@zwave-js/core')
const { ccCaps } = require('@zwave-js/testing')

module.exports.default = {
	nodes: [
		{
			id: 2,
			capabilities: {
				commandClasses: [
					CommandClasses.Version,
					ccCaps({
						ccId: CommandClasses['Window Covering'],
						isSupported: true,
						version: 1,
						supportedParameters: [3, 11, 13, 23],
					}),
					ccCaps({
						ccId: CommandClasses['User Code'],
						isSupported: true,
						version: 2,
						numUsers: 5,
						supportedASCIIChars: '0123456789ABCDEF',
					}),
					ccCaps({
						ccId: CommandClasses['Schedule Entry Lock'],
						isSupported: true,
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
