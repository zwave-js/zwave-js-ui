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
	confirm: (
		title: string,
		text: string,
		level?: string,
		options?: Record<string, unknown>,
	) => Promise<Record<string, unknown> | boolean>
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

const DONE_VISIBLE_MS = 1400

function completeAction(key: string, ok: boolean, delayMs = 0) {
	setStatus(key, ok ? 'ok' : 'fail')
	const clear = () => {
		const next = new Map(status.value)
		next.delete(key)
		status.value = next
	}
	if (delayMs > 0) {
		setTimeout(clear, delayMs)
	} else {
		// Delete after one tick so pre-flush watchers can read the outcome.
		nextTick(clear)
	}
}

function downloadFile(
	data: string | ArrayBuffer | Uint8Array,
	filename: string,
	type = 'text/plain',
) {
	const blob = new Blob([data], { type })
	const a = document.createElement('a')
	a.href = URL.createObjectURL(blob)
	a.download = filename
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	URL.revokeObjectURL(a.href)
}

function downloadJson(data: unknown, filename: string) {
	downloadFile(JSON.stringify(data, null, 2), filename)
}

async function onAction(device: Device, action: DeviceAction) {
	if (action.type === 'export-ui') {
		const node = useBaseStore().getNode(device.nodeId)
		if (node) downloadJson(node, `node_${device.nodeId}.json`)
		return
	}
	if (action.type === 'export-json') {
		const app = appInstance()
		if (!app) return
		const response = await app.apiRequest('dumpNode', [device.nodeId], {
			infoSnack: false,
			errorSnack: true,
		})
		if (response.success && response.result) {
			downloadJson(response.result, `node_${device.nodeId}_dump.json`)
		}
		return
	}
	if (action.type === 'firmware-upload') {
		const app = appInstance()
		if (!app) return
		const data = await action.file.arrayBuffer()
		await app.apiRequest(
			'updateFirmware',
			[device.nodeId, [{ name: action.file.name, data }]],
			{ infoSnack: true, errorSnack: true },
		)
		return
	}
	if (action.type === 'backup-nvm') {
		const app = appInstance()
		if (!app) return
		const confirmed = await app.confirm(
			'NVM Backup',
			'While doing the backup the Z-Wave radio will be turned on/off',
			'alert',
			{ confirmText: 'Ok' },
		)
		if (!confirmed) return
		const key = actionPendingKey(device, action)
		if (key) setStatus(key, 'pending')
		let ok = false
		try {
			const response = await app.apiRequest('backupNVMRaw', [], {
				infoSnack: false,
				errorSnack: true,
			})
			ok = response.success
			if (ok && response.result) {
				const r = response.result as {
					data: ArrayBuffer | Uint8Array
					fileName: string
				}
				downloadFile(r.data, r.fileName, 'application/octet-stream')
			}
		} finally {
			if (key) completeAction(key, ok, DONE_VISIBLE_MS)
		}
		return
	}
	if (action.type === 'restore-nvm') {
		const app = appInstance()
		if (!app) return
		const result = await app.confirm(
			'NVM Restore',
			'While doing the restore the Z-Wave radio will be turned on/off.\n<strong>A failure during this process may brick your controller. Use at your own risk!</strong>',
			'alert',
			{
				confirmText: 'Ok',
				width: 500,
				inputs: [
					{
						type: 'file',
						label: 'File',
						hint: 'NVM file',
						key: 'file',
					},
					{
						type: 'checkbox',
						label: 'Skip compatibility check',
						hint: 'This needs to be checked in order to allow restoring NVM backups on older controllers, with the risk of restoring an incompatible backup',
						key: 'useRaw',
					},
				],
			},
		)
		if (!result || typeof result !== 'object' || !result.file) return
		let nvmData: ArrayBuffer
		try {
			nvmData = await (result.file as File).arrayBuffer()
		} catch {
			return
		}
		const key = actionPendingKey(device, action)
		if (key) setStatus(key, 'pending')
		let ok = false
		try {
			const response = await app.apiRequest(
				'restoreNVM',
				[nvmData, result.useRaw],
				{ infoSnack: true, errorSnack: true },
			)
			ok = response.success
		} finally {
			if (key) completeAction(key, ok, DONE_VISIBLE_MS)
		}
		return
	}
	if (action.type === 'factory-reset') {
		const app = appInstance()
		if (!app) return
		const result = await app.confirm(
			'Hard Reset',
			'Your controller will be reset to factory and all paired devices will be removed',
			'alert',
			{
				confirmText: 'Ok',
				inputs: [
					{
						type: 'text',
						label: 'Confirm',
						required: true,
						key: 'confirm',
						hint: 'Type "yes" and press OK to confirm',
					},
				],
			},
		)
		if (!result || typeof result !== 'object' || result.confirm !== 'yes') {
			return
		}
		const key = actionPendingKey(device, action)
		if (key) setStatus(key, 'pending')
		let ok = false
		try {
			const response = await app.apiRequest('hardReset', [], {
				infoSnack: false,
				errorSnack: true,
			})
			ok = response.success
		} finally {
			if (key) completeAction(key, ok, DONE_VISIBLE_MS)
		}
		return
	}
	if (action.type === 'soft-reset') {
		const app = appInstance()
		if (!app) return
		const confirmed = await app.confirm(
			'Info',
			`<p>Are you sure you want to soft-reset your controller?</p>
			<p>USB modules will reconnect, meaning that they might get a new address. Make sure to configure your device address in a way that prevents it from changing, e.g. by using <code>/dev/serial/by-id/...</code> on Linux.</p>
			<p><strong>This method may cause problems in Docker containers with certain Z-Wave stick.</strong> If that happens, you may need to restart your host OS and docker container.</p>`,
			'info',
			{ confirmText: 'ok', cancelText: 'cancel', width: 900 },
		)
		if (!confirmed) return
		const key = actionPendingKey(device, action)
		if (key) setStatus(key, 'pending')
		let ok = false
		try {
			const response = await app.apiRequest('softReset', [], {
				infoSnack: false,
				errorSnack: true,
			})
			ok = response.success
		} finally {
			if (key) completeAction(key, ok, DONE_VISIBLE_MS)
		}
		return
	}
	if (action.type === 'shutdown') {
		const app = appInstance()
		if (!app) return
		const confirmed = await app.confirm(
			'Info',
			'Are you sure you want to shutdown the Zwave API? You will have to unplug and replug the Zwave stick manually to restart it.',
			'warning',
			{ confirmText: 'ok', cancelText: 'cancel' },
		)
		if (!confirmed) return
		const key = actionPendingKey(device, action)
		if (key) setStatus(key, 'pending')
		let ok = false
		try {
			const response = await app.apiRequest('shutdownZwaveAPI', [], {
				infoSnack: false,
				errorSnack: true,
			})
			ok = response.success
		} finally {
			if (key) completeAction(key, ok, DONE_VISIBLE_MS)
		}
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
