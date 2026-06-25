// Translates `DeviceAction` shapes into ZwaveClient API requests. The
// mapped type below forces every action in the union to have a matching
// dispatcher entry, so a missing one fails to compile.

import { CommandClasses } from '@zwave-js/core'
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
	// Controller- and node-management actions, mapped to their
	// bookkeeping APIs.
	ping: (d) => ({ api: 'pingNode', args: [d.id] }),
	interview: (d) => ({ api: 'refreshInfo', args: [d.id] }),
	refresh: (d) => ({ api: 'refreshValues', args: [d.id] }),
	rebuild: (d) => ({ api: 'rebuildNodeRoutes', args: [d.id] }),
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
