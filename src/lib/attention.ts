// "Needs attention" predicate behind the attention scope and its badge
// count. A device needs attention when any of these holds:
//   1. status is 'dead'
//   2. health is 'weak' while awake
//   3. battery below LOW_BATTERY_THRESHOLD
//   4. interview incomplete with no in-flight interview activity
//   5. a firmware update is available
// Controllers are always excluded.

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

/** Short human-readable reason a device needs attention, else `null`. */
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
