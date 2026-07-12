import type {
	AllowedValue,
	ConfigurationMetadata,
	Firmware,
	Route,
	SupervisionResult,
	ValueMetadataNumeric,
	ValueMetadataString,
	ZWaveDataRate,
	FirmwareFileFormat,
} from '@zwave-js/core'
import {
	CommandClasses,
	dskToString,
	Duration,
	isUnsupervisedOrSucceeded,
	NODE_ID_BROADCAST,
	NODE_ID_BROADCAST_LR,
	RouteKind,
	SecurityClass,
	SupervisionStatus,
	ZWaveErrorCodes,
	Protocols,
	tryUnzipFirmwareFile,
	extractFirmware,
} from '@zwave-js/core'
import { createDefaultTransportFormat } from '@zwave-js/core/bindings/log/node'
import { applyExternalDriverSettings } from './externalSettings.ts'
import { JSONTransport } from '@zwave-js/log-transport-json'
import type {
	AssociationAddress,
	OTWFirmwareUpdateProgress,
	OTWFirmwareUpdateResult,
	ControllerStatistics,
	DataRate,
	ExclusionOptions,
	FirmwareUpdateCapabilities,
	FirmwareUpdateProgress,
	FirmwareUpdateResult,
	FLiRS,
	FoundNode,
	GetFirmwareUpdatesOptions,
	RebuildRoutesOptions,
	RebuildRoutesStatus,
	InclusionGrant,
	InclusionOptions,
	InclusionResult,
	LifelineHealthCheckResult,
	LifelineHealthCheckSummary,
	NodeInterviewFailedEventArgs,
	NodeStatistics,
	NodeType,
	PlannedProvisioningEntry,
	ProtocolVersion,
	QRProvisioningInformation,
	RefreshInfoOptions,
	ReplaceNodeOptions,
	RouteHealthCheckResult,
	RouteHealthCheckSummary,
	ScheduleEntryLockDailyRepeatingSchedule,
	ScheduleEntryLockSlotId,
	ScheduleEntryLockWeekDaySchedule,
	ScheduleEntryLockYearDaySchedule,
	SetValueAPIOptions,
	SetValueResult,
	SmartStartProvisioningEntry,
	TranslatedValueID,
	ValueID,
	ValueMetadata,
	ValueType,
	ZWaveError,
	ZWaveNode,
	ZWaveNodeEvents,
	ZWaveNodeFirmwareUpdateFinishedCallback,
	ZWaveNodeFirmwareUpdateProgressCallback,
	InterviewProgress,
	ZWaveNodeMetadataUpdatedArgs,
	ZWaveNodeValueAddedArgs,
	ZWaveNodeValueNotificationArgs,
	ZWaveNodeValueRemovedArgs,
	ZWaveNodeValueUpdatedArgs,
	ZWaveNotificationCallback,
	ZWaveOptions,
	ZWavePlusNodeType,
	ZWavePlusRoleType,
	FirmwareUpdateInfo,
	PartialZWaveOptions,
	InclusionUserCallbacks,
	InclusionState,
	LinkReliabilityCheckResult,
	JoinNetworkOptions,
	JoinNetworkResult,
	VirtualNode,
	VirtualValueID,
	Driver,
} from 'zwave-js'
import {
	OTWFirmwareUpdateStatus,
	ControllerStatus,
	ExclusionStrategy,
	FirmwareUpdateStatus,
	guessFirmwareFileFormat,
	InclusionStrategy,
	InterviewStage,
	libVersion,
	MultilevelSwitchCommand,
	NodeStatus,
	QRCodeVersion,
	RemoveNodeReason,
	RFRegion,
	SerialAPISetupCommand,
	setValueFailed,
	SetValueStatus,
	setValueWasUnsupervisedOrSucceeded,
	UserIDStatus,
	ProvisioningEntryStatus,
	JoinNetworkStrategy,
	DriverMode,
	BatteryReplacementStatus,
} from 'zwave-js'
import { getEnumMemberName, parseQRCodeString } from 'zwave-js/Utils'
import { configDbDir, logsDir, nvmBackupsDir, storeDir } from '../config/app.ts'
import type {
	Group,
	NodesStoreFile,
	NodesStoreRecord,
	NodesStoreRecordByHome,
} from '../config/store.ts'
import store from '../config/store.ts'
import jsonStore from './jsonStore.ts'
import * as LogManager from './logger.ts'
import * as utils from './utils.ts'

import { serverVersion, type ZwavejsServer } from '@zwave-js/server'
import type ZwaveServerManager from '../hass/ZwaveServerManager.ts'
import { type ZwaveServerHost } from '../hass/ZwaveServerManager.ts'
import type { Server as SocketServer } from 'socket.io'
import { TypedEventEmitter } from './EventEmitter.ts'
import type { GatewayValue } from './Gateway.ts'

import type { DeviceConfig } from '@zwave-js/config'
import { ConfigManager } from '@zwave-js/config'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import backupManager, { NVM_BACKUP_PREFIX } from './BackupManager.ts'
import { eventToChannel, socketEvents } from './SocketEvents.ts'
import { isUint8Array } from 'node:util/types'
import {
	coerce as semverCoerce,
	gte as semverGte,
	lte as semverLte,
} from 'semver'
import { PkgFsBindings } from './PkgFsBindings.ts'
import { regionSupportsAutoPowerlevel } from './shared.ts'
import { deviceConfigPriorityDir } from './Constants.ts'
import { createRequire } from 'node:module'
import { HassDeviceStore } from '../hass/DeviceStore.ts'
import type {
	HassDevice,
	HassDeviceMap,
	StoreHassDevicesResult,
} from '../hass/types.ts'
import { ScheduleService } from './zwave/ScheduleService.ts'
import { ConfigurationTemplateService } from './zwave/ConfigurationTemplateService.ts'
import {
	ZUIScheduleEntryLockMode,
	type ZUIConfigurationTemplate,
	type ZUIConfigurationTemplateValue,
	type ZUISchedule,
	type ZUIScheduleConfig,
	type ZUISlot,
} from './zwave/ports.ts'
import { SceneService } from './zwave/SceneService.ts'
import { GroupService, GroupServiceGeneration } from './zwave/GroupService.ts'
import { AssociationService } from './zwave/AssociationService.ts'
import { FirmwareUpdateService } from './zwave/FirmwareUpdateService.ts'
import { InclusionCoordinator } from './zwave/InclusionCoordinator.ts'
import { DriverLifecycle } from './zwave/DriverLifecycle.ts'
import type { DriverLifecycleHost } from './zwave/DriverLifecycle.ts'
import {
	ZwaveClientStatus,
	type ZwaveConfig,
	type SensorTypeScale,
} from './zwave/ports.ts'

// Re-exported so every existing importer of these types/const from
// `ZwaveClient` keeps working after they moved to `./zwave/ports.ts`
// (where extracted services can use them without importing this module).
export { ZwaveClientStatus }
export type { ZwaveConfig, SensorTypeScale }

export type { HassDevice } from '../hass/types.ts'
export { ZUIScheduleEntryLockMode }
export type {
	ZUIConfigurationTemplate,
	ZUIConfigurationTemplateValue,
	ZUISchedule,
	ZUIScheduleConfig,
	ZUISlot,
}

export const configManager = new ConfigManager({
	deviceConfigPriorityDir,
})

const logger = LogManager.module('Z-Wave')

const NEIGHBORS_LOCK_REFRESH = 60 * 1000

// Ordered from least verbose to most verbose (matching winston/npm log levels)
const LOG_LEVEL_ORDER = ['error', 'warn', 'info', 'verbose', 'debug', 'silly']

function validateMethods<T extends readonly (keyof ZwaveClient)[]>(
	methods: T,
): T {
	return methods
}

// ZwaveClient Apis that can be called with MQTT apis
export const allowedApis = validateMethods([
	'setNodeName',
	'setNodeLocation',
	'setNodeDefaultSetValueOptions',
	'_createScene',
	'_removeScene',
	'_setScenes',
	'_getScenes',
	'_sceneGetValues',
	'_addSceneValue',
	'_removeSceneValue',
	'_activateScene',
	'_createGroup',
	'_updateGroup',
	'_deleteGroup',
	'_getGroups',
	'refreshNeighbors',
	'getNodeNeighbors',
	'discoverNodeNeighbors',
	'getAssociations',
	'checkAssociation',
	'addAssociations',
	'removeAssociations',
	'removeAllAssociations',
	'removeNodeFromAllAssociations',
	'getNodes',
	'getInfo',
	'refreshValues',
	'refreshCCValues',
	'pollValue',
	'setPowerlevel',
	'setRFRegion',
	'setMaxLRPowerLevel',
	'updateControllerNodeProps',
	'startInclusion',
	'startExclusion',
	'stopInclusion',
	'stopExclusion',
	'replaceFailedNode',
	'hardReset',
	'softReset',
	'rebuildNodeRoutes',
	'getPriorityRoute',
	'setPriorityRoute',
	'assignReturnRoutes',
	'getPriorityReturnRoute',
	'getPrioritySUCReturnRoute',
	'getCustomReturnRoute',
	'getCustomSUCReturnRoute',
	'assignPriorityReturnRoute',
	'assignPrioritySUCReturnRoute',
	'assignCustomReturnRoutes',
	'assignCustomSUCReturnRoutes',
	'deleteReturnRoutes',
	'deleteSUCReturnRoutes',
	'removePriorityRoute',
	'beginRebuildingRoutes',
	'stopRebuildingRoutes',
	'isFailedNode',
	'removeFailedNode',
	'refreshInfo',
	'updateFirmware',
	'firmwareUpdateOTW',
	'abortFirmwareUpdate',
	'dumpNode',
	'getAvailableFirmwareUpdates',
	'getAllAvailableFirmwareUpdates',
	'checkAllNodesFirmwareUpdates',
	'dismissFirmwareUpdate',
	'getNodeFirmwareUpdates',
	'firmwareUpdateOTA',
	'sendCommand',
	'writeValue',
	'writeBroadcast',
	'writeMulticast',
	'driverFunction',
	'checkForConfigUpdates',
	'installConfigUpdate',
	'shutdownZwaveAPI',
	'startLearnMode',
	'stopLearnMode',
	'pingNode',
	'restart',
	'grantSecurityClasses',
	'validateDSK',
	'abortInclusion',
	'backupNVMRaw',
	'restoreNVM',
	'getProvisioningEntries',
	'getProvisioningEntry',
	'unprovisionSmartStartNode',
	'provisionSmartStartNode',
	'parseQRCodeString',
	'checkLifelineHealth',
	'abortHealthCheck',
	'checkRouteHealth',
	'checkLinkReliability',
	'abortLinkReliabilityCheck',
	'syncNodeDateAndTime',
	'manuallyIdleNotificationValue',
	'getSchedules',
	'cancelGetSchedule',
	'setSchedule',
	'setEnabledSchedule',
	'getConfigurationTemplates',
	'createConfigurationTemplate',
	'updateConfigurationTemplate',
	'deleteConfigurationTemplate',
	'applyConfigurationTemplate',
	'importConfigurationTemplates',
	'getDeviceConfigurationParams',
] as const)

export type ZwaveNodeEvents = ZWaveNodeEvents | 'statistics updated'

export type ValueIdObserver = (
	this: ZwaveClient,
	node: ZUINode,
	valueId: ZUIValueId,
) => void

// Define CommandClasses and properties that should be observed
const observedCCProps: {
	[key in CommandClasses]?: Record<string, ValueIdObserver>
} = {
	[CommandClasses.Battery]: {
		level(node, value) {
			const levels: { [key: number]: number } = node.batteryLevels || {}

			levels[value.endpoint] = value.value
			node.batteryLevels = levels
			node.minBatteryLevel = Math.min(...Object.values(levels))

			this.emitNodeUpdate(node, {
				batteryLevels: levels,
				minBatteryLevel: node.minBatteryLevel,
			})
		},
	},
	[CommandClasses['User Code']]: {
		userIdStatus(node, value) {
			const userId = value.propertyKey as number
			const status = value.value as UserIDStatus

			if (!node.userCodes) {
				return
			}

			if (
				status === undefined ||
				status === UserIDStatus.Available ||
				status === UserIDStatus.StatusNotAvailable
			) {
				node.userCodes.available = node.userCodes.available.filter(
					(id) => id !== userId,
				)
			} else {
				node.userCodes.available.push(userId)
			}

			if (status === UserIDStatus.Enabled) {
				node.userCodes.enabled.push(userId)
			} else {
				node.userCodes.enabled = node.userCodes.enabled.filter(
					(id) => id !== userId,
				)
			}

			this.emitNodeUpdate(node, {
				userCodes: node.userCodes,
			})
		},
	},
	[CommandClasses['Node Naming and Location']]: {
		name(node, value) {
			this.setNodeName(node.id, value.value).catch((error) => {
				logger.error(`Error while setting node name: ${error.message}`)
			})
		},
		location(node, value) {
			this.setNodeLocation(node.id, value.value).catch((error) => {
				logger.error(
					`Error while setting node location: ${error.message}`,
				)
			})
		},
	},
}

export type AllowedApis = (typeof allowedApis)[number]

export type ZUIValueIdState = {
	text: string
	value: number | string | boolean
}

export type ZUIClientStatus = {
	driverReady: boolean
	status: boolean
	config: ZwaveConfig
}

export type ZUIGroupAssociation = {
	groupId: number
	nodeId: number
	endpoint?: number
	targetEndpoint?: number
}

export type ZUIValueId = {
	id: string
	nodeId: number
	type: ValueType
	readable: boolean
	writeable: boolean
	toUpdate?: boolean
	description?: string
	label?: string
	default: any
	stateless: boolean
	ccSpecific?: Record<string, unknown>
	min?: number
	max?: number
	step?: number
	allowed?: readonly AllowedValue[]
	unit?: string
	minLength?: number
	maxLength?: number
	states?: ZUIValueIdState[]
	list?: boolean
	lastUpdate?: number
	value?: any
	targetValue?: string
	isCurrentValue?: boolean
	conf?: GatewayValue
	allowManualEntry?: boolean
	destructive?: boolean
	commandClassVersion?: number
} & TranslatedValueID

export type ZUIValueIdScene = ZUIValueId & {
	timeout: number
}

export type ZUIScene = {
	sceneid: number
	label: string
	values: ZUIValueIdScene[]
}

export type ZUIDeviceClass = {
	basic: number
	generic: number
	specific: number
}

export type ZUINodeGroups = {
	title: string
	value: number
	endpoint: number
	maxNodes: number
	isLifeline: boolean
	multiChannel: boolean
}

export type CallAPIResult<T extends AllowedApis> =
	| {
			success: true
			message: string
			result: ReturnType<ZwaveClient[T]>
			args?: Parameters<ZwaveClient[T]>
	  }
	| {
			success: false
			message: string
			args?: Parameters<ZwaveClient[T]>
	  }

export class DriverNotReadyError extends Error {
	public constructor() {
		super('Driver is not ready')

		// We need to set the prototype explicitly
		Object.setPrototypeOf(this, DriverNotReadyError.prototype)
		Object.getPrototypeOf(this).name = 'DriverNotReadyError'
	}
}

export interface BackgroundRSSIValue {
	current: number
	average: number
}

export interface BackgroundRSSIPoint {
	channel0: BackgroundRSSIValue
	channel1: BackgroundRSSIValue
	channel2?: BackgroundRSSIValue
	channel3?: BackgroundRSSIValue
	timestamp: number
}

export interface FwFile {
	name: string
	data: Uint8Array<ArrayBuffer>
	target?: number
}

export interface ZUIEndpoint {
	index: number
	label?: string
	deviceClass: {
		basic: number
		generic: number
		specific: number
	}
}

export type ZUINode = {
	id: number
	deviceConfig?: DeviceConfig
	manufacturerId?: number
	productId?: number
	productLabel?: string
	productDescription?: string
	statistics?: ControllerStatistics | NodeStatistics
	applicationRoute?: Route
	priorityReturnRoute?: Record<number, Route>
	prioritySUCReturnRoute?: Route
	customReturnRoute?: Record<number, Route[]>
	customSUCReturnRoutes?: Route[]
	productType?: number
	manufacturer?: string
	firmwareVersion?: string
	sdkVersion?: string
	protocolVersion?: ProtocolVersion
	zwavePlusVersion?: number | undefined
	zwavePlusNodeType?: ZWavePlusNodeType | undefined
	zwavePlusRoleType?: ZWavePlusRoleType | undefined
	nodeType?: NodeType
	endpointsCount?: number
	endpoints?: ZUIEndpoint[]
	isSecure?: boolean | 'unknown'
	security?: string | undefined
	supportsBeaming?: boolean
	supportsSecurity?: boolean
	supportsTime?: boolean
	isListening?: boolean
	isControllerNode?: boolean
	powerlevel?: number
	measured0dBm?: number
	maxLongRangePowerlevel?: number
	RFRegion?: RFRegion
	rfRegions?: { title: string; value: number }[]
	isFrequentListening?: FLiRS
	isRouting?: boolean
	keepAwake?: boolean
	deviceClass?: ZUIDeviceClass
	neighbors?: number[]
	loc?: string
	name?: string
	hassDevices?: { [key: string]: HassDevice }
	deviceId?: string
	hasDeviceConfigChanged?: boolean
	appliedTemplateContentHashes?: string[]
	hexId?: string
	values?: { [key: string]: ZUIValueId }
	groups?: ZUINodeGroups[]
	ready: boolean
	available: boolean
	failed: boolean
	lastActive?: number
	lastAwake?: number
	dbLink?: string
	maxDataRate?: DataRate
	interviewStage?: keyof typeof InterviewStage
	interviewProgress?: number
	status?: keyof typeof NodeStatus
	inited: boolean
	rebuildRoutesProgress?: RebuildRoutesStatus | undefined
	minBatteryLevel?: number
	batteryLevels?: { [key: number]: number }
	firmwareUpdate?: FirmwareUpdateProgress
	firmwareCapabilities?: FirmwareUpdateCapabilities
	eventsQueue: NodeEvent[]
	bgRSSIPoints?: BackgroundRSSIPoint[]
	schedule?: ZUISchedule
	userCodes?: {
		total: number
		available: number[]
		enabled: number[]
	}
	defaultTransitionDuration?: string
	defaultVolume?: number
	protocol?: Protocols
	supportsLongRange?: boolean
	virtual?: boolean
	/**
	 * Virtual-node discriminator. Undefined for physical nodes; set when
	 * `virtual === true` to identify the kind of virtual node so the UI can
	 * branch on this instead of magic-numeric-ID checks.
	 */
	kind?: 'physical' | 'broadcast' | 'broadcastLR' | 'multicast'
	availableFirmwareUpdates?: FirmwareUpdateInfo[]
	firmwareUpdatesDismissed?: { [version: string]: boolean }
	lastFirmwareUpdateCheck?: number
}

export type NodeEvent = {
	event: ZwaveNodeEvents | 'status changed'
	args: any[]
	time: Date
}

export type ZUIDriverInfo = {
	uptime?: number
	lastUpdate?: number
	status?: ZwaveClientStatus
	cntStatus?: string
	inclusionState?: InclusionState
	appVersion?: string
	zwaveVersion?: string
	serverVersion?: string
	error?: string | undefined
	homeid?: number
	name?: string
	controllerId?: number
	newConfigVersion?: string | undefined
}

export const EventSource = {
	DRIVER: 'driver',
	CONTROLLER: 'controller',
	NODE: 'node',
} as const
export type EventSource = (typeof EventSource)[keyof typeof EventSource]

export interface ZwaveClientEventCallbacks {
	nodeStatus: (node: ZUINode) => void
	nodeLastActive: (node: ZUINode) => void
	nodeInited: (node: ZUINode) => void
	event: (source: EventSource, eventName: string, ...args: any) => void
	scanComplete: () => void
	driverStatus: (status: boolean) => void
	notification: (node: ZUINode, valueId: ZUIValueId, data: any) => void
	nodeRemoved: (node: Partial<ZUINode>) => void
	valueChanged: (
		valueId: ZUIValueId,
		node: ZUINode,
		changed?: boolean,
	) => void
	valueWritten: (valueId: ZUIValueId, node: ZUINode, value: unknown) => void
}

export type ZwaveClientEvents = Extract<keyof ZwaveClientEventCallbacks, string>

class ZwaveClient extends TypedEventEmitter<ZwaveClientEventCallbacks> {
	private cfg: ZwaveConfig
	private socket: SocketServer
	private closed: boolean
	private destroyed = false
	private _driverReady: boolean
	private _nodes: Map<number, ZUINode>
	/**
	 * Holds the live driver-side virtual-node instances (multicast groups +
	 * standard/LR broadcast). Keyed by virtual nodeId.
	 */
	private _virtualNodes: Map<number, VirtualNode>
	private storeNodes: Record<number, Partial<ZUINode>>
	private _devices: Record<string, Partial<ZUINode>>
	private driverInfo: ZUIDriverInfo
	private status: ZwaveClientStatus
	private _error: string | undefined
	private _scanComplete: boolean
	private _cntStatus: string

	private lastUpdate: number

	private _driver: Driver

	/**
	 * Owns the low-level driver lifecycle (creation/options/log transports,
	 * connect/start, retry-backoff timers, statistics, extra log transports,
	 * the official `@zwave-js/server` coordination and idempotent close) plus a
	 * monotonic **generation** counter so a late `driver ready`/`error`/`all
	 * nodes ready`/OTW callback from an obsolete driver can never mutate a
	 * replacement generation's state. The public lifecycle methods below
	 * (`connect`/`close`/`enableStatistics`/…) and the server accessors delegate
	 * to it so the legacy internal/API surface is unchanged. Constructed once
	 * (and reused across `init()`) so the generation/transports/server manager
	 * persist across restarts.
	 */
	private _driverLifecycle: DriverLifecycle

	/**
	 * The narrow {@link ZwaveServerHost} port the server manager uses to reach
	 * back into this client. Every accessor resolves the current value so a
	 * driver/config swap on restart is honoured with nothing captured at
	 * construction time. Public so the `HomeAssistantManager` factory can build a
	 * manager this client then adopts.
	 */
	public buildServerHost(): ZwaveServerHost {
		return {
			getDriver: () => this._driver,
			getConfig: () => this.cfg,
			getHasUserCallbacks: () =>
				this._inclusionCoordinator.hasUserCallbacks,
			onHardReset: () => this.init(),
			logger,
			serverLogger: LogManager.module('Z-Wave-Server'),
		}
	}

	/**
	 * Adopt the HA-owned server manager. Called by `HomeAssistantManager` once,
	 * before the driver connects, so `create()/startIfNeeded()/destroy()` below
	 * all drive the manager the coordinator owns. Idempotent per generation.
	 */
	public adoptServerManager(manager: ZwaveServerManager): void {
		this._driverLifecycle.adoptServerManager(manager)
	}

	/**
	 * The `@zwave-js/server` (`ZwavejsServer`) subsystem this client owns. In
	 * production it is the HA-owned manager adopted via
	 * {@link adoptServerManager}; a directly-constructed client lazily builds a
	 * standalone fallback here on first access. Exposed so the
	 * `HomeAssistantManager` can resolve the current manager across restarts.
	 */
	public get zwaveServer(): ZwaveServerManager {
		return this._driverLifecycle.zwaveServer
	}

	private get server(): ZwavejsServer | null {
		return this._driverLifecycle.server
	}

