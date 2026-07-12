// Port accessors return live values so a driver swap on restart is honoured
import type {
	ScheduleEntryLockDailyRepeatingSchedule,
	ScheduleEntryLockSlotId,
	ScheduleEntryLockWeekDaySchedule,
	ScheduleEntryLockYearDaySchedule,
	SetValueResult,
	ZWaveNode,
	Driver,
	VirtualValueID,
	ZWaveController,
	FirmwareUpdateInfo,
	FirmwareUpdateResult,
	OTWFirmwareUpdateResult,
	InclusionGrant,
	InclusionOptions,
	ReplaceNodeOptions,
	InclusionUserCallbacks,
	InclusionState,
	JoinNetworkResult,
	PlannedProvisioningEntry,
	QRProvisioningInformation,
} from 'zwave-js'
import { InclusionStrategy, QRCodeVersion } from 'zwave-js'
import type {
	FirmwareFileFormat,
	SecurityClass,
	SupervisionResult,
} from '@zwave-js/core'
import type { ConfigManager } from '@zwave-js/config'
import type { DeepPartial } from '../utils.ts'

export type {
	FirmwareFileFormat,
	SecurityClass,
	FirmwareUpdateInfo,
	FirmwareUpdateResult,
	OTWFirmwareUpdateResult,
	InclusionGrant,
	InclusionOptions,
	InclusionState,
	ReplaceNodeOptions,
	InclusionUserCallbacks,
	JoinNetworkResult,
	PlannedProvisioningEntry,
	QRProvisioningInformation,
}
export { InclusionStrategy, QRCodeVersion }

// ---------------------------------------------------------------------------
// Schedule types re-exported so services don't import ZwaveClient
// ---------------------------------------------------------------------------

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

/**
 * Structurally compatible with `ZUIValueIdScene` from ZwaveClient (which has more optional display fields) without importing it, avoiding a circular import
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

export interface SceneNodeState {
	id: number
	values?: Record<string, unknown>
}

export interface ScenePersistencePort<
	V extends ZUISceneValueRef = ZUISceneValueRef,
> {
	get(): ZUISceneRecord<V>[]
	put(data: ZUISceneRecord<V>[]): Promise<ZUISceneRecord<V>[]>
}

export interface SceneNodeStorePort {
	getNode(nodeId: number): SceneNodeState | undefined
}

export interface SceneUtilsPort {
	getValueId(v: {
		commandClass: number
		endpoint?: number
		property: string | number
		propertyKey?: string | number | null
	}): string
}

export interface SceneWritePort<V extends ZUISceneValueRef = ZUISceneValueRef> {
	writeValue(valueId: V, value: unknown): Promise<unknown>
}

/** Structurally compatible with `Group` from `api/config/store.ts` */
export interface ZUIGroup {
	id: number
	name: string
	nodeIds: number[]
}

export interface GroupValueEntry {
	value?: unknown
}

export interface GroupZUINode {
	id: number
	name?: string
	values?: Record<string, GroupValueEntry>
}

export type GroupVirtualValueId = Pick<
	VirtualValueID,
	'commandClass' | 'endpoint' | 'property' | 'propertyKey'
>

export interface GroupVirtualNodeHandle {
	getDefinedValueIDs(): GroupVirtualValueId[]
}

export interface GroupDriverPort {
	isDriverReady(): boolean
	getOwnNodeId(): number | undefined
	/** True when the driver has no node list to check yet (permissive) or the id is a known physical node */
	hasPhysicalNode(nodeId: number): boolean
	getMulticastGroup(nodeIds: number[]): GroupVirtualNodeHandle
}

/** Shared with ZwaveClient's broadcast (standard + LR) virtual-node instances, not just multicast groups */
export interface GroupVirtualNodeRegistryPort {
	has(id: number): boolean
	get(id: number): GroupVirtualNodeHandle | undefined
	set(id: number, node: GroupVirtualNodeHandle): void
	delete(id: number): boolean
}

export interface GroupZUINodeStorePort {
	get(id: number): GroupZUINode | undefined
	set(id: number, node: GroupZUINode): void
	delete(id: number): boolean
}

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

/** Kept on ZwaveClient rather than moved here because the broadcast-node lifecycle also depends on these same helpers */
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
		zwaveValue: GroupVirtualValueId,
		value: unknown,
	): GroupValueEntry | null
	newVirtualZUINode(
		nodeId: number,
		name: string,
		kind: 'multicast' | 'broadcast' | 'broadcastLR',
	): GroupZUINode
	throttle(key: string, fn: () => void, wait: number): void
}

