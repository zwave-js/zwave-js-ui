import * as utils from './utils.ts'
import type { SetValueAPIOptions } from 'zwave-js'
import type { ValueID } from '@zwave-js/core'
import { CommandClasses } from '@zwave-js/core'
import * as Constants from './Constants.ts'
import type { LogLevel } from './logger.ts'
import { module } from './logger.ts'
import { getIdWithoutNode, PayloadType } from './shared.ts'
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

import {
	HASS_COMMAND_HANDLED,
	type DiscoveryGenerator,
} from '../hass/DiscoveryGenerator.ts'
import MqttDiscoveryManager from '../hass/MqttDiscoveryManager.ts'
import { HASS_NODE_PREFIX, type HassDevice } from '../hass/types.ts'
import type {
	HassDeviceRegistrySourcePort,
	HassNode,
	HassTopicNode,
	HassValue,
	HassValueTopic,
} from '../hass/ports.ts'
import { ensureHassNode } from '../hass/ports.ts'

const logger = module('Gateway')
const hassLogger = module('HASS')

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
	ccConfigEnableDiscovery?: boolean | null
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
	ccConfigEnabledByDefault?: boolean
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
	/** Enable HTTPS for the web server (see `startServer` in `app.ts`). */
	https?: boolean
}

interface ValueIdTopic {
	topic: string
	valueConf: GatewayValue
	targetTopic?: string
}

type ParsedPayloadResult =
	| { handled: true; value: null }
	| { handled: false; value: any }

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
	| 'subscribeExact'
> & {
	// The discovery manager emits `hassStatus` through this client, so the port
	// exposes only that event instead of the full typed emitter
	emit(event: 'hassStatus', online: boolean): boolean
}
export default class Gateway<
	TZwave extends GatewayZwave = ZwaveClient,
	TMqtt extends GatewayMqtt = MqttClient,
