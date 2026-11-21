// Device filter pipeline: scope → search → group, then sort within each
// group. Search is case-insensitive substring matching.

import type { Device } from './dashboard-types.ts'
import { deviceNeedsAttention } from './attention.ts'

export type Scope = 'overview' | 'attention' | 'activity'
export type Grouping = 'location' | 'type' | 'all'
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

/**
 * Switch to a new sort key (ascending) or flip direction when the same
 * key is clicked again.
 */
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
			// Mains first (asc) → battery devices sorted by remaining %.
			if (d.power.type === 'mains') return -1
			return d.power.battery ?? 0
		case 'lastSeen':
			return d.lastSeenTs ?? 0
		case 'activity':
			return (d.activity?.length ?? 0) > 0 ? 1 : 0
	}
}

export function compareDevices(
	a: Device,
	b: Device,
	sort: SortState = DEFAULT_SORT,
): number {
	if (a.isController && !b.isController) return -1
	if (!a.isController && b.isController) return 1
	const sign = sort.dir === 'desc' ? -1 : 1
	const av = sortValueFor(a, sort.key)
	const bv = sortValueFor(b, sort.key)
	if (av < bv) return -1 * sign
	if (av > bv) return 1 * sign
	return a.nodeId - b.nodeId
}

export function applyScope(devices: Device[], scope: Scope): Device[] {
	if (scope === 'attention') {
		return devices.filter((d) => d.isController || deviceNeedsAttention(d))
	}
	if (scope === 'activity') {
		return devices.filter((d) => (d.activity?.length ?? 0) > 0)
	}
	return devices
}

export function applySearch(devices: Device[], query: string): Device[] {
	const q = query.toLowerCase().trim()
	if (!q) return devices
	return devices.filter((d) =>
		[d.name, d.location, d.product, d.manufacturer, String(d.nodeId)].some(
			(s) => s?.toLowerCase().includes(q),
		),
	)
}

// Sentinel group key for the controller bucket (pinned first).
export const CONTROLLER_KEY = '__controller'

/**
 * Group devices by location / archetype label / or a single bucket.
 * Returns `[key, devices][]` entries with the controller group always
 * pinned first (when present).
 */
export function groupBy(
	devices: Device[],
	grouping: Grouping,
): [string, Device[]][] {
	if (grouping === 'all') {
		return [['All devices', devices]]
	}
	const map = new Map<string, Device[]>()
	for (const d of devices) {
		if (d.isController) {
			if (!map.has(CONTROLLER_KEY)) map.set(CONTROLLER_KEY, [])
			map.get(CONTROLLER_KEY).push(d)
			continue
		}
		const key =
			grouping === 'location'
				? d.location || 'No location'
				: d.archetype.label
		if (!map.has(key)) map.set(key, [])
		map.get(key).push(d)
	}
	const entries: [string, Device[]][] = []
	if (map.has(CONTROLLER_KEY)) {
		entries.push([CONTROLLER_KEY, map.get(CONTROLLER_KEY)])
		map.delete(CONTROLLER_KEY)
	}
	for (const [k, v] of map) entries.push([k, v])
	return entries
}

/**
 * Run the full pipeline: scope → search → group → sort within each group.
 * When grouping and sorting both by location, the groups themselves follow
 * the sort direction; the controller group stays pinned first.
 */
export function buildGroups(
	devices: Device[],
	opts: {
		scope: Scope
		grouping: Grouping
		query: string
		sort: SortState
	},
): [string, Device[]][] {
	const scoped = applyScope(devices, opts.scope)
	const searched = applySearch(scoped, opts.query)
	const groups = groupBy(searched, opts.grouping)

	for (const [, bucket] of groups) {
		bucket.sort((a, b) => compareDevices(a, b, opts.sort))
	}

	if (opts.grouping === 'location' && opts.sort.key === 'location') {
		const sign = opts.sort.dir === 'desc' ? -1 : 1
		groups.sort((a, b) => {
			if (a[0] === CONTROLLER_KEY) return -1
			if (b[0] === CONTROLLER_KEY) return 1
			return a[0].localeCompare(b[0]) * sign
		})
	}

	return groups
}
