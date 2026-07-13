import * as utils from './utils.ts'
import type { SetValueAPIOptions } from 'zwave-js'
import type { ValueID } from '@zwave-js/core'
import { CommandClasses } from '@zwave-js/core'
import * as Constants from './Constants.ts'
import type { LogLevel } from './logger.ts'
import { module } from './logger.ts'
import { PayloadType } from './shared.ts'
import type { IClientPublishOptions } from 'mqtt'
import MqttClient, { type MqttClientEventCallbacks } from './MqttClient.ts'
import type {
	AllowedApis,
	CallAPIResult,
	EventSource,
	ZUINode,
	ZUIValueId,
	ZUIValueIdState,
} from './ZwaveClient.ts'
import type ZwaveClient from './ZwaveClient.ts'
import Cron from 'croner'

import type { HassDevice } from '../hass/types.ts'
import type { DiscoveryGenerator } from '../hass/DiscoveryGenerator.ts'
import MqttDiscoveryManager, {
	type MqttDiscoveryManagerOptions,
} from '../hass/MqttDiscoveryManager.ts'
import type {
	HassDeviceRegistryLifecyclePort,
	HassNode,
	HassTopicNode,
	HassValue,
	HassValueTopic,
} from '../hass/ports.ts'
import { isHassNode } from '../hass/ports.ts'

const logger = module('Gateway')

const NODE_PREFIX = 'nodeID_'

const GATEWAY_TYPE = {
	VALUEID: 0,
	NAMED: 1,
	MANUAL: 2,
} as const

export const GatewayType = GATEWAY_TYPE
export type GatewayType = (typeof GATEWAY_TYPE)[keyof typeof GATEWAY_TYPE]

export { PayloadType }

export type GatewayValue = {
	device: string
	value: ZUIValueId
	topic?: string
	device_class?: string
	icon?: string
	postOperation?: string
	enablePoll?: boolean
	pollInterval?: number
	parseSend?: boolean
	sendFunction?: string
	parseReceive?: boolean
	receiveFunction?: string
	qos?: 0 | 1 | 2
	retain?: boolean
	ccConfigEnableDiscovery?: boolean
}

export type ScheduledJob = {
	name: string
	cron?: string
	enabled: boolean
	runOnInit: boolean
	code: string
}

export type GatewayConfig = {
	type: GatewayType
	payloadType?: PayloadType
	nodeNames?: boolean
	ignoreLoc?: boolean
	sendEvents?: boolean
	ignoreStatus?: boolean
	includeNodeInfo?: boolean
	publishNodeDetails?: boolean
	retainedDiscovery?: boolean
	entityTemplate?: string
	hassDiscovery?: boolean
	discoveryPrefix?: string
	useLocationAsSuggestedArea?: boolean
	logEnabled?: boolean
	logLevel?: LogLevel
	logToFile?: boolean
	values?: GatewayValue[]
	jobs?: ScheduledJob[]
	plugins?: string[]
	logFileName?: string
	manualDiscovery?: boolean
	authEnabled?: boolean
	versions?: {
		driver?: string
		app?: string
		server?: string
	}
	disableChangelog?: boolean
	notifyNewVersions?: boolean
	https?: boolean
}

interface ValueIdTopic {
	topic: string
	valueConf: GatewayValue
	targetTopic?: string
}

export type GatewayZwave = Pick<
	ZwaveClient,
	| 'callApi'
	| 'close'
	| 'connect'
	| 'driverFunction'
	| 'emitNodeUpdate'
	| 'homeHex'
	| 'nodes'
	| 'off'
	| 'on'
	| 'setPollInterval'
	| 'updateDevice'
	| 'writeBroadcast'
	| 'writeMulticast'
	| 'writeValue'
>

export type GatewayMqtt = Pick<
	MqttClient,
	| 'clientID'
	| 'close'
	| 'disabled'
	| 'getStatusTopic'
	| 'getTopic'
	| 'off'
	| 'on'
	| 'publish'
	| 'subscribe'
>

export default class Gateway<
	TZwave extends GatewayZwave = ZwaveClient,
	TMqtt extends GatewayMqtt = MqttClient,
