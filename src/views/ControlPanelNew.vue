<template>
	<ZwAppShell
		class="zw-cpn"
		@action="onAction"
		@add-action="onAddAction"
		@restart="onRestart"
		@check-updates="onCheckUpdates"
		@debug-capture="onDebugCapture"
	/>
</template>

<script setup lang="ts">
// Opt-in route that mounts `ZwAppShell` against the live websocket store.
// `meta.hideTopbar` makes App.vue drop its chrome so the shell renders
// full-bleed. Device actions are resolved by `dispatchAction` and sent
// through `apiRequest()` on the App instance, reached via `instanceManager`.

import { provide, shallowRef } from 'vue'
import ZwAppShell from '@/components/dashboard/layout/ZwAppShell.vue'
import { dispatchAction } from '@/lib/device-actions.ts'
import type { Device, DeviceAction } from '@/lib/dashboard-types'
import {
	actionPendingKey,
	DeviceActionPendingKey,
} from '@/lib/deviceActionPending.ts'
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
	startDebugCapture: () => Promise<void>
	finishDebugCapture: () => Promise<void>
}

function appInstance(): AppLike | null {
	const inst = manager.getInstance(instances.APP)
	return (inst as unknown as AppLike) ?? null
}

// Value-pane components watch this to show a spinner only while their request
// is actually in flight. Immutable Set, swapped on change (see PendingSet).
const pending = shallowRef<ReadonlySet<string>>(new Set())
provide(DeviceActionPendingKey, pending)

function setPending(key: string, on: boolean) {
	const next = new Set(pending.value)
	if (on) next.add(key)
	else next.delete(key)
	pending.value = next
}

async function onAction(device: Device, action: DeviceAction) {
	const req = dispatchAction(device, action)
	const app = appInstance()
	if (!app) {
		console.warn('[ControlPanelNew] App instance not registered yet')
		return
	}
	const key = actionPendingKey(device, action)
	if (key) setPending(key, true)
	try {
		await app.apiRequest(req.api, req.args, {
			infoSnack: false,
			errorSnack: true,
		})
	} finally {
		if (key) setPending(key, false)
	}
}

function onAddAction(kind: 'include' | 'replace-failed' | 'exclude') {
	const app = appInstance()
	if (!app) return
	const api = kind === 'exclude' ? 'startExclusion' : 'startInclusion'
	// 'replaceFailed' is the zwave-js socket-API mode for startInclusion.
	const args = kind === 'replace-failed' ? ['replaceFailed'] : []
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

// Defer to App's capture wizard; it owns the capture state the shell reads back.
function onDebugCapture(start: boolean) {
	const app = appInstance()
	if (!app) return
	void (start ? app.startDebugCapture() : app.finishDebugCapture())
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
