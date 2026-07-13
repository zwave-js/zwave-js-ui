import { CommandClasses } from '@zwave-js/core'
import { AlarmSensorType, ThermostatSetpointType } from 'zwave-js'
import hassCfg, { type ColorMode } from './configurations.ts'
import * as Constants from '../lib/Constants.ts'
import { getErrorMessage } from '../lib/errors.ts'
import { PayloadType } from '../lib/shared.ts'
import * as utils from '../lib/utils.ts'
import type {
	HassDeviceRegistryPort,
	HassDiscoveryConfig,
	HassDiscoveryState,
	HassLogger,
	HassMqttPort,
	HassNode,
	HassTopicPort,
	HassValue,
	HassValueState,
	HassValueTopic,
	HassZwavePort,
} from './ports.ts'
import { isHassNode } from './ports.ts'
import {
	HASS_NODE_PREFIX,
	type HassDevice,
	type HassDiscoveryPayload,
	type PublishDiscoveryOptions,
} from './types.ts'

const UID_DISCOVERY_PREFIX = process.env.UID_DISCOVERY_PREFIX || 'zwavejs2mqtt_'

interface DeviceInfo {
	identifiers: string[]
	manufacturer: string
	model: string
	name: string
	sw_version: string
	suggested_area?: string
}

interface SensorDefinition {
	sensor: string
	objectId: string
	props?: {
		state_class?: string
		device_class?: string
		unit_of_measurement?: string
		icon?: string
	}
}

export interface DiscoveryGeneratorOptions {
	config: HassDiscoveryConfig
	mqtt: HassMqttPort
	zwave: HassZwavePort
	topics: HassTopicPort
	registry: HassDeviceRegistryPort
	state: HassDiscoveryState
	logger: HassLogger
}

function valueUnit(value: unknown): string | undefined {
	if (!utils.isRecord(value)) return undefined
	return typeof value.unit === 'string' ? value.unit : undefined
}

export class DiscoveryGenerator {
	private readonly config: HassDiscoveryConfig
	private readonly mqtt: HassMqttPort
	private readonly zwave: HassZwavePort
	private readonly topics: HassTopicPort
	private readonly registry: HassDeviceRegistryPort
	private readonly state: HassDiscoveryState
	private readonly logger: HassLogger

	// Publication fence. While `false` every retained-discovery producer is a
	// no-op, so no node/value/remove/status event emits a retained MQTT
	// discovery message once the owning manager has begun its (possibly
	// deferred) teardown. Starts active
	private _active = true

	public constructor(options: DiscoveryGeneratorOptions) {
		this.config = options.config
		this.mqtt = options.mqtt
		this.zwave = options.zwave
		this.topics = options.topics
		this.registry = options.registry
		this.state = options.state
		this.logger = options.logger
	}

	private get mqttEnabled(): boolean {
		return !this.mqtt.disabled
	}

	/** Whether retained-discovery publication is currently permitted. */
	public get active(): boolean {
		return this._active
	}

	/**
	 * Re-arm retained-discovery publication. Called by the owning
	 * {@link MqttDiscoveryManager} on start, including a restart that reuses the
	 * same generator instance (the standalone `Gateway` path memoizes it).
	 */
	public activate(): void {
		this._active = true
	}

	/**
	 * Fence off retained-discovery publication synchronously, at the very start
	 * of the owning manager's stop (before it disposes the scoped status
	 * subscription and before the coordinator awaits the server destroy), so any
	 * node/value/remove/status event during the deferred teardown window cannot
	 * publish a retained MQTT discovery message or adopt resources against a
	 * subsystem that is going away.
	 */
	public deactivate(): void {
		this._active = false
	}

	public rediscoverNode(nodeId: number): void {
		const candidate = this.zwave.getNode(nodeId)
		if (!isHassNode(candidate) || candidate.virtual) return

		this.removeNode(candidate)
		candidate.hassDevices = {}

		for (const device of this.registry.get(candidate.deviceId)) {
			this.discoverDevice(candidate, device)
		}
		for (const id of this.getPriorityCCFirst(candidate.values)) {
			this.discoverValue(candidate, id)
		}

		this.zwave.emitNodeUpdate(candidate.id, candidate.hassDevices)
	}

	public disableDiscovery(nodeId: number): void {
		const candidate = this.zwave.getNode(nodeId)
		if (!isHassNode(candidate)) return

		for (const device of Object.values(candidate.hassDevices)) {
			device.ignoreDiscovery = true
		}
		this.zwave.emitNodeUpdate(candidate.id, candidate.hassDevices)
	}

	public publishDiscovery(
		hassDevice: HassDevice,
		nodeId: number,
		options: PublishDiscoveryOptions = {},
	): void {
		try {
			// Publication fence: skip once the owning manager has begun teardown
			// so no late event publishes a retained discovery message
			if (!this._active) {
				this.logger.debug(
					'Discovery is quiesced; skipping retained publication',
				)
				return
			}

			if (!this.mqttEnabled || !this.config.hassDiscovery) {
				this.logger.debug(
					'Enable MQTT gateway and hass discovery to use this function',
				)
				return
			}

			this.logger.log(
				'debug',
				`${options.deleteDevice ? 'Removing' : 'Publishing'} discovery: %o`,
				hassDevice,
			)

			this.setDiscovery(nodeId, hassDevice, options.deleteDevice)

			if (this.config.payloadType === PayloadType.RAW) {
				const payload = hassDevice.discovery_payload
				const template =
					'value' +
					(utils.hasProperty(payload, 'payload_on') &&
					utils.hasProperty(payload, 'payload_off')
						? " == 'true'"
						: '')

				for (const key of Object.keys(payload)) {
					const value = payload[key]
					if (typeof value === 'string') {
						payload[key] = value.replace(
							/value_json\.value/g,
							template,
						)
					}
				}
			}

			const skipDiscovery =
				hassDevice.ignoreDiscovery ||
				(this.config.manualDiscovery && !options.forceUpdate)
			if (!skipDiscovery && hassDevice.discoveryTopic) {
				this.mqtt.publish(
					hassDevice.discoveryTopic,
					options.deleteDevice ? '' : hassDevice.discovery_payload,
					{
						qos: 0,
						retain: this.config.retainedDiscovery || false,
					},
					this.config.discoveryPrefix,
				)
			}

			if (options.forceUpdate) {
				this.zwave.updateDevice(
					hassDevice,
					nodeId,
					options.deleteDevice,
				)
			}
		} catch (error) {
			this.logger.log(
				'error',
				`Error while publishing discovery for node ${nodeId}: ${getErrorMessage(
					error,
				)}. Hass device: %o`,
				hassDevice,
			)
		}
	}

