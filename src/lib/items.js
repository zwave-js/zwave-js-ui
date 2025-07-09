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

export const settingsRfRegions = Object.keys(RFRegion)
	.filter((k) => isNaN(k))
	// Filter out regions that are not suitable for manual selection
	.filter((key) => {
		return (
			// Cannot be set:
			RFRegion[key] !== RFRegion.Unknown &&
			RFRegion[key] !== RFRegion['Default (EU)'] &&
			// Not supported by old controllers and Z-Wave JS selects them
			// automatically when Long Range is available:
			RFRegion[key] !== RFRegion['USA (Long Range)'] &&
			RFRegion[key] !== RFRegion['Europe (Long Range)']
		)
	})
	.map((key) => ({
		text: key,
		value: RFRegion[key],
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
