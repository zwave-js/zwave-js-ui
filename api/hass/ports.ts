import type { IClientPublishOptions } from 'mqtt'
import type {
	ZUIDeviceClass,
	ZUIEndpoint,
	ZUINode,
	ZUIValueId,
	ZUIValueIdState,
} from '../lib/ZwaveClient.ts'
import type { HassDevice, HassDeviceMap } from './types.ts'

export interface HassLogger {
	debug(message: string, ...meta: unknown[]): unknown
	info(message: string, ...meta: unknown[]): unknown
	warn(message: string, ...meta: unknown[]): unknown
	error(message: string, ...meta: unknown[]): unknown
	log(level: string, message: string, ...meta: unknown[]): unknown
}

export type HassValueState = ZUIValueIdState
export type HassValue = ZUIValueId
export type HassDeviceClass = ZUIDeviceClass
export type HassEndpoint = Pick<ZUIEndpoint, 'deviceClass' | 'index'>
export type HassNode = Pick<
	ZUINode,
	| 'deviceClass'
	| 'deviceId'
	| 'endpoints'
	| 'firmwareVersion'
	| 'id'
	| 'loc'
	| 'manufacturer'
	| 'name'
	| 'productDescription'
	| 'productLabel'
	| 'ready'
	| 'virtual'
> &
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

export interface HassMqttPort {
	readonly disabled: boolean
	getTopic(topic: string, set?: boolean): string
	getStatusTopic(): string
	publish(
		topic: string,
		data: unknown,
		options?: IClientPublishOptions,
		prefix?: string,
	): unknown
}

export interface HassZwavePort {
	readonly homeHex: string | undefined
	getNode(nodeId: number): unknown
	getNodes(): Iterable<readonly [number, unknown]>
	updateDevice(
		device: HassDevice,
		nodeId: number,
		deleteDevice?: boolean,
	): void
	emitNodeUpdate(nodeId: number, devices: HassDeviceMap): void
	writeCoverStop(value: HassValue): Promise<unknown>
}

export interface HassDiscoveryConfig {
	hassDiscovery?: boolean
	manualDiscovery?: boolean
	retainedDiscovery?: boolean
	discoveryPrefix?: string
	payloadType?: number
	entityTemplate?: string
	ignoreLoc?: boolean
	useLocationAsSuggestedArea?: boolean
}

export interface HassDiscoveryState {
	discovered: Record<string, HassDevice>
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

export type HassPersistenceNode = Pick<ZUINode, 'hassDevices'>

export interface HassDeviceStorePort {
	hasNode(nodeId: number): boolean
	getNodeDevices(nodeId: number): HassDeviceMap | undefined
	setNodeDevices(nodeId: number, devices: HassDeviceMap): void
	getStoredNode(nodeId: number): unknown
	emitNodeUpdate(nodeId: number, devices: HassDeviceMap): void
	updateStoreNodes(): Promise<void>
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isHassNode(value: unknown): value is HassNode {
	if (!isRecord(value)) return false

	return (
		typeof value.id === 'number' &&
		typeof value.ready === 'boolean' &&
		isRecord(value.values) &&
		isRecord(value.hassDevices)
	)
}
