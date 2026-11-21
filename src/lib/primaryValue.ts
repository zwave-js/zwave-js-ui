// Shared predicates over a device's primary value.

import type { PrimaryValueState } from '@/lib/dashboard-types'

// Alert state: second slot (index 1) tinted red or amber.
export function isStateAlert(state: PrimaryValueState): boolean {
	return (
		state.stateIdx === 1 &&
		(state.colors[1] === 'red' || state.colors[1] === 'amber')
	)
}
