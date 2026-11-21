// "Needs attention" predicate for the attention scope and badge count.
// A device needs attention when: dead, weak signal while awake, low battery,
// incomplete interview (with none in-flight), or firmware update available.
// Controllers are excluded.

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

/** Short human-readable reason a device needs attention, or `null`. */
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
