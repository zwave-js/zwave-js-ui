/* eslint-disable no-case-declarations */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-eval */
/* eslint-disable one-var */
'use strict'

import * as fs from 'fs'
import * as path from 'path'
import * as utils from '../lib/utils'
import { AlarmSensorType } from 'zwave-js'
import { CommandClasses, ValueID } from '@zwave-js/core'
import { socketEvents } from '../lib/SocketManager'
import * as Constants from './Constants'
import { module } from '../lib/logger'
import hassCfg from '../hass/configurations'
import hassDevices from '../hass/devices'
import { storeDir } from '../config/app'
import { GatewayConfig, GatewayValue, HassDevice, Z2MNode, Z2MValueId, Z2MValueIdState } from '../types/index'
import { IClientPublishOptions } from 'mqtt'
import MqttClient from './MqttClient'
import ZwaveClient from './ZwaveClient'


const logger = module('Gateway')

const NODE_PREFIX = 'nodeID_'

const GATEWAY_TYPE = {
  VALUEID: 0,
  NAMED: 1,
  MANUAL: 2
}

const PAYLOAD_TYPE = {
  TIME_VALUE: 0,
  VALUEID: 1,
  RAW: 2
}

const CUSTOM_DEVICES = storeDir + '/customDevices'
let allDevices = hassDevices // will contain customDevices + hassDevices

// watcher initiates a watch on a file. if this fails (e.g., because the file
// doesn't exist), instead watch the directory. If the directory watch
// triggers, cancel it and try to watch the file again. Meanwhile spam `fn()`
// on any change, trusting that it's idempotent.
const watchers = new Map()
const watch = (filename: string, fn: () => void) => {
  try {
    watchers.set(
      filename,
      fs.watch(filename, (e: string) => {
        fn()
        if (e === 'rename') {
          watchers.get(filename).close()
          watch(filename, fn)
        }
      })
    )
  } catch {
    watchers.set(
      filename,
      fs.watch(path.dirname(filename), (e, f) => {
        if (!f || f === 'customDevices.js' || f === 'customDevices.json') {
          watchers.get(filename).close()
          watch(filename, fn)
          fn()
        }
      })
    )
  }
}

const customDevicesJsPath = CUSTOM_DEVICES + '.js'
const customDevicesJsonPath = CUSTOM_DEVICES + '.json'

let lastCustomDevicesLoad = null
// loadCustomDevices attempts to load a custom devices file, preferring `.js`
// but falling back to `.json` only if a `.js` file does not exist. It stores
// a sha of the loaded data, and will skip re-loading any time the data has
// not changed.
const loadCustomDevices = () => {
  let loaded = ''
  let devices = null

  try {
    if (fs.existsSync(customDevicesJsPath)) {
      loaded = customDevicesJsPath
      devices = require(CUSTOM_DEVICES)
    } else if (fs.existsSync(customDevicesJsonPath)) {
      loaded = customDevicesJsonPath
      devices = JSON.parse(fs.readFileSync(loaded).toString())
    } else {
      return
    }
  } catch (error) {
    logger.error(`Failed to load ${loaded}:`, error)
    return
  }

  const sha = require('crypto')
    .createHash('sha256')
    .update(JSON.stringify(devices))
    .digest('hex')
  if (lastCustomDevicesLoad === sha) {
    return
  }

  logger.info(`Loading custom devices from ${loaded}`)

  lastCustomDevicesLoad = sha

  allDevices = Object.assign({}, hassDevices, devices)
  logger.info(
    `Loaded ${Object.keys(devices).length} custom Hass devices configurations`
  )
}

loadCustomDevices()
watch(customDevicesJsPath, loadCustomDevices)
watch(customDevicesJsonPath, loadCustomDevices)

export default class Gateway {

  config: GatewayConfig
  mqtt: MqttClient
  zwave: ZwaveClient
  topicValues: {[key: string]: Z2MValueId}
  discovered: {[key: string]: HassDevice}
  topicLevels: number[]
  closed: boolean
 
  constructor (config: GatewayConfig, zwave: ZwaveClient, mqtt: MqttClient) {
    this.config = config || { type: 1 }
    // clients
    this.mqtt = mqtt
    this.zwave = zwave
  }

  async start () {
    // gateway configuration
    this.config.values = this.config.values || []

    // Object where keys are topic and values can be both zwave valueId object
    // or a valueConf if the topic is a broadcast topic
    this.topicValues = {}

    this.discovered = {}

    this.closed = false

    // topic levels for subscribes using wildecards
    this.topicLevels = []

    if (this.mqtt) {
      this.mqtt.on('writeRequest', this._onWriteRequest.bind(this))
      this.mqtt.on('broadcastRequest', this._onBroadRequest.bind(this))
      this.mqtt.on('multicastRequest', this._onMulticastRequest.bind(this))
      this.mqtt.on('apiCall', this._onApiRequest.bind(this))
      this.mqtt.on('hassStatus', this._onHassStatus.bind(this))
      this.mqtt.on('brokerStatus', this._onBrokerStatus.bind(this))
    }

    if (this.zwave) {
      this.zwave.on('valueChanged', this._onValueChanged.bind(this))
      this.zwave.on('nodeStatus', this._onNodeStatus.bind(this))
      this.zwave.on('notification', this._onNotification.bind(this))
      this.zwave.on('nodeRemoved', this._onNodeRemoved.bind(this))

      if (this.config.sendEvents) {
        this.zwave.on('event', this._onEvent.bind(this))
      }

      // this is async but doesn't need to be awaited
      this.zwave.connect()
    } else {
      logger.error('Zwave settings are not valid')
    }
  }

