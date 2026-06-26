// Type-safe access to a device's primary value for the per-type renderers.
//
// Each renderer in this folder handles exactly one PrimaryValueType. Rather
// than assert the shape with a bare `as PrimaryValueX` — which severs the
// link between the registry key and the subtype, so a mis-wire (e.g. mapping
// the `state` key to the Toggle renderer) type-checks and only fails at
// runtime — a renderer narrows with `usePrimaryValue(() => props.device,
// 'state')` and receives `PrimaryValueState | null`.
//
// The discriminant is CHECKED at runtime, so a mis-wire renders nothing
// (the `v-if="pv"` guard short-circuits) instead of reading fields off the
// wrong shape. The single internal cast is sound precisely because it sits
// behind that `pv.type === type` guard — narrowing is verified, not asserted.

import { computed, type ComputedRef } from 'vue'
import type {
	Device,
	PrimaryValueByType,
	PrimaryValueType,
} from '@/lib/dashboard-types'

export function usePrimaryValue<T extends PrimaryValueType>(
	device: () => Device,
	type: T,
): ComputedRef<PrimaryValueByType[T] | null> {
	return computed(() => {
		const pv = device().primaryValue
		return pv?.type === type ? (pv as PrimaryValueByType[T]) : null
	})
}
