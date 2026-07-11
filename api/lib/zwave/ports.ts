// Port accessors return live values so a driver swap on restart is honoured
import type {
	ScheduleEntryLockDailyRepeatingSchedule,
	ScheduleEntryLockSlotId,
	ScheduleEntryLockWeekDaySchedule,
	ScheduleEntryLockYearDaySchedule,
	SetValueResult,
	ZWaveNode,
	Driver,
	VirtualNode,
	VirtualValueID,
} from 'zwave-js'
import type { SupervisionResult } from '@zwave-js/core'
import type { ConfigManager } from '@zwave-js/config'
import type { DeepPartial } from '../utils.ts'

export const ZUIScheduleEntryLockMode = {
	DAILY: 'daily',
	WEEKLY: 'weekly',
	YEARLY: 'yearly',
} as const

export type ZUIScheduleEntryLockMode =
	(typeof ZUIScheduleEntryLockMode)[keyof typeof ZUIScheduleEntryLockMode]

export type ZUISlot<T> = T & { enabled: boolean } & ScheduleEntryLockSlotId

export interface ZUIScheduleConfig<T> {
	numSlots: number
	slots: ZUISlot<T>[]
}

export interface ZUISchedule {
	[ZUIScheduleEntryLockMode.DAILY]: ZUIScheduleConfig<ScheduleEntryLockDailyRepeatingSchedule>
	[ZUIScheduleEntryLockMode.WEEKLY]: ZUIScheduleConfig<ScheduleEntryLockWeekDaySchedule>
	[ZUIScheduleEntryLockMode.YEARLY]: ZUIScheduleConfig<ScheduleEntryLockYearDaySchedule>
}

export interface ZUIConfigurationTemplateValue {
	property: number
	propertyKey?: number | null
	endpoint: number
	value: unknown
	label?: string
	description?: string
}

export interface ZUIConfigurationTemplate {
	id: string
	name: string
	deviceId: string
	manufacturerId?: number
	productId?: number
	productType?: number
	manufacturer?: string
	productLabel?: string
	firmwareRange?: { min?: string; max?: string }
	values: ZUIConfigurationTemplateValue[]
	autoApply: boolean
	contentHash: string
	createdAt: string
	updatedAt: string
}

export interface ScheduleNodeState {
	id: number
	schedule?: ZUISchedule
	userCodes?: {
		total: number
		available: number[]
		enabled: number[]
	}
}

export interface TemplateNodeState {
	id: number
	ready: boolean
	deviceId?: string
	manufacturerId?: number
	productId?: number
	productType?: number
	manufacturer?: string
	productLabel?: string
	firmwareVersion?: string
	values?: Record<
		string,
		{
			commandClass: number
			writeable: boolean
			property: string | number
			propertyKey?: string | number | null
			endpoint?: number
			value?: unknown
			label?: string
			description?: string
		}
	>
	appliedTemplateContentHashes?: string[]
	status?: string
}

export interface ScheduleDriverPort {
	getDriver(): Driver | null
}

export interface ScheduleNodeStorePort {
	getNode(nodeId: number): ScheduleNodeState | undefined
	emitNodeUpdate(
		node: ScheduleNodeState,
		changedProps: DeepPartial<ScheduleNodeState>,
	): void
}

export interface ScheduleUtilsPort {
	deepEqual(a: unknown, b: unknown): boolean
}

export interface TemplateDriverPort {
	getDriver(): {
		controller: {
			nodes: { get(nodeId: number): ZWaveNode | undefined }
		}
	} | null
}

