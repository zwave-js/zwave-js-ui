import { RFRegion, Protocols } from 'zwave-js/safe'

export const rfRegions = Object.keys(RFRegion)
	.filter((k) => isNaN(k))
	.map((key) => ({
		text: key,
		value: RFRegion[key],
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
