// src/stores/dashboard.ts
//
// Plan 70 — dashboard store. Single point that fans Z-Wave node data
// out to every dashboard surface as projected `Device` records, plus
// the derived counts the sidebar (plan 51) and topbar (plan 52) need
// to read in sync without prop-drilling.
//
// The store does NOT own UI-local dashboard state (active scope, view,
// query, selection). Those live in `ZwAppShell.vue` (plan 50).

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

// Re-export so legacy call sites that imported `deviceNeedsAttention`
// from this module keep working. Plan 73 owns the implementation in
// `src/lib/attention.ts`.
export { deviceNeedsAttention } from '../lib/attention.ts'

export default useDashboardStore