export interface TemplateNodeStorePort {
	getNode(nodeId: number): TemplateNodeState | undefined
	getNodes(): Iterable<readonly [number, TemplateNodeState]>
	getStoreNode(nodeId: number): Partial<TemplateNodeState> | undefined
	setStoreNode(nodeId: number, data: Partial<TemplateNodeState>): void
	updateStoreNodes(rebuildRoutes?: boolean): Promise<void>
	emitNodeUpdate(
		node: TemplateNodeState,
		changedProps: DeepPartial<TemplateNodeState>,
	): void
	writeValue(
		valueId: {
			nodeId: number
			commandClass: number
			endpoint: number
			property: number
			propertyKey?: number | null
		},
		value: unknown,
	): Promise<SetValueResult>
	logNode(zwaveNode: ZWaveNode, level: string, message: string): void
	throttle(key: string, fn: () => void, wait: number): void
}

export interface TemplatePersistencePort {
	get(): ZUIConfigurationTemplate[]
	put(data: ZUIConfigurationTemplate[]): Promise<unknown>
}

export interface ServiceLogger {
	info(message: string, ...meta: unknown[]): void
	warn(message: string, ...meta: unknown[]): void
	error(message: string, ...meta: unknown[]): void
}

export type TemplateConfigManagerPort = Pick<
	ConfigManager,
	'loadDeviceIndex' | 'lookupDevice'
>

export interface TemplateUtilsPort {
	generateId(): string
}

// ---------------------------------------------------------------------------
// Scene types
// ---------------------------------------------------------------------------

/**
 * Minimal shape a scene "value" (a scene-recorded ValueID + payload) must
 * have for the service to manage it. Structurally compatible with
 * `ZUIValueIdScene` from ZwaveClient (which has many more optional display
 * fields) without importing it – avoids a circular import.
 */
export interface ZUISceneValueRef {
	id: string
	nodeId: number
	commandClass: number
	endpoint?: number
	property: string | number
	propertyKey?: string | number | null
	value?: unknown
	timeout?: number
}

export interface ZUISceneRecord<V extends ZUISceneValueRef = ZUISceneValueRef> {
	sceneid: number
	label: string
	values: V[]
}

