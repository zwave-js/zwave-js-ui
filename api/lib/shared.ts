

import { RFRegion } from 'zwave-js'

export function regionSupportsAutoPowerlevel(region: RFRegion): boolean {
	return (
		region === RFRegion.Europe ||
		region === RFRegion['Europe (Long Range)'] ||
		region === RFRegion.USA ||
		region === RFRegion['USA (Long Range)']
	)
}