<template>
	<ZwAppShell
		class="zw-cpn"
		@action="onAction"
		@add-action="onAddAction"
		@restart="onRestart"
		@check-updates="onCheckUpdates"
	/>
</template>

<script setup lang="ts">
// ControlPanelNew — opt-in route mounting the rework's `ZwAppShell`
// against the live websocket store. The legacy `/control-panel`
// remains untouched.
//
// `App.vue` hides its own chrome on this route (see `meta.hideTopbar`
// in `src/router/index.js`), so the new shell renders full-bleed
// while auth, login, and the socket bootstrap above it stay in place.
//
// Actions flow `ZwAppShell @action → dispatchAction → apiRequest()`.
// `apiRequest` lives on the App.vue instance registered in
// `instanceManager`; we reach it from the route so the new shell
// doesn't need to know about App.vue.

import ZwAppShell from '@/components/dashboard/layout/ZwAppShell.vue'
import { dispatchAction } from '@/lib/device-actions.ts'
import type { Device, DeviceAction } from '@/lib/dashboard-types'
import { manager, instances } from '@/lib/instanceManager'

interface AppLike {
	apiRequest: (
		api: string,
		args?: unknown[],
		opts?: { infoSnack?: boolean; errorSnack?: boolean },
	) => Promise<unknown>
	showSnackbar: (msg: string, level?: string) => void
	restart: () => Promise<void>
	showUpdateDialog: () => Promise<void>
}

function appInstance(): AppLike | null {
	const inst = manager.getInstance(instances.APP)
	return (inst as unknown as AppLike) ?? null
}

function onAction(device: Device, action: DeviceAction) {
	const req = dispatchAction(device, action)
	const app = appInstance()
	if (!app) {
		// eslint-disable-next-line no-console
		console.warn('[ControlPanelNew] App instance not registered yet')
		return
	}
	void app.apiRequest(req.api, req.args, {
		infoSnack: false,
		errorSnack: true,
	})
}

function onAddAction(kind: 'include' | 'replace' | 'exclude') {
	const app = appInstance()
	if (!app) return
	const api =
		kind === 'exclude'
			? 'startExclusion'
			: kind === 'replace'
				? 'startInclusion'
				: 'startInclusion'
	const args = kind === 'replace' ? ['replaceFailed'] : []
	void app.apiRequest(api, args, { infoSnack: true, errorSnack: true })
}

function onRestart() {
	const app = appInstance()
	if (!app) return
	void app.restart()
}

function onCheckUpdates() {
	const app = appInstance()
	if (!app) return
	void app.showUpdateDialog()
}
</script>

<style scoped>
.zw-cpn {
	position: fixed;
	inset: 0;
	z-index: 1;
	background: var(--zw-bg);
}
</style>