	public setDiscovery(
		nodeId: number,
		hassDevice: HassDevice,
		deleteDevice = false,
	): void {
		if (!hassDevice.values) {
			throw new TypeError('HASS discovery device has no values')
		}

		for (const value of hassDevice.values) {
			const valueId = nodeId + '-' + value
			if (deleteDevice && this.state.discovered[valueId]) {
				delete this.state.discovered[valueId]
			} else {
				this.state.discovered[valueId] = hassDevice
			}
		}
	}

	public rediscoverAll(): void {
		if (!this._active) return
		if (!this.config.hassDiscovery) return

		for (const [nodeId, candidate] of this.zwave.getNodes()) {
			if (!isHassNode(candidate)) continue
			for (const device of Object.values(candidate.hassDevices)) {
				if (device.discoveryTopic && device.discovery_payload) {
					this.publishDiscovery(device, nodeId)
				}
			}
		}
	}

	public discoverDevice(node: HassNode, source: HassDevice): void {
		if (!this.mqttEnabled || !this.config.hassDiscovery) {
			this.logger.info(
				'Enable MQTT gateway and hass discovery to use this function',
			)
			return
		}

		const hassId = source ? source.type + '_' + source.object_id : null

		try {
			if (!hassId || node.hassDevices[hassId]) return

			const hassDevice = utils.copy(source)
			const payload = hassDevice.discovery_payload
			const values = hassDevice.values
			if (!values) throw new TypeError('HASS device has no values')

			if (hassDevice.type === 'climate') {
				const modeId = payload.mode_state_topic
				const mode =
					typeof modeId === 'string' ? node.values[modeId] : undefined
				let setId: string | undefined

				if (mode !== undefined) {
					const modeValue =
						typeof mode.value === 'number' ? mode.value : undefined
					setId =
						modeValue !== undefined &&
						hassDevice.setpoint_topic?.[modeValue]
							? hassDevice.setpoint_topic[modeValue]
							: hassDevice.default_setpoint
					payload.mode_state_template =
						this.getMappedValuesInverseTemplate(
							hassDevice.mode_map ?? {},
							'off',
						)
					const modeTopic = this.mqtt.getTopic(
						this.requireValueTopic(node, mode),
					)
					payload.mode_state_topic = modeTopic
					payload.mode_command_topic = modeTopic + '/set'
				} else {
					setId = hassDevice.default_setpoint
				}

				this.setDiscoveryValue(payload, 'max_temp', node)
				this.setDiscoveryValue(payload, 'min_temp', node)

				const setpoint = setId ? node.values[setId] : undefined
				if (!setpoint) throw new Error(`Missing setpoint ${setId}`)
				const temperatureTopic = this.mqtt.getTopic(
					this.requireValueTopic(node, setpoint),
				)
				payload.temperature_state_topic = temperatureTopic
				payload.temperature_command_topic = temperatureTopic + '/set'

				const actionId = payload.action_topic
				const action =
					typeof actionId === 'string'
						? node.values[actionId]
						: undefined
				if (action) {
					payload.action_topic = this.mqtt.getTopic(
						this.requireValueTopic(node, action),
					)
					if (hassDevice.action_map) {
						payload.action_template = this.getMappedValuesTemplate(
							hassDevice.action_map,
							'idle',
						)
					}
				}

				const fanId = payload.fan_mode_state_topic
				const fan =
					typeof fanId === 'string' ? node.values[fanId] : undefined
				if (fan !== undefined) {
					const fanTopic = this.mqtt.getTopic(
						this.requireValueTopic(node, fan),
					)
					payload.fan_mode_state_topic = fanTopic
					payload.fan_mode_command_topic = fanTopic + '/set'
					if (hassDevice.fan_mode_map) {
						payload.fan_mode_state_template =
							this.getMappedValuesInverseTemplate(
								hassDevice.fan_mode_map,
								'auto',
							)
					}
				}

				const currentTemperatureId = payload.current_temperature_topic
				const currentTemperature =
					typeof currentTemperatureId === 'string'
						? node.values[currentTemperatureId]
						: undefined
				if (currentTemperature !== undefined) {
					payload.current_temperature_topic = this.mqtt.getTopic(
						this.requireValueTopic(node, currentTemperature),
					)
					if (currentTemperature.unit) {
						payload.temperature_unit =
							currentTemperature.unit.includes('C') ? 'C' : 'F'
					}
					if (!payload.precision) payload.precision = 0.1
				}
			} else {
				const resolvedTopics: Record<string, string | null> = {}
				for (const valueId of values) {
					if (valueId === undefined) {
						resolvedTopics[String(valueId)] = null
						continue
					}
					const value = node.values[valueId]
					resolvedTopics[valueId] = value
						? this.mqtt.getTopic(
								this.requireValueTopic(node, value),
							)
						: null
				}

				for (const key of Object.keys(payload)) {
					const configuredTopic = payload[key]
					if (typeof configuredTopic !== 'string') continue
					const resolved = resolvedTopics[configuredTopic]
					if (key.includes('topic') && resolved) {
						payload[key] =
							resolved +
							(key.includes('command') || key.includes('set_')
								? '/set'
								: '')
					}
				}
			}

			const nodeName = this.getNodeName(node, this.config.ignoreLoc)
			payload.device = this.deviceInfo(node, nodeName)
			this.setDiscoveryAvailability(node, payload)

			hassDevice.object_id = utils
				.sanitizeTopic(hassDevice.object_id, true)
				.toLocaleLowerCase()
			payload.name = this.getEntityName(
				node,
				undefined,
				hassDevice,
				this.config.entityTemplate,
				this.config.ignoreLoc,
			)
			payload.unique_id =
				UID_DISCOVERY_PREFIX +
				this.zwave.homeHex +
				'_Node' +
				node.id +
				'_' +
				hassDevice.object_id
			hassDevice.discoveryTopic = this.getDiscoveryTopic(
				hassDevice,
				nodeName,
			)
			hassDevice.persistent = false
			hassDevice.ignoreDiscovery = !!hassDevice.ignoreDiscovery
			node.hassDevices[hassId] = hassDevice
			this.publishDiscovery(hassDevice, node.id)
		} catch (error) {
			this.logger.error(
				`Error while discovering device ${hassId} of node ${
					node.id
				}: ${getErrorMessage(error)}`,
				error,
			)
		}
	}

