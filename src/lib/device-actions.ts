// Maps DeviceAction shapes to ZwaveClient socket requests.

import {
	DoorLockMode,
	setValueWasUnsupervisedOrSucceeded,
	type SetValueResult,
} from '@zwave-js/cc'
import type { Device, DeviceAction } from './dashboard-types.ts'

type DeviceActionType = DeviceAction['type']

type ActionDispatcher<A extends DeviceAction> = (
	device: Device,
	action: A,
) => SocketRequest

export interface SocketRequest {
	api: string
	args: unknown[]
}

export const ACTION_DISPATCHERS: {
	[T in DeviceActionType]: ActionDispatcher<
		Extract<DeviceAction, { type: T }>
	>
} = {
	toggle: (d, a) => ({
		api: 'writeValue',
		args: [{ nodeId: d.nodeId, ...a.valueId }, a.on],
	}),
	dim: (d, a) => ({
		api: 'writeValue',
		// Multilevel Switch caps at 99 (255 = restore); the slider reaches 100.
		args: [{ nodeId: d.nodeId, ...a.valueId }, Math.min(a.level, 99)],
	}),
	lock: (d, a) => ({
		api: 'writeValue',
		args: [
			{ nodeId: d.nodeId, ...a.valueId },
			a.locked ? DoorLockMode.Secured : DoorLockMode.Unsecured,
		],
	}),
	'thermostat-setpoint': (d, a) => ({
		api: 'writeValue',
		args: [{ nodeId: d.nodeId, ...a.valueId }, a.setpoint],
	}),
	'thermostat-mode': (d, a) => ({
		api: 'writeValue',
		args: [{ nodeId: d.nodeId, ...a.valueId }, a.mode],
	}),
	'set-value': (d, a) => ({
		api: 'writeValue',
		args: [{ nodeId: d.nodeId, ...a.valueId }, a.value],
	}),
	'poll-value': (d, a) => ({
		api: 'pollValue',
		args: [{ nodeId: d.nodeId, ...a.valueId }],
	}),
	'refresh-cc': (d, a) => ({
		api: 'refreshCCValues',
		args: [d.nodeId, a.commandClass],
	}),
	ping: (d) => ({ api: 'pingNode', args: [d.nodeId] }),
	interview: (d) => ({ api: 'refreshInfo', args: [d.nodeId] }),
	refresh: (d) => ({ api: 'refreshValues', args: [d.nodeId] }),
	rebuild: (d) => ({ api: 'rebuildNodeRoutes', args: [d.nodeId] }),
	remove: (d) => ({ api: 'removeFailedNode', args: [d.nodeId] }),
	export: (d) => ({ api: 'dumpNode', args: [d.nodeId] }),
	clear: (d) => ({ api: 'softReset', args: [d.nodeId] }),
	heal: () => ({ api: 'beginRebuildingRoutes', args: [] }),
	'backup-nvm': () => ({ api: 'backupNVMRaw', args: [] }),
	'restore-nvm': () => ({ api: 'restoreNVM', args: [] }),
	'reset-stats': (d) => ({ api: 'resetStatistics', args: [d.nodeId] }),
	'export-json': (d) => ({ api: 'dumpNode', args: [d.nodeId] }),
	'update-topics': (d) => ({ api: 'updateHassDiscovery', args: [d.nodeId] }),
	'hard-reset': () => ({ api: 'hardReset', args: [] }),
	'restart-driver': () => ({ api: 'restart', args: [] }),
	include: () => ({ api: 'startInclusion', args: [] }),
	'replace-failed': () => ({
		api: 'startInclusion',
		args: ['replaceFailed'],
	}),
	exclude: () => ({ api: 'startExclusion', args: [] }),
	'export-ui': (d) => ({ api: 'dumpNode', args: [d.nodeId] }),
	'clear-associations': (d) => ({
		api: 'removeAllAssociations',
		args: [d.nodeId],
	}),
	'remove-all-associations': (d) => ({
		api: 'removeNodeFromAllAssociations',
		args: [d.nodeId],
	}),
}

export function dispatchAction(
	device: Device,
	action: DeviceAction,
): SocketRequest {
	const dispatcher = ACTION_DISPATCHERS[action.type] as ActionDispatcher<
		typeof action
	>
	return dispatcher(device, action)
}

export interface ApiResponse {
	success: boolean
	result?: unknown
}

export function isRequestSuccess(api: string, response: ApiResponse): boolean {
	if (!response.success) return false
	// `writeValue` carries a SetValue status beyond the top-level success flag.
	if (api === 'writeValue' && response.result) {
		return setValueWasUnsupervisedOrSucceeded(
			response.result as SetValueResult,
		)
	}
	return true
}
