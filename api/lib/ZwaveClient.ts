// eslint-disable-next-line one-var
import {
	CommandClasses,
	ConfigurationMetadata,
	dskToString,
	Duration,
	Firmware,
	isUnsupervisedOrSucceeded,
	Route,
	RouteKind,
	SecurityClass,
	SupervisionResult,
	SupervisionStatus,
	ValueMetadataNumeric,
	ValueMetadataString,
	ZWaveDataRate,
	ZWaveErrorCodes,
	Protocols,
	createDefaultTransportFormat,
	FirmwareFileFormat,
	tryUnzipFirmwareFile,
	extractFirmwareAsync,
} from '@zwave-js/core'
import { JSONTransport } from '@zwave-js/log-transport-json'
import { isDocker } from '@zwave-js/shared'
import {
	AssociationAddress,
	AssociationGroup,
	ControllerFirmwareUpdateProgress,
	ControllerFirmwareUpdateResult,
	ControllerFirmwareUpdateStatus,
	ControllerStatistics,
	ControllerStatus,
	DataRate,
	Driver,
	ExclusionOptions,
	ExclusionStrategy,
	FirmwareUpdateCapabilities,
	FirmwareUpdateProgress,
	FirmwareUpdateResult,
	FirmwareUpdateStatus,
	FLiRS,
	FoundNode,
	GetFirmwareUpdatesOptions,
	guessFirmwareFileFormat,
	RebuildRoutesOptions,
	RebuildRoutesStatus,
	InclusionGrant,
	InclusionOptions,
	InclusionResult,
	InclusionStrategy,
	InterviewStage,
	libVersion,
	LifelineHealthCheckResult,
	LifelineHealthCheckSummary,
	MultilevelSwitchCommand,
	NodeInterviewFailedEventArgs,
	NodeStatistics,
	NodeStatus,
	NodeType,
	PlannedProvisioningEntry,
	ProtocolVersion,
	QRCodeVersion,
	QRProvisioningInformation,
	RefreshInfoOptions,
	RemoveNodeReason,
	ReplaceNodeOptions,
	RFRegion,
	RouteHealthCheckResult,
	RouteHealthCheckSummary,
	ScheduleEntryLockCC,
	ScheduleEntryLockDailyRepeatingSchedule,
	ScheduleEntryLockScheduleKind,
	ScheduleEntryLockSlotId,
	ScheduleEntryLockWeekDaySchedule,
	ScheduleEntryLockYearDaySchedule,
	SerialAPISetupCommand,
	SetValueAPIOptions,
	setValueFailed,
	SetValueResult,
	SetValueStatus,
	setValueWasUnsupervisedOrSucceeded,
	SmartStartProvisioningEntry,
	TranslatedValueID,
	UserCodeCC,
	UserIDStatus,
	ValueID,
	ValueMetadata,
	ValueType,
	ZWaveError,
	ZWaveNode,
	ZWaveNodeEvents,
	ZWaveNodeFirmwareUpdateFinishedCallback,
	ZWaveNodeFirmwareUpdateProgressCallback,
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
	ProvisioningEntryStatus,
	AssociationCheckResult,
	LinkReliabilityCheckResult,
	JoinNetworkOptions,
	JoinNetworkStrategy,
	JoinNetworkResult,
} from 'zwave-js'
import { getEnumMemberName, parseQRCodeString } from 'zwave-js/Utils'
import { configDbDir, logsDir, nvmBackupsDir, storeDir } from '../config/app'
import store from '../config/store'
import jsonStore from './jsonStore'
import * as LogManager from './logger'
import * as utils from './utils'

import { serverVersion, ZwavejsServer } from '@zwave-js/server'
import { ensureDir, exists, mkdirp, writeFile } from 'fs-extra'
import { Server as SocketServer } from 'socket.io'
import { TypedEventEmitter } from './EventEmitter'
import { GatewayValue } from './Gateway'

import { ConfigManager, DeviceConfig } from '@zwave-js/config'
import { readFile } from 'fs/promises'
import backupManager, { NVM_BACKUP_PREFIX } from './BackupManager'
import { socketEvents } from './SocketEvents'
import { isUint8Array } from 'util/types'

export const deviceConfigPriorityDir = storeDir + '/config'

export const configManager = new ConfigManager({
	deviceConfigPriorityDir,
})

const logger = LogManager.module('Z-Wave')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const loglevels = require('triple-beam').configs.npm.levels

const NEIGHBORS_LOCK_REFRESH = 60 * 1000

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

export type SensorTypeScale = {
	key: string | number
	sensor: string
	label: string
	unit?: string
	description?: string
}

export type AllowedApis = (typeof allowedApis)[number]

const ZWAVEJS_LOG_FILE = utils.joinPath(logsDir, 'zwavejs_%DATE%.log')

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
	ccSpecific: Record<string, any>
	min?: number
	max?: number
	step?: number
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
	text: string
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