export interface GroupPersistencePort {
	get(): ZUIGroup[]
	put(data: ZUIGroup[]): Promise<unknown>
}

export interface AssociationGroupState {
	title: string
	endpoint: number
	value: number
	maxNodes: number
	isLifeline: boolean
	multiChannel: boolean
}

export interface AssociationNodeState {
	id: number
	groups?: AssociationGroupState[]
}

/** Structurally compatible with `ZUIGroupAssociation` from ZwaveClient */
export interface AssociationEntry {
	groupId: number
	nodeId: number
	endpoint?: number
	targetEndpoint?: number
}

export type AssociationControllerHandle = Pick<
	ZWaveController,
	| 'getAllAssociationGroups'
	| 'getAllAssociations'
	| 'checkAssociation'
	| 'addAssociations'
	| 'removeAssociations'
	| 'removeNodeFromAllAssociations'
>

export interface AssociationDriverHandle {
	controller: AssociationControllerHandle
}

export interface AssociationDriverPort {
	getDriver(): AssociationDriverHandle | null
}

export type AssociationZWaveNodeHandle = Pick<ZWaveNode, 'refreshCCValues'>

export interface AssociationNodeStorePort {
	/** Undefined only when the nodeId was never included or has since been removed from the controller */
	getZWaveNode(nodeId: number): AssociationZWaveNodeHandle | undefined
	/** ZUINode registry lookup, used to store the projected groups list */
	getZUINode(nodeId: number): AssociationNodeState | undefined
	emitNodeUpdate(
		node: AssociationNodeState,
		changedProps: DeepPartial<AssociationNodeState>,
	): void
}

export interface AssociationLogPort {
	logNode(
		nodeId: number,
		level: string,
		message: string,
		...args: unknown[]
	): void
}

// ---------------------------------------------------------------------------
// Firmware update types
// ---------------------------------------------------------------------------

export interface FirmwareUpdateNodeState {
	id: number
	firmwareUpdate?: unknown
	availableFirmwareUpdates?: FirmwareUpdateInfo[]
	firmwareUpdatesDismissed?: { [version: string]: boolean }
	lastFirmwareUpdateCheck?: number
}

/**
 * A staged firmware-node projection computed without mutating shared state.
 * Persisted atomically via `persistStagedNodeUpdates`, then applied to
 * shared in-memory state only after persistence succeeds and fence holds.
 */
export interface StagedFirmwareNodeUpdate {
	nodeId: number
	availableFirmwareUpdates: FirmwareUpdateInfo[]
	lastFirmwareUpdateCheck: number
	firmwareUpdatesDismissed: { [version: string]: boolean }
}

export interface FwFileRef {
	name: string
	data: Uint8Array<ArrayBuffer>
	target?: number
}

// ---------------------------------------------------------------------------
// Port: driver access for FirmwareUpdateService
// ---------------------------------------------------------------------------

export interface FirmwareDriverPort {
	getDriver(): {
		controller: {
			getAvailableFirmwareUpdates(
				nodeId: number,
				options?: unknown,
			): Promise<FirmwareUpdateInfo[]>
			getAllAvailableFirmwareUpdates(
				options?: unknown,
			): Promise<Map<number, FirmwareUpdateInfo[]>>
			firmwareUpdateOTA(
				nodeId: number,
				updateInfo: FirmwareUpdateInfo,
			): Promise<FirmwareUpdateResult>
			nodes: { get(nodeId: number): unknown }
		}
		firmwareUpdateOTW(
			dataOrInfo: Uint8Array<ArrayBuffer> | FirmwareUpdateInfo,
		): Promise<OTWFirmwareUpdateResult>
	} | null
	isDriverReady(): boolean
}

// ---------------------------------------------------------------------------
// Port: node store for FirmwareUpdateService
// ---------------------------------------------------------------------------

export interface FirmwareNodeStorePort {
	getNode(nodeId: number): FirmwareUpdateNodeState | undefined
	getStoreNode(nodeId: number): Partial<FirmwareUpdateNodeState> | undefined
	ensureStoreNode(nodeId: number): Partial<FirmwareUpdateNodeState>
	updateStoreNodes(): Promise<void>
	/**
	 * Persist staged firmware-node projections without mutating shared
	 * in-memory state. Writes the staged data to the store nodes and
	 * persists to disk. The caller must fence AFTER this resolves, then
	 * atomically apply to live node/emit.
	 *
	 * NOTE: Once the underlying filesystem write begins it cannot be
	 * cancelled. If a reset races with the write, the on-disk state may
	 * reflect the staged data but the shared in-memory state will NOT be
	 * mutated (no post-reset publication).
	 */
	persistStagedNodeUpdates(
		staged: ReadonlyArray<StagedFirmwareNodeUpdate>,
	): Promise<void>
	emitNodeUpdate(
		node: FirmwareUpdateNodeState,
		changedProps: DeepPartial<FirmwareUpdateNodeState>,
	): void
}

