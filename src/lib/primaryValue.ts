// Shared predicates over a device's primary value.

import type { PrimaryValueState } from '@/lib/dashboard-types'

// True when a `state` primary value sits in its alert slot: the second
// state (index 1) tinted red or amber. This is the single definition of
// "is this state an alert" — ZwPrimaryState, ZwDeviceCard and
// ZwCompactPrimary all read it, so the rule can't drift between the row,
// card and detail surfaces. Mapping an alert to a specific chip tone
// (red → danger, amber → warn) stays at the call site.
export function isStateAlert(state: PrimaryValueState): boolean {
	return (
		state.stateIdx === 1 &&
		(state.colors[1] === 'red' || state.colors[1] === 'amber')
	)
}