	private set server(value: ZwavejsServer | null) {
		this._driverLifecycle.server = value
	}

	private statelessTimeouts: Record<string, NodeJS.Timeout>
	private healTimeout: NodeJS.Timeout
	private updatesCheckTimeout: NodeJS.Timeout
	private pollIntervals: Record<string, NodeJS.Timeout>

	private _lockNeighborsRefresh: boolean
	private _scheduleService: ScheduleService
	private _configTemplateService: ConfigurationTemplateService
	private _sceneService: SceneService<ZUIValueIdScene>
	private _groupService: GroupService
	// Generation token for the current GroupService instance; cancelled and replaced on every init(), see GroupServiceGeneration for the cancellation mechanism
	private _groupServiceGeneration: GroupServiceGeneration | undefined
	private _associationService: AssociationService
	private _firmwareUpdateService: FirmwareUpdateService
	private _inclusionCoordinator: InclusionCoordinator

	private nvmEvent: string

	private driverFunctionCache: utils.Snippet[] = []

	// Foreach valueId, we store a callback function to be called when the value changes
	private valuesObservers: Record<string, ValueIdObserver> = {}
	private hassDeviceStore: HassDeviceStore

	private throttledFunctions: Map<
		string,
		{ lastUpdate: number; fn: () => void; timeout: NodeJS.Timeout }
	> = new Map()

	public get driverReady() {
		return this.driver && this._driverReady && !this.closed
	}

	public set driverReady(ready) {
		if (this._driverReady !== ready) {
			this._driverReady = ready
			this.emit('driverStatus', ready)
		}
	}

	public get cntStatus() {
		return this._cntStatus
	}

	public get scanComplete() {
		return this._scanComplete
	}

	public get error() {
		return this._error
	}

	public get driver() {
		return this._driver
	}

	public get nodes() {
		return this._nodes
	}

	public get devices() {
		return this._devices
	}

	public get maxNodeEventsQueueSize() {
		return this.cfg.maxNodeEventsQueueSize || 100
	}

	public get cacheSnippets(): utils.Snippet[] {
		return this.driverFunctionCache
	}

	constructor(config: ZwaveConfig, socket: SocketServer) {
		super()

		this.cfg = config
		this.socket = socket
		this.hassDeviceStore = new HassDeviceStore({
			hasNode: (nodeId) => this._nodes.has(nodeId),
			getNodeDevices: (nodeId) => this._nodes.get(nodeId)?.hassDevices,
			setNodeDevices: (nodeId, devices) => {
				const node = this._nodes.get(nodeId)
				if (node) node.hassDevices = devices
			},
			getStoredNode: (nodeId) => this.storeNodes[nodeId],
			emitNodeUpdate: (nodeId, devices) => {
				const node = this._nodes.get(nodeId)
				if (node) this.emitNodeUpdate(node, { hassDevices: devices })
			},
			updateStoreNodes: () => this.updateStoreNodes(),
		})

		// Keep request locks across restarts while live ports resolve replacement state
		const scheduleDriverPort = {
			getDriver: () => this._driver,
		}
		const scheduleNodeStorePort = {
			getNode: (nodeId: number) => this._nodes.get(nodeId),
			emitNodeUpdate: (
				node: ZUINode,
				changedProps: utils.DeepPartial<ZUINode>,
			) => this.emitNodeUpdate(node, changedProps),
		}
		const scheduleUtilsPort = {
			deepEqual: (a: unknown, b: unknown) => utils.deepEqual(a, b),
		}
		this._scheduleService = new ScheduleService(
			scheduleDriverPort,
			scheduleNodeStorePort,
			scheduleUtilsPort,
		)

		this.init()
	}

	get homeHex() {
		return this.driverInfo.name
	}

	/**
	 * Init internal vars
	 */
	init() {
		this.statelessTimeouts = {}
		this.pollIntervals = {}

		this._lockNeighborsRefresh = false

		this.closed = false
		this.driverReady = false

		this._nodes = new Map()
		this._virtualNodes = new Map()

		const templateDriverPort = {
			getDriver: () => this._driver,
		}
		const templateNodeStorePort = {
			getNode: (nodeId: number) => this._nodes.get(nodeId),
			getNodes: () => this._nodes.entries(),
			getStoreNode: (nodeId: number) => this.storeNodes[nodeId],
			setStoreNode: (nodeId: number, data: Partial<ZUINode>) => {
				if (!this.storeNodes[nodeId]) {
					this.storeNodes[nodeId] = {}
				}
				Object.assign(this.storeNodes[nodeId], data)
			},
			updateStoreNodes: (rebuildRoutes?: boolean) =>
				this.updateStoreNodes(rebuildRoutes),
			emitNodeUpdate: (
				node: ZUINode,
				changedProps: utils.DeepPartial<ZUINode>,
			) => this.emitNodeUpdate(node, changedProps),
			writeValue: (
				valueId: {
					nodeId: number
					commandClass: number
					endpoint: number
					property: number
					propertyKey?: number | null
				},
				value: unknown,
			) => this.writeValue(valueId as ZUIValueId, value),
			logNode: (zwaveNode: ZWaveNode, level: string, message: string) =>
				this.logNode(zwaveNode, level as LogManager.LogLevel, message),
			throttle: (key: string, fn: () => void, wait: number) =>
				this.throttle(key, fn, wait),
		}
		const templatePersistencePort = {
			get: () => jsonStore.get(store.configurationTemplates),
			put: (data: ZUIConfigurationTemplate[]) =>
				jsonStore.put(store.configurationTemplates, data),
		}
		const templateUtilsPort = {
			generateId: () => utils.generateId(),
		}
		this._configTemplateService = new ConfigurationTemplateService(
			templateDriverPort,
			templateNodeStorePort,
			templatePersistencePort,
			templateUtilsPort,
			logger,
			jsonStore.get(store.configurationTemplates),
			configManager,
		)

		const scenePersistencePort = {
			get: () => jsonStore.get(store.scenes),
			put: (data: ZUIScene[]) => jsonStore.put(store.scenes, data),
		}
		const sceneNodeStorePort = {
			getNode: (nodeId: number) => this._nodes.get(nodeId),
		}
		const sceneUtilsPort = {
			getValueId: (v: Partial<ZUIValueId>) => this._getValueID(v),
		}
		const sceneWritePort = {
			writeValue: (valueId: ZUIValueIdScene, value: unknown) =>
				this.writeValue(valueId, value),
		}
		this._sceneService = new SceneService<ZUIValueIdScene>(
			scenePersistencePort,
			sceneNodeStorePort,
			sceneUtilsPort,
			sceneWritePort,
			logger,
			jsonStore.get(store.scenes),
		)

		const groupDriverPort = {
			isDriverReady: () => this.driverReady,
			getOwnNodeId: () => this._driver?.controller?.ownNodeId,
			hasPhysicalNode: (id: number) => {
				const knownPhysicalIds = this._driver?.controller?.nodes
				return !knownPhysicalIds || knownPhysicalIds.has(id)
			},
			getMulticastGroup: (nodeIds: number[]) =>
				this._driver.controller.getMulticastGroup(nodeIds),
		}
		// this._virtualNodes is replaced with a new Map on every restart; resolving it fresh here (not capturing a reference) keeps an in-flight call from a superseded generation from writing into an abandoned map
		const groupVirtualNodeRegistryPort = {
			has: (id: number) => this._virtualNodes.has(id),
			get: (id: number) => this._virtualNodes.get(id),
			set: (id: number, node: VirtualNode) => {
				this._virtualNodes.set(id, node)
			},
			delete: (id: number) => this._virtualNodes.delete(id),
		}
		const groupZUINodeStorePort = {
			get: (id: number) => this._nodes.get(id),
			set: (id: number, node: ZUINode) => this._nodes.set(id, node),
			delete: (id: number) => this._nodes.delete(id),
		}
		const groupSocketPort = {
			sendToSocket: (event: string, data: unknown) =>
				this.sendToSocket(event, data),
			emitNodeUpdate: (
				node: ZUINode,
				changedProps: utils.DeepPartial<ZUINode>,
			) => this.emitNodeUpdate(node, changedProps),
			emitValueChanged: (
				valueId: ZUIValueId,
				node: ZUINode,
				changed: boolean,
			) => this.emit('valueChanged', valueId, node, changed),
		}
		const groupUtilsPort = {
			deepEqual: (a: unknown, b: unknown) => utils.deepEqual(a, b),
			getValueId: (v: Partial<ZUIValueId>) => this._getValueID(v),
			buildVirtualValueId: (
				nodeId: number,
				zwaveValue: VirtualValueID,
				value: unknown,
			) => this._buildVirtualValueId(nodeId, zwaveValue, value),
			newVirtualZUINode: (
				nodeId: number,
				name: string,
				kind: NonNullable<ZUINode['kind']>,
			) => this._newVirtualZUINode(nodeId, name, kind),
			throttle: (key: string, fn: () => void, wait: number) =>
				this.throttle(key, fn, wait),
		}
		const groupPersistencePort = {
			get: () => jsonStore.get(store.groups),
			put: (data: Group[]) => jsonStore.put(store.groups, data),
		}
		// Cancels the previous generation before minting a new one so its in-flight mutations stop touching virtual-node state once superseded; see GroupServiceGeneration for the full mechanism
		this._groupServiceGeneration?.cancel()
		this._groupServiceGeneration = new GroupServiceGeneration()
		this._groupService = new GroupService(
			groupDriverPort,
			groupVirtualNodeRegistryPort,
			groupZUINodeStorePort,
			groupSocketPort,
			groupUtilsPort,
			groupPersistencePort,
			logger,
			this._groupServiceGeneration,
			jsonStore.get(store.groups),
		)

		const associationDriverPort = {
			getDriver: () => this._driver,
		}
		const associationNodeStorePort = {
			getZWaveNode: (nodeId: number) => this.getNode(nodeId),
			getZUINode: (nodeId: number) => this._nodes.get(nodeId),
			emitNodeUpdate: (
				node: ZUINode,
				changedProps: utils.DeepPartial<ZUINode>,
			) => this.emitNodeUpdate(node, changedProps),
		}
		const associationLogPort = {
			logNode: (
				nodeId: number,
				level: string,
				message: string,
				...args: unknown[]
			) =>
				this.logNode(
					nodeId,
					level as LogManager.LogLevel,
					message,
					...args,
				),
		}
		this._associationService = new AssociationService(
			associationDriverPort,
			associationNodeStorePort,
			associationLogPort,
		)

		const firmwareDriverPort = {
			getDriver: () => this._driver,
			isDriverReady: () => this.driverReady,
		}
		const createFirmwarePersistenceRestore = (
			homeHex: string | undefined,
		) => {
			if (!homeHex) {
				return undefined
			}
			const storedNodes = (jsonStore.get(store.nodes) ||
				{}) as NodesStoreRecordByHome
			const previousNodes = Object.fromEntries(
				Object.entries(storedNodes[homeHex] || {}).map(
					([nodeId, node]) => [nodeId, { ...node }],
				),
			)
			return () => this._persistNodesSnapshot(previousNodes, homeHex)
		}
		const firmwareNodeStorePort = {
			getNode: (nodeId: number) => this._nodes.get(nodeId),
			getStoreNode: (nodeId: number) => this.storeNodes[nodeId],
			ensureStoreNode: (nodeId: number) => {
				if (!this.storeNodes[nodeId]) {
					this.storeNodes[nodeId] = {}
				}
				return this.storeNodes[nodeId]
			},
			updateStoreNodes: async () => {
				const homeHex = this.homeHex
				const restore = createFirmwarePersistenceRestore(homeHex)
				await this.updateStoreNodes()
				return restore
			},
			persistStagedNodeUpdates: async (
				staged: ReadonlyArray<{
					nodeId: number
					availableFirmwareUpdates: FirmwareUpdateInfo[]
					lastFirmwareUpdateCheck: number
					firmwareUpdatesDismissed: { [version: string]: boolean }
				}>,
			) => {
				// Persist a detached snapshot so lifecycle fencing controls publication
				const homeHex = this.homeHex
				const restore = createFirmwarePersistenceRestore(homeHex)
				const snapshot: NodesStoreRecord = {}
				for (const key of Object.keys(this.storeNodes)) {
					snapshot[key] = this.storeNodes[key]
				}
				for (const entry of staged) {
					const existing = snapshot[entry.nodeId]
					const cloned: Partial<ZUINode> = existing
						? { ...existing }
						: {}
					cloned.availableFirmwareUpdates =
						entry.availableFirmwareUpdates
					cloned.lastFirmwareUpdateCheck =
						entry.lastFirmwareUpdateCheck
					cloned.firmwareUpdatesDismissed =
						entry.firmwareUpdatesDismissed
					snapshot[entry.nodeId] = cloned
				}
				await this._updateStoreNodesSnapshot(snapshot, true, homeHex)
				return restore
			},
			emitNodeUpdate: (
				node: ZUINode,
				changedProps: utils.DeepPartial<ZUINode>,
			) => this.emitNodeUpdate(node, changedProps),
		}
		const firmwareSocketPort = {
			sendToSocket: (event: string, data: unknown) =>
				this.sendToSocket(event, data),
			throttle: (key: string, fn: () => void, wait: number) =>
				this.throttle(key, fn, wait),
			clearThrottle: (key: string) => this.clearThrottle(key),
		}
		const getClientCfg = () => this.cfg
		const firmwareConfigPort = {
			get disableAutomaticFirmwareUpdateChecks() {
				return !!getClientCfg().disableAutomaticFirmwareUpdateChecks
			},
		}
		const firmwareBackupPort = {
			get backupOnEvent() {
				return backupManager.backupOnEvent
			},
			backupNvm: () => backupManager.backupNvm(),
		}
		const firmwareExtractionPort = {
			guessFirmwareFileFormat: (
				name: string,
				data: Uint8Array<ArrayBuffer>,
			) => guessFirmwareFileFormat(name, data),
			extractFirmware: (
				data: Uint8Array<ArrayBuffer>,
				format: FirmwareFileFormat,
			) => extractFirmware(data, format),
			tryUnzipFirmwareFile: (data: Uint8Array<ArrayBuffer>) =>
				tryUnzipFirmwareFile(data),
			isUint8Array: (value: unknown): value is Uint8Array =>
				isUint8Array(value),
		}
		if (this._firmwareUpdateService) {
			// Preserve the service because generation fencing cancels its in-flight work
			this._firmwareUpdateService.resetGeneration()
		} else {
			this._firmwareUpdateService = new FirmwareUpdateService(
				firmwareDriverPort,
				firmwareNodeStorePort,
				firmwareSocketPort,
				firmwareConfigPort,
				firmwareBackupPort,
				firmwareExtractionPort,
				logger,
				(event: string) => {
					this.nvmEvent = event
				},
			)
		}

		const inclusionDriverPort = {
			getDriver: () => this._driver,
			isDriverReady: () => this.driverReady,
		}
		const inclusionSocketPort = {
			sendToSocket: (event: string, data: unknown) =>
				this.sendToSocket(event, data),
		}
		const inclusionBackupPort = {
			get backupOnEvent() {
				return backupManager.backupOnEvent
			},
			backupNvm: () => backupManager.backupNvm(),
		}
		const inclusionConfigPort = {
			get commandsTimeout() {
				return getClientCfg().commandsTimeout || 0
			},
			get serverEnabled() {
				return !!getClientCfg().serverEnabled
			},
		}
		const inclusionQRPort = {
			parseQRCodeString: (qrString: string) =>
				parseQRCodeString(qrString),
		}
		const inclusionControllerEventPort = {
			emitControllerEvent: (eventName: string, ...args: unknown[]) => {
				this.emit('event', EventSource.CONTROLLER, eventName, ...args)
			},
		}
		if (this._inclusionCoordinator) {
			// Preserve the coordinator because installed driver callbacks capture it
			this._inclusionCoordinator.reset()
		} else {
			this._inclusionCoordinator = new InclusionCoordinator(
				inclusionDriverPort,
				inclusionSocketPort,
				inclusionControllerEventPort,
				inclusionBackupPort,
				inclusionConfigPort,
				inclusionQRPort,
				logger,
				() => this._driverLifecycle.serverManager,
				(event: string) => {
					this.nvmEvent = event
				},
				{
					grantSecurityClasses: socketEvents.grantSecurityClasses,
					validateDSK: socketEvents.validateDSK,
					inclusionAborted: socketEvents.inclusionAborted,
					controller: socketEvents.controller,
				},
			)
		}

		if (this._driverLifecycle) {
			// Reuse the existing lifecycle across restarts so its monotonic
			// generation counter, adopted server manager and registered extra
			// log transports persist. The host closures resolve current state,
			// so nothing needs re-binding here.
		} else {
			this._driverLifecycle = new DriverLifecycle(
				this._buildDriverLifecycleHost(),
			)
		}

		this._devices = {}
		this.driverInfo = {}
		this.healTimeout = null

		this.status = ZwaveClientStatus.CLOSED
	}

	/**
	 * Build the narrow {@link DriverLifecycleHost} port the
	 * {@link DriverLifecycle} service uses to reach back into this client.
	 * Every accessor resolves the CURRENT value so a driver/config swap on
	 * restart is honoured with nothing captured at construction time.
	 */
	private _buildDriverLifecycleHost(): DriverLifecycleHost {
		return {
			getConfig: () => this.cfg,
			getDriver: () => this._driver,
			setDriver: (driver) => {
				this._driver = driver
			},
			isDriverReady: () => this.driverReady,
			isDriverReadyRaw: () => this._driverReady,
			isClosed: () => this.closed,
			setClosed: (closed) => {
				this.closed = closed
			},
			isDestroyed: () => this.destroyed,
			setStatus: (status) => {
				this.status = status
			},
			setDriverReady: (ready) => {
				this.driverReady = ready
			},
			hasConnectedClients: async () =>
				(await this.socket.fetchSockets()).length > 0,
			emitDebug: (message) => {
				this.socket.to('debug').emit(socketEvents.debug, message)
			},
			getInclusionUserCallbacks: () =>
				this._inclusionCoordinator.getUserCallbacks(),
			installUserCallbacks: () => this.setUserCallbacks(),
			persistConfig: async () => {
				const settings = jsonStore.get(store.settings)
				settings.zwave = this.cfg
				await jsonStore.put(store.settings, settings)
			},
			restart: () => this.restart(),
			buildServerHost: () => this.buildServerHost(),
			clearRuntimeOnClose: () => this._clearRuntimeOnClose(),
			finalizeClose: () => {
				this.destroyed = true
				this.removeAllListeners()
			},
			onDriverReady: (generation) => this._onDriverReady(generation),
			onDriverError: (error, skipRestart) =>
				this._onDriverError(error as ZWaveError, skipRestart),
			onScanComplete: () => this._onScanComplete(),
			onBootLoaderReady: () => this._onBootLoaderReady(),
			onOTWFirmwareUpdateProgress: (progress) =>
				this._onOTWFirmwareUpdateProgress(progress),
			onOTWFirmwareUpdateFinished: (result) =>
				this._onOTWFirmwareUpdateFinished(result),
		}
	}

	/**
	 * Clear the per-run timers/throttles owned by this client and reset the
	 * inclusion coordinator + firmware update service generations. Called by
	 * the {@link DriverLifecycle} during {@link close}, after it has cleared its
	 * own restart timer and before it destroys the server and driver. Extracted
	 * verbatim from the middle of the old `close()` so the ordering is
	 * unchanged.
	 */
	private _clearRuntimeOnClose(): void {
		if (this.healTimeout) {
			clearTimeout(this.healTimeout)
			this.healTimeout = null
		}

		if (this.updatesCheckTimeout) {
			clearTimeout(this.updatesCheckTimeout)
			this.updatesCheckTimeout = null
		}

		this._inclusionCoordinator.reset()

		this._firmwareUpdateService.resetGeneration()

		if (this.statelessTimeouts) {
			for (const k in this.statelessTimeouts) {
				clearTimeout(this.statelessTimeouts[k])
				delete this.statelessTimeouts[k]
			}
		}

		if (this.pollIntervals) {
			for (const k in this.pollIntervals) {
				clearTimeout(this.pollIntervals[k])
				delete this.pollIntervals[k]
			}
		}

		for (const [key, entry] of this.throttledFunctions) {
			clearTimeout(entry.timeout)
			this.throttledFunctions.delete(key)
		}
	}

	/**
	 * Restart client connection
	 *
	 */
	async restart(): Promise<void> {
		await this.close(true)
		this.init()
		await this.connect()
	}

	/**
	 * Register an extra log transport that persists across driver restarts.
	 * If the driver is already running, the transport is applied immediately.
	 */
	addExtraLogTransport(transport: any, level?: string): void {
		this._driverLifecycle.addExtraLogTransport(transport, level)
	}

	/**
	 * Remove a previously registered extra log transport.
	 * If the driver is running, the transport is detached immediately.
	 */
	removeExtraLogTransport(transport: any): void {
		this._driverLifecycle.removeExtraLogTransport(transport)
	}

	backoffRestart(): void {
		this._driverLifecycle.backoffRestart()
	}

	/**
	 * Checks if this client is destroyed and if so closes it
	 * @returns True if client is destroyed
	 */
	checkIfDestroyed() {
		return this._driverLifecycle.checkIfDestroyed()
	}

	/**
	 * Used to schedule next network rebuildNodeRoutes at hours: cfg.healHours
	 */
	// scheduleHeal() {
	// 	if (!this.cfg.healNetwork) {
	// 		return
	// 	}

	// 	const now = new Date()
	// 	let start: Date
	// 	const hour = this.cfg.healHour

	// 	if (now.getHours() < hour) {
	// 		start = new Date(
	// 			now.getFullYear(),
	// 			now.getMonth(),
	// 			now.getDate(),
	// 			hour,
	// 			0,
	// 			0,
	// 			0
	// 		)
	// 	} else {
	// 		start = new Date(
	// 			now.getFullYear(),
	// 			now.getMonth(),
	// 			now.getDate() + 1,
	// 			hour,
	// 			0,
	// 			0,
	// 			0
	// 		)
	// 	}

	// 	const wait = start.getTime() - now.getTime()

	// 	if (wait < 0) {
	// 		this.scheduleHeal()
	// 	} else {
	// 		this.healTimeout = setTimeout(() => {
	// 			this.rebuildNodeRoutes()
	// 		}, wait)
	// 	}
	// }

	/**
	 * Call `fn` function at most once every `wait` milliseconds
	 * */
	private throttle(key: string, fn: () => void, wait: number) {
		const entry = this.throttledFunctions.get(key)
		const now = Date.now()

		// first time it's called or wait is already passed since last call
		if (!entry || entry.lastUpdate + wait < now) {
			this.throttledFunctions.set(key, {
				lastUpdate: now,
				fn,
				timeout: null,
			})
			fn()
		} else {
			// if it's called again and no timeout is set, set a timeout to call function
			if (!entry.timeout) {
				entry.timeout = setTimeout(
					() => {
						const oldEntry = this.throttledFunctions.get(key)
						if (oldEntry) {
							oldEntry.lastUpdate = Date.now()
							// clear the timeout so later calls can schedule a
							// new trailing emit
							oldEntry.timeout = null
							// run the most recently queued function, not the one
							// captured when this timeout was scheduled, so the
							// final value of a burst is never dropped
							oldEntry.fn()
						}
					},
					entry.lastUpdate + wait - now,
				)
			}
			// discard the old function and store the new one
			entry.fn = fn
		}
	}