> {
	private config: GatewayConfig
	private _mqtt?: TMqtt
	private _zwave?: TZwave
	private topicValues: { [key: string]: ZUIValueId } = {}
	private topicLevels: number[] = []
	private _closed = false
	private jobs: Map<string, Cron> = new Map()
	private readonly _mqttDiscovery: MqttDiscoveryManager
	private readonly customDeviceRegistrySource: HassDeviceRegistrySourcePort
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

	public get closed() {
		return this._closed
	}

	private get mqttEnabled() {
		return this.mqtt && !this.mqtt.disabled
	}

	constructor(
		config: GatewayConfig,
		zwave: TZwave | undefined,
		mqtt: TMqtt | undefined,
		customDeviceRegistry: HassDeviceRegistrySourcePort,
	) {
		this.config = config || { type: 1 }
		// clients
		this._mqtt = mqtt
		this._zwave = zwave
		this.customDeviceRegistrySource = customDeviceRegistry
		// The ports adapt the live clients, so the manager never binds to a
		// concrete client
		this._mqttDiscovery = new MqttDiscoveryManager({
			config: this.config,
			mqtt: this._mqtt,
			zwave: this._zwave,
			nodeUpdates: {
				emitNodeUpdate: (nodeId, hassDevices) => {
					const node = this.zwave.nodes.get(nodeId)
					if (node) this.zwave.emitNodeUpdate(node, { hassDevices })
				},
			},
			topics: {
				nodeTopic: (node) => this.nodeTopic(node),
				valueTopic: (node, value, returnObject) =>
					this.valueTopic(node, value, returnObject),
			},
			registrySource: this.customDeviceRegistrySource,
			logger: hassLogger,
		})
	}

	// Discovery facade kept on the Gateway that delegates to the owned manager
	private get discoveryGenerator(): DiscoveryGenerator {
		return this._mqttDiscovery.discoveryGenerator
	}

	async start(): Promise<void> {
		this._mqttDiscovery.start(this._mqtt, this.mqttEnabled)
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
				this._mqttDiscovery.stop()
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
		const result = this.parsePayloadResult(payload, valueId, valueConf)
		return result.handled ? null : result.value
	}

	private parsePayloadResult(
		payload: any,
		valueId: ZUIValueId,
		valueConf: GatewayValue | undefined,
	): ParsedPayloadResult {
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

<<<<<<< b8699475b929694dc42a654d72674bb20cca44da
			payload = this.discoveryGenerator.transformPayload(payload, valueId)
			if (payload === HASS_COMMAND_HANDLED) {
				return { handled: true, value: null }
=======
			const hassDevice = this.discovered[valueId.id]

			// Hass payload parsing
			if (hassDevice) {
				// map modes coming from hass
				if (valueId.list && isNaN(parseInt(payload))) {
					// for thermostat_fan_mode command class use the fan_mode_map
					if (
						valueId.commandClass ===
							CommandClasses['Thermostat Fan Mode'] &&
						hassDevice.fan_mode_map
					) {
						payload = hassDevice.fan_mode_map[payload]
					} else if (
						valueId.commandClass ===
							CommandClasses['Thermostat Mode'] &&
						hassDevice.mode_map
					) {
						// for other command classes use the mode_map
						payload = hassDevice.mode_map[payload]
					}
				} else if (
					hassDevice.type === 'cover' &&
					valueId.property === 'targetValue'
				) {
					// ref issue https://github.com/zwave-js/zwave-js-ui/issues/3862
					if (
						payload ===
						(hassDevice.discovery_payload.payload_stop ?? 'STOP')
					) {
						// the value used to stop an ongoing level change
						// depends on the command class
						const stopProperty =
							valueId.commandClass ===
							CommandClasses['Window Covering']
								? 'levelChangeUp'
								: 'Up'

						this._zwave
							.writeValue(
								{
									...valueId,
									property: stopProperty,
								},
								false,
							)
							.catch(() => {})
						return null
					}
				}
>>>>>>> 6098666744eb3d4de6c859b61168568bc61a4727
			}

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

		return { handled: false, value: payload }
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

		// Every step runs even if an earlier one throws, so the first error is
		// reported without any cleanup being skipped
		const errors: unknown[] = []
		const step = async (
			label: string,
			fn: () => void | Promise<void>,
		): Promise<void> => {
			try {
				await fn()
			} catch (error) {
				errors.push(error)
				logger.error(`Error while closing Gateway (${label})`, error)
			}
		}

		// Stop discovery before the Z-Wave client: it drops the publication fence
		// synchronously, so no late `nodeRemoved`/`valueChanged` publishes retained
		// discovery, and the `homeassistant/status` unsubscribe reaches the broker
		// even if the driver teardown below hangs
		await step('discovery', () => this._mqttDiscovery.stop())
		await step('zwave', () => this._zwave?.close())
		await step('jobs', () => this.cancelJobs())
		await step('listeners', () => this.detachListeners())
		// Preserve the Z-Wave-before-MQTT shutdown contract
		if (this.mqttEnabled) {
			await step('mqtt', () => this._mqtt.close())
		}

		// Report the first failure, but raise the completion line above info and
		// carry the count, so a real teardown failure is not lost when grepping
		// for errors
		if (errors.length > 0) {
			logger.warn(`Gateway closed with ${errors.length} error(s)`)
			throw errors[0]
		}
		logger.info('Gateway closed')
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
				topic.push(node.name ? node.name : HASS_NODE_PREFIX + node.id)
				break
			case GATEWAY_TYPE.VALUEID:
				if (!this.config.nodeNames) {
					topic.push(node.id)
				} else {
					topic.push(
						node.name ? node.name : HASS_NODE_PREFIX + node.id,
					)
				}
				break
			default:
				topic.push(HASS_NODE_PREFIX + node.id)
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
			const vID = getIdWithoutNode(valueId)
			valueConf = values.find((v: GatewayValue) => v.value.id === vID)
		}

		if (valueConf && valueConf.topic) {
			topic.push(
				node.name ? node.name : HASS_NODE_PREFIX + valueId.nodeId,
			)
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
						node.name
							? node.name
							: HASS_NODE_PREFIX + valueId.nodeId,
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
								: HASS_NODE_PREFIX + valueId.nodeId,
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
<<<<<<< b8699475b929694dc42a654d72674bb20cca44da
		this.discoveryGenerator.publishDiscovery(hassDevice, nodeId, options)
=======
		try {
			if (!this.mqttEnabled || !this.config.hassDiscovery) {
				logger.debug(
					'Enable MQTT gateway and hass discovery to use this function',
				)
				return
			}

			logger.log(
				'debug',
				`${
					options.deleteDevice ? 'Removing' : 'Publishing'
				} discovery: %o`,
				hassDevice,
			)

			this.setDiscovery(nodeId, hassDevice, options.deleteDevice)

			if (this.config.payloadType === PAYLOAD_TYPE.RAW) {
				const p = hassDevice.discovery_payload
				const template =
					'value' +
					(utils.hasProperty(p, 'payload_on') &&
					utils.hasProperty(p, 'payload_off')
						? " == 'true'"
						: '')

				for (const k in p) {
					if (typeof p[k] === 'string') {
						p[k] = p[k].replace(/value_json\.value/g, template)
					}
				}
			}

			const skipDiscovery =
				hassDevice.ignoreDiscovery ||
				(this.config.manualDiscovery && !options.forceUpdate)

			if (!skipDiscovery) {
				const discoveryOptions = {
					qos: 0 as const,
					retain: this.config.retainedDiscovery || false,
				}
				if (options.deleteDevice) {
					// always retained, to also clear configs retained by an earlier setting
					this._mqtt.publishEmpty(
						hassDevice.discoveryTopic,
						{ ...discoveryOptions, retain: true },
						this.config.discoveryPrefix,
					)
				} else {
					this._mqtt.publish(
						hassDevice.discoveryTopic,
						hassDevice.discovery_payload,
						discoveryOptions,
						this.config.discoveryPrefix,
					)
				}
			}

			if (options.forceUpdate) {
				this._zwave.updateDevice(
					hassDevice,
					nodeId,
					options.deleteDevice,
				)
			}
		} catch (error) {
			logger.log(
				'error',
				`Error while publishing discovery for node ${nodeId}: ${error.message}. Hass device: %o`,
				hassDevice,
			)
		}
>>>>>>> 6098666744eb3d4de6c859b61168568bc61a4727
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
		ensureHassNode(node)
		this.discoveryGenerator.discoverDevice(node, device)
	}

	discoverClimates(node: ZUINode): void {
		ensureHassNode(node)
		this.discoveryGenerator.discoverClimates(node)
	}

<<<<<<< b8699475b929694dc42a654d72674bb20cca44da
	discoverValue(node: ZUINode, valueIdKey: string): void {
		ensureHassNode(node)
		this.discoveryGenerator.discoverValue(node, valueIdKey)
=======
	/**
	 * Try to guess the best way to discover this valueId in Hass
	 */
	discoverValue(node: ZUINode, vId: string): void {
		if (!this.mqttEnabled || !this.config.hassDiscovery) {
			logger.debug(
				'Enable MQTT gateway and hass discovery to use this function',
			)
			return
		}

		// Virtual nodes don't have deviceClass/endpoints needed for discovery
		if (node.virtual) return

		const valueId = node.values[vId]

		// if the node is not ready means we don't have all values added yet so we are not sure to discover this value properly
		if (!valueId || this.discovered[valueId.id] || !node.ready) return

		try {
			const result = this.valueTopic(node, valueId, true) as ValueIdTopic

			if (!result || !result.topic) return

			const valueConf = result.valueConf

			const getTopic = this._mqtt.getTopic(result.topic)
			const setTopic = result.targetTopic
				? this._mqtt.getTopic(result.targetTopic, true)
				: null

			const nodeName = this._getNodeName(node, this.config.ignoreLoc)

			let cfg: HassDevice

			const cmdClass = valueId.commandClass

			const deviceClass =
				node.endpoints[valueId.endpoint]?.deviceClass ??
				node.deviceClass

			switch (cmdClass) {
				case CommandClasses['Binary Switch']:
				case CommandClasses['All Switch']:
				case CommandClasses['Binary Toggle Switch']:
					if (valueId.isCurrentValue) {
						cfg = utils.copy(hassCfg.switch)
					} else return
					break
				case CommandClasses['Barrier Operator']:
					if (valueId.isCurrentValue) {
						cfg = utils.copy(hassCfg.barrier_state)
						cfg.discovery_payload.position_topic = getTopic
					} else return
					break
				case CommandClasses['Window Covering']:
					// Values are duplicated for each supported parameter
					// (propertyKey). Only odd parameters support positioning,
					// even ones can just be moved with levelChangeUp/Down
					if (
						valueId.isCurrentValue &&
						typeof valueId.propertyKey === 'number' &&
						valueId.propertyKey % 2 !== 0
					) {
						cfg = utils.copy(hassCfg.cover_position)
						cfg.discovery_payload.command_topic = setTopic
						cfg.discovery_payload.position_topic = getTopic
						cfg.discovery_payload.set_position_topic = setTopic
						// a node can expose more than one cover, one per parameter
						cfg.object_id = utils.joinProps(
							cfg.object_id,
							valueId.propertyKeyName || valueId.propertyKey,
						)
					} else return
					break
				case CommandClasses['Multilevel Switch']:
				case CommandClasses['Multilevel Toggle Switch']:
					if (valueId.isCurrentValue) {
						const specificDeviceClass =
							Constants.specificDeviceClass(
								deviceClass.generic,
								deviceClass.specific,
							)
						// Use a cover_position configuration if ...
						if (
							[
								'specific_type_class_a_motor_control',
								'specific_type_class_b_motor_control',
								'specific_type_class_c_motor_control',
								'specific_type_class_motor_multiposition',
								'specific_type_motor_multiposition',
							].includes(specificDeviceClass) ||
							node.deviceId === '615-0-258' // Issue #3088
						) {
							cfg = utils.copy(hassCfg.cover_position)
							cfg.discovery_payload.command_topic = setTopic
							cfg.discovery_payload.position_topic = getTopic
							cfg.discovery_payload.set_position_topic =
								cfg.discovery_payload.command_topic
							cfg.discovery_payload.position_template =
								'{{ value_json.value | round(0) }}'
							cfg.discovery_payload.position_open = 99
							cfg.discovery_payload.position_closed = 0
							cfg.discovery_payload.payload_open = 99
							cfg.discovery_payload.payload_close = 0
						} else {
							cfg = utils.copy(hassCfg.light_dimmer)
							cfg.discovery_payload.supported_color_modes = [
								'brightness',
							] as ColorMode[]
							cfg.discovery_payload.brightness_state_topic =
								getTopic
							cfg.discovery_payload.brightness_command_topic =
								setTopic
						}
					} else return
					break
				case CommandClasses['Door Lock']:
					if (valueId.isCurrentValue) {
						// lock state
						cfg = utils.copy(hassCfg.lock)
					} else {
						return
					}
					break
				case CommandClasses['Sound Switch']:
					// https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/commandclass/SoundSwitchCC.ts
					if (valueId.property === 'volume') {
						// volume control
						cfg = utils.copy(hassCfg.volume_dimmer)
						cfg.discovery_payload.brightness_state_topic = getTopic
						cfg.discovery_payload.command_topic = getTopic + '/set'
						cfg.discovery_payload.brightness_command_topic =
							cfg.discovery_payload.command_topic
					} else {
						return
					}
					break
				case CommandClasses['Color Switch']:
					if (
						valueId.property === 'currentColor' &&
						valueId.propertyKey === undefined
					) {
						cfg = this._addRgbColorSwitch(node, valueId)
					} else return
					break
				case CommandClasses['Central Scene']:
				case CommandClasses['Scene Activation']:
					cfg = utils.copy(hassCfg.central_scene)

					// Combile unique Object id, by using all possible scenarios
					cfg.object_id = utils.joinProps(
						cfg.object_id,
						valueId.property,
						valueId.propertyKey,
					)
					if (valueId.value?.unit) {
						cfg.discovery_payload.value_template =
							"{{ value_json.value.value | default('') }}"
					}
					break
				case CommandClasses['Binary Sensor']: {
					// https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/commandclass/BinarySensorCC.ts#L41
					// change the sensorTypeName to use directly valueId.property, as the old way was returning a number
					// add a comment which shows the old way of achieving this value. This change fixes the Binary Sensor
					// discovery
					let sensorTypeName = valueId.property.toString()

					if (sensorTypeName) {
						sensorTypeName = utils.sanitizeTopic(
							sensorTypeName.toLocaleLowerCase(),
							true,
						)
					}

					// TODO: Implement all BinarySensorTypes
					// Use default Binary sensor, and replace based on sensorTypeName
					// till now only one type is using the reverse on/off values as states
					switch (sensorTypeName) {
						// normal
						case 'presence':
						case 'smoke':
						case 'gas':
							cfg = this._getBinarySensorConfig(sensorTypeName)
							break
						// reverse
						case 'lock':
							cfg = this._getBinarySensorConfig(
								sensorTypeName,
								true,
							)
							break
						// moisture - normal
						case 'contact':
						case 'water':
							cfg = this._getBinarySensorConfig(
								Constants.deviceClass.sensor_binary.MOISTURE,
							)
							break
						// safety - normal
						case 'co':
						case 'co2':
						case 'tamper':
							cfg = this._getBinarySensorConfig(
								Constants.deviceClass.sensor_binary.SAFETY,
							)
							break
						// problem - normal
						case 'alarm':
							cfg = this._getBinarySensorConfig(
								Constants.deviceClass.sensor_binary.PROBLEM,
							)
							break
						// connectivity - normal
						case 'router':
							cfg = this._getBinarySensorConfig(
								Constants.deviceClass.sensor_binary
									.CONNECTIVITY,
							)
							break
						// battery - normal
						case 'battery_low':
							cfg = this._getBinarySensorConfig(
								Constants.deviceClass.sensor_binary.BATTERY,
							)
							break
						default:
							// in the end build the basic cfg if all fails
							cfg = utils.copy(hassCfg.binary_sensor)
					}
					cfg.object_id = sensorTypeName

					if (valueConf) {
						if (valueConf.device_class) {
							cfg.discovery_payload.device_class =
								valueConf.device_class
							cfg.object_id = valueConf.device_class
						}
						// binary sensors doesn't support icons
					}

					break
				}
				case CommandClasses['Alarm Sensor']:
					// https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/commandclass/AlarmSensorCC.ts#L40
					if (valueId.property === 'state') {
						cfg = this._getBinarySensorConfig(
							Constants.deviceClass.sensor_binary.PROBLEM,
						)
						cfg.object_id += AlarmSensorType[valueId.propertyKey]
							? '_' + AlarmSensorType[valueId.propertyKey]
							: ''
					} else {
						return
					}
					break
				case CommandClasses.Basic:
				case CommandClasses.Notification:
					// only support basic events
					if (
						cmdClass === CommandClasses.Basic &&
						valueId.property !== 'event'
					) {
						return
					}

					// Try to define Binary sensor
					if (valueId.states?.length === 2) {
						let off = 0 // set default off to 0.
						let discoveredObjectId = valueId.propertyKey
						switch (valueId.propertyKeyName) {
							case 'Access Control':
								cfg = this._getBinarySensorConfig(
									Constants.deviceClass.sensor_binary.LOCK,
								)
								off = 23 // Closed state
								break
							case 'Cover status':
								cfg = this._getBinarySensorConfig(
									Constants.deviceClass.sensor_binary.OPENING,
								)
								break
							case 'Door state (simple)':
								cfg = this._getBinarySensorConfig(
									Constants.deviceClass.sensor_binary.DOOR,
								)
								off = 1 // Door closed on payload 1
								break
							case 'Alarm status':
							case 'Dust in device status':
							case 'Load error status':
							case 'Over-current status':
							case 'Over-load status':
							case 'Hardware status':
								cfg = this._getBinarySensorConfig(
									Constants.deviceClass.sensor_binary.PROBLEM,
								)
								break
							case 'Heat sensor status':
								cfg = this._getBinarySensorConfig(
									Constants.deviceClass.sensor_binary.HEAT,
								)
								break
							case 'Motion sensor status':
								cfg = this._getBinarySensorConfig(
									Constants.deviceClass.sensor_binary.MOTION,
								)
								break
							case 'Water Alarm':
								cfg = this._getBinarySensorConfig(
									Constants.deviceClass.sensor_binary
										.MOISTURE,
								)
								break
							// sensor status has multiple Properties. therefore is good to work
							// on property basis... user friendly
							case 'Sensor status':
								switch (valueId.propertyName) {
									case 'Smoke Alarm':
										cfg = this._getBinarySensorConfig(
											Constants.deviceClass.sensor_binary
												.SMOKE,
										)
										break
									case 'Water Alarm':
										cfg = this._getBinarySensorConfig(
											Constants.deviceClass.sensor_binary
												.MOISTURE,
										)
										break
									default:
								}
								discoveredObjectId = valueId.propertyName
								break
							default:
						}
						// cfg not there?
						cfg = cfg || utils.copy(hassCfg.binary_sensor)
						// correct payload from true/false to numeric values
						this._setBinaryPayloadFromSensor(cfg, valueId, off)
						// finally update object_id
						cfg.object_id = discoveredObjectId.toString()
					} else if (valueId.states?.length > 2) {
						// https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/commandclass/NotificationCC.ts
						// https://github.com/zwave-js/node-zwave-js/blob/master/packages/config/config/notifications.json
						cfg = utils.copy(hassCfg.sensor_generic)
						cfg.object_id = utils.joinProps(
							'notification',
							valueId.property,
							valueId.propertyKey,
						)
						// TODO: Improve the icons for different propertyKeys!
						switch (valueId.propertyKey) {
							case 'Motion sensor status':
								cfg.discovery_payload.icon = 'mdi:motion-sensor'
								break
							default:
								cfg.discovery_payload.icon = 'mdi:alarm-light'
						}
						cfg.discovery_payload.value_template =
							this._getMappedStateTemplate(
								valueId.states,
								valueId.default,
							)
					} else {
						return
					}
					break
				case CommandClasses['Multilevel Sensor']:
				case CommandClasses.Meter:
				case CommandClasses['Pulse Meter']:
				case CommandClasses.Time:
				case CommandClasses['Energy Production']:
				case CommandClasses.Battery: {
					let sensor = null
					// set it as been sensor (ex not Binary)
					let isSensor = true

					// https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/commandclass/MultilevelSensorCC.ts
					if (cmdClass === CommandClasses['Multilevel Sensor']) {
						// https://github.com/zwave-js/node-zwave-js/blob/master/packages/config/config/sensorTypes.json
						// In some cases Multilevel Sensors offer Reset option or DeltaTime sensors, but do not include ccSpecific
						// information. With this change, we target only the sensors and not the additional Properties.
						if (valueId.ccSpecific) {
							sensor = Constants.sensorType(
								valueId.ccSpecific.sensorType,
							)
						} else {
							return
						}
					} else if (cmdClass === CommandClasses.Meter) {
						// https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/commandclass/MeterCC.ts
						// https://github.com/zwave-js/node-zwave-js/blob/master/packages/config/config/meters.json
						// In some cases Metering devices offer Reset option or DeltaTime sensors, but do not include ccSpecific
						// information. With this change, we target only the sensors and not the additional Properties.
						if (valueId.ccSpecific) {
							sensor = Constants.meterType(
								valueId.ccSpecific as IMeterCCSpecific,
							)

							sensor.objectId += '_' + valueId.property
						} else {
							return
						}
					} else if (cmdClass === CommandClasses['Pulse Meter']) {
						sensor = {
							sensor: 'pulse',
							objectId: 'meter',
							props: {},
						}
					} else if (cmdClass === CommandClasses.Time) {
						if (valueId.isCurrentValue) {
							sensor = {
								sensor: 'date',
								objectId: 'current',
								props: {
									device_class:
										Constants.deviceClass.sensor.TIMESTAMP,
								},
							}
						} else return
					} else if (
						cmdClass === CommandClasses['Energy Production']
					) {
						// TODO: class not yet supported by zwavejs
						logger.warn(
							'Energy Production CC not supported so value cannot be discovered',
						)
						// sensor = Constants.productionType(valueId.property)
						return
					} else if (cmdClass === CommandClasses.Battery) {
						// https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/commandclass/BatteryCC.ts#L258
						if (valueId.property === 'level') {
							sensor = {
								sensor: 'battery',
								objectId: 'level',
								props: {
									device_class:
										Constants.deviceClass.sensor.BATTERY,
									unit_of_measurement: '%', // this is set if Driver doesn't offer unit of measurement
								},
							}
						} else if (valueId.property === 'isLow') {
							sensor = {
								sensor: 'battery',
								objectId: 'isLow',
								props: {
									device_class:
										Constants.deviceClass.sensor.BATTERY,
								},
							}

							// use battery_low binary sensor
							cfg = this._getBinarySensorConfig(
								Constants.deviceClass.sensor_binary.BATTERY,
							)
							// support the case a binary sensor is served under multilevel sensor CC
							isSensor = false
						} else return
					}

					// check if is a sensor
					if (isSensor) {
						cfg = utils.copy(hassCfg.sensor_generic)
					}

					cfg.object_id = utils.joinProps(
						sensor.sensor,
						sensor.objectId,
					)

					let unit = null
					// https://github.com/zwave-js/node-zwave-js/blob/master/packages/config/config/scales.json
					if (valueId.unit) {
						unit = valueId.unit
					} else if (valueId.value?.unit) {
						unit = valueId.value.unit
					}

					if (unit) {
						// Home Assistant requires time units to be abbreviated
						// https://github.com/home-assistant/core/blob/d7ac4bd65379e11461c7ce0893d3533d8d8b8cbf/homeassistant/const.py#L408
						if (unit === 'seconds') {
							unit = 's'
						} else if (unit === 'minutes') {
							unit = 'min'
						} else if (unit === 'hours') {
							unit = 'h'
						} else if (unit === 'kVar') {
							// HA reactive_power device class requires lowercase unit
							unit = 'kvar'
						} else if (unit === 'kVarh') {
							// Normalize reactive energy unit to lowercase
							unit = 'kvarh'
						}
						cfg.discovery_payload.unit_of_measurement = unit
					}

					Object.assign(cfg.discovery_payload, sensor.props || {})

					// check if there is a custom value configuration for this valueID
					if (valueConf) {
						if (valueConf.device_class) {
							cfg.discovery_payload.device_class =
								valueConf.device_class
							cfg.object_id = valueConf.device_class
						}
						if (valueConf.icon)
							cfg.discovery_payload.icon = valueConf.icon
					}
					break
				}
				case CommandClasses.Configuration: {
					if (
						!valueId.writeable ||
						process.env.DISCOVERY_DISABLE_CC_CONFIGURATION ===
							'true'
					) {
						return
					}
					let type = valueId.type
					if (
						type === 'number' &&
						valueId.min === 0 &&
						valueId.max === 1
					) {
						type = 'boolean'
					}
					switch (type) {
						case 'boolean':
							cfg = utils.copy(hassCfg.config_switch)

							// Combine unique Object id, by using all possible scenarios
							cfg.object_id = utils.joinProps(
								cfg.object_id,
								valueId.property,
								valueId.propertyKey,
							)
							break
						case 'number':
							cfg = utils.copy(hassCfg.config_number)

							// Combine unique Object id, by using all possible scenarios
							cfg.object_id = utils.joinProps(
								cfg.object_id,
								valueId.property,
								valueId.propertyKey,
							)
							if (valueId.min !== 1) {
								cfg.discovery_payload.min = valueId.min
							}
							if (valueId.max !== 100) {
								cfg.discovery_payload.max = valueId.max
							}

							break
						default:
							return
					}

					// per-value ccConfigEnableDiscovery overrides the global default
					cfg.discovery_payload.enabled_by_default =
						valueConf?.ccConfigEnableDiscovery ??
						!!this.config.ccConfigEnabledByDefault

					break
				}
				default:
					return
			}

			const payload = cfg.discovery_payload

			if (
				!utils.hasProperty(payload, 'state_topic') ||
				payload.state_topic === true
			) {
				payload.state_topic = getTopic
			} else if (payload.state_topic === false) {
				delete payload.state_topic
			}

			if (payload.command_topic === true) {
				payload.command_topic = setTopic || getTopic + '/set'
			}

			this.setDiscoveryAvailability(node, payload)

			if (
				['binary_sensor', 'sensor', 'lock', 'climate', 'fan'].includes(
					cfg.type,
				)
			) {
				payload.json_attributes_topic = payload.state_topic
			}

			// Set device information using node info
			payload.device = this._deviceInfo(node, nodeName)

			// multi instance devices would have same object_id
			if (valueId.endpoint) cfg.object_id += '_' + valueId.endpoint

			// remove chars that are not allowed in object ids
			cfg.object_id = utils
				.sanitizeTopic(cfg.object_id, true)
				.toLocaleLowerCase()

			// Check if another value already exists and add the index to object_id to make it unique
			if (node.hassDevices[cfg.type + '_' + cfg.object_id]) {
				cfg.object_id += '_' + valueId.endpoint
			}

			// Set a friendly name for this component
			payload.name = this._getEntityName(
				node,
				valueId,
				cfg,
				this.config.entityTemplate,
				this.config.ignoreLoc,
			)

			// Set a unique id for the component
			payload.unique_id =
				UID_DISCOVERY_PREFIX +
				this._zwave.homeHex +
				'_' +
				utils.sanitizeTopic(valueId.id, true)

			const discoveryTopic = this._getDiscoveryTopic(cfg, nodeName)

			cfg.discoveryTopic = discoveryTopic
			cfg.values = cfg.values || []

			if (!cfg.values.includes(vId)) {
				cfg.values.push(vId)
			}

			if (valueId.targetValue) {
				cfg.values.push(valueId.targetValue)
			}

			// This configuration is not stored in nodes.json
			cfg.persistent = false

			// skip discovery flag, default to false
			cfg.ignoreDiscovery = false

			node.hassDevices[cfg.type + '_' + cfg.object_id] = cfg

			this.publishDiscovery(cfg, node.id)
		} catch (error) {
			logger.error(
				`Error while discovering value ${valueId.id} of node ${node.id}: ${error.message}`,
				error,
			)
		}
>>>>>>> 6098666744eb3d4de6c859b61168568bc61a4727
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
<<<<<<< b8699475b929694dc42a654d72674bb20cca44da
		if (!node) return
		const topics = Object.values(node.values).map(
			(value) => this.valueTopic(node, value) as string,
		)
		for (const topic of topics) {
			this._mqtt.publish(topic, '', { retain: true })
=======
		if (node) {
			const topics = Object.keys(node.values).map(
				(v) => this.valueTopic(node, node.values[v]) as string,
			)

			for (const t of topics) {
				this._mqtt.publishEmpty(t, { retain: true })
			}
>>>>>>> 6098666744eb3d4de6c859b61168568bc61a4727
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
		ensureHassNode(node)
		this.discoveryGenerator.discoverValueIfNeeded(node, valueId)

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

		this.discoveryGenerator.updateClimateDiscovery(
			valueId,
			node,
			changed ?? false,
		)

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

		ensureHassNode(node)
		this.discoveryGenerator.onNodeInited(node)
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
				const result = this.parsePayloadResult(
					payload,
					this.topicValues[values[0]],
					this.topicValues[values[0]].conf,
				)

				if (result.handled) return
				payload = result.value

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
			const result = this.parsePayloadResult(
				payload,
				valueId,
				valueId.conf,
			)

			if (result.handled) return

			await this._zwave.writeValue(
				valueId,
				result.value,
				payload?.options,
			)
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
<<<<<<< b8699475b929694dc42a654d72674bb20cca44da
=======

	/**
	 * Get node name from node object
	 */
	private _getNodeName(node: ZUINode, ignoreLoc: boolean): string {
		return (
			(!ignoreLoc && node.loc ? node.loc + '-' : '') +
			(node.name ? node.name : NODE_PREFIX + node.id)
		)
	}

	/**
	 *  Return re-arranged based on critical CCs
	 */

	private _getPriorityCCFirst(values: {
		[key: string]: ZUIValueId
	}): string[] {
		const priorityCC = [CommandClasses['Color Switch']]
		const prioritizedValueIds = []

		for (const id in values) {
			if (priorityCC.includes(values[id].commandClass)) {
				prioritizedValueIds.unshift(id)
			} else {
				prioritizedValueIds.push(id)
			}
		}
		return prioritizedValueIds
	}

	/**
	 * Returns the value id without the node prefix
	 */
	private _getIdWithoutNode(valueId: ZUIValueId): string {
		return valueId.id.replace(valueId.nodeId + '-', '')
	}

	/**
	 * Get the device Object to send in discovery payload
	 */
	private _deviceInfo(node: ZUINode, nodeName: string): DeviceInfo {
		const deviceInfo: DeviceInfo = {
			identifiers: [
				UID_DISCOVERY_PREFIX + this._zwave.homeHex + '_node' + node.id,
			],
			manufacturer: node.manufacturer || 'Z-Wave JS',
			model:
				node.productDescription && node.productLabel
					? node.productDescription + ' (' + node.productLabel + ')'
					: node.name || 'Virtual Node',
			name: nodeName,
			sw_version: node.firmwareVersion || utils.getVersion(),
		}

		const suggestedArea = node.loc?.trim()
		if (this.config.useLocationAsSuggestedArea && suggestedArea) {
			deviceInfo.suggested_area = suggestedArea
		}

		return deviceInfo
	}

	private setDiscoveryAvailability(
		node: ZUINode,
		payload: { [key: string]: any },
	) {
		// Set availability config using node status topic, client status topic
		// (which is the LWT), and driver status topic
		payload.availability = [
			{
				payload_available: 'true',
				payload_not_available: 'false',
				topic: this.mqtt.getTopic(this.nodeTopic(node)) + '/status',
			},
			{
				topic: this.mqtt.getStatusTopic(),
				value_template:
					"{{'online' if value_json.value else 'offline'}}",
			},
			{
				payload_available: 'true',
				payload_not_available: 'false',
				topic: this.mqtt.getTopic('driver/status'),
			},
		]
		if (this.config.payloadType !== PAYLOAD_TYPE.RAW) {
			payload.availability[0].value_template =
				"{{'true' if value_json.value else 'false'}}"
		}
		payload.availability_mode = 'all'
	}

	/**
	 * Get the Hass discovery topic for the specific node and hassDevice
	 */
	private _getDiscoveryTopic(
		hassDevice: HassDevice,
		nodeName: string,
	): string {
		return `${hassDevice.type}/${utils.sanitizeTopic(nodeName, true)}/${
			hassDevice.object_id
		}/config`
	}

	/**
	 * Generate the template string to use for value templates.
	 * Note that the keys need to be numeric.
	 */
	private _getMappedValuesTemplate(
		valueMap: { [x: string]: any },
		defaultValue: string,
	): string {
		const map = []
		// JSON.stringify converts props to strings and this breaks the template
		// Error: "0": "off", Working: 0: "off"
		for (const key in valueMap) {
			map.push(`${key}: "${valueMap[key]}"`)
		}

		return `{{ {${map.join(
			', ',
		)}}[value_json.value] | default('${defaultValue}') }}`
	}

	/**
	 * Generate the template string to use for value templates
	 * by inverting the value map
	 */
	private _getMappedValuesInverseTemplate(
		valueMap: { [x: string]: number },
		defaultValue: string,
	): string {
		const map = []
		// JSON.stringify converts props to strings and this breaks the template
		// Error: "0": "off" Working: 0: "off"
		for (const key in valueMap) {
			map.push(`${valueMap[key]}: "${key}"`)
		}

		return `{{ {${map.join(
			', ',
		)}}[value_json.value] | default('${defaultValue}') }}`
	}

	/**
	 * Calculate the correct template string to use for templates with state
	 * list based on gateway settings and mapped mode values
	 */
	private _getMappedStateTemplate(
		states: ZUIValueIdState[],
		defaultValueKey: string | number,
	): string {
		const map = []
		let defaultValue = 'value_json.value'
		for (const s of states) {
			map.push(
				`${
					typeof s.value === 'number' ? s.value : '"' + s.value + '"'
				}: "${s.text}"`,
			)
			if (s.value === defaultValueKey) {
				defaultValue = `'${s.text}'`
			}
		}

		return `{{ {${map.join(
			',',
		)}}[value_json.value] | default(${defaultValue}) }}`
	}

	/**
	 * Generates payload for Binary use from a state object
	 */
	private _setBinaryPayloadFromSensor(
		cfg: HassDevice,
		valueId: ZUIValueId,
		offStateValue = 0,
	): HassDevice {
		const stateKeys = valueId.states.map((s) => s.value)
		// Set on/off state from keys
		if (stateKeys[0] === offStateValue) {
			cfg.discovery_payload.payload_off = stateKeys[0]
			cfg.discovery_payload.payload_on = stateKeys[1]
		} else {
			cfg.discovery_payload.payload_off = stateKeys[1]
			cfg.discovery_payload.payload_on = stateKeys[0]
		}
		return cfg
	}

	/**
	 * Create a binary sensor configuration with a specific device class
	 */
	private _getBinarySensorConfig(
		devClass: string,
		reversePayload = false,
	): HassDevice {
		const cfg = utils.copy(hassCfg.binary_sensor)
		cfg.discovery_payload.device_class = devClass
		if (reversePayload) {
			cfg.discovery_payload.payload_on = false
			cfg.discovery_payload.payload_off = true
		}
		return cfg
	}

	/**
	 * Retrieves the value of a property from the node valueId
	 */
	private _setDiscoveryValue(
		payload: any,
		prop: string,
		node: ZUINode,
	): void {
		if (typeof payload[prop] === 'string') {
			const valueId = node.values[payload[prop]]
			if (valueId && valueId.value != null) {
				payload[prop] = valueId.value
			}
		}
	}

	/**
	 * Check if this node supports rgb and if so add it to discovery configuration
	 */
	private _addRgbColorSwitch(
		node: ZUINode,
		currentColorValue: ZUIValueId,
	): HassDevice {
		const cfg = utils.copy(hassCfg.light_rgb_dimmer)

		const currentColorTopics = this.valueTopic(
			node,
			currentColorValue,
			true,
		) as ValueIdTopic

		const endpoint = currentColorValue.endpoint

		const supportedColors: ColorMode[] = []

		cfg.discovery_payload.supported_color_modes = supportedColors

		supportedColors.push('rgb')

		// current color values are automatically added later in discoverValue function
		cfg.values = []

		cfg.discovery_payload.rgb_state_topic = this._mqtt.getTopic(
			currentColorTopics.topic,
		)
		cfg.discovery_payload.rgb_command_topic = this._mqtt.getTopic(
			currentColorTopics.targetTopic,
			true,
		)

		// The following part of code, checks if ML or Binary works. If one exists the other
		let brightnessValue: string
		let switchValue: string
		if (node.values[`38-${endpoint}-currentValue`]) {
			brightnessValue = `38-${endpoint}-currentValue`
			// Next if is about Fibaro like RGBW which use the endpoint 1 as multilevel
		} else if (endpoint === 0 && node.values['38-1-currentValue']) {
			brightnessValue = '38-1-currentValue'
		} else if (node.values[`37-${endpoint}-currentValue`]) {
			switchValue = `37-${endpoint}-currentValue`
		}

		/*
			Find the control switch of the device Brightness or Binary
			If multilevel is not there use binary
			Some devices use also endpoint + 1 as on/off/brightness... try to guess that too!
		*/
		let discoveredStateTopic: string
		let discoveredCommandTopic: string

		if (brightnessValue || switchValue) {
			const vID = brightnessValue || switchValue

			const valueIdState = node.values[vID]
			const topics = this.valueTopic(
				node,
				valueIdState,
				true,
			) as ValueIdTopic

			if (!topics) {
				throw Error(`Can't find topics for ${vID}`)
			}

			cfg.values.push(vID, valueIdState.targetValue)

			discoveredStateTopic = this._mqtt.getTopic(topics.topic)
			discoveredCommandTopic = this._mqtt.getTopic(
				topics.targetTopic,
				true,
			)
		}

		if (brightnessValue) {
			supportedColors.push('brightness')
			cfg.discovery_payload.brightness_state_topic = discoveredStateTopic
			cfg.discovery_payload.brightness_command_topic =
				discoveredCommandTopic
			cfg.discovery_payload.state_topic = discoveredStateTopic
			cfg.discovery_payload.command_topic = discoveredCommandTopic
		} else if (switchValue) {
			supportedColors.push('onoff')
			cfg.discovery_payload.state_topic = discoveredStateTopic
			cfg.discovery_payload.command_topic = discoveredCommandTopic

			// string compare, so the RAW payload ('true'/'false') works too
			cfg.discovery_payload.state_value_template =
				'{{ "ON" if value_json.value | string | lower == "true" else "OFF" }}'
			cfg.discovery_payload.on_command_type = 'last'
		}

		const whiteValue = node.values[`51-${endpoint}-currentColor-0`]

		// if whitevalue exists, use currentColor value to get/set white
		if (whiteValue && currentColorValue) {
			supportedColors.push('white')
			// still use currentColor but change the template
			cfg.discovery_payload.color_temp_state_topic =
				cfg.discovery_payload.rgb_state_topic
			cfg.discovery_payload.color_temp_command_topic =
				cfg.discovery_payload.rgb_command_topic

			// warmWhite = mireds - MIN_MIREDS, so the range maps onto 0-MAX_WHITE
			const MIN_MIREDS = 245
			const MAX_WHITE = 255
			const MAX_MIREDS = MIN_MIREDS + MAX_WHITE

			// HA runs the rgb and color_temp handlers of the shared topic in no
			// fixed order, so each renders only for its own mode (empty = ignored)
			const setColor = '{% set c = value_json.value %}'
			const isRgbMode =
				'(c.red | default(0, true)) + (c.green | default(0, true)) + (c.blue | default(0, true)) > 0'
			const isColorTempMode = `not (${isRgbMode}) and (c.warmWhite | default(0, true)) + (c.coldWhite | default(0, true)) > 0`
			cfg.discovery_payload.rgb_value_template = `${setColor}{% if ${isRgbMode} %}{{ c.red }},{{ c.green }},{{ c.blue }}{% endif %}`
			cfg.discovery_payload.color_temp_value_template = `${setColor}{% if ${isColorTempMode} %}{{ (c.warmWhite | default(0, true)) + ${MIN_MIREDS} }}{% endif %}`

			// modes are exclusive in HA, so setting one turns off the other's channels
			cfg.discovery_payload.rgb_command_template =
				"{{ {'red': red, 'green': green, 'blue': blue, 'warmWhite': 0, 'coldWhite': 0}|to_json }}"
			// clamped because HA doesn't apply min/max_mireds to service calls
			cfg.discovery_payload.color_temp_command_template = `{% set ww = [[(value - ${MIN_MIREDS}) | round(0) | int, 0] | max, ${MAX_WHITE}] | min %}{{ {'red': 0, 'green': 0, 'blue': 0, 'warmWhite': ww, 'coldWhite': ${MAX_WHITE} - ww}|to_json }}`
			cfg.discovery_payload.min_mireds = MIN_MIREDS
			cfg.discovery_payload.max_mireds = MAX_MIREDS
		}
		return cfg
	}

	private _getEntityName(
		node: ZUINode,
		valueId: ZUIValueId,
		cfg: HassDevice,
		entityTemplate: string,
		ignoreLoc: boolean,
	): string {
		entityTemplate = entityTemplate || '%ln_%o'
		// when getting the entity name of a device use node props
		let propertyKey: string = cfg.type
		let propertyName: string = cfg.type
		let property: string = cfg.type
		let label: string = cfg.object_id

		if (valueId) {
			property = valueId.property?.toString()
			propertyKey = valueId.propertyKey?.toString()
			propertyName = valueId.propertyName?.toString()
			label = valueId.label
		}

		return entityTemplate
			.replace(/%nid/g, NODE_PREFIX + node.id)
			.replace(/%ln/g, this._getNodeName(node, ignoreLoc))
			.replace(/%loc/g, node.loc || '')
			.replace(/%pk/g, propertyKey)
			.replace(/%pn/g, propertyName)
			.replace(/%p/g, property)
			.replace(/%o/g, cfg.object_id)
			.replace(/%n/g, node.name || NODE_PREFIX + node.id)
			.replace(/%l/g, label)
	}
>>>>>>> 6098666744eb3d4de6c859b61168568bc61a4727
}
