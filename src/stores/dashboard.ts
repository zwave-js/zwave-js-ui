// Dashboard store: projects Z-Wave node data into `Device` records shared
// across the dashboard, with derived device/attention/activity counts.

import { computed } from 'vue'
import { defineStore } from 'pinia'
import useBaseStore from './base.js'
import { projectDevices } from '../lib/deviceProjection.ts'
import { deviceNeedsAttention } from '../lib/attention.ts'
import type { Device } from '../lib/dashboard-types.ts'

const useDashboardStore = defineStore('dashboard', () => {
	const base = useBaseStore()

	const devices = computed<Device[]>(() =>
		projectDevices(
			(base.nodes ?? []) as Parameters<typeof projectDevices>[0],
		),
	)

	const deviceCount = computed(
		() => devices.value.filter((d) => !d.isController).length,
	)

	const attentionCount = computed(
		() => devices.value.filter(deviceNeedsAttention).length,
	)

	const activities = computed(() =>
		devices.value.filter((d) => (d.activity?.length ?? 0) > 0),
	)

	const activityCount = computed(() => activities.value.length)

	return {
		devices,
		deviceCount,
		attentionCount,
		activities,
		activityCount,
	}
})

// Convenience re-export; the implementation lives in `lib/attention.ts`.
export { deviceNeedsAttention } from '../lib/attention.ts'

export default useDashboardStore
