// Tracks in-flight value-pane requests so spinners clear on response.

import type { InjectionKey, ShallowRef } from 'vue'
import type { ValueID } from '@zwave-js/core'
import type { Device, DeviceAction } from './dashboard-types.ts'

export type ActionStatus = 'pending' | 'ok' | 'fail'

export type ActionStatusMap = ShallowRef<ReadonlyMap<string, ActionStatus>>

export const DeviceActionStatusKey: InjectionKey<ActionStatusMap> = Symbol(
	'zwDeviceActionStatus',
)

export function valueIdKey(v: Partial<ValueID>): string {
	return `${v.commandClass}-${v.endpoint ?? 0}-${String(v.property)}-${v.propertyKey ?? ''}`
}

export function setPendingKey(nodeId: number, v: ValueID): string {
	return `${nodeId}:set:${valueIdKey(v)}`
}

export function pollPendingKey(nodeId: number, v: ValueID): string {
	return `${nodeId}:poll:${valueIdKey(v)}`
}

export function ccPendingKey(nodeId: number, cc: number): string {
	return `${nodeId}:cc:${cc}`
}

export function controllerPropKey(
	nodeId: number,
	op: string,
	prop: string,
): string {
	return `${nodeId}:${op}:ctrl:${prop}`
}

export function actionPendingKey(
	device: Device,
	action: DeviceAction,
): string | null {
	switch (action.type) {
		case 'set-value':
			return setPendingKey(device.nodeId, action.valueId)
		case 'poll-value':
			return pollPendingKey(device.nodeId, action.valueId)
		case 'refresh-cc':
			return ccPendingKey(device.nodeId, action.commandClass)
		case 'set-rf-region':
			return controllerPropKey(device.nodeId, 'set', 'rfRegion')
		case 'set-powerlevel':
			return controllerPropKey(device.nodeId, 'set', 'powerlevel')
		case 'set-max-lr-powerlevel':
			return controllerPropKey(device.nodeId, 'set', 'maxLRPowerlevel')
		case 'refresh-controller-prop':
			return controllerPropKey(device.nodeId, 'refresh', action.prop)
		case 'backup-nvm':
			return `${device.nodeId}:backup-nvm`
		case 'restore-nvm':
			return `${device.nodeId}:restore-nvm`
		case 'factory-reset':
			return `${device.nodeId}:factory-reset`
		case 'soft-reset':
			return `${device.nodeId}:soft-reset`
		case 'shutdown':
			return `${device.nodeId}:shutdown`
		default:
			return null
	}
}
