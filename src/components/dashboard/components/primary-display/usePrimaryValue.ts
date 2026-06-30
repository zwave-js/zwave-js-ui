// Narrows device.primaryValue by discriminant at runtime, so a mis-wired
// renderer renders nothing instead of reading the wrong shape.

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
