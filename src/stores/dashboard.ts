// src/stores/dashboard.ts
//
// Minimal placeholder for the dashboard's cross-cutting reactive state.
// Plan 70 (device projection) replaces this with a full store backed by
// the Z-Wave node socket layer. For now the layout plans (50-57) consume
// `devices` and derived counts so the new shell, sidebar, and topbar can
// stay free of prop-drilled counts (see plan 51's "Component contract").

import { defineStore } from 'pinia'
import type { Device } from '@/lib/dashboard-types'

interface DashboardState {
	devices: Device[]
}

const useDashboardStore = defineStore('dashboard', {
	state: (): DashboardState => ({
		devices: [],
	}),
	getters: {
		deviceCount: (s) => s.devices.length,
		attentionCount: (s) => s.devices.filter(deviceNeedsAttention).length,
		activities: (s) =>
			s.devices.filter((d) => (d.activity?.length ?? 0) > 0),
		activityCount(): number {
			return this.activities.length
		},
	},
	actions: {
		setDevices(devices: Device[]) {
			this.devices = devices
		},
	},
})

// Mirrors `ZW.deviceNeedsAttention` from `.design-handoff/project/data.jsx`:
// a device "needs attention" when it's dead, has a battery below 20%, or
// the interview hasn't completed. Plan 73 replaces with the canonical
// selector.
export function deviceNeedsAttention(d: Device): boolean {
	if (d.isController) return false
	if (d.status === 'dead') return true
	if (
		d.power.type === 'battery' &&
		typeof d.power.battery === 'number' &&
		d.power.battery < 20
	)
		return true
	if (d.interviewState && d.interviewState !== 'complete') return true
	return false
}

export default useDashboardStore
