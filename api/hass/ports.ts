import type {
	ZUIDeviceClass,
	ZUIEndpoint,
	ZUINode,
	ZUIValueId,
	ZUIValueIdState,
} from '#api/lib/ZwaveClient'
import type ZWaveClient from '#api/lib/ZwaveClient'
import type MqttClient from '#api/lib/MqttClient'
import type { ModuleLogger } from '#api/lib/logger'
import type { PayloadType } from '#api/lib/shared'
import type { HassDevice, HassDeviceMap } from '#api/hass/types'

export type HassLogger = Pick<
	ModuleLogger,
	'debug' | 'info' | 'warn' | 'error' | 'log'
>

export type HassValueState = ZUIValueIdState
export type HassValue = ZUIValueId
export type HassDeviceClass = ZUIDeviceClass
export type HassEndpoint = Pick<ZUIEndpoint, 'deviceClass' | 'index'>
export type HassNode = ZUINode &
	Required<Pick<ZUINode, 'hassDevices' | 'values'>>
export type HassTopicNode = Pick<
	ZUINode,
	'deviceId' | 'id' | 'loc' | 'name' | 'values'
>

export interface HassValueConfiguration {
	device_class?: string
	icon?: string
	ccConfigEnableDiscovery?: boolean
}

export interface HassValueTopic {
	topic: string
	valueConf?: HassValueConfiguration
	targetTopic?: string | null
}

export interface HassTopicPort {
	nodeTopic(node: HassTopicNode): string
	valueTopic(
		node: HassTopicNode,
		value: HassValue,
		returnObject?: boolean,
	): string | HassValueTopic | null
}

export type HassMqttPort = Pick<
	MqttClient,
	'disabled' | 'getTopic' | 'getStatusTopic' | 'publish'
>

export type HassZwavePort = Pick<
	ZWaveClient,
	'homeHex' | 'nodes' | 'updateDevice' | 'writeValue'
>

export interface HassNodeUpdatePort {
	emitNodeUpdate(nodeId: number, devices: HassDeviceMap): void
}

export interface HassDiscoveryConfig {
	hassDiscovery?: boolean
	manualDiscovery?: boolean
	retainedDiscovery?: boolean
	discoveryPrefix?: string
	payloadType?: PayloadType
	entityTemplate?: string
	ignoreLoc?: boolean
	useLocationAsSuggestedArea?: boolean
}

export interface HassDeviceRegistryPort {
	get(deviceId: string | undefined): HassDevice[]
	set(deviceId: string | undefined, devices: HassDevice[]): void
}

export interface HassDeviceRegistryLifecyclePort
	extends HassDeviceRegistryPort {
	start(): void
	dispose(): void
}

export interface HassDeviceRegistrySourcePort
	extends HassDeviceRegistryLifecyclePort {
	fork(): HassDeviceRegistryLifecyclePort
}

export type HassPersistenceNode = Pick<ZUINode, 'hassDevices'>

export interface HassDeviceStorePort {
	hasNode(nodeId: number): boolean
	getNodeDevices(nodeId: number): HassDeviceMap | undefined
	setNodeDevices(nodeId: number, devices: HassDeviceMap): void
	getStoredNode(nodeId: number): unknown
	setStoredNode(nodeId: number, node: HassPersistenceNode): void
	emitNodeUpdate(nodeId: number, devices: HassDeviceMap): void
	updateStoreNodes(): Promise<void>
}

export function ensureHassNode(node: ZUINode): asserts node is HassNode {
	node.values ??= {}
	node.hassDevices ??= {}
}
