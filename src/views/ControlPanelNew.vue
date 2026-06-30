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

import { nextTick, provide, shallowRef } from 'vue'
import ZwAppShell from '@/components/dashboard/layout/ZwAppShell.vue'
import {
	dispatchAction,
	isRequestSuccess,
	type ApiResponse,
} from '@/lib/device-actions.ts'
import type { Device, DeviceAction } from '@/lib/dashboard-types'
import {
	actionPendingKey,
	DeviceActionStatusKey,
	type ActionStatus,
} from '@/lib/deviceActionPending.ts'
import { manager, instances } from '@/lib/instanceManager'
import useBaseStore from '@/stores/base'

interface AppLike {
	apiRequest: (
		api: string,
		args?: unknown[],
		opts?: { infoSnack?: boolean; errorSnack?: boolean },
	) => Promise<ApiResponse>
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

const status = shallowRef<ReadonlyMap<string, ActionStatus>>(new Map())
provide(DeviceActionStatusKey, status)

function setStatus(key: string, value: ActionStatus) {
	const next = new Map(status.value)
	next.set(key, value)
	status.value = next
}

function completeAction(key: string, ok: boolean) {
	setStatus(key, ok ? 'ok' : 'fail')
	// Delete after one tick so pre-flush watchers can read the outcome.
	nextTick(() => {
		const next = new Map(status.value)
		next.delete(key)
		status.value = next
	})
}

function downloadJson(data: unknown, filename: string) {
	const json = JSON.stringify(data, null, 2)
	const blob = new Blob([json], { type: 'text/plain' })
	const a = document.createElement('a')
	a.href = URL.createObjectURL(blob)
	a.download = filename
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	URL.revokeObjectURL(a.href)
}

async function onAction(device: Device, action: DeviceAction) {
	if (action.type === 'export-ui') {
		const node = useBaseStore().getNode(device.nodeId)
		if (node) downloadJson(node, `node_${device.nodeId}.json`)
		return
	}
	const req = dispatchAction(device, action)
	const app = appInstance()
	if (!app) {
		console.warn('[ControlPanelNew] App instance not registered yet')
		return
	}
	const key = actionPendingKey(device, action)
	if (key) setStatus(key, 'pending')
	let ok = false
	try {
		const response = await app.apiRequest(req.api, req.args, {
			infoSnack: false,
			errorSnack: true,
		})
		ok = isRequestSuccess(req.api, response)
	} finally {
		if (key) completeAction(key, ok)
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
