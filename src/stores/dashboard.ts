
import { computed } from 'vue'
import { acceptHMRUpdate, defineStore } from 'pinia'
import useBaseStore from './base.js'
import { projectDevices } from '../lib/deviceProjection.ts'
import { deviceNeedsAttention } from '../lib/attention.ts'
import type { Device } from '../lib/dashboard-types.ts'

const useDashboardStore = defineStore('dashboard', () => {
	const base = useBaseStore()

	const devices = computed<Device[]>(() =>
		projectDevices(
			// Exclude virtual nodes (broadcast/multicast groups).
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

	const homeHex = computed(() => base.appInfo?.homeHex || '')

	const appVersion = computed(() => base.appInfo?.appVersion || '')
	const zwaveVersion = computed(() => base.appInfo?.zwaveVersion || '')

	return {
		devices,
		deviceCount,
		attentionCount,
		activities,
		activityCount,
		homeHex,
		appVersion,
		zwaveVersion,
	}
})

export { deviceNeedsAttention } from '../lib/attention.ts'

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useDashboardStore, import.meta.hot))
}

export default useDashboardStore