	public discoverClimates(node: HassNode): void {
		if (!node.deviceClass || node.deviceClass.generic !== 0x08) return

		try {
			const nodeDevices = this.registry.get(node.deviceId)
			if (nodeDevices.some((device) => device.type === 'climate')) return

			const setpoints: string[] = []
			const temperatures: string[] = []
			const modes: string[] = []
			const actions: string[] = []

			for (const [valueId, value] of Object.entries(node.values)) {
				if (
					value.commandClass ===
						CommandClasses['Thermostat Setpoint'] &&
					value.property === 'setpoint'
				) {
					setpoints.push(valueId)
				} else if (
					value.commandClass ===
						CommandClasses['Multilevel Sensor'] &&
					value.property === 'Air temperature'
				) {
					temperatures.push(valueId)
				} else if (
					value.commandClass === CommandClasses['Thermostat Mode'] &&
					value.property === 'mode'
				) {
					modes.push(valueId)
				} else if (
					value.commandClass ===
						CommandClasses['Thermostat Operating State'] &&
					value.property === 'state'
				) {
					actions.push(valueId)
				}
			}

			const temperatureId = temperatures[0]
			if (setpoints.length === 0) {
				this.logger.warn(
					'Unable to discover climate device, there is no valid setpoint valueId',
				)
				return
			}

			const config = utils.copy(hassCfg.thermostat)
			config.values = []

			if (temperatureId) {
				config.discovery_payload.current_temperature_topic =
					temperatureId
				config.values.push(temperatureId)
			} else {
				delete config.discovery_payload.current_temperature_template
				delete config.discovery_payload.current_temperature_topic
			}

			const modeId = modes[0]
			if (modeId) {
				config.values.push(modeId)
				const mode = node.values[modeId]
				config.discovery_payload.mode_state_topic = modeId
				config.discovery_payload.mode_command_topic = modeId + '/set'

				const availableModes = (mode.states ?? [])
					.map((state) => state.value)
					.filter(
						(value): value is number => typeof value === 'number',
					)
				const allowedModes = [
					'off',
					'heat',
					'cool',
					'auto',
					'dry',
					'fan_only',
				]
				const hassModes: Array<string | undefined> = [
					'off',
					'heat',
					'cool',
					'auto',
					undefined,
					undefined,
					'fan_only',
					undefined,
					'dry',
					undefined,
					'auto',
					'heat',
					'cool',
					'off',
					undefined,
					'heat',
					undefined,
				]
				const modeMap: Record<string, number> = {}
				const setpointTopics: Record<number, string> = {}
				const discoveredModes = config.discovery_payload.modes
				if (!Array.isArray(discoveredModes)) return

				for (const availableMode of availableModes) {
					const mappedMode = hassModes[availableMode]
					if (mappedMode === undefined) continue

					let hassMode = mappedMode
					let index = 1
					while (
						discoveredModes.includes(hassMode) &&
						index < allowedModes.length
					) {
						hassMode = allowedModes[index] ?? hassMode
						index++
					}

					modeMap[hassMode] = availableMode
					discoveredModes.push(hassMode)
					if (availableMode > 0) {
						const specificSetpoint = setpoints.find((valueId) =>
							valueId.endsWith('-' + availableMode),
						)
						const setpoint = specificSetpoint
							? node.values[specificSetpoint]
							: undefined
						const selectedSetpoint =
							setpoint && specificSetpoint
								? specificSetpoint
								: setpoints[0]
						if (selectedSetpoint) {
							config.values.push(selectedSetpoint)
							setpointTopics[availableMode] = selectedSetpoint
						}
					}
				}

				config.mode_map = modeMap
				config.setpoint_topic = setpointTopics
				config.default_setpoint =
					setpointTopics[ThermostatSetpointType.Heating] ??
					setpointTopics[Number(Object.keys(setpointTopics)[0])]
			} else {
				config.default_setpoint = setpoints[0]
				delete config.discovery_payload.modes
				delete config.discovery_payload.mode_state_template
			}

			const actionId = actions[0]
			if (actionId) {
				config.values.push(actionId)
				config.discovery_payload.action_topic = actionId
				const action = node.values[actionId]
				const availableActions = (action.states ?? [])
					.map((state) => state.value)
					.filter(
						(value): value is number => typeof value === 'number',
					)
				const hassActionMap: Array<string | undefined> = [
					'idle',
					'heating',
					'cooling',
					'fan',
					'idle',
					'idle',
					'fan',
					'heating',
					'heating',
					'cooling',
					'heating',
					'heating',
				]
				const actionMap: Record<number, string> = {}
				for (const availableAction of availableActions) {
					const hassAction = hassActionMap[availableAction]
					if (hassAction !== undefined) {
						actionMap[availableAction] = hassAction
					}
				}
				config.action_map = actionMap
			}

			nodeDevices.push(config)
			this.logger.log('info', 'New climate device discovered: %o', config)
			this.registry.set(node.deviceId, nodeDevices)
		} catch (error) {
			this.logger.error('Unable to discover climate device.', error)
		}
	}

