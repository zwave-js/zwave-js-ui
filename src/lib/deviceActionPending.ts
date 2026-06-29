// Reactive Set of in-flight value-pane request keys. The host fills it around
// `apiRequest` so spinners clear on response (not a timer, and not only when a
// value changes — a poll often re-reads the same value).

import type { InjectionKey, ShallowRef } from 'vue'
import type { ValueID } from '@zwave-js/core'
import type { Device, DeviceAction } from './dashboard-types.ts'

// A shallowRef holding an immutable Set, replaced on each change. Members are
// read via `.value.has(...)`, so a row's check re-runs only when the set is
// actually swapped — not via Vue's reactive-Set per-key tracking, which
// invalidates every `.has()` watcher in every mounted row on any mutation.
export type PendingSet = ShallowRef<ReadonlySet<string>>

export const DeviceActionPendingKey: InjectionKey<PendingSet> = Symbol(
	'zwDeviceActionPending',
)

// Last completed-request outcome per key (true = succeeded), so a row can tell a
// successful write from a rejected one. Same key scheme as the pending Set.
export type ActionResultMap = ShallowRef<ReadonlyMap<string, boolean>>

export const DeviceActionResultKey: InjectionKey<ActionResultMap> = Symbol(
	'zwDeviceActionResult',
)

// Stable per-node value identity (`cc-endpoint-property-key`); keys pending
// requests and matches event args back to values. Partial: event args may
// carry only some of the fields.
export function valueIdKey(v: Partial<ValueID>): string {
	return `${v.commandClass}-${v.endpoint ?? 0}-${String(v.property)}-${v.propertyKey ?? ''}`
}

// Node-scoped — two nodes can share a ValueID shape.
export function setPendingKey(nodeId: number, v: ValueID): string {
	return `${nodeId}:set:${valueIdKey(v)}`
}

export function pollPendingKey(nodeId: number, v: ValueID): string {
	return `${nodeId}:poll:${valueIdKey(v)}`
}

export function ccPendingKey(nodeId: number, cc: number): string {
	return `${nodeId}:cc:${cc}`
}

// Pending key for an action, or null if the Values pane doesn't track it.
export function actionPendingKey(
	device: Device,
	action: DeviceAction,
): string | null {
	switch (action.type) {
		case 'set-value':
			return setPendingKey(device.nodeId, action.valueId)
		case 'poll-value':
			return pollPendingKey(device.nodeId, action.valueId)
		case 'refresh-cc':
			return ccPendingKey(device.nodeId, action.commandClass)
		default:
			return null
	}
}
