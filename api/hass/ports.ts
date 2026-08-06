import type {
	ZUIDeviceClass,
	ZUIEndpoint,
	ZUINode,
	ZUIValueId,
	ZUIValueIdState,
} from '../lib/ZwaveClient.ts'
import type ZWaveClient from '../lib/ZwaveClient.ts'
import type MqttClient from '../lib/MqttClient.ts'
import type { ModuleLogger } from '../lib/logger.ts'
import type { PayloadType } from '../lib/shared.ts'
import type { HassDevice, HassDeviceMap } from './types.ts'

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
	targetTopic?: string
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

/**
 * The narrow MQTT surface the scoped `homeassistant/status` subscription needs,
 * kept minimal so the discovery manager never depends on the concrete
 * `MqttClient`. `emit` is narrowed to `hassStatus`, so a holder cannot
 * synthesize other client events.
 */
export type HassStatusSource = Pick<MqttClient, 'subscribeExact'> & {
	on(event: 'brokerStatus', handler: (online: boolean) => void): void
	off(event: 'brokerStatus', handler: (online: boolean) => void): void
	emit(event: 'hassStatus', online: boolean): boolean
}

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

/**
 * Handed to the Gateway so it can only fork a per-instance view, never start,
 * dispose or write the shared root registry, keeping the single-fork ownership
 * invariant enforced by the type rather than a comment.
 */
export interface HassDeviceRegistrySourcePort {
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
