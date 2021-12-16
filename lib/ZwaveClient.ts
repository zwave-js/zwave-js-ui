/* eslint-disable camelcase */
'use strict'

// eslint-disable-next-line one-var
import {
	Driver,
	NodeStatus,
	InterviewStage,
	extractFirmware,
	guessFirmwareFileFormat,
	libVersion,
	ZWaveNode,
	ValueID,
	AssociationGroup,
	AssociationAddress,
	FirmwareUpdateStatus,
	TranslatedValueID,
	ZWaveOptions,
	HealNodeStatus,
	NodeInterviewFailedEventArgs,
	ValueMetadata,
	ZWaveNodeMetadataUpdatedArgs,
	ZWaveNodeValueAddedArgs,
	ZWaveNodeValueNotificationArgs,
	ZWaveNodeValueRemovedArgs,
	ZWaveNodeValueUpdatedArgs,
	DataRate,
	FLiRS,
	NodeType,
	ProtocolVersion,
	ValueType,
	ZWavePlusNodeType,
	ZWavePlusRoleType,
	ZWaveError,
	SetValueAPIOptions,
	ControllerStatistics,
	NodeStatistics,
	InclusionStrategy,
	InclusionGrant,
	InclusionResult,
	InclusionOptions,
	InclusionUserCallbacks,
	SmartStartProvisioningEntry,
	PlannedProvisioningEntry,
	QRCodeVersion,
	ReplaceNodeOptions,
	QRProvisioningInformation,
	RefreshInfoOptions,
} from 'zwave-js'
import { parseQRCodeString } from 'zwave-js/Utils'
import {
	CommandClasses,
	Duration,
	ValueMetadataNumeric,
	ValueMetadataString,
	ConfigurationMetadata,
	ZWaveErrorCodes,
	SecurityClass,
	dskToString,
} from '@zwave-js/core'
import * as utils from './utils'
import jsonStore from './jsonStore'
import { socketEvents } from './SocketManager'
import store from '../config/store'
import { storeDir } from '../config/app'
import * as LogManager from './logger'

import { ZwavejsServer, serverVersion } from '@zwave-js/server'
import * as pkgjson from '../package.json'
import { Server as SocketServer } from 'socket.io'
import { GatewayValue } from './Gateway'
import { TypedEventEmitter } from './EventEmitter'
import { writeFile } from 'fs-extra'
import set from 'set-value'

import { ConfigManager, DeviceConfig } from '@zwave-js/config'

export const deviceConfigPriorityDir = storeDir + '/config'

export const configManager = new ConfigManager({
	deviceConfigPriorityDir,
})

export async function loadManager() {
	await configManager.loadNamedScales()
	await configManager.loadSensorTypes()
}

const logger = LogManager.module('Zwave')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const loglevels = require('triple-beam').configs.npm.levels

const NEIGHBORS_LOCK_REFRESH = 60 * 1000

function validateMethods<T extends readonly (keyof ZwaveClient)[]>(
	methods: T
): T {
	return methods
}

// ZwaveClient Apis that can be called with MQTT apis
const allowedApis = validateMethods([
	'setNodeName',
	'setNodeLocation',
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
	'getAssociations',
	'addAssociations',
	'removeAssociations',
	'removeAllAssociations',
	'removeNodeFromAllAssociations',
	'getNodes',
	'getInfo',
	'refreshValues',
	'refreshCCValues',
	'pollValue',
	'startInclusion',
	'startExclusion',
	'stopInclusion',
	'stopExclusion',
	'replaceFailedNode',
	'hardReset',
	'softReset',
	'healNode',
	'beginHealingNetwork',
	'stopHealingNetwork',
	'isFailedNode',
	'removeFailedNode',
	'refreshInfo',
	'beginFirmwareUpdate',
	'abortFirmwareUpdate',
	'sendCommand',
	'writeValue',
	'writeBroadcast',
	'writeMulticast',
	'driverFunction',
	'checkForConfigUpdates',
	'installConfigUpdate',
	'pingNode',
	'restart',
	'grantSecurityClasses',
	'validateDSK',
	'abortInclusion',
	'backupNVMRaw',
	'restoreNVMRaw',
	'getProvisioningEntries',
	'getProvisioningEntry',
	'unprovisionSmartStartNode',
	'provisionSmartStartNode',
	'parseQRCodeString',
] as const)

// Define mapping of CCs and node values to node properties:
const nodePropsMap = {
	[CommandClasses.Battery]: {
		existsProp: 'isBatteryPowered',
		valueProps: {
			level: [
				{
					nodeProp: 'minBatteryLevel',
					fn: (node: Z2MNode, values: Z2MValueId[]) =>
						values.reduce(
							(acc, curr) =>
								acc !== undefined
									? acc.value < curr.value
										? acc
										: curr
									: curr,
							undefined
						).value,
				},
				{
					nodeProp: 'batteryLevels',
					fn: (node: Z2MNode, values: Z2MValueId[]) =>
						values.map((v) => v.value),
				},
			],
		},
	},
}
export type ValuePropsMap = {
	nodeProp: string
	fn: (node: Z2MNode, values: Z2MValueId[]) => any
}
export type CommandClassValueMap = {
	existsProp?: string
	valueProps?: Record<CommandClasses, ValuePropsMap[]>
}
export type NodeValuesMap = Record<number, CommandClassValueMap>
// This map contains values from nodePropsMap in an data structure optimized for speed
const nodeValuesMap: NodeValuesMap = {}

export type SensorTypeScale = {
	key: string | number
	sensor: string
	label: string
	unit?: string
	description?: string
}

export type AllowedApis = typeof allowedApis[number]

const ZWAVEJS_LOG_FILE = utils.joinPath(storeDir, 'zwavejs_%DATE%.log')

export type Z2MValueIdState = {
	text: string
	value: number
}

export type Z2MClientStatus = {
	driverReady: boolean
	status: boolean
	config: ZwaveConfig
}

export type Z2MGroupAssociation = {
	groupId: number
	nodeId: number
	endpoint?: number
	targetEndpoint?: number
}

export type Z2MValueId = {
	id: string
	nodeId: number
	type: ValueType
	readable: boolean
	writeable: boolean
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
	states?: Z2MValueIdState[]
	list?: boolean
	lastUpdate?: number
	value?: any
	targetValue?: string
	isCurrentValue?: boolean
	conf?: GatewayValue
	allowManualEntry?: boolean
} & TranslatedValueID

export type Z2MValueIdScene = Z2MValueId & {
	timeout: number
}

export type Z2MScene = {
	sceneid: number
	label: string
	values: Z2MValueIdScene[]
}

export type Z2MDeviceClass = {
	basic: number
	generic: number
	specific: number
}

