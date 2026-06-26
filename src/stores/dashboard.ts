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
			// Virtual nodes (broadcast/multicast groups) belong in their own
			// view, not the device list.
			((base.nodes ?? []) as Parameters<typeof projectDevices>[0]).filter(
				(n) => !n.virtual,
			),
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

	// `appInfo.homeHex` is the controller home ID formatted as `0x…` hex.
	const homeHex = computed(() => base.appInfo?.homeHex || '')

	return {
		devices,
		deviceCount,
		attentionCount,
		activities,
		activityCount,
		homeHex,
	}
})

// Convenience re-export; the implementation lives in `lib/attention.ts`.
export { deviceNeedsAttention } from '../lib/attention.ts'

export default useDashboardStore
