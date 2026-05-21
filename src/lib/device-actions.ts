// src/lib/device-actions.ts
//
// Plan 70 — action contract + dispatch table.
//
// Components emit one event — `action(device, action)` — and never call
// the socket directly. This file is the single point that translates
// `DeviceAction` shapes into `socketActions.zwave` API calls. Adding a
// new action requires both an entry in the union AND a matching
// dispatcher entry — the conditional-mapped type below makes TS refuse
// to build if either half is missing.

import { CommandClasses } from '@zwave-js/core'
import type { Device, DeviceAction } from './dashboard-types.ts'

type DeviceActionType = DeviceAction['type']

type ActionDispatcher<A extends DeviceAction> = (
	device: Device,
	action: A,
) => SocketRequest

// What the dispatcher returns — the dispatcher does not own the socket;
// callers pass the request to `apiRequest()` on the running App
// instance. This keeps the module pure and easy to test.
export interface SocketRequest {
	api: string
	args: unknown[]
}

const cc = (name: keyof typeof CommandClasses) => CommandClasses[name]

export const ACTION_DISPATCHERS: {
	[T in DeviceActionType]: ActionDispatcher<
		Extract<DeviceAction, { type: T }>
	>
} = {
	toggle: (d, a) => ({
		api: 'sendCommand',
		args: [
			{ nodeId: d.id as number, commandClass: cc('Binary Switch') },
			'set',
			[a.on],
		],
	}),
	dim: (d, a) => ({
		api: 'sendCommand',
		args: [
			{ nodeId: d.id as number, commandClass: cc('Multilevel Switch') },
			'set',
			[a.level],
		],
	}),
	lock: (d, a) => ({
		api: 'sendCommand',
		args: [
			{ nodeId: d.id as number, commandClass: cc('Door Lock') },
			'set',
			[a.locked ? 255 : 0],
		],
	}),
	'thermostat-setpoint': (d, a) => ({
		api: 'sendCommand',
		args: [
			{ nodeId: d.id as number, commandClass: cc('Thermostat Setpoint') },
			'set',
			[1, a.setpoint],
		],
	}),
	'thermostat-mode': (d, a) => ({
		api: 'sendCommand',
		args: [
			{ nodeId: d.id as number, commandClass: cc('Thermostat Mode') },
			'set',
			[a.mode],
		],
	}),
	// UI-only / controller-targeted actions that don't fit the
	// "reactive CC write" pattern. These produce ZwaveClient API
	// requests against the controller or node bookkeeping APIs; some
	// (include / exclude / heal / replace) are conceptually
	// ControllerActions per plan 70 — kept here for v1 since the
	// existing UI already routes them through the same emit.
	ping: (d) => ({ api: 'pingNode', args: [d.id] }),
	interview: (d) => ({ api: 'refreshInfo', args: [d.id] }),
	refresh: (d) => ({ api: 'refreshValues', args: [d.id] }),
	rebuild: (d) => ({ api: 'rebuildNodeRoutes', args: [d.id] }),
	replace: (d) => ({ api: 'replaceFailedNode', args: [d.id] }),
	remove: (d) => ({ api: 'removeFailedNode', args: [d.id] }),
	export: (d) => ({ api: 'dumpNode', args: [d.id] }),
	clear: (d) => ({ api: 'softReset', args: [d.id] }),
	heal: () => ({ api: 'beginRebuildingRoutes', args: [] }),
	'backup-nvm': () => ({ api: 'backupNVMRaw', args: [] }),
	'restore-nvm': () => ({ api: 'restoreNVM', args: [] }),
	'reset-stats': (d) => ({ api: 'resetStatistics', args: [d.id] }),
	'export-json': (d) => ({ api: 'dumpNode', args: [d.id] }),
	'update-topics': (d) => ({ api: 'updateHassDiscovery', args: [d.id] }),
	'hard-reset': () => ({ api: 'hardReset', args: [] }),
	'restart-driver': () => ({ api: 'restart', args: [] }),
	include: () => ({ api: 'startInclusion', args: [] }),
	'replace-failed': () => ({
		api: 'startInclusion',
		args: ['replaceFailed'],
	}),
	exclude: () => ({ api: 'startExclusion', args: [] }),
}

/**
 * Resolve a `DeviceAction` to the matching socket request. The caller
 * is responsible for actually emitting it (via `apiRequest()` on the
 * App instance) and for any optimistic local update — by design.
 */
export function dispatchAction(
	device: Device,
	action: DeviceAction,
): SocketRequest {
	const dispatcher = ACTION_DISPATCHERS[action.type] as ActionDispatcher<
		typeof action
	>
	return dispatcher(device, action)
}
