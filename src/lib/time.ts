// Relative-time helpers and a shared `useNow()` composable: all consumers
// tick off one 30-second heartbeat.

import { onScopeDispose, ref } from 'vue'
import type { Ref } from 'vue'

/**
 * Format a Unix-ms timestamp as a relative-time string (`just now`,
 * `2m ago`, …), or `'never'` if missing. Pure: the caller supplies `now`.
 */
export function relativeTime(at: number | undefined, now: number): string {
	if (!at) return 'never'
	const secs = Math.max(0, Math.floor((now - at) / 1000))
	if (secs < 10) return 'just now'
	if (secs < 60) return `${secs}s ago`
	if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
	if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
	return `${Math.floor(secs / 86400)}d ago`
}

// Singleton `now` ref ticked every 30s. Consumers share one interval; the
// refcount clears it when the last consumer unmounts.

let sharedNow: Ref<number> | null = null
let intervalId: ReturnType<typeof setInterval> | null = null
let refCount = 0

const TICK_MS = 30_000

export function useNow(): Ref<number> {
	if (!sharedNow) {
		sharedNow = ref(Date.now())
	}
	refCount += 1
	if (refCount === 1 && intervalId === null) {
		intervalId = setInterval(() => {
			if (sharedNow) sharedNow.value = Date.now()
		}, TICK_MS)
	}
	onScopeDispose(() => {
		refCount -= 1
		if (refCount <= 0 && intervalId !== null) {
			clearInterval(intervalId)
			intervalId = null
			refCount = 0
		}
	})
	return sharedNow
}