	private clearThrottle(key: string) {
		const entry = this.throttledFunctions.get(key)
		if (entry) {
			if (entry.timeout) {
				clearTimeout(entry.timeout)
			}
			this.throttledFunctions.delete(key)
		}
	}

	/**
	 * Check if a nodeId belongs to a virtual node (broadcast or multicast group)
	 */
	isVirtualNode(nodeId: number): boolean {
		return this._virtualNodes.has(nodeId)
	}

	/**
	 * Returns the driver ZWaveNode object for physical nodes
	 */
	getNode(nodeId: number): ZWaveNode {
		return this._driver.controller.nodes.get(nodeId)
	}

	/**
	 * Returns the virtual node instance (multicast group or broadcast node)
	 */
	getVirtualNode(nodeId: number): VirtualNode | null {
		return this._virtualNodes.get(nodeId) ?? null
	}

	setUserCallbacks() {
		this._inclusionCoordinator.setUserCallbacks()
	}

	removeUserCallbacks() {
		this._inclusionCoordinator.removeUserCallbacks()
	}

	get hasUserCallbacks(): boolean {
		return this._inclusionCoordinator.hasUserCallbacks
	}

	/**
	 * Returns the driver ZWaveNode ValueId object or null
	 */
	getZwaveValue(idString: string): ValueID {
		if (!idString || typeof idString !== 'string') {
			return null
		}

		const parts = idString.split('-')

		if (parts.length < 3) {
			return null
		}

		return {
			commandClass: parseInt(parts[0]),
			endpoint: parseInt(parts[1]),
			property: parts[2],
			propertyKey: parts[3],
		}
	}

	subscribeObservers(node: ZUINode, valueId: ZUIValueId) {
		const valueObserver =
			observedCCProps[valueId.commandClass]?.[valueId.property]

		if (valueObserver) {
			this.valuesObservers[valueId.id] = valueObserver
			valueObserver.call(this, node, valueId)
		}
	}

	/**
	 * Calls driver healNetwork function and schedule next rebuildNodeRoutes
	 *
	 */
	// rebuildNodeRoutes() {
	// 	if (this.healTimeout) {
	// 		clearTimeout(this.healTimeout)
	// 		this.healTimeout = null
	// 	}

	// 	try {
	// 		this.beginRebuildingRoutes()
	// 		logger.info('Network auto rebuildNodeRoutes started')
	// 	} catch (error) {
	// 		logger.error(
	// 			`Error while doing scheduled network rebuildNodeRoutes ${error.message}`,
	// 			error
	// 		)
	// 	}

	// 	// schedule next
	// 	this.scheduleHeal()
	// }

	/**
	 * Used to Update an hass device of a specific node
	 *
	 */
	updateDevice(hassDevice: HassDevice, nodeId: number, deleteDevice = false) {
		this.hassDeviceStore.updateDevice(hassDevice, nodeId, deleteDevice)
	}

	/**
	 * Used to Add a new hass device to a specific node
	 */
	addDevice(hassDevice: HassDevice, nodeId: number) {
		this.hassDeviceStore.addDevice(hassDevice, nodeId)
	}

	/**
	 * Used to update hass devices list of a specific node and store them in `nodes.json`
	 *
	 */
	async storeDevices(
		devices: HassDeviceMap,
		nodeId: number,
		remove: unknown,
	): Promise<StoreHassDevicesResult> {
		return this.hassDeviceStore.storeDevices(devices, nodeId, remove)
	}

	/**
	 * Construct the official `@zwave-js/server` instance and wire its
	 * `error`/`hard reset` listeners. Called from `connect()` right after the
	 * driver is created (and only when `serverEnabled`), so the server always
	 * exists BEFORE the driver becomes ready. Extracted verbatim from
	 * `connect()` so its behavior is unchanged.
	 */
	private _createServer() {
		this.zwaveServer.create()
	}

	/**
	 * Start the official `@zwave-js/server` once the driver is ready and nodes
	 * are restored (called from `_onDriverReady`). The `!this.server['server']`
	 * guard prevents a second `start()` when the driver re-emits `driver ready`
	 * (see #602). Extracted verbatim from `_onDriverReady` so its behavior is
	 * unchanged.
	 */
	private _startServerIfNeeded() {
		this.zwaveServer.startIfNeeded()
	}

	/**
	 * Method used to close client connection, use this before destroy
	 */
	async close(keepListeners = false) {
		await this._driverLifecycle.close(keepListeners)
	}

	getStatus() {
		const status: ZUIClientStatus = {
			driverReady: this.driverReady,
			status: this.driverReady && !this.closed,
			config: this.cfg,
		}

		return status
	}

	/** Used to get the general state of the client. Sent to socket on connection */
	getState() {
		return {
			nodes: this.getNodes(),
			info: this.getInfo(),
			error: this.error,
			cntStatus: this.cntStatus,
			inclusionState: this._inclusionCoordinator.inclusionState,
		}
	}

	/**
	 * If the node supports Schedule Lock CC parses all available schedules and cache them
	 */
	async getSchedules(
		nodeId: number,
		opts: { mode?: ZUIScheduleEntryLockMode; fromCache: boolean } = {
			fromCache: true,
		},
	) {
		return this._scheduleService.getSchedules(nodeId, opts)
	}

	cancelGetSchedule() {
		this._scheduleService.cancelGetSchedule()
	}

	async setSchedule(
		nodeId: number,
		type: 'daily' | 'weekly' | 'yearly',
		schedule: ScheduleEntryLockSlotId &
			(
				| ScheduleEntryLockDailyRepeatingSchedule
				| ScheduleEntryLockWeekDaySchedule
				| ScheduleEntryLockYearDaySchedule
			),
	) {
		return this._scheduleService.setSchedule(nodeId, type, schedule)
	}

	async setEnabledSchedule(nodeId: number, enabled: boolean, userId: number) {
		return this._scheduleService.setEnabledSchedule(nodeId, enabled, userId)
	}

	/**
	 * Populate node `groups`
	 */
	getGroups(nodeId: number, ignoreUpdate = false) {
		return this._associationService.getGroups(nodeId, ignoreUpdate)
	}

	/**
	 * Get an array of current [associations](https://zwave-js.github.io/node-zwave-js/#/api/controller?id=association-interface) of a specific group
	 */
	async getAssociations(
		nodeId: number,
		refresh = false,
	): Promise<ZUIGroupAssociation[]> {
		return this._associationService.getAssociations(nodeId, refresh)
	}

	/**
	 * Check if a given association is allowed
	 */
	checkAssociation(
		source: AssociationAddress,
		groupId: number,
		association: AssociationAddress,
	) {
		return this._associationService.checkAssociation(
			source,
			groupId,
			association,
		)
	}

	/**
	 * Add a node to the array of specified [associations](https://zwave-js.github.io/node-zwave-js/#/api/controller?id=association-interface)
	 */
	async addAssociations(
		source: AssociationAddress,
		groupId: number,
		associations: AssociationAddress[],
		options?: { force?: boolean },
	) {
		return this._associationService.addAssociations(
			source,
			groupId,
			associations,
			options,
		)
	}

	/**
	 * Remove a node from an association group
	 *
	 */
	async removeAssociations(
		source: AssociationAddress,
		groupId: number,
		associations: AssociationAddress[],
	) {
		return this._associationService.removeAssociations(
			source,
			groupId,
			associations,
		)
	}

	/**
	 * Remove all associations
	 */
	async removeAllAssociations(nodeId: number) {
		return this._associationService.removeAllAssociations(nodeId)
	}

	/**
	 * Setting the date and time on a node could be hard, this helper method will set it using the date provided (default to now).
	 *
	 * The following CCs will be used (when supported or necessary) in this process:
	 * - Time Parameters CC
	 * - Clock CC
	 * - Time CC
	 * - Schedule Entry Lock CC (for setting the timezone)
	 */
	syncNodeDateAndTime(nodeId: number, date = new Date()): Promise<boolean> {
		const zwaveNode = this.getNode(nodeId)

		if (zwaveNode) {
			this.logNode(
				zwaveNode,
				'info',
				`Syncing Node ${nodeId} date and time`,
			)

			return zwaveNode.setDateAndTime(date)
		} else {
			this.logNode(
				zwaveNode,
				'warn',
				`Node not found when calling 'syncNodeDateAndTime'`,
			)
		}
	}

	manuallyIdleNotificationValue(valueId: ZUIValueId) {
		const zwaveNode = this.getNode(valueId.nodeId)

		if (zwaveNode) {
			zwaveNode.manuallyIdleNotificationValue(valueId)
		} else {
			this.logNode(
				zwaveNode,
				'warn',
				`Node not found when calling 'manuallyIdleNotificationValue'`,
			)
		}
	}

	/**
	 * Remove node from all associations
	 */
	async removeNodeFromAllAssociations(nodeId: number) {
		return this._associationService.removeNodeFromAllAssociations(nodeId)
	}

	/**
	 * Refresh all nodes neighbors
	 */
	async refreshNeighbors(): Promise<Record<number, number[]>> {
		if (this._lockNeighborsRefresh === true) {
			throw Error('you can refresh neighbors only once every 60 seconds')
		}

		this._lockNeighborsRefresh = true

		// set the timeout here so if something fails later we don't keep the lock
		setTimeout(
			() => (this._lockNeighborsRefresh = false),
			NEIGHBORS_LOCK_REFRESH,
		)

		const toReturn = {}
		// when accessing the controller memory, the Z-Wave radio must be turned off with to avoid resource conflicts and inconsistent data
		await this._driver.controller.toggleRF(false)
		for (const [nodeId, node] of this._nodes) {
			await this.getNodeNeighbors(nodeId, true, false)
			toReturn[nodeId] = node.neighbors
		}
		// turn rf back to on
		await this._driver.controller.toggleRF(true)

		return toReturn
	}

	/**
	 * Get neighbors of a specific node
	 */
	async getNodeNeighbors(
		nodeId: number,
		preventThrow = false,
		emitNodeUpdate = true,
	): Promise<readonly number[]> {
		try {
			if (!this.driverReady) {
				throw new DriverNotReadyError()
			}

			const zwaveNode = this.getNode(nodeId)

			if (zwaveNode.protocol === Protocols.ZWaveLongRange) {
				return []
			}

			const neighbors =
				await this._driver.controller.getNodeNeighbors(nodeId)
			this.logNode(nodeId, 'debug', `Neighbors: ${neighbors.join(', ')}`)
			const node = this.nodes.get(nodeId)

			if (node) {
				node.neighbors = [...neighbors]
				if (emitNodeUpdate) {
					this.emitNodeUpdate(node, {
						neighbors: node.neighbors,
					})
				}
			}

			return neighbors
		} catch (error) {
			this.logNode(
				nodeId,
				'warn',
				`Error while getting neighbors from ${nodeId}: ${error.message}`,
			)

			if (!preventThrow) {
				throw error
			}

			return Promise.resolve([])
		}
	}

	/**
	 * Instructs a node to (re-)discover its neighbors.
	 */
	async discoverNodeNeighbors(nodeId: number): Promise<boolean> {
		if (!this.driverReady) {
			throw new DriverNotReadyError()
		}

		const result =
			await this._driver.controller.discoverNodeNeighbors(nodeId)

		if (result) {
			// update neighbors
			this.getNodeNeighbors(nodeId, true).catch(() => {
				// noop
			})
		}

		return result
	}

	/**
	 * Execute a driver function.
	 * More info [here](/usage/driver_function?id=driver-function)
	 */
	driverFunction(code: string): Promise<any> {
		if (!this.driverReady) {
			throw new DriverNotReadyError()
		}

		if (!this.driverFunctionCache.find((c) => c.content === code)) {
			const name = `CACHED_${this.driverFunctionCache.length}`
			this.driverFunctionCache.push({ name, content: code })
		}

		const AsyncFunction = Object.getPrototypeOf(
			async function () {},
		).constructor

		const fn = new AsyncFunction('driver', code)
		const require = createRequire(import.meta.url)

		return fn.call({ zwaveClient: this, require, logger }, this._driver)
	}

	/**
	 * Method used to start Z-Wave connection using configuration `port`
	 */
	async connect() {
		await this._driverLifecycle.connect()
	}

	private logNode(
		node: ZWaveNode | ZUINode | number,
		level: LogManager.LogLevel,
		message: string,
		...args: any[]
	) {
		const nodeId = typeof node === 'number' ? node : node.id
		logger.log(
			level,
			`[Node ${utils.padNumber(nodeId, 3)}] ${message}`,
			...args,
		)
	}

	private onNodeNameLocationChanged(
		node: ZUINode,
		valueId: ZUIValueId,
		value: string,
	) {
		const prop = valueId.property
		const observer =
			observedCCProps[CommandClasses['Node Naming and Location']]?.[prop]

		if (observer) {
			observer.call(this, node, {
				...valueId,
				value,
			})
		}
	}

	/**
	 * Send an event to socket with `data`
	 *
	 */
	private sendToSocket(evtName: string, data: any, ...args: any[]) {
		if (this.socket) {
			// break the sync loop to let the event loop continue #2676
			process.nextTick(() => {
				const channel = eventToChannel[evtName]
				if (channel) {
					this.socket.to(channel).emit(evtName, data, ...args)
				} else {
					logger.warn(
						`No channel mapping for event ${evtName}, broadcasting to all clients`,
					)
					this.socket.emit(evtName, data, ...args)
				}
			})
		}
	}

	private async sendInitToSockets() {
		const sockets = await this.socket.fetchSockets()

		for (const socket of sockets) {
			// force send init to all connected sockets
			socket.emit(socketEvents.init, this.getState())
		}
	}

	public emitValueChanged(
		valueId: ZUIValueId,
		node: ZUINode,
		changed: boolean,
	) {
		valueId.lastUpdate =
			this.getNode(valueId.nodeId)?.getValueTimestamp(valueId) ??
			Date.now()

		// Skip the socket broadcast when the value didn't actually change.
		// Chatty meshes can produce ~50% no-op value updates (see #4639) and
		// each one triggers an unnecessary re-render of the nodes table.
		// MQTT/HASS still get every event via the local 'valueChanged' below.
		if (changed) {
			this.sendToSocket(socketEvents.valueUpdated, valueId)
		}

		this.emit('valueChanged', valueId, node, changed)

		// Update virtual nodes that contain this node
		this._groupService.updateVirtualNodesForNode(valueId.nodeId)
	}

	public emitStatistics(
		node: ZUINode,
		props: Pick<
			ZUINode,
			| 'statistics'
			| 'lastActive'
			| 'applicationRoute'
			| 'customSUCReturnRoutes'
			| 'customReturnRoute'
			| 'prioritySUCReturnRoute'
			| 'priorityReturnRoute'
		> & { bgRssi?: ControllerStatistics['backgroundRSSI'] },
	) {
		// NB: be sure that when `statistics` is defined also `lastActive` must be.
		// when removing props them should be set to null or false in order to be removed on ui
		this.sendToSocket(socketEvents.statistics, {
			nodeId: node.id,
			...Object.keys(props).reduce((acc, k) => {
				if (props[k] === null) acc[k] = false
				else acc[k] = props[k]
				return acc
			}, {} as any),
		})
	}

	public emitNodeUpdate(
		node: ZUINode,
		changedProps?: utils.DeepPartial<ZUINode>,
	) {
		if (node.ready && !node.inited) {
			node.inited = true
			this.emit('nodeInited', node)
		}

		const isPartial = !!changedProps

		if (!isPartial || utils.hasProperty(changedProps, 'status')) {
			this.emit('nodeStatus', node)
		}

		if (isPartial) {
			// we need it to have a reference of the node to update
			changedProps.id = node.id
		}

		this.sendToSocket(
			socketEvents.nodeUpdated,
			changedProps ?? node,
			isPartial,
		)
	}

	// ------------NODES MANAGEMENT-----------------------------------

	async getStoreNodes() {
		if (!this.homeHex) {
			throw new Error('HomeHex not set')
		}

		let nodes: NodesStoreFile = jsonStore.get(store.nodes)

		// back compatibility fixes

		// convert store nodes from array to object
		if (Array.isArray(nodes)) {
			const storeNodes: NodesStoreRecord = {}

			for (let i = 0; i < nodes.length; i++) {
				if (nodes[i]) {
					storeNodes[i] = nodes[i]
				}
			}

			nodes = storeNodes
		}

		const keys = Object.keys(nodes)

		// ensure store nodes are stored using homeHex
		if (keys.length > 0 && !keys[0].startsWith('0x')) {
			const legacyFlatNodes = nodes as NodesStoreRecord
			this.storeNodes = legacyFlatNodes
			await jsonStore.put(store.nodes, {
				[this.homeHex]: legacyFlatNodes,
			})
		} else {
			this.storeNodes =
				(nodes as NodesStoreRecordByHome)[this.homeHex] || {}
		}
	}

	private async _persistNodesSnapshot(
		snapshot: NodesStoreRecord,
		homeHex = this.homeHex,
	): Promise<void> {
		if (!homeHex) {
			logger.warn('HomeHex not set, skipping storeDevices')
			return
		}

		// Requires that getStoreNodes ran first to migrate legacy shapes
		const storedNodes = jsonStore.get(store.nodes) as NodesStoreRecordByHome
		const nodes = { ...storedNodes }

		nodes[homeHex] = Object.keys(snapshot).reduce((acc, k) => {
			if (Object.keys(snapshot[k]).length > 0) {
				acc[k] = snapshot[k]
			}
			return acc
		}, {} as NodesStoreRecord)

		logger.debug('Updating store nodes.json')
		await jsonStore.put(store.nodes, nodes)
	}

	private async _updateStoreNodesSnapshot(
		snapshot: NodesStoreRecord,
		throwError = true,
		homeHex = this.homeHex,
	): Promise<void> {
		try {
			await this._persistNodesSnapshot(snapshot, homeHex)
		} catch (error) {
			logger.error(
				`Error while updating store nodes: ${error.message}`,
				error,
			)
			if (throwError) {
				throw error
			}
		}
	}

	async updateStoreNodes(throwError = true) {
		await this._updateStoreNodesSnapshot(this.storeNodes, throwError)
	}

	/**
	 * Updates node `name` property and stores updated config in `nodes.json`
	 */
	async setNodeName(nodeid: number, name: string) {
		if (!this.storeNodes[nodeid]) {
			this.storeNodes[nodeid] = {} as ZUINode
		}

		const node = this._nodes.get(nodeid)
		const zwaveNode = this.getNode(nodeid)

		if (zwaveNode && node) {
			node.name = name
			if (zwaveNode.name !== name) {
				zwaveNode.name = name
			}
		} else {
			throw Error('Invalid Node ID')
		}

		this.storeNodes[nodeid].name = name

		await this.updateStoreNodes()

		this.emitNodeUpdate(node, { name: name })

		return true
	}

	/**
	 * Updates node `loc` property and stores updated config in `nodes.json`
	 */
	async setNodeLocation(nodeid: number, loc: string) {
		if (!this.storeNodes[nodeid]) {
			this.storeNodes[nodeid] = {}
		}

		const node = this._nodes.get(nodeid)
		const zwaveNode = this.getNode(nodeid)

		if (node) {
			node.loc = loc
			if (zwaveNode.location !== loc) {
				zwaveNode.location = loc
			}
		} else {
			throw Error('Invalid Node ID')
		}

		this.storeNodes[nodeid].loc = loc

		await this.updateStoreNodes()
		this.emitNodeUpdate(node, { loc: loc })
		return true
	}

	setNodeDefaultSetValueOptions(
		nodeId: number,
		props: Pick<ZUINode, 'defaultTransitionDuration' | 'defaultVolume'>,
	) {
		const node = this._nodes.get(nodeId)
		const zwaveNode = this.getNode(nodeId)

		if (!zwaveNode) {
			throw Error('Invalid Node ID')
		}

		for (const k in props) {
			zwaveNode[k] = props[k]
			if (node) node[k] = props[k]
		}
	}

	// ------------SCENES MANAGEMENT-----------------------------------
	/**
	 * Creates a new scene with a specific `label` and stores it in `scenes.json`
	 */
	async _createScene(label: string) {
		return this._sceneService.createScene(label)
	}

	/**
	 * Delete a scene with a specific `sceneid` and updates `scenes.json`
	 */
	async _removeScene(sceneid: number) {
		return this._sceneService.removeScene(sceneid)
	}

	/**
	 * Imports scenes Array in `scenes.json`
	 */
	async _setScenes(scenes: ZUIScene[]) {
		return this._sceneService.setScenes(scenes)
	}

	/**
	 * Get all scenes
	 *
	 */
	_getScenes(): ZUIScene[] {
		return this._sceneService.getScenes()
	}

	/**
	 * Return all values of the scene with given `sceneid`
	 */
	_sceneGetValues(sceneid: number) {
		return this._sceneService.sceneGetValues(sceneid)
	}

	/**
	 * Add a value to a scene
	 *
	 */
	async _addSceneValue(
		sceneid: number,
		valueId: ZUIValueIdScene,
		value: any,
		timeout: number,
	): Promise<ZUIScene[]> {
		return this._sceneService.addSceneValue(
			sceneid,
			valueId,
			value,
			timeout,
		)
	}

	/**
	 * Remove a value from scene
	 */
	async _removeSceneValue(
		sceneid: number,
		valueId: ZUIValueIdScene,
	): Promise<ZUIScene[]> {
		return this._sceneService.removeSceneValue(sceneid, valueId)
	}

	/**
	 * Activate a scene with given scene id
	 */
	_activateScene(sceneId: number): boolean {
		return this._sceneService.activateScene(sceneId)
	}

	// === GROUPS MANAGEMENT ===

	async _createGroup(name: string, nodeIds: number[]): Promise<Group> {
		return this._groupService.createGroup(name, nodeIds)
	}

	async _updateGroup(
		id: number,
		name: string,
		nodeIds: number[],
	): Promise<Group | null> {
		return this._groupService.updateGroup(id, name, nodeIds)
	}

	async _deleteGroup(id: number): Promise<boolean> {
		return this._groupService.deleteGroup(id)
	}

	/**
	 * Get all groups
	 */
	_getGroups(): Group[] {
		return this._groupService.getGroups()
	}

	// ------------ CONFIGURATION TEMPLATES MANAGEMENT -----------------------------------

	/**
	 * Get all configuration templates
	 */
	getConfigurationTemplates(): ZUIConfigurationTemplate[] {
		return this._configTemplateService.getConfigurationTemplates()
	}

	/**
	 * Get configuration parameter definitions from the zwave-js config DB
	 * for a device identified by its deviceId (manufacturerId-productId-productType)
	 */
	async getDeviceConfigurationParams(
		deviceId: string,
	): Promise<Partial<ZUIValueId>[]> {
		return this._configTemplateService.getDeviceConfigurationParams(
			deviceId,
		) as Promise<Partial<ZUIValueId>[]>
	}

	/**
	 * Create a configuration template from a node's CC 112 values
	 */
	async createConfigurationTemplate(
		nodeId: number,
		name: string,
		autoApply = false,
		values?: ZUIConfigurationTemplateValue[],
		firmwareRange?: { min?: string; max?: string },
	): Promise<ZUIConfigurationTemplate> {
		return this._configTemplateService.createConfigurationTemplate(
			nodeId,
			name,
			autoApply,
			values,
			firmwareRange,
		)
	}

