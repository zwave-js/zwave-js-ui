// Maps `DeviceAction` shapes to ZwaveClient requests (one dispatcher per
// action, enforced by the mapped type).
//
// Value writes use `writeValue`, not `sendCommand`: only `setValue` updates
// the value optimistically and verifies it. The `valueId` rides on the action.

import { DoorLockMode } from '@zwave-js/cc'
import type { Device, DeviceAction } from './dashboard-types.ts'

type DeviceActionType = DeviceAction['type']

type ActionDispatcher<A extends DeviceAction> = (
	device: Device,
	action: A,
) => SocketRequest

// What the dispatcher returns; callers pass it to `apiRequest()`, which
// keeps this module pure.
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
	// Generic value-pane interactions.
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
	// Controller- and node-management actions, mapped to their
	// bookkeeping APIs.
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
}

/** Resolve a `DeviceAction` to its socket request; the caller emits it. */
export function dispatchAction(
	device: Device,
	action: DeviceAction,
): SocketRequest {
	const dispatcher = ACTION_DISPATCHERS[action.type] as ActionDispatcher<
		typeof action
	>
	return dispatcher(device, action)
}
