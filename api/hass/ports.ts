import type { ValueType } from '@zwave-js/core'
import type { IClientPublishOptions } from 'mqtt'
import type { HassDevice, HassDeviceCatalog, HassDeviceMap } from './types.ts'

export interface HassLogger {
	debug(message: string, ...meta: unknown[]): unknown
	info(message: string, ...meta: unknown[]): unknown
	warn(message: string, ...meta: unknown[]): unknown
	error(message: string, ...meta: unknown[]): unknown
	log(level: string, message: string, ...meta: unknown[]): unknown
}

export interface HassValueState {
	text: string
	value: number | string | boolean
}

export interface HassValue {
	id: string
	nodeId: number
	commandClass: number
	endpoint?: number
	property: string | number
	propertyName?: string
	propertyKey?: string | number
	propertyKeyName?: string
	type: ValueType
	readable: boolean
	writeable: boolean
	default: unknown
	stateless: boolean
	ccSpecific: Record<string, unknown>
	min?: number
	max?: number
	step?: number
	unit?: string
	states?: HassValueState[]
	value?: unknown
	targetValue?: string
	isCurrentValue?: boolean
	label?: string
	list?: boolean
}

export interface HassDeviceClass {
	basic: number
	generic: number
	specific: number
}

export interface HassEndpoint {
	index: number
	deviceClass: HassDeviceClass
}

export interface HassNode {
	id: number
	values: Record<string, HassValue>
	hassDevices: HassDeviceMap
	ready: boolean
	virtual?: boolean
	deviceId?: string
	deviceClass?: HassDeviceClass
	endpoints?: HassEndpoint[]
	name?: string
	loc?: string
	manufacturer?: string
	productDescription?: string
	productLabel?: string
	firmwareVersion?: string
}

export interface HassTopicNode {
	id: number
	values?: Record<string, HassValue>
	deviceId?: string
	name?: string
	loc?: string
}

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
	readonly homeHex: string
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
	snapshot(): HassDeviceCatalog
}

export interface HassPersistenceNode {
	hassDevices?: HassDeviceMap
}

export interface HassDeviceStorePort {
	hasNode(nodeId: number): boolean
	getNodeDevices(nodeId: number): HassDeviceMap | undefined
	setNodeDevices(nodeId: number, devices: HassDeviceMap): void
	getStoredNode(nodeId: number): HassPersistenceNode | null | undefined
	emitNodeUpdate(nodeId: number, devices: HassDeviceMap): void
	updateStoreNodes(): Promise<void>
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Narrows the legacy Z-Wave node DTO to the state discovery actually needs.
 * Runtime nodes always own both maps, while partially-built/test DTOs may not.
 */
export function isHassNode(value: unknown): value is HassNode {
	if (!isRecord(value)) return false

	return (
		typeof value.id === 'number' &&
		typeof value.ready === 'boolean' &&
		isRecord(value.values) &&
		isRecord(value.hassDevices)
	)
}
