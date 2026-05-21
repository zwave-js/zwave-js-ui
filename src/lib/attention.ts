// src/lib/attention.ts
//
// Plan 73 — the "Needs attention" predicate behind the sidebar scope
// and its badge count.
//
// A device "needs attention" when any of the following is true:
//   1. status === 'dead'
//   2. health === 'weak' AND device is awake (signal issues only
//      interesting on awake nodes — see plan 73)
//   3. battery node with `power.battery < 15` (danger threshold; plan 13)
//   4. interviewState !== 'complete' AND no in-flight `interview`
//      activity (avoid double-counting with the Activity scope)
//   5. hasUpdate === true (pending firmware update)
//
// Controller never counts; asleep battery devices with healthy battery
// never count.

import type { Device } from './dashboard-types.ts'

export const LOW_BATTERY_THRESHOLD = 15

export function deviceNeedsAttention(d: Device): boolean {
	if (d.isController) return false
	if (d.status === 'dead') return true
	if (d.health === 'weak' && d.status !== 'asleep') return true
	if (
		d.power.type === 'battery' &&
		typeof d.power.battery === 'number' &&
		d.power.battery < LOW_BATTERY_THRESHOLD
	)
		return true
	if (d.interviewState !== 'complete') {
		const hasInterviewActivity = (d.activity ?? []).some(
			(a) => a.type === 'interview',
		)
		if (!hasInterviewActivity) return true
	}
	if (d.hasUpdate) return true
	return false
}

/**
 * Returns a short human-readable reason for the attention badge — used
 * by tooltips on the sidebar scope row and the per-device chip.
 * Returns `null` when the device does NOT need attention.
 */
export function attentionReason(d: Device): string | null {
	if (!deviceNeedsAttention(d)) return null
	if (d.status === 'dead') return 'Dead'
	if (d.health === 'weak' && d.status !== 'asleep') return 'Weak signal'
	if (
		d.power.type === 'battery' &&
		typeof d.power.battery === 'number' &&
		d.power.battery < LOW_BATTERY_THRESHOLD
	)
		return `Low battery (${d.power.battery}%)`
	if (d.interviewState !== 'complete') return 'Interview incomplete'
	if (d.hasUpdate) return 'Firmware update available'
	return null
}
