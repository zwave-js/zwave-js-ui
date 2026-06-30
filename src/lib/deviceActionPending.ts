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
		default:
			return null
	}
}