	public discoverValue(node: HassNode, valueIdKey: string): void {
		if (!this.mqttEnabled || !this.config.hassDiscovery) {
			this.logger.debug(
				'Enable MQTT gateway and hass discovery to use this function',
			)
			return
		}
		if (node.virtual) return

		const valueId = node.values[valueIdKey]
		if (!valueId || this.state.discovered[valueId.id] || !node.ready) {
			return
		}

		try {
			const result = this.topics.valueTopic(node, valueId, true)
			if (
				typeof result === 'string' ||
				result === null ||
				!result.topic
			) {
				return
			}

			const valueConf = result.valueConf
			const getTopic = this.mqtt.getTopic(result.topic)
			const setTopic = result.targetTopic
				? this.mqtt.getTopic(result.targetTopic, true)
				: null
			const nodeName = this.getNodeName(node, this.config.ignoreLoc)
			let config: HassDevice | undefined
			const commandClass = valueId.commandClass
			const deviceClass =
				(valueId.endpoint === undefined
					? undefined
					: node.endpoints?.[valueId.endpoint]?.deviceClass) ??
				node.deviceClass

			switch (commandClass) {
				case CommandClasses['Binary Switch']:
				case CommandClasses['All Switch']:
				case CommandClasses['Binary Toggle Switch']:
					if (!valueId.isCurrentValue) return
					config = utils.copy(hassCfg.switch)
					break
				case CommandClasses['Barrier Operator']:
					if (!valueId.isCurrentValue) return
					config = utils.copy(hassCfg.barrier_state)
					config.discovery_payload.position_topic = getTopic
					break
				case CommandClasses['Multilevel Switch']:
				case CommandClasses['Multilevel Toggle Switch']: {
					if (!valueId.isCurrentValue || !deviceClass) return
					const specificDeviceClass = Constants.specificDeviceClass(
						deviceClass.generic,
						deviceClass.specific,
					)
					if (
						[
							'specific_type_class_a_motor_control',
							'specific_type_class_b_motor_control',
							'specific_type_class_c_motor_control',
							'specific_type_class_motor_multiposition',
							'specific_type_motor_multiposition',
						].includes(specificDeviceClass) ||
						node.deviceId === '615-0-258'
					) {
						config = utils.copy(hassCfg.cover_position)
						config.discovery_payload.command_topic = setTopic
						config.discovery_payload.position_topic = getTopic
						config.discovery_payload.set_position_topic = setTopic
						config.discovery_payload.position_template =
							'{{ value_json.value | round(0) }}'
						config.discovery_payload.position_open = 99
						config.discovery_payload.position_closed = 0
						config.discovery_payload.payload_open = 99
						config.discovery_payload.payload_close = 0
					} else {
						config = utils.copy(hassCfg.light_dimmer)
						config.discovery_payload.supported_color_modes = [
							'brightness',
						] as ColorMode[]
						config.discovery_payload.brightness_state_topic =
							getTopic
						config.discovery_payload.brightness_command_topic =
							setTopic
					}
					break
				}
				case CommandClasses['Door Lock']:
					if (!valueId.isCurrentValue) return
					config = utils.copy(hassCfg.lock)
					break
				case CommandClasses['Sound Switch']:
					if (valueId.property !== 'volume') return
					config = utils.copy(hassCfg.volume_dimmer)
					config.discovery_payload.brightness_state_topic = getTopic
					config.discovery_payload.command_topic = getTopic + '/set'
					config.discovery_payload.brightness_command_topic =
						getTopic + '/set'
					break
				case CommandClasses['Color Switch']:
					if (
						valueId.property !== 'currentColor' ||
						valueId.propertyKey !== undefined
					) {
						return
					}
					config = this.addRgbColorSwitch(node, valueId)
					break
				case CommandClasses['Central Scene']:
				case CommandClasses['Scene Activation']:
					config = utils.copy(hassCfg.central_scene)
					config.object_id = utils.joinProps(
						config.object_id,
						valueId.property,
						valueId.propertyKey ?? '',
					)
					if (valueUnit(valueId.value)) {
						config.discovery_payload.value_template =
							"{{ value_json.value.value | default('') }}"
					}
					break
				case CommandClasses['Binary Sensor']: {
					const sensorTypeName = utils.sanitizeTopic(
						valueId.property.toString().toLocaleLowerCase(),
						true,
					)
					switch (sensorTypeName) {
						case 'presence':
						case 'smoke':
						case 'gas':
							config = this.getBinarySensorConfig(sensorTypeName)
							break
						case 'lock':
							config = this.getBinarySensorConfig(
								sensorTypeName,
								true,
							)
							break
						case 'contact':
						case 'water':
							config = this.getBinarySensorConfig(
								Constants.deviceClass.sensor_binary.MOISTURE,
							)
							break
						case 'co':
						case 'co2':
						case 'tamper':
							config = this.getBinarySensorConfig(
								Constants.deviceClass.sensor_binary.SAFETY,
							)
							break
						case 'alarm':
							config = this.getBinarySensorConfig(
								Constants.deviceClass.sensor_binary.PROBLEM,
							)
							break
						case 'router':
							config = this.getBinarySensorConfig(
								Constants.deviceClass.sensor_binary
									.CONNECTIVITY,
							)
							break
						case 'battery_low':
							config = this.getBinarySensorConfig(
								Constants.deviceClass.sensor_binary.BATTERY,
							)
							break
						default:
							config = utils.copy(hassCfg.binary_sensor)
					}
					config.object_id = sensorTypeName
					if (valueConf?.device_class) {
						config.discovery_payload.device_class =
							valueConf.device_class
						config.object_id = valueConf.device_class
					}
					break
				}
				case CommandClasses['Alarm Sensor']: {
					if (valueId.property !== 'state') return
					config = this.getBinarySensorConfig(
						Constants.deviceClass.sensor_binary.PROBLEM,
					)
					const alarmType =
						typeof valueId.propertyKey === 'number'
							? AlarmSensorType[valueId.propertyKey]
							: undefined
					if (alarmType) config.object_id += '_' + alarmType
					break
				}
				case CommandClasses.Basic:
				case CommandClasses.Notification: {
					if (
						commandClass === CommandClasses.Basic &&
						valueId.property !== 'event'
					) {
						return
					}
					const states = valueId.states
					if (states?.length === 2) {
						let off = 0
						let discoveredObjectId = valueId.propertyKey
						switch (valueId.propertyKeyName) {
							case 'Access Control':
								config = this.getBinarySensorConfig(
									Constants.deviceClass.sensor_binary.LOCK,
								)
								off = 23
								break
							case 'Cover status':
								config = this.getBinarySensorConfig(
									Constants.deviceClass.sensor_binary.OPENING,
								)
								break
							case 'Door state (simple)':
								config = this.getBinarySensorConfig(
									Constants.deviceClass.sensor_binary.DOOR,
								)
								off = 1
								break
							case 'Alarm status':
							case 'Dust in device status':
							case 'Load error status':
							case 'Over-current status':
							case 'Over-load status':
							case 'Hardware status':
								config = this.getBinarySensorConfig(
									Constants.deviceClass.sensor_binary.PROBLEM,
								)
								break
							case 'Heat sensor status':
								config = this.getBinarySensorConfig(
									Constants.deviceClass.sensor_binary.HEAT,
								)
								break
							case 'Motion sensor status':
								config = this.getBinarySensorConfig(
									Constants.deviceClass.sensor_binary.MOTION,
								)
								break
							case 'Water Alarm':
								config = this.getBinarySensorConfig(
									Constants.deviceClass.sensor_binary
										.MOISTURE,
								)
								break
							case 'Sensor status':
								if (valueId.propertyName === 'Smoke Alarm') {
									config = this.getBinarySensorConfig(
										Constants.deviceClass.sensor_binary
											.SMOKE,
									)
								} else if (
									valueId.propertyName === 'Water Alarm'
								) {
									config = this.getBinarySensorConfig(
										Constants.deviceClass.sensor_binary
											.MOISTURE,
									)
								}
								discoveredObjectId = valueId.propertyName
								break
						}
						config ||= utils.copy(hassCfg.binary_sensor)
						this.setBinaryPayloadFromSensor(config, states, off)
						config.object_id = String(discoveredObjectId)
					} else if (states && states.length > 2) {
						config = utils.copy(hassCfg.sensor_generic)
						config.object_id = utils.joinProps(
							'notification',
							valueId.property,
							valueId.propertyKey ?? '',
						)
						config.discovery_payload.icon =
							valueId.propertyKey === 'Motion sensor status'
								? 'mdi:motion-sensor'
								: 'mdi:alarm-light'
						config.discovery_payload.value_template =
							this.getMappedStateTemplate(states, valueId.default)
					} else {
						return
					}
					break
				}
				case CommandClasses['Multilevel Sensor']:
				case CommandClasses.Meter:
				case CommandClasses['Pulse Meter']:
				case CommandClasses.Time:
				case CommandClasses['Energy Production']:
				case CommandClasses.Battery: {
					let sensor: SensorDefinition | null = null
					let isSensor = true
					if (commandClass === CommandClasses['Multilevel Sensor']) {
						// Skip auxiliary values because zwave-js omits their sensor metadata
						if (!valueId.ccSpecific) return
						const sensorType = valueId.ccSpecific.sensorType
						if (typeof sensorType !== 'number') return
						sensor = Constants.sensorType(sensorType)
					} else if (commandClass === CommandClasses.Meter) {
						if (!valueId.ccSpecific) return
						const meterType = valueId.ccSpecific.meterType
						const scale = valueId.ccSpecific.scale
						if (
							typeof meterType !== 'number' ||
							typeof scale !== 'number'
						) {
							return
						}
						const meter = Constants.meterType({ meterType, scale })
						if (!meter) return
						meter.objectId += '_' + valueId.property
						sensor = meter
					} else if (commandClass === CommandClasses['Pulse Meter']) {
						sensor = {
							sensor: 'pulse',
							objectId: 'meter',
							props: {},
						}
					} else if (commandClass === CommandClasses.Time) {
						if (!valueId.isCurrentValue) return
						sensor = {
							sensor: 'date',
							objectId: 'current',
							props: {
								device_class:
									Constants.deviceClass.sensor.TIMESTAMP,
							},
						}
					} else if (
						commandClass === CommandClasses['Energy Production']
					) {
						this.logger.warn(
							'Energy Production CC not supported so value cannot be discovered',
						)
						return
					} else if (commandClass === CommandClasses.Battery) {
						if (valueId.property === 'level') {
							sensor = {
								sensor: 'battery',
								objectId: 'level',
								props: {
									device_class:
										Constants.deviceClass.sensor.BATTERY,
									unit_of_measurement: '%',
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
							config = this.getBinarySensorConfig(
								Constants.deviceClass.sensor_binary.BATTERY,
							)
							isSensor = false
						} else {
							return
						}
					}

					if (!sensor) return
					if (isSensor) config = utils.copy(hassCfg.sensor_generic)
					if (!config) return
					config.object_id = utils.joinProps(
						sensor.sensor,
						sensor.objectId,
					)
					let unit = valueId.unit ?? valueUnit(valueId.value)
					if (unit) {
						if (unit === 'seconds') unit = 's'
						else if (unit === 'minutes') unit = 'min'
						else if (unit === 'hours') unit = 'h'
						else if (unit === 'kVar') unit = 'kvar'
						else if (unit === 'kVarh') unit = 'kvarh'
						config.discovery_payload.unit_of_measurement = unit
					}
					Object.assign(config.discovery_payload, sensor.props ?? {})
					if (valueConf?.device_class) {
						config.discovery_payload.device_class =
							valueConf.device_class
						config.object_id = valueConf.device_class
					}
					if (valueConf?.icon) {
						config.discovery_payload.icon = valueConf.icon
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
					let type: string = valueId.type
					if (
						type === 'number' &&
						valueId.min === 0 &&
						valueId.max === 1
					) {
						type = 'boolean'
					}
					if (type === 'boolean') {
						config = utils.copy(hassCfg.config_switch)
					} else if (type === 'number') {
						config = utils.copy(hassCfg.config_number)
						if (valueId.min !== 1) {
							config.discovery_payload.min = valueId.min
						}
						if (valueId.max !== 100) {
							config.discovery_payload.max = valueId.max
						}
					} else {
						return
					}
					config.object_id = utils.joinProps(
						config.object_id,
						valueId.property,
						valueId.propertyKey ?? '',
					)
					config.discovery_payload.enabled_by_default =
						!!valueConf?.ccConfigEnableDiscovery
					break
				}
				default:
					return
			}

			if (!config) return
			const payload = config.discovery_payload
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
					config.type,
				)
			) {
				payload.json_attributes_topic = payload.state_topic
			}
			payload.device = this.deviceInfo(node, nodeName)
			if (valueId.endpoint) config.object_id += '_' + valueId.endpoint
			config.object_id = utils
				.sanitizeTopic(config.object_id, true)
				.toLocaleLowerCase()
			if (node.hassDevices[config.type + '_' + config.object_id]) {
				config.object_id += '_' + valueId.endpoint
			}
			payload.name = this.getEntityName(
				node,
				valueId,
				config,
				this.config.entityTemplate,
				this.config.ignoreLoc,
			)
			payload.unique_id =
				UID_DISCOVERY_PREFIX +
				this.zwave.homeHex +
				'_' +
				utils.sanitizeTopic(valueId.id, true)
			config.discoveryTopic = this.getDiscoveryTopic(config, nodeName)
			config.values ??= []
			if (!config.values.includes(valueIdKey)) {
				config.values.push(valueIdKey)
			}
			if (valueId.targetValue) config.values.push(valueId.targetValue)
			config.persistent = false
			config.ignoreDiscovery = false
			node.hassDevices[config.type + '_' + config.object_id] = config
			this.publishDiscovery(config, node.id)
		} catch (error) {
			this.logger.error(
				`Error while discovering value ${valueId.id} of node ${
					node.id
				}: ${getErrorMessage(error)}`,
				error,
			)
		}
	}

	public transformPayload(payload: unknown, valueId: HassValue): unknown {
		const hassDevice = this.state.discovered[valueId.id]
		if (!hassDevice) return payload

		if (
			valueId.list &&
			typeof payload === 'string' &&
			Number.isNaN(Number.parseInt(payload))
		) {
			if (
				valueId.commandClass ===
					CommandClasses['Thermostat Fan Mode'] &&
				hassDevice.fan_mode_map
			) {
				return hassDevice.fan_mode_map[payload]
			}
			if (
				valueId.commandClass === CommandClasses['Thermostat Mode'] &&
				hassDevice.mode_map
			) {
				return hassDevice.mode_map[payload]
			}
		} else if (
			hassDevice.type === 'cover' &&
			valueId.property === 'targetValue' &&
			payload === (hassDevice.discovery_payload.payload_stop ?? 'STOP')
		) {
			this.zwave.writeCoverStop(valueId).catch(() => {})
			return null
		}

		return payload
	}

	public updateClimateDiscovery(
		valueId: HassValue,
		node: HassNode,
		changed: boolean,
	): void {
		const hassDevice = this.state.discovered[valueId.id]
		if (
			!this.config.hassDiscovery ||
			!changed ||
			valueId.commandClass !== CommandClasses['Thermostat Mode'] ||
			!hassDevice
		) {
			return
		}

		const isOff = hassDevice.mode_map
			? hassDevice.mode_map.off === valueId.value
			: false
		if (!hassDevice.setpoint_topic || isOff) return

		const mode =
			typeof valueId.value === 'number' ? valueId.value : undefined
		const setpointId =
			mode === undefined ? undefined : hassDevice.setpoint_topic[mode]
		const setpoint = setpointId ? node.values[setpointId] : undefined
		if (!setpoint) return

		const setTopic = this.mqtt.getTopic(
			this.requireValueTopic(node, setpoint),
		)
		if (setTopic !== hassDevice.discovery_payload.temperature_state_topic) {
			hassDevice.discovery_payload.temperature_state_topic = setTopic
			hassDevice.discovery_payload.temperature_command_topic =
				setTopic + '/set'
			this.publishDiscovery(hassDevice, node.id)
		}
	}

	public discoverValueIfNeeded(node: HassNode, valueId: HassValue): void {
		if (this.config.hassDiscovery && !this.state.discovered[valueId.id]) {
			this.discoverValue(node, this.getIdWithoutNode(valueId))
		}
	}

	public onNodeInited(node: HassNode): void {
		if (!this.mqttEnabled || !this.config.hassDiscovery) return
		for (const device of Object.values(node.hassDevices)) {
			if (device.persistent) this.publishDiscovery(device, node.id)
		}
		this.discoverClimates(node)
		for (const device of this.registry.get(node.deviceId)) {
			this.discoverDevice(node, device)
		}
		for (const id of this.getPriorityCCFirst(node.values)) {
			this.discoverValue(node, id)
		}
	}

	public removeNode(node: Pick<HassNode, 'id'>): void {
		const prefix = node.id + '-'
		for (const id of Object.keys(this.state.discovered)) {
			if (id.startsWith(prefix)) delete this.state.discovered[id]
		}
	}

	private getNodeName(
		node: Pick<HassNode, 'id' | 'loc' | 'name'>,
		ignoreLoc = false,
	): string {
		return (
			(!ignoreLoc && node.loc ? node.loc + '-' : '') +
			(node.name ? node.name : HASS_NODE_PREFIX + node.id)
		)
	}

	private getPriorityCCFirst(values: Record<string, HassValue>): string[] {
		const prioritizedValueIds: string[] = []
		for (const [id, value] of Object.entries(values)) {
			if (value.commandClass === CommandClasses['Color Switch']) {
				prioritizedValueIds.unshift(id)
			} else {
				prioritizedValueIds.push(id)
			}
		}
		return prioritizedValueIds
	}

	private getIdWithoutNode(valueId: HassValue): string {
		return valueId.id.replace(valueId.nodeId + '-', '')
	}

	private deviceInfo(
		node: {
			id: number
			manufacturer?: string
			productDescription?: string
			productLabel?: string
			name?: string
			firmwareVersion?: string
			loc?: string
		},
		nodeName: string,
	): DeviceInfo {
		const deviceInfo: DeviceInfo = {
			identifiers: [
				UID_DISCOVERY_PREFIX + this.zwave.homeHex + '_node' + node.id,
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
		node: HassNode,
		payload: HassDiscoveryPayload,
	): void {
		const nodeAvailability: Record<string, unknown> = {
			payload_available: 'true',
			payload_not_available: 'false',
			topic: this.mqtt.getTopic(this.topics.nodeTopic(node)) + '/status',
		}
		payload.availability = [
			nodeAvailability,
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
		if (this.config.payloadType !== PayloadType.RAW) {
			nodeAvailability.value_template =
				"{{'true' if value_json.value else 'false'}}"
		}
		payload.availability_mode = 'all'
	}

	private getDiscoveryTopic(
		hassDevice: HassDevice,
		nodeName: string,
	): string {
		return `${hassDevice.type}/${utils.sanitizeTopic(nodeName, true)}/${
			hassDevice.object_id
		}/config`
	}

	private getMappedValuesTemplate(
		valueMap: Record<string | number, string | number | boolean>,
		defaultValue: string,
	): string {
		const map: string[] = []
		for (const key of Object.keys(valueMap)) {
			map.push(`${key}: "${valueMap[key]}"`)
		}
		return `{{ {${map.join(
			', ',
		)}}[value_json.value] | default('${defaultValue}') }}`
	}

	private getMappedValuesInverseTemplate(
		valueMap: Record<string, number>,
		defaultValue: string,
	): string {
		const map: string[] = []
		for (const [key, value] of Object.entries(valueMap)) {
			map.push(`${value}: "${key}"`)
		}
		return `{{ {${map.join(
			', ',
		)}}[value_json.value] | default('${defaultValue}') }}`
	}

	private getMappedStateTemplate(
		states: HassValueState[],
		defaultValueKey: unknown,
	): string {
		const map: string[] = []
		let defaultValue = 'value_json.value'
		for (const state of states) {
			map.push(
				`${
					typeof state.value === 'number'
						? state.value
						: '"' + state.value + '"'
				}: "${state.text}"`,
			)
			if (state.value === defaultValueKey) {
				defaultValue = `'${state.text}'`
			}
		}
		return `{{ {${map.join(
			',',
		)}}[value_json.value] | default(${defaultValue}) }}`
	}

	private setBinaryPayloadFromSensor(
		config: HassDevice,
		states: HassValueState[],
		offStateValue = 0,
	): HassDevice {
		const stateKeys = states.map((state) => state.value)
		if (stateKeys[0] === offStateValue) {
			config.discovery_payload.payload_off = stateKeys[0]
			config.discovery_payload.payload_on = stateKeys[1]
		} else {
			config.discovery_payload.payload_off = stateKeys[1]
			config.discovery_payload.payload_on = stateKeys[0]
		}
		return config
	}

	private getBinarySensorConfig(
		deviceClass: string,
		reversePayload = false,
	): HassDevice {
		const config = utils.copy(hassCfg.binary_sensor)
		config.discovery_payload.device_class = deviceClass
		if (reversePayload) {
			config.discovery_payload.payload_on = false
			config.discovery_payload.payload_off = true
		}
		return config
	}

	private setDiscoveryValue(
		payload: HassDiscoveryPayload,
		property: string,
		node: { values: Record<string, { value?: unknown }> },
	): void {
		const valueIdKey = payload[property]
		if (typeof valueIdKey !== 'string') return
		const valueId = node.values[valueIdKey]
		if (valueId?.value != null) payload[property] = valueId.value
	}

	private addRgbColorSwitch(
		node: HassNode,
		currentColorValue: HassValue,
	): HassDevice {
		const config = utils.copy(hassCfg.light_rgb_dimmer)
		const currentColorTopics = this.requireTopicResult(
			this.topics.valueTopic(node, currentColorValue, true),
		)
		const endpoint = currentColorValue.endpoint
		const supportedColors: ColorMode[] = ['rgb']
		config.discovery_payload.supported_color_modes = supportedColors
		config.values = []
		config.discovery_payload.rgb_state_topic = this.mqtt.getTopic(
			currentColorTopics.topic,
		)
		if (currentColorTopics.targetTopic) {
			config.discovery_payload.rgb_command_topic = this.mqtt.getTopic(
				currentColorTopics.targetTopic,
				true,
			)
		}

		let brightnessValue: string | undefined
		let switchValue: string | undefined
		if (
			node.values[
				`${CommandClasses['Multilevel Switch']}-${endpoint}-currentValue`
			]
		) {
			brightnessValue = `${CommandClasses['Multilevel Switch']}-${endpoint}-currentValue`
		} else if (
			endpoint === 0 &&
			node.values[`${CommandClasses['Multilevel Switch']}-1-currentValue`]
		) {
			brightnessValue = `${CommandClasses['Multilevel Switch']}-1-currentValue`
		} else if (
			node.values[
				`${CommandClasses['Binary Switch']}-${endpoint}-currentValue`
			]
		) {
			switchValue = `${CommandClasses['Binary Switch']}-${endpoint}-currentValue`
		}

		let discoveredStateTopic: string | undefined
		let discoveredCommandTopic: string | undefined
		if (brightnessValue || switchValue) {
			const valueId = brightnessValue ?? switchValue
			if (!valueId) throw new Error('Missing RGB control value')
			const valueIdState = node.values[valueId]
			const topics = this.requireTopicResult(
				this.topics.valueTopic(node, valueIdState, true),
			)
			Reflect.apply(config.values.push, config.values, [
				valueId,
				valueIdState.targetValue,
			])
			discoveredStateTopic = this.mqtt.getTopic(topics.topic)
			if (topics.targetTopic) {
				discoveredCommandTopic = this.mqtt.getTopic(
					topics.targetTopic,
					true,
				)
			}
		}

		if (brightnessValue) {
			supportedColors.push('brightness')
			config.discovery_payload.brightness_state_topic =
				discoveredStateTopic
			config.discovery_payload.brightness_command_topic =
				discoveredCommandTopic
			config.discovery_payload.state_topic = discoveredStateTopic
			config.discovery_payload.command_topic = discoveredCommandTopic
		} else if (switchValue) {
			supportedColors.push('onoff')
			config.discovery_payload.state_topic = discoveredStateTopic
			config.discovery_payload.command_topic = discoveredCommandTopic
			config.discovery_payload.state_value_template =
				'{{ value_template.json }}'
			config.discovery_payload.on_command_type = 'last'
		}

		const whiteValue =
			node.values[
				`${CommandClasses['Color Switch']}-${endpoint}-currentColor-0`
			]
		if (whiteValue && currentColorValue) {
			supportedColors.push('white')
			config.discovery_payload.color_temp_state_topic =
				config.discovery_payload.rgb_state_topic
			config.discovery_payload.color_temp_command_topic =
				config.discovery_payload.rgb_command_topic
			config.discovery_payload.color_temp_command_template =
				"{{ {'warmWhite': ((value - 245)|round(0)), 'coldWhite': (255 - (value - 245))|round(0)}|to_json }}"
			config.discovery_payload.color_temp_value_template =
				"{{ '%03d%03d' | format((value_json.value.warmWhite || 0), (value_json.value.coldWhite || 0)) }}"
		}
		return config
	}

	private getEntityName(
		node: HassNode,
		valueId: HassValue | undefined,
		config: HassDevice,
		entityTemplate = '%ln_%o',
		ignoreLoc = false,
	): string {
		entityTemplate ||= '%ln_%o'
		let propertyKey: string | undefined = config.type
		let propertyName: string | undefined = config.type
		let property: string = config.type
		let label: string | undefined = config.object_id
		if (valueId) {
			property = valueId.property?.toString()
			propertyKey = valueId.propertyKey?.toString()
			propertyName = valueId.propertyName?.toString()
			label = valueId.label
		}
		return entityTemplate
			.replace(/%nid/g, HASS_NODE_PREFIX + node.id)
			.replace(/%ln/g, this.getNodeName(node, ignoreLoc))
			.replace(/%loc/g, node.loc || '')
			.replace(/%pk/g, String(propertyKey))
			.replace(/%pn/g, String(propertyName))
			.replace(/%p/g, property)
			.replace(/%o/g, config.object_id)
			.replace(/%n/g, node.name || HASS_NODE_PREFIX + node.id)
			.replace(/%l/g, String(label))
	}

	private requireValueTopic(node: HassNode, value: HassValue): string {
		const result = this.topics.valueTopic(node, value)
		if (typeof result !== 'string') {
			throw new Error(`No topic for ${value.id}`)
		}
		return result
	}

	private requireTopicResult(
		result: string | HassValueTopic | null,
	): HassValueTopic {
		if (typeof result === 'string' || result === null) {
			throw new Error("Can't find topics")
		}
		return result
	}
}