	/**
	 * Update an existing configuration template
	 */
	async updateConfigurationTemplate(
		id: string,
		updates: {
			name?: string
			autoApply?: boolean
			firmwareRange?: { min?: string; max?: string }
			values?: ZUIConfigurationTemplateValue[]
		},
	): Promise<ZUIConfigurationTemplate> {
		return this._configTemplateService.updateConfigurationTemplate(
			id,
			updates,
		)
	}

	/**
	 * Delete a configuration template
	 */
	async deleteConfigurationTemplate(id: string): Promise<boolean> {
		return this._configTemplateService.deleteConfigurationTemplate(id)
	}

	/**
	 * Build a fresh ZUINode shell for a virtual node (broadcast/multicast).
	 */
	private _newVirtualZUINode(
		id: number,
		name: string,
		kind: NonNullable<ZUINode['kind']>,
	): ZUINode {
		return {
			id,
			name,
			virtual: true,
			kind,
			ready: true,
			available: true,
			failed: false,
			inited: true,
			values: {},
			eventsQueue: [],
		}
	}

	/**
	 * Apply a configuration template to a node
	 */
	async applyConfigurationTemplate(
		templateId: string,
		nodeId: number,
		force = false,
	): Promise<{
		success: number
		failed: number
		errors: string[]
		reason?: string
	}> {
		return this._configTemplateService.applyConfigurationTemplate(
			templateId,
			nodeId,
			force,
		)
	}

	/**
	 * Import configuration templates (extends existing templates)
	 */
	async importConfigurationTemplates(
		templates: ZUIConfigurationTemplate[],
	): Promise<ZUIConfigurationTemplate[]> {
		return this._configTemplateService.importConfigurationTemplates(
			templates,
		)
	}

	/**
	 * Build a ZUIValueId for a virtual node (broadcast/multicast) from a value
	 * ID returned by VirtualNode.getDefinedValueIDs().
	 *
	 * zwave-js returns value IDs with inline `.metadata` and `.ccVersion`
	 * already resolved from the physical nodes. We mirror the structure that
	 * `_updateValueMetadata()` produces for physical nodes so the frontend
	 * renders the same controls (select, number input, boolean toggle, etc.).
	 */
	private _buildVirtualValueId(
		nodeId: number,
		zwaveValue: VirtualValueID,
		value?: unknown,
	): ZUIValueId | null {
		const meta = zwaveValue.metadata
		if (!meta) return null

		// VirtualValueID always carries ccVersion, but be defensive in case
		// older zwave-js builds omit it for synthesized Basic CC entries.
		const ccVersion =
			typeof zwaveValue.ccVersion === 'number' && zwaveValue.ccVersion > 0
				? zwaveValue.ccVersion
				: 1

		// Preserve any existing fields on the previous valueId (e.g. user-set
		// poll config) so rebuilds don't drop them — mirrors the spread used
		// in `_updateValueMetadata` for physical nodes.
		const existing =
			this._nodes.get(nodeId)?.values?.[
				this._getValueID(zwaveValue as unknown as ZUIValueId)
			]

		const valueId: ZUIValueId = {
			...(existing || {}),
			id: this._getValueID(
				{ ...zwaveValue, nodeId } as unknown as ZUIValueId,
				true,
			),
			nodeId,
			toUpdate: false,
			commandClass: zwaveValue.commandClass,
			commandClassName: zwaveValue.commandClassName,
			endpoint: zwaveValue.endpoint,
			property: zwaveValue.property,
			propertyName: zwaveValue.propertyName,
			propertyKey: zwaveValue.propertyKey,
			propertyKeyName: zwaveValue.propertyKeyName,
			type: meta.type,
			readable: meta.readable ?? false,
			writeable: meta.writeable ?? true,
			description: meta.description,
			label: meta.label || zwaveValue.propertyName + ' (property)',
			default: meta.default,
			ccSpecific: meta.ccSpecific,
			stateless: false,
			commandClassVersion: ccVersion,
			value,
			lastUpdate: Date.now(),
		}

		this._applyValueMetadataFields(valueId, meta)

		return valueId
	}

	/**
	 * Populate values for broadcast virtual nodes (standard + LR).
	 *
	 * Like multicast groups, broadcast nodes expose the union of all writeable
	 * actuator value IDs across the entire network (or LR network). All values
	 * are write-only (`value: undefined`) since broadcast commands cannot be
	 * read back.
	 *
	 * Uses leading-edge throttling: the first call after a quiet period runs
	 * synchronously (so users see broadcast controls immediately on startup),
	 * while bursts of node-ready / node-added / node-removed events during a
	 * controller interview are coalesced into a single trailing rebuild.
	 */
	private _updateBroadcastNodeValues(): void {
		if (!this.driverReady) return

		// Keep the cached instances in sync with the driver *synchronously*, so
		// the write-back path (`getVirtualNode` → `setValue`) never targets a
		// removed node even before the throttled value rebuild below runs.
		this._refreshBroadcastInstances()

		this.throttle(
			'broadcast_values_rebuild',
			() => this._doUpdateBroadcastNodeValues(),
			1000,
		)
	}

	/**
	 * Re-fetch the cached broadcast VirtualNode instances from the controller.
	 *
	 * The driver snapshots the physical node set when a broadcast node is
	 * constructed, so a long-lived instance keeps referencing nodes that have
	 * since been removed — using one then throws "Node X was not found" (#4677),
	 * both when enumerating values and when sending a write. Re-fetching is
	 * cheap (it just wraps the controller's current node set), so we do it
	 * eagerly on every node-set change. Only instances that currently exist are
	 * refreshed; the LR broadcast node exists solely while the network has LR
	 * nodes (see `_refreshBroadcastLRNode`).
	 */
	private _refreshBroadcastInstances(): void {
		if (!this.driverReady) return

		const controller = this._driver.controller

		if (this._virtualNodes.has(NODE_ID_BROADCAST)) {
			this._virtualNodes.set(
				NODE_ID_BROADCAST,
				controller.getBroadcastNode(),
			)
		}

		if (this._virtualNodes.has(NODE_ID_BROADCAST_LR)) {
			this._virtualNodes.set(
				NODE_ID_BROADCAST_LR,
				controller.getBroadcastNodeLR(),
			)
		}
	}

	private _doUpdateBroadcastNodeValues(): void {
		if (!this.driverReady) return

		const broadcastNodeIds = [NODE_ID_BROADCAST, NODE_ID_BROADCAST_LR]

		for (const nodeId of broadcastNodeIds) {
			try {
				// The cached instances are kept current by
				// `_refreshBroadcastInstances`, so they already reflect the
				// live node set (no removed nodes) by the time we get here.
				const broadcastInstance = this._virtualNodes.get(nodeId)
				const virtualNode = this._nodes.get(nodeId)

				if (!broadcastInstance || !virtualNode) continue

				const definedValueIds = broadcastInstance.getDefinedValueIDs()

				virtualNode.values = {}

				for (const zwaveValue of definedValueIds) {
					const valueId = this._buildVirtualValueId(
						nodeId,
						zwaveValue,
						undefined, // broadcast values are write-only
					)
					if (!valueId) continue

					const vID = this._getValueID(valueId)
					virtualNode.values[vID] = valueId
				}

				// Emit valueChanged for each value so the MQTT gateway
				// publishes them and registers topics for write-back
				for (const vID in virtualNode.values) {
					this.emit(
						'valueChanged',
						virtualNode.values[vID],
						virtualNode,
						true,
					)
				}

				this.sendToSocket(socketEvents.nodeUpdated, virtualNode)
			} catch (error) {
				logger.error(
					`Error updating broadcast node ${nodeId} values: ${error.message}`,
				)
			}
		}
	}

	/**
	 * Create broadcast virtual nodes (standard + optional LR).
	 *
	 * Broadcast nodes send commands to every node in the network. The LR
	 * broadcast node is only created when the controller actually has at least
	 * one LR-capable physical node — exposing it on a controller that merely
	 * *supports* LR is misleading.
	 */
	private _createBroadcastNodes(): void {
		if (!this.driverReady) return

		try {
			// Standard broadcast — always available.
			const broadcastNode = this._driver.controller.getBroadcastNode()
			this._virtualNodes.set(NODE_ID_BROADCAST, broadcastNode)

			const broadcastVirtualNode = this._newVirtualZUINode(
				NODE_ID_BROADCAST,
				'Broadcast',
				'broadcast',
			)

			this._nodes.set(NODE_ID_BROADCAST, broadcastVirtualNode)
			this.sendToSocket(socketEvents.nodeUpdated, broadcastVirtualNode)

			this._refreshBroadcastLRNode()

			this._updateBroadcastNodeValues()
		} catch (error) {
			logger.error(`Error creating broadcast nodes: ${error.message}`)
		}
	}

	/**
	 * Add or remove the LR broadcast virtual node depending on whether any LR
	 * physical node is currently part of the network. Called whenever the
	 * physical node set changes.
	 */
	private _refreshBroadcastLRNode(): void {
		if (!this.driverReady) return

		const controller = this._driver.controller
		const hasLRNodes =
			controller.supportsLongRange &&
			[...controller.nodes.values()].some(
				(n) => n.protocol === Protocols.ZWaveLongRange,
			)

		const exists = this._virtualNodes.has(NODE_ID_BROADCAST_LR)

		if (hasLRNodes && !exists) {
			try {
				const broadcastNodeLR = controller.getBroadcastNodeLR()
				this._virtualNodes.set(NODE_ID_BROADCAST_LR, broadcastNodeLR)

				const lrNode = this._newVirtualZUINode(
					NODE_ID_BROADCAST_LR,
					'Broadcast LR',
					'broadcastLR',
				)
				this._nodes.set(NODE_ID_BROADCAST_LR, lrNode)
				this.sendToSocket(socketEvents.nodeUpdated, lrNode)
			} catch (error) {
				logger.warn(`LR broadcast node not available: ${error.message}`)
			}
		} else if (!hasLRNodes && exists) {
			this._virtualNodes.delete(NODE_ID_BROADCAST_LR)
			this._nodes.delete(NODE_ID_BROADCAST_LR)
			this.sendToSocket(socketEvents.nodeRemoved, {
				id: NODE_ID_BROADCAST_LR,
			})
		}
	}

	private _checkConfigurationTemplates(node: ZUINode, zwaveNode: ZWaveNode) {
		this._configTemplateService.checkConfigurationTemplates(node, zwaveNode)
	}

	/**
	 * Get the nodes array
	 */
	getNodes(): ZUINode[] {
		const toReturn = []

		for (const [, node] of this._nodes) {
			toReturn.push(node)
		}
		return toReturn
	}

	/**
	 * Enable Statistics
	 *
	 */
	enableStatistics() {
		this._driverLifecycle.enableStatistics()
	}

	/**
	 * Disable Statistics
	 *
	 */
	disableStatistics() {
		this._driverLifecycle.disableStatistics()
	}

	getInfo() {
		const info = Object.assign({}, this.driverInfo)

		info.uptime = process.uptime()
		info.lastUpdate = this.lastUpdate
		info.status = this.status
		info.error = this.error
		info.cntStatus = this._cntStatus
		info.inclusionState = this._inclusionCoordinator.inclusionState
		info.appVersion = utils.getVersion()
		info.zwaveVersion = libVersion
		info.serverVersion = serverVersion

		return info
	}