  /**
   * Parse the value of the payload received from mqtt
   * based on the type of the payload and the gateway config
   */
  parsePayload (payload: any, valueId: Z2MValueId, valueConf: GatewayValue) {
    try {
      payload =
        typeof payload === 'object' && utils.hasProperty(payload, 'value')
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

      if (valueId.commandClass === CommandClasses['Binary Toggle Switch']) {
        payload = 1
      } else if (
        valueId.commandClass === CommandClasses['Multilevel Toggle Switch']
      ) {
        payload = valueId.value > 0 ? 0 : 0xff
      }

      const hassDevice = this.discovered[valueId.id]

      // Hass payload parsing
      if (hassDevice) {
        // map modes coming from hass
        if (valueId.list && isNaN(payload)) {
          // for thermostat_fan_mode command class use the fan_mode_map
          if (
            valueId.commandClass === CommandClasses['Thermostat Fan Mode'] &&
            hassDevice.fan_mode_map
          ) {
            payload = hassDevice.fan_mode_map[payload]
          } else if (
            valueId.commandClass === CommandClasses['Thermostat Mode'] &&
            hassDevice.mode_map
          ) {
            // for other command classes use the mode_map
            payload = hassDevice.mode_map[payload]
          }
        }
      }

      if (valueConf) {
        if (this._isValidOperation(valueConf.postOperation)) {
          let op = valueConf.postOperation

          // revert operation to write
          if (op.includes('/')) op = op.replace(/\//, '*')
          else if (op.includes('*')) op = op.replace(/\*/g, '/')
          else if (op.includes('+')) op = op.replace(/\+/, '-')
          else if (op.includes('-')) op = op.replace(/-/, '+')

          payload = eval(payload + op)
        }

        if (valueConf.parseReceive) {
          const node = this.zwave.nodes.get(valueId.nodeId)
          const parsedVal = this._evalFunction(
            valueConf.receiveFunction,
            valueId,
            payload,
            node
          )
          if (parsedVal != null) {
            payload = parsedVal
          }
        }
      }
    } catch (error) {
      logger.error(
        `Error while parsing payload ${payload} for valueID ${valueId}`
      )
    }

    return payload
  }

  /**
   * Method used to close clients connection, use this before destroy
   */
  async close () {
    this.closed = true

    logger.info('Closing Gateway...')

    if (this.mqtt) {
      await this.mqtt.close()
    }

    if (this.zwave) {
      await this.zwave.close()
    }
  }

  /**
   * Calculates the node topic based on gateway settings
   */
  nodeTopic (node: Z2MNode) {
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
    // eslint-disable-next-line no-redeclare
    for (let i = 0; i < topic.length; i++) {
      topic[i] = utils.sanitizeTopic(topic[i])
    }

    return topic.join('/')
  }

  /**
   * Calculates the valueId topic based on gateway settings
   *
  */
  valueTopic (node: Z2MNode, valueId: Z2MValueId, returnObject: boolean = false) {
    const topic = []
    let valueConf: GatewayValue = undefined

    // check if this value is in configuration values array
    const values = this.config.values.filter((v: GatewayValue) => v.device === node.deviceId)
    if (values && values.length > 0) {
      const vID = this._getIdWithoutNode(valueId)
      valueConf = values.find((v: GatewayValue) => v.value.id === vID)
    }

    if (valueConf && valueConf.topic) {
      topic.push(node.name ? node.name : NODE_PREFIX + valueId.nodeId)
      topic.push(valueConf.topic)
    }

    let targetTopic: string | { topic: string; valueConf: any; targetTopic: any }

    if (returnObject && valueId.targetValue) {
      const targetValue = node.values[valueId.targetValue]
      if (targetValue) {
        targetTopic = this.valueTopic(node, targetValue, false)
      }
    }

    // if is not in configuration values array get the topic
    // based on gateway type if manual type this will be skipped
    if (topic.length === 0) {
      switch (this.config.type) {
        case GATEWAY_TYPE.NAMED:
          topic.push(node.name ? node.name : NODE_PREFIX + valueId.nodeId)
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
            topic.push(node.name ? node.name : NODE_PREFIX + valueId.nodeId)
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
        targetTopic: targetTopic
      }

      return returnObject ? toReturn : toReturn.topic
    } else {
      return null
    }
  }

  /**
   * Rediscover all hass devices of this node
   */
  rediscoverNode (nodeID: number) {
    const node = this.zwave.nodes.get(nodeID)
    if (node) {
      // delete all discovered values
      this._onNodeRemoved(node)
      node.hassDevices = {}

      // rediscover all values
      const nodeDevices = allDevices[node.deviceId] || []
      nodeDevices.forEach((device: any) => this.discoverDevice(node, device))

      // discover node values (that are not part of a device)
      // iterate prioritized first, then the remaining
      for (const id of this._getPriorityCCFirst(node.values)) {
        this.discoverValue(node, id)
      }

      this.zwave.sendToSocket(socketEvents.nodeUpdated, node)
    }
  }

  /**
   * Disable the discovery of all devices of this node
   *
   */
  disableDiscovery (nodeID: any) {
    const node = this.zwave.nodes.get(nodeID)
    if (node && node.hassDevices) {
      for (const id in node.hassDevices) {
        node.hassDevices[id].ignoreDiscovery = true
      }

      this.zwave.sendToSocket(socketEvents.nodeUpdated, node)
    }
  }

  /**
   * Publish a discovery payload to discover a device in hass using mqtt auto discovery
   *
   */
  publishDiscovery (hassDevice: HassDevice, nodeId: any, options: { deleteDevice?: boolean; forceUpdate?: boolean } = {}) {
    try {
      logger.log(
        'debug',
        `${options.deleteDevice ? 'Removing' : 'Publishing'} discovery: %o`,
        hassDevice
      )

      this.setDiscovery(nodeId, hassDevice, options.deleteDevice)

      if (this.config.payloadType === PAYLOAD_TYPE.RAW) {
        const p = hassDevice.discovery_payload
        const template =
          'value' +
          (p.hasOwnProperty('payload_on') && p.hasOwnProperty('payload_off')
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
        this.mqtt.publish(
          hassDevice.discoveryTopic,
          options.deleteDevice ? '' : hassDevice.discovery_payload,
          { qos: 0, retain: this.config.retainedDiscovery || false },
          this.config.discoveryPrefix
        )
      }

      if (options.forceUpdate) {
        this.zwave.updateDevice(hassDevice, nodeId, options.deleteDevice)
      }
    } catch (error) {
      logger.log(
        'error',
        `Error while publishing discovery for node ${nodeId}: ${error.message}. Hass device: %o`,
        hassDevice
      )
    }
  }

  /**
   * Set internal discovery reference of a valueId
   *
   */
  setDiscovery (nodeId: string, hassDevice: HassDevice, deleteDevice: boolean = false) {
    for (let k = 0; k < hassDevice.values.length; k++) {
      const vId = nodeId + '-' + hassDevice.values[k]
      if (deleteDevice && this.discovered[vId]) {
        delete this.discovered[vId]
      } else {
        this.discovered[vId] = hassDevice
      }
    }
  }

  /**
   * Rediscover all nodes and their values/devices
   *
   */
  rediscoverAll () {
    // skip discovery if discovery not enabled
    if (!this.config.hassDiscovery) return

    const nodes = this.zwave ? this.zwave.nodes : []
    for (const [nodeId, node] of nodes) {
      const devices = node.hassDevices || {}
      for (const id in devices) {
        const d = devices[id]
        if (d && d.discoveryTopic && d.discovery_payload) {
          this.publishDiscovery(d, nodeId)
        }
      } // end foreach hassdevice
    }
  }

  /**
   * Discover an hass device (from customDevices.js|json)
   */
  discoverDevice (node: Z2MNode, hassDevice: HassDevice) {
    const hassID = hassDevice
      ? hassDevice.type + '_' + hassDevice.object_id
      : null

    try {
      if (hassID && !node.hassDevices[hassID]) {
        // discover the device
        let payload: {[key: string]: any}

        // copy the configuration without edit the original object
        hassDevice = utils.copy(hassDevice)

        if (hassDevice.type === 'climate') {
          payload = hassDevice.discovery_payload

          const mode = node.values[payload.mode_state_topic]
          let setId: string | number

          if (mode !== undefined) {
            setId =
              hassDevice.setpoint_topic && hassDevice.setpoint_topic[mode.value]
                ? hassDevice.setpoint_topic[mode.value]
                : hassDevice.default_setpoint
            // only setup modes if a state topic was defined
            payload.mode_state_template = this._getMappedValuesInverseTemplate(
              hassDevice.mode_map,
              'off'
            )
            payload.mode_state_topic = this.mqtt.getTopic(
              this.valueTopic(node, mode)
            )
            payload.mode_command_topic = payload.mode_state_topic + '/set'
          } else {
            setId = hassDevice.default_setpoint
          }

          // set properties dynamically using their configuration values
          this._setDiscoveryValue(payload, 'max_temp', node)
          this._setDiscoveryValue(payload, 'min_temp', node)

          const setpoint = node.values[setId]
          payload.temperature_state_topic = this.mqtt.getTopic(
            this.valueTopic(node, setpoint)
          )
          payload.temperature_command_topic =
            payload.temperature_state_topic + '/set'

          const action = node.values[payload.action_topic]
          if (action) {
            payload.action_topic = this.mqtt.getTopic(
              this.valueTopic(node, action)
            )
            if (hassDevice.action_map) {
              payload.action_template = this._getMappedValuesTemplate(
                hassDevice.action_map,
                'idle'
              )
            }
          }

          const fan = node.values[payload.fan_mode_state_topic]
          if (fan !== undefined) {
            payload.fan_mode_state_topic = this.mqtt.getTopic(
              this.valueTopic(node, fan)
            )
            payload.fan_mode_command_topic =
              payload.fan_mode_state_topic + '/set'

            if (hassDevice.fan_mode_map) {
              payload.fan_mode_state_template = this._getMappedValuesInverseTemplate(
                hassDevice.fan_mode_map,
                'auto'
              )
            }
          }

          const currTemp = node.values[payload.current_temperature_topic]
          if (currTemp !== undefined) {
            payload.current_temperature_topic = this.mqtt.getTopic(
              this.valueTopic(node, currTemp)
            )

            if (currTemp.unit) {
              payload.temperature_unit = currTemp.unit.includes('C') ? 'C' : 'F'
            }
            // hass will default the precision to 0.1 for Celsius and 1.0 for Fahrenheit.
            // 1.0 is not granular enough as a default and there seems to be no harm in making it more precise.
            if (!payload.precision) payload.precision = 0.1
          }
        } else {
          payload = hassDevice.discovery_payload

          const topics = {}

          // populate topics object with valueId: valueTopic
          for (let i = 0; i < hassDevice.values.length; i++) {
            const v = hassDevice.values[i] // the value id
            topics[v] = node.values[v]
              ? this.mqtt.getTopic(this.valueTopic(node, node.values[v]))
              : null
          }

          // set the correct command/state topics
          for (const key in payload) {
            if (key.indexOf('topic') >= 0 && topics[payload[key]]) {
              payload[key] =
                topics[payload[key]] +
                ((key.indexOf('command') >= 0 || key.indexOf('set_')) >= 0
                  ? '/set'
                  : '')
            }
          }
        }

        if (payload) {
          const nodeName = this._getNodeName(node, this.config.ignoreLoc)

          // Set device information using node info
          payload.device = this._deviceInfo(node, nodeName)

          hassDevice.object_id = utils
            .sanitizeTopic(hassDevice.object_id, true)
            .toLocaleLowerCase()

          // Set a friendly name for this component
          payload.name = this._getEntityName(
            node,
            undefined,
            hassDevice,
            this.config.entityTemplate,
            this.config.ignoreLoc
          )

          // set a unique id for the component
          payload.unique_id =
            'zwavejs2mqtt_' +
            this.zwave.homeHex +
            '_Node' +
            node.id +
            '_' +
            hassDevice.object_id

          const discoveryTopic = this._getDiscoveryTopic(hassDevice, nodeName)
          hassDevice.discoveryTopic = discoveryTopic

          // This configuration is not stored in nodes.json
          hassDevice.persistent = false

          hassDevice.ignoreDiscovery = !!hassDevice.ignoreDiscovery

          node.hassDevices[hassID] = hassDevice

          this.publishDiscovery(hassDevice, node.id)
        }
      }
    } catch (error) {
      logger.error(
        `Error while discovering device ${hassID} of node ${node.id}: ${error.message}`,
        error
      )
    }
  }

  /**
   * Discover climate devices
   *
   */
  discoverClimates (node: Z2MNode) {
    // https://github.com/zwave-js/node-zwave-js/blob/master/packages/config/config/deviceClasses.json#L177
    // check if device it's a thermostat
    if (!node.deviceClass || node.deviceClass.generic !== 0x08) {
      return
    }

    try {
      const nodeDevices = allDevices[node.deviceId] || []

      // skip if there is already a climate device
      if (
        nodeDevices.length > 0 &&
        nodeDevices.find((d: { type: string }) => d.type === 'climate')
      ) {
        return
      }

      // arrays of strings valueIds (without the node prefix)
      const setpoints = []
      const temperatures = []
      const modes = []
      const actions = []

      for (const vId in node.values) {
        const v = node.values[vId]
        if (
          v.commandClass === CommandClasses['Thermostat Setpoint'] &&
          v.property === 'setpoint'
        ) {
          setpoints.push(vId)
        } else if (
          v.commandClass === CommandClasses['Multilevel Sensor'] &&
          v.property === 'Air temperature'
        ) {
          temperatures.push(vId)
        } else if (
          v.commandClass === CommandClasses['Thermostat Mode'] &&
          v.property === 'mode'
        ) {
          modes.push(vId)
        } else if (
          v.commandClass === CommandClasses['Thermostat Operating State'] &&
          v.property === 'state'
        ) {
          actions.push(vId)
        }
      }

      // TODO: if the device supports multiple endpoints how could we identify the correct one to use?
      const temperatureId = temperatures[0]

      if (setpoints.length === 0) {
        logger.warn(
          'Unable to discover climate device, there is no valid setpoint valueId'
        )
        return
      }

      // generic configuration
      const config = utils.copy(hassCfg.thermostat)
      // set empty config.values
      config.values = []

      if (temperatureId) {
        config.discovery_payload.current_temperature_topic = temperatureId
        config.values.push(temperatureId)
      } else {
        delete config.discovery_payload.current_temperature_template
        delete config.discovery_payload.current_temperature_topic
      }

      // take the first as valid
      const modeId = modes[0]

      // some thermostats could support just one mode so haven't a thermostat mode CC
      if (modeId) {
        config.values.push(modeId)

        const mode = node.values[modeId]

        config.discovery_payload.mode_state_topic = modeId
        config.discovery_payload.mode_command_topic = modeId + '/set'

        // [0, 1, 2 ... ] (['off', 'heat', 'cold', ...])
        const availableModes = mode.states.map((s: { value: any }) => s.value)

        // Hass accepted modes as per: https://www.home-assistant.io/integrations/climate.mqtt/#modes
        const allowedModes = ['off', 'heat', 'cool', 'auto', 'dry', 'fan_only']
        // Zwave modes: https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/commandclass/ThermostatModeCC.ts#L54
        const hassModes = [
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
          'heat',
          undefined // manufacturer specific
        ]

        config.mode_map = {}
        config.setpoint_topic = {}

        // for all available modes update the modes map and setpoint topics
        for (const m of availableModes) {
          if (hassModes[m] === undefined) continue

          let hM = hassModes[m]

          // it could happen that mode_map already have defined a mode for this value, in this case
          // map that mode to the first one available in the allowed hass modes
          let i = 1 // skip 'off'
          while (
            config.discovery_payload.modes.includes(hM) &&
            i < allowedModes.length
          ) {
            hM = allowedModes[i++]
          }

          config.mode_map[hM] = availableModes[m]
          config.discovery_payload.modes.push(hM)
          if (m > 0) {
            // find the mode setpoint, ignore off
            const setId = setpoints.find(v => v.endsWith('-' + m))
            const setpoint = node.values[setId]
            if (setpoint) {
              config.values.push(setId)
              config.setpoint_topic[m] = setId
            }
          }
        }

        // set the default setpoint to 'heat' or to the first setpoint available
        config.default_setpoint =
          config.setpoint_topic[1] ||
          config.setpoint_topic[Object.keys(config.setpoint_topic)[0]]
      } else {
        config.default_setpoint = setpoints[0]
        delete config.discovery_payload.modes
        delete config.discovery_payload.mode_state_template
      }

      if (actions.length > 0) {
        const actionId = actions[0]
        config.values.push(actionId)
        config.discovery_payload.action_topic = actionId

        const action = node.values[actionId]
        // [0, 1, 2 ... ] list of value fields from objects in states list
        const availableActions = action.states.map((state: { value: any }) => state.value)
        // Hass accepted actions as per https://www.home-assistant.io/integrations/climate.mqtt/#action_topic:
        // ['off', 'heating', 'cooling', 'drying', 'idle', 'fan']
        // Zwave actions/states: https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/commandclass/ThermostatOperatingStateCC.ts#L43
        const hassActionMap = [
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
          'heating' // 3rd Stage Aux Heat
        ]

        config.action_map = {}
        // for all available actions update the actions map
        for (const availableAction of availableActions) {
          const hassAction = hassActionMap[availableAction]
          if (hassAction === undefined) continue
          config.action_map[availableAction] = hassAction
        }
      }

      // add the new climate config to the nodeDevices so it will be
      // discovered later when we call `discoverDevice`
      nodeDevices.push(config)

      logger.log('info', 'New climate device discovered: %o', config)

      allDevices[node.deviceId] = nodeDevices
    } catch (error) {
      logger.error('Unable to discover climate device.', error)
    }
  }

  /**
   * Try to guess the best way to discover this valueId in Hass
   */
  discoverValue (node: Z2MNode, vId: string) {
    const valueId = node.values[vId]

    // if the node is not ready means we don't have all values added yet so we are not sure to discover this value properly
    if (!valueId || this.discovered[valueId.id] || !node.ready) return

    try {
      const result = this.valueTopic(node, valueId, true)

      if (!result || !result.topic) return

      const valueConf = result.valueConf

      const getTopic = this.mqtt.getTopic(result.topic)
      const setTopic = result.targetTopic
        ? this.mqtt.getTopic(result.targetTopic, true)
        : null

      const nodeName = this._getNodeName(node, this.config.ignoreLoc)

      let cfg: HassDevice

      const cmdClass = valueId.commandClass

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
          } else return
          break
        case CommandClasses['Multilevel Switch']:
        case CommandClasses['Multilevel Toggle Switch']:
          if (valueId.isCurrentValue) {
            const specificDeviceClass = Constants.specificDeviceClass(
              node.deviceClass.generic,
              node.deviceClass.specific
            )
            // Use a cover_position configuration if ...
            if (
              [
                'specific_type_class_a_motor_control',
                'specific_type_class_b_motor_control',
                'specific_type_class_c_motor_control',
                'specific_type_class_motor_multiposition'
              ].includes(specificDeviceClass)
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
              cfg.discovery_payload.brightness_state_topic = getTopic
              cfg.discovery_payload.brightness_command_topic = setTopic
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
            valueId.propertyKey
          )
          break
        case CommandClasses['Binary Sensor']:
          // https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/commandclass/BinarySensorCC.ts#L41
          // change the sensorTypeName to use directly valueId.property, as the old way was returning a number
          // add a comment which shows the old way of achieving this value. This change fixes the Binary Sensor
          // discovery
          let sensorTypeName = valueId.property.toString()

          if (sensorTypeName) {
            sensorTypeName = utils.sanitizeTopic(
              sensorTypeName.toLocaleLowerCase(),
              true
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
              cfg = this._getBinarySensorConfig(sensorTypeName, true)
              break
            // moisture - normal
            case 'contact':
            case 'water':
              cfg = this._getBinarySensorConfig(
                Constants.deviceClass.sensor_binary.MOISTURE
              )
              break
            // safety - normal
            case 'co':
            case 'co2':
            case 'tamper':
              cfg = this._getBinarySensorConfig(
                Constants.deviceClass.sensor_binary.SAFETY
              )
              break
            // problem - normal
            case 'alarm':
              cfg = this._getBinarySensorConfig(
                Constants.deviceClass.sensor_binary.PROBLEM
              )
              break
            // connectivity - normal
            case 'router':
              cfg = this._getBinarySensorConfig(
                Constants.deviceClass.sensor_binary.CONNECTIVITY
              )
              break
            // battery - normal
            case 'battery_low':
              cfg = this._getBinarySensorConfig(
                Constants.deviceClass.sensor_binary.BATTERY
              )
              break
            default:
              // in the end build the basic cfg if all fails
              cfg = utils.copy(hassCfg.binary_sensor)
          }
          cfg.object_id = sensorTypeName

          if (valueConf) {
            if (valueConf.device_class) {
              cfg.discovery_payload.device_class = valueConf.device_class
              cfg.object_id = valueConf.device_class
            }
            // binary sensors doesn't support icons
          }

          break
        case CommandClasses['Alarm Sensor']:
          // https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/commandclass/AlarmSensorCC.ts#L40
          if (valueId.property === 'state') {
            cfg = this._getBinarySensorConfig(
              Constants.deviceClass.sensor_binary.PROBLEM
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
          if (valueId.list && valueId.states.length === 2) {
            let off = 0 // set default off to 0.
            let discoveredObjectId = valueId.propertyKey
            switch (valueId.propertyKeyName) {
              case 'Access Control':
                cfg = this._getBinarySensorConfig(
                  Constants.deviceClass.sensor_binary.LOCK
                )
                off = 23 // Closed state
                break
              case 'Cover status':
                cfg = this._getBinarySensorConfig(
                  Constants.deviceClass.sensor_binary.OPENING
                )
                break
              case 'Door state':
                cfg = this._getBinarySensorConfig(
                  Constants.deviceClass.sensor_binary.DOOR
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
                  Constants.deviceClass.sensor_binary.PROBLEM
                )
                break
              case 'Heat sensor status':
                cfg = this._getBinarySensorConfig(
                  Constants.deviceClass.sensor_binary.HEAT
                )
                break
              case 'Motion sensor status':
                cfg = this._getBinarySensorConfig(
                  Constants.deviceClass.sensor_binary.MOTION
                )
                break
              case 'Water Alarm':
                cfg = this._getBinarySensorConfig(
                  Constants.deviceClass.sensor_binary.MOISTURE
                )
                break
              // sensor status has multiple Properties. therefore is good to work
              // on property basis... user friendly
              case 'Sensor status':
                switch (valueId.propertyName) {
                  case 'Smoke Alarm':
                    cfg = this._getBinarySensorConfig(
                      Constants.deviceClass.sensor_binary.SMOKE
                    )
                    break
                  case 'Water Alarm':
                    cfg = this._getBinarySensorConfig(
                      Constants.deviceClass.sensor_binary.MOISTURE
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
          } else {
            // https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/commandclass/NotificationCC.ts
            // https://github.com/zwave-js/node-zwave-js/blob/master/packages/config/config/notifications.json
            cfg = utils.copy(hassCfg.sensor_generic)
            cfg.object_id = utils.joinProps(
              'notification',
              valueId.property,
              valueId.propertyKey
            )
            // TODO: Improve the icons for different propertyKeys!
            switch (valueId.propertyKey) {
              case 'Motion sensor status':
                cfg.discovery_payload.icon = 'mdi:motion-sensor'
                break
              default:
                cfg.discovery_payload.icon = 'mdi:alarm-light'
            }
            cfg.discovery_payload.value_template = this._getMappedStateTemplate(
              valueId.states,
              valueId.default
            )
          }
          break
        case CommandClasses['Multilevel Sensor']:
        case CommandClasses.Meter:
        case CommandClasses['Pulse Meter']:
        case CommandClasses.Time:
        case CommandClasses['Energy Production']:
        case CommandClasses.Battery:
          let sensor = null
          // set it as been sensor (ex not Binary)
          let isSensor = true

          // https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/commandclass/MultilevelSensorCC.ts
          if (cmdClass === CommandClasses['Multilevel Sensor']) {
            // https://github.com/zwave-js/node-zwave-js/blob/master/packages/config/config/sensorTypes.json
            // In some cases Multilevel Sensors offer Reset option or DeltaTime sensors, but do not include ccSpecific
            // information. With this change, we target only the sensors and not the additional Properties.
            if (valueId.ccSpecific) {
              sensor = Constants.sensorType(valueId.ccSpecific.sensorType)
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
                valueId.ccSpecific,
                this.zwave.driver.configManager
              )

              sensor.objectId += '_' + valueId.property
            } else {
              return
            }
          } else if (cmdClass === CommandClasses['Pulse Meter']) {
            sensor = {
              sensor: 'pulse',
              objectId: 'meter',
              props: {}
            }
          } else if (cmdClass === CommandClasses.Time) {
            if (valueId.isCurrentValue) {
              sensor = {
                sensor: 'date',
                objectId: 'current',
                props: {
                  device_class: Constants.deviceClass.sensor.TIMESTAMP
                }
              }
            } else return
          } else if (cmdClass === CommandClasses['Energy Production']) {
            // TODO: class not yet supported by zwavejs
            logger.warn(
              'Energy Production CC not supported so value cannot be discovered'
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
                  device_class: Constants.deviceClass.sensor.BATTERY,
                  unit_of_measurement: '%' // this is set if Driver doesn't offer unit of measurement
                }
              }
            } else if (valueId.property === 'isLow') {
              sensor = {
                sensor: 'battery',
                objectId: 'isLow',
                props: {
                  device_class: Constants.deviceClass.sensor.BATTERY
                }
              }

              // use battery_low binary sensor
              cfg = this._getBinarySensorConfig(
                Constants.deviceClass.sensor_binary.BATTERY
              )
              // support the case a binary sensor is served under multilevel sensor CC
              isSensor = false
            } else return
          }

          // check if is a sensor
          if (isSensor) {
            cfg = utils.copy(hassCfg.sensor_generic)
          }

          cfg.object_id = utils.joinProps(sensor.sensor, sensor.objectId)
          Object.assign(cfg.discovery_payload, sensor.props || {})

          // https://github.com/zwave-js/node-zwave-js/blob/master/packages/config/config/scales.json
          if (valueId.unit) {
            cfg.discovery_payload.unit_of_measurement = valueId.unit
          }

          // check if there is a custom value configuration for this valueID
          if (valueConf) {
            if (valueConf.device_class) {
              cfg.discovery_payload.device_class = valueConf.device_class
              cfg.object_id = valueConf.device_class
            }
            if (valueConf.icon) cfg.discovery_payload.icon = valueConf.icon
          }
          break
        default:
          return
      }

      const payload = cfg.discovery_payload

      if (
        !payload.hasOwnProperty('state_topic') ||
        payload.state_topic === true
      ) {
        payload.state_topic = getTopic
      } else if (payload.state_topic === false) {
        delete payload.state_topic
      }

      if (payload.command_topic === true) {
        payload.command_topic = setTopic || getTopic + '/set'
      }

      // Set availability topic using node status topic
      // payload.availability_topic = this.mqtt.getTopic(this.nodeTopic(node)) + '/status/hass'
      // payload.payload_available = true
      // payload.payload_not_available = false
      if (
        ['binary_sensor', 'sensor', 'lock', 'climate', 'fan'].includes(cfg.type)
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
        this.config.ignoreLoc
      )

      // Set a unique id for the component
      payload.unique_id =
        'zwavejs2mqtt_' +
        this.zwave.homeHex +
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
        error
      )
    }
  }

  /**
   * Update all in memory node topics
   *
   */
  updateNodeTopics (nodeId: any) {
    const node = this.zwave.nodes.get(nodeId)
    if (node) {
      const topics = Object.keys(this.topicValues).filter(
        k => this.topicValues[k].nodeId === node.id
      )

      for (const t of topics) {
        const valueId = this.topicValues[t]
        delete this.topicValues[t]
        const topic = this.valueTopic(node, valueId)
        this.topicValues[topic] = valueId
      }
    }
  }

  /**
   * Removes all retained messages of the specified node
   */
  removeNodeRetained (nodeId: any) {
    const node = this.zwave.nodes.get(nodeId)
    if (node) {
      const topics = Object.keys(node.values).map(v =>
        this.valueTopic(node, node.values[v])
      )

      for (const t of topics) {
        this.mqtt.publish(t, '', { retain: true })
      }
    }
  }

  /**
   * Catch all Zwave events
   */
  _onEvent (emitter: any, eventName: string, ...args: any[]) {
    const topic = `${MqttClient.EVENTS_PREFIX}/${
      this.mqtt.clientID
    }/${emitter}/${eventName.replace(/\s/g, '_')}`

    this.mqtt.publish(topic, { data: args }, { qos: 1, retain: false })
  }

  /**
   * Zwave event triggered when a node is removed
   */
  _onNodeRemoved (node: Z2MNode) {
    const prefix = node.id + '-'

    // delete discovered values
    for (const id in this.discovered) {
      if (id.startsWith(prefix)) {
        delete this.discovered[id]
      }
    }
  }

  /**
   * Triggered when a value change is detected in Zwave Network
   */
  _onValueChanged (valueId: Z2MValueId, node: Z2MNode, changed: any) {
    valueId.lastUpdate = Date.now()

    // emit event to socket
    if (this.zwave) {
      this.zwave.sendToSocket(socketEvents.valueUpdated, valueId)
    }

    const isDiscovered = this.discovered[valueId.id]

    const isFromCache = !node.ready

    // prevent to send cached values if them are stateless
    if (isFromCache && valueId.stateless) {
      logger.debug(
        `Skipping send of stateless value ${valueId.id}: it's from cache`
      )
      return
    }

    // check if this value isn't discovered yet (values added after node is ready)
    if (this.config.hassDiscovery && !isDiscovered) {
      this.discoverValue(node, this._getIdWithoutNode(valueId))
    }

    const result = this.valueTopic(node, valueId, true)

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
      if (this._isValidOperation(valueConf.postOperation)) {
        tmpVal = eval(valueId.value + valueConf.postOperation)
      }

      if (valueConf.parseSend) {
        const parsedVal = this._evalFunction(
          valueConf.sendFunction,
          valueId,
          tmpVal,
          node
        )
        if (parsedVal != null) {
          tmpVal = parsedVal
        }
      }
    }

    // Check if I need to update discovery topics of this device
    if (changed && valueId.list && this.discovered[valueId.id]) {
      const hassDevice = this.discovered[valueId.id]
      const isOff = hassDevice.mode_map
        ? hassDevice.mode_map.off === valueId.value
        : false

      if (hassDevice && hassDevice.setpoint_topic && !isOff) {
        const setId = hassDevice.setpoint_topic[valueId.value]
        if (setId && node.values[setId]) {
          // check if the setpoint topic has changed
          const setpoint = node.values[setId]
          const setTopic = this.mqtt.getTopic(this.valueTopic(node, setpoint))
          if (
            setTopic !== hassDevice.discovery_payload.temperature_state_topic
          ) {
            hassDevice.discovery_payload.temperature_state_topic = setTopic
            hassDevice.discovery_payload.temperature_command_topic =
              setTopic + '/set'
            this.publishDiscovery(hassDevice, node.id)
          }
        }
      }
    }

    let data: Record<string, any>

    switch (this.config.payloadType) {
      case PAYLOAD_TYPE.VALUEID:
        data = utils.copy(valueId)
        data.value = tmpVal

        break
      case PAYLOAD_TYPE.RAW:
        data = tmpVal
        break
      default:
        data = { time: Date.now(), value: tmpVal }
    }

    if (this.config.includeNodeInfo && typeof data === 'object') {
      data.nodeName = node.name
      data.nodeLocation = node.loc
    }
    // valueId is writeable, subscribe for updates
    if (valueId.writeable && !this.topicValues[topic]) {
      const levels = topic.split('/').length

      if (this.topicLevels.indexOf(levels) < 0) {
        this.topicLevels.push(levels)
        this.mqtt.subscribe(
          '+'
            .repeat(levels)
            .split('')
            .join('/')
        )
      }

      // I need to add the conf to the valueId but I don't want to edit
      // original valueId object so I create a copy
      if (valueConf) {
        valueId = utils.copy(valueId)
        valueId.conf = valueConf
      }

      this.topicValues[topic] = valueId
    }

    let mqttOptions: IClientPublishOptions = valueId.stateless ? { retain: false } : null

    if (valueConf) {
      mqttOptions = mqttOptions || {}

      if (valueConf.qos !== undefined) {
        mqttOptions.qos = valueConf.qos
      }

      if (valueConf.retain !== undefined) {
        mqttOptions.retain = valueConf.retain
      }
    }

    this.mqtt.publish(topic, data, mqttOptions)
  }

  /**
   * Triggered when a notification is received from a node in Zwave Client
   */
  _onNotification (node: Z2MNode, valueId: Z2MValueId, data: any) {
    const topic = this.valueTopic(node, valueId)

    if (this.config.payloadType !== PAYLOAD_TYPE.RAW) {
      data = { time: Date.now(), value: data }
    }

    this.mqtt.publish(topic, data, { retain: false })
  }

  /**
   * When there is a node status update
   *
   */
  _onNodeStatus (node: Z2MNode) {
    if (node.ready && this.config.hassDiscovery) {
      for (const id in node.hassDevices) {
        if (node.hassDevices[id].persistent) {
          this.publishDiscovery(node.hassDevices[id], node.id)
        }
      }

      // check if there are climates to discover
      this.discoverClimates(node)

      const nodeDevices = allDevices[node.deviceId] || []
      nodeDevices.forEach((device: any) => this.discoverDevice(node, device))

      // discover node values (that are not part of a device)
      // iterate prioritized first, then the remaining
      for (const id of this._getPriorityCCFirst(node.values)) {
        this.discoverValue(node, id)
      }
    }

    if (node.ready && !node.inited) {
      node.inited = true
      // enable poll if required
      const values = this.config.values.filter(
        (        v: { enablePoll: any; device: any }) => v.enablePoll && v.device === node.deviceId
      )
      for (let i = 0; i < values.length; i++) {
        // don't edit the original object, copy it
        const valueId = utils.copy(values[i].value)
        valueId.nodeId = node.id
        valueId.id = node.id + '-' + valueId.id

        try {
          this.zwave.setPollInterval(valueId, values[i].pollInterval)
        } catch (error) {
          logger.error(`Error while enabling poll interval: ${error.message}`)
        }
      }
    }

    if (this.zwave) {
      this.zwave.sendToSocket(socketEvents.nodeUpdated, node)
    }

    const nodeTopic = this.nodeTopic(node)

    if (!this.config.ignoreStatus) {
      let data : any

      if (this.config.payloadType === PAYLOAD_TYPE.RAW) {
        data = node.available
      } else {
        data = {
          time: Date.now(),
          value: node.available,
          status: node.status,
          nodeId: node.id
        }
      }

      this.mqtt.publish(nodeTopic + '/status', data)
    }

    // Publish Node Info on separate topic
    // remove bulky  data like hassDevices, Groups and values
    if (this.config.publishNodeDetails) {
      const nodeData = utils.copy(node)
      delete nodeData.groups
      delete nodeData.hassDevices
      delete nodeData.values

      this.mqtt.publish(nodeTopic + '/nodeinfo', nodeData)
    }
  }

  /**
   * When mqtt client goes online/offline
   *
   */
  _onBrokerStatus (online: any) {
    if (online) {
      this.rediscoverAll()
    }
  }

  /**
   * Hass will/birth
   *
   */
  _onHassStatus (online: any) {
    logger.info(`Home Assistant is ${online ? 'ONLINE' : 'OFFLINE'}`)

    if (online) {
      this.rediscoverAll()
    }
  }

  /**
   * Handle api requests reeceived from MQTT client
   *
         */
  async _onApiRequest (topic: any, apiName: any, payload: { args: any[] }) {
    if (this.zwave) {
      const args = payload.args || []

      let result: any

      if (Array.isArray(args)) {
        result = await this.zwave.callApi(apiName, ...args)
      } else {
        result = {
          success: false,
          message: 'Args must be an array',
          origin: payload
        }
      }
      this.mqtt.publish(topic, result, { retain: false })
    } else {
      logger.error(`Requested Zwave api ${apiName} doesn't exist`)
    }
  }

  /**
   * Handle broadcast request reeived from Mqtt client
   */
  async _onBroadRequest (parts: any[], payload: ValueID  & { value: any }) {
    if (parts.length > 0) {
      // multiple writes (back compatibility mode)
      const topic = parts.join('/')
      const values = Object.keys(this.topicValues).filter(t =>
        t.endsWith(topic)
      )
      if (values.length > 0) {
        // all values are the same type just different node,parse the Payload by using the first one
        payload = this.parsePayload(
          payload,
          this.topicValues[values[0]],
          this.topicValues[values[0]].conf
        )
        for (let i = 0; i < values.length; i++) {
          await this.zwave.writeValue(this.topicValues[values[i]], payload)
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
      await this.zwave.writeBroadcast(payload, payload.value)
    }
  }

  /**
   * Handle write request received from Mqtt Client
   *
         */
  async _onWriteRequest (parts: any[], payload: any) {
    const valueId = this.topicValues[parts.join('/')]

    if (valueId) {
      payload = this.parsePayload(payload, valueId, valueId.conf)
      await this.zwave.writeValue(valueId, payload)
    }
  }

  async _onMulticastRequest (payload: Z2MValueId & { nodes: number[]; value: any }) {
    const nodes = payload.nodes
    const valueId: ValueID = {
      commandClass: payload.commandClass,
      property: payload.property,
      propertyKey: payload.propertyKey,
      endpoint: payload.endpoint     
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

    await this.zwave.writeMulticast(nodes, valueId as Z2MValueId, value)
  }

  /**
   * Checks if an operation is valid, it must exist and must contains
   * only numbers and operators
   */
  _isValidOperation (op: string) {
    return op && !/[^0-9.()\-+*/,]/g.test(op)
  }

  /**
   * Evaluate the return value of a custom parse Function
   *
   */
  _evalFunction (code: string, valueId: Z2MValueId, value: any, node: Z2MNode) {
    let result = null

    try {
      /* eslint-disable no-new-func */
      const parseFunc = new Function('value', 'valueId', 'node', 'logger', code)
      result = parseFunc(value, valueId, node, logger)
    } catch (error) {
      logger.error(
        `Error eval function of value ${valueId.id} ${error.message}`
      )
    }

    return result
  }

  /**
   * Get node name from node object
   */
  _getNodeName (node: Z2MNode, ignoreLoc: boolean) : string {
    return (
      (!ignoreLoc && node.loc ? node.loc + '-' : '') +
      (node.name ? node.name : NODE_PREFIX + node.id)
    )
  }

  /**
   *  Return re-arranged based on critical CCs
   */

  _getPriorityCCFirst (values: { [key: string]: Z2MValueId }): string[] {
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
  _getIdWithoutNode (valueId: Z2MValueId): string {
    return valueId.id.replace(valueId.nodeId + '-', '')
  }

  /**
   * Get the device Object to send in discovery payload
   */
  _deviceInfo (node: Z2MNode, nodeName: string) {
    return {
      identifiers: ['zwavejs2mqtt_' + this.zwave.homeHex + '_node' + node.id],
      manufacturer: node.manufacturer,
      model: node.productDescription + ' (' + node.productLabel + ')',
      name: nodeName,
      sw_version: node.firmwareVersion || utils.getVersion()
    }
  }

  /**
   * Get the Hass discovery topic for the specific node and hassDevice
   */
  _getDiscoveryTopic (hassDevice: HassDevice, nodeName: string) {
    return `${hassDevice.type}/${utils.sanitizeTopic(nodeName, true)}/${
      hassDevice.object_id
    }/config`
  }

  /**
   * Generate the template string to use for value templates.
   * Note that the keys need to be numeric.
   */
  _getMappedValuesTemplate (valueMap: { [x: string]: any }, defaultValue: string): string {
    const map = []
    // JSON.stringify converts props to strings and this breaks the template
    // Error: "0": "off", Working: 0: "off"
    for (const key in valueMap) {
      map.push(`${key}: "${valueMap[key]}"`)
    }

    return `{{ {${map.join(
      ', '
    )}}[value_json.value] | default('${defaultValue}') }}`
  }

  /**
   * Generate the template string to use for value templates
   * by inverting the value map
   */
  _getMappedValuesInverseTemplate (valueMap: { [x: string]: number }, defaultValue: string): string {
    const map = []
    // JSON.stringify converts props to strings and this breaks the template
    // Error: "0": "off" Working: 0: "off"
    for (const key in valueMap) {
      map.push(
        `${
          typeof valueMap[key] === 'number'
            ? valueMap[key]
            : '"' + valueMap[key] + '"'
        }: "${key}"`
      )
    }

    return `{{ {${map.join(
      ', '
    )}}[value_json.value] | default('${defaultValue}') }}`
  }

  /**
   * Calculate the correct template string to use for templates with state
   * list based on gateway settings and mapped mode values
   */
  _getMappedStateTemplate (states: Z2MValueIdState[], defaultValueKey: any): string {
    const map = []
    let defaultValue = 'value_json.value'
    for (const s of states) {
      map.push(
        `${
          typeof s.value === 'number'
            ? s.value
            : '"' + s.value + '"'
        }: "${s.text}"`
      )
      if (s.value === defaultValueKey) {
        defaultValue = `'${s.text}'`
      }
    }

    return `{{ {${map.join(
      ','
    )}}[value_json.value] | default(${defaultValue}) }}`
  }

  /**
   * Generates payload for Binary use from a state object
   */
  _setBinaryPayloadFromSensor (cfg:HassDevice, valueId: Z2MValueId, offStateValue: number = 0) {
    const stateKeys = valueId.states.map((s: { value: any }) => s.value)
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
  _getBinarySensorConfig (devClass: string, reversePayload: boolean = false): HassDevice {
    const cfg = utils.copy(hassCfg.binary_sensor)
    cfg.discovery_payload.device_class = devClass
    if (reversePayload) {
      cfg.discovery_payload.payload_on = false
      cfg.discovery_payload.payload_off = true
    }
    return cfg
  }

  /**
   * Retrives the value of a property from the node valueId
   */
  _setDiscoveryValue (payload: any, prop: string, node: Z2MNode) {
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
  _addRgbColorSwitch (node: Z2MNode, currentColorValue: Z2MValueId): any {
    const cfg = utils.copy(hassCfg.light_rgb_dimmer)

    const currentColorTopics = this.valueTopic(node, currentColorValue, true)

    const endpoint = currentColorValue.endpoint

    // current color values are automatically added later in discoverValue function
    cfg.values = []

    cfg.discovery_payload.rgb_state_topic = this.mqtt.getTopic(
      currentColorTopics.topic
    )
    cfg.discovery_payload.rgb_command_topic = this.mqtt.getTopic(
      currentColorTopics.targetTopic,
      true
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

    /* Find the control switch of the device Brightness or Binary
     If multilevel is not there use binary
     Some devices use also endpoint + 1 as on/off/brightness... try to guess that too!
  */
    let discoveredStateTopic: any
    let discoveredCommandTopic: any

    if (brightnessValue || switchValue) {
      const vID = brightnessValue || switchValue

      const valueIdState = node.values[vID]
      const topics = this.valueTopic(node, valueIdState, true)

      cfg.values.push(vID, valueIdState.targetValue)

      discoveredStateTopic = this.mqtt.getTopic(topics.topic)
      discoveredCommandTopic = this.mqtt.getTopic(topics.targetTopic, true)
    }

    if (brightnessValue) {
      cfg.discovery_payload.brightness_state_topic = discoveredStateTopic
      cfg.discovery_payload.brightness_command_topic = discoveredCommandTopic
      cfg.discovery_payload.state_topic = discoveredStateTopic
      cfg.discovery_payload.command_topic = discoveredCommandTopic
    } else if (switchValue) {
      cfg.discovery_payload.state_topic = discoveredStateTopic
      cfg.discovery_payload.command_topic = discoveredCommandTopic

      cfg.discovery_payload.state_value_template = '{{ value_template.json }}'
      cfg.discovery_payload.on_command_type = 'last'
    }

    const whiteValue = node.values[`51-${endpoint}-currentcolor-0`]

    // if whitevalue exists, use currentColor value to get/set white
    if (whiteValue && currentColorValue) {
      // still use currentColor but change the template
      cfg.discovery_payload.color_temp_state_topic =
        cfg.discovery_payload.rgb_state_topic
      cfg.discovery_payload.color_temp_command_topic =
        cfg.discovery_payload.rgb_command_topic

      cfg.discovery_payload.color_temp_command_template =
        "{{ {'warmWhite': ((value - 245)|round(0)), 'coldWhite': (255 - (value - 245))|round(0))}|to_json }}"
      cfg.discovery_payload.color_temp_value_template =
        "{{ '%03d%03d' | format((value_json.value.warmWhite || 0), (value_json.value.coldWhite || 0)) }}"
    }
    return cfg
  }

  _getEntityName (node: Z2MNode, valueId: Z2MValueId, cfg: HassDevice, entityTemplate: string, ignoreLoc: boolean) {
    entityTemplate = entityTemplate || '%ln_%o'
    // when getting the entity name of a device use node props
    let propertyKey: string = cfg.type
    let propertyName: string = cfg.type
    let property: string = cfg.type
    let label: string = cfg.object_id

    if (valueId) {
      property = valueId.property.toString()
      propertyKey = valueId.propertyKey.toString()
      propertyName = valueId.propertyName.toString()
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
}