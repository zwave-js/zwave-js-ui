// Sort/comparator helpers for ZwTableBody — ported verbatim from
// `.design-handoff/project/combined-dashboard.jsx:42-98`. Lives here so the
// AppShell (plan 50) can drive `sort` state without re-deriving the rules.

import type { Device } from '@/lib/dashboard-types'

export type SortDir = 'asc' | 'desc'
export type SortKey = 'id' | 'location' | 'power' | 'lastSeen' | 'activity'

export interface SortState {
	key: SortKey
	dir: SortDir
}

export const DEFAULT_SORT: SortState = { key: 'id', dir: 'asc' }

export const SORTABLE_KEYS: ReadonlySet<SortKey> = new Set<SortKey>([
	'id',
	'location',
	'power',
	'lastSeen',
	'activity',
])

// Header click: switching to a new key starts ascending. Clicking the active
// key flips direction. To return to default (ID asc), click ID — no implicit
// third-click reset.
export function nextSort(prev: SortState, key: SortKey): SortState {
	if (prev.key !== key) return { key, dir: 'asc' }
	return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
}

function sortValueFor(d: Device, key: SortKey): number | string {
	switch (key) {
		case 'id':
			return d.nodeId
		case 'location':
			return (d.location || '').toLowerCase()
		case 'power':
			// Mains-first when ascending: encode mains as -1 so it sorts before
			// any battery value.
			if (d.power.type === 'mains') return -1
			return d.power.battery ?? 0
		case 'lastSeen':
			// Smaller = more recent. The projection (plan 70) supplies
			// `lastSeenSecs`; until then fall back to 0.
			return (d as Device & { lastSeenSecs?: number }).lastSeenSecs ?? 0
		case 'activity':
			return (d.activity?.length ?? 0) > 0 ? 1 : 0
	}
}

export function compareDevices(a: Device, b: Device, sort: SortState): number {
	// Controller pins to top of its group regardless of sort.
	if (a.isController && !b.isController) return -1
	if (!a.isController && b.isController) return 1
	const sign = sort.dir === 'desc' ? -1 : 1
	const av = sortValueFor(a, sort.key)
	const bv = sortValueFor(b, sort.key)
	if (av < bv) return -1 * sign
	if (av > bv) return 1 * sign
	return a.nodeId - b.nodeId
}
