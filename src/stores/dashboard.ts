// src/stores/dashboard.ts
//
// Plan 70 — dashboard store. Single point that fans Z-Wave node data
// out to every dashboard surface as projected `Device` records, plus
// the derived counts the sidebar (plan 51) and topbar (plan 52) need
// to read in sync without prop-drilling.
//
// The store does NOT own UI-local dashboard state (active scope, view,
// query, selection). Those live in `ZwAppShell.vue` (plan 50).
//
// `setDevices()` remains as an escape hatch for the showcase fixture
// (`src/views/DashboardShowcase.vue`) — when the showcase mounts it
// pushes a static device list, bypassing the base-store projection.
// Production callers should not call `setDevices`; let the projection
// computed track the live `useBaseStore().nodes`.

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import useBaseStore from './base.js'
import { projectDevices } from '../lib/deviceProjection.ts'
import { deviceNeedsAttention } from '../lib/attention.ts'
import type { Device } from '../lib/dashboard-types.ts'

const useDashboardStore = defineStore('dashboard', () => {
	const base = useBaseStore()

	// Showcase-only override. `null` means: project live nodes from
	// the base store. Plan 70 acceptance: production never sets this.
	const override = ref<Device[] | null>(null)

	const projected = computed<Device[]>(() =>
		projectDevices(
			(base.nodes ?? []) as Parameters<typeof projectDevices>[0],
		),
	)

	const devices = computed<Device[]>(() =>
		override.value !== null ? override.value : projected.value,
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

	function setDevices(d: Device[]) {
		override.value = d
	}

	function clearOverride() {
		override.value = null
	}

	return {
		devices,
		deviceCount,
		attentionCount,
		activities,
		activityCount,
		setDevices,
		clearOverride,
	}
})

// Re-export so legacy call sites that imported `deviceNeedsAttention`
// from this module keep working. Plan 73 owns the implementation in
// `src/lib/attention.ts`.
export { deviceNeedsAttention } from '../lib/attention.ts'

export default useDashboardStore
