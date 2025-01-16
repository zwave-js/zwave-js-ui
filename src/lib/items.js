import { RFRegion, Protocols } from 'zwave-js/safe'
import { ZnifferRegion } from '@zwave-js/core/safe'

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
