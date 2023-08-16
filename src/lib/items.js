import { RFRegion } from 'zwave-js/safe'

export const rfRegions = Object.keys(RFRegion)
	.filter((k) => isNaN(k))
	.map((key) => ({
		text: key,
		value: RFRegion[key],
	}))