export type Z2MNodeGroups = {
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

export type Z2MNode = {
	id: number
	deviceConfig?: DeviceConfig
	manufacturerId?: number
	productId?: number
	productLabel?: string
	productDescription?: string
	statistics?: ControllerStatistics | NodeStatistics
	productType?: number
	manufacturer?: string
	firmwareVersion?: string
	protocolVersion?: ProtocolVersion
	zwavePlusVersion?: number | undefined
	zwavePlusNodeType?: ZWavePlusNodeType | undefined
	zwavePlusRoleType?: ZWavePlusRoleType | undefined
	nodeType?: NodeType
	endpointsCount?: number
	endpointIndizes?: number[]
	isSecure?: boolean | 'unknown'
	security?: string | undefined
	supportsBeaming?: boolean
	supportsSecurity?: boolean
	isListening?: boolean
	isControllerNode?: boolean
	isFrequentListening?: FLiRS
	isRouting?: boolean
	keepAwake?: boolean
	deviceClass?: Z2MDeviceClass
	neighbors?: number[]
	loc?: string
	name?: string
	hassDevices?: { [key: string]: HassDevice }
	deviceId?: string
	hexId?: string
	values?: { [key: string]: Z2MValueId }
	groups?: Z2MNodeGroups[]
	ready: boolean
	available: boolean
	failed: boolean
	lastActive?: number
	dbLink?: string
	maxDataRate?: DataRate
	interviewStage?: keyof typeof InterviewStage
	status?: keyof typeof NodeStatus
	inited: boolean
	healProgress?: string | undefined
	minBatteryLevel?: number
	batteryLevels?: { [key: string]: number }
	isBatteryPowered?: boolean
}

export type ZwaveConfig = {
	port?: string
	networkKey?: string
	securityKeys?: utils.DeepPartial<{
		S2_Unauthenticated: string
		S2_Authenticated: string
		S2_AccessControl: string
		S0_Legacy: string
	}>
	serverEnabled?: boolean
	enableSoftReset?: boolean
	deviceConfigPriorityDir?: string
	serverPort?: number
	logEnabled?: boolean
	logLevel?: LogManager.LogLevel
	commandsTimeout?: number
	enableStatistics?: boolean
	disclaimerVersion?: number
	options?: ZWaveOptions
	healNetwork?: boolean
	healHour?: number
	logToFile?: boolean
	nodeFilter?: string[]
	scales?: SensorTypeScale[]
}

export type Z2MDriverInfo = {
	uptime?: number
	lastUpdate?: number
	status?: ZwaveClientStatus
	cntStatus?: string
	appVersion?: string
	zwaveVersion?: string
	serverVersion?: string
	homeid?: number
	name?: string
	controllerId?: number
	newConfigVersion?: string | undefined
}

export enum ZwaveClientStatus {
	CONNECTED = 'connected',
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
	nodeStatus: (node: Z2MNode) => void
	nodeInited: (node: Z2MNode) => void
	event: (source: EventSource, eventName: string, ...args: any) => void
	scanComplete: () => void
	driverStatus: (status: boolean) => void
	notification: (node: Z2MNode, valueId: Z2MValueId, data: any) => void
	nodeRemoved: (node: Z2MNode) => void
	valueChanged: (
		valueId: Z2MValueId,
		node: Z2MNode,
		changed?: boolean
	) => void
	valueWritten: (valueId: Z2MValueId, node: Z2MNode, value: unknown) => void
}

export type ZwaveClientEvents = Extract<keyof ZwaveClientEventCallbacks, string>

class ZwaveClient extends TypedEventEmitter<ZwaveClientEventCallbacks> {
	private cfg: ZwaveConfig
	private socket: SocketServer
	private closed: boolean
	private _driverReady: boolean
	private scenes: Z2MScene[]
	private _nodes: Map<number, Z2MNode>
	private storeNodes: Record<number, Partial<Z2MNode>>
	private _devices: Record<string, Partial<Z2MNode>>
	private driverInfo: Z2MDriverInfo
	private status: ZwaveClientStatus

	private _error: boolean | string
	private _scanComplete: boolean
	private _cntStatus: string

	private lastUpdate: number

	private _driver: Driver

	private server: ZwavejsServer
	private statelessTimeouts: Record<string, NodeJS.Timeout>
	private commandsTimeout: NodeJS.Timeout
	private reconnectTimeout: NodeJS.Timeout
	private healTimeout: NodeJS.Timeout
	private updatesCheckTimeout: NodeJS.Timeout
	private pollIntervals: Record<string, NodeJS.Timeout>

	private _lockNeighborsRefresh: boolean

	private _grantResolve: (grant: InclusionGrant | false) => void | null
	private _dskResolve: (dsk: string | false) => void | null

	public get driverReady() {
		return this.driver && this._driverReady && !this.closed
	}

	public set driverReady(ready) {
		this._driverReady = ready
		this.emit('driverStatus', ready)
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

			jsonStore.put(store.nodes, storeNodes).catch((err) => {
				logger.error('Error while updating store nodes', err)
			})
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
		return this.connect()
	}

	/**
	 * Used to schedule next network heal at hours: cfg.healHours
	 */
	scheduleHeal() {
		if (!this.cfg.healNetwork) {
			return
		}

		const now = new Date()
		let start: Date
		const hour = this.cfg.healHour

		if (now.getHours() < hour) {
			start = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate(),
				hour,
				0,
				0,
				0
			)
		} else {
			start = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate() + 1,
				hour,
				0,
				0,
				0
			)
		}

		const wait = start.getTime() - now.getTime()

		if (wait < 0) {
			this.scheduleHeal()
		} else {
			this.healTimeout = setTimeout(() => {
				this.heal()
			}, wait)
		}
	}

	/**
	 * Returns the driver ZWaveNode object
	 */
	getNode(nodeId: number): ZWaveNode {
		return this._driver.controller.nodes.get(nodeId)
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

	/**
	 * Calls driver healNetwork function and schedule next heal
	 *
	 */
	heal() {
		if (this.healTimeout) {
			clearTimeout(this.healTimeout)
			this.healTimeout = null
		}

		try {
			this.beginHealingNetwork()
			logger.info('Network auto heal started')
		} catch (error) {
			logger.error(
				`Error while doing scheduled network heal ${error.message}`,
				error
			)
		}

		// schedule next
		this.scheduleHeal()
	}

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

			this.emitNodeStatus(node, {
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

			this.emitNodeStatus(node, {
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
		remove: any
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
			await jsonStore.put(store.nodes, this.storeNodes)

			this.emitNodeStatus(node, {
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

		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout)
			this.reconnectTimeout = null
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

		if (this.server) {
			this.server.destroy()
		}

		if (this._driver) {
			await this._driver.destroy()
		}

		if (!keepListeners) {
			this.removeAllListeners()
		}

		logger.info('Client closed')
	}

	getStatus() {
		const status: Z2MClientStatus = {
			driverReady: this.driverReady,
			status: this.driverReady && !this.closed,
			config: this.cfg,
		}

		return status
	}

	/**
	 * Popolate node `groups`
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
				logger.warn(
					`Node ${nodeId} error while fetching groups associations: ` +
						error.message
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
			this.emitNodeStatus(node, { groups: node.groups })
		}
	}

	/**
	 * Get current associations of a specific group
	 */
	getAssociations(nodeId: number): Z2MGroupAssociation[] {
		const zwaveNode = this.getNode(nodeId)
		const toReturn: Z2MGroupAssociation[] = []

		if (zwaveNode) {
			try {
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
							} as Z2MGroupAssociation)
						}
					}
				}
			} catch (error) {
				logger.warn(
					`Error while looking for Node ${nodeId}
          associations: ${error.message}`
				)
				// node doesn't support groups associations
			}
		} else {
			logger.warn(
				`Node ${nodeId} not found when calling 'getAssociations'`
			)
		}

		return toReturn
	}

	/**
	 * Add a node to an association group
	 *
	 */
	async addAssociations(
		source: AssociationAddress,
		groupId: number,
		associations: AssociationAddress[]
	) {
		const zwaveNode = this.getNode(source.nodeId)

		const sourceMsg = `Node ${
			source.nodeId +
			(source.endpoint ? ' Endpoint ' + source.endpoint : '')
		}`

		if (zwaveNode) {
			try {
				for (const a of associations) {
					if (
						this._driver.controller.isAssociationAllowed(
							source,
							groupId,
							a
						)
					) {
						logger.info(
							`Assocaitions: Adding Node ${a.nodeId} to Group ${groupId} of ${sourceMsg}`
						)
						await this._driver.controller.addAssociations(
							source,
							groupId,
							[a]
						)
					} else {
						logger.warn(
							`Associations: Unable to add Node ${a.nodeId} to Group ${groupId} of ${sourceMsg}`
						)
					}
				}
			} catch (error) {
				logger.warn(
					`Error while adding associations to ${sourceMsg}: ${error.message}`
				)
			}
		} else {
			logger.warn(
				`Node ${source.nodeId} not found when calling 'addAssociations'`
			)
		}
	}

	/**
	 * Remove a node from an association group
	 *
	 */
	async removeAssociations(
		source: AssociationAddress,
		groupId: number,
		associations: AssociationAddress[]
	) {
		const zwaveNode = this.getNode(source.nodeId)

		const sourceMsg = `Node ${
			source.nodeId +
			(source.endpoint ? ' Endpoint ' + source.endpoint : '')
		}`

		if (zwaveNode) {
			try {
				logger.log(
					'info',
					`Assocaitions: Removing associations from ${sourceMsg} Group ${groupId}: %o`,
					associations
				)
				await this._driver.controller.removeAssociations(
					source,
					groupId,
					associations
				)
			} catch (error) {
				logger.warn(
					`Error while removing associations from ${sourceMsg}: ${error.message}`
				)
			}
		} else {
			logger.warn(
				`Node ${source.nodeId} not found when calling 'removeAssociations'`
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
								associations as AssociationAddress[]
							)
							logger.info(
								`Assocaitions: Removed ${
									associations.length
								} associations from Node ${
									source.nodeId +
									(source.endpoint
										? ' Endpoint ' + source.endpoint
										: '')
								} group ${groupId}`
							)
						}
					}
				}
			} catch (error) {
				logger.warn(
					`Error while removing all associations from ${nodeId}: ${error.message}`
				)
			}
		} else {
			logger.warn(
				`Node ${nodeId} not found when calling 'removeAllAssociations'`
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
				logger.info(
					`Assocaitions: Removing Node ${nodeId} from all associations`
				)
				await this._driver.controller.removeNodeFromAllAssociations(
					nodeId
				)
			} catch (error) {
				logger.warn(
					`Error while removing Node ${nodeId} from all associations: ${error.message}`
				)
			}
		} else {
			logger.warn(
				`Node ${nodeId} not found when calling 'removeNodeFromAllAssociations'`
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
			NEIGHBORS_LOCK_REFRESH
		)

		const toReturn = {}
		// when accessing the controller memory, the Z-Wave radio must be turned off with to avoid resource conflicts and inconsistent data
		await this._driver.controller.toggleRF(false)
		for (const [nodeId, node] of this._nodes) {
			try {
				node.neighbors = (await this.getNodeNeighbors(
					nodeId,
					true
				)) as number[]
			} catch (error) {
				logger.error(error)
			}
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
		dontThrow: boolean
	): Promise<readonly number[]> {
		try {
			return this._driver.controller.getNodeNeighbors(nodeId)
		} catch (error) {
			logger.error(
				`Node ${nodeId} error while updating Neighbors: ${error.message}`
			)
			if (!dontThrow) {
				throw error
			}

			return []
		}
	}

	/**
	 * Execute a custom function with the driver
	 */
	driverFunction(code: string): Promise<any> {
		if (!this.driverReady) {
			throw new DriverNotReadyError()
		}

		const AsyncFunction = Object.getPrototypeOf(
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			async function () {}
		).constructor

		const fn = new AsyncFunction('driver', code)

		return fn.call({ zwaveClient: this, require }, this._driver)
	}

	/**
	 * Method used to start Zwave connection using configuration `port`
	 */
	async connect() {
		if (!this.driverReady) {
			// this could happen when the driver fails the connect and a reconnect timeout triggers
			if (this.closed) {
				return
			}

			// extend options with hidden `options`
			const zwaveOptions: utils.DeepPartial<ZWaveOptions> = {
				storage: {
					cacheDir: storeDir,
					deviceConfigPriorityDir:
						this.cfg.deviceConfigPriorityDir ||
						deviceConfigPriorityDir,
				},
				logConfig: {
					// https://zwave-js.github.io/node-zwave-js/#/api/driver?id=logconfig
					enabled: this.cfg.logEnabled,
					level: this.cfg.logLevel
						? loglevels[this.cfg.logLevel]
						: 'info',
					logToFile: this.cfg.logToFile,
					filename: ZWAVEJS_LOG_FILE,
					forceConsole: true,
					nodeFilter:
						this.cfg.nodeFilter && this.cfg.nodeFilter.length > 0
							? this.cfg.nodeFilter.map((n) => parseInt(n))
							: undefined,
				},
				emitValueUpdateAfterSetValue: true,
			}

			// when not set let zwavejs handle this based on the envirnoment
			if (typeof this.cfg.enableSoftReset === 'boolean') {
				zwaveOptions.enableSoftReset = this.cfg.enableSoftReset
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

			if (s0Key && !this.cfg.securityKeys.S0_Legacy) {
				this.cfg.securityKeys.S0_Legacy = s0Key
				const settings = jsonStore.get(store.settings)
				settings.zwave = this.cfg
				await jsonStore.put(store.settings, settings)
			} else if (process.env.NETWORK_KEY) {
				this.cfg.securityKeys.S0_Legacy = process.env.NETWORK_KEY
			}

			const availableKeys = [
				'S2_Unauthenticated',
				'S2_Authenticated',
				'S2_AccessControl',
				'S0_Legacy',
			]

			const envKeys = Object.keys(process.env)
				.filter((k) => k.startsWith('KEY_'))
				.map((k) => k.substring(4))

			// load security keys from env
			for (const k of envKeys) {
				if (availableKeys.includes(k)) {
					this.cfg.securityKeys[k] = process.env[`KEY_${k}`]
				}
			}

			zwaveOptions.securityKeys = {}

			// convert security keys to buffer
			for (const key in this.cfg.securityKeys) {
				if (
					availableKeys.includes(key) &&
					this.cfg.securityKeys[key].length === 32
				) {
					zwaveOptions.securityKeys[key] = Buffer.from(
						this.cfg.securityKeys[key],
						'hex'
					)
				}
			}

			try {
				// init driver here because if connect fails the driver is destroyed
				// this could throw so include in the try/catch
				this._driver = new Driver(this.cfg.port, zwaveOptions)

				this._driver.on('error', this._onDriverError.bind(this))
				this._driver.once(
					'driver ready',
					this._onDriverReady.bind(this)
				)
				this._driver.on(
					'all nodes ready',
					this._onScanComplete.bind(this)
				)

				logger.info(`Connecting to ${this.cfg.port}`)

				await this._driver.start()

				if (this.cfg.serverEnabled) {
					this.server = new ZwavejsServer(this._driver, {
						port: this.cfg.serverPort || 3000,
						logger: LogManager.module('Zwave-Server'),
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
							`Error while destroing driver ${err.message}`,
							error
						)
					})
				}

				if (error.code !== ZWaveErrorCodes.Driver_InvalidOptions) {
					await this._onDriverError(error, true)
					logger.warn('Retry connection in 3 seconds...')
					this.reconnectTimeout = setTimeout(
						this.connect.bind(this),
						3000
					)
				} else {
					logger.error(
						`Invalid options for driver: ${error.message}`,
						error
					)
				}
			}
		} else {
			logger.info(`Driver already connected to ${this.cfg.port}`)
		}
	}

	/**
	 * Send an event to socket with `data`
	 *
	 */
	sendToSocket(evtName: string, data: any) {
		if (this.socket) {
			this.socket.emit(evtName, data)
		}
	}

	public emitValueChanged(
		valueId: Z2MValueId,
		node: Z2MNode,
		changed: boolean
	) {
		valueId.lastUpdate = Date.now()

		this.sendToSocket(socketEvents.valueUpdated, valueId)

		this.emit('valueChanged', valueId, node, changed)
	}

	public emitNodeStatus(
		node: Z2MNode,
		changedProps?: utils.DeepPartial<Z2MNode>
	) {
		if (node.ready && !node.inited) {
			node.inited = true
			this.emit('nodeInited', node)
		}

		this.emit('nodeStatus', node)

		if (changedProps) {
			// we need it to have a reference of the node to update
			changedProps.id = node.id
		}

		this.sendToSocket(socketEvents.nodeUpdated, changedProps ?? node)
	}

	// ------------NODES MANAGEMENT-----------------------------------
	/**
	 * Updates node `name` property and stores updated config in `nodes.json`
	 */
	async setNodeName(nodeid: number, name: string) {
		if (!this.storeNodes[nodeid]) {
			this.storeNodes[nodeid] = {} as Z2MNode
		}

		const node = this._nodes.get(nodeid)
		const zwaveNode = this.getNode(nodeid)

		if (zwaveNode && node) {
			node.name = name
			zwaveNode.name = name
		} else {
			throw Error('Invalid Node ID')
		}

		this.storeNodes[nodeid].name = name

		await jsonStore.put(store.nodes, this.storeNodes)

		this.emitNodeStatus(node, { name: name })

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
			zwaveNode.location = loc
		} else {
			throw Error('Invalid Node ID')
		}

		this.storeNodes[nodeid].loc = loc

		await jsonStore.put(store.nodes, this.storeNodes)

		this.emitNodeStatus(node, { loc: loc })
		return true
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
	async _setScenes(scenes: Z2MScene[]) {
		// TODO: add scenes validation
		this.scenes = scenes
		await jsonStore.put(store.scenes, this.scenes)

		return scenes
	}

	/**
	 * Get all scenes
	 *
	 */
	_getScenes(): Z2MScene[] {
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
		valueId: Z2MValueIdScene,
		value: any,
		timeout: number
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
	async _removeSceneValue(sceneid: number, valueId: Z2MValueIdScene) {
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
						logger.error
					)
				},
				values[i].timeout ? values[i].timeout * 1000 : 0
			)
		}

		return true
	}

	/**
	 * Get the nodes array
	 */
	getNodes(): Z2MNode[] {
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
		this._driver.enableStatistics({
			applicationName:
				pkgjson.name +
				(this.cfg.serverEnabled ? ' / zwave-js-server' : ''),
			applicationVersion: pkgjson.version,
		})

		logger.info('Zwavejs usage statistics ENABLED')
	}

	/**
	 * Disable Statistics
	 *
	 */
	disableStatistics() {
		this._driver.disableStatistics()

		logger.info('Zwavejs usage statistics DISABLED')
	}

	getInfo() {
		const info = Object.assign({}, this.driverInfo)

		info.uptime = process.uptime()
		info.lastUpdate = this.lastUpdate
		info.status = this.status
		info.cntStatus = this._cntStatus
		info.appVersion = utils.getVersion()
		info.zwaveVersion = libVersion
		info.serverVersion = serverVersion

		return info
	}

	/**
	 * Refresh all node values
	 */
	async refreshValues(nodeId: number): Promise<void> {
		if (this.driverReady) {
			const zwaveNode = this.getNode(nodeId)

			return zwaveNode.refreshValues()
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Ping a node
	 */
	async pingNode(nodeId: number): Promise<boolean> {
		if (this.driverReady) {
			const zwaveNode = this.getNode(nodeId)

			return zwaveNode.ping()
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Refresh all node values of a specific CC
	 */
	async refreshCCValues(nodeId: number, cc: CommandClasses): Promise<void> {
		if (this.driverReady) {
			const zwaveNode = this.getNode(nodeId)

			return zwaveNode.refreshCCValues(cc)
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Set a poll interval
	 */
	setPollInterval(valueId: Z2MValueId, interval: number) {
		if (this.driverReady) {
			const vID = this._getValueID(valueId, true)

			if (this.pollIntervals[vID]) {
				clearTimeout(this.pollIntervals[vID])
			}

			logger.debug(`${vID} will be polled in ${interval} seconds`)

			this.pollIntervals[vID] = setTimeout(
				this._tryPoll.bind(this, valueId, interval),
				interval * 1000
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
	 * Request an update of this value
	 *
	 */
	async pollValue(valueId: Z2MValueId): Promise<unknown> {
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
		options?: { qrString?: string; provisioning?: PlannedProvisioningEntry }
	): Promise<boolean> {
		if (this.driverReady) {
			if (this.commandsTimeout) {
				clearTimeout(this.commandsTimeout)
				this.commandsTimeout = null
			}

			this.commandsTimeout = setTimeout(() => {
				this.stopInclusion().catch(logger.error)
			}, (this.cfg.commandsTimeout || 0) * 1000 || 30000)
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
						userCallbacks: {
							grantSecurityClasses:
								this._onGrantSecurityClasses.bind(this),
							validateDSKAndEnterPIN:
								this._onValidateDSK.bind(this),
							abort: this._onAbortInclusion.bind(this),
						},
					}
				}
				return this._driver.controller.replaceFailedNode(
					nodeId,
					inclusionOptions
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
					`Inclusion strategy not supported with replace failed node api`
				)
			}
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
		}
	): Promise<boolean> {
		if (this.driverReady) {
			if (this.commandsTimeout) {
				clearTimeout(this.commandsTimeout)
				this.commandsTimeout = null
			}

			this.commandsTimeout = setTimeout(() => {
				this.stopInclusion().catch(logger.error)
			}, (this.cfg.commandsTimeout || 0) * 1000 || 30000)

			let inclusionOptions: InclusionOptions
			const userCallbacks: InclusionUserCallbacks = {
				grantSecurityClasses: this._onGrantSecurityClasses.bind(this),
				validateDSKAndEnterPIN: this._onValidateDSK.bind(this),
				abort: this._onAbortInclusion.bind(this),
			}

			switch (strategy) {
				case InclusionStrategy.Insecure:
				case InclusionStrategy.Security_S0:
					inclusionOptions = { strategy }
					break
				case InclusionStrategy.SmartStart:
					throw Error(
						'In order to use Smart Start add you node to provisioning list'
					)
				case InclusionStrategy.Default:
					inclusionOptions = {
						strategy,
						userCallbacks,
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
							provisioning: options.provisioning,
						}
					} else {
						inclusionOptions = { strategy, userCallbacks }
					}
					break
				default:
					inclusionOptions = { strategy }
			}

			return this._driver.controller.beginInclusion(inclusionOptions)
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Start exclusion
	 */
	async startExclusion(unprovision = true): Promise<boolean> {
		if (this.driverReady) {
			if (this.commandsTimeout) {
				clearTimeout(this.commandsTimeout)
				this.commandsTimeout = null
			}

			this.commandsTimeout = setTimeout(() => {
				this.stopExclusion().catch(logger.error)
			}, (this.cfg.commandsTimeout || 0) * 1000 || 30000)

			return this._driver.controller.beginExclusion(unprovision)
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Stop exclusion
	 */
	async stopExclusion(): Promise<boolean> {
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
	async stopInclusion(): Promise<boolean> {
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
	 * Heal a node
	 */
	async healNode(nodeId: number): Promise<boolean> {
		if (this.driverReady) {
			let status: HealNodeStatus = 'pending'
			this.sendToSocket(socketEvents.healProgress, [[nodeId, status]])
			const result = await this._driver.controller.healNode(nodeId)
			status = result ? 'done' : 'failed'
			this.sendToSocket(socketEvents.healProgress, [[nodeId, status]])
			return result
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
			return this._driver.controller.removeFailedNode(nodeId)
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Re interview the node
	 */
	async refreshInfo(
		nodeId: number,
		options?: RefreshInfoOptions
	): Promise<void> {
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
	 * Start a firmware update
	 */
	async beginFirmwareUpdate(
		nodeId: number,
		fileName: string,
		data: Buffer,
		target: number
	): Promise<void> {
		if (this.driverReady) {
			const zwaveNode = this.getNode(nodeId)

			if (!zwaveNode) {
				throw Error(`Node ${nodeId} not found`)
			}

			if (!(data instanceof Buffer)) {
				throw Error('Data must be a buffer')
			}

			let actualFirmware
			try {
				const format = guessFirmwareFileFormat(fileName, data)
				actualFirmware = extractFirmware(data, format)
			} catch (e) {
				throw Error(
					'Unable to extract firmware from file: ' + e.message
				)
			}

			if (target >= 0) {
				actualFirmware.firmwareTarget = target
			}

			return zwaveNode.beginFirmwareUpdate(
				actualFirmware.data,
				actualFirmware.firmwareTarget
			)
		}

		throw new DriverNotReadyError()
	}

	async abortFirmwareUpdate(nodeId: number) {
		if (this.driverReady) {
			const zwaveNode = this.getNode(nodeId)

			if (!zwaveNode) {
				throw Error(`Node ${nodeId} not found`)
			}

			return zwaveNode.abortFirmwareUpdate()
		}

		throw new DriverNotReadyError()
	}

	beginHealingNetwork(): boolean {
		if (this.driverReady) {
			return this._driver.controller.beginHealingNetwork()
		}

		throw new DriverNotReadyError()
	}

	stopHealingNetwork(): boolean {
		if (this.driverReady) {
			return this._driver.controller.stopHealingNetwork()
		}

		throw new DriverNotReadyError()
	}

	async hardReset() {
		if (this.driverReady) {
			return this._driver.hardReset()
		}

		throw new DriverNotReadyError()
	}

	softReset() {
		if (this.driverReady) {
			return this._driver.softReset()
		}

		throw new DriverNotReadyError()
	}

	/**
	 * Send a command
	 */
	async sendCommand(
		ctx: {
			nodeId: number
			endpoint: number
			commandClass: CommandClasses | keyof typeof CommandClasses
		},
		command: string,
		args: any[]
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
					`Endpoint ${ctx.endpoint} does not exist on Node ${ctx.nodeId}!`
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
					`Node ${ctx.nodeId} (Endpoint ${ctx.endpoint}) does not support CC ${ctx.commandClass} or it has not been implemented yet`
				)
			} else if (!(command in api)) {
				throw Error(
					`The command ${command} does not exist for CC ${ctx.commandClass}`
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
	 * ZwaveClients methods used are the ones that overrides default Zwave methods
	 * like nodes name and location and scenes management.
	 */
	async callApi<T extends AllowedApis>(
		apiName: T,
		...args: Parameters<ZwaveClient[T]>
	) {
		let err: string, result: ReturnType<ZwaveClient[T]>

		logger.log('info', 'Calling api %s with args: %o', apiName, args)

		if (this.driverReady) {
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
			err = 'Zwave client not connected'
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
	 *
	 */
	async writeBroadcast(valueId: ValueID, value: unknown) {
		if (this.driverReady) {
			try {
				const broadcastNode = this._driver.controller.getBroadcastNode()

				await broadcastNode.setValue(valueId, value)
			} catch (error) {
				logger.error(
					`Error while sending broadcast ${value} to CC ${
						valueId.commandClass
					} ${valueId.property} ${valueId.propertyKey || ''}: ${
						error.message
					}`
				)
			}
		}
	}

	/**
	 * Send multicast write request to a group of nodes
	 */
	async writeMulticast(nodes: number[], valueId: Z2MValueId, value: unknown) {
		if (this.driverReady) {
			let fallback = false
			try {
				const multicastGroup =
					this._driver.controller.getMulticastGroup(nodes)
				await multicastGroup.setValue(valueId, value)
			} catch (error) {
				fallback = error.code === ZWaveErrorCodes.CC_NotSupported
				logger.error(
					`Error while sending multicast ${value} to CC ${
						valueId.commandClass
					} ${valueId.property} ${valueId.propertyKey || ''}: ${
						error.message
					}`
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
		valueId: Z2MValueId,
		value: any,
		options?: SetValueAPIOptions
	) {
		let result = false
		if (this.driverReady) {
			const vID = this._getValueID(valueId, true)
			logger.log('info', `Writing %o to ${vID}`, value)

			try {
				const zwaveNode = this.getNode(valueId.nodeId)

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
					result = true
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

					result = await zwaveNode.setValue(valueId, value, options)

					if (result) {
						this.emit(
							'valueWritten',
							valueId,
							this.nodes.get(valueId.nodeId),
							value
						)
					}
				}
			} catch (error) {
				logger.log(
					'error',
					`Error while writing %o on ${vID}: ${error.message}`,
					value
				)
			}
			// https://zwave-js.github.io/node-zwave-js/#/api/node?id=setvalue
			if (result === false) {
				logger.log('error', `Unable to write %o on ${vID}`, value)
			}
		}

		return result
	}

	// ---------- DRIVER EVENTS -------------------------------------

	private _onDriverReady() {
		/*
    Now the controller interview is complete. This means we know which nodes
    are included in the network, but they might not be ready yet.
    The node interview will continue in the background.
  */

		// driver ready
		this.status = ZwaveClientStatus.DRIVER_READY

		this.driverReady = true

		logger.info('Zwave driver is ready')

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
				.on('inclusion failed', this._onInclusionFailed.bind(this))
				.on('exclusion failed', this._onExclusionFailed.bind(this))
				.on('node added', this._onNodeAdded.bind(this))
				.on('node removed', this._onNodeRemoved.bind(this))
				.on(
					'heal network progress',
					this._onHealNetworkProgress.bind(this)
				)
				.on('heal network done', this._onHealNetworkDone.bind(this))
				.on(
					'statistics updated',
					this._onControllerStatisticsUpdated.bind(this)
				)
		} catch (error) {
			// Fixes freak error in "driver ready" handler #1309
			logger.error(error.message)
			this.restart().catch((err) => {
				logger.error(err)
			})
			return
		}

		for (const [, node] of this._driver.controller.nodes) {
			// node added will not be triggered if the node is in cache
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

		this._error = false

		// start server only when driver is ready. Fixes #602
		if (this.cfg.serverEnabled && this.server) {
			this.server.start()
		}

		logger.info(`Scanning network with homeid: ${homeHex}`)
	}

	private async _onDriverError(
		error: ZWaveError,
		skipRestart = false
	): Promise<void> {
		this._error = 'Driver: ' + error.message
		this.status = ZwaveClientStatus.DRIVER_FAILED
		this._updateControllerStatus(this._error)
		this.emit('event', EventSource.DRIVER, 'driver error', error)

		if (!skipRestart && error.code === ZWaveErrorCodes.Driver_Failed) {
			// this cannot be recovered by zwave-js, requires a manual restart
			try {
				await this.restart()
			} catch (error) {
				logger.error(`Error while restarting driver: ${error.message}`)
			}
		}
	}

	private _onControllerStatisticsUpdated(stats: ControllerStatistics) {
		let controllerNode: Z2MNode
		try {
			controllerNode = this.nodes.get(this.driver.controller.ownNodeId)
		} catch (e) {
			// This should not happen, but it does. Don't crash!
			return
		}

		if (controllerNode) {
			controllerNode.statistics = stats
		}

		this.sendToSocket(socketEvents.statistics, {
			nodeId: controllerNode.id,
			statistics: stats,
		})

		this.emit('event', EventSource.CONTROLLER, 'statistics updated', stats)
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

	private _updateControllerStatus(status) {
		if (this._cntStatus !== status) {
			logger.info(`Controller status: ${status}`)
			this._cntStatus = status
			this.sendToSocket(socketEvents.controller, status)
		}
	}

	private _onInclusionStarted(secure) {
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

	private _onInclusionFailed() {
		const message = 'Inclusion failed'
		this._updateControllerStatus(message)
		this.emit('event', EventSource.CONTROLLER, 'inclusion failed')
	}

	private _onExclusionFailed() {
		const message = 'Exclusion failed'
		this._updateControllerStatus(message)
		this.emit('event', EventSource.CONTROLLER, 'exclusion failed')
	}

	/**
	 * Triggered when a node is added
	 */
	private async _onNodeAdded(zwaveNode: ZWaveNode, result: InclusionResult) {
		let node
		// the driver is ready so this node has been added on fly
		if (this.driverReady) {
			node = this._addNode(zwaveNode)

			const security = zwaveNode.getHighestSecurityClass()

			if (security) {
				node.security = SecurityClass[security]
			}

			if (zwaveNode.dsk) {
				const entry = this.driver.controller.getProvisioningEntry(
					dskToString(zwaveNode.dsk)
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

		logger.info(`Node ${zwaveNode.id}: added with security ${security}`)

		this.emit(
			'event',
			EventSource.CONTROLLER,
			'node added',
			this._nodes.get(zwaveNode.id)
		)
	}

	/**
	 * Triggered when node is removed
	 *
	 */
	private _onNodeRemoved(zwaveNode: ZWaveNode) {
		logger.info(`Node ${zwaveNode.id}: removed`)
		zwaveNode.removeAllListeners()

		this.emit(
			'event',
			EventSource.CONTROLLER,
			'node removed',
			this._nodes.get(zwaveNode.id)
		)

		this._removeNode(zwaveNode.id)
	}

	/**
	 * Triggered on each progress of healing process
	 */
	private _onHealNetworkProgress(
		progress: ReadonlyMap<number, HealNodeStatus>
	) {
		const toHeal = [...progress.values()]
		const healedNodes = toHeal.filter((v) => v !== 'pending')
		const message = `Healing process IN PROGRESS. Healed ${healedNodes.length} nodes`
		this._updateControllerStatus(message)
		this.sendToSocket(socketEvents.healProgress, [...progress.entries()])

		// update heal progress status
		for (const [nodeId, status] of progress) {
			const node = this._nodes.get(nodeId)
			if (node) {
				node.healProgress = status
			}
		}

		this.emit(
			'event',
			EventSource.CONTROLLER,
			'heal network progress',
			progress
		)
	}

	private _onHealNetworkDone(result) {
		const message = `Healing process COMPLETED. Healed ${result.size} nodes`
		this._updateControllerStatus(message)
	}

	private _onGrantSecurityClasses(
		requested: InclusionGrant
	): Promise<InclusionGrant | false> {
		logger.log('info', `Grant security classes: %o`, requested)
		this.sendToSocket(socketEvents.grantSecurityClasses, requested)
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

		logger.warn('Inclusion aborted')
	}

	async backupNVMRaw() {
		if (!this.driverReady) {
			throw new DriverNotReadyError()
		}

		const data = await this.driver.controller.backupNVMRaw(
			this._onBackupNVMProgress.bind(this)
		)

		const fileName = `NVM_${new Date().toISOString().split('T')[0]}`

		await writeFile(utils.joinPath(storeDir, fileName + '.bin'), data)

		return { data, fileName }
	}

	private _onBackupNVMProgress(bytesRead: number, totalBytes: number) {
		const progress = Math.round((bytesRead / totalBytes) * 100)
		this._updateControllerStatus(`Backup NVM progress: ${progress}%`)
	}

	async restoreNVMRaw(data: Buffer) {
		if (!this.driverReady) {
			throw new DriverNotReadyError()
		}

		await this.driver.controller.restoreNVMRaw(
			data,
			this._onRestoreNVMProgress.bind(this)
		)
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
			if (
				typeof entry.manufacturerId === 'number' &&
				typeof entry.productType === 'number' &&
				typeof entry.productId === 'number' &&
				typeof entry.applicationVersion === 'string'
			) {
				const device = await this.driver.configManager.lookupDevice(
					entry.manufacturerId,
					entry.productType,
					entry.productId,
					entry.applicationVersion
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

		this.driver.controller.provisionSmartStartNode(entry)
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

			let changedProps: utils.DeepPartial<Z2MNode>

			if (updateStatusOnly) {
				changedProps = {
					status: node.status,
					available: node.available,
					interviewStage: node.interviewStage,
				}
			}

			this.emitNodeStatus(node, changedProps)
		} else {
			logger.error(
				Error(
					`Received update from node ${zwaveNode.id} that doesn't exists`
				)
			)
		}
	}

	/**
	 * Triggered when a node is ready. All values are added and all node info are received
	 *
	 */
	private _onNodeReady(zwaveNode: ZWaveNode) {
		const node = this._nodes.get(zwaveNode.id)

		if (!node) {
			logger.error(
				`Node ${zwaveNode.id} ready event called on a node that doesn't exists in memory`
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

		for (const zwaveValue of values) {
			this._addValue(zwaveNode, zwaveValue, existingValues)
		}

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

		// node is ready when all it's info are parsed and all values added
		// don't set the node as ready before all values are added, to prevent discovery
		node.ready = true

		node.lastActive = Date.now()

		this.getGroups(zwaveNode.id, true)

		// handle mapped node properties:
		this._updateValuesMapForNode(node)
		this._mapCCExistsToNodeProps(node)

		this._onNodeStatus(zwaveNode)

		this.emit(
			'event',
			EventSource.NODE,
			'node ready',
			this._nodes.get(zwaveNode.id)
		)

		logger.info(
			`Node ${node.id} ready: ${node.manufacturer} - ${
				node.productLabel
			} (${node.productDescription || 'Unknown'})`
		)
	}

	/**
	 * Triggered when a node interview starts for the first time or when the node is manually re-interviewed
	 *
	 */
	private _onNodeInterviewStarted(zwaveNode: ZWaveNode) {
		const node = this._nodes.get(zwaveNode.id)

		logger.info(`Node ${zwaveNode.id}: interview started`)

		this.emit('event', EventSource.NODE, 'node interview started', node)
	}

	/**
	 * Triggered when an interview stage complete
	 *
	 */
	private _onNodeInterviewStageCompleted(
		zwaveNode: ZWaveNode,
		stageName: string
	) {
		const node = this._nodes.get(zwaveNode.id)

		logger.info(
			`Node ${
				zwaveNode.id
			}: interview stage ${stageName.toUpperCase()} completed`
		)

		this._onNodeStatus(zwaveNode, true)

		this.emit(
			'event',
			EventSource.NODE,
			'node interview stage completed',
			node
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

		logger.info(
			`Node ${zwaveNode.id}: interview COMPLETED, all values are updated`
		)

		this._onNodeStatus(zwaveNode, true)

		this.emit(
			'event',
			EventSource.NODE,
			'node interview completed',
			this._nodes.get(zwaveNode.id)
		)
	}

	/**
	 * Triggered when a node interview fails.
	 *
	 */
	private _onNodeInterviewFailed(
		zwaveNode: ZWaveNode,
		args: NodeInterviewFailedEventArgs
	) {
		logger.error(
			`Interview of node ${zwaveNode.id} has failed: ${args.errorMessage}`
		)

		this._onNodeStatus(zwaveNode, true)

		this.emit(
			'event',
			EventSource.NODE,
			'node interview failed',
			this._nodes.get(zwaveNode.id)
		)
	}

	/**
	 * Triggered when a node wake ups
	 *
	 */
	private _onNodeWakeUp(zwaveNode: ZWaveNode, oldStatus: NodeStatus) {
		logger.info(
			`Node ${zwaveNode.id} is ${
				oldStatus === NodeStatus.Unknown ? '' : 'now '
			}awake`
		)

		this._onNodeStatus(zwaveNode, true)
		this.emit(
			'event',
			EventSource.NODE,
			'node wakeup',
			this._nodes.get(zwaveNode.id)
		)
	}

	/**
	 * Triggered when a node is sleeping
	 *
	 */
	private _onNodeSleep(zwaveNode: ZWaveNode, oldStatus: NodeStatus) {
		logger.info(
			`Node ${zwaveNode.id} is ${
				oldStatus === NodeStatus.Unknown ? '' : 'now '
			}asleep`
		)
		this._onNodeStatus(zwaveNode, true)
		this.emit(
			'event',
			EventSource.NODE,
			'node sleep',
			this._nodes.get(zwaveNode.id)
		)
	}

	/**
	 * Triggered when a node is alive
	 *
	 */
	private _onNodeAlive(zwaveNode: ZWaveNode, oldStatus: NodeStatus) {
		this._onNodeStatus(zwaveNode, true)
		if (oldStatus === NodeStatus.Dead) {
			logger.info(`Node ${zwaveNode.id}: has returned from the dead`)
		} else {
			logger.info(`Node ${zwaveNode.id} is alive`)
		}

		this.emit(
			'event',
			EventSource.NODE,
			'node alive',
			this._nodes.get(zwaveNode.id)
		)
	}

	/**
	 * Triggered when a node is dead
	 *
	 */
	private _onNodeDead(zwaveNode: ZWaveNode, oldStatus: NodeStatus) {
		this._onNodeStatus(zwaveNode, true)
		logger.info(
			`Node ${zwaveNode.id} is ${
				oldStatus === NodeStatus.Unknown ? '' : 'now '
			}dead`
		)

		this.emit(
			'event',
			EventSource.NODE,
			'node dead',
			this._nodes.get(zwaveNode.id)
		)
	}

	/**
	 * Triggered when a node value is added
	 *
	 */
	private _onNodeValueAdded(
		zwaveNode: ZWaveNode,
		args: ZWaveNodeValueAddedArgs
	) {
		logger.info(
			`Node ${zwaveNode.id}: value added: ${this._getValueID(
				args as unknown as Z2MValueId
			)} => ${args.newValue}`
		)

		// handle node values added 'on fly'
		if (zwaveNode.ready) {
			this._addValue(zwaveNode, args)
		}

		this.emit(
			'event',
			EventSource.NODE,
			'node value added',
			this._nodes.get(zwaveNode.id),
			args
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
		}
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
		}
	) {
		this._updateValue(zwaveNode, args)
		logger.info(
			`Node ${zwaveNode.id}: value ${
				args.stateless ? 'notification' : 'updated'
			}: ${this._getValueID(args)} ${
				args.stateless
					? args.newValue
					: `${args.prevValue} => ${args.newValue}`
			}`
		)

		this.emit(
			'event',
			EventSource.NODE,
			'node value updated',
			this._nodes.get(zwaveNode.id),
			args
		)
	}

	/**
	 * Emitted when we receive a `value removed` event
	 *
	 */
	private _onNodeValueRemoved(
		zwaveNode: ZWaveNode,
		args: ZWaveNodeValueRemovedArgs
	) {
		this._removeValue(zwaveNode, args)
		logger.info(
			`Node ${zwaveNode.id}: value removed: ${this._getValueID(args)}`
		)
		this.emit(
			'event',
			EventSource.NODE,
			'node value removed',
			this._nodes.get(zwaveNode.id),
			args
		)
	}

	/**
	 * Emitted when we receive a `metadata updated` event
	 *
	 */
	private _onNodeMetadataUpdated(
		zwaveNode: ZWaveNode,
		args: ZWaveNodeMetadataUpdatedArgs
	) {
		const valueId = this._parseValue(zwaveNode, args, args.metadata)
		logger.info(
			`Node ${valueId.nodeId}: metadata updated: ${this._getValueID(
				args as unknown as Z2MValueId
			)}`
		)
		this.emit(
			'event',
			EventSource.NODE,
			'node metadata updated',
			this._nodes.get(zwaveNode.id),
			args
		)
	}

	/**
	 * Emitted when we receive a node `notification` event
	 *
	 */
	private _onNodeNotification(
		zwaveNode: ZWaveNode,
		ccId: CommandClasses,
		args: Record<string, unknown>
	) {
		const valueId: Partial<Z2MValueId> = {
			id: null,
			nodeId: zwaveNode.id,
			commandClass: ccId,
			commandClassName: CommandClasses[ccId],
			property: null,
		}

		let data = null

		if (ccId === CommandClasses.Notification) {
			valueId.property = args.label as string
			valueId.propertyKey = args.eventLabel as string

			data = this._parseNotification(args.parameters)
		} else if (ccId === CommandClasses['Entry Control']) {
			valueId.property = args.eventType as string
			valueId.propertyKey = args.dataType as string
			data =
				args.eventData instanceof Buffer
					? utils.buffer2hex(args.eventData)
					: args.eventData
		} else {
			logger.log(
				'error',
				'Unknown notification received from node %d CC %s: %o',
				zwaveNode.id,
				valueId.commandClassName,
				args
			)

			return
		}

		valueId.id = this._getValueID(valueId, true)
		valueId.propertyName = valueId.property // must be defined in named topics

		logger.log(
			'info',
			'Node %d CC %s %o',
			zwaveNode.id,
			valueId.commandClassName,
			args
		)

		const node = this._nodes.get(zwaveNode.id)

		this.emit('notification', node, valueId as Z2MValueId, data)

		this.emit(
			'event',
			EventSource.NODE,
			'node notification',
			node,
			valueId,
			data
		)
	}

	private _onNodeStatisticsUpdated(
		zwaveNode: ZWaveNode,
		stats: NodeStatistics
	) {
		const node = this.nodes.get(zwaveNode.id)

		if (node) {
			node.statistics = stats
		}

		this.sendToSocket(socketEvents.statistics, {
			nodeId: node.id,
			statistics: stats,
		})

		this.emit(
			'event',
			EventSource.NODE,
			'statistics updated',
			node.id,
			stats
		)
	}

	/**
	 * Emitted when we receive a node `firmware update progress` event
	 *
	 */
	private _onNodeFirmwareUpdateProgress(
		zwaveNode: ZWaveNode,
		sentFragments: number,
		totalFragments: number
	) {
		this._updateControllerStatus(
			`Node ${zwaveNode.id} firmware update IN PROGRESS: ${sentFragments}/${totalFragments}`
		)
		this.emit(
			'event',
			EventSource.NODE,
			'node firmware update progress',
			this._nodes.get(zwaveNode.id),
			sentFragments,
			totalFragments
		)
	}

	/**
	 * Triggered we receive a node `firmware update finished` event
	 *
	 */
	private _onNodeFirmwareUpdateFinished(
		zwaveNode: ZWaveNode,
		status: FirmwareUpdateStatus,
		waitTime: number
	) {
		this._updateControllerStatus(
			`Node ${zwaveNode.id} firmware update FINISHED: Status ${
				FirmwareUpdateStatus[status]
			}, Time: ${waitTime || 0}`
		)

		this.emit(
			'event',
			EventSource.NODE,
			'node firmware update finished',
			this._nodes.get(zwaveNode.id),
			status,
			waitTime
		)
	}

	// ------- NODE METHODS -------------

	/**
	 * Bind to ZwaveNode events
	 *
	 */
	private _bindNodeEvents(zwaveNode: ZWaveNode) {
		logger.debug(`Binding to node ${zwaveNode.id} events`)

		// https://zwave-js.github.io/node-zwave-js/#/api/node?id=zwavenode-events
		zwaveNode
			.on('ready', this._onNodeReady.bind(this))
			.on('interview started', this._onNodeInterviewStarted.bind(this))
			.on(
				'interview stage completed',
				this._onNodeInterviewStageCompleted.bind(this)
			)
			.on(
				'interview completed',
				this._onNodeInterviewCompleted.bind(this)
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
				this._onNodeFirmwareUpdateProgress.bind(this)
			)
			.on(
				'firmware update finished',
				this._onNodeFirmwareUpdateFinished.bind(this)
			)
			.on('statistics updated', this._onNodeStatisticsUpdated.bind(this))
	}

	/**
	 * Remove a node from internal nodes array
	 *
	 */
	private _removeNode(nodeid: number) {
		logger.info(`Node removed ${nodeid}`)

		// don't use splice here, nodeid equals to the index in the array
		const node = this._nodes.get(nodeid)
		if (node) {
			this._nodes.delete(nodeid)

			this.emit('nodeRemoved', node)
			this.sendToSocket(socketEvents.nodeRemoved, node)
		}
	}

	/**
	 * Add a new node to our nodes array. No informations are available yet, the node needs to be ready
	 *
	 */
	private _addNode(zwaveNode: ZWaveNode): Z2MNode {
		const nodeId = zwaveNode.id

		const existingNode = this._nodes.get(nodeId)

		// this shouldn't happen
		if (existingNode && existingNode.ready) {
			logger.error(
				'Error while adding node ' + nodeId,
				Error('node has been added twice')
			)
			return existingNode
		}

		const node: Z2MNode = {
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
		}

		this._nodes.set(nodeId, node)

		this._dumpNode(zwaveNode)
		this._bindNodeEvents(zwaveNode)
		this._onNodeStatus(zwaveNode)
		logger.debug(`Node ${nodeId} has been added to nodes array`)

		return node
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
		node.hexId = `${hexIds[0]}-${hexIds[2]}-${hexIds[1]}`
		node.dbLink = `https://devices.zwave-js.io/?jumpTo=${hexIds[0]}:${
			hexIds[2]
		}:${hexIds[1]}:${node.firmwareVersion || '0.0'}`

		const deviceConfig = zwaveNode.deviceConfig || {
			label: `Unknown product ${hexIds[1]}`,
			description: hexIds[2],
			manufacturer:
				this.driver.configManager.lookupManufacturer(
					zwaveNode.manufacturerId
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
		node.protocolVersion = zwaveNode.protocolVersion
		node.zwavePlusVersion = zwaveNode.zwavePlusVersion
		node.zwavePlusNodeType = zwaveNode.zwavePlusNodeType
		node.zwavePlusRoleType = zwaveNode.zwavePlusRoleType
		node.nodeType = zwaveNode.nodeType
		node.endpointsCount = zwaveNode.getEndpointCount()
		node.endpointIndizes = zwaveNode.getEndpointIndizes()
		node.isSecure = zwaveNode.isSecure
		node.security = SecurityClass[zwaveNode.getHighestSecurityClass()]
		node.supportsSecurity = zwaveNode.supportsSecurity
		node.supportsBeaming = zwaveNode.supportsBeaming
		node.isControllerNode = zwaveNode.isControllerNode()
		node.isListening = zwaveNode.isListening
		node.isFrequentListening = zwaveNode.isFrequentListening
		node.isRouting = zwaveNode.isRouting
		node.keepAwake = zwaveNode.keepAwake
		node.maxDataRate = zwaveNode.maxDataRate
		node.deviceClass = {
			basic: zwaveNode.deviceClass?.basic.key,
			generic: zwaveNode.deviceClass?.generic.key,
			specific: zwaveNode.deviceClass?.specific.key,
		}

		const storedNode = this.storeNodes[nodeId]

		if (storedNode) {
			node.loc = storedNode.loc || ''
			node.name = storedNode.name || ''

			if (storedNode.hassDevices) {
				node.hassDevices = utils.copy(storedNode.hassDevices)
			}

			// keep zwaveNode and node name and location synced
			if (node.name && node.name !== zwaveNode.name) {
				zwaveNode.name = node.name
			}
			if (node.loc && node.loc !== zwaveNode.location) {
				zwaveNode.location = node.loc
			}
		} else {
			this.storeNodes[nodeId] = {}
		}

		node.deviceId = this._getDeviceID(node)
	}

	/**
	 * Set value metadata to the internal valueId
	 *
	 */
	private _updateValueMetadata(
		zwaveNode: ZWaveNode,
		zwaveValue: TranslatedValueID & { [x: string]: any },
		zwaveValueMeta: ValueMetadata
	): Z2MValueId {
		zwaveValue.nodeId = zwaveNode.id

		const valueId: Z2MValueId = {
			id: this._getValueID(zwaveValue, true), // the valueId unique in the entire network, it also has the nodeId
			nodeId: zwaveNode.id,
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
				zwaveValueMeta.label || zwaveValue.propertyName + ' (property)', // when label is missing, re use propertyName. Usefull for webinterface
			default: zwaveValueMeta.default,
			ccSpecific: zwaveValueMeta.ccSpecific,
			stateless: zwaveValue.stateless || false, // used for notifications to specify that this should not be persisted (retained)
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
					value: parseInt(k),
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
			[key: string]: Z2MValueId
		}
	) {
		const node = this._nodes.get(zwaveNode.id)

		if (!node) {
			logger.info(`ValueAdded: no such node: ${zwaveNode.id} error`)
		} else {
			const zwaveValueMeta = zwaveNode.getValueMetadata(zwaveValue)

			const valueId = this._parseValue(
				zwaveNode,
				zwaveValue,
				zwaveValueMeta
			)

			const vID = this._getValueID(valueId)

			// a valueId is udpated when it doesn't exist or its value is updated
			const updated =
				!oldValues ||
				!oldValues[vID] ||
				oldValues[vID].value !== valueId.value

			logger.info(
				`Node ${zwaveNode.id}: value added ${valueId.id} => ${valueId.value}`
			)

			if (updated) {
				this.emitValueChanged(valueId, node, true)
			}
		}
	}

	/**
	 * Parse a zwave value into a valueID
	 *
	 */
	private _parseValue(
		zwaveNode: ZWaveNode,
		zwaveValue: TranslatedValueID & { [x: string]: any },
		zwaveValueMeta: ValueMetadata
	) {
		const node = this._nodes.get(zwaveNode.id)
		const valueId = this._updateValueMetadata(
			zwaveNode,
			zwaveValue,
			zwaveValueMeta
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
				zwaveNode.getDefinedValueIDs()
			)
			if (targetValue) {
				valueId.targetValue = this._getValueID(targetValue)
			}
		}

		node.values[vID] = valueId

		return valueId
	}

	/**
	 * Used to map existance of CCs to node properties
	 */
	private _mapCCExistsToNodeProps(node: Z2MNode) {
		for (const cc in nodePropsMap) {
			if (!nodePropsMap?.[cc]?.existsProp) continue
			const nodeProp = nodePropsMap[cc].existsProp
			node[nodeProp] =
				!!nodeValuesMap[node.id] && !!nodeValuesMap[node.id][cc]

			if (logger.isDebugEnabled) {
				logger.debug(
					`Node ${node.id}: mapping ${
						node[nodeProp] ? 'existence' : 'absence'
					} of CC ${cc} (${
						CommandClasses[cc]
					}) to node property '${nodeProp}`
				)
			}
		}
	}

	/**
	 * Used to update the value map for all configured properties
	 */
	private _updateValuesMapForNode(node: Z2MNode) {
		Object.values(node.values).forEach((value) => {
			if (
				!nodePropsMap?.[value.commandClass]?.valueProps?.[
					value.property
				]
			)
				return
			this._updateValuesMap(node, value)
		})
		this._mapValuesToNodeProps(node)
	}

	/**
	 * Used to update a single value in the value map
	 */
	private _updateValuesMap(node: Z2MNode, value: Z2MValueId) {
		if (!nodePropsMap?.[value.commandClass]?.valueProps?.[value.property])
			return
		set(
			nodeValuesMap,
			[node.id, value.commandClass, value.property, value.endpoint].join(
				'.'
			),
			value
		)
	}

	/**
	 * Used when node is ready to map certain values (e.g. batteryLevel) to direct node properties.
	 * @param node The affected node
	 * @param valueId The value to be mapped (if undefined, all node values are iterated)
	 */
	private _mapValuesToNodeProps(node: Z2MNode) {
		for (const cc in nodePropsMap) {
			if (!nodePropsMap[cc].valueProps) continue
			for (const valueProp in nodePropsMap[cc].valueProps) {
				if (!nodeValuesMap?.[node.id]?.[cc]?.[valueProp]) continue
				Object.values(nodeValuesMap[node.id][cc][valueProp]).forEach(
					(value: Z2MValueId) =>
						this._mapValueToNodeProps(node, value)
				)
			}
		}
	}

	/**
	 * Used when a value should be mapped to node properties.
	 * @param node The affected node
	 * @param valueId The value to be mapped (if undefined, all node values are iterated)
	 */
	private _mapValueToNodeProps(node: Z2MNode, valueId?: Z2MValueId) {
		if (
			!valueId?.commandClass ||
			!valueId?.property ||
			!nodeValuesMap?.[node.id]?.[valueId.commandClass]?.[
				valueId.property
			] ||
			!nodePropsMap?.[valueId.commandClass]?.valueProps?.[
				valueId.property
			]
		)
			return

		const updatedProps = {}
		nodePropsMap[valueId.commandClass].valueProps[valueId.property].forEach(
			(vMap) => {
				const vIds: Z2MValueId[] =
					nodeValuesMap[node.id][valueId.commandClass][
						valueId.property
					]
				const values = Object.values(vIds)
				const result = vMap.fn(node, values)
				node[vMap.nodeProp] = result
				updatedProps[vMap.nodeProp] = result
				if (logger.isDebugEnabled) {
					logger.debug(
						`Node ${node.id}: mapping value(s) of property '${
							valueId.property
						}' (${valueId.propertyName}) from CC ${
							valueId.commandClass
						} (${
							CommandClasses[valueId.commandClass]
						}) to node property '${vMap.nodeProp}`
					)
				}
			}
		)

		this.emitNodeStatus(node, updatedProps)
	}

	/**
	 * Triggered when a node is ready and a value changes
	 *
	 */
	private _updateValue(
		zwaveNode: ZWaveNode,
		args: TranslatedValueID & { [x: string]: any }
	) {
		const node = this._nodes.get(zwaveNode.id)

		if (!node) {
			logger.info(`valueChanged: no such node: ${zwaveNode.id} error`)
		} else {
			let skipUpdate = false

			const vID = this._getValueID(args as unknown as Z2MValueId)

			// notifications events are not defined as values, manually create them once we get the first update
			if (!node.values[vID]) {
				this._addValue(zwaveNode, args)
				// addValue call already trigger valueChanged event
				skipUpdate = true
			}

			const valueId = node.values[vID]

			if (valueId) {
				let newValue = args.newValue
				if (Buffer.isBuffer(newValue)) {
					// encode Buffers as HEX strings
					newValue = utils.buffer2hex(newValue)
				}

				let prevValue = args.prevValue
				if (Buffer.isBuffer(prevValue)) {
					// encode Buffers as HEX strings
					prevValue = utils.buffer2hex(prevValue)
				}

				valueId.value = newValue
				valueId.stateless = !!args.stateless

				this._updateValuesMap(node, valueId)
				this._mapValueToNodeProps(node, valueId)

				// ensure duration is never undefined
				if (
					valueId.type === 'duration' &&
					valueId.value === undefined
				) {
					valueId.value = new Duration(undefined, 'seconds')
				}

				if (!skipUpdate) {
					this.emitValueChanged(valueId, node, prevValue !== newValue)
				}
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

			node.lastActive = Date.now()
		}
	}

	/**
	 * Remove a value from internal node values
	 *
	 */
	private _removeValue(
		zwaveNode: ZWaveNode,
		args: ZWaveNodeValueRemovedArgs
	) {
		const node = this._nodes.get(zwaveNode.id)
		const vID = this._getValueID(args)
		const toRemove = node ? node.values[vID] : null

		if (toRemove) {
			delete node.values[vID]
			this.sendToSocket(socketEvents.valueRemoved, toRemove)
			logger.info(`ValueRemoved: ${vID} from node ${zwaveNode.id}`)
		} else {
			logger.info(`ValueRemoved: no such node: ${zwaveNode.id} error`)
		}
	}

	// ------- Utils ------------------------

	private _parseNotification(parameters) {
		if (Buffer.isBuffer(parameters)) {
			return parameters.toString('hex')
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
	private _getDeviceID(node: Z2MNode): string {
		if (!node) return ''

		return `${node.manufacturerId}-${node.productId}-${node.productType}`
	}

	/**
	 * Check if a valueID is a current value
	 */
	private _isCurrentValue(valueId: TranslatedValueID | Z2MValueId) {
		return valueId.propertyName && /current/i.test(valueId.propertyName)
	}

	/**
	 * Find the target valueId of a current valueId
	 */
	private _findTargetValue(
		zwaveValue: TranslatedValueID,
		definedValueIds: TranslatedValueID[]
	) {
		return definedValueIds.find(
			(v) =>
				v.commandClass === zwaveValue.commandClass &&
				v.endpoint === zwaveValue.endpoint &&
				v.propertyKey === zwaveValue.propertyKey &&
				/target/i.test(v.property.toString())
		)
	}

	/**
	 * Get a valueId from a valueId object
	 */
	private _getValueID(v: Partial<Z2MValueId>, withNode = false) {
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
			waitMillis > 0 ? waitMillis : 1000
		)
	}

	/**
	 * Try to poll a value, don't throw. Used in the setTimeout
	 *
	 */
	private async _tryPoll(valueId: Z2MValueId, interval: number) {
		try {
			await this.pollValue(valueId)
		} catch (error) {
			logger.error(
				`Error while polling value ${this._getValueID(
					valueId,
					true
				)}: ${error.message}`
			)
		}

		this.setPollInterval(valueId, interval)
	}
}

export default ZwaveClient
