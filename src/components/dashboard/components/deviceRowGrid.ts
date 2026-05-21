// deviceRowGrid — DeviceRow column packing.
//
// TOGGLEABLE_COLS below is the single source of truth for the optional
// columns — their ids, order and human labels. ZwColumnsMenu renders its
// menu from it and ZwDeviceRow keys off the same `ToggleableCol` ids.
//
// The viewport drives whether columns are visible at all; the
// `columns` array drives which optional columns participate.
// Returns a string ready for `grid-template-columns`.

import { MOBILE_BREAKPOINT } from '@/lib/dashboard-breakpoints.ts'

export type ToggleableCol =
	| 'activity'
	| 'location'
	| 'value'
	| 'power'
	| 'signal'
	| 'lastSeen'

// The toggleable columns in display order, with their menu labels. This is
// the one place the list is declared; consumers import from here.
export const TOGGLEABLE_COLS: { id: ToggleableCol; label: string }[] = [
	{ id: 'activity', label: 'Activity' },
	{ id: 'location', label: 'Location' },
	{ id: 'value', label: 'State / Value' },
	{ id: 'power', label: 'Power' },
	{ id: 'signal', label: 'Link' },
	{ id: 'lastSeen', label: 'Last seen' },
]

const WIDTHS: Record<ToggleableCol, string> = {
	activity: '120px',
	location: '1fr',
	value: '1.4fr',
	power: '72px',
	signal: '40px',
	lastSeen: '88px',
}

export function deviceRowGrid(
	viewport: number,
	columns: readonly ToggleableCol[],
): string {
	if (viewport < MOBILE_BREAKPOINT) {
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
