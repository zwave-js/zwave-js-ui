import { RFRegion } from 'zwave-js'

export const PayloadType = {
	JSON_TIME_VALUE: 0,
	VALUEID: 1,
	RAW: 2,
} as const

export type PayloadType = (typeof PayloadType)[keyof typeof PayloadType]

export function getIdWithoutNode(valueId: {
	id: string
	nodeId: number
}): string {
	return valueId.id.replace(`${valueId.nodeId}-`, '')
}

export function regionSupportsAutoPowerlevel(region: RFRegion): boolean {
	return (
		region === RFRegion.Europe ||
		region === RFRegion['Europe (Long Range)'] ||
		region === RFRegion.USA ||
		region === RFRegion['USA (Long Range)']
	)
}
