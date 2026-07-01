// Projects the controller node's RF-related properties into the shape
// the controller options panel renders.

import type { ZUINode } from '../../api/lib/ZwaveClient.ts'

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

export function buildControllerOptions(
	node: ZUINode | null | undefined,
): ControllerOption[] {
	if (!node) return []

	const opts: ControllerOption[] = []

	// RF Region — enum dropdown built from the controller's reported regions.
	const regionOptions: ControllerOptionChoice[] = (node.rfRegions ?? []).map(
		(r) => ({ value: r.value, label: r.title }),
	)
	const regionValue = node.RFRegion ?? 0
	const regionLabel =
		regionOptions.find((o) => o.value === regionValue)?.label ??
		String(regionValue)
	opts.push({
		key: 'rfRegion',
		label: 'RF Region',
		description: 'Radio-frequency region the controller transmits in.',
		kind: 'enum',
		value: regionValue,
		display: `[${regionValue}] ${regionLabel}`,
		options: regionOptions,
	})

	// Normal Power Level — read-only when auto-driven.
	const powerlevel = node.powerlevel ?? 0
	opts.push({
		key: 'powerlevel',
		label: 'Normal Power Level',
		description: 'Automatic mode enabled in settings.',
		kind: 'readonly',
		value: powerlevel,
		display: `${powerlevel} dBm`,
	})

	// Measured output power at 0 dBm — editable calibration offset.
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
		step: 1,
	})

	// Max LR Power Level — read-only, only relevant for Long Range sticks.
	if (node.supportsLongRange) {
		const maxLR = node.maxLongRangePowerlevel ?? 0
		opts.push({
			key: 'maxLRPowerlevel',
			label: 'Maximum LR Power Level',
			description: 'Automatic mode enabled in settings.',
			kind: 'readonly',
			value: maxLR,
			display: `${maxLR > 0 ? '+' : ''}${maxLR} dBm`,
		})
	}

	return opts
}