/** Minimal node shape SceneService needs to validate a scene value exists. */
export interface SceneNodeState {
	id: number
	values?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Port: persistence (jsonStore) for scenes
// ---------------------------------------------------------------------------

export interface ScenePersistencePort<
	V extends ZUISceneValueRef = ZUISceneValueRef,
> {
	get(): ZUISceneRecord<V>[]
	put(data: ZUISceneRecord<V>[]): Promise<unknown>
}

// ---------------------------------------------------------------------------
// Port: node store access for SceneService
// ---------------------------------------------------------------------------

export interface SceneNodeStorePort {
	getNode(nodeId: number): SceneNodeState | undefined
}

// ---------------------------------------------------------------------------
// Port: ValueID stringification for SceneService
// ---------------------------------------------------------------------------

export interface SceneUtilsPort {
	getValueId(v: {
		commandClass: number
		endpoint?: number
		property: string | number
		propertyKey?: string | number | null
	}): string
}

// ---------------------------------------------------------------------------
// Port: write access for scene activation
// ---------------------------------------------------------------------------

export interface SceneWritePort<V extends ZUISceneValueRef = ZUISceneValueRef> {
	writeValue(valueId: V, value: unknown): Promise<unknown>
}

// ---------------------------------------------------------------------------
// Group types
// ---------------------------------------------------------------------------

/** Structurally compatible with `Group` from `api/config/store.ts`. */
export interface ZUIGroup {
	id: number
	name: string
	nodeIds: number[]
}

/** Minimal value-entry shape GroupService reads/writes on virtual nodes. */
export interface GroupValueEntry {
	value?: unknown
}

/** Minimal ZUINode shape GroupService needs for virtual (multicast) nodes. */
export interface GroupZUINode {
	id: number
	name?: string
	values?: Record<string, GroupValueEntry>
}

// ---------------------------------------------------------------------------
// Port: driver + controller access for GroupService
// ---------------------------------------------------------------------------

export interface GroupDriverPort {
	isDriverReady(): boolean
	getOwnNodeId(): number | undefined
	/** True when the id is unknown to the controller (permissive) or physically present. */
	hasPhysicalNode(nodeId: number): boolean
	getMulticastGroup(nodeIds: number[]): VirtualNode
}

// ---------------------------------------------------------------------------
// Port: shared live virtual-node instance registry (multicast + broadcast)
// ---------------------------------------------------------------------------

export interface GroupVirtualNodeRegistryPort {
	has(id: number): boolean
	get(id: number): VirtualNode | undefined
	set(id: number, node: VirtualNode): void
	delete(id: number): boolean
}

// ---------------------------------------------------------------------------
// Port: ZUINode registry access for GroupService
// ---------------------------------------------------------------------------

export interface GroupZUINodeStorePort {
	get(id: number): GroupZUINode | undefined
	set(id: number, node: GroupZUINode): void
	delete(id: number): boolean
}

// ---------------------------------------------------------------------------
// Port: socket + event emission for GroupService
// ---------------------------------------------------------------------------

export interface GroupSocketPort {
	sendToSocket(event: string, data: unknown): void
	emitNodeUpdate(
		node: GroupZUINode,
		changedProps: DeepPartial<GroupZUINode>,
	): void
	emitValueChanged(
		valueId: GroupValueEntry,
		node: GroupZUINode,
		changed: boolean,
	): void
}

// ---------------------------------------------------------------------------
// Port: shared helpers GroupService needs from ZwaveClient (kept there
// because they're also used by the broadcast-node lifecycle, which is out
// of scope for this extraction)
// ---------------------------------------------------------------------------

export interface GroupUtilsPort {
	deepEqual(a: unknown, b: unknown): boolean
	getValueId(v: {
		commandClass: number
		endpoint?: number
		property: string | number
		propertyKey?: string | number | null
	}): string
	buildVirtualValueId(
		nodeId: number,
		zwaveValue: VirtualValueID,
		value: unknown,
	): GroupValueEntry | null
	newVirtualZUINode(
		nodeId: number,
		name: string,
		kind: 'multicast' | 'broadcast' | 'broadcastLR',
	): GroupZUINode
	throttle(key: string, fn: () => void, wait: number): void
}

// ---------------------------------------------------------------------------
// Port: persistence (jsonStore) for groups
// ---------------------------------------------------------------------------

export interface GroupPersistencePort {
	get(): ZUIGroup[]
	put(data: ZUIGroup[]): Promise<unknown>
}

// ---------------------------------------------------------------------------
// Association types
// ---------------------------------------------------------------------------

export interface AssociationGroupState {
	title: string
	endpoint: number
	value: number
	maxNodes: number
	isLifeline: boolean
	multiChannel: boolean
}

/** Minimal ZUINode shape AssociationService needs. */
export interface AssociationNodeState {
	id: number
	groups?: AssociationGroupState[]
}

/** Structurally compatible with `ZUIGroupAssociation` from ZwaveClient. */
export interface AssociationEntry {
	groupId: number
	nodeId: number
	endpoint?: number
	targetEndpoint?: number
}

// ---------------------------------------------------------------------------
// Port: driver access for AssociationService
// ---------------------------------------------------------------------------

export interface AssociationDriverPort {
	/** Resolves the current driver, or `null` when not (yet) available. */
	getDriver(): Driver | null
}

// ---------------------------------------------------------------------------
// Port: node registry access for AssociationService
// ---------------------------------------------------------------------------

export interface AssociationNodeStorePort {
	/** Physical driver-level node lookup (undefined when not interviewed/known). */
	getZWaveNode(nodeId: number): ZWaveNode | undefined
	/** ZUINode registry lookup, used to store the projected `groups` list. */
	getZUINode(nodeId: number): AssociationNodeState | undefined
	emitNodeUpdate(
		node: AssociationNodeState,
		changedProps: DeepPartial<AssociationNodeState>,
	): void
}

// ---------------------------------------------------------------------------
// Port: node-scoped logging for AssociationService
// ---------------------------------------------------------------------------

export interface AssociationLogPort {
	logNode(
		nodeId: number,
		level: string,
		message: string,
		...args: unknown[]
	): void
}
