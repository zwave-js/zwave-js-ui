// gridTemplateB — DeviceRow column packing.
//
// The viewport drives whether columns are visible at all; the
// `columns` array drives which optional columns participate.
// Returns a string ready for `grid-template-columns`.

export type ToggleableCol =
	| 'transient'
	| 'location'
	| 'value'
	| 'power'
	| 'signal'
	| 'lastSeen'

const WIDTHS: Record<ToggleableCol, string> = {
	transient: '120px',
	location: '1fr',
	value: '1.4fr',
	power: '72px',
	signal: '40px',
	lastSeen: '88px',
}

export function gridTemplateB(
	viewport: number,
	columns: readonly ToggleableCol[],
): string {
	if (viewport < 600) {
		// Mobile collapse: status, id, name, value, chevron only.
		return 'auto auto 1fr auto auto'
	}

	const parts: string[] = ['14px', '32px', '1.6fr']
	for (const col of columns) {
		parts.push(WIDTHS[col])
	}
	parts.push('14px')
	return parts.join(' ')
}