> {
	private config: GatewayConfig
	private _mqtt: TMqtt
	private _zwave: TZwave
	private topicValues: { [key: string]: ZUIValueId } = {}
	private topicLevels: number[] = []
	private _closed = false
	private jobs: Map<string, Cron> = new Map()
	private _mqttDiscovery?: MqttDiscoveryManager
	private listenersAttached = false
	private readonly onWriteRequest = this._onWriteRequest.bind(this)
	private readonly onBroadRequest = this._onBroadRequest.bind(this)
	private readonly onMulticastRequest = this._onMulticastRequest.bind(this)
	private readonly onApiRequest: MqttClientEventCallbacks['apiCall'] = (
		topic,
		apiName,
		payload,
	) => void this._onApiRequest(topic, apiName as AllowedApis, payload)
	private readonly onNodeInited = this._onNodeInited.bind(this)
	private readonly onDriverStatus = this._onDriverStatus.bind(this)
	private readonly onNodeStatus = this._onNodeStatus.bind(this)
	private readonly onNodeLastActive = this._onNodeLastActive.bind(this)
	private readonly onValueChanged = this._onValueChanged.bind(this)
	private readonly onNodeRemoved = this._onNodeRemoved.bind(this)
	private readonly onNotification = this._onNotification.bind(this)
	private readonly onEvent = this._onEvent.bind(this)

	public get mqtt() {
		return this._mqtt
	}

	public get zwave() {
		return this._zwave
	}

	/**
	 * The lifecycle-managed Home Assistant MQTT discovery subsystem this gateway
	 * owns. In production the `AppRuntime`-owned `HomeAssistantManager`
	 * constructs the manager (via {@link buildDiscoveryOptions}) and adopts it
	 * through {@link adoptDiscoveryManager} before the gateway starts; a gateway
	 * constructed directly lazily builds its own fallback here on first access.
	 * Exposed so the `HomeAssistantManager` can resolve the current discovery
	 * manager across restarts.
	 */
	public get mqttDiscovery(): MqttDiscoveryManager {
		if (!this._mqttDiscovery) {
			this._mqttDiscovery = new MqttDiscoveryManager(
				this.buildDiscoveryOptions(),
			)
		}
		return this._mqttDiscovery
	}

	/**
	 * Adopt the HA-owned discovery manager, before the gateway starts, so the
	 * discovery facades and `start()` below drive the manager the coordinator
	 * owns. Idempotent per generation.
	 */
	public adoptDiscoveryManager(manager: MqttDiscoveryManager): void {
		this._mqttDiscovery = manager
	}

	public get closed() {
		return this._closed
	}

	private get mqttEnabled() {
		return this.mqtt && !this.mqtt.disabled
	}

	constructor(
		config: GatewayConfig,
		zwave: TZwave,
		mqtt: TMqtt,
		customDeviceRegistry: HassDeviceRegistryLifecyclePort,
	) {
		this.config = config || { type: 1 }
		// clients
		this._mqtt = mqtt
		this._zwave = zwave
	}

	/**
	 * Build the {@link MqttDiscoveryManagerOptions} that wire a discovery
	 * manager to this gateway's live clients. Public so the HA-owned
	 * `HomeAssistantManager` can construct the manager it owns, and reused to
	 * lazily build the standalone fallback in {@link mqttDiscovery}. The ports
	 * adapt the live clients so the manager never binds to a concrete client.
	 */
	public buildDiscoveryOptions(): MqttDiscoveryManagerOptions {
		const getMqtt = () => this._mqtt
		const getZwave = () => this._zwave
		return {
			config: this.config,
			mqtt: {
				get disabled() {
					const client = getMqtt()
					return !client || client.disabled
				},
				getTopic: (topic, set) => getMqtt().getTopic(topic, set),
				getStatusTopic: () => getMqtt().getStatusTopic(),
				publish: (topic, payload, options, prefix) =>
					getMqtt().publish(topic, payload, options, prefix),
			},
			zwave: {
				get homeHex() {
					return getZwave().homeHex
				},
				getNode: (nodeId) => getZwave().nodes.get(nodeId),
				getNodes: () => getZwave().nodes,
				updateDevice: (device, nodeId, deleteDevice) =>
					getZwave().updateDevice(device, nodeId, deleteDevice),
				emitNodeUpdate: (nodeId, hassDevices) => {
					const node = getZwave().nodes.get(nodeId)
					if (node) getZwave().emitNodeUpdate(node, { hassDevices })
				},
				writeCoverStop: async (value) => {
					await getZwave().writeValue(
						{
							...value,
							property: 'Up',
						},
						false,
					)
				},
			},
			topics: {
				nodeTopic: (node) => this.nodeTopic(node),
				valueTopic: (node, value, returnObject) =>
					this.valueTopic(node, value, returnObject),
			},
			registrySource: defaultCustomDeviceRegistry,
			logger,
		}
	}

	// Discovery facades kept on the Gateway that delegate to the owned manager
	private get discoveryGenerator(): DiscoveryGenerator {
		return this.mqttDiscovery.discoveryGenerator
	}

	private get customDeviceRegistry(): CustomDeviceRegistry {
		return this.mqttDiscovery.customDeviceRegistry
	}

	private get discovered(): { [key: string]: HassDevice } {
		return this.mqttDiscovery.discovered
	}

	private set discovered(value: { [key: string]: HassDevice }) {
		this.mqttDiscovery.discovered = value
	}

	async start(): Promise<void> {
		this.mqttDiscovery.start(this._mqtt, this.mqttEnabled)
		// gateway configuration
		this.config.values = this.config.values || []

		// Object where keys are topic and values can be both zwave valueId object
		// or a valueConf if the topic is a broadcast topic
		this.topicValues = {}

		this._closed = false

		// topic levels for subscribes using wildecards
		this.topicLevels = []

		this.attachListeners()
		if (this._zwave) {
			// this is async but doesn't need to be awaited
			try {
				await this._zwave.connect()
			} catch (error) {
				this.detachListeners()
				this.mqttDiscovery.stop()
				throw error
			}
		} else {
			logger.error('Z-Wave settings are not valid')
		}
	}

	/**
	 * Schedule a job
	 */
	scheduleJob(jobConfig: ScheduledJob) {
		if (jobConfig.enabled) {
			if (jobConfig.runOnInit) {
				this.runJob(jobConfig).catch((error) => {
					logger.error(
						`Error while executing scheduled job "${jobConfig.name}": ${error.message}`,
					)
				})
			}

			if (jobConfig.cron) {
				try {
					const job = new Cron(
						jobConfig.cron,
						this.runJob.bind(this, jobConfig),
					)

					if (job?.nextRun()) {
						this.jobs.set(jobConfig.name, job)
						logger.info(
							`Scheduled job "${jobConfig.name}" will run at ${job
								.nextRun()
								.toISOString()}`,
						)
					}
				} catch (error) {
					logger.error(
						`Error while scheduling job "${jobConfig.name}": ${error.message}`,
					)
				}
			}
		}
	}

	/**
	 * Executes a scheduled job
	 */
	private async runJob(jobConfig: ScheduledJob) {
		logger.info(`Executing scheduled job "${jobConfig.name}"...`)
		try {
			await this.zwave.driverFunction(jobConfig.code)
		} catch (error) {
			logger.error(
				`Error executing scheduled job "${jobConfig.name}": ${error.message}`,
			)
		}

		const job = this.jobs.get(jobConfig.name)

		if (job?.nextRun()) {
			logger.info(
				`Next scheduled job "${jobConfig.name}" will run at ${job
					.nextRun()
					.toISOString()}`,
			)
		}
	}

	/**
	 * Parse the value of the payload received from mqtt
	 * based on the type of the payload and the gateway config
	 */
	parsePayload(
		payload: any,
		valueId: ZUIValueId,
		valueConf: GatewayValue | undefined,
	) {
		try {
			payload =
				typeof payload === 'object' &&
				utils.hasProperty(payload, 'value')
					? payload.value
					: payload

			// try to parse string to bools
			if (typeof payload === 'string' && isNaN(parseInt(payload))) {
				if (/\btrue\b|\bon\b|\block\b/gi.test(payload)) payload = true
				else if (/\bfalse\b|\boff\b|\bunlock\b/gi.test(payload)) {
					payload = false
				}
			}

			// on/off becomes 100%/0%
			if (typeof payload === 'boolean' && valueId.type === 'number') {
				payload = payload ? 0xff : valueId.min
			}

			// 1/0 becomes true/false
			if (typeof payload === 'number' && valueId.type === 'boolean') {
				payload = payload > 0
			}

			if (
				valueId.commandClass === CommandClasses['Binary Toggle Switch']
			) {
				payload = 1
			} else if (
				valueId.commandClass ===
				CommandClasses['Multilevel Toggle Switch']
			) {
				payload = valueId.value > 0 ? 0 : 0xff
			}

			payload = this.discoveryGenerator.transformPayload(payload, valueId)
			if (payload === null) return null

			if (valueConf) {
				if (utils.isValidOperation(valueConf.postOperation)) {
					let op = valueConf.postOperation

					// revert operation to write
					if (op.includes('/')) op = op.replace(/\//, '*')
					else if (op.includes('*')) op = op.replace(/\*/g, '/')
					else if (op.includes('+')) op = op.replace(/\+/, '-')
					else if (op.includes('-')) op = op.replace(/-/, '+')

					payload = utils.applyOperation(payload, op)
				}

				if (valueConf.parseReceive) {
					const node = this._zwave.nodes.get(valueId.nodeId)
					const parsedVal = this._evalFunction(
						valueConf.receiveFunction,
						valueId,
						payload,
						node,
					)
					if (parsedVal != null) {
						payload = parsedVal
					}
				}
			}
		} catch (error) {
			logger.error(
				`Error while parsing payload ${payload} for valueID ${valueId.id}`,
			)
		}

		return payload
	}

	/**
	 * Method used to cancel all scheduled jobs
	 */
	cancelJobs() {
		// cancel jobs
		for (const [, job] of this.jobs) {
			job.stop()
		}

		this.jobs.clear()
	}

	/**
	 * Method used to close clients connection, use this before destroy
	 */
	async close(): Promise<void> {
		this._closed = true

		logger.info('Closing Gateway...')

		try {
			if (this._zwave) {
				await this._zwave.close()
			}
		} finally {
			try {
				this.cancelJobs()
			} finally {
				try {
					// Stop discovery before closing MQTT so the scoped
					// `homeassistant/status` subscription unsubscribes while the
					// client is still connected, leaving a clean:false session no
					// server-side subscription, and the fence drops before teardown
					this.detachListeners()
					this.mqttDiscovery.stop()
				} finally {
					// Preserve the Z-Wave-before-MQTT shutdown contract
					if (this.mqttEnabled) {
						await this._mqtt.close()
					}
				}
			}
		}
	}

	private attachListeners(): void {
		if (this.listenersAttached) return

		if (this.mqttEnabled) {
			this._mqtt.on('writeRequest', this.onWriteRequest)
			this._mqtt.on('broadcastRequest', this.onBroadRequest)
			this._mqtt.on('multicastRequest', this.onMulticastRequest)
			this._mqtt.on('apiCall', this.onApiRequest)
		}

		if (this._zwave) {
			this._zwave.on('nodeInited', this.onNodeInited)
			this._zwave.on('driverStatus', this.onDriverStatus)

			if (this.mqttEnabled) {
				this._zwave.on('nodeStatus', this.onNodeStatus)
				this._zwave.on('nodeLastActive', this.onNodeLastActive)
				this._zwave.on('valueChanged', this.onValueChanged)
				this._zwave.on('nodeRemoved', this.onNodeRemoved)
				this._zwave.on('notification', this.onNotification)
				if (this.config.sendEvents) {
					this._zwave.on('event', this.onEvent)
				}
			}
		}

		this.listenersAttached = true
	}

	private detachListeners(): void {
		if (!this.listenersAttached) return

		if (this._mqtt) {
			this._mqtt.off('writeRequest', this.onWriteRequest)
			this._mqtt.off('broadcastRequest', this.onBroadRequest)
			this._mqtt.off('multicastRequest', this.onMulticastRequest)
			this._mqtt.off('apiCall', this.onApiRequest)
		}

		if (this._zwave) {
			this._zwave.off('nodeInited', this.onNodeInited)
			this._zwave.off('driverStatus', this.onDriverStatus)
			this._zwave.off('nodeStatus', this.onNodeStatus)
			this._zwave.off('nodeLastActive', this.onNodeLastActive)
			this._zwave.off('valueChanged', this.onValueChanged)
			this._zwave.off('nodeRemoved', this.onNodeRemoved)
			this._zwave.off('notification', this.onNotification)
			this._zwave.off('event', this.onEvent)
		}

		this.listenersAttached = false
	}

	/**
	 * Calculates the node topic based on gateway settings
	 */
	nodeTopic(node: HassTopicNode): string {
		const topic = []

		if (node.loc && !this.config.ignoreLoc) topic.push(node.loc)

		switch (this.config.type) {
			case GATEWAY_TYPE.MANUAL:
			case GATEWAY_TYPE.NAMED:
				topic.push(node.name ? node.name : NODE_PREFIX + node.id)
				break
			case GATEWAY_TYPE.VALUEID:
				if (!this.config.nodeNames) {
					topic.push(node.id)
				} else {
					topic.push(node.name ? node.name : NODE_PREFIX + node.id)
				}
				break
			default:
				topic.push(NODE_PREFIX + node.id)
		}

		// clean topic parts
		for (let i = 0; i < topic.length; i++) {
			topic[i] = utils.sanitizeTopic(topic[i])
		}

		return topic.join('/')
	}

	/**
	 * Calculates the valueId topic based on gateway settings
	 *
	 */
	valueTopic(
		node: HassTopicNode,
		valueId: HassValue,
		returnObject = false,
	): string | HassValueTopic | null {
		const topic = []
		let valueConf: GatewayValue

		// check if this value is in configuration values array
		const values = this.config.values.filter(
			(v: GatewayValue) => v.device === node.deviceId,
		)
		if (values && values.length > 0) {
			const vID = this._getIdWithoutNode(valueId)
			valueConf = values.find((v: GatewayValue) => v.value.id === vID)
		}

		if (valueConf && valueConf.topic) {
			topic.push(node.name ? node.name : NODE_PREFIX + valueId.nodeId)
			topic.push(valueConf.topic)
		}

		let targetTopic: string

		if (returnObject && valueId.targetValue) {
			const targetValue = node.values?.[valueId.targetValue]
			if (targetValue) {
				targetTopic = this.valueTopic(
					node,
					targetValue,
					false,
				) as string
			}
		}

		// if is not in configuration values array get the topic
		// based on gateway type if manual type this will be skipped
		if (topic.length === 0) {
			switch (this.config.type) {
				case GATEWAY_TYPE.NAMED:
					topic.push(
						node.name ? node.name : NODE_PREFIX + valueId.nodeId,
					)
					topic.push(Constants.commandClass(valueId.commandClass))

					topic.push('endpoint_' + (valueId.endpoint || 0))

					topic.push(utils.removeSlash(valueId.propertyName))
					if (valueId.propertyKey !== undefined) {
						topic.push(utils.removeSlash(valueId.propertyKey))
					}
					break
				case GATEWAY_TYPE.VALUEID:
					if (!this.config.nodeNames) {
						topic.push(valueId.nodeId)
					} else {
						topic.push(
							node.name
								? node.name
								: NODE_PREFIX + valueId.nodeId,
						)
					}
					topic.push(valueId.commandClass)
					topic.push(valueId.endpoint || '0')
					topic.push(utils.removeSlash(valueId.property))
					if (valueId.propertyKey !== undefined) {
						topic.push(utils.removeSlash(valueId.propertyKey))
					}
					break
			}
		}

		// if there is a valid topic for this value publish it
		if (topic.length > 0) {
			// add location prefix
			if (node.loc && !this.config.ignoreLoc) topic.unshift(node.loc)

			// clean topic parts
			for (let i = 0; i < topic.length; i++) {
				topic[i] = utils.sanitizeTopic(topic[i])
			}

			const toReturn = {
				topic: topic.join('/'),
				valueConf: valueConf,
				targetTopic: targetTopic,
			}

			return returnObject ? toReturn : toReturn.topic
		} else {
			return null
		}
	}

	/**
	 * Rediscover all hass devices of this node
	 */
	rediscoverNode(nodeID: number): void {
		const node = this._zwave.nodes.get(nodeID)
		if (node && !node.virtual) {
			for (const topic of Object.keys(this.topicValues)) {
				if (this.topicValues[topic].nodeId === nodeID) {
					delete this.topicValues[topic]
				}
			}
		}
		this.discoveryGenerator.rediscoverNode(nodeID)
	}

	disableDiscovery(nodeId: number): void {
		this.discoveryGenerator.disableDiscovery(nodeId)
	}

	publishDiscovery(
		hassDevice: HassDevice,
		nodeId: number,
		options: { deleteDevice?: boolean; forceUpdate?: boolean } = {},
	): void {
		this.discoveryGenerator.publishDiscovery(hassDevice, nodeId, options)
	}

	setDiscovery(
		nodeId: number,
		hassDevice: HassDevice,
		deleteDevice = false,
	): void {
		this.discoveryGenerator.setDiscovery(nodeId, hassDevice, deleteDevice)
	}

	rediscoverAll(): void {
		this.discoveryGenerator.rediscoverAll()
	}

	discoverDevice(node: ZUINode, device: HassDevice): void {
		if (isHassNode(node)) {
			this.discoveryGenerator.discoverDevice(node, device)
		}
	}

	discoverClimates(node: ZUINode): void {
		if (isHassNode(node)) {
			this.discoveryGenerator.discoverClimates(node)
		}
	}

	discoverValue(node: ZUINode, valueIdKey: string): void {
		if (isHassNode(node)) {
			this.discoveryGenerator.discoverValue(node, valueIdKey)
		}
	}

	updateNodeTopics(nodeId: number): void {
		const node = this._zwave.nodes.get(nodeId)
		if (!node) return

		const topics = Object.keys(this.topicValues).filter(
			(topic) => this.topicValues[topic].nodeId === node.id,
		)
		for (const topic of topics) {
			const valueId = this.topicValues[topic]
			delete this.topicValues[topic]
			const updatedTopic = this.valueTopic(node, valueId) as string
			this.topicValues[updatedTopic] = valueId
		}
	}

	removeNodeRetained(nodeId: number): void {
		if (!this.mqttEnabled) {
			logger.info('Enable MQTT gateway to use this function')
			return
		}

		const node = this._zwave.nodes.get(nodeId)
		if (!node) return
		const topics = Object.values(node.values).map(
			(value) => this.valueTopic(node, value) as string,
		)
		for (const topic of topics) {
			this._mqtt.publish(topic, '', { retain: true })
		}
	}

	private _onEvent(
		emitter: EventSource,
		eventName: string,
		...args: any[]
	): void {
		const topic = `${MqttClient.EVENTS_PREFIX}/${
			this._mqtt.clientID
		}/${emitter}/${eventName.replace(/\s/g, '_')}`

		this._mqtt.publish(topic, { data: args }, { qos: 1, retain: false })
	}

	/**
	 * Z-Wave event triggered when a node is removed
	 */
	private _onNodeRemoved(node: Partial<ZUINode>): void {
		if (node.id !== undefined) {
			this.discoveryGenerator.removeNode({ id: node.id })
		}

		// clean topicValues
		for (const topic in this.topicValues) {
			if (this.topicValues[topic].nodeId === node.id) {
				delete this.topicValues[topic]
			}
		}
	}

	/**
	 * Triggered when a value change is detected in Z-Wave Network
	 */
	private _onValueChanged(
		valueId: ZUIValueId,
		node: ZUINode,
		changed?: boolean,
	): void {
		if (isHassNode(node)) {
			this.discoveryGenerator.discoverValueIfNeeded(node, valueId)
		}

		const result = this.valueTopic(node, valueId, true) as ValueIdTopic

		if (!result) {
			if (this.config.type !== GATEWAY_TYPE.MANUAL) {
				// if config is manual it is normal that some values are not mapped
				logger.debug(`No topic found for value ${valueId.id}`)
			}

			return
		}

		// if there is a valid topic for this value publish it

		const topic = result.topic
		const valueConf = result.valueConf
		// Parse valueId value and create the payload
		let tmpVal = valueId.value

		if (valueConf) {
			if (utils.isValidOperation(valueConf.postOperation)) {
				tmpVal = utils.applyOperation(
					valueId.value,
					valueConf.postOperation,
				)
			}

			if (valueConf.parseSend) {
				const parsedVal = this._evalFunction(
					valueConf.sendFunction,
					valueId,
					tmpVal,
					node,
				)
				if (parsedVal != null) {
					tmpVal = parsedVal
				}
			}
		}

		if (isHassNode(node)) {
			this.discoveryGenerator.updateClimateDiscovery(
				valueId,
				node,
				changed ?? false,
			)
		}

		let data: Record<string, any>

		switch (this.config.payloadType) {
			case PayloadType.VALUEID:
				data = utils.copy(valueId)
				data.value = tmpVal

				break
			case PayloadType.RAW:
				data = tmpVal
				break
			default:
				data = { time: valueId.lastUpdate, value: tmpVal }
		}

		if (this.config.includeNodeInfo && typeof data === 'object') {
			data.nodeName = node.name
			data.nodeLocation = node.loc
		}

		const shouldSubscribe = valueId.writeable || valueId.targetValue

		// valueId is writeable or it has a target value, subscribe for updates
		if (shouldSubscribe && !this.topicValues[topic]) {
			const levels = topic.split('/').length

			logger.debug(`Subscribing to updates of ${valueId.id}`)

			if (this.topicLevels.indexOf(levels) < 0) {
				this.topicLevels.push(levels)
				this._mqtt
					.subscribe('+'.repeat(levels).split('').join('/'))
					.catch(() => {
						// ignore, handled by mqtt client
					})
			}

			// I need to add the conf to the valueId but I don't want to edit
			// original valueId object so I create a copy
			if (valueConf) {
				valueId = utils.copy(valueId)
				valueId.conf = valueConf
			}

			// handle the case the conf is set on current value but not in target value
			if (valueId.targetValue && node.values[valueId.targetValue]) {
				const targetValueId = utils.copy(
					node.values[valueId.targetValue],
				)
				targetValueId.conf = valueConf
				this.topicValues[topic] = targetValueId
			} else {
				this.topicValues[topic] = valueId
			}
		}

		let mqttOptions: IClientPublishOptions = valueId.stateless
			? { retain: false }
			: null

		if (valueConf) {
			mqttOptions = mqttOptions || {}

			if (valueConf.qos !== undefined) {
				mqttOptions.qos = valueConf.qos
			}

			if (valueConf.retain !== undefined) {
				mqttOptions.retain = valueConf.retain
			}
		}

		const isFromCache = !node.ready

		// prevent to send cached values if them are stateless
		if (isFromCache && valueId.stateless) {
			logger.debug(
				`Skipping send of stateless value ${valueId.id}: it's from cache`,
			)
		} else {
			this._mqtt.publish(topic, data, mqttOptions)
		}
	}

	/**
	 * Triggered when a notification is received from a node in Z-Wave Client
	 */
	private _onNotification(
		node: ZUINode,
		valueId: ZUIValueId,
		data: Record<string, any>,
	): void {
		const topic = this.valueTopic(node, valueId) as string

		if (this.config.payloadType !== PayloadType.RAW) {
			data = { time: Date.now(), value: data }
		}

		this._mqtt.publish(topic, data, { retain: false })
	}

	private _onNodeInited(node: ZUINode): void {
		// Virtual nodes (broadcast/multicast) don't need polling or HA discovery
		if (node.virtual) return

		// enable poll if required
		const values =
			this.config.values?.filter(
				(v: GatewayValue) => v.enablePoll && v.device === node.deviceId,
			) ?? []
		for (let i = 0; i < values.length; i++) {
			// don't edit the original object, copy it
			const valueId = utils.copy(values[i].value)
			valueId.nodeId = node.id
			valueId.id = node.id + '-' + valueId.id

			try {
				this._zwave.setPollInterval(valueId, values[i].pollInterval)
			} catch (error) {
				logger.error(
					`Error while enabling poll interval: ${error.message}`,
				)
			}
		}

		if (isHassNode(node)) this.discoveryGenerator.onNodeInited(node)
	}

	/**
	 * When there is a node status update
	 *
	 */
	private _onNodeStatus(node: ZUINode): void {
		if (!this.mqttEnabled) {
			return
		}

		const nodeTopic = this.nodeTopic(node)

		if (!this.config.ignoreStatus) {
			let data: any

			if (this.config.payloadType === PayloadType.RAW) {
				data = node.available
			} else {
				data = {
					time: Date.now(),
					value: node.available,
					status: node.status,
					nodeId: node.id,
				}
			}

			this._mqtt.publish(nodeTopic + '/status', data)
		}

		// Publish Node Info on separate topic
		// remove bulky  data like hassDevices, Groups and values
		if (this.config.publishNodeDetails) {
			const nodeData = utils.copy(node)
			delete nodeData.groups
			delete nodeData.hassDevices
			delete nodeData.values

			this._mqtt.publish(nodeTopic + '/nodeinfo', nodeData)
		}
	}

	/**
	 * When a packet is received from a node to update it's last activity timestamp
	 *
	 */
	private _onNodeLastActive(node: ZUINode): void {
		if (!this.mqttEnabled) {
			return
		}

		const nodeTopic = this.nodeTopic(node)

		if (!this.config.ignoreStatus) {
			let data: any

			if (this.config.payloadType === PayloadType.RAW) {
				data = node.lastActive
			} else {
				data = {
					time: Date.now(),
					value: node.lastActive,
				}
			}

			this._mqtt.publish(nodeTopic + '/lastActive', data)
		}
	}

	/**
	 * Driver status updates
	 */
	private _onDriverStatus(ready: boolean): void {
		logger.info(`Driver is ${ready ? 'READY' : 'CLOSED'}`)

		this.cancelJobs()

		if (ready) {
			if (this.config.jobs?.length > 0) {
				for (const jobConfig of this.config.jobs) {
					this.scheduleJob(jobConfig)
				}
			}
		}

		if (this.mqttEnabled) {
			this._mqtt.publish('driver/status', ready)
		}
	}

	/**
	 * Handle api requests reeceived from MQTT client
	 *
	 */
	private async _onApiRequest(
		topic: string,
		apiName: AllowedApis,
		payload: { args: Parameters<ZwaveClient[AllowedApis]> },
	): Promise<void> {
		if (this._zwave) {
			const args = payload.args || []

			let result: CallAPIResult<AllowedApis> & { origin?: any }

			if (Array.isArray(args)) {
				result = await this._zwave.callApi(apiName, ...args)
				result.origin = payload
			} else {
				result = {
					success: false,
					message: 'Args must be an array',
					origin: payload,
				}
			}
			this._mqtt.publish(topic, result, { retain: false })
		} else {
			logger.error(`Requested Z-Wave api ${apiName} doesn't exist`)
		}
	}

	/**
	 * Handle broadcast request received from Mqtt client
	 */
	private async _onBroadRequest(
		parts: string[],
		payload: ValueID & { value: unknown; options?: SetValueAPIOptions },
	): Promise<void> {
		if (parts.length > 0) {
			// multiple writes (back compatibility mode)
			const topic = parts.join('/')
			const values = Object.keys(this.topicValues).filter((t) =>
				t.endsWith(topic),
			)
			if (values.length > 0) {
				// all values are the same type just different node,parse the Payload by using the first one
				payload = this.parsePayload(
					payload,
					this.topicValues[values[0]],
					this.topicValues[values[0]].conf,
				)

				if (payload === null) {
					return
				}

				for (let i = 0; i < values.length; i++) {
					await this._zwave.writeValue(
						this.topicValues[values[i]],
						payload,
						payload?.options,
					)
				}
			}
		} else {
			// try real zwave broadcast
			if (payload.value === undefined) {
				logger.error('No value found in broadcast request')
				return
			}

			const error = utils.isValueId(payload)

			if (typeof error === 'string') {
				logger.error('Invalid valueId: ' + error)
				return
			}
			await this._zwave.writeBroadcast(
				payload,
				payload.value,
				payload.options,
			)
		}
	}

	/**
	 * Handle write request received from Mqtt Client
	 *
	 */
	private async _onWriteRequest(
		parts: string[],
		payload: any,
	): Promise<void> {
		const valueTopic = parts.join('/')
		const valueId = this.topicValues[valueTopic]

		if (valueId) {
			const value = this.parsePayload(payload, valueId, valueId.conf)

			if (value === null) {
				return
			}

			await this._zwave.writeValue(valueId, value, payload?.options)
		} else {
			logger.debug(`No writeable valueId found for ${valueTopic}`)
		}
	}

	private async _onMulticastRequest(
		payload: ZUIValueId & {
			nodes: number[]
			value: any
			options?: SetValueAPIOptions
		},
	): Promise<void> {
		const nodes = payload.nodes
		const valueId: ValueID = {
			commandClass: payload.commandClass,
			property: payload.property,
			propertyKey: payload.propertyKey,
			endpoint: payload.endpoint,
		}
		const value = payload.value

		if (!nodes || nodes.length === 0) {
			logger.error('No nodes found in multicast request')
			return
		}

		const error = utils.isValueId(valueId)

		if (typeof error === 'string') {
			logger.error('Invalid valueId: ' + error)
			return
		}

		if (payload.value === undefined) {
			logger.error('No value found in multicast request')
			return
		}

		await this._zwave.writeMulticast(
			nodes,
			valueId as ZUIValueId,
			value,
			payload.options,
		)
	}

	/**
	 * Evaluate the return value of a custom parse Function
	 *
	 */
	private _evalFunction(
		code: string,
		valueId: ZUIValueId,
		value: unknown,
		node: ZUINode,
	) {
		let result = null

		try {
			const parseFunc = new Function(
				'value',
				'valueId',
				'node',
				'logger',
				code,
			)
			result = parseFunc(value, valueId, node, logger)
		} catch (error) {
			logger.error(
				`Error eval function of value ${valueId.id} ${error.message}`,
			)
		}

		return result
	}

	/**
	 * Get node name from node object
	 */
	private _getIdWithoutNode(valueId: HassValue): string {
		return valueId.id.replace(valueId.nodeId + '-', '')
	}
}