	/**
	 * Refresh all node values
	 */
	refreshValues(nodeId: number): Promise<void> {
		if (this.driverReady) {
			const zwaveNode = this.getNode(nodeId)

			return zwaveNode.refreshValues()
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Ping a node
	 */
	pingNode(nodeId: number): Promise<boolean> {
		if (this.driverReady) {
			const zwaveNode = this.getNode(nodeId)

			return zwaveNode.ping()
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Refresh all node values of a specific CC
	 */
	refreshCCValues(nodeId: number, cc: CommandClasses): Promise<void> {
		if (this.driverReady) {
			const zwaveNode = this.getNode(nodeId)

			return zwaveNode.refreshCCValues(cc)
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Set a poll interval
	 */
	setPollInterval(valueId: ZUIValueId, interval: number) {
		if (this.driverReady) {
			const vID = this._getValueID(valueId, true)

			if (this.pollIntervals[vID]) {
				clearTimeout(this.pollIntervals[vID])
			}

			logger.debug(`${vID} will be polled in ${interval} seconds`)

			this.pollIntervals[vID] = setTimeout(
				this._tryPoll.bind(this, valueId, interval),
				interval * 1000,
			)
		} else {
			throw new DriverNotReadyError()
		}
	}

	/**
	 * Checks for configs updates
	 *
	 */
	async checkForConfigUpdates(): Promise<string | undefined> {
		if (this.driverReady) {
			this.driverInfo.newConfigVersion =
				await this._driver.checkForConfigUpdates()
			this.sendToSocket(socketEvents.info, this.getInfo())
			return this.driverInfo.newConfigVersion
		} else {
			throw new DriverNotReadyError()
		}
	}

	/**
	 * Checks for configs updates and installs them
	 *
	 */
	async installConfigUpdate(): Promise<boolean> {
		if (this.driverReady) {
			const updated = await this._driver.installConfigUpdate()
			if (updated) {
				this.driverInfo.newConfigVersion = undefined
				this.sendToSocket(socketEvents.info, this.getInfo())
			}
			return updated
		} else {
			throw new DriverNotReadyError()
		}
	}

	/**
	 * If supported by the controller, this instructs it to shut down the Z-Wave API, so it can safely be removed from power. If this is successful (returns `true`), the driver instance will be destroyed and can no longer be used.
	 *
	 * > [!WARNING] The controller will have to be restarted manually (e.g. by unplugging and plugging it back in) before it can be used again!
	 */
	async shutdownZwaveAPI(): Promise<boolean> {
		if (this.driverReady) {
			logger.info('Shutting down ZwaveJS driver...')
			const success = await this._driver.shutdown()
			return success
		} else {
			throw new DriverNotReadyError()
		}
	}

	/**
	 * Stops learn mode
	 */
	stopLearnMode(): Promise<boolean> {
		if (this.driverReady) {
			return this._inclusionCoordinator.stopLearnMode()
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Starts learn mode
	 */
	async startLearnMode(): Promise<JoinNetworkResult> {
		if (this.driverReady) {
			return this._inclusionCoordinator.startLearnMode(
				JoinNetworkStrategy.Default,
			)
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Request an update of this value
	 *
	 */
	pollValue(valueId: ZUIValueId): Promise<unknown> {
		if (this.driverReady) {
			const zwaveNode = this.getNode(valueId.nodeId)

			logger.debug(`Polling value ${this._getValueID(valueId)}`)

			return zwaveNode.pollValue(valueId)
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Replace failed node
	 */
	async replaceFailedNode(
		nodeId: number,
		strategy: InclusionStrategy = InclusionStrategy.Security_S2,
		options?: {
			qrString?: string
			provisioning?: PlannedProvisioningEntry
		},
	): Promise<boolean> {
		if (!this.driverReady) {
			throw new DriverNotReadyError()
		}
		return this._inclusionCoordinator.replaceFailedNode(
			nodeId,
			strategy,
			options,
		)
	}

	async getAvailableFirmwareUpdates(
		nodeId: number,
		options?: GetFirmwareUpdatesOptions,
	) {
		if (this.driverReady) {
			return this._firmwareUpdateService.getAvailableFirmwareUpdates(
				nodeId,
				options,
			)
		}

		throw new DriverNotReadyError()
	}

	async getAllAvailableFirmwareUpdates(options?: GetFirmwareUpdatesOptions) {
		if (this.driverReady) {
			return this._firmwareUpdateService.getAllAvailableFirmwareUpdates(
				options,
			)
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Check firmware updates for all nodes and store results in nodes.json
	 */
	async checkAllNodesFirmwareUpdates(options?: GetFirmwareUpdatesOptions) {
		if (!this.driverReady) {
			throw new DriverNotReadyError()
		}
		return this._firmwareUpdateService.checkAllNodesFirmwareUpdates(options)
	}

	/**
	 * Dismiss firmware update for a specific node and version
	 */
	async dismissFirmwareUpdate(nodeId: number, version: string) {
		return this._firmwareUpdateService.dismissFirmwareUpdate(
			nodeId,
			version,
		)
	}

	private async _checkNodeFirmwareUpdates(nodeId: number) {
		return this._firmwareUpdateService.checkNodeFirmwareUpdates(nodeId)
	}

	/**
	 * Get available non-dismissed firmware updates for a node
	 */
	getNodeFirmwareUpdates(nodeId: number): FirmwareUpdateInfo[] {
		return this._firmwareUpdateService.getNodeFirmwareUpdates(nodeId)
	}

	async firmwareUpdateOTA(nodeId: number, updateInfo: FirmwareUpdateInfo) {
		if (this.driverReady) {
			return this._firmwareUpdateService.firmwareUpdateOTA(
				nodeId,
				updateInfo,
			)
		}

		throw new DriverNotReadyError()
	}

	async setPowerlevel(
		powerlevel: number,
		measured0dBm: number,
	): Promise<boolean> {
		if (this.driverReady) {
			const result = await this._driver.controller.setPowerlevel(
				powerlevel,
				measured0dBm,
			)

			await this.updateControllerNodeProps(null, ['powerlevel'])

			return result
		}

		throw new DriverNotReadyError()
	}

	async setRFRegion(region: RFRegion): Promise<boolean> {
		if (this.driverReady) {
			const result = await this._driver.controller.setRFRegion(region)

			// Determine which properties need updating
			const propsToUpdate: Array<
				'powerlevel' | 'RFRegion' | 'maxLongRangePowerlevel'
			> = ['RFRegion']

			const supportsAutoPowerlevel = regionSupportsAutoPowerlevel(region)

			// If powerlevels are in auto mode, refresh them after region change
			if (supportsAutoPowerlevel) {
				if (
					this.cfg.rf?.autoPowerlevels ||
					this.cfg.rf?.txPower?.powerlevel === 'auto'
				) {
					propsToUpdate.push('powerlevel')
				}
				if (
					this.cfg.rf?.autoPowerlevels ||
					this.cfg.rf?.maxLongRangePowerlevel === 'auto'
				) {
					propsToUpdate.push('maxLongRangePowerlevel')
				}
			}

			await this.updateControllerNodeProps(null, propsToUpdate)
			return result
		}

		throw new DriverNotReadyError()
	}

	async setMaxLRPowerLevel(powerlevel: number): Promise<boolean> {
		if (this.driverReady) {
			const result =
				await this._driver.controller.setMaxLongRangePowerlevel(
					powerlevel,
				)
			await this.updateControllerNodeProps(null, [
				'maxLongRangePowerlevel',
			])
			return result
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Start inclusion
	 */
	async startInclusion(
		strategy: InclusionStrategy = InclusionStrategy.Default,
		options?: {
			forceSecurity?: boolean
			provisioning?: PlannedProvisioningEntry
			qrString?: string
			name?: string
			dsk?: string
			location?: string
		},
	): Promise<boolean> {
		if (this.driverReady) {
			return this._inclusionCoordinator.startInclusion(
				strategy,
				options,
				(parsed) => this.provisionSmartStartNode(parsed),
			)
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Start exclusion
	 */
	async startExclusion(
		options: ExclusionOptions = {
			strategy: ExclusionStrategy.DisableProvisioningEntry,
		},
	): Promise<boolean> {
		if (this.driverReady) {
			return this._inclusionCoordinator.startExclusion(options)
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Stop exclusion
	 */
	stopExclusion(): Promise<boolean> {
		if (this.driverReady) {
			return this._inclusionCoordinator.stopExclusion()
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Stops inclusion
	 */
	stopInclusion(): Promise<boolean> {
		if (this.driverReady) {
			return this._inclusionCoordinator.stopInclusion()
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Rebuild node routes
	 */
	async rebuildNodeRoutes(nodeId: number): Promise<boolean> {
		if (this.driverReady) {
			let status: RebuildRoutesStatus = 'pending'

			const node = this.nodes.get(nodeId)

			if (!node) {
				throw Error(`Node ${nodeId} not found`)
			}

			node.rebuildRoutesProgress = status
			this.sendToSocket(socketEvents.rebuildRoutesProgress, [
				[nodeId, status],
			])
			const result =
				await this._driver.controller.rebuildNodeRoutes(nodeId)
			status = result ? 'done' : 'failed'

			node.rebuildRoutesProgress = status
			this.sendToSocket(socketEvents.rebuildRoutesProgress, [
				[nodeId, status],
			])

			// Refresh priority and custom SUC return routes after rebuild completes
			// The cache is cleared during rebuild, so we read from the cache to update UI
			this.getCustomSUCReturnRoute(nodeId)
			this.getPrioritySUCReturnRoute(nodeId)

			return result
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Get priority return route from nodeId to destinationId
	 */
	getPriorityReturnRoute(nodeId: number, destinationId: number) {
		if (!this.driverReady) throw new DriverNotReadyError()

		const controllerId = this._driver.controller.ownNodeId

		if (!destinationId) {
			destinationId = controllerId
		}

		const result = this._driver.controller.getPriorityReturnRouteCached(
			nodeId,
			destinationId,
		)

		const node = this.nodes.get(nodeId)

		if (node) {
			if (result) {
				node.priorityReturnRoute[destinationId] = result
			} else {
				delete node.priorityReturnRoute[destinationId]
			}
			this.emitStatistics(node, {
				priorityReturnRoute: node.priorityReturnRoute,
			})
		}

		return result
	}

	/**
	 * Assigns a priority return route from nodeId to destinationId
	 */
	async assignPriorityReturnRoute(
		nodeId: number,
		destinationNodeId: number,
		repeaters: number[],
		routeSpeed: ZWaveDataRate,
	) {
		if (!this.driverReady) throw new DriverNotReadyError()

		const result = await this._driver.controller.assignPriorityReturnRoute(
			nodeId,
			destinationNodeId,
			repeaters,
			routeSpeed,
		)

		if (result) {
			this.getPriorityReturnRoute(nodeId, destinationNodeId)
		}

		return result
	}

	/**
	 * Get priority return route from node to controller
	 */
	getPrioritySUCReturnRoute(nodeId: number) {
		if (!this.driverReady) throw new DriverNotReadyError()

		const result =
			this._driver.controller.getPrioritySUCReturnRouteCached(nodeId) ??
			null

		const node = this.nodes.get(nodeId)

		if (node) {
			node.prioritySUCReturnRoute = result
			this.emitStatistics(node, {
				prioritySUCReturnRoute: result,
			})
		}

		return result
	}

	/**
	 * Assign a priority return route from node to controller
	 */
	async assignPrioritySUCReturnRoute(
		nodeId: number,
		repeaters: number[],
		routeSpeed: ZWaveDataRate,
	) {
		if (!this.driverReady) throw new DriverNotReadyError()

		const result =
			await this._driver.controller.assignPrioritySUCReturnRoute(
				nodeId,
				repeaters,
				routeSpeed,
			)

		if (result) {
			// when changing the SUC priority return routes custom SUC return routes are removed
			this.getCustomSUCReturnRoute(nodeId)
			this.getPrioritySUCReturnRoute(nodeId)
		}

		return result
	}

	/**
	 * Get custom return routes from nodeId to destinationId
	 */
	getCustomReturnRoute(nodeId: number, destinationId: number) {
		if (!this.driverReady) throw new DriverNotReadyError()

		const result = this._driver.controller.getCustomReturnRoutesCached(
			nodeId,
			destinationId,
		)

		const node = this.nodes.get(nodeId)

		if (node) {
			if (result) {
				node.customReturnRoute[destinationId] = result
			} else {
				delete node.customReturnRoute[destinationId]
			}
			this.emitStatistics(node, {
				customReturnRoute: node.customReturnRoute,
			})
		}

		return result
	}

	/**
	 * Assigns custom return routes from a node to a destination node
	 */
	async assignCustomReturnRoutes(
		nodeId: number,
		destinationNodeId: number,
		routes: Route[],
		priorityRoute?: Route,
	) {
		if (!this.driverReady) throw new DriverNotReadyError()

		const result = await this._driver.controller.assignCustomReturnRoutes(
			nodeId,
			destinationNodeId,
			routes,
			priorityRoute,
		)

		if (result) {
			this.getCustomReturnRoute(nodeId, destinationNodeId)
		}

		return result
	}

	/**
	 * Get custom return routes from node to controller
	 */
	getCustomSUCReturnRoute(nodeId: number) {
		if (!this.driverReady) throw new DriverNotReadyError()

		const result =
			this._driver.controller.getCustomSUCReturnRoutesCached(nodeId) ?? []

		const node = this.nodes.get(nodeId)

		if (node) {
			node.customSUCReturnRoutes = result
			this.emitStatistics(node, {
				customSUCReturnRoutes: result,
			})
		}

		return result
	}

	/**
	 * Assigns up to 4 return routes to a node to the controller
	 */
	async assignCustomSUCReturnRoutes(
		nodeId: number,
		routes: Route[],
		priorityRoute?: Route,
	) {
		if (!this.driverReady) throw new DriverNotReadyError()

		const result =
			await this._driver.controller.assignCustomSUCReturnRoutes(
				nodeId,
				routes,
				priorityRoute,
			)

		if (result) {
			// when changing the SUC return routes the priority SUC return route is removed
			this.getCustomSUCReturnRoute(nodeId)
			this.getPrioritySUCReturnRoute(nodeId)
		}

		return result
	}

	/**
	 * Returns the priority route for a given node ID
	 */
	async getPriorityRoute(nodeId: number) {
		if (this.driverReady) {
			const result =
				await this._driver.controller.getPriorityRoute(nodeId)

			if (result) {
				const node = this.nodes.get(nodeId)
				if (node) {
					const statistics: Partial<NodeStatistics> =
						node.statistics || {}

					switch (result.routeKind) {
						case RouteKind.Application:
							node.applicationRoute = {
								repeaters: result.repeaters,
								routeSpeed: result.routeSpeed,
							}
							break
						case RouteKind.NLWR:
							statistics.nlwr = {
								...(statistics.nlwr || {}),
								repeaters: result.repeaters,
								protocolDataRate: result.routeSpeed as any,
							}
							delete node.applicationRoute
							break
						case RouteKind.LWR:
							statistics.lwr = {
								...(statistics.lwr || {}),
								repeaters: result.repeaters,
								protocolDataRate: result.routeSpeed as any,
							}
							delete node.applicationRoute
							break
					}

					node.statistics = statistics as NodeStatistics

					this.emitStatistics(node, {
						statistics: node.statistics,
						lastActive: node.lastActive,
						applicationRoute: node.applicationRoute || null,
					})
				}
			}

			return result
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Delete ALL previously assigned return routes
	 */
	async deleteReturnRoutes(nodeId: number) {
		if (!this.driverReady) throw new DriverNotReadyError()

		const result = await this._driver.controller.deleteReturnRoutes(nodeId)

		if (result) {
			const node = this.nodes.get(nodeId)

			if (node) {
				node.priorityReturnRoute = null
				node.customReturnRoute = null
				this.emitStatistics(node, {
					priorityReturnRoute: null,
					customReturnRoute: null,
				})
			}
		}

		return result
	}

	/**
	 * Delete ALL previously assigned return routes to the controller
	 */
	async deleteSUCReturnRoutes(nodeId: number) {
		if (!this.driverReady) throw new DriverNotReadyError()

		const result =
			await this._driver.controller.deleteSUCReturnRoutes(nodeId)

		if (result) {
			const node = this.nodes.get(nodeId)

			if (node) {
				node.prioritySUCReturnRoute = null
				node.customSUCReturnRoutes = []
				this.emitStatistics(node, {
					prioritySUCReturnRoute: null,
					customSUCReturnRoutes: [],
				})
			}
		}

		return result
	}

	/**
	 * Ask the controller to automatically assign to node nodeId a set of routes to node destinationNodeId.
	 */
	async assignReturnRoutes(nodeId: number, destinationNodeId: number) {
		if (!this.driverReady) throw new DriverNotReadyError()

		const result = await this._driver.controller.assignReturnRoutes(
			nodeId,
			destinationNodeId,
		)

		if (result) {
			this.getCustomReturnRoute(nodeId, destinationNodeId)
			this.getPriorityReturnRoute(nodeId, destinationNodeId)
		}

		return result
	}

	/**
	 * Ask the controller to automatically assign to node nodeId a set of routes to controller.
	 */
	async assignSUCReturnRoutes(nodeId: number) {
		if (!this.driverReady) throw new DriverNotReadyError()

		const result =
			await this._driver.controller.assignSUCReturnRoutes(nodeId)

		if (result) {
			this.getCustomSUCReturnRoute(nodeId)
			this.getPrioritySUCReturnRoute(nodeId)
		}

		return result
	}

	/**
	 * Sets the priority route for a given node ID
	 */
	async setPriorityRoute(
		nodeId: number,
		repeaters: number[],
		routeSpeed: ZWaveDataRate,
	): Promise<boolean> {
		if (this.driverReady) {
			const result = await this._driver.controller.setPriorityRoute(
				nodeId,
				repeaters,
				routeSpeed,
			)

			if (result) {
				await this.getPriorityRoute(nodeId)
			}

			return result
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Remove priority route for a given node ID.
	 */
	async removePriorityRoute(nodeId: number) {
		if (this.driverReady) {
			const result =
				await this._driver.controller.removePriorityRoute(nodeId)

			if (result) {
				await this.getPriorityRoute(nodeId)
			}

			return result
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Check node lifeline health
	 */
	async checkLifelineHealth(
		nodeId: number,
		rounds = 5,
	): Promise<LifelineHealthCheckSummary & { targetNodeId: number }> {
		if (this.driverReady) {
			if (this.isVirtualNode(nodeId)) {
				throw new Error(`Node ${nodeId} is a virtual node`)
			}
			const result = await this.getNode(nodeId).checkLifelineHealth(
				rounds,
				this._onHealthCheckProgress.bind(this, {
					nodeId,
					targetNodeId: this.driver.controller.ownNodeId,
				}),
			)
			return { ...result, targetNodeId: this.driver.controller.ownNodeId }
		}

		throw new DriverNotReadyError()
	}

	async checkLinkReliability(
		nodeId: number,
		options: any,
	): Promise<LinkReliabilityCheckResult> {
		if (this.driverReady) {
			if (this.isVirtualNode(nodeId)) {
				throw new Error(`Node ${nodeId} is a virtual node`)
			}
			const result = await this.getNode(nodeId).checkLinkReliability({
				...options,
				onProgress: (progress) =>
					this._onLinkReliabilityCheckProgress({ nodeId }, progress),
			})

			return result
		}

		throw new DriverNotReadyError()
	}

	abortLinkReliabilityCheck(nodeId: number): void {
		if (this.driverReady) {
			if (this.isVirtualNode(nodeId)) {
				throw new Error(`Node ${nodeId} is a virtual node`)
			}
			this.getNode(nodeId).abortLinkReliabilityCheck()
			return
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Check node routes health
	 */
	async checkRouteHealth(
		nodeId: number,
		targetNodeId: number,
		rounds = 5,
	): Promise<RouteHealthCheckSummary & { targetNodeId: number }> {
		if (this.driverReady) {
			if (this.isVirtualNode(nodeId)) {
				throw new Error(`Node ${nodeId} is a virtual node`)
			}
			const zwaveNode = this.getNode(nodeId)
			const result = await zwaveNode.checkRouteHealth(
				targetNodeId,
				rounds,
				this._onHealthCheckProgress.bind(this, {
					nodeId,
					targetNodeId,
				}),
			)

			return { ...result, targetNodeId }
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Aborts an ongoing health check if one is currently in progress.
	 */
	abortHealthCheck(nodeId: number) {
		if (this.driverReady) {
			const zwaveNode = this.getNode(nodeId)

			if (!zwaveNode) {
				throw Error(`Node ${nodeId} not found`)
			}

			if (!zwaveNode.isHealthCheckInProgress()) {
				throw Error(`Health check not in progress`)
			}

			return zwaveNode.abortHealthCheck()
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Check if a node is failed
	 */
	async isFailedNode(nodeId: number): Promise<boolean> {
		if (this.driverReady) {
			const node = this._nodes.get(nodeId)
			const zwaveNode = this.getNode(nodeId)

			// checks if a node was marked as failed in the controller
			const result = await this._driver.controller.isFailedNode(nodeId)
			if (node) {
				node.failed = result
			}

			if (zwaveNode) {
				this._onNodeStatus(zwaveNode, { updateStatusOnly: true })
			}
			return result
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Remove a failed node
	 */
	async removeFailedNode(nodeId: number): Promise<void> {
		if (this.driverReady) {
			if (backupManager.backupOnEvent) {
				this.nvmEvent = 'before_remove_failed_node'
				await backupManager.backupNvm()
			}

			return this._driver.controller.removeFailedNode(nodeId)
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Re interview the node
	 */
	refreshInfo(nodeId: number, options?: RefreshInfoOptions): Promise<void> {
		if (this.driverReady) {
			const zwaveNode = this.getNode(nodeId)

			if (!zwaveNode) {
				throw Error(`Node ${nodeId} not found`)
			}

			return zwaveNode.refreshInfo(options)
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Used to trigger an update of controller FW
	 */
	async firmwareUpdateOTW(
		file: FwFile | FirmwareUpdateInfo,
	): Promise<OTWFirmwareUpdateResult> {
		return this._firmwareUpdateService.firmwareUpdateOTW(file)
	}

	async updateFirmware(
		nodeId: number,
		files: FwFile[],
	): Promise<FirmwareUpdateResult> {
		if (!this.driverReady) {
			throw new DriverNotReadyError()
		}
		return this._firmwareUpdateService.updateFirmware(
			nodeId,
			files,
			(id: number) => this.getNode(id),
		)
	}

	async abortFirmwareUpdate(nodeId: number) {
		if (!this.driverReady) {
			throw new DriverNotReadyError()
		}
		return this._firmwareUpdateService.abortFirmwareUpdate(
			nodeId,
			(id: number) => this.getNode(id),
		)
	}

	dumpNode(nodeId: number) {
		if (this.driverReady) {
			const zwaveNode = this.getNode(nodeId)

			if (!zwaveNode) {
				throw Error(`Node ${nodeId} not found`)
			}

			return zwaveNode.createDump()
		}

		throw new DriverNotReadyError()
	}

	beginRebuildingRoutes(options?: RebuildRoutesOptions): boolean {
		if (this.driverReady) {
			return this._driver.controller.beginRebuildingRoutes(options)
		}

		throw new DriverNotReadyError()
	}

	stopRebuildingRoutes(): boolean {
		if (this.driverReady) {
			const result = this._driver.controller.stopRebuildingRoutes()
			if (result) {
				const toReturn: [number, RebuildRoutesStatus][] = []
				for (const [nodeId, node] of this.nodes) {
					if (node.rebuildRoutesProgress === 'pending') {
						node.rebuildRoutesProgress = 'skipped'
					}
					toReturn.push([nodeId, node.rebuildRoutesProgress])
				}
				this.sendToSocket(socketEvents.rebuildRoutesProgress, toReturn)
			}
			return result
		}

		throw new DriverNotReadyError()
	}

	async hardReset() {
		if (this.driverReady) {
			// Reject leaves lifecycle untouched so public APIs settle normally
			await this._driver.hardReset()
			this.init()
			this._inclusionCoordinator.reinstallUserCallbacks()
		} else {
			throw new DriverNotReadyError()
		}
	}

	softReset() {
		if (this.driverReady) {
			return this._driver.softReset()
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Send a custom CC command. Check available commands by selecting a CC [here](https://zwave-js.github.io/node-zwave-js/#/api/CCs/index)
	 */
	async sendCommand(
		ctx: {
			nodeId: number
			endpoint: number
			commandClass: CommandClasses | keyof typeof CommandClasses
		},
		command: string,
		args: any[],
	): Promise<any> {
		if (this.driverReady) {
			if (typeof ctx.nodeId !== 'number') {
				throw Error('nodeId must be a number')
			}

			if (args !== undefined && !Array.isArray(args)) {
				throw Error('if args is given, it must be an array')
			}

			// get node instance
			const node = this.getNode(ctx.nodeId)
			if (!node) {
				throw Error(`Node ${ctx.nodeId} was not found!`)
			}

			// get the endpoint instance
			const endpoint = node.getEndpoint(ctx.endpoint || 0)
			if (!endpoint) {
				throw Error(
					`Endpoint ${ctx.endpoint} does not exist on Node ${ctx.nodeId}!`,
				)
			}

			const commandClass =
				typeof ctx.commandClass === 'number'
					? ctx.commandClass
					: CommandClasses[ctx.commandClass]

			// get the command class instance to send the command
			const api = endpoint.commandClasses[commandClass]
			if (!api || !api.isSupported()) {
				throw Error(
					`Node ${ctx.nodeId}${
						ctx.endpoint ? ` Endpoint ${ctx.endpoint}` : ''
					} does not support CC ${
						ctx.commandClass
					} or it has not been implemented yet`,
				)
			} else if (!(command in api)) {
				throw Error(
					`The command ${command} does not exist for CC ${ctx.commandClass}`,
				)
			}

			// send the command with args
			const method = api[command].bind(api)
			const result = args ? await method(...args) : await method()

			return result
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Calls a specific `client` or `ZwaveClient` method based on `apiName`
	 * ZwaveClients methods used are the ones that overrides default Z-Wave methods
	 * like nodes name and location and scenes management.
	 */
	async callApi<T extends AllowedApis>(
		apiName: T,
		...args: Parameters<ZwaveClient[T]>
	) {
		let err: string, result: ReturnType<ZwaveClient[T]>

		logger.log('info', 'Calling api %s with args: %o', apiName, args)

		if (this.driverReady || this.driver?.mode === DriverMode.Bootloader) {
			try {
				const allowed =
					typeof this[apiName] === 'function' &&
					allowedApis.indexOf(apiName) >= 0

				if (allowed) {
					result = await (this as any)[apiName](...args)
					// custom scenes and node/location management
				} else {
					err = 'Unknown API'
				}
			} catch (e) {
				err = e.message
			}
		} else {
			err = 'Z-Wave client not connected'
		}

		let toReturn: CallAPIResult<T>

		if (err) {
			toReturn = {
				success: false,
				message: err,
			}
		} else {
			toReturn = {
				success: true,
				message: 'Success zwave api call',
				result,
			}
		}
		logger.log('info', `${toReturn.message} ${apiName} %o`, result)

		toReturn.args = args

		return toReturn
	}

	/**
	 * Send broadcast write request
	 */
	async writeBroadcast(
		valueId: ValueID,
		value: unknown,
		options?: SetValueAPIOptions,
	) {
		if (this.driverReady) {
			try {
				const broadcastNode = this._driver.controller.getBroadcastNode()

				await broadcastNode.setValue(valueId, value, options)
			} catch (error) {
				logger.error(
					// eslint-disable-next-line @typescript-eslint/no-base-to-string
					`Error while sending broadcast ${value} to CC ${
						valueId.commandClass
					} ${valueId.property} ${valueId.propertyKey || ''}: ${
						error.message
					}`,
				)
			}
		}
	}

	/**
	 * Send multicast write request to a group of nodes
	 */
	async writeMulticast(
		nodes: number[],
		valueId: ZUIValueId,
		value: unknown,
		options?: SetValueAPIOptions,
	) {
		if (this.driverReady) {
			let fallback = false
			try {
				const multicastGroup =
					this._driver.controller.getMulticastGroup(nodes)
				await multicastGroup.setValue(valueId, value, options)
			} catch (error) {
				fallback = error.code === ZWaveErrorCodes.CC_NotSupported
				logger.error(
					// eslint-disable-next-line @typescript-eslint/no-base-to-string
					`Error while sending multicast ${value} to CC ${
						valueId.commandClass
					} ${valueId.property} ${valueId.propertyKey || ''}: ${
						error.message
					}`,
				)
			}
			// try single writes requests
			if (fallback) {
				for (const n of nodes) {
					await this.writeValue({ ...valueId, nodeId: n }, value)
				}
			}
		}
	}

	/**
	 * Set a value of a specific zwave valueId
	 */
	async writeValue(
		valueId: ZUIValueId,
		value: any,
		options?: SetValueAPIOptions,
	) {
		let result: SetValueResult = {
			status: SetValueStatus.Fail,
		}
		if (this.driverReady) {
			const vID = this._getValueID(valueId)
			logger.log('info', `Writing %o to ${valueId.nodeId}-${vID}`, value)

			// Route writes for virtual nodes (broadcast/multicast) through
			// the virtual node instance's setValue
			if (this.isVirtualNode(valueId.nodeId)) {
				try {
					const virtualInstance = this.getVirtualNode(valueId.nodeId)
					if (!virtualInstance) {
						throw Error(`Virtual node ${valueId.nodeId} not found`)
					}

					// coerce string to numbers
					if (
						valueId.type === 'number' &&
						typeof value === 'string'
					) {
						value = Number(value)
					}

					result = await virtualInstance.setValue(
						valueId,
						value,
						options,
					)
				} catch (error) {
					logger.log(
						'error',
						`Error while writing %o on virtual node ${valueId.nodeId}-${vID}: ${error.message}`,
						value,
					)
				}

				if (setValueFailed(result)) {
					logger.log(
						'error',
						`Unable to write %o on virtual ${vID}: %s`,
						value,
						result.message ||
							getEnumMemberName(SetValueStatus, result.status),
					)
				}

				return result
			}

			try {
				const zwaveNode = this.getNode(valueId.nodeId)

				if (!zwaveNode) {
					throw Error(`Node ${valueId.nodeId} not found`)
				}

				const isDuration = typeof value === 'object'

				// handle multilevel switch 'start' and 'stop' commands
				if (
					!isDuration &&
					valueId.commandClass ===
						CommandClasses['Multilevel Switch'] &&
					isNaN(value)
				) {
					if (/stop/i.test(value)) {
						await zwaveNode.commandClasses[
							'Multilevel Switch'
						].stopLevelChange()
					} else if (/start/i.test(value)) {
						await zwaveNode.commandClasses[
							'Multilevel Switch'
							// eslint-disable-next-line @typescript-eslint/ban-ts-comment
							// @ts-ignore
						].startLevelChange()
					} else {
						throw Error('Command not valid for Multilevel Switch')
					}
					result = {
						status: SetValueStatus.SuccessUnsupervised,
					}
				} else {
					// coerce string to numbers when value type is number and received a string
					if (
						valueId.type === 'number' &&
						typeof value === 'string'
					) {
						value = Number(value)
					} else if (
						valueId.property === 'hexColor' &&
						typeof value === 'string' &&
						value.startsWith('#')
					) {
						// remove the leading `#` if present
						value = value.substr(1)
					}

					if (
						typeof value === 'string' &&
						utils.isBufferAsHex(value)
					) {
						value = utils.bufferFromHex(value)
					}

					const node = this.nodes.get(valueId.nodeId)

					const targetValueId = node?.values[vID]

					if (targetValueId) {
						targetValueId.toUpdate = true
					}

					result = await zwaveNode.setValue(valueId, value, options)

					if (setValueWasUnsupervisedOrSucceeded(result)) {
						this.emit('valueWritten', valueId, node, value)
					}
				}
			} catch (error) {
				logger.log(
					'error',
					`Error while writing %o on ${vID}: ${error.message}`,
					value,
				)
			}
			// https://zwave-js.github.io/node-zwave-js/#/api/node?id=setvalue
			if (setValueFailed(result)) {
				logger.log(
					'error',
					`Unable to write %o on ${vID}: %s`,
					value,
					result.message ||
						getEnumMemberName(SetValueStatus, result.status),
				)
			}
		}

		return result
	}

	// ---------- DRIVER EVENTS -------------------------------------

	private async _onDriverReady(generation: number) {
		/*
			Now the controller interview is complete. This means we know which nodes
			are included in the network, but they might not be ready yet.
			The node interview will continue in the background.

			NOTE: This can be called also after an Hard Reset
		*/

		// driver ready
		this.status = ZwaveClientStatus.DRIVER_READY

		this.driverReady = true

		this._inclusionCoordinator.syncFromDriver()

		logger.info('Z-Wave driver is ready')

		this._updateControllerStatus('Driver ready')

		try {
			// this must be done only after driver is ready
			this._scheduledConfigCheck().catch(() => {
				/* ignore */
			})

			this.driver.controller
				.on('inclusion started', this._onInclusionStarted.bind(this))
				.on('exclusion started', this._onExclusionStarted.bind(this))
				.on('inclusion stopped', this._onInclusionStopped.bind(this))
				.on('exclusion stopped', this._onExclusionStopped.bind(this))
				.on(
					'inclusion state changed',
					this._onInclusionStateChanged.bind(this),
				)
				.on('inclusion failed', this._onInclusionFailed.bind(this))
				.on('exclusion failed', this._onExclusionFailed.bind(this))
				.on('node found', this._onNodeFound.bind(this))
				.on('node added', this._onNodeAdded.bind(this))
				.on('node removed', this._onNodeRemoved.bind(this))
				.on(
					'rebuild routes progress',
					this._onRebuildRoutesProgress.bind(this),
				)
				.on('rebuild routes done', this._onRebuildRoutesDone.bind(this))
				.on(
					'statistics updated',
					this._onControllerStatisticsUpdated.bind(this),
				)
				.on(
					'status changed',
					this._onControllerStatusChanged.bind(this),
				)

			// Re-register callbacks because the coordinator survives driver replacement
			this._inclusionCoordinator.reinstallUserCallbacks()
		} catch (error) {
			// Fixes freak error in "driver ready" handler #1309
			logger.error(error.message)
			this.backoffRestart()
			return
		}

		// reset retries
		this._driverLifecycle.resetBackoff()

		this.driverInfo.homeid = this._driver.controller.homeId
		const homeHex = '0x' + this.driverInfo?.homeid?.toString(16)
		this.driverInfo.name = homeHex
		this.driverInfo.controllerId = this._driver.controller.ownNodeId

		// needs home hex to be set
		await this.getStoreNodes()

		// A close()/restart() (or a newer driver) may have replaced this
		// generation while the store was loading. Abort before touching the
		// node registry / server so a late `driver ready` from an obsolete
		// driver can never mutate the replacement generation's state.
		if (this._driverLifecycle.generation !== generation) {
			return
		}

		// Create broadcast nodes and recreate virtual nodes for groups
		this._createBroadcastNodes()

		// Recreate virtual nodes for existing groups
		for (const group of this._groupService.getGroups()) {
			this._groupService.createVirtualNode(group)
		}

		for (const [, node] of this._driver.controller.nodes) {
			// node added will not be triggered if the node is in cache
			this._createNode(node.id)
			this._addNode(node)

			// Make sure we didn't miss the ready event
			if (node.ready) {
				this._onNodeReady(node)
			}
		}

		// Now that physical nodes are populated, decide whether the LR
		// broadcast virtual node should be exposed.
		this._refreshBroadcastLRNode()

		this.emit('event', EventSource.DRIVER, 'driver ready', this.driverInfo)

		this._error = undefined

		// start server only when driver is ready. Fixes #602
		this._startServerIfNeeded()

		logger.info(`Scanning network with homeid: ${homeHex}`)

		await this.sendInitToSockets()

		if (this._driverLifecycle.generation !== generation) {
			return
		}

		this.loadFakeNodes().catch((e) => {
			logger.error(`Error while loading fake nodes: ${e.message}`)
		})
	}

	private _onDriverError(error: ZWaveError, skipRestart = false): void {
		this._error = 'Driver: ' + error.message
		this.status = ZwaveClientStatus.DRIVER_FAILED
		this._updateControllerStatus(this._error)
		this.emit('event', EventSource.DRIVER, 'driver error', error)

		if (!skipRestart && error.code === ZWaveErrorCodes.Driver_Failed) {
			// this cannot be recovered by zwave-js, requires a manual restart
			this.driverReady = false
			this.backoffRestart()
		}
	}

	private _onOTWFirmwareUpdateProgress(progress: OTWFirmwareUpdateProgress) {
		this.throttle(
			this._onOTWFirmwareUpdateProgress.name,
			this.sendToSocket.bind(this, socketEvents.otwFirmwareUpdate, {
				progress,
			}),
			250,
		)

		this.emit(
			'event',
			EventSource.DRIVER,
			'controller firmware update progress',
			progress,
		)
	}

	private _onOTWFirmwareUpdateFinished(result: OTWFirmwareUpdateResult) {
		// prevent progress event to come after finish
		this.clearThrottle(this._onOTWFirmwareUpdateProgress.name)

		this.sendToSocket(socketEvents.otwFirmwareUpdate, {
			result: {
				success: result.success,
				status: getEnumMemberName(
					OTWFirmwareUpdateStatus,
					result.status,
				),
			},
		})

		logger.info(
			`Controller firmware update OTW finished ${
				result.success ? 'successfully' : 'with error'
			}.\n   Status: ${getEnumMemberName(
				OTWFirmwareUpdateStatus,
				result.status,
			)}. Result: ${JSON.stringify(result)}.`,
		)

		this.emit(
			'event',
			EventSource.DRIVER,
			'controller firmware update finished',
			result,
		)
	}

	private _onControllerStatisticsUpdated(stats: ControllerStatistics) {
		let controllerNode: ZUINode
		try {
			controllerNode = this.nodes.get(this.driver.controller.ownNodeId)
		} catch (e) {
			// This should not happen, but it does. Don't crash!
			return
		}

		if (controllerNode) {
			const oldStatistics =
				controllerNode.statistics as ControllerStatistics
			controllerNode.statistics = stats

			if (stats.messagesRX > (oldStatistics?.messagesRX ?? 0)) {
				// no need to emit `lastActive` event. That would cause useless traffic
				controllerNode.lastActive = Date.now()
			}

			const bgRssi = stats.backgroundRSSI

			if (bgRssi) {
				if (!controllerNode.bgRSSIPoints) {
					controllerNode.bgRSSIPoints = []
				}

				controllerNode.bgRSSIPoints.push(bgRssi)

				if (controllerNode.bgRSSIPoints.length > 360) {
					const firstPoint = controllerNode.bgRSSIPoints[0]
					const lastPoint =
						controllerNode.bgRSSIPoints[
							controllerNode.bgRSSIPoints.length - 1
						]

					const maxTimeSpan = 3 * 60 * 60 * 1000 // 3 hours

					if (
						lastPoint.timestamp - firstPoint.timestamp >
						maxTimeSpan
					) {
						controllerNode.bgRSSIPoints.shift()
					}
				}
			}

			this.emitStatistics(controllerNode, {
				statistics: stats,
				lastActive: controllerNode.lastActive,
				bgRssi,
			})
		}

		this.emit('event', EventSource.CONTROLLER, 'statistics updated', stats)
	}

	private _onControllerStatusChanged(status: ControllerStatus) {
		let message = ''

		if (status === ControllerStatus.Unresponsive) {
			this._error = 'Controller is unresponsive'
			message = this._error
		} else if (status === ControllerStatus.Jammed) {
			this._error = 'Controller is unable to transmit'
			message = this._error
		} else {
			message = `Controller is ${getEnumMemberName(
				ControllerStatus,
				status,
			)}`
			this._error = undefined
		}

		this._updateControllerStatus(message)
		const controllerNode = this.getNode(this.driver.controller.ownNodeId)
		if (controllerNode) {
			this._onNodeEvent('status changed', controllerNode, status)
		}
		this.emit('event', EventSource.CONTROLLER, 'status changed', status)
	}

	private _onBootLoaderReady() {
		this._updateControllerStatus('Bootloader is READY')

		this.status = ZwaveClientStatus.BOOTLOADER_READY

		logger.info(`Bootloader is READY`)

		this.emit('event', EventSource.DRIVER, 'bootloader ready')
	}

	private _onScanComplete() {
		this._scanComplete = true

		this._updateControllerStatus('Scan completed')

		// all nodes are ready
		this.status = ZwaveClientStatus.SCAN_DONE

		logger.info(`Network scan complete. Found: ${this._nodes.size} nodes`)

		this.emit('scanComplete')

		this.emit('event', EventSource.DRIVER, 'all nodes ready')

		// Schedule periodic firmware update checks
		this._scheduledFirmwareUpdateCheck().catch(() => {
			/* ignore */
		})
	}

	// ---------- CONTROLLER EVENTS -------------------------------

	private _updateControllerStatus(status: string) {
		if (this._cntStatus !== status) {
			logger.info(`Controller status: ${status}`)
			this._cntStatus = status
			this.sendToSocket(socketEvents.controller, {
				status,
				error: this._error,
				inclusionState: this._inclusionCoordinator.inclusionState,
			})
		}
	}

	private _onInclusionStarted(strategy: InclusionStrategy) {
		const secure = strategy !== InclusionStrategy.Insecure
		const message = `${secure ? 'Secure' : 'Non-secure'} inclusion started`
		this._updateControllerStatus(message)
		this.emit('event', EventSource.CONTROLLER, 'inclusion started', secure)
	}

	private _onExclusionStarted() {
		const message = 'Exclusion started'
		this._updateControllerStatus(message)
		this.emit('event', EventSource.CONTROLLER, 'exclusion started')
	}

	private _onInclusionStopped() {
		const message = 'Inclusion stopped'

		this._inclusionCoordinator.onInclusionStopped()
		this._updateControllerStatus(message)
		this.emit('event', EventSource.CONTROLLER, 'inclusion stopped')
	}

	private _onExclusionStopped() {
		const message = 'Exclusion stopped'
		this._updateControllerStatus(message)
		this.emit('event', EventSource.CONTROLLER, 'exclusion stopped')
	}

	private _onInclusionStateChanged(state: InclusionState) {
		this._inclusionCoordinator.onInclusionStateChanged(
			state,
			this._cntStatus,
			this._error,
		)
	}

	private _onInclusionFailed() {
		const message = 'Inclusion failed'

		this._inclusionCoordinator.onInclusionFailed((nodeId) => {
			const node = this._nodes.get(nodeId)
			if (node && !node.ready) {
				this.logNode(
					nodeId,
					'info',
					'Removing ghost node after failed inclusion',
				)
				this._removeNode(nodeId)
			}
		})

		this._updateControllerStatus(message)
		this.emit('event', EventSource.CONTROLLER, 'inclusion failed')
	}

	private _onExclusionFailed() {
		const message = 'Exclusion failed'
		this._updateControllerStatus(message)
		this.emit('event', EventSource.CONTROLLER, 'exclusion failed')
	}

	/**
	 * Triggered when a node is found, this is emitted when stick includes the node
	 * the only reliable info at this point is the node id
	 */
	private _onNodeFound(foundNode: FoundNode) {
		let node: ZUINode
		const nodeId = foundNode.id
		// the driver is ready so this node has been added on fly
		if (this.driverReady) {
			node = this._createNode(nodeId)
			this.sendToSocket(socketEvents.nodeFound, { node })
			// track until `node added` clears it; cleaned up on inclusion failure
			this._inclusionCoordinator.onNodeFound(nodeId)
		} else {
			node = this._nodes.get(nodeId)
		}

		this.logNode(node, 'info', 'Found')

		this.emitNodeUpdate(node)

		this.emit('event', EventSource.CONTROLLER, 'node found', { id: nodeId })
	}

	/**
	 * Triggered when a node is added. Emitted after zwave-js exchanges security key, adds lifeline, SUC route, etc.
	 */
	private async _onNodeAdded(zwaveNode: ZWaveNode, result: InclusionResult) {
		let node: ZUINode
		// node made it past `node found` — no longer a ghost candidate
		this._inclusionCoordinator.onNodeAdded(zwaveNode.id)
		// Complete replacement here because node removal must preserve metadata first
		this._inclusionCoordinator.onReplacementComplete()
		// the driver is ready so this node has been added on fly
		if (this.driverReady) {
			node = this._addNode(zwaveNode)

			const security = zwaveNode.getHighestSecurityClass()

			if (security) {
				node.security = SecurityClass[security]
			}

			if (zwaveNode.dsk) {
				const entry = this.driver.controller.getProvisioningEntry(
					dskToString(zwaveNode.dsk),
				)

				if (entry) {
					if (entry.name) {
						await this.setNodeName(zwaveNode.id, entry.name)
					}

					if (entry.location) {
						await this.setNodeLocation(zwaveNode.id, entry.location)
					}
				}
			}

			this.sendToSocket(socketEvents.nodeAdded, { node, result })

			// Update broadcast nodes with new capabilities
			this._refreshBroadcastLRNode()
			this._updateBroadcastNodeValues()
		}

		const security =
			node?.security ||
			(result.lowSecurity ? 'LOW SECURITY' : 'HIGH SECURITY')

		this.logNode(node, 'info', `Added with security ${security}`)

		this.emit(
			'event',
			EventSource.CONTROLLER,
			'node added',
			this.zwaveNodeToJSON(zwaveNode),
		)
	}

	/**
	 * Triggered when node is removed
	 *
	 */
	private async _onNodeRemoved(
		zwaveNode: ZWaveNode,
		reason: RemoveNodeReason,
	) {
		this.logNode(
			zwaveNode,
			'info',
			'Removed, reason: ' + getEnumMemberName(RemoveNodeReason, reason),
		)
		zwaveNode.removeAllListeners()

		this.emit(
			'event',
			EventSource.CONTROLLER,
			'node removed',
			this.zwaveNodeToJSON(zwaveNode),
			reason,
		)

		this._removeNode(zwaveNode.id)

		// Persist the group cleanup *before* refreshing live virtual nodes /
		// broadcast values, so the on-disk state reflects the removal.
		await this._groupService.removeNodeFromGroups(zwaveNode.id)

		// Update broadcast nodes after node removal
		this._refreshBroadcastLRNode()
		this._updateBroadcastNodeValues()
	}

	/**
	 * Triggered on each progress of rebuild routes process
	 */
	private _onRebuildRoutesProgress(
		progress: ReadonlyMap<number, RebuildRoutesStatus>,
	) {
		const toRebuild = [...progress.values()]
		const rebuiltNodes = toRebuild.filter((v) => v !== 'pending')
		const allDone = toRebuild.every((v) => v !== 'pending')
		const status = allDone ? 'COMPLETED' : 'IN PROGRESS'
		const message = `Rebuild Routes process ${status}. Healed ${rebuiltNodes.length} nodes`
		this._updateControllerStatus(message)
		this.sendToSocket(socketEvents.rebuildRoutesProgress, [
			...progress.entries(),
		])

		// update rebuildNodeRoutes progress status
		for (const [nodeId, status] of progress) {
			const node = this._nodes.get(nodeId)
			if (node) {
				node.rebuildRoutesProgress = status
			}
		}

		this.emit(
			'event',
			EventSource.CONTROLLER,
			'rebuild routes progress',
			progress,
		)
	}

	/**
	 * Triggered on each progress of health check processes
	 */
	private _onHealthCheckProgress(
		request: { nodeId: number; targetNodeId: number },
		round: number,
		totalRounds: number,
		lastRating: number,
		lastResult: RouteHealthCheckResult | LifelineHealthCheckResult,
	) {
		const message = `Health check ${request.nodeId}-->${request.targetNodeId}: ${round}/${totalRounds} done, last rating ${lastRating}`
		this._updateControllerStatus(message)
		this.sendToSocket(socketEvents.healthCheckProgress, {
			request,
			round,
			totalRounds,
			lastRating,
			lastResult,
		})
	}

	private _onLinkReliabilityCheckProgress(
		request: { nodeId: number },
		...args: any[]
	) {
		// const message = `Link statistics ${request.nodeId}: ${args.join(', ')}`
		// this._updateControllerStatus(message)
		this.sendToSocket(socketEvents.linkReliability, {
			request,
			args,
		})
	}

	private _onRebuildRoutesDone(result) {
		const message = `Rebuild Routes process COMPLETED. Healed ${result.size} nodes`
		this._updateControllerStatus(message)
	}

	grantSecurityClasses(requested: InclusionGrant) {
		this._inclusionCoordinator.grantSecurityClasses(requested)
	}

	validateDSK(dsk: string) {
		this._inclusionCoordinator.validateDSK(dsk)
	}

	abortInclusion() {
		this._inclusionCoordinator.abortInclusion()
	}

	async backupNVMRaw(): Promise<{ data: Buffer; fileName: string }> {
		if (!this.driverReady) {
			throw new DriverNotReadyError()
		}

		// it's set when the backup has been triggered by an event
		const event = this.nvmEvent ? this.nvmEvent + '_' : ''
		this.nvmEvent = null

		const data = await this.driver.controller.backupNVMRaw(
			this._onBackupNVMProgress.bind(this),
		)

		const fileName = `${NVM_BACKUP_PREFIX}${utils.fileDate()}${event}`

		await utils.ensureDir(nvmBackupsDir)

		await writeFile(utils.joinPath(nvmBackupsDir, fileName + '.bin'), data)

		this._updateControllerStatus('NVM backup completed successfully')

		return { data: Buffer.from(data.buffer), fileName }
	}

	private _onBackupNVMProgress(bytesRead: number, totalBytes: number) {
		const progress = Math.round((bytesRead / totalBytes) * 100)
		this._updateControllerStatus(`Backup NVM progress: ${progress}%`)
	}

	async restoreNVM(data: Uint8Array<ArrayBuffer>, useRaw = false) {
		if (!this.driverReady) {
			throw new DriverNotReadyError()
		}

		if (useRaw) {
			await this.driver.controller.restoreNVMRaw(
				data,
				this._onRestoreNVMProgress.bind(this),
			)
		} else {
			await this.driver.controller.restoreNVM(
				data,
				this._onConvertNVMProgress.bind(this),
				this._onRestoreNVMProgress.bind(this),
			)
		}

		this._updateControllerStatus('NVM restore completed successfully')
	}

	private _onConvertNVMProgress(bytesRead: number, totalBytes: number) {
		const progress = Math.round((bytesRead / totalBytes) * 100)

		this._updateControllerStatus(`Convert NVM progress: ${progress}%`)
	}

	private _onRestoreNVMProgress(bytesRead: number, totalBytes: number) {
		const progress = Math.round((bytesRead / totalBytes) * 100)

		this._updateControllerStatus(`Restore NVM progress: ${progress}%`)
	}

	async getProvisioningEntries(): Promise<SmartStartProvisioningEntry[]> {
		if (!this.driverReady) {
			throw new DriverNotReadyError()
		}

		const result = this.driver.controller.getProvisioningEntries()

		for (const entry of result) {
			const node = this.nodes.get(entry.nodeId)
			if (node) {
				if (node.deviceConfig) {
					entry.manufacturer = node.deviceConfig.manufacturer
					entry.label = node.deviceConfig.label
					entry.description = node.deviceConfig.description
				}
				entry.protocol = node.protocol
			} else if (
				typeof entry.manufacturerId === 'number' &&
				typeof entry.productType === 'number' &&
				typeof entry.productId === 'number' &&
				typeof entry.applicationVersion === 'string'
			) {
				const device = await this.driver.configManager.lookupDevice(
					entry.manufacturerId,
					entry.productType,
					entry.productId,
					entry.applicationVersion,
				)
				if (device) {
					entry.manufacturer = device.manufacturer
					entry.label = device.label
					entry.description = device.description
				}
			}
		}

		return result
	}

	getProvisioningEntry(dsk: string): SmartStartProvisioningEntry | undefined {
		if (!this.driverReady) {
			throw new DriverNotReadyError()
		}

		return this.driver.controller.getProvisioningEntry(dsk)
	}

	unprovisionSmartStartNode(dskOrNodeId: string | number) {
		if (!this.driverReady) {
			throw new DriverNotReadyError()
		}

		this.driver.controller.unprovisionSmartStartNode(dskOrNodeId)
	}

	async parseQRCodeString(qrString: string): Promise<{
		parsed?: QRProvisioningInformation
		nodeId?: number
		exists: boolean
	}> {
		const parsed = await parseQRCodeString(qrString)
		let node: ZWaveNode | undefined
		let exists = false

		if (parsed?.dsk) {
			node = this.driver.controller.getNodeByDSK(parsed.dsk)

			if (!node) {
				exists = !!this.getProvisioningEntry(parsed.dsk)
			}
		}

		return {
			parsed,
			nodeId: node?.id,
			exists,
		}
	}

	async provisionSmartStartNode(entry: PlannedProvisioningEntry | string) {
		if (!this.driverReady) {
			throw new DriverNotReadyError()
		}

		if (typeof entry === 'string') {
			// it's a qrcode
			entry = await parseQRCodeString(entry)
		}

		if (!entry.dsk) {
			throw Error('DSK is required')
		}

		const isNew = !this.driver.controller.getProvisioningEntry(entry.dsk)

		// disable it so user can choose the protocol to use
		if (
			isNew &&
			entry.supportedProtocols?.includes(Protocols.ZWaveLongRange)
		) {
			entry.status = ProvisioningEntryStatus.Inactive
		}

		this.driver.controller.provisionSmartStartNode(entry)

		return entry
	}

	// ---------- NODE EVENTS -------------------------------------

	/**
	 * Update current node status and interviewState
	 *
	 */
	private _onNodeStatus(
		zwaveNode: ZWaveNode,
		options?: {
			/** Only emit the status/availability change instead of the full node */
			updateStatusOnly?: boolean
			/**
			 * Seed the interview stage from the node (e.g. on node ready/added),
			 * instead of leaving it to the granular interview progress events
			 */
			updateInterviewStage?: boolean
		},
	) {
		const { updateStatusOnly = false, updateInterviewStage = false } =
			options ?? {}

		const node = this._nodes.get(zwaveNode.id)

		if (node) {
			// https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/node/Types.ts#L127
			node.status = NodeStatus[
				zwaveNode.status
			] as keyof typeof NodeStatus
			node.available = zwaveNode.status !== NodeStatus.Dead

			// The interview stage is normally driven by the granular `interview
			// progress` events; only seed it from the node here when explicitly
			// requested (e.g. node ready / added), so status changes like
			// wake/sleep/alive/dead don't regress it during an interview.
			if (updateInterviewStage) {
				node.interviewStage = InterviewStage[
					zwaveNode.interviewStage
				] as keyof typeof InterviewStage
			}

			if (zwaveNode.interviewStage === InterviewStage.Complete) {
				node.hasDeviceConfigChanged = zwaveNode.hasDeviceConfigChanged()
			}

			let changedProps: utils.DeepPartial<ZUINode>

			if (updateStatusOnly) {
				changedProps = {
					status: node.status,
					available: node.available,
				}
			}

			this.emitNodeUpdate(node, changedProps)
		} else {
			this.logNode(
				zwaveNode,
				'error',
				`Received status update but node doesn't exists`,
			)
		}
	}

	/**
	 * Triggered every time a node event is received
	 *
	 */
	private _onNodeEvent(
		eventName: ZwaveNodeEvents | 'status changed',
		zwaveNode: ZWaveNode,
		...eventArgs: any[]
	) {
		const node = this._nodes.get(zwaveNode.id)

		if (node) {
			const event: NodeEvent = {
				time: new Date(),
				event: eventName,
				args: eventArgs,
			}
			node.eventsQueue.push(event)

			this.sendToSocket(socketEvents.nodeEvent, {
				nodeId: node?.id,
				event,
			})

			while (node.eventsQueue.length > this.maxNodeEventsQueueSize) {
				node.eventsQueue.shift()
			}
		}
	}

	/**
	 * Triggered when a node is ready. All values are added and all node info are received
	 *
	 */
	private _onNodeReady(zwaveNode: ZWaveNode) {
		const node = this._nodes.get(zwaveNode.id)

		if (!node) {
			this.logNode(
				zwaveNode,
				'error',
				`Ready event called but node doesn't exists`,
			)

			return
		}

		// keep track of existing values (if any)
		const existingValues = node.values

		// node can trigger the ready event multiple times. Set it to false to prevent discovery
		node.ready = false
		node.values = {}

		this._dumpNode(zwaveNode)

		const values = zwaveNode.getDefinedValueIDs()
		const delayedUpdates = []

		for (const zwaveValue of values) {
			const res = this._addValue(
				zwaveNode,
				zwaveValue,
				existingValues,
				true,
			)

			if (!res) continue

			const { valueId, updated } = res

			// in case of writeable values whe always need to emit a
			// value change event in order to subscribe mqtt topics
			if (updated || valueId.writeable) {
				delayedUpdates.push(
					this.emitValueChanged.bind(this, valueId, node, true),
				)
			}

			// setup value observer (if any)
			this.subscribeObservers(node, valueId)
		}

		// emit value updated events when all values are added
		// this prevents to have undefined target values when using mqtt
		delayedUpdates.forEach((fn) => fn())

		// add it to know devices types (if not already present)
		if (!this._devices[node.deviceId]) {
			this._devices[node.deviceId] = {
				name: `[${node.deviceId}] ${node.productDescription} (${node.manufacturer})`,
				values: utils.copy(node.values),
			}

			const deviceValues = this._devices[node.deviceId].values

			delete this._devices[node.deviceId].hassDevices

			// remove node specific info from values
			for (const id in deviceValues) {
				delete deviceValues[id].nodeId

				// remove the node part
				deviceValues[id].id = id
			}
		}

		// node is ready when all its info are parsed and all values added
		// don't set the node as ready before all values are added, to prevent discovery
		node.ready = true

		if (node.isControllerNode) {
			node.supportsLongRange = this.driver.controller.supportsLongRange
			this.updateControllerNodeProps(node).catch((error) => {
				this.logNode(
					zwaveNode,
					'error',
					`Failed to get controller node ${node.id} properties: ${error.message}`,
				)
			})
		}

		// check if this node can call the Sync time
		node.supportsTime =
			zwaveNode.supportsCC(CommandClasses.Time) ||
			zwaveNode.supportsCC(CommandClasses['Time Parameters']) ||
			zwaveNode.supportsCC(CommandClasses['Clock']) ||
			zwaveNode.supportsCC(CommandClasses['Schedule Entry Lock'])

		this.getGroups(zwaveNode.id, true)

		this._onNodeStatus(zwaveNode, { updateInterviewStage: true })

		// Check for matching configuration templates
		this._checkConfigurationTemplates(node, zwaveNode)

		this.emit(
			'event',
			EventSource.NODE,
			'node ready',
			this.zwaveNodeToJSON(zwaveNode),
		)

		this.logNode(
			zwaveNode,
			'info',
			`Ready: ${node.manufacturer} - ${node.productLabel} (${
				node.productDescription || 'Unknown'
			})`,
		)

		if (zwaveNode.commandClasses['Schedule Entry Lock'].isSupported()) {
			this.logNode(zwaveNode, 'info', `Schedule Entry Lock is supported`)

			this.getSchedules(zwaveNode.id, { fromCache: true }).catch(
				(error) => {
					this.logNode(
						zwaveNode,
						'error',
						`Failed to get schedules for node ${node.id}: ${error.message}`,
					)
				},
			)
		}

		// Long range nodes use a star topology, so they don't have return/priority routes
		if (
			!zwaveNode.isControllerNode &&
			zwaveNode.protocol !== Protocols.ZWaveLongRange
		) {
			this.getPriorityRoute(zwaveNode.id).catch((error) => {
				this.logNode(
					zwaveNode,
					'error',
					`Failed to get priority route for node ${node.id}: ${error.message}`,
				)
			})

			this.getCustomSUCReturnRoute(zwaveNode.id)
			this.getPrioritySUCReturnRoute(zwaveNode.id)
		}

		// Update broadcast nodes when a node becomes ready
		this._updateBroadcastNodeValues()
	}

	/**
	 * Update a node's interview progress and notify the UI.
	 * When `throttle` is set the emit is rate-limited, otherwise it is emitted immediately.
	 */
	private _setInterviewProgress(
		zwaveNode: ZWaveNode,
		progress: number,
		stage?: keyof typeof InterviewStage,
		throttle = false,
	) {
		const node = this._nodes.get(zwaveNode.id)
		if (!node) return

		node.interviewProgress = progress
		const changedProps: utils.DeepPartial<ZUINode> = {
			interviewProgress: progress,
		}
		if (stage !== undefined) {
			node.interviewStage = stage
			changedProps.interviewStage = stage
		}

		if (throttle) {
			// send at most 4msg per second
			this.throttle(
				'_setInterviewProgress_' + node.id,
				this.emitNodeUpdate.bind(this, node, changedProps),
				250,
			)
		} else {
			this.emitNodeUpdate(node, changedProps)
		}
	}

	/**
	 * Triggered when a node interview starts for the first time or when the node is manually re-interviewed
	 *
	 */
	private _onNodeInterviewStarted(zwaveNode: ZWaveNode) {
		this.logNode(zwaveNode, 'info', 'Interview started')

		// Z-Wave JS sends interview progress events - no need to change the progress here.

		this.emit(
			'event',
			EventSource.NODE,
			'node interview started',
			this.zwaveNodeToJSON(zwaveNode),
		)
	}

	/**
	 * Triggered when an interview stage complete
	 *
	 */
	private _onNodeInterviewStageCompleted(
		zwaveNode: ZWaveNode,
		stageName: string,
	) {
		this.logNode(
			zwaveNode,
			'info',
			`Interview stage ${stageName.toUpperCase()} completed`,
		)

		this._onNodeStatus(zwaveNode, { updateStatusOnly: true })

		this.emit(
			'event',
			EventSource.NODE,
			'node interview stage completed',
			this.zwaveNodeToJSON(zwaveNode),
		)
	}

	/**
	 * Triggered when a node finish its interview. When this event is triggered all node values and metadata are updated
	 * Starting from zwave-js v7 this event is only triggered when the node is added the first time or manually re-interviewed
	 *
	 */
	private _onNodeInterviewCompleted(zwaveNode: ZWaveNode) {
		const node = this._nodes.get(zwaveNode.id)

		if (node.manufacturerId === undefined) {
			this._dumpNode(zwaveNode)
		}

		this.logNode(
			zwaveNode,
			'info',
			'Interview COMPLETED, all values are updated',
		)

		this._onNodeStatus(zwaveNode, { updateStatusOnly: true })

		this._checkNodeFirmwareUpdates(zwaveNode.id).catch((error) => {
			this.logNode(
				zwaveNode,
				'error',
				`Failed to check firmware updates after interview: ${error.message}`,
			)
		})

		this.emit(
			'event',
			EventSource.NODE,
			'node interview completed',
			this.zwaveNodeToJSON(zwaveNode),
		)
	}

	/**
	 * Triggered when a node interview fails.
	 *
	 */
	private _onNodeInterviewFailed(
		zwaveNode: ZWaveNode,
		args: NodeInterviewFailedEventArgs,
	) {
		this.logNode(
			zwaveNode,
			'error',
			`Interview FAILED: ${args.errorMessage}`,
		)

		// Reset the progress: the interview stopped before completing.
		this._setInterviewProgress(zwaveNode, 0)

		this._onNodeStatus(zwaveNode, { updateStatusOnly: true })

		this.emit(
			'event',
			EventSource.NODE,
			'node interview failed',
			this.zwaveNodeToJSON(zwaveNode),
		)
	}

	/**
	 * Triggered when a node wake ups
	 *
	 */
	private _onNodeWakeUp(zwaveNode: ZWaveNode, oldStatus: NodeStatus) {
		this.logNode(
			zwaveNode,
			'info',
			`Is ${oldStatus === NodeStatus.Unknown ? '' : 'now '}awake`,
		)

		this._onNodeStatus(zwaveNode, { updateStatusOnly: true })

		const node = this._nodes.get(zwaveNode.id)
		if (node) {
			node.lastAwake = Date.now()
			this.emitNodeUpdate(node, {
				lastAwake: node.lastAwake,
			} as utils.DeepPartial<ZUINode>)
		}

		this.emit(
			'event',
			EventSource.NODE,
			'node wakeup',
			this.zwaveNodeToJSON(zwaveNode),
		)
	}

	/**
	 * Triggered when a node is sleeping
	 *
	 */
	private _onNodeSleep(zwaveNode: ZWaveNode, oldStatus: NodeStatus) {
		this.logNode(
			zwaveNode,
			'info',
			`Is ${oldStatus === NodeStatus.Unknown ? '' : 'now '}asleep`,
		)

		this._onNodeStatus(zwaveNode, { updateStatusOnly: true })
		this.emit(
			'event',
			EventSource.NODE,
			'node sleep',
			this.zwaveNodeToJSON(zwaveNode),
		)
	}

	/**
	 * Triggered when a node is alive
	 *
	 */
	private _onNodeAlive(zwaveNode: ZWaveNode, oldStatus: NodeStatus) {
		this._onNodeStatus(zwaveNode, { updateStatusOnly: true })
		if (oldStatus === NodeStatus.Dead) {
			this.logNode(zwaveNode, 'info', 'Has returned from the dead')
		} else {
			this.logNode(zwaveNode, 'info', 'Is alive')
		}

		this.emit(
			'event',
			EventSource.NODE,
			'node alive',
			this.zwaveNodeToJSON(zwaveNode),
		)
	}

	/**
	 * Triggered when a node is dead
	 *
	 */
	private _onNodeDead(zwaveNode: ZWaveNode, oldStatus: NodeStatus) {
		this._onNodeStatus(zwaveNode, { updateStatusOnly: true })
		this.logNode(
			zwaveNode,
			'info',
			`Is ${oldStatus === NodeStatus.Unknown ? '' : 'now '}dead`,
		)

		this.emit(
			'event',
			EventSource.NODE,
			'node dead',
			this.zwaveNodeToJSON(zwaveNode),
		)
	}

	/**
	 * Triggered when a node value is added
	 *
	 */
	private _onNodeValueAdded(
		zwaveNode: ZWaveNode,
		args: ZWaveNodeValueAddedArgs,
	) {
		this.logNode(
			zwaveNode,
			'info',
			`Value added: ${this._getValueID(
				args as unknown as ZUIValueId,
				// eslint-disable-next-line @typescript-eslint/no-base-to-string
			)} => ${args.newValue}`,
		)

		// handle node values added 'on fly'
		if (zwaveNode.ready) {
			const res = this._addValue(zwaveNode, args)

			if (res?.valueId) {
				const node = this._nodes.get(zwaveNode.id)
				this.subscribeObservers(node, res.valueId)
			}
		}

		this.emit(
			'event',
			EventSource.NODE,
			'node value added',
			this.zwaveNodeToJSON(zwaveNode),
			args,
		)
	}

	/**
	 * Emitted when we receive a `value notification` event
	 *
	 */
	private _onNodeValueNotification(
		zwaveNode: ZWaveNode,
		args: ZWaveNodeValueNotificationArgs & {
			newValue?: any
			stateless: boolean
		},
	) {
		// notification hasn't `newValue`
		args.newValue = args.value
		// specify that this is stateless
		args.stateless = true

		this._onNodeValueUpdated(zwaveNode, args)
	}

	/**
	 * Emitted when we receive a `value updated` event
	 *
	 */
	private _onNodeValueUpdated(
		zwaveNode: ZWaveNode,
		args: (ZWaveNodeValueUpdatedArgs | ZWaveNodeValueNotificationArgs) & {
			prevValue?: any
			newValue?: any
			stateless: boolean
		},
	) {
		this._updateValue(zwaveNode, args)

		this.logNode(
			zwaveNode,
			'info',
			`Value ${
				args.stateless ? 'notification' : 'updated'
			}: ${this._getValueID(args)} ${
				args.stateless
					? args.newValue
					: `${args.prevValue} => ${args.newValue}`
			}`,
		)

		this.emit(
			'event',
			EventSource.NODE,
			'node value updated',
			this.zwaveNodeToJSON(zwaveNode),
			args,
		)
	}

	/**
	 * Emitted when we receive a `value removed` event
	 *
	 */
	private _onNodeValueRemoved(
		zwaveNode: ZWaveNode,
		args: ZWaveNodeValueRemovedArgs,
	) {
		this._removeValue(zwaveNode, args)

		this.logNode(
			zwaveNode,
			'info',
			`Value removed: ${this._getValueID(args)}`,
		)
		this.emit(
			'event',
			EventSource.NODE,
			'node value removed',
			this.zwaveNodeToJSON(zwaveNode),
			args,
		)
	}

	/**
	 * Emitted when we receive a `metadata updated` event
	 *
	 */
	private _onNodeMetadataUpdated(
		zwaveNode: ZWaveNode,
		args: ZWaveNodeMetadataUpdatedArgs,
	) {
		const value = this._parseValue(zwaveNode, args, args.metadata)

		this.sendToSocket(socketEvents.metadataUpdated, value)

		this.logNode(
			zwaveNode,
			'info',
			`Metadata updated: ${this._getValueID(
				args as unknown as ZUIValueId,
			)}`,
		)
		this.emit(
			'event',
			EventSource.NODE,
			'node metadata updated',
			this.zwaveNodeToJSON(zwaveNode),
			args,
		)
	}

	/**
	 * Emitted when we receive a node `notification` event
	 *
	 */
	private _onNodeNotification: ZWaveNotificationCallback = (...parms) => {
		const [endpoint, ccId, args] = parms

		const zwaveNode = endpoint.tryGetNode()

		if (!zwaveNode) {
			this.logNode(
				endpoint.nodeId,
				'error',
				`Notification received but node doesn't exist`,
			)

			return
		}

		const valueId: Partial<ZUIValueId> = {
			id: null,
			nodeId: zwaveNode.id,
			commandClass: ccId,
			commandClassName: CommandClasses[ccId],
			property: null,
		}

		let data = null

		switch (ccId) {
			case CommandClasses.Notification:
				valueId.property = args.label
				valueId.propertyKey = args.eventLabel
				data = this._parseNotification(args.parameters)
				break
			case CommandClasses['Entry Control']:
				valueId.property = args.eventType.toString()
				valueId.propertyKey = args.dataType
				data = isUint8Array(args.eventData)
					? utils.buffer2hex(args.eventData)
					: args.eventData
				break
			case CommandClasses['Multilevel Switch']:
				valueId.property = getEnumMemberName(
					MultilevelSwitchCommand,
					args.eventType as number,
				)
				data = args.direction
				break
			case CommandClasses.Powerlevel:
				// ignore, this should be handled in zwave-js
				return
			case CommandClasses['Battery']:
				valueId.property = args.eventType
				data = getEnumMemberName(BatteryReplacementStatus, args.urgency)
				break
			default:
				this.logNode(
					zwaveNode,
					'error',
					'Unknown notification received CC %s: %o',
					valueId.commandClassName,
					args,
				)
				return
		}

		valueId.id = this._getValueID(valueId, true)
		valueId.propertyName = valueId.property // must be defined in named topics

		this.logNode(
			zwaveNode,
			'info',
			`CC %s notification %o`,
			valueId.commandClassName,
			args,
		)

		const node = this._nodes.get(zwaveNode.id)

		this.emit('notification', node, valueId as ZUIValueId, data)

		this.emit(
			'event',
			EventSource.NODE,
			'node notification',
			this.zwaveNodeToJSON(zwaveNode),
			ccId,
			args,
		)
	}

	private _onNodeStatisticsUpdated(
		zwaveNode: ZWaveNode,
		stats: NodeStatistics,
	) {
		const node = this.nodes.get(zwaveNode.id)

		if (node) {
			node.statistics = { ...stats } // stats is readonly, we need to be able to edit it in getPriorityRoute

			// update stats only when node is doing something
			if (stats.lastSeen) {
				node.lastActive = stats.lastSeen?.getTime()
				this.emit('nodeLastActive', node)
			}

			this.emitStatistics(node, {
				statistics: stats,
				lastActive: node.lastActive,
				applicationRoute: node.applicationRoute || null,
			})
		}

		this.emit(
			'event',
			EventSource.NODE,
			'statistics updated',
			this.zwaveNodeToJSON(zwaveNode),
			stats,
		)
	}

	private _onNodeInfoReceived(zwaveNode: ZWaveNode) {
		this.logNode(zwaveNode, 'info', `Node info (NIF) received`)

		this.emit(
			'event',
			EventSource.NODE,
			'node info received',
			this.zwaveNodeToJSON(zwaveNode),
		)
	}

	/**
	 * Emitted when we receive a node `firmware update progress` event
	 *
	 */
	private _onNodeFirmwareUpdateProgress: ZWaveNodeFirmwareUpdateProgressCallback =
		function _onNodeFirmwareUpdateProgress(
			this: ZwaveClient,
			zwaveNode: ZWaveNode,
			progress: FirmwareUpdateProgress,
		) {
			const node = this.nodes.get(zwaveNode.id)
			if (node) {
				node.firmwareUpdate = progress
				// send at most 4msg per second
				this.throttle(
					this._onNodeFirmwareUpdateProgress.name + '_' + node.id,
					this.emitNodeUpdate.bind(this, node, {
						firmwareUpdate: progress,
					} as utils.DeepPartial<ZUINode>),
					250,
				)
			}

			this.emit(
				'event',
				EventSource.NODE,
				'node firmware update progress',
				this.zwaveNodeToJSON(zwaveNode),
				progress,
			)
		}

	/**
	 * Emitted when we receive a node `interview progress` event
	 *
	 */
	private _onNodeInterviewProgress(
		zwaveNode: ZWaveNode,
		progress: InterviewProgress,
	) {
		this._setInterviewProgress(
			zwaveNode,
			Math.round(progress.progress),
			InterviewStage[progress.stage] as keyof typeof InterviewStage,
			true,
		)
	}

	/**
	 * Triggered we receive a node `firmware update finished` event
	 *
	 */
	private _onNodeFirmwareUpdateFinished: ZWaveNodeFirmwareUpdateFinishedCallback =
		function _onNodeFirmwareUpdateFinished(
			this: ZwaveClient,
			zwaveNode: ZWaveNode,
			result: FirmwareUpdateResult,
		) {
			const node = this.nodes.get(zwaveNode.id)
			if (node) {
				node.firmwareUpdate = undefined

				this.clearThrottle(
					this._onNodeFirmwareUpdateProgress.name + '_' + node.id,
				)

				this.emitNodeUpdate(node, {
					firmwareUpdate: false,
				} as any)
			}

			this.logNode(
				zwaveNode,
				'info',
				`Firmware update finished ${
					result.success ? 'successfully' : 'with error'
				}.\n   Status: ${getEnumMemberName(
					FirmwareUpdateStatus,
					result.status,
				)}.\n   Wait before interacting: ${
					result.waitTime !== undefined ? `${result.waitTime}s` : 'No'
				}.\n   Result: ${JSON.stringify(result)}.`,
			)

			this.emit(
				'event',
				EventSource.NODE,
				'node firmware update finished',
				this.zwaveNodeToJSON(zwaveNode),
				result,
			)
		}

	// ------- NODE METHODS -------------

	/**
	 * Bind to ZwaveNode events
	 *
	 */
	private _bindNodeEvents(zwaveNode: ZWaveNode) {
		this.logNode(zwaveNode, 'debug', 'Binding to node events')

		// https://zwave-js.github.io/node-zwave-js/#/api/node?id=zwavenode-events
		zwaveNode
			.on('ready', this._onNodeReady.bind(this))
			.on('interview started', this._onNodeInterviewStarted.bind(this))
			.on(
				'interview stage completed',
				this._onNodeInterviewStageCompleted.bind(this),
			)
			.on(
				'interview completed',
				this._onNodeInterviewCompleted.bind(this),
			)
			.on('interview failed', this._onNodeInterviewFailed.bind(this))
			.on('interview progress', this._onNodeInterviewProgress.bind(this))
			.on('wake up', this._onNodeWakeUp.bind(this))
			.on('sleep', this._onNodeSleep.bind(this))
			.on('alive', this._onNodeAlive.bind(this))
			.on('dead', this._onNodeDead.bind(this))
			.on('value added', this._onNodeValueAdded.bind(this))
			.on('value updated', this._onNodeValueUpdated.bind(this))
			.on('value notification', this._onNodeValueNotification.bind(this))
			.on('value removed', this._onNodeValueRemoved.bind(this))
			.on('metadata updated', this._onNodeMetadataUpdated.bind(this))
			.on('notification', this._onNodeNotification.bind(this))
			.on(
				'firmware update progress',
				this._onNodeFirmwareUpdateProgress.bind(this),
			)
			.on(
				'firmware update finished',
				this._onNodeFirmwareUpdateFinished.bind(this),
			)
			.on('statistics updated', this._onNodeStatisticsUpdated.bind(this))
			.on('node info received', this._onNodeInfoReceived.bind(this))

		const events: ZwaveNodeEvents[] = [
			'ready',
			'interview started',
			'interview stage completed',
			'interview completed',
			'interview failed',
			'wake up',
			'sleep',
			'alive',
			'dead',
			'value added',
			'value updated',
			'value notification',
			'value removed',
			'notification',
			'firmware update progress',
			'firmware update finished',
		]

		for (const event of events) {
			zwaveNode.on(event, this._onNodeEvent.bind(this, event))
		}
	}

	/**
	 * Remove a node from internal nodes array
	 *
	 */
	private _removeNode(nodeid: number) {
		// don't use splice here, nodeid equals to the index in the array
		const node = this._nodes.get(nodeid)
		this._inclusionCoordinator.onNodeAdded(nodeid)
		if (node) {
			this._nodes.delete(nodeid)

			this.emit('nodeRemoved', {
				id: node.id,
				name: node.name,
				loc: node.loc,
			})
			this.sendToSocket(socketEvents.nodeRemoved, node)
		}

		if (
			!this._inclusionCoordinator.isReplacing &&
			this.storeNodes[nodeid]
		) {
			delete this.storeNodes[nodeid]
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			this.updateStoreNodes(false)
		}
	}

	private _createNode(nodeId: number) {
		const tmpNode = this._inclusionCoordinator.takeTmpNode()
		if (tmpNode) {
			if (this.storeNodes[nodeId]) {
				this.storeNodes[nodeId].name = tmpNode.name
				this.storeNodes[nodeId].loc = tmpNode.loc
			} else {
				this.storeNodes[nodeId] = {
					name: tmpNode.name,
					loc: tmpNode.loc,
				}
			}

			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			this.updateStoreNodes(false)
		}

		const node: ZUINode = {
			id: nodeId,
			name: this.storeNodes[nodeId]?.name || '',
			loc: this.storeNodes[nodeId]?.loc || '',
			values: {},
			groups: [],
			neighbors: [],
			ready: false,
			available: false,
			hassDevices: {},
			failed: false,
			inited: false,
			eventsQueue: [],
			status: 'Unknown',
			interviewStage: 'None',
			priorityReturnRoute: {},
			customReturnRoute: {},
			prioritySUCReturnRoute:
				this._driver.controller.getPrioritySUCReturnRouteCached(nodeId),
			customSUCReturnRoutes:
				this._driver.controller.getCustomSUCReturnRoutesCached(nodeId),
			applicationRoute: null,
			availableFirmwareUpdates:
				this.storeNodes[nodeId]?.availableFirmwareUpdates || [],
			firmwareUpdatesDismissed:
				this.storeNodes[nodeId]?.firmwareUpdatesDismissed || {},
			lastFirmwareUpdateCheck:
				this.storeNodes[nodeId]?.lastFirmwareUpdateCheck || 0,
			appliedTemplateContentHashes:
				this.storeNodes[nodeId]?.appliedTemplateContentHashes || [],
		}

		this._nodes.set(nodeId, node)

		return node
	}

	/**
	 * Add a new node to our nodes array. No informations are available yet, the node needs to be ready
	 *
	 */
	private _addNode(zwaveNode: ZWaveNode): ZUINode {
		const nodeId = zwaveNode.id

		const existingNode = this._nodes.get(nodeId)

		// this shouldn't happen
		if (existingNode && existingNode.ready) {
			logger.error(
				'Error while adding node ' + nodeId,
				Error('node has been added twice'),
			)
			return existingNode
		}

		this._bindNodeEvents(zwaveNode)
		this._dumpNode(zwaveNode)
		this._onNodeStatus(zwaveNode, { updateInterviewStage: true })

		this.logNode(zwaveNode, 'debug', `Has been added to nodes array`)

		return existingNode
	}

	/**
	 * Initialize a node with all its info
	 *
	 */
	private _dumpNode(zwaveNode: ZWaveNode) {
		const nodeId = zwaveNode.id

		const node = this._nodes.get(nodeId)

		if (!node) return

		const hexIds = [
			utils.num2hex(zwaveNode.manufacturerId),
			utils.num2hex(zwaveNode.productId),
			utils.num2hex(zwaveNode.productType),
		]
		node.hexId = `${hexIds[0]} ${hexIds[2]}-${hexIds[1]}`
		node.dbLink = `https://devices.zwave-js.io/?jumpTo=${hexIds[0]}:${
			hexIds[2]
		}:${hexIds[1]}:${node.firmwareVersion || '0.0'}`

		const deviceConfig = zwaveNode.deviceConfig || {
			label: `Unknown product ${hexIds[1]}`,
			description: hexIds[2],
			manufacturer:
				this.driver.configManager.lookupManufacturer(
					zwaveNode.manufacturerId,
				) || `Unknown manufacturer ${hexIds[0]}`,
		}

		// https://zwave-js.github.io/node-zwave-js/#/api/node?id=zwavenode-properties
		node.manufacturerId = zwaveNode.manufacturerId
		node.productId = zwaveNode.productId
		node.productType = zwaveNode.productType
		node.deviceConfig = zwaveNode.deviceConfig

		node.productLabel = deviceConfig.label
		node.productDescription = deviceConfig.description
		node.manufacturer = deviceConfig.manufacturer
		node.firmwareVersion = zwaveNode.firmwareVersion
		node.sdkVersion = zwaveNode.sdkVersion
		node.protocolVersion = zwaveNode.protocolVersion
		node.zwavePlusVersion = zwaveNode.zwavePlusVersion
		node.zwavePlusNodeType = zwaveNode.zwavePlusNodeType
		node.zwavePlusRoleType = zwaveNode.zwavePlusRoleType
		node.nodeType = zwaveNode.nodeType
		node.endpointsCount = zwaveNode.getEndpointCount()
		node.endpoints = zwaveNode.getAllEndpoints().map((e) => {
			const defaultLabel =
				e.index === 0 ? 'Root Endpoint' : `Endpoint ${e.index}`
			return {
				index: e.index,
				label: e.endpointLabel || defaultLabel,
				deviceClass: {
					basic: e.deviceClass?.basic,
					generic: e.deviceClass?.generic.key,
					specific: e.deviceClass?.specific.key,
				},
			}
		})
		node.isSecure = zwaveNode.isSecure
		node.security = SecurityClass[zwaveNode.getHighestSecurityClass()]
		node.supportsSecurity = zwaveNode.supportsSecurity
		node.supportsBeaming = zwaveNode.supportsBeaming
		node.isControllerNode = zwaveNode.isControllerNode
		node.isListening = zwaveNode.isListening
		node.isFrequentListening = zwaveNode.isFrequentListening
		node.isRouting = zwaveNode.isRouting
		node.keepAwake = zwaveNode.keepAwake
		node.maxDataRate = zwaveNode.maxDataRate
		node.deviceClass = {
			basic: zwaveNode.deviceClass?.basic,
			generic: zwaveNode.deviceClass?.generic.key,
			specific: zwaveNode.deviceClass?.specific.key,
		}

		node.lastActive = zwaveNode.lastSeen?.getTime() || null
		node.defaultTransitionDuration = zwaveNode.defaultTransitionDuration
		node.defaultVolume = zwaveNode.defaultVolume
		node.firmwareCapabilities =
			zwaveNode.getFirmwareUpdateCapabilitiesCached()

		node.protocol = zwaveNode.protocol
		const storedNode = this.storeNodes[nodeId]

		if (storedNode) {
			node.loc = storedNode.loc || ''
			node.name = storedNode.name || ''

			if (storedNode.hassDevices) {
				node.hassDevices = utils.copy(storedNode.hassDevices)
			}

			// keep zwaveNode and node name and location synced
			if (node.name && node.name !== zwaveNode.name) {
				this.logNode(
					zwaveNode,
					'debug',
					`Setting node name to '${node.name}'`,
				)
				zwaveNode.name = node.name
			}
			if (node.loc && node.loc !== zwaveNode.location) {
				this.logNode(
					zwaveNode,
					'debug',
					`Setting node location to '${node.loc}'`,
				)
				zwaveNode.location = node.loc
			}
		} else {
			this.storeNodes[nodeId] = {}
		}

		node.deviceId = this._getDeviceID(node)
		node.hasDeviceConfigChanged = zwaveNode.hasDeviceConfigChanged()

		if (node.isControllerNode) {
			node.rfRegions =
				this.driver.controller
					.getSupportedRFRegions()
					?.map((region) => ({
						value: region,
						title: getEnumMemberName(RFRegion, region),
						disabled:
							region === RFRegion.Unknown ||
							region === RFRegion['Default (EU)'],
					}))
					.sort((a, b) => a.title.localeCompare(b.title)) ?? []
		}
	}

	async updateControllerNodeProps(
		node?: ZUINode,
		props: Array<'powerlevel' | 'RFRegion' | 'maxLongRangePowerlevel'> = [
			'powerlevel',
			'RFRegion',
			'maxLongRangePowerlevel',
		],
	) {
		node = node || this.nodes.get(this._driver.controller.ownNodeId)
		if (props.includes('powerlevel')) {
			if (
				this._driver.controller.isSerialAPISetupCommandSupported(
					SerialAPISetupCommand.GetPowerlevel,
				)
			) {
				const { powerlevel, measured0dBm } =
					await this._driver.controller.getPowerlevel()
				node.powerlevel = powerlevel
				node.measured0dBm = measured0dBm
			} else {
				logger.info('Powerlevel is not supported by controller')
			}
		}

		if (props.includes('RFRegion')) {
			if (
				this._driver.controller.isSerialAPISetupCommandSupported(
					SerialAPISetupCommand.GetRFRegion,
				)
			) {
				node.RFRegion = await this._driver.controller.getRFRegion()
			} else {
				logger.info('RF region is not supported by controller')
			}

			// when RF region changes, check if long range is supported
			if (
				this.driver.controller.supportsLongRange !==
				node.supportsLongRange
			) {
				node.supportsLongRange =
					this.driver.controller.supportsLongRange
			}
		}

		if (props.includes('maxLongRangePowerlevel')) {
			if (
				this._driver.controller.isSerialAPISetupCommandSupported(
					SerialAPISetupCommand.GetLongRangeMaximumTxPower,
				)
			) {
				const limit =
					await this._driver.controller.getMaxLongRangePowerlevel()
				node.maxLongRangePowerlevel = limit
			} else {
				logger.info('LR powerlevel is not supported by controller')
			}
		}

		this.emitNodeUpdate(node, {
			powerlevel: node.powerlevel,
			measured0dBm: node.measured0dBm,
			RFRegion: node.RFRegion,
			supportsLongRange: node.supportsLongRange,
			maxLongRangePowerlevel: node.maxLongRangePowerlevel,
		})
	}

	/**
	 * Set value metadata to the internal valueId
	 *
	 */
	private _updateValueMetadata(
		zwaveNode: ZWaveNode,
		zwaveValue: TranslatedValueID & { [x: string]: any },
		zwaveValueMeta: ValueMetadata,
	): ZUIValueId {
		zwaveValue.nodeId = zwaveNode.id

		const node = this._nodes.get(zwaveNode.id)
		const vID = this._getValueID(zwaveValue)

		const valueId: ZUIValueId = {
			...(node.values[vID] || {}), // extend existing valueId
			id: this._getValueID(zwaveValue, true), // the valueId unique in the entire network, it also has the nodeId
			nodeId: zwaveNode.id,
			toUpdate: false,
			commandClass: zwaveValue.commandClass,
			commandClassName: zwaveValue.commandClassName,
			endpoint: zwaveValue.endpoint,
			property: zwaveValue.property,
			propertyName: zwaveValue.propertyName,
			propertyKey: zwaveValue.propertyKey,
			propertyKeyName: zwaveValue.propertyKeyName,
			type: zwaveValueMeta.type, // https://github.com/zwave-js/node-zwave-js/blob/cb35157da5e95f970447a67cbb2792e364b9d1e1/packages/core/src/values/Metadata.ts#L28
			readable: zwaveValueMeta.readable,
			writeable: zwaveValueMeta.writeable,
			description: zwaveValueMeta.description,
			label:
				zwaveValueMeta.label || zwaveValue.propertyName + ' (property)', // when label is missing, re use propertyName. Useful for webinterface
			default: zwaveValueMeta.default,
			ccSpecific: zwaveValueMeta.ccSpecific,
			stateless: zwaveValue.stateless || false, // used for notifications to specify that this should not be persisted (retained)
		}

		if (zwaveNode.ready) {
			const endpoint = zwaveNode.getEndpoint(zwaveValue.endpoint)

			valueId.commandClassVersion = (endpoint ?? zwaveNode).getCCVersion(
				zwaveValue.commandClass,
			)
		}

		this._applyValueMetadataFields(valueId, zwaveValueMeta)

		return valueId
	}

	/**
	 * Apply type-specific metadata fields (numeric, string, states, destructive)
	 * to a ZUIValueId. Shared between physical and virtual node value creation.
	 */
	private _applyValueMetadataFields(
		valueId: ZUIValueId,
		meta: ValueMetadata,
	): void {
		if (meta.type === 'number') {
			const numMeta = meta as ValueMetadataNumeric

			valueId.min = numMeta.min
			valueId.max = numMeta.max
			valueId.step = numMeta.steps
			valueId.allowed = numMeta.allowed
			valueId.unit = numMeta.unit

			if (numMeta.states && Object.keys(numMeta.states).length > 0) {
				valueId.list = true
				valueId.allowManualEntry = (
					numMeta as ConfigurationMetadata
				).allowManualEntry
				// If allowManualEntry is not explicitly set and the value has
				// allowed ranges (not just single values), default to allowing
				// manual entry. This supports the new value format in zwave-js
				// v15.21.0+ where values like Wake Up Interval have named states
				// (e.g., "Default", "Disabled") but also allow custom values
				// within a range.
				if (
					valueId.allowManualEntry === undefined &&
					numMeta.allowed?.some(
						(entry) => 'from' in entry && 'to' in entry,
					)
				) {
					valueId.allowManualEntry = true
				}
				valueId.states = []
				for (const k in numMeta.states) {
					valueId.states.push({
						text: numMeta.states[k],
						value: parseInt(k),
					})
				}
			} else {
				valueId.list = false
			}

			if ((numMeta as ConfigurationMetadata).destructive) {
				valueId.destructive = true
			}
		} else if (meta.type === 'string' || meta.type === 'color') {
			const strMeta = meta as ValueMetadataString
			valueId.minLength = strMeta.minLength
			valueId.maxLength = strMeta.maxLength
			valueId.list = false
		} else if (meta.type === 'boolean') {
			const boolStates = (meta as { states?: Record<string, string> })
				.states
			if (boolStates && Object.keys(boolStates).length > 0) {
				valueId.list = true
				valueId.states = []
				for (const k in boolStates) {
					valueId.states.push({
						text: boolStates[k],
						value: k === 'true',
					})
				}
			} else {
				valueId.list = false
			}
		} else {
			valueId.list = false
		}
	}

	/**
	 * Add a node value to our node values
	 *
	 */
	private _addValue(
		zwaveNode: ZWaveNode,
		zwaveValue: TranslatedValueID,
		oldValues?: {
			[key: string]: ZUIValueId
		},
		skipUpdate = false,
	) {
		const node = this._nodes.get(zwaveNode.id)

		if (!node) {
			logger.info(`ValueAdded: no such node: ${zwaveNode.id} error`)
		} else {
			if (
				zwaveValue.commandClass ===
				CommandClasses['Node Naming and Location']
			) {
				this.onNodeNameLocationChanged(
					node,
					zwaveValue as ZUIValueId,
					zwaveNode.getValue(zwaveValue),
				)

				return null
			}

			const zwaveValueMeta = zwaveNode.getValueMetadata(zwaveValue)

			const valueId = this._parseValue(
				zwaveNode,
				zwaveValue,
				zwaveValueMeta,
			)

			const vID = this._getValueID(valueId)

			// a valueId is updated when it doesn't exist or its value is updated
			const updated =
				!oldValues ||
				!oldValues[vID] ||
				oldValues[vID].value !== valueId.value

			this.logNode(
				zwaveNode,
				'info',
				`Value added ${valueId.id} => ${valueId.value}`,
			)

			if (!skipUpdate && updated) {
				this.emitValueChanged(valueId, node, true)
			}

			return {
				updated,
				valueId,
			}
		}

		return null
	}

	/**
	 * Parse a zwave value into a valueID
	 *
	 */
	private _parseValue(
		zwaveNode: ZWaveNode,
		zwaveValue: TranslatedValueID & { [x: string]: any },
		zwaveValueMeta: ValueMetadata,
	) {
		const node = this._nodes.get(zwaveNode.id)
		const valueId = this._updateValueMetadata(
			zwaveNode,
			zwaveValue,
			zwaveValueMeta,
		)

		const vID = this._getValueID(valueId)

		valueId.value = zwaveNode.getValue(zwaveValue)

		if (valueId.value === undefined) {
			const prevValue = node.values[vID]
				? node.values[vID].value
				: undefined
			valueId.value =
				zwaveValue.newValue !== undefined
					? zwaveValue.newValue
					: prevValue
		}

		// ensure duration is never undefined
		if (valueId.type === 'duration' && valueId.value === undefined) {
			valueId.value = new Duration(undefined, 'seconds')
		}

		if (this._isCurrentValue(valueId)) {
			valueId.isCurrentValue = true
			const targetValue = this._findTargetValue(
				valueId,
				zwaveNode.getDefinedValueIDs(),
			)
			if (targetValue) {
				valueId.targetValue = this._getValueID(targetValue)
			}
		}

		node.values[vID] = valueId

		return valueId
	}

	/**
	 * Triggered when a node is ready and a value changes
	 *
	 */
	private _updateValue(
		zwaveNode: ZWaveNode,
		args: TranslatedValueID & { [x: string]: any },
	) {
		const node = this._nodes.get(zwaveNode.id)

		if (!node) {
			logger.info(`valueChanged: no such node: ${zwaveNode.id} error`)
		} else {
			let skipUpdate = false

			const vID = this._getValueID(args as unknown as ZUIValueId)

			// notifications events are not defined as values, manually create them once we get the first update
			if (!node.values[vID]) {
				this._addValue(zwaveNode, args)
				// addValue call already trigger valueChanged event
				skipUpdate = true
			}

			const valueId = node.values[vID]

			if (!valueId) {
				// node name and location emit a value update but
				// there could be no defined valueId as not all nodes
				// support that CC but zwave-js does, also we ignore it
				// on `_addvalue`. Ref: (https://github.com/zwave-js/zwave-js-ui/issues/3591)
				if (
					args.commandClass ===
					CommandClasses['Node Naming and Location']
				) {
					this.onNodeNameLocationChanged(
						node,
						args as ZUIValueId,
						args.newValue,
					)
				}

				return
			}

			// this is set when the updates comes from a write request
			if (valueId.toUpdate) {
				valueId.toUpdate = false
			}

			let newValue = args.newValue
			if (isUint8Array(newValue)) {
				// encode Buffers as HEX strings
				newValue = utils.buffer2hex(newValue)
			}

			let prevValue = args.prevValue
			if (isUint8Array(prevValue)) {
				// encode Buffers as HEX strings
				prevValue = utils.buffer2hex(prevValue)
			}

			valueId.value = newValue
			valueId.stateless = !!args.stateless

			if (this.valuesObservers[valueId.id]) {
				this.valuesObservers[valueId.id].call(this, node, valueId)
			}

			// ensure duration is never undefined
			if (valueId.type === 'duration' && valueId.value === undefined) {
				valueId.value = new Duration(undefined, 'seconds')
			}

			if (!skipUpdate) {
				this.emitValueChanged(valueId, node, prevValue !== newValue)
			}

			// if valueId is stateless, automatically reset the value after 1 sec
			if (valueId.stateless) {
				if (this.statelessTimeouts[valueId.id]) {
					clearTimeout(this.statelessTimeouts[valueId.id])
				}

				this.statelessTimeouts[valueId.id] = setTimeout(() => {
					valueId.value = undefined
					// reset is itself a transition (X -> undefined), so the UI
					// must be told even after the no-op suppression in emitValueChanged
					this.emitValueChanged(valueId, node, true)
				}, 1000)
			}
		}
	}

	/**
	 * Remove a value from internal node values
	 *
	 */
	private _removeValue(
		zwaveNode: ZWaveNode,
		args: ZWaveNodeValueRemovedArgs,
	) {
		const node = this._nodes.get(zwaveNode.id)
		const vID = this._getValueID(args)
		const toRemove = node ? node.values[vID] : null

		if (toRemove) {
			delete node.values[vID]
			this.sendToSocket(socketEvents.valueRemoved, toRemove)
			this.logNode(zwaveNode, 'info', `ValueId ${vID} removed`)
		} else {
			this.logNode(
				zwaveNode,
				'warn',
				`ValueId ${vID} removed: no such node`,
			)
		}
	}

	// ------- Utils ------------------------

	private _parseNotification(parameters) {
		if (isUint8Array(parameters)) {
			return Buffer.from(parameters.buffer).toString('hex')
		} else if (parameters instanceof Duration) {
			return parameters.toMilliseconds()
		} else {
			return parameters
		}
	}

	/**
	 * Get the device id of a specific node
	 *
	 */
	private _getDeviceID(node: ZUINode): string {
		if (!node) return ''

		return `${node.manufacturerId}-${node.productId}-${node.productType}`
	}

	/**
	 * Check if a valueID is a current value
	 */
	private _isCurrentValue(valueId: TranslatedValueID | ZUIValueId) {
		return valueId.propertyName && /current/i.test(valueId.propertyName)
	}

	/**
	 * Find the target valueId of a current valueId
	 */
	private _findTargetValue(
		zwaveValue: TranslatedValueID,
		definedValueIds: TranslatedValueID[],
	) {
		return definedValueIds.find(
			(v) =>
				v.commandClass === zwaveValue.commandClass &&
				v.endpoint === zwaveValue.endpoint &&
				v.propertyKey === zwaveValue.propertyKey &&
				/target/i.test(v.property.toString()),
		)
	}

	private zwaveNodeToJSON(
		node: ZWaveNode,
	): Partial<
		ZWaveNode &
			Pick<
				ZUINode,
				| 'inited'
				| 'manufacturer'
				| 'productDescription'
				| 'productLabel'
				| 'supportsLongRange'
			>
	> {
		const zuiNode = this.nodes.get(node.id)

		return {
			id: node.id,
			inited: zuiNode?.inited,
			name: node.name,
			location: node.location,
			status: node.status,
			isControllerNode: node.isControllerNode,
			interviewStage: node.interviewStage,
			deviceClass: node.deviceClass,
			zwavePlusVersion: node.zwavePlusVersion,
			ready: node.ready,
			zwavePlusRoleType: node.zwavePlusRoleType,
			isListening: node.isListening,
			isFrequentListening: node.isFrequentListening,
			canSleep: node.canSleep,
			isRouting: node.isRouting,
			supportedDataRates: node.supportedDataRates,
			maxDataRate: node.maxDataRate,
			supportsSecurity: node.supportsSecurity,
			isSecure: node.isSecure,
			supportsBeaming: node.supportsBeaming,
			protocolVersion: node.protocolVersion,
			sdkVersion: node.sdkVersion,
			firmwareVersion: node.firmwareVersion,
			manufacturerId: node.manufacturerId,
			manufacturer: zuiNode?.manufacturer,
			productId: node.productId,
			productDescription: zuiNode?.productDescription,
			productType: node.productType,
			productLabel: zuiNode?.productLabel,
			deviceDatabaseUrl: node.deviceDatabaseUrl,
			keepAwake: node.keepAwake,
			protocol: node.protocol,
			supportsLongRange: zuiNode?.supportsLongRange,
		}
	}

	/**
	 * Get a valueId from a valueId object
	 */
	private _getValueID(v: Partial<ZUIValueId>, withNode = false) {
		return `${withNode ? v.nodeId + '-' : ''}${v.commandClass}-${
			v.endpoint || 0
		}-${v.property}${
			v.propertyKey !== undefined ? '-' + v.propertyKey : ''
		}`
	}

	/**
	 * Internal function to check for config updates automatically once a day
	 *
	 */
	private async _scheduledConfigCheck() {
		try {
			await this.checkForConfigUpdates()
		} catch (error) {
			logger.warn(`Scheduled update check has failed: ${error.message}`)
		}

		const nextUpdate = new Date()
		nextUpdate.setHours(24, 0, 0, 0) // next midnight

		const waitMillis = nextUpdate.getTime() - Date.now()

		logger.info(`Next update scheduled for: ${nextUpdate}`)

		this.updatesCheckTimeout = setTimeout(
			this._scheduledConfigCheck.bind(this),
			waitMillis > 0 ? waitMillis : 1000,
		)
	}

	private async _scheduledFirmwareUpdateCheck() {
		return this._firmwareUpdateService.scheduledFirmwareUpdateCheck()
	}

	/**
	 * Try to poll a value, don't throw. Used in the setTimeout
	 *
	 */
	private async _tryPoll(valueId: ZUIValueId, interval: number) {
		try {
			await this.pollValue(valueId)
		} catch (error) {
			logger.error(
				`Error while polling value ${this._getValueID(
					valueId,
					true,
				)}: ${error.message}`,
			)
		}

		this.setPollInterval(valueId, interval)
	}

	/** Loads fake nodes exported from UI */
	private async loadFakeNodes() {
		const filePath = utils.joinPath(true, 'fakeNodes.json')
		// load fake nodes from `fakeNodes.json` for testing
		if (await utils.pathExists(filePath)) {
			const fakeNodes = JSON.parse(await readFile(filePath, 'utf-8'))
			for (const node of fakeNodes) {
				// convert valueIds array to map
				const values = {}
				for (const value of node.values) {
					values[this._getValueID(value)] = value
				}
				node.values = values
				node.inited = false // so nodeInited event is triggered
				node.hassDevices = {}
				this._nodes.set(node.id, node)
				this.emitNodeUpdate(node)
			}
		}
	}

	/** Used for testing purposes */
	private emulateFwUpdate(
		nodeId: number,
		totalFiles = 3,
		fragmentsPerFile = 100,
	) {
		const interval = setInterval(() => {
			const totalFilesFragments = totalFiles * fragmentsPerFile
			const progress = this.nodes.get(nodeId).firmwareUpdate ?? {
				totalFiles,
				currentFile: 1,
				sentFragments: 0,
				totalFragments: fragmentsPerFile,
				progress: 0,
			}

			// random increment from 0 to 5
			progress.sentFragments += Math.round(Math.random() * 5)
			if (progress.sentFragments >= progress.totalFragments) {
				progress.currentFile += 1
				progress.sentFragments = 0
			}

			if (progress.currentFile > totalFiles) {
				let api: 'firmwareUpdateOTW' | 'firmwareUpdateOTA'
				if (this.nodes.get(nodeId).isControllerNode) {
					api = 'firmwareUpdateOTW'
					this._onOTWFirmwareUpdateFinished({
						status: OTWFirmwareUpdateStatus.OK,
						success: true,
					})
				} else {
					api = 'firmwareUpdateOTA'
					this._onNodeFirmwareUpdateFinished(
						this.driver.controller.nodes.get(nodeId),
						{
							reInterview: false,
							status: FirmwareUpdateStatus.OK_NoRestart,
							success: true,
							waitTime: 1000,
						},
					)
				}

				const result = {
					success: true,
					message: 'Firmware update finished',
					result: true,
					api,
					args: [],
				}

				this.socket.emit(socketEvents.api, result)

				clearInterval(interval)
				return
			}

			progress.progress = Math.round(
				(100 *
					(fragmentsPerFile * (progress.currentFile - 1) +
						progress.sentFragments)) /
					totalFilesFragments,
			)

			if (this.nodes.get(nodeId)?.isControllerNode) {
				// emulate a ping to another node
				Array.from(this.driver.controller.nodes.entries())[1][1]
					.ping()
					.catch(() => {
						//noop
					})
				this._onOTWFirmwareUpdateProgress({
					sentFragments: progress.sentFragments,
					totalFragments: progress.totalFragments,
					progress: progress.progress,
				})
			} else {
				// emulate a ping to node
				this.driver.controller.nodes
					.get(nodeId)
					.ping()
					.catch(() => {
						//noop
					})
				this._onNodeFirmwareUpdateProgress(
					this.driver.controller.nodes.get(nodeId),
					progress,
				)
			}
		}, 1000)
	}
}

export default ZwaveClient
