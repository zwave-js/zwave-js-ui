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
				],
			},
		},
	],
}
