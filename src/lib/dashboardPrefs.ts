// Persists dashboard UI preferences in localStorage.

import { Settings } from '../modules/Settings.js'

export type Scope = 'overview' | 'attention' | 'activity'
export type Grouping = 'location' | 'type' | 'all'
export type View = 'cards' | 'table'
export interface SortPref {
	key: string
	dir: 'asc' | 'desc'
}

export interface DashboardPrefs {
	scope: Scope
	grouping: Grouping
	view: View
	sort: SortPref
	visibleCols: string[]
	collapsedGroups: string[]
	activityHidden: boolean
}

const STORAGE_KEY = 'dashboard'

const SCOPES: ReadonlySet<Scope> = new Set([
	'overview',
	'attention',
	'activity',
])
const GROUPINGS: ReadonlySet<Grouping> = new Set(['location', 'type', 'all'])
const VIEWS: ReadonlySet<View> = new Set(['cards', 'table'])
const SORT_DIRS: ReadonlySet<'asc' | 'desc'> = new Set(['asc', 'desc'])

export const DEFAULT_PREFS: DashboardPrefs = {
	scope: 'overview',
	grouping: 'location',
	view: 'cards',
	sort: { key: 'id', dir: 'asc' },
	visibleCols: [
		'activity',
		'location',
		'value',
		'power',
		'signal',
		'lastSeen',
	],
	collapsedGroups: [],
	activityHidden: false,
}

const settings = new Settings(
	typeof localStorage !== 'undefined' ? localStorage : undefined,
)

function isScope(v: unknown): v is Scope {
	return typeof v === 'string' && SCOPES.has(v as Scope)
}
function isGrouping(v: unknown): v is Grouping {
	return typeof v === 'string' && GROUPINGS.has(v as Grouping)
}
function isView(v: unknown): v is View {
	return typeof v === 'string' && VIEWS.has(v as View)
}
function isSort(v: unknown): v is SortPref {
	if (!v || typeof v !== 'object') return false
	const o = v as { key?: unknown; dir?: unknown }
	return typeof o.key === 'string' && SORT_DIRS.has(o.dir as 'asc' | 'desc')
}
function isStringArray(v: unknown): v is string[] {
	return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

/**
 * Load persisted prefs, validating each field; invalid fields fall back
 * to their default independently of the rest.
 */
export function load(): DashboardPrefs {
	const raw = settings.load(STORAGE_KEY, {}) as Partial<
		Record<keyof DashboardPrefs, unknown>
	>
	const safe: DashboardPrefs = { ...DEFAULT_PREFS }
	if (isScope(raw.scope)) safe.scope = raw.scope
	if (isGrouping(raw.grouping)) safe.grouping = raw.grouping
	if (isView(raw.view)) safe.view = raw.view
	if (isSort(raw.sort)) safe.sort = raw.sort
	if (isStringArray(raw.visibleCols)) safe.visibleCols = raw.visibleCols
	if (isStringArray(raw.collapsedGroups))
		safe.collapsedGroups = raw.collapsedGroups
	if (typeof raw.activityHidden === 'boolean')
		safe.activityHidden = raw.activityHidden
	return safe
}

export function save(prefs: DashboardPrefs): void {
	settings.store(STORAGE_KEY, prefs)
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

/** Debounced save (~200 ms) that coalesces rapid changes into one write. */
export function scheduleSave(prefs: DashboardPrefs, ms = 200): void {
	if (saveTimer) clearTimeout(saveTimer)
	saveTimer = setTimeout(() => {
		save(prefs)
		saveTimer = null
	}, ms)
}

/** Flush a pending debounced save immediately (e.g. on unmount/route-leave). */
export function flushSave(prefs: DashboardPrefs): void {
	if (saveTimer) {
		clearTimeout(saveTimer)
		saveTimer = null
	}
	save(prefs)
}
