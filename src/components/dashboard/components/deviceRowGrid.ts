// DeviceRow column packing. TOGGLEABLE_COLS is the single source of truth
// for the optional columns (ids, order, labels) — consumers import it
// rather than re-declaring. Viewport decides whether columns show at all;
// the `columns` array decides which optional ones participate.

import { MOBILE_BREAKPOINT } from '@/lib/dashboard-breakpoints.ts'

export type ToggleableCol =
	| 'activity'
	| 'location'
	| 'value'
	| 'power'
	| 'signal'
	| 'lastSeen'

// Toggleable columns in display order, with their menu labels.
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
	location: '0.8fr',
	value: '180px',
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