export type HassDevice = {
	type:
		| 'sensor'
		| 'light'
		| 'binary_sensor'
		| 'cover'
		| 'climate'
		| 'lock'
		| 'switch'
		| 'fan'
		| 'number'
	object_id: string
	discovery_payload: { [key: string]: any }
	discoveryTopic?: string
	values?: string[]
	action_map?: { [key: number]: string }
	setpoint_topic?: { [key: number]: string }
	default_setpoint?: string
	persistent?: boolean
	ignoreDiscovery?: boolean
	fan_mode_map?: { [key: string]: number }
	mode_map?: { [key: string]: number }
	id?: string
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
	data: Buffer | Uint8Array
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

export enum ZUIScheduleEntryLockMode {
	DAILY = 'daily',
	WEEKLY = 'weekly',
	YEARLY = 'yearly',
}

export interface ZUISchedule {
	[ZUIScheduleEntryLockMode.DAILY]: ZUIScheduleConfig<ScheduleEntryLockDailyRepeatingSchedule>
	[ZUIScheduleEntryLockMode.WEEKLY]: ZUIScheduleConfig<ScheduleEntryLockWeekDaySchedule>
	[ZUIScheduleEntryLockMode.YEARLY]: ZUIScheduleConfig<ScheduleEntryLockYearDaySchedule>
}

export type ZUISlot<T> = T & { enabled: boolean } & ScheduleEntryLockSlotId

export interface ZUIScheduleConfig<T> {
	numSlots: number
	slots: ZUISlot<T>[]
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
	RFRegion?: RFRegion
	rfRegions?: { text: string; value: number }[]
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
	hexId?: string
	values?: { [key: string]: ZUIValueId }
	groups?: ZUINodeGroups[]
	ready: boolean
	available: boolean
	failed: boolean
	lastActive?: number
	dbLink?: string
	maxDataRate?: DataRate
	interviewStage?: keyof typeof InterviewStage
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
}

export type NodeEvent = {
	event: ZwaveNodeEvents | 'status changed'
	args: any[]
	time: Date
}

export type ZwaveConfig = {
	enabled?: boolean
	allowBootloaderOnly?: boolean
	port?: string
	networkKey?: string
	securityKeys?: utils.DeepPartial<{
		S2_Unauthenticated: string
		S2_Authenticated: string
		S2_AccessControl: string
		S0_Legacy: string
	}>
	securityKeysLongRange?: utils.DeepPartial<{
		S2_Authenticated: string
		S2_AccessControl: string
	}>
	serverEnabled?: boolean
	enableSoftReset?: boolean
	disableWatchdog?: boolean
	deviceConfigPriorityDir?: string
	serverPort?: number
	serverHost?: string
	logEnabled?: boolean
	maxFiles?: number
	logLevel?: LogManager.LogLevel
	commandsTimeout?: number
	sendToSleepTimeout?: number
	responseTimeout?: number
	enableStatistics?: boolean
	disclaimerVersion?: number
	options?: ZWaveOptions
	// healNetwork?: boolean
	healHour?: number
	logToFile?: boolean
	nodeFilter?: string[]
	scales?: SensorTypeScale[]
	serverServiceDiscoveryDisabled?: boolean
	maxNodeEventsQueueSize?: number
	higherReportsTimeout?: boolean
	disableControllerRecovery?: boolean
	rf?: {
		region?: RFRegion
		txPower?: {
			powerlevel: number
			measured0dBm: number
		}
	}
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

export enum ZwaveClientStatus {
	CONNECTED = 'connected',
	BOOTLOADER_READY = 'bootloader ready',
	DRIVER_READY = 'driver ready',
	SCAN_DONE = 'scan done',
	DRIVER_FAILED = 'driver failed',
	CLOSED = 'closed',
}

export enum EventSource {
	DRIVER = 'driver',
	CONTROLLER = 'controller',
	NODE = 'node',
}

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
	private scenes: ZUIScene[]
	private _nodes: Map<number, ZUINode>
	private storeNodes: Record<number, Partial<ZUINode>>
	private _devices: Record<string, Partial<ZUINode>>
	private driverInfo: ZUIDriverInfo
	private status: ZwaveClientStatus
	// used to store node info before inclusion like name and location
	private tmpNode: utils.DeepPartial<ZUINode>
	// tells if a node replacement is in progress
	private isReplacing = false

	private hasUserCallbacks = false

	private _error: string | undefined
	private _scanComplete: boolean
	private _cntStatus: string

	private lastUpdate: number

	private _driver: Driver

	private server: ZwavejsServer
	private statelessTimeouts: Record<string, NodeJS.Timeout>
	private commandsTimeout: NodeJS.Timeout
	private healTimeout: NodeJS.Timeout
	private updatesCheckTimeout: NodeJS.Timeout
	private pollIntervals: Record<string, NodeJS.Timeout>

	private _lockNeighborsRefresh: boolean
	private _lockGetSchedule: boolean
	private _cancelGetSchedule: boolean

	private nvmEvent: string

	private backoffRetry = 0
	private restartTimeout: NodeJS.Timeout

	private driverFunctionCache: utils.Snippet[] = []

	// Foreach valueId, we store a callback function to be called when the value changes
	private valuesObservers: Record<string, ValueIdObserver> = {}

	private _grantResolve: (grant: InclusionGrant | false) => void | null
	private _dskResolve: (dsk: string | false) => void | null

	private throttledFunctions: Map<
		string,
		{ lastUpdate: number; fn: () => void; timeout: NodeJS.Timeout }
	> = new Map()

	private inclusionUserCallbacks: InclusionUserCallbacks = {
		grantSecurityClasses: this._onGrantSecurityClasses.bind(this),
		validateDSKAndEnterPIN: this._onValidateDSK.bind(this),
		abort: this._onAbortInclusion.bind(this),
	}
	private _inclusionState: InclusionState = undefined

	private _controllerListenersAdded: boolean = false
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
		this.scenes = jsonStore.get(store.scenes)

		this._nodes = new Map()
		this.storeNodes = jsonStore.get(store.nodes)

		// convert store nodes from array to object
		if (Array.isArray(this.storeNodes)) {
			const storeNodes = {}

			for (let i = 0; i < this.storeNodes.length; i++) {
				if (this.storeNodes[i]) {
					storeNodes[i] = this.storeNodes[i]
				}
			}

			this.storeNodes = storeNodes

			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			this.updateStoreNodes(false)
		}

		this._devices = {}
		this.driverInfo = {}
		this.healTimeout = null

		this.status = ZwaveClientStatus.CLOSED
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

	backoffRestart(): void {
		// fix edge case where client is half closed and restart is called
		if (this.checkIfDestroyed()) {
			return
		}

		const timeout = Math.min(2 ** this.backoffRetry * 1000, 15000)
		this.backoffRetry++

		logger.info(
			`Restarting client in ${timeout / 1000} seconds, retry ${
				this.backoffRetry
			}`,
		)

		this.restartTimeout = setTimeout(() => {
			this.restart().catch((error) => {
				logger.error(`Error while restarting driver: ${error.message}`)
			})
		}, timeout)
	}

	/**
	 * Checks if this client is destroyed and if so closes it
	 * @returns True if client is destroyed
	 */
	checkIfDestroyed() {
		if (this.destroyed) {
			logger.debug(
				`Client listening on '${this.cfg.port}' is destroyed, closing`,
			)
			this.close(true).catch((error) => {
				logger.error(`Error while closing driver: ${error.message}`)
			})
			return true
		}

		return false
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
						if (oldEntry?.fn) {
							oldEntry.lastUpdate = Date.now()
							fn()
						}
					},
					entry.lastUpdate + wait - now,
				)
			}
			// discard the old function and store the new one
			entry.fn = fn
		}
	}

	/**
	 * Returns the driver ZWaveNode object
	 */
	getNode(nodeId: number): ZWaveNode {
		return this._driver.controller.nodes.get(nodeId)
	}

	setUserCallbacks() {
		this.hasUserCallbacks = true
		if (!this._driver || !this.cfg.serverEnabled) {
			return
		}

		logger.info('Setting user callbacks')

		this.driver.updateOptions({
			inclusionUserCallbacks: {
				...this.inclusionUserCallbacks,
			},
		})
	}

	removeUserCallbacks() {
		this.hasUserCallbacks = false
		if (!this._driver || !this.cfg.serverEnabled) {
			return
		}

		logger.info('Removing user callbacks')

		this.driver.updateOptions({
			inclusionUserCallbacks: undefined,
		})

		// when no user is connected, give back the control to HA server
		if (this.server?.['sockets'] !== undefined) {
			this.server.setInclusionUserCallbacks()
		}
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
		const node = this._nodes.get(nodeId)

		// check for existing node and node hassdevice with given id
		if (node && hassDevice.id && node.hassDevices?.[hassDevice.id]) {
			if (deleteDevice) {
				delete node.hassDevices[hassDevice.id]
			} else {
				const id = hassDevice.id
				delete hassDevice.id
				node.hassDevices[id] = hassDevice
			}

			this.emitNodeUpdate(node, {
				hassDevices: node.hassDevices,
			})
		}
	}

	/**
	 * Used to Add a new hass device to a specific node
	 */
	addDevice(hassDevice: HassDevice, nodeId: number) {
		const node = this._nodes.get(nodeId)

		// check for existing node and node hassdevice with given id
		if (node && hassDevice.id) {
			delete hassDevice.id
			const id = hassDevice.type + '_' + hassDevice.object_id
			hassDevice.persistent = false
			node.hassDevices[id] = hassDevice

			this.emitNodeUpdate(node, {
				hassDevices: node.hassDevices,
			})
		}
	}

	/**
	 * Used to update hass devices list of a specific node and store them in `nodes.json`
	 *
	 */
	async storeDevices(
		devices: { [key: string]: HassDevice },
		nodeId: number,
		remove: any,
	) {
		const node = this._nodes.get(nodeId)

		if (node) {
			for (const id in devices) {
				devices[id].persistent = !remove
			}

			if (remove) {
				delete this.storeNodes[nodeId].hassDevices
			} else {
				this.storeNodes[nodeId].hassDevices = devices
			}

			node.hassDevices = utils.copy(devices)
			await this.updateStoreNodes()

			this.emitNodeUpdate(node, {
				hassDevices: node.hassDevices,
			})
		}
	}

	/**
	 * Method used to close client connection, use this before destroy
	 */
	async close(keepListeners = false) {
		this.status = ZwaveClientStatus.CLOSED
		this.closed = true
		this.driverReady = false

		if (this.commandsTimeout) {
			clearTimeout(this.commandsTimeout)
			this.commandsTimeout = null
		}

		if (this.restartTimeout) {
			clearTimeout(this.restartTimeout)
			this.restartTimeout = null
		}

		if (this.healTimeout) {
			clearTimeout(this.healTimeout)
			this.healTimeout = null
		}

		if (this.updatesCheckTimeout) {
			clearTimeout(this.updatesCheckTimeout)
			this.updatesCheckTimeout = null
		}

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

		if (this.server) {
			await this.server.destroy()
			this.server = null
		}

		if (this._driver) {
			await this._driver.destroy()
			this._driver = null
			this._controllerListenersAdded = false
		}

		if (!keepListeners) {
			this.destroyed = true
			this.removeAllListeners()
		}

		logger.info('Client closed')
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
			inclusionState: this._inclusionState,
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
		const zwaveNode = this.getNode(nodeId)

		if (!zwaveNode?.commandClasses['Schedule Entry Lock'].isSupported()) {
			throw new Error(
				'Schedule Entry Lock CC not supported on node ' + nodeId,
			)
		}

		if (this._lockGetSchedule) {
			throw new Error(
				'Another request is in progress, cancel it or wait...',
			)
		}

		const promise = async () => {
			this._cancelGetSchedule = false
			this._lockGetSchedule = true
			const { mode, fromCache } = opts
			// TODO: should we check also other endpoints?
			const endpointIndex = 0
			const endpoint = zwaveNode.getEndpoint(endpointIndex)

			const userCodes = UserCodeCC.getSupportedUsersCached(
				this.driver,
				endpoint,
			)

			const numSlots = {
				numWeekDaySlots: ScheduleEntryLockCC.getNumWeekDaySlotsCached(
					this.driver,
					endpoint,
				),
				numYearDaySlots: ScheduleEntryLockCC.getNumYearDaySlotsCached(
					this.driver,
					endpoint,
				),
				numDailyRepeatingSlots:
					ScheduleEntryLockCC.getNumDailyRepeatingSlotsCached(
						this.driver,
						endpoint,
					),
			}

			const node = this._nodes.get(nodeId)

			const weeklySchedules: ZUISlot<ScheduleEntryLockWeekDaySchedule>[] =
				node.schedule?.weekly?.slots ?? []
			const yearlySchedules: ZUISlot<ScheduleEntryLockYearDaySchedule>[] =
				node.schedule?.yearly?.slots ?? []
			const dailySchedules: ZUISlot<ScheduleEntryLockDailyRepeatingSchedule>[] =
				node.schedule?.daily?.slots ?? []

			node.schedule = {
				daily: {
					numSlots: numSlots.numDailyRepeatingSlots,
					slots: dailySchedules,
				},
				weekly: {
					numSlots: numSlots.numWeekDaySlots,
					slots: weeklySchedules,
				},
				yearly: {
					numSlots: numSlots.numYearDaySlots,
					slots: yearlySchedules,
				},
			}

			node.userCodes = {
				total: userCodes,
				available: [],
				enabled: [],
			}

			const pushSchedule = (
				arr: ZUISlot<any>[],
				slot: ScheduleEntryLockSlotId,
				schedule:
					| ScheduleEntryLockWeekDaySchedule
					| ScheduleEntryLockYearDaySchedule
					| ScheduleEntryLockDailyRepeatingSchedule,
				enabled: boolean,
			) => {
				const index = arr.findIndex(
					(s) => s.userId === slot.userId && s.slotId === slot.slotId,
				)
				if (schedule) {
					const newSlot = {
						...slot,
						...schedule,
						enabled,
					}
					if (index === -1) {
						arr.push(newSlot)
					} else {
						arr[index] = newSlot
					}
				} else if (index !== -1) {
					arr.splice(index, 1)
				}
			}

			for (let i = 1; i <= userCodes; i++) {
				const status = UserCodeCC.getUserIdStatusCached(
					this.driver,
					endpoint,
					i,
				)

				if (
					status === undefined ||
					status === UserIDStatus.Available ||
					status === UserIDStatus.StatusNotAvailable
				) {
					// skip query on not enabled userIds or empty codes
					continue
				}

				node.userCodes.available.push(i)

				const enabledUserId =
					ScheduleEntryLockCC.getUserCodeScheduleEnabledCached(
						this.driver,
						endpoint,
						i,
					)

				if (enabledUserId) {
					node.userCodes.enabled.push(i)
				}

				const enabledType =
					ScheduleEntryLockCC.getUserCodeScheduleKindCached(
						this.driver,
						endpoint,
						i,
					)

				const getCached = (
					kind: ScheduleEntryLockScheduleKind,
					slotId: number,
				) =>
					ScheduleEntryLockCC.getScheduleCached(
						this.driver,
						endpoint,
						kind,
						i,
						slotId,
					)

				if (!mode || mode === ZUIScheduleEntryLockMode.WEEKLY) {
					const enabled =
						enabledType === ScheduleEntryLockScheduleKind.WeekDay

					for (let s = 1; s <= numSlots.numWeekDaySlots; s++) {
						if (this._cancelGetSchedule) return

						const slot: ScheduleEntryLockSlotId = {
							userId: i,
							slotId: s,
						}

						const schedule = fromCache
							? <ScheduleEntryLockWeekDaySchedule>(
									getCached(
										ScheduleEntryLockScheduleKind.WeekDay,
										s,
									)
								)
							: await zwaveNode.commandClasses[
									'Schedule Entry Lock'
								].getWeekDaySchedule(slot)

						pushSchedule(weeklySchedules, slot, schedule, enabled)
					}
				}

				if (!mode || mode === ZUIScheduleEntryLockMode.YEARLY) {
					const enabled =
						enabledType === ScheduleEntryLockScheduleKind.YearDay

					for (let s = 1; s <= numSlots.numYearDaySlots; s++) {
						if (this._cancelGetSchedule) return

						const slot: ScheduleEntryLockSlotId = {
							userId: i,
							slotId: s,
						}
						const schedule = fromCache
							? <ScheduleEntryLockYearDaySchedule>(
									getCached(
										ScheduleEntryLockScheduleKind.YearDay,
										s,
									)
								)
							: await zwaveNode.commandClasses[
									'Schedule Entry Lock'
								].getYearDaySchedule(slot)

						pushSchedule(yearlySchedules, slot, schedule, enabled)
					}
				}

				if (!mode || mode === ZUIScheduleEntryLockMode.DAILY) {
					const enabled =
						enabledType ===
						ScheduleEntryLockScheduleKind.DailyRepeating

					for (let s = 1; s <= numSlots.numDailyRepeatingSlots; s++) {
						if (this._cancelGetSchedule) return

						const slot: ScheduleEntryLockSlotId = {
							userId: i,
							slotId: s,
						}
						const schedule = fromCache
							? <ScheduleEntryLockDailyRepeatingSchedule>(
									getCached(
										ScheduleEntryLockScheduleKind.DailyRepeating,
										s,
									)
								)
							: await zwaveNode.commandClasses[
									'Schedule Entry Lock'
								].getDailyRepeatingSchedule(slot)

						pushSchedule(dailySchedules, slot, schedule, enabled)
					}
				}
			}

			this.emitNodeUpdate(node, {
				schedule: node.schedule,
				userCodes: node.userCodes,
			})

			return node.schedule
		}

		return promise().finally(() => {
			this._lockGetSchedule = false
			this._cancelGetSchedule = false
		})
	}

	cancelGetSchedule() {
		this._cancelGetSchedule = true
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
		const zwaveNode = this.getNode(nodeId)

		if (!zwaveNode?.commandClasses['Schedule Entry Lock'].isSupported()) {
			throw new Error(
				'Schedule Entry Lock CC not supported on node ' + nodeId,
			)
		}

		const slot: ScheduleEntryLockSlotId = {
			userId: schedule.userId,
			slotId: schedule.slotId,
		}

		delete schedule.userId
		delete schedule.slotId
		delete schedule['enabled']

		const isDelete = Object.keys(schedule).length === 0

		if (isDelete) {
			schedule = undefined
		}

		let result: SupervisionResult

		if (type === 'daily') {
			result = await zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setDailyRepeatingSchedule(
				slot,
				schedule as ScheduleEntryLockDailyRepeatingSchedule,
			)
		} else if (type === 'weekly') {
			result = await zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setWeekDaySchedule(
				slot,
				schedule as ScheduleEntryLockWeekDaySchedule,
			)
		} else if (type === 'yearly') {
			result = await zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setYearDaySchedule(
				slot,
				schedule as ScheduleEntryLockYearDaySchedule,
			)
		} else {
			throw new Error('Invalid schedule type')
		}

		// means that is not using supervision, read slot and check if it matches
		if (!result) {
			const methods = {
				daily: 'getDailyRepeatingSchedule',
				weekly: 'getWeekDaySchedule',
				yearly: 'getYearDaySchedule',
			}
			const res =
				await zwaveNode.commandClasses['Schedule Entry Lock'][
					methods[type]
				](slot)

			if (
				(isDelete && !res) ||
				(!isDelete && res && utils.deepEqual(res, schedule))
			) {
				result = {
					status: SupervisionStatus.Success,
				}
			} else {
				result = {
					status: SupervisionStatus.Fail,
				}
			}
		}

		if (result.status === SupervisionStatus.Success) {
			const node = this._nodes.get(nodeId)

			// update enabled state
			for (const mode in node.schedule) {
				node.schedule[mode].slots = node.schedule[mode].slots.map(
					(s: ZUISlot<any>) => ({
						...s,
						enabled: mode === type,
					}),
				)
			}

			const slots = node.schedule?.[type]?.slots

			if (slots) {
				const slotIndex = slots.findIndex(
					(s) => s.userId === slot.userId && s.slotId === slot.slotId,
				)
				const newSlot = isDelete
					? null
					: {
							...slot,
							...schedule,
							enabled: true,
						}

				if (isDelete) {
					if (slotIndex !== -1) {
						slots.splice(slotIndex, 1)
					}
				} else if (slotIndex !== -1) {
					slots[slotIndex] = newSlot
				} else {
					slots.push(newSlot as any)
				}

				const isEnabledUsercode = node.userCodes?.enabled?.includes(
					slot.userId,
				)

				if (!isDelete && !isEnabledUsercode) {
					node.userCodes.enabled.push(slot.userId)
				} else if (isDelete && isEnabledUsercode) {
					const index = node.userCodes.enabled.indexOf(slot.userId)
					if (index >= 0) {
						node.userCodes.enabled.splice(index, 1)
					}
				}

				this.emitNodeUpdate(node, {
					schedule: node.schedule,
					userCodes: node.userCodes,
				})
			}
		}

		return result
	}

	async setEnabledSchedule(nodeId: number, enabled: boolean, userId: number) {
		const zwaveNode = this.getNode(nodeId)

		if (!zwaveNode) {
			throw new Error('Node not found')
		}

		const result = await zwaveNode.commandClasses[
			'Schedule Entry Lock'
		].setEnabled(enabled, userId)

		// if result is not defined here we don't have a way
		// to know if the command was successful or not as there is no
		// 'get' command for this, so we just assume it was successful
		if (isUnsupervisedOrSucceeded(result)) {
			const node = this._nodes.get(nodeId)

			if (node) {
				if (userId) {
					if (enabled) {
						node.userCodes?.enabled.push(userId)
					} else {
						const index = node.userCodes?.enabled.indexOf(userId)
						if (index >= 0) {
							node.userCodes.enabled.splice(index, 1)
						}
					}
				} else {
					node.userCodes.enabled = enabled
						? node.userCodes.available.slice()
						: []
				}

				this.emitNodeUpdate(node, {
					userCodes: node.userCodes,
				})
			}
		}

		return result
	}

	/**
	 * Populate node `groups`
	 */
	getGroups(nodeId: number, ignoreUpdate = false) {
		const zwaveNode = this.getNode(nodeId)
		const node = this._nodes.get(nodeId)
		if (node && zwaveNode) {
			let endpointGroups: ReadonlyMap<
				number,
				ReadonlyMap<number, AssociationGroup>
			> = new Map()
			try {
				endpointGroups =
					this._driver.controller.getAllAssociationGroups(nodeId)
			} catch (error) {
				this.logNode(
					zwaveNode,
					'warn',
					`Error while fetching groups associations: ${error.message}`,
				)
			}
			node.groups = []

			for (const [endpoint, groups] of endpointGroups) {
				for (const [groupIndex, group] of groups) {
					// https://zwave-js.github.io/node-zwave-js/#/api/controller?id=associationgroup-interface
					node.groups.push({
						text: group.label,
						endpoint: endpoint,
						value: groupIndex,
						maxNodes: group.maxNodes,
						isLifeline: group.isLifeline,
						multiChannel: group.multiChannel,
					})
				}
			}
		}

		if (node && !ignoreUpdate) {
			this.emitNodeUpdate(node, { groups: node.groups })
		}
	}

	/**
	 * Get an array of current [associations](https://zwave-js.github.io/node-zwave-js/#/api/controller?id=association-interface) of a specific group
	 */
	async getAssociations(
		nodeId: number,
		refresh = false,
	): Promise<ZUIGroupAssociation[]> {
		const zwaveNode = this.getNode(nodeId)
		const toReturn: ZUIGroupAssociation[] = []

		if (zwaveNode) {
			try {
				if (refresh) {
					await zwaveNode.refreshCCValues(CommandClasses.Association)
					await zwaveNode.refreshCCValues(
						CommandClasses['Multi Channel Association'],
					)
				}
				// https://zwave-js.github.io/node-zwave-js/#/api/controller?id=association-interface
				// the result is a map where the key is the group number and the value is the array of associations {nodeId, endpoint?}
				const result =
					this._driver.controller.getAllAssociations(nodeId)
				for (const [source, group] of result.entries()) {
					for (const [groupId, associations] of group) {
						for (const a of associations) {
							toReturn.push({
								endpoint: source.endpoint,
								groupId: groupId,
								nodeId: a.nodeId,
								targetEndpoint: a.endpoint,
							} as ZUIGroupAssociation)
						}
					}
				}
			} catch (error) {
				this.logNode(
					zwaveNode,
					'warn',
					`Error while fetching groups associations: ${error.message}`,
				)
				// node doesn't support groups associations
			}
		} else {
			this.logNode(
				zwaveNode,
				'warn',
				`Error while fetching groups associations, node not found`,
			)
		}

		return toReturn
	}

	/**
	 * Check if a given association is allowed
	 */
	checkAssociation(
		source: AssociationAddress,
		groupId: number,
		association: AssociationAddress,
	) {
		return this.driver.controller.checkAssociation(
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
	) {
		const zwaveNode = this.getNode(source.nodeId)

		const sourceMsg = `Node ${
			source.nodeId +
			(source.endpoint ? ' Endpoint ' + source.endpoint : '')
		}`

		if (!zwaveNode) {
			throw new Error(`Node ${source.nodeId} not found`)
		}

		const result: AssociationCheckResult[] = []

		for (const a of associations) {
			const checkResult = this._driver.controller.checkAssociation(
				source,
				groupId,
				a,
			)

			result.push(checkResult)

			if (checkResult === AssociationCheckResult.OK) {
				this.logNode(
					zwaveNode,
					'info',
					`Adding Node ${a.nodeId} to Group ${groupId} of ${sourceMsg}`,
				)

				await this._driver.controller.addAssociations(source, groupId, [
					a,
				])
			} else {
				this.logNode(
					zwaveNode,
					'warn',
					`Unable to add Node ${a.nodeId} to Group ${groupId} of ${sourceMsg}: ${getEnumMemberName(AssociationCheckResult, checkResult)}`,
				)
			}
		}

		return result
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
		const zwaveNode = this.getNode(source.nodeId)

		const sourceMsg = `Node ${
			source.nodeId +
			(source.endpoint ? ' Endpoint ' + source.endpoint : '')
		}`

		if (zwaveNode) {
			try {
				this.logNode(
					zwaveNode,
					'info',
					`Removing associations from ${sourceMsg} Group ${groupId}: %o`,
					associations,
				)

				await this._driver.controller.removeAssociations(
					source,
					groupId,
					associations,
				)
			} catch (error) {
				this.logNode(
					zwaveNode,
					'warn',
					`Error while removing associations from ${sourceMsg}: ${error.message}`,
				)
			}
		} else {
			this.logNode(
				zwaveNode,
				'warn',
				`Error while removing associations from ${sourceMsg}, node not found`,
			)
		}
	}

	/**
	 * Remove all associations
	 */
	async removeAllAssociations(nodeId: number) {
		const zwaveNode = this.getNode(nodeId)

		if (zwaveNode) {
			try {
				const allAssociations =
					this._driver.controller.getAllAssociations(nodeId)

				for (const [
					source,
					groupAssociations,
				] of allAssociations.entries()) {
					for (const [groupId, associations] of groupAssociations) {
						if (associations.length > 0) {
							await this._driver.controller.removeAssociations(
								source,
								groupId,
								associations as AssociationAddress[],
							)
							this.logNode(
								zwaveNode,
								'info',
								`Removed ${
									associations.length
								} associations from Node ${
									source.nodeId +
									(source.endpoint
										? ' Endpoint ' + source.endpoint
										: '')
								} group ${groupId}`,
							)
						}
					}
				}
			} catch (error) {
				this.logNode(
					zwaveNode,
					'warn',
					`Error while removing all associations from ${nodeId}: ${error.message}`,
				)
			}
		} else {
			this.logNode(
				zwaveNode,
				'warn',
				`Node not found when calling 'removeAllAssociations'`,
			)
		}
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
		const zwaveNode = this.getNode(nodeId)

		if (zwaveNode) {
			try {
				this.logNode(
					zwaveNode,
					'info',
					`Removing Node ${nodeId} from all associations`,
				)

				await this._driver.controller.removeNodeFromAllAssociations(
					nodeId,
				)
			} catch (error) {
				this.logNode(
					zwaveNode,
					'warn',
					`Error while removing Node ${nodeId} from all associations: ${error.message}`,
				)
			}
		} else {
			this.logNode(
				zwaveNode,
				'warn',
				`Node not found when calling 'removeNodeFromAllAssociations'`,
			)
		}
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
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			async function () {},
		).constructor

		const fn = new AsyncFunction('driver', code)

		return fn.call({ zwaveClient: this, require, logger }, this._driver)
	}

	/**
	 * Method used to start Z-Wave connection using configuration `port`
	 */
	async connect() {
		if (this.cfg.enabled === false) {
			logger.info('Z-Wave driver DISABLED')
			return
		}

		if (this.driverReady) {
			logger.info(`Driver already connected to ${this.cfg.port}`)
			return
		}

		// this could happen when the driver fails the connect and a reconnect timeout triggers
		if (this.closed || this.checkIfDestroyed()) {
			return
		}

		if (!this.cfg?.port) {
			logger.warn('Z-Wave driver not inited, no port configured')
			return
		}

		// extend options with hidden `options`
		const zwaveOptions: PartialZWaveOptions = {
			allowBootloaderOnly: this.cfg.allowBootloaderOnly || false,
			storage: {
				cacheDir: storeDir,
				deviceConfigPriorityDir:
					this.cfg.deviceConfigPriorityDir || deviceConfigPriorityDir,
			},
			logConfig: {
				// https://zwave-js.github.io/node-zwave-js/#/api/driver?id=logconfig
				enabled: this.cfg.logEnabled,
				level: this.cfg.logLevel
					? loglevels[this.cfg.logLevel]
					: 'info',
				logToFile: this.cfg.logToFile,
				filename: ZWAVEJS_LOG_FILE,
				forceConsole: isDocker() ? !this.cfg.logToFile : false,
				maxFiles: this.cfg.maxFiles || 7,
				nodeFilter:
					this.cfg.nodeFilter && this.cfg.nodeFilter.length > 0
						? this.cfg.nodeFilter.map((n) => parseInt(n))
						: undefined,
			},
			emitValueUpdateAfterSetValue: true,
			apiKeys: {
				firmwareUpdateService:
					'421e29797c3c2926f84efc737352d6190354b3b526a6dce6633674dd33a8a4f964c794f5',
			},
			timeouts: {
				report: this.cfg.higherReportsTimeout ? 10000 : undefined,
				sendToSleep: this.cfg.sendToSleepTimeout,
				response: this.cfg.responseTimeout,
			},
			features: {
				unresponsiveControllerRecovery: this.cfg
					.disableControllerRecovery
					? false
					: true,
				watchdog: this.cfg.disableWatchdog ? false : true,
			},
			userAgent: {
				[utils.pkgJson.name]: utils.pkgJson.version,
			},
		}

		// when no env is specified copy config db to store dir
		// fixes issues with pkg (and no more need to set this env on docker)
		if (!process.env.ZWAVEJS_EXTERNAL_CONFIG) {
			zwaveOptions.storage.deviceConfigExternalDir = configDbDir
		}

		if (this.cfg.rf) {
			const { region, txPower } = this.cfg.rf

			zwaveOptions.rf = {}

			if (typeof region === 'number') {
				zwaveOptions.rf.region = region
			}

			if (
				txPower &&
				typeof txPower.measured0dBm === 'number' &&
				typeof txPower.powerlevel === 'number'
			) {
				zwaveOptions.rf.txPower = txPower
			}
		}

		// ensure deviceConfigPriorityDir exists to prevent warnings #2374
		// lgtm [js/path-injection]
		await ensureDir(zwaveOptions.storage.deviceConfigPriorityDir)

		// when not set let zwavejs handle this based on the environment
		if (typeof this.cfg.enableSoftReset === 'boolean') {
			zwaveOptions.features.softReset = this.cfg.enableSoftReset
		}

		// when server is not enabled, disable the user callbacks set/remove
		// so it can be used through MQTT
		if (!this.cfg.serverEnabled) {
			zwaveOptions.inclusionUserCallbacks = {
				...this.inclusionUserCallbacks,
			}
		}

		if (this.cfg.scales) {
			const scales: Record<string | number, string | number> = {}
			for (const s of this.cfg.scales) {
				scales[s.key] = s.label
			}

			zwaveOptions.preferences = {
				scales,
			}
		}

		Object.assign(zwaveOptions, this.cfg.options)

		let s0Key: string

		// back compatibility
		if (this.cfg.networkKey) {
			s0Key = this.cfg.networkKey
			delete this.cfg.networkKey
		}

		this.cfg.securityKeys = this.cfg.securityKeys || {}

		// update settings to fix compatibility
		if (s0Key && !this.cfg.securityKeys.S0_Legacy) {
			this.cfg.securityKeys.S0_Legacy = s0Key
			const settings = jsonStore.get(store.settings)
			settings.zwave = this.cfg
			await jsonStore.put(store.settings, settings)
		}

		utils.parseSecurityKeys(this.cfg, zwaveOptions)

		const logTransport = new JSONTransport()
		logTransport.format = createDefaultTransportFormat(true, false)

		zwaveOptions.logConfig.transports = [logTransport]

		logTransport.stream.on('data', (data) => {
			this.socket.emit(socketEvents.debug, data.message.toString())
		})

		try {
			// init driver here because if connect fails the driver is destroyed
			// this could throw so include in the try/catch
			this._driver = new Driver(this.cfg.port, zwaveOptions)
			this._controllerListenersAdded = false
			this._driver.on('error', this._onDriverError.bind(this))
			this._driver.on('driver ready', this._onDriverReady.bind(this))
			this._driver.on('all nodes ready', this._onScanComplete.bind(this))
			this._driver.on(
				'bootloader ready',
				this._onBootLoaderReady.bind(this),
			)

			logger.info(`Connecting to ${this.cfg.port}`)

			// setup user callbacks only if there are connected clients
			this.hasUserCallbacks =
				(await this.socket.fetchSockets()).length > 0

			if (this.hasUserCallbacks) {
				this.setUserCallbacks()
			}

			await this._driver.start()

			if (this.checkIfDestroyed()) {
				return
			}

			if (this.cfg.serverEnabled) {
				this.server = new ZwavejsServer(this._driver, {
					port: this.cfg.serverPort || 3000,
					host: this.cfg.serverHost,
					logger: LogManager.module('Z-Wave-Server'),
					enableDNSServiceDiscovery:
						!this.cfg.serverServiceDiscoveryDisabled,
				})

				this.server.on('error', () => {
					// this is already logged by the server but we need this to prevent
					// unhandled exceptions
				})

				this.server.on('hard reset', () => {
					logger.info('Hard reset requested by ZwaveJS Server')
					this.init()
				})
			}

			if (this.cfg.enableStatistics) {
				this.enableStatistics()
			}

			this.status = ZwaveClientStatus.CONNECTED
		} catch (error) {
			// destroy diver instance when it fails
			if (this._driver) {
				this._driver.destroy().catch((err) => {
					logger.error(
						`Error while destroying driver ${err.message}`,
						error,
					)
				})
			}

			if (this.checkIfDestroyed()) {
				return
			}

			this._onDriverError(error, true)

			if (error.code !== ZWaveErrorCodes.Driver_InvalidOptions) {
				this.backoffRestart()
			} else {
				logger.error(
					`Invalid options for driver: ${error.message}`,
					error,
				)
			}
		}
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
				this.socket.emit(evtName, data, ...args)
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

		this.sendToSocket(socketEvents.valueUpdated, valueId)

		this.emit('valueChanged', valueId, node, changed)
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

	async updateStoreNodes(throwError = true) {
		try {
			logger.debug('Updating store nodes.json')
			await jsonStore.put(store.nodes, this.storeNodes)
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
		const id =
			this.scenes.length > 0
				? this.scenes[this.scenes.length - 1].sceneid + 1
				: 1
		this.scenes.push({
			sceneid: id,
			label: label,
			values: [],
		})

		await jsonStore.put(store.scenes, this.scenes)

		return true
	}

	/**
	 * Delete a scene with a specific `sceneid` and updates `scenes.json`
	 */
	async _removeScene(sceneid: number) {
		const index = this.scenes.findIndex((s) => s.sceneid === sceneid)

		if (index < 0) {
			throw Error('No scene found with given sceneid')
		}

		this.scenes.splice(index, 1)

		await jsonStore.put(store.scenes, this.scenes)

		return true
	}

	/**
	 * Imports scenes Array in `scenes.json`
	 */
	async _setScenes(scenes: ZUIScene[]) {
		// TODO: add scenes validation
		this.scenes = scenes
		await jsonStore.put(store.scenes, this.scenes)

		return scenes
	}

	/**
	 * Get all scenes
	 *
	 */
	_getScenes(): ZUIScene[] {
		return this.scenes
	}

	/**
	 * Return all values of the scene with given `sceneid`
	 */
	_sceneGetValues(sceneid: number) {
		const scene = this.scenes.find((s) => s.sceneid === sceneid)
		if (!scene) {
			throw Error('No scene found with given sceneid')
		}
		return scene.values
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
	) {
		const scene = this.scenes.find((s) => s.sceneid === sceneid)
		const node = this._nodes.get(valueId.nodeId)

		if (!scene) {
			throw Error('No scene found with given sceneid')
		}

		if (!node) {
			throw Error(`Node ${valueId.nodeId} not found`)
		} else {
			// check if it is an existing valueid
			if (!node.values[this._getValueID(valueId)]) {
				throw Error('No value found with given valueId')
			} else {
				// if this valueid is already in owr scene edit it else create new one
				const index = scene.values.findIndex((s) => s.id === valueId.id)

				valueId = index < 0 ? valueId : scene.values[index]
				valueId.value = value
				valueId.timeout = timeout || 0

				if (index < 0) {
					scene.values.push(valueId)
				}
			}
		}

		return jsonStore.put(store.scenes, this.scenes)
	}

	/**
	 * Remove a value from scene
	 */
	async _removeSceneValue(sceneid: number, valueId: ZUIValueIdScene) {
		const scene = this.scenes.find((s) => s.sceneid === sceneid)

		if (!scene) {
			throw Error('No scene found with given sceneid')
		}

		// get the index with also the node identifier as prefix
		const index = scene.values.findIndex((s) => s.id === valueId.id)

		if (index < 0) {
			throw Error('No ValueId match found in given scene')
		} else {
			scene.values.splice(index, 1)
		}

		return jsonStore.put(store.scenes, this.scenes)
	}

	/**
	 * Activate a scene with given scene id
	 */
	_activateScene(sceneId: number): boolean {
		const values = this._sceneGetValues(sceneId) || []

		for (let i = 0; i < values.length; i++) {
			setTimeout(
				() => {
					this.writeValue(values[i], values[i].value).catch(
						logger.error,
					)
				},
				values[i].timeout ? values[i].timeout * 1000 : 0,
			)
		}

		return true
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
		if (this._driver) {
			this._driver.enableStatistics({
				applicationName:
					utils.pkgJson.name +
					(this.cfg.serverEnabled ? ' / zwave-js-server' : ''),
				applicationVersion: utils.pkgJson.version,
			})
			logger.info('Zwavejs usage statistics ENABLED')
		}

		logger.warn(
			'Zwavejs driver is not ready yet, statistics will be enabled on driver initialization',
		)
	}

	/**
	 * Disable Statistics
	 *
	 */
	disableStatistics() {
		if (this._driver) {
			this._driver.disableStatistics()
			logger.info('Zwavejs usage statistics DISABLED')
		}

		logger.warn(
			'Zwavejs driver is not ready yet, statistics will be disabled on driver initialization',
		)
	}

	getInfo() {
		const info = Object.assign({}, this.driverInfo)

		info.uptime = process.uptime()
		info.lastUpdate = this.lastUpdate
		info.status = this.status
		info.error = this.error
		info.cntStatus = this._cntStatus
		info.inclusionState = this._inclusionState
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
			if (this.commandsTimeout) {
				clearTimeout(this.commandsTimeout)
				this.commandsTimeout = null
			}
			return this._driver.controller.stopJoiningNetwork()
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Starts learn mode
	 */
	async startLearnMode(): Promise<JoinNetworkResult> {
		if (this.driverReady) {
			if (this.commandsTimeout) {
				clearTimeout(this.commandsTimeout)
				this.commandsTimeout = null
			}

			this.commandsTimeout = setTimeout(
				() => {
					this.stopLearnMode().catch(logger.error)
				},
				(this.cfg.commandsTimeout || 0) * 1000 || 30000,
			)

			const joinNetworkOptions: JoinNetworkOptions = {
				strategy: JoinNetworkStrategy.Default,
			}

			return this._driver.controller.beginJoiningNetwork(
				joinNetworkOptions,
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
		try {
			if (!this.driverReady) {
				throw new DriverNotReadyError()
			}

			if (backupManager.backupOnEvent) {
				this.nvmEvent = 'before_replace_failed_node'
				await backupManager.backupNvm()
			}

			if (this.commandsTimeout) {
				clearTimeout(this.commandsTimeout)
				this.commandsTimeout = null
			}

			this.commandsTimeout = setTimeout(
				() => {
					this.stopInclusion().catch(logger.error)
				},
				(this.cfg.commandsTimeout || 0) * 1000 || 30000,
			)

			this.isReplacing = true
			// by default replaceFailedNode is secured, pass true to make it not secured
			if (strategy === InclusionStrategy.Security_S2) {
				let inclusionOptions: ReplaceNodeOptions
				if (options?.qrString) {
					const parsedQr = parseQRCodeString(options.qrString)

					if (parsedQr) {
						// when replacing a failed node you cannot use smart start so always use qrcode for provisioning
						options.provisioning = parsedQr
					} else {
						throw Error(`Invalid QR code string`)
					}
				}
				if (options?.provisioning) {
					inclusionOptions = {
						strategy,
						provisioning: options.provisioning,
					}
				} else {
					inclusionOptions = {
						strategy,
					}
				}
				return this._driver.controller.replaceFailedNode(
					nodeId,
					inclusionOptions,
				)
			} else if (
				strategy === InclusionStrategy.Insecure ||
				strategy === InclusionStrategy.Security_S0
			) {
				return this._driver.controller.replaceFailedNode(nodeId, {
					strategy,
				})
			} else {
				throw Error(
					`Inclusion strategy not supported with replace failed node api`,
				)
			}
		} catch (error) {
			this.isReplacing = false
			throw error
		}
	}

	async getAvailableFirmwareUpdates(
		nodeId: number,
		options?: GetFirmwareUpdatesOptions,
	) {
		if (this.driverReady) {
			const result =
				await this._driver.controller.getAvailableFirmwareUpdates(
					nodeId,
					options,
				)

			// return [
			// 	{
			// 		version: '1.13',
			// 		downgrade: true,
			// 		channel: 'stable',
			// 		normalizedVersion: '1.13',
			// 		changelog: `* Fixed some bugs by [robertsLando](https://github.com/robertsLando)\n* Added other bugs\n* Very long changelog line that should not overflow the UI. Very long changelog line that should not overflow the UI Very long changelog line that should not overflow the UI`,
			// 		files: [
			// 			{
			// 				target: 0,
			// 				integrity:
			// 					'sha256:123456789012345678901234567890123456789012345678901234567890125',
			// 				url: 'https://example.com/firmware0.bin',
			// 			},
			// 			{
			// 				target: 1,
			// 				integrity:
			// 					'sha256:123456789012345678901234567890123456789012345678901234567890123',
			// 				url: 'https://example.com/firmware1.bin',
			// 			},
			// 		],
			// 		device: {
			// 			manufacturerId: 123,
			// 			productType: 456,
			// 			productId: 789,
			// 			firmwareVersion: '1.13',
			// 			rfRegion: 1,
			// 		},
			// 	},
			// 	{
			// 		version: '2.00',
			// 		downgrade: false,
			// 		channel: 'beta',
			// 		normalizedVersion: '1.13',
			// 		changelog: `* Fixed some bugs by [robertsLando](https://github.com/robertsLando)\n* Added other bugs\n* Very long changelog line that should not overflow the UI. Very long changelog line that should not overflow the UI Very long changelog line that should not overflow the UI`,
			// 		files: [
			// 			{
			// 				target: 0,
			// 				integrity:
			// 					'sha256:123456789012345678901234567890123456789012345678901234567890125',
			// 				url: 'https://example.com/firmware0.bin',
			// 			},
			// 			{
			// 				target: 1,
			// 				integrity:
			// 					'sha256:123456789012345678901234567890123456789012345678901234567890123',
			// 				url: 'https://example.com/firmware1.bin',
			// 			},
			// 		],
			// 		device: {
			// 			manufacturerId: 123,
			// 			productType: 456,
			// 			productId: 789,
			// 			firmwareVersion: '1.13',
			// 			rfRegion: 1,
			// 		},
			// 	},
			// ] as FirmwareUpdateInfo[]

			return result
		}

		throw new DriverNotReadyError()
	}

	async firmwareUpdateOTA(nodeId: number, updateInfo: FirmwareUpdateInfo) {
		if (this.driverReady) {
			const node = this._nodes.get(nodeId)

			if (node.firmwareUpdate) {
				throw Error(`Firmware update already in progress`)
			}

			const result = await this._driver.controller.firmwareUpdateOTA(
				nodeId,
				updateInfo,
			)

			return result
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
			await this.updateControllerNodeProps(null, ['RFRegion'])
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
			if (backupManager.backupOnEvent) {
				this.nvmEvent = 'before_start_inclusion'
				await backupManager.backupNvm()
			}

			try {
				if (this.commandsTimeout) {
					clearTimeout(this.commandsTimeout)
					this.commandsTimeout = null
				}

				if (options.name || options.location) {
					this.tmpNode = {
						name: options.name || '',
						loc: options.location || '',
					}
				} else {
					this.tmpNode = undefined
				}

				this.commandsTimeout = setTimeout(
					() => {
						this.stopInclusion().catch(logger.error)
					},
					(this.cfg.commandsTimeout || 0) * 1000 || 30000,
				)

				let inclusionOptions: InclusionOptions

				switch (strategy) {
					case InclusionStrategy.Insecure:
					case InclusionStrategy.Security_S0:
						inclusionOptions = { strategy }
						break
					case InclusionStrategy.SmartStart:
						throw Error(
							'In order to use Smart Start add you node to provisioning list',
						)
					case InclusionStrategy.Default:
						inclusionOptions = {
							strategy,
							forceSecurity: options?.forceSecurity,
						}
						break
					case InclusionStrategy.Security_S2:
						if (options?.qrString) {
							const parsedQr = parseQRCodeString(options.qrString)
							if (!parsedQr) {
								throw Error(`Invalid QR code string`)
							}

							if (parsedQr.version === QRCodeVersion.S2) {
								options.provisioning = parsedQr
							} else if (
								parsedQr.version === QRCodeVersion.SmartStart
							) {
								this.provisionSmartStartNode(parsedQr)
								return true
							} else {
								throw Error(`Invalid QR code version`)
							}
						}
						if (options?.provisioning) {
							inclusionOptions = {
								strategy,
								dsk: options.dsk,
								provisioning: options.provisioning,
							}
						} else {
							inclusionOptions = { strategy, dsk: options.dsk }
						}

						break
					default:
						inclusionOptions = { strategy }
				}

				this.isReplacing = false

				return this._driver.controller.beginInclusion(inclusionOptions)
			} catch (error) {
				this.tmpNode = undefined
				throw error
			}
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
			if (backupManager.backupOnEvent) {
				this.nvmEvent = 'before_start_exclusion'
				await backupManager.backupNvm()
			}

			if (this.commandsTimeout) {
				clearTimeout(this.commandsTimeout)
				this.commandsTimeout = null
			}

			this.commandsTimeout = setTimeout(
				() => {
					this.stopExclusion().catch(logger.error)
				},
				(this.cfg.commandsTimeout || 0) * 1000 || 30000,
			)

			return this._driver.controller.beginExclusion(options)
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Stop exclusion
	 */
	stopExclusion(): Promise<boolean> {
		if (this.driverReady) {
			if (this.commandsTimeout) {
				clearTimeout(this.commandsTimeout)
				this.commandsTimeout = null
			}
			return this._driver.controller.stopExclusion()
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Stops inclusion
	 */
	stopInclusion(): Promise<boolean> {
		if (this.driverReady) {
			if (this.commandsTimeout) {
				clearTimeout(this.commandsTimeout)
				this.commandsTimeout = null
			}
			return this._driver.controller.stopInclusion()
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
				this._onNodeStatus(zwaveNode, true)
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
		file: FwFile,
	): Promise<ControllerFirmwareUpdateResult> {
		try {
			if (backupManager.backupOnEvent) {
				this.nvmEvent = 'before_controller_fw_update_otw'
				await backupManager.backupNvm()
			}
			let firmware: Firmware

			try {
				const format = guessFirmwareFileFormat(file.name, file.data)
				firmware = await extractFirmwareAsync(file.data, format)
			} catch (err) {
				throw Error(
					`Unable to extract firmware from file '${file.name}'`,
				)
			}
			const result = await this.driver.controller.firmwareUpdateOTW(
				firmware.data,
			)
			return result
		} catch (e) {
			throw Error(`Error while updating firmware: ${e.message}`)
		}
	}

	async updateFirmware(
		nodeId: number,
		files: FwFile[],
	): Promise<FirmwareUpdateResult> {
		// const result: FirmwareUpdateResult = {
		// 	status: FirmwareUpdateStatus.Error_Checksum,
		// 	waitTime: 10,
		// 	success: false,
		// 	reInterview: true,
		// }

		// return Promise.resolve(result)

		if (this.driverReady) {
			const zwaveNode = this.getNode(nodeId)

			if (!zwaveNode) {
				throw Error(`Node ${nodeId} not found`)
			}

			const node = this._nodes.get(nodeId)

			if (node.firmwareUpdate) {
				throw Error(`Firmware update already in progress`)
			}

			const firmwares: Firmware[] = []

			for (const f of files) {
				let { data, name } = f
				if (data instanceof Buffer) {
					try {
						let format: FirmwareFileFormat
						if (name.endsWith('.zip')) {
							const extracted = tryUnzipFirmwareFile(data)
							if (!extracted) {
								throw Error(
									`Unable to extract firmware from zip file '${name}'`,
								)
							}

							format = extracted.format
							name = extracted.filename
							data = extracted.rawData
						} else {
							format = guessFirmwareFileFormat(name, data)
						}

						const firmware = await extractFirmwareAsync(
							data,
							format,
						)
						if (f.target !== undefined) {
							firmware.firmwareTarget = f.target
						}
						firmwares.push(firmware)
					} catch (e) {
						throw Error(
							`Unable to extract firmware from file '${name}': ${e.message}`,
						)
					}
				} else {
					throw Error(`Invalid firmware file ${name} is not a Buffer`)
				}
			}

			return zwaveNode.updateFirmware(firmwares)
		}

		throw new DriverNotReadyError()
	}

	async abortFirmwareUpdate(nodeId: number) {
		if (this.driverReady) {
			const zwaveNode = this.getNode(nodeId)

			if (!zwaveNode) {
				throw Error(`Node ${nodeId} not found`)
			}

			await zwaveNode.abortFirmwareUpdate()

			const node = this._nodes.get(nodeId)

			// reset fw update progress
			if (node) {
				node.firmwareUpdate = undefined

				this.emitNodeUpdate(node, {
					firmwareUpdate: false,
				} as any)
			}
		} else {
			throw new DriverNotReadyError()
		}
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
			await this._driver.hardReset()
			this.init()
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

		if (this.driverReady || this.driver?.isInBootloader()) {
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

	private async _onDriverReady() {
		/*
			Now the controller interview is complete. This means we know which nodes
			are included in the network, but they might not be ready yet.
			The node interview will continue in the background.

			NOTE: This can be called also after an Hard Reset
		*/

		// driver ready
		this.status = ZwaveClientStatus.DRIVER_READY

		this.driverReady = true

		this._inclusionState = this.driver.controller.inclusionState

		logger.info('Z-Wave driver is ready')

		this._updateControllerStatus('Driver ready')

		try {
			// this must be done only after driver is ready
			this._scheduledConfigCheck().catch(() => {
				/* ignore */
			})

			if (!this._controllerListenersAdded) {
				this._controllerListenersAdded = true
				this.driver.controller
					.on(
						'inclusion started',
						this._onInclusionStarted.bind(this),
					)
					.on(
						'exclusion started',
						this._onExclusionStarted.bind(this),
					)
					.on(
						'inclusion stopped',
						this._onInclusionStopped.bind(this),
					)
					.on(
						'exclusion stopped',
						this._onExclusionStopped.bind(this),
					)
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
					.on(
						'rebuild routes done',
						this._onRebuildRoutesDone.bind(this),
					)
					.on(
						'statistics updated',
						this._onControllerStatisticsUpdated.bind(this),
					)
					.on(
						'firmware update progress',
						this._onControllerFirmwareUpdateProgress.bind(this),
					)
					.on(
						'firmware update finished',
						this._onControllerFirmwareUpdateFinished.bind(this),
					)
					.on(
						'status changed',
						this._onControllerStatusChanged.bind(this),
					)
			}
		} catch (error) {
			// Fixes freak error in "driver ready" handler #1309
			logger.error(error.message)
			this.backoffRestart()
			return
		}

		// reset retries
		this.backoffRetry = 0

		for (const [, node] of this._driver.controller.nodes) {
			// node added will not be triggered if the node is in cache
			this._createNode(node.id)
			this._addNode(node)

			// Make sure we didn't miss the ready event
			if (node.ready) {
				this._onNodeReady(node)
			}
		}

		this.driverInfo.homeid = this._driver.controller.homeId
		const homeHex = '0x' + this.driverInfo?.homeid?.toString(16)
		this.driverInfo.name = homeHex
		this.driverInfo.controllerId = this._driver.controller.ownNodeId

		this.emit('event', EventSource.DRIVER, 'driver ready', this.driverInfo)

		this._error = undefined

		// start server only when driver is ready. Fixes #602
		if (this.cfg.serverEnabled && this.server) {
			// fix prevent to start server when already inited
			if (!this.server['server']) {
				this.server
					.start(!this.hasUserCallbacks)
					.then(() => {
						logger.info('Z-Wave server started')
					})
					.catch((error) => {
						logger.error(
							`Failed to start zwave-js server: ${error.message}`,
						)
					})
			}
		}

		logger.info(`Scanning network with homeid: ${homeHex}`)

		await this.sendInitToSockets()

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

	private _onControllerFirmwareUpdateProgress(
		progress: ControllerFirmwareUpdateProgress,
	) {
		const nodeId = this.driver.controller.ownNodeId
		const node = this.nodes.get(nodeId)
		if (node) {
			node.firmwareUpdate = {
				sentFragments: progress.sentFragments,
				totalFragments: progress.totalFragments,
				progress: progress.progress,
				currentFile: node.firmwareUpdate?.currentFile ?? 1,
				totalFiles: node.firmwareUpdate?.currentFile ?? 1,
			}

			// send at most 4msg per second
			this.throttle(
				this._onControllerFirmwareUpdateProgress.name,
				this.emitNodeUpdate.bind(this, node, {
					firmwareUpdate: node.firmwareUpdate,
				} as utils.DeepPartial<ZUINode>),
				250,
			)
		}

		this.emit(
			'event',
			EventSource.CONTROLLER,
			'controller firmware update progress',
			this.zwaveNodeToJSON(this.driver.controller.nodes.get(nodeId)),
			progress,
		)
	}

	private _onControllerFirmwareUpdateFinished(
		result: ControllerFirmwareUpdateResult,
	) {
		const nodeId = this.driver.controller.ownNodeId
		const node = this.nodes.get(nodeId)
		const zwaveNode = this.driver.controller.nodes.get(nodeId)

		if (node) {
			node.firmwareUpdate = undefined

			this.emitNodeUpdate(node, {
				firmwareUpdate: false,
				firmwareUpdateResult: {
					success: result.success,
					status: getEnumMemberName(
						ControllerFirmwareUpdateStatus,
						result.status,
					),
				},
			} as any)
		}

		logger.info(
			`Controller ${zwaveNode.id} firmware update OTW finished ${
				result.success ? 'successfully' : 'with error'
			}.\n   Status: ${getEnumMemberName(
				ControllerFirmwareUpdateStatus,
				result.status,
			)}. Result: ${JSON.stringify(result)}.`,
		)

		this.emit(
			'event',
			EventSource.CONTROLLER,
			'controller firmware update finished',
			this.zwaveNodeToJSON(zwaveNode),
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
		this._onNodeEvent(
			'status changed',
			this.getNode(this.driver.controller.ownNodeId),
			status,
		)
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
	}

	// ---------- CONTROLLER EVENTS -------------------------------

	private _updateControllerStatus(status: string) {
		if (this._cntStatus !== status) {
			logger.info(`Controller status: ${status}`)
			this._cntStatus = status
			this.sendToSocket(socketEvents.controller, {
				status,
				error: this._error,
				inclusionState: this._inclusionState,
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

		this._updateControllerStatus(message)
		this.emit('event', EventSource.CONTROLLER, 'inclusion stopped')
	}

	private _onExclusionStopped() {
		const message = 'Exclusion stopped'
		this._updateControllerStatus(message)
		this.emit('event', EventSource.CONTROLLER, 'exclusion stopped')
	}

	private _onInclusionStateChanged(state: InclusionState) {
		if (state !== this._inclusionState) {
			this._inclusionState = state

			this.sendToSocket(socketEvents.controller, {
				status: this._cntStatus,
				error: this._error,
				inclusionState: this._inclusionState,
			})
		}
	}

	private _onInclusionFailed() {
		const message = 'Inclusion failed'
		this.isReplacing = false
		this.tmpNode = undefined
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
	private _onNodeRemoved(zwaveNode: ZWaveNode, reason: RemoveNodeReason) {
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
	}

	/**
	 * Triggered on each progress of rebuild routes process
	 */
	private _onRebuildRoutesProgress(
		progress: ReadonlyMap<number, RebuildRoutesStatus>,
	) {
		const toRebuild = [...progress.values()]
		const rebuiltNodes = toRebuild.filter((v) => v !== 'pending')
		const message = `Rebuild Routes process IN PROGRESS. Healed ${rebuiltNodes.length} nodes`
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

	private _onGrantSecurityClasses(
		requested: InclusionGrant,
	): Promise<InclusionGrant | false> {
		logger.log('info', `Grant security classes: %o`, requested)
		this.sendToSocket(socketEvents.grantSecurityClasses, requested)

		this.emit(
			'event',
			EventSource.CONTROLLER,
			'grant security classes',
			requested,
		)

		return new Promise((resolve) => {
			this._grantResolve = resolve
		})
	}

	grantSecurityClasses(requested: InclusionGrant) {
		if (this._grantResolve) {
			this._grantResolve(requested)
			this._grantResolve = null
		} else {
			logger.error('No inclusion process started')
		}
	}

	private _onValidateDSK(dsk: string): Promise<string | false> {
		logger.info(`DSK received ${dsk}`)

		this.sendToSocket(socketEvents.validateDSK, dsk)

		this.emit('event', EventSource.CONTROLLER, 'validate dsk', dsk)

		return new Promise((resolve) => {
			this._dskResolve = resolve
		})
	}

	validateDSK(dsk: string) {
		if (this._dskResolve) {
			this._dskResolve(dsk)
			this._dskResolve = null
		} else {
			logger.error('No inclusion process started')
		}
	}

	abortInclusion() {
		if (this._dskResolve) {
			this._dskResolve(false)
			this._dskResolve = null
		}

		if (this._grantResolve) {
			this._grantResolve(false)
			this._grantResolve = null
		}
	}

	private _onAbortInclusion() {
		this._dskResolve = null
		this._grantResolve = null
		this.sendToSocket(socketEvents.inclusionAborted, true)

		this.emit('event', EventSource.CONTROLLER, 'inclusion aborted')

		logger.warn('Inclusion aborted')
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

		await mkdirp(nvmBackupsDir)

		await writeFile(utils.joinPath(nvmBackupsDir, fileName + '.bin'), data)

		return { data: Buffer.from(data.buffer), fileName }
	}

	private _onBackupNVMProgress(bytesRead: number, totalBytes: number) {
		const progress = Math.round((bytesRead / totalBytes) * 100)
		this._updateControllerStatus(`Backup NVM progress: ${progress}%`)
	}

	async restoreNVM(data: Buffer, useRaw = false) {
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

	parseQRCodeString(qrString: string): {
		parsed?: QRProvisioningInformation
		nodeId?: number
		exists: boolean
	} {
		const parsed = parseQRCodeString(qrString)
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

	provisionSmartStartNode(entry: PlannedProvisioningEntry | string) {
		if (!this.driverReady) {
			throw new DriverNotReadyError()
		}

		if (typeof entry === 'string') {
			// it's a qrcode
			entry = parseQRCodeString(entry)
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
	private _onNodeStatus(zwaveNode: ZWaveNode, updateStatusOnly = false) {
		const node = this._nodes.get(zwaveNode.id)

		if (node) {
			// https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/node/Types.ts#L127
			node.status = NodeStatus[
				zwaveNode.status
			] as keyof typeof NodeStatus
			node.available = zwaveNode.status !== NodeStatus.Dead
			node.interviewStage = InterviewStage[
				zwaveNode.interviewStage
			] as keyof typeof InterviewStage

			if (zwaveNode.interviewStage === InterviewStage.Complete) {
				node.hasDeviceConfigChanged = zwaveNode.hasDeviceConfigChanged()
			}

			let changedProps: utils.DeepPartial<ZUINode>

			if (updateStatusOnly) {
				changedProps = {
					status: node.status,
					available: node.available,
					interviewStage: node.interviewStage,
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

		this._onNodeStatus(zwaveNode)

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
	}

	/**
	 * Triggered when a node interview starts for the first time or when the node is manually re-interviewed
	 *
	 */
	private _onNodeInterviewStarted(zwaveNode: ZWaveNode) {
		this.logNode(zwaveNode, 'info', 'Interview started')

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

		this._onNodeStatus(zwaveNode, true)

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

		this._onNodeStatus(zwaveNode, true)

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

		this._onNodeStatus(zwaveNode, true)

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

		this._onNodeStatus(zwaveNode, true)
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

		this._onNodeStatus(zwaveNode, true)
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
		this._onNodeStatus(zwaveNode, true)
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
		this._onNodeStatus(zwaveNode, true)
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

		if (ccId === CommandClasses.Notification) {
			valueId.property = args.label
			valueId.propertyKey = args.eventLabel

			data = this._parseNotification(args.parameters)
		} else if (ccId === CommandClasses['Entry Control']) {
			valueId.property = args.eventType.toString()
			valueId.propertyKey = args.dataType
			data =
				args.eventData instanceof Buffer
					? utils.buffer2hex(args.eventData)
					: args.eventData
		} else if (ccId === CommandClasses['Multilevel Switch']) {
			valueId.property = getEnumMemberName(
				MultilevelSwitchCommand,
				args.eventType as number,
			)
			data = args.direction
		} else if (ccId === CommandClasses.Powerlevel) {
			// ignore, this should be handled in zwave-js
			return
		} else {
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

			if (result.reInterview) {
				this.logNode(zwaveNode, 'info', 'Will be re-interviewed')
			}

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
		if (node) {
			this._nodes.delete(nodeid)

			this.emit('nodeRemoved', {
				id: node.id,
				name: node.name,
				loc: node.loc,
			})
			this.sendToSocket(socketEvents.nodeRemoved, node)
		}

		if (!this.isReplacing && this.storeNodes[nodeid]) {
			delete this.storeNodes[nodeid]
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			this.updateStoreNodes(false)
		}
	}

	private _createNode(nodeId: number) {
		// set node name and location sent with beginInclusion call
		if (this.tmpNode) {
			if (this.storeNodes[nodeId]) {
				this.storeNodes[nodeId].name = this.tmpNode.name
				this.storeNodes[nodeId].loc = this.tmpNode.loc
			} else {
				this.storeNodes[nodeId] = {
					name: this.tmpNode.name,
					loc: this.tmpNode.loc,
				}
			}

			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			this.updateStoreNodes(false)

			this.tmpNode = undefined
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
		this._onNodeStatus(zwaveNode)

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
						text: getEnumMemberName(RFRegion, region),
						disabled:
							region === RFRegion.Unknown ||
							region === RFRegion['Default (EU)'],
					}))
					.sort((a, b) => a.text.localeCompare(b.text)) ?? []
		}
	}

	async updateControllerNodeProps(
		node?: ZUINode,
		props: Array<'powerlevel' | 'RFRegion'> = ['powerlevel', 'RFRegion'],
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

		this.emitNodeUpdate(node, {
			powerlevel: node.powerlevel,
			measured0dBm: node.measured0dBm,
			RFRegion: node.RFRegion,
			supportsLongRange: node.supportsLongRange,
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

		// Value types: https://github.com/zwave-js/node-zwave-js/blob/cb35157da5e95f970447a67cbb2792e364b9d1e1/packages/core/src/values/Metadata.ts#L28
		if (zwaveValueMeta.type === 'number') {
			valueId.min = (zwaveValueMeta as ValueMetadataNumeric).min
			valueId.max = (zwaveValueMeta as ValueMetadataNumeric).max
			valueId.step = (zwaveValueMeta as ValueMetadataNumeric).steps
			valueId.unit = (zwaveValueMeta as ValueMetadataNumeric).unit
		} else if (zwaveValueMeta.type === 'string') {
			valueId.minLength = (
				zwaveValueMeta as ValueMetadataString
			).minLength
			valueId.maxLength = (
				zwaveValueMeta as ValueMetadataString
			).maxLength
		}

		if (
			(zwaveValueMeta as ValueMetadataNumeric).states &&
			Object.keys((zwaveValueMeta as ValueMetadataNumeric).states)
				.length > 0
		) {
			valueId.list = true
			valueId.allowManualEntry = (
				zwaveValueMeta as ConfigurationMetadata
			).allowManualEntry
			valueId.states = []
			for (const k in (zwaveValueMeta as ValueMetadataNumeric).states) {
				valueId.states.push({
					text: (zwaveValueMeta as ValueMetadataNumeric).states[k],
					value:
						zwaveValueMeta.type === 'number'
							? parseInt(k)
							: zwaveValueMeta.type === 'boolean'
								? k === 'true'
								: k,
				})
			}
		} else {
			valueId.list = false
		}

		return valueId
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
					this.emitValueChanged(valueId, node, false)
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
		if (await exists(filePath)) {
			const fakeNodes = JSON.parse(await readFile(filePath, 'utf-8'))
			for (const node of fakeNodes) {
				// convert valueIds array to map
				const values = {}
				for (const value of node.values) {
					values[this._getValueID(value)] = value
				}
				node.values = values
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
					this._onControllerFirmwareUpdateFinished({
						status: ControllerFirmwareUpdateStatus.OK,
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
				this._onControllerFirmwareUpdateProgress({
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
