// Projects the controller node's RF-related properties into the shape
// the controller options panel renders.

import { RFRegion } from '@zwave-js/core'
import type { ZUINode } from '../../api/lib/ZwaveClient.ts'

function regionSupportsAutoPowerlevel(region: number | undefined): boolean {
	return (
		region === RFRegion.Europe ||
		region === RFRegion['Europe (Long Range)'] ||
		region === RFRegion.USA ||
		region === RFRegion['USA (Long Range)']
	)
}

export type ControllerOptionKind = 'enum' | 'number' | 'readonly'

export interface ControllerOptionChoice {
	value: number | string
	label: string
}

export interface ControllerOption {
	key: string
	label: string
	description?: string
	kind: ControllerOptionKind
	value: unknown
	display: string
	unit?: string
	min?: number
	max?: number
	step?: number
	options?: ControllerOptionChoice[]
}

export interface BuildControllerOptionsContext {
	autoPowerlevels: boolean
}

export function buildControllerOptions(
	node: ZUINode | null | undefined,
	ctx: BuildControllerOptionsContext = { autoPowerlevels: true },
): ControllerOption[] {
	if (!node) return []

	const opts: ControllerOption[] = []

	const isAutoEnabled =
		ctx.autoPowerlevels && regionSupportsAutoPowerlevel(node.RFRegion)

	// RF Region — enum dropdown built from the controller's reported regions.
	// Filter out disabled entries (Unknown, Default (EU)) matching the old UI.
	const regionOptions: ControllerOptionChoice[] = (node.rfRegions ?? [])
		.filter((r) => !(r as { disabled?: boolean }).disabled)
		.map((r) => ({ value: r.value, label: r.title }))
	const supported = node.RFRegion !== undefined
	const regionValue = node.RFRegion
	const regionLabel = supported
		? (regionOptions.find((o) => o.value === regionValue)?.label ??
			String(regionValue))
		: undefined
	opts.push({
		key: 'rfRegion',
		label: 'RF Region',
		description: supported
			? 'Radio-frequency region the controller transmits in.'
			: 'Not supported by your controller.',
		kind: supported ? 'enum' : 'readonly',
		value: regionValue,
		display: supported ? `[${regionValue}] ${regionLabel}` : '—',
		options: supported ? regionOptions : undefined,
	})

	// Normal Power Level — editable unless auto-powerlevel is active.
	const powerlevel = node.powerlevel ?? 0
	opts.push({
		key: 'powerlevel',
		label: 'Normal Power Level',
		description: isAutoEnabled
			? 'Automatic mode enabled in settings.'
			: undefined,
		kind: isAutoEnabled ? 'readonly' : 'number',
		value: powerlevel,
		display: `${powerlevel} dBm`,
		unit: 'dBm',
		min: -10,
		max: 20,
		step: 0.1,
	})

	// Measured output power at 0 dBm — always editable.
	const measured = node.measured0dBm ?? 0
	opts.push({
		key: 'measured0dBm',
		label: 'Measured output power at 0 dBm',
		description:
			"Calibration offset for the antenna's measured output at 0 dBm.",
		kind: 'number',
		value: measured,
		display: `${measured} dBm`,
		unit: 'dBm',
		min: -10,
		max: 10,
		step: 0.1,
	})

	// Max LR Power Level — editable (enum) unless auto-powerlevel is active.
	if (node.supportsLongRange) {
		const maxLR = node.maxLongRangePowerlevel ?? 14
		const lrOptions: ControllerOptionChoice[] = [
			{ value: 14, label: '+14 dBm' },
			{ value: 20, label: '+20 dBm' },
		]
		const lrLabel =
			lrOptions.find((o) => o.value === maxLR)?.label ??
			`${maxLR > 0 ? '+' : ''}${maxLR} dBm`
		opts.push({
			key: 'maxLRPowerlevel',
			label: 'Maximum LR Power Level',
			description: isAutoEnabled
				? 'Automatic mode enabled in settings.'
				: undefined,
			kind: isAutoEnabled ? 'readonly' : 'enum',
			value: maxLR,
			display: lrLabel,
			options: isAutoEnabled ? undefined : lrOptions,
		})
	}

	return opts
}
