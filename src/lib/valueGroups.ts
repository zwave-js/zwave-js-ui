// Projects a node's `values` into the grouped, control-ready shape the Values
// pane renders. Pure — the component memoizes it with a computed.

import { CommandClasses, type ValueID } from '@zwave-js/core'
import type {
	ZUINode,
	ZUIValueId,
	ZUIValueIdState,
} from '../../api/lib/ZwaveClient.ts'

const CONFIGURATION_CC = CommandClasses.Configuration
const MULTILEVEL_SWITCH_CC = CommandClasses['Multilevel Switch']

// Which control a value renders (most-specific wins — see `paramKind`).
export type ValueParamKind =
	| 'switch'
	| 'button'
	| 'enum'
	| 'number'
	| 'level'
	| 'text'
	| 'color'
	| 'reading'

export interface ValueOption {
	value: number | string | boolean
	label: string
}

export interface ValueParam {
	// Stable value id (e.g. `5-112-0-9`), used as the v-for key.
	id: string
	label: string
	kind: ValueParamKind
	value: unknown
	// Pre-formatted current value for read-only / collapsed display.
	display: string
	readonly: boolean
	// Whether the value can be read back — write-only commands can't be polled.
	readable: boolean
	unit?: string
	min?: number
	max?: number
	step?: number
	default?: unknown
	// Configuration param whose value differs from its default.
	modified: boolean
	description?: string
	options?: ValueOption[]
	// Configuration param number (the value's `property`), surfaced as `#N`.
	paramNumber?: string
	// Write/poll target for the action layer.
	target: ValueID
}

export interface ValueGroup {
	ccId: number
	ccLabel: string
	version: number
	params: ValueParam[]
	// "Reset all to default" is offered for Configuration CC ≥ v4 only.
	canResetAll: boolean
}

// CCs that start expanded — the most-used ones.
export const DEFAULT_OPEN_CCS: ReadonlySet<number> = new Set([
	CommandClasses['Binary Switch'],
	CommandClasses['Multilevel Switch'],
	CommandClasses['Multilevel Sensor'],
	CommandClasses['Thermostat Mode'],
	CommandClasses['Thermostat Setpoint'],
	CommandClasses['Door Lock'],
	CommandClasses.Notification,
	CommandClasses['Binary Sensor'],
	CommandClasses.Meter,
	CommandClasses.Battery,
])

function toValueId(v: ZUIValueId): ValueID {
	const id: ValueID = {
		commandClass: v.commandClass,
		endpoint: v.endpoint ?? 0,
		property: v.property,
	}
	if (v.propertyKey !== undefined) id.propertyKey = v.propertyKey
	return id
}

function hasStates(
	v: ZUIValueId,
): v is ZUIValueId & { states: ZUIValueIdState[] } {
	return Array.isArray(v.states) && v.states.length > 0
}

// 0–99 dimmer-style value: Multilevel Switch current/target, or any 0–99 number.
function isLevel(v: ZUIValueId): boolean {
	if (
		v.commandClass === MULTILEVEL_SWITCH_CC &&
		(v.property === 'currentValue' || v.property === 'targetValue')
	) {
		return true
	}
	// A 0–99 number with discrete states is an enum (more specific), not a level.
	return v.type === 'number' && v.min === 0 && v.max === 99 && !hasStates(v)
}

// Picks the control *shape* (editability is `readonly`, set elsewhere). A value
// can match several predicates, so order matters — most specific first.
function paramKind(v: ZUIValueId): ValueParamKind {
	// write-only boolean = a command (e.g. Meter reset), not a toggle
	if (v.type === 'boolean' && v.writeable && !v.readable) return 'button'
	if (v.type === 'boolean') return 'switch'
	if (v.type === 'color') return 'color'
	if (isLevel(v)) return 'level'
	// states → dropdown, unless free entry is allowed (keep arbitrary values reachable)
	if (hasStates(v) && !(v.writeable && v.allowManualEntry)) return 'enum'
	if (v.type === 'number') return 'number'
	if (v.type === 'string' || v.type === 'buffer') return 'text'
	return 'reading' // duration / any / unsupported → read-only, never written
}

function formatValue(v: ZUIValueId, kind: ValueParamKind): string {
	const val = v.value
	if (val === null || val === undefined) return 'unknown'
	switch (kind) {
		case 'switch':
			return val ? 'ON' : 'OFF'
		case 'level':
			return `${val} %`
		case 'enum': {
			const opt = v.states?.find((s) => s.value === val)
			return opt ? `[${val}] ${opt.text}` : String(val)
		}
		case 'color':
			return String(val)
		default:
			if (typeof val === 'object') {
				try {
					return JSON.stringify(val)
				} catch {
					return String(val)
				}
			}
			return `${val}${v.unit ? ' ' + v.unit : ''}`
	}
}

// Referential stability cache — unchanged params reuse the same object.
const paramCache = new WeakMap<ZUIValueId, ValueParam>()

function projectParam(v: ZUIValueId): ValueParam {
	const cached = paramCache.get(v)
	// The store can mutate `.value` in place, so compare it too.
	if (cached && Object.is(cached.value, v.value)) return cached
	const param = buildParam(v)
	paramCache.set(v, param)
	return param
}

function buildParam(v: ZUIValueId): ValueParam {
	const kind = paramKind(v)
	const isConfig = v.commandClass === CONFIGURATION_CC
	const hasDefault = v.default !== undefined && v.default !== null
	const isDefault = hasDefault && String(v.value) === String(v.default)
	return {
		id: v.id,
		label: v.label || v.propertyName || String(v.property),
		kind,
		value: v.value,
		display: formatValue(v, kind),
		// `reading` has no editable control, so it must render read-only even
		// when the value is technically writeable (avoids an empty control).
		readonly: kind === 'reading' || !v.writeable,
		readable: !!v.readable,
		unit: v.unit,
		min: v.min,
		max: v.max,
		step: v.step,
		default: v.default,
		modified: isConfig && hasDefault && !isDefault,
		description: v.description,
		options: hasStates(v)
			? v.states.map((s) => ({ value: s.value, label: s.text }))
			: undefined,
		paramNumber: isConfig ? String(v.property) : undefined,
		target: toValueId(v),
	}
}

// Groups a node's values by command class (first-seen order), each projected to
// a render-ready `ValueParam`. `[]` for a node without values (e.g. controller).
export function buildValueGroups(node?: ZUINode | null): ValueGroup[] {
	if (!node || !Array.isArray(node.values)) return []
	const byCc = new Map<number, ValueGroup>()
	for (const v of node.values) {
		if (v == null) continue
		let g = byCc.get(v.commandClass)
		if (!g) {
			const version = v.commandClassVersion ?? 0
			g = {
				ccId: v.commandClass,
				ccLabel: v.commandClassName ?? `CC ${v.commandClass}`,
				version,
				params: [],
				canResetAll: v.commandClass === CONFIGURATION_CC && version > 3,
			}
			byCc.set(v.commandClass, g)
		}
		g.params.push(projectParam(v))
	}
	return [...byCc.values()]
}
