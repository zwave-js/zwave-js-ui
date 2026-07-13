// Keep permissive because these DTOs round-trip through nodes.json and customDevices.js may set values JSON can't represent
export type HassComponentType =
	| 'sensor'
	| 'light'
	| 'binary_sensor'
	| 'cover'
	| 'climate'
	| 'lock'
	| 'switch'
	| 'fan'
	| 'number'

export type HassDiscoveryPayload = Record<string, unknown>

export type HassDevice = {
	type: HassComponentType
	object_id: string
	discovery_payload: HassDiscoveryPayload
	discoveryTopic?: string
	values?: string[]
	action_map?: Record<number, string>
	setpoint_topic?: Record<number, string>
	default_setpoint?: string
	persistent?: boolean
	ignoreDiscovery?: boolean
	fan_mode_map?: Record<string, number>
	mode_map?: Record<string, number>
	id?: string
}

export type HassDeviceMap = Record<string, HassDevice>
export type HassDeviceCatalog = Record<string, HassDevice[]>

export interface PublishDiscoveryOptions {
	deleteDevice?: boolean
	forceUpdate?: boolean
}

export const HASS_NODE_PREFIX = 'nodeID_'
export const RAW_PAYLOAD_TYPE = 2