// ---------------------------------------------------------------------------
// Port: socket emission for FirmwareUpdateService
// ---------------------------------------------------------------------------

export interface FirmwareSocketPort {
	sendToSocket(event: string, data: unknown): void
	throttle(key: string, fn: () => void, wait: number): void
	clearThrottle(key: string): void
}

// ---------------------------------------------------------------------------
// Port: configuration for FirmwareUpdateService
// ---------------------------------------------------------------------------

export interface FirmwareConfigPort {
	disableAutomaticFirmwareUpdateChecks: boolean
}

// ---------------------------------------------------------------------------
// Port: backup manager for FirmwareUpdateService
// ---------------------------------------------------------------------------

export interface FirmwareBackupPort {
	backupOnEvent: boolean
	backupNvm(): Promise<unknown>
}

// ---------------------------------------------------------------------------
// Port: firmware file extraction utilities
// ---------------------------------------------------------------------------

export interface FirmwareExtractionPort {
	guessFirmwareFileFormat(
		name: string,
		data: Uint8Array<ArrayBuffer>,
	): FirmwareFileFormat
	extractFirmware(
		data: Uint8Array<ArrayBuffer>,
		format: FirmwareFileFormat,
	): Promise<{ data: Uint8Array<ArrayBuffer>; firmwareTarget?: number }>
	tryUnzipFirmwareFile(data: Uint8Array<ArrayBuffer>):
		| {
				format: FirmwareFileFormat
				filename: string
				rawData: Uint8Array<ArrayBuffer>
		  }
		| undefined
	isUint8Array(value: unknown): value is Uint8Array
}

// ---------------------------------------------------------------------------
// Port: driver access for InclusionCoordinator
// ---------------------------------------------------------------------------

export interface InclusionDriverPort {
	getDriver(): {
		controller: {
			inclusionState: InclusionState | undefined
			beginInclusion(options?: InclusionOptions): Promise<boolean>
			stopInclusion(): Promise<boolean>
			beginExclusion(options: unknown): Promise<boolean>
			stopExclusion(): Promise<boolean>
			replaceFailedNode(
				nodeId: number,
				options?: ReplaceNodeOptions,
			): Promise<boolean>
			beginJoiningNetwork(options: unknown): Promise<JoinNetworkResult>
			stopJoiningNetwork(): Promise<boolean>
		}
		updateOptions(options: unknown): void
	} | null
	isDriverReady(): boolean
}

// ---------------------------------------------------------------------------
// Port: socket emission for InclusionCoordinator
// ---------------------------------------------------------------------------

export interface InclusionSocketPort {
	sendToSocket(event: string, data: unknown): void
}

// ---------------------------------------------------------------------------
// Port: backup manager for InclusionCoordinator
// ---------------------------------------------------------------------------

export interface InclusionBackupPort {
	backupOnEvent: boolean
	backupNvm(): Promise<unknown>
}

// ---------------------------------------------------------------------------
// Port: configuration for InclusionCoordinator
// ---------------------------------------------------------------------------

export interface InclusionConfigPort {
	commandsTimeout: number
	serverEnabled: boolean
}

// ---------------------------------------------------------------------------
// Port: QR code parsing for InclusionCoordinator
// ---------------------------------------------------------------------------

export interface InclusionQRPort {
	parseQRCodeString(qrString: string): Promise<QRProvisioningInformation>
}

// ---------------------------------------------------------------------------
// Port: controller event emission for InclusionCoordinator
// ---------------------------------------------------------------------------

/**
 * Narrow typed port for emitting controller-level events.
 * These events are consumed by Gateway for MQTT publishing.
 */
export interface InclusionControllerEventPort {
	emitControllerEvent(eventName: string, ...args: unknown[]): void
}

// ---------------------------------------------------------------------------
// Port: server manager interaction for InclusionCoordinator
// ---------------------------------------------------------------------------

export interface InclusionServerManagerPort {
	handInclusionControlBack(): void
}
