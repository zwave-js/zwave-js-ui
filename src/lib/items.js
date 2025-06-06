import {
	ZnifferLRChannelConfig,
	ZnifferRegion,
	RFRegion,
	Protocols,
} from '@zwave-js/core'

export const rfRegions = Object.keys(RFRegion)
	.filter((k) => isNaN(k))
	.map((key) => ({
		text: key,
		value: RFRegion[key],
		disabled:
			RFRegion[key] === RFRegion.Unknown ||
			RFRegion[key] === RFRegion['Default (EU)'],
	}))
	.sort((a, b) => a.text.localeCompare(b.text))

export const znifferRegions = Object.keys(ZnifferRegion)
	.filter((k) => isNaN(k))
	.map((key) => ({
		text: key,
		value: ZnifferRegion[key],
		disabled:
			RFRegion[key] === RFRegion.Unknown ||
			RFRegion[key] === RFRegion['Default (EU)'],
	}))
	.sort((a, b) => a.text.localeCompare(b.text))

export const znifferLRChannelConfigs = Object.keys(ZnifferLRChannelConfig)
	.filter((k) => isNaN(k))
	.map((key) => ({
		text: key,
		value: ZnifferLRChannelConfig[key],
	}))

export const protocolsItems = [
	{
		text: 'Z-Wave',
		value: Protocols.ZWave,
	},
	{
		text: 'Z-Wave Long Range',
		value: Protocols.ZWaveLongRange,
	},
]

export const maxLRPowerLevels = [
	{
		text: '+14 dBm',
		value: 14,
	},
	{
		text: '+20 dBm',
		value: 20,
	},
]
