/* eslint-disable no-case-declarations */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-eval */
/* eslint-disable one-var */
'use strict'

const fs = require('fs')
const path = require('path')
const reqlib = require('app-root-path').require
const utils = reqlib('/lib/utils.js')
const { AlarmSensorType } = require('zwave-js')
const { CommandClasses } = require('@zwave-js/core')
const { socketEvents } = reqlib('/lib/SocketManager.js')
const Constants = require('./Constants.js')
const logger = reqlib('/lib/logger.js').module('Gateway')
const hassCfg = reqlib('/hass/configurations.js')
const hassDevices = reqlib('/hass/devices.js')
const version = reqlib('package.json').version
const { storeDir } = reqlib('config/app.js')

const NODE_PREFIX = 'nodeID_'
// const GW_TYPES = ['valueID', 'named', 'manual']
// const PY_TYPES = ['time_value', 'zwave_value', 'just_value']

const CUSTOM_DEVICES = storeDir + '/customDevices'
let allDevices = hassDevices // will contain customDevices + hassDevices

// watcher initiates a watch on a file. if this fails (e.g., because the file
// doesn't exist), instead watch the directory. If the directory watch
// triggers, cancel it and try to watch the file again. Meanwhile spam `fn()`
// on any change, trusting that it's idempotent.
const watchers = new Map()
const watch = (filename, fn) => {
  try {
    watchers.set(
      filename,
      fs.watch(filename, e => {
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
      devices = reqlib(CUSTOM_DEVICES)
    } else if (fs.existsSync(customDevicesJsonPath)) {
      loaded = customDevicesJsonPath
      devices = JSON.parse(fs.readFileSync(loaded))
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

/**
 * The constructor
 *
 * @param {import('../types').GatewayConfig} config
 * @param {ZwaveClient} zwave
 * @param {import('../types').MqttClient} mqtt
 * @returns {import('../types').Z2MGateway}
 */
function Gateway (config, zwave, mqtt) {
  if (!(this instanceof Gateway)) {
    return new Gateway(config)
  }
  this.config = config || { type: 1 }
  // clients
  this.mqtt = mqtt
  this.zwave = zwave
}

Gateway.prototype.start = async function () {
  // gateway configuration

  this.config.values = this.config.values || []

  // Object where keys are topic and values can be both zwave valueId object
  // or a valueConf if the topic is a broadcast topic
  this.topicValues = {}

  this.discovered = {}

  // topic levels for subscribes using wildecards
  this.topicLevels = []

  if (this.mqtt) {
    this.mqtt.on('writeRequest', onWriteRequest.bind(this))
    this.mqtt.on('broadcastRequest', onBroadRequest.bind(this))
    this.mqtt.on('apiCall', onApiRequest.bind(this))
    this.mqtt.on('hassStatus', onHassStatus.bind(this))
    this.mqtt.on('brokerStatus', onBrokerStatus.bind(this))
  }

  if (this.zwave) {
    this.zwave.on('valueChanged', onValueChanged.bind(this))
    this.zwave.on('nodeStatus', onNodeStatus.bind(this))
    this.zwave.on('notification', onNotification.bind(this))
    this.zwave.on('nodeRemoved', onNodeRemoved.bind(this))

    if (this.config.sendEvents) {
      this.zwave.on('event', onEvent.bind(this))
    }

    // this is async but doesn't need to be awaited
    this.zwave.connect()
  } else {
    logger.error('Zwave settings are not valid')
  }
}

/**
 * Catch all Zwave events
 */
function onEvent (emitter, eventName, ...args) {
  const topic = `${this.mqtt.eventsPrefix}/${
    this.mqtt.clientID
  }/${emitter}/${eventName.replace(/\s/g, '_')}`

  this.mqtt.publish(topic, { data: args }, { qos: 1, retain: false })
}

/**
 * Zwave event triggered when a node is removed
 *
 * @param {import('../types').Z2MNode} node
 */
function onNodeRemoved (node) {
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
 *
 * @param {import('../types').Z2MValueId} valueId
 * @param {import('../types').Z2MNode} node
 * @param {bool} changed
 */
function onValueChanged (valueId, node, changed) {
  valueId.lastUpdate = Date.now()

  // emit event to socket
  if (this.zwave) {
    this.zwave.sendToSocket(socketEvents.valueUpdated, valueId)
  }

  const isDiscovered = this.discovered[valueId.id]

  // check if this value isn't discovered yet (values added after node is ready)
  if (this.config.hassDiscovery && !isDiscovered) {
    this.discoverValue(node, getIdWithoutNode(valueId))
  }

  const result = this.valueTopic(node, valueId, true)

  if (!result) return

  // if there is a valid topic for this value publish it

  const topic = result.topic
  const valueConf = result.valueConf
  // Parse valueId value and create the payload
  let tmpVal = valueId.value

  if (valueConf) {
    if (isValidOperation(valueConf.postOperation)) {
      tmpVal = eval(valueId.value + valueConf.postOperation)
    }

    if (valueConf.parseSend) {
      const parsedVal = evalFunction(
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
        if (setTopic !== hassDevice.discovery_payload.temperature_state_topic) {
          hassDevice.discovery_payload.temperature_state_topic = setTopic
          hassDevice.discovery_payload.temperature_command_topic =
            setTopic + '/set'
          this.publishDiscovery(hassDevice, node.id)
        }
      }
    }
  }

  let data

  switch (this.config.payloadType) {
    case 1: // entire zwave valueId object
      data = copy(valueId)
      data.value = tmpVal

      break
    case 2: // just value
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
      valueId = copy(valueId)
      valueId.conf = valueConf
    }

    this.topicValues[topic] = valueId
  }

  this.mqtt.publish(topic, data, valueId.stateless ? { retain: false } : null)
}

/**
 * Triggered when a notification is received from Zwave Client
 *
 * @param {import('../types').Z2MNode} node
 * @param {string} notificationLabel
 * @param {string|number} parameters
 */
function onNotification (node, notificationLabel, parameters) {
  const topic =
    this.nodeTopic(node) +
    '/notification/' +
    utils.sanitizeTopic(notificationLabel, true)
  let data

  parameters = parameters ? parameters.toString() : null

  if (this.config.payloadType === 2) {
    data = parameters
  } else {
    data = { time: Date.now(), value: parameters }
  }

  this.mqtt.publish(topic, data)
}

/**
 * When there is a node status update
 *
 * @param {import('../types').Z2MNode} node
 */
function onNodeStatus (node) {
  if (node.ready && this.config.hassDiscovery) {
    for (const id in node.hassDevices) {
      if (node.hassDevices[id].persistent) {
        this.publishDiscovery(node.hassDevices[id], node.id)
      }
    }

    // check if there are climates to discover
    this.discoverClimates(node)

    const nodeDevices = allDevices[node.deviceId] || []
    nodeDevices.forEach(device => this.discoverDevice(node, device))

    // discover node values (that are not part of a device)
    for (const id in node.values) {
      this.discoverValue(node, id)
    }
  }

  if (node.ready) {
    // enable poll if required
    const values = this.config.values.filter(
      v => v.enablePoll && v.device === node.deviceId
    )
    for (let i = 0; i < values.length; i++) {
      // don't edit the original object, copy it
      const valueId = copy(values[i].value)
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
    let data

    if (this.config.payloadType === 2) {
      data = node.ready
    } else {
      data = { time: Date.now(), value: node.ready, status: node.status }
    }

    this.mqtt.publish(nodeTopic + '/status', data)
  }

  // Publish Node Info on separate topic
  // remove bulky  data like hassDevices, Groups and values
  if (this.config.publishNodeDetails) {
    const nodeData = copy(node)
    delete nodeData.groups
    delete nodeData.hassDevices
    delete nodeData.values

    this.mqtt.publish(nodeTopic + '/nodeinfo', nodeData)
  }
}

/**
 * When mqtt client goes online/offline
 *
 * @param {boolean} online
 */
function onBrokerStatus (online) {
  if (online) {
    this.rediscoverAll()
  }
}

/**
 * Hass will/birth
 *
 * @param {boolean} online
 */
function onHassStatus (online) {
  logger.info(`Home Assistant is ${online ? 'ONLINE' : 'OFFLINE'}`)

  if (online) {
    this.rediscoverAll()
  }
}

/**
 * Handle api requests reeceived from MQTT client
 *
 * @param {string} topic
 * @param {string} apiName
 * @param {any} payload
 */
async function onApiRequest (topic, apiName, payload) {
  if (this.zwave) {
    const args = payload.args || []

    let result

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
 *
 * @param {string[]} parts
 * @param {any} payload
 */
function onBroadRequest (parts, payload) {
  const topic = parts.join('/')
  const values = Object.keys(this.topicValues).filter(t => t.endsWith(topic))

  if (values.length > 0) {
    // all values are the same type just different node,parse the Payload by using the first one
    payload = this.parsePayload(
      payload,
      this.topicValues[values[0]],
      this.topicValues[values[0]].conf
    )
    for (let i = 0; i < values.length; i++) {
      this.zwave.writeValue(this.topicValues[values[i]], payload)
    }
  }
}

/**
 * Handle write request received from Mqtt Client
 *
 * @param {string[]} parts
 * @param {any} payload
 */
function onWriteRequest (parts, payload) {
  const valueId = this.topicValues[parts.join('/')]

  if (valueId) {
    payload = this.parsePayload(payload, valueId, valueId.conf)
    this.zwave.writeValue(valueId, payload)
  }
}

/**
 * Checks if an operation is valid, it must exist and must contains
 * only numbers and operators
 */
function isValidOperation (op) {
  return op && !/[^0-9.()\-+*/,]/g.test(op)
}

/**
 * Evaluate the return value of a custom parse Function
 *
 * @param {string} code The function code
 * @param {import('../types').Z2MValueId} valueId The valueId object
 * @param {*} value The actual value to parse
 * @returns
 */
function evalFunction (code, valueId, value, node) {
  let result = null

  try {
    /* eslint-disable no-new-func */
    const parseFunc = new Function('value', 'valueId', 'node', 'logger', code)
    result = parseFunc(value, valueId, node, logger)
  } catch (error) {
    logger.error(`Error eval function of value ${valueId.id} ${error.message}`)
  }

  return result
}

/**
 * Get node name from node object
 *
 * @param {import('../types').Z2MNode} node The Zwave Node Object
 * @returns A string in the format [<location>-]<name>, if location doesn't exist it will be ignored, if the node name doesn't exists the node id with node prefix string will be used
 */
function getNodeName (node, ignoreLoc) {
  return (
    (!ignoreLoc && node.loc ? node.loc + '-' : '') +
    (node.name ? node.name : NODE_PREFIX + node.id)
  )
}

/**
 * Deep copy of an object
 *
 * @param {*} obj The object to copy
 * @returns The copied object
 */
function copy (obj) {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Returns the value id without the node prefix
 *
 * @param {import('../types').Z2MValueId} valueId
 * @returns {string} The valueId string
 */
function getIdWithoutNode (valueId) {
  return valueId.id.replace(valueId.nodeId + '-', '')
}

/**
 * Get the device Object to send in discovery payload
 *
 * @param {import('../types').Z2MNode} node A Zwave Node Object
 * @param {string} nodeName Node name from getNodeName function
 * @returns The Hass device object
 */
function deviceInfo (node, nodeName) {
  return {
    identifiers: ['zwavejs2mqtt_' + this.zwave.homeHex + '_node' + node.id],
    manufacturer: node.manufacturer,
    model: node.productDescription + ' (' + node.productLabel + ')',
    name: nodeName,
    sw_version: node.firmwareVersion || version
  }
}

/**
 * Get the Hass discovery topic for the specific node and hassDevice
 *
 * @param {import('../types').HassDevice} hassDevice The Hass device object configuration
 * @param {string} nodeName Node name from getNodeName function
 * @returns The topic string for this device discovery
 */
function getDiscoveryTopic (hassDevice, nodeName) {
  return `${hassDevice.type}/${nodeName}/${hassDevice.object_id}/config`
}

/**
 * Calculate the correct template string to use for modes templates
 * based on gateway settings and mapped mode values
 *
 * @param {any} modeMap The Object with mode mapping key : value
 * @param {string} defaultValue The default value for the mode
 * @returns {string} The template to use for the mode
 */
function getMappedValuesTemplate (modeMap, defaultValue) {
  const map = []
  // JSON.stringify converts props to strings and this breaks the template
  // Error: "0": "off" Working: 0: "off"
  for (const key in modeMap) {
    map.push(
      `${
        typeof modeMap[key] === 'number'
          ? modeMap[key]
          : '"' + modeMap[key] + '"'
      }: "${key}"`
    )
  }

  return `{{ {${map.join(
    ','
  )}}[value_json.value] | default('${defaultValue}') }}`
}

/**
 * Calculate the correct template string to use for templates with state
 * list based on gateway settings and mapped mode values
 *
 * @param {any} state The object list which is translated to map
 * @param {string} defaultValueKey The key to use for default value
 * @returns {string} The template to use for the template
 */
function getMappedStateTemplate (state, defaultValueKey) {
  const map = []
  let defaultValue = 'value_json.value'
  for (const listKey in state) {
    map.push(
      `${
        typeof state[listKey].value === 'number'
          ? state[listKey].value
          : '"' + state[listKey].value + '"'
      }: "${state[listKey].text}"`
    )
    if (state[listKey].value === defaultValueKey) {
      defaultValue = `'${state[listKey].text}'`
    }
  }

  return `{{ {${map.join(',')}}[value_json.value] | default(${defaultValue}) }}`
}

/**
 * Generates payload for Binary use from a state object
 *
 * @param {import('../types').HassDevice} cfg Hass discovery Configuration
 * @param {import('../types').Z2MValueId} valueId The device ValueID
 * @param {number} offStateValue The value number to consider off state
 */
function setBinaryPayloadFromSensor (cfg, valueId, offStateValue = 0) {
  const stateKeys = valueId.states.map(s => s.value)
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
 *
 * @param {import('../types').HassDevice} cfg Hass discovery Configuration
 * @param {string} devClass Choosen device class
 * @param {boolean} reversePayload reverse payload order
 */
function setBinarySensorPayload (devClass, reversePayload = false) {
  const cfg = copy(hassCfg.binary_sensor)
  cfg.discovery_payload.device_class = devClass
  if (reversePayload) {
    cfg.discovery_payload.payload_on = false
    cfg.discovery_payload.payload_off = true
  }
  return cfg
}

/**
 * Retrives the value of a property from the node valueId
 *
 * @param {any} payload discovery payload
 * @param {string} prop property name
 * @param {import('../types').Z2MNode} node node object
 */
function setDiscoveryValue (payload, prop, node) {
  if (typeof payload[prop] === 'string') {
    const valueId = node.values[payload[prop]]
    if (valueId && valueId.value != null) {
      payload[prop] = valueId.value
    }
  }
}

/**
 * Check if this node supports rgb and if so add it to discovery configuration
 *
 * @param {*} cfg the discovery configuration
 * @param {import('../types').Z2MNode} node the node
 * @param {import('../types').Z2MValueId} valueId the valueId
 * @returns {any} a configuration if the rgb dimmer is added, false otherwise
 */
function addRgbDimmer (cfg, node, valueId) {
  const rgbID = `51-${valueId.endpoint || 0}-hexColor`
  const rgb = node.values[rgbID]
  if (rgb) {
    cfg = copy(cfg)
    cfg.discovery_payload.rgb_state_topic = this.mqtt.getTopic(
      this.valueTopic(node, rgb)
    )
    cfg.discovery_payload.rgb_command_topic =
      cfg.discovery_payload.rgb_state_topic + '/set'
    cfg.values = [rgbID]

    const whiteID = `51-${valueId.endpoint || 0}-currentColor-0`
    const whiteValue = node.values[whiteID]

    if (whiteValue) {
      const whiteIDWrite = `51-${valueId.endpoint || 0}-targetColor-0`
      const whiteValueWrite = node.values[whiteIDWrite]
      cfg.discovery_payload.white_value_state_topic = this.mqtt.getTopic(
        this.valueTopic(node, whiteValue)
      )
      cfg.discovery_payload.white_value_scale = whiteValue.max
      cfg.discovery_payload.white_value_template = '{{ value_json.value }}'
      cfg.discovery_payload.white_value_command_topic = this.mqtt.getTopic(
        this.valueTopic(node, whiteValueWrite),
        true
      )

      cfg.values.push(whiteID, whiteIDWrite)
    }

    return cfg
  }

  return false
}

/**
 *
 * @param {import('../types').Z2MNode} node node object
 * @param {import('../types').Z2MValueId} valueId valueId object
 * @param {any} cfg configuration object
 * @param {string} entityTemplate the entity template from configuration
 */
function getEntityName (node, valueId, cfg, entityTemplate, ignoreLoc) {
  entityTemplate = entityTemplate || '%ln_%o'
  // when getting the entity name of a device use node props
  let propertyKey = cfg.type
  let propertyName = cfg.type
  let property = cfg.type
  let label = cfg.object_id

  if (valueId) {
    property = valueId.property
    propertyKey = valueId.propertyKey
    propertyName = valueId.propertyName
    label = valueId.label
  }

  return entityTemplate
    .replace(/%nid/g, NODE_PREFIX + node.id)
    .replace(/%ln/g, getNodeName(node, ignoreLoc))
    .replace(/%loc/g, node.loc || '')
    .replace(/%pk/g, propertyKey)
    .replace(/%pn/g, propertyName)
    .replace(/%p/g, property)
    .replace(/%o/g, cfg.object_id)
    .replace(/%n/g, node.name || NODE_PREFIX + node.id)
    .replace(/%l/g, label)
}

/**
 * Parse the value of the payload received from mqtt
 * based on the type of the payload and the gateway config
 *
 * @param {any} payload
 * @param {import('../types').Z2MValueId} valueId
 * @param {any} valueConf
 * @returns
 */
Gateway.prototype.parsePayload = function (payload, valueId, valueConf) {
  try {
    payload =
      typeof payload === 'object' && payload.hasOwnProperty('value')
        ? payload.value
        : payload

    const hassDevice = this.discovered[valueId.id]

    // Hass payload parsing
    if (hassDevice) {
      // try to parse string payloads in bools
      if (typeof payload === 'string' && isNaN(payload)) {
        if (/\btrue\b|\bon\b|\block\b/gi.test(payload)) payload = true
        else if (/\bfalse\b|\boff\b|\bunlock\b/gi.test(payload)) {
          payload = false
        }
      }

      // on/off becomes 100%/0%
      if (typeof payload === 'boolean' && valueId.type === 'number') {
        payload = payload ? valueId.max : valueId.min
      }

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

      if (valueId.commandClass === CommandClasses['Binary Toggle Switch']) {
        payload = 1
      } else if (
        valueId.commandClass === CommandClasses['Multilevel Toggle Switch']
      ) {
        payload = valueId.value > 0 ? 0 : 0xff
      }
    }

    if (valueId.type === 'any') {
      if (payload.type === 'Buffer' && payload.data) {
        payload = Buffer.from(payload.data)
      } else {
        payload = Buffer.from(payload)
      }
    }

    if (valueConf) {
      if (isValidOperation(valueConf.postOperation)) {
        let op = valueConf.postOperation

        // revert operation to write
        if (op.includes('/')) op = op.replace(/\//, '*')
        else if (op.includes('*')) op = op.replace(/\*/g, '/')
        else if (op.includes('+')) op = op.replace(/\+/, '-')
        else if (op.includes('-')) op = op.replace(/-/, '+')

        payload = eval(payload + op)
      }

      if (valueConf.parseReceive) {
        const node = this.zwave.nodes[valueId.nodeId]
        const parsedVal = evalFunction(
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
Gateway.prototype.close = async function () {
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
 *
 * @param {import('../types').Z2MNode} node internal node object
 * @returns The node topic
 */
Gateway.prototype.nodeTopic = function (node) {
  const topic = []

  if (node.loc && !this.config.ignoreLoc) topic.push(node.loc)

  switch (this.config.type) {
    case 2: // manual
    case 1: // named
      topic.push(node.name ? node.name : NODE_PREFIX + node.id)
      break
    case 0: // valueid
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
 * @param {import('../types').Z2MNode} node Internal node object
 * @param {import('../types').Z2MValueId} valueId Internal ValueId object
 * @param {boolean} returnObject Set this to true to also return the targetTopic and the valueConf
 * @returns The value topic string or an object
 */
Gateway.prototype.valueTopic = function (node, valueId, returnObject = false) {
  const topic = []
  let valueConf

  // check if this value is in configuration values array
  const values = this.config.values.filter(v => v.device === node.deviceId)
  if (values && values.length > 0) {
    const vID = getIdWithoutNode(valueId)
    valueConf = values.find(v => v.value.id === vID)
  }

  if (valueConf && valueConf.topic) {
    topic.push(node.name ? node.name : NODE_PREFIX + valueId.nodeId)
    topic.push(valueConf.topic)
  }

  let targetTopic

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
      case 1: // named
        topic.push(node.name ? node.name : NODE_PREFIX + valueId.nodeId)
        topic.push(Constants.commandClass(valueId.commandClass))

        topic.push('endpoint_' + (valueId.endpoint || 0))

        topic.push(utils.removeSlash(valueId.propertyName))
        if (valueId.propertyKey) {
          topic.push(utils.removeSlash(valueId.propertyKey))
        }
        break
      case 0: // valueid
        if (!this.config.nodeNames) {
          topic.push(valueId.nodeId)
        } else {
          topic.push(node.name ? node.name : NODE_PREFIX + valueId.nodeId)
        }
        topic.push(valueId.commandClass)
        topic.push(valueId.endpoint || '0')
        topic.push(utils.removeSlash(valueId.property))
        if (valueId.propertyKey) {
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
 *
 * @param {number} nodeID
 */
Gateway.prototype.rediscoverNode = function (nodeID) {
  const node = this.zwave.nodes[nodeID]
  if (node) {
    // delete all discovered values
    onNodeRemoved.call(this, node)
    node.hassDevices = {}

    // rediscover all values
    const nodeDevices = allDevices[node.deviceId] || []
    nodeDevices.forEach(device => this.discoverDevice(node, device))

    // discover node values (that are not part of a device)
    for (const id in node.values) {
      this.discoverValue(node, id)
    }

    this.zwave.sendToSocket(socketEvents.nodeUpdated, node)
  }
}

/**
 * Disable the discovery of all devices of this node
 *
 * @param {number} nodeID
 */
Gateway.prototype.disableDiscovery = function (nodeID) {
  const node = this.zwave.nodes[nodeID]
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
 * @param {HassDevice} hassDevice The hass device configuration to use for the discovery
 * @param {number} nodeId The node id
 * @param {boolean} deleteDevice Enable this to remove the selected device from hass discovery
 * @param {boolean} update Update an hass device of a specific node in zwaveClient and send the event to socket
 */
Gateway.prototype.publishDiscovery = function (
  hassDevice,
  nodeId,
  deleteDevice,
  update
) {
  try {
    logger.log(
      'debug',
      `${deleteDevice ? 'Removing' : 'Publishing'} discovery: %o`,
      hassDevice
    )

    this.setDiscovery(nodeId, hassDevice, deleteDevice)

    // don't discovery this device when ignore is true
    if (!hassDevice.ignoreDiscovery) {
      if (this.config.payloadType === 2) {
        // Payload is set to "Just Value"
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

      this.mqtt.publish(
        hassDevice.discoveryTopic,
        deleteDevice ? '' : hassDevice.discovery_payload,
        { qos: 0, retain: this.config.retainedDiscovery || false },
        this.config.discoveryPrefix
      )
    }

    if (update) {
      this.zwave.updateDevice(hassDevice, nodeId, deleteDevice)
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
 * @param {number} nodeId The node id
 * @param {HassDevice} hassDevice Hass device configuration
 * @param {boolean} deleteDevice Remove the device from the map
 */
Gateway.prototype.setDiscovery = function (
  nodeId,
  hassDevice,
  deleteDevice = false
) {
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
Gateway.prototype.rediscoverAll = function () {
  // skip discovery if discovery not enabled
  if (!this.config.hassDiscovery) return

  const nodes = this.zwave ? this.zwave.nodes : []
  for (let i = 0; i < nodes.length; i++) {
    const devices = nodes[i] && nodes[i].hassDevices ? nodes[i].hassDevices : {}
    for (const id in devices) {
      const d = devices[id]
      if (d && d.discoveryTopic && d.discovery_payload) {
        this.publishDiscovery(d, i)
      }
    } // end foreach hassdevice
  } // end foreach node
}

/**
 * Discover an hass device (from customDevices.js|json)
 *
 * @param {import('../types').Z2MNode} node node object
 * @param {HassDevice} hassDevice hass device
 */
Gateway.prototype.discoverDevice = function (node, hassDevice) {
  const hassID = hassDevice
    ? hassDevice.type + '_' + hassDevice.object_id
    : null

  try {
    if (hassID && !node.hassDevices[hassID]) {
      // discover the device
      let payload

      // copy the configuration without edit the original object
      hassDevice = JSON.parse(JSON.stringify(hassDevice))

      if (hassDevice.type === 'climate') {
        payload = hassDevice.discovery_payload

        const mode = node.values[payload.mode_state_topic]
        let setId

        if (mode !== undefined) {
          setId =
            hassDevice.setpoint_topic && hassDevice.setpoint_topic[mode.value]
              ? hassDevice.setpoint_topic[mode.value]
              : hassDevice.default_setpoint
          // only setup modes if a state topic was defined
          payload.mode_state_template = getMappedValuesTemplate(
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
        setDiscoveryValue(payload, 'max_temp', node)
        setDiscoveryValue(payload, 'min_temp', node)

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
        }

        const fan = node.values[payload.fan_mode_state_topic]
        if (fan !== undefined) {
          payload.fan_mode_state_topic = this.mqtt.getTopic(
            this.valueTopic(node, fan)
          )
          payload.fan_mode_command_topic = payload.fan_mode_state_topic + '/set'

          if (hassDevice.fan_mode_map) {
            payload.fan_mode_state_template = getMappedValuesTemplate(
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
        const nodeName = getNodeName(node, this.config.ignoreLoc)

        // Set device information using node info
        payload.device = deviceInfo.call(this, node, nodeName)

        hassDevice.object_id = utils
          .sanitizeTopic(hassDevice.object_id, true)
          .toLocaleLowerCase()

        // Set a friendly name for this component
        payload.name = getEntityName(
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

        const discoveryTopic = getDiscoveryTopic(hassDevice, nodeName)
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
 * @param {import('../types').Z2MNode} node Internal node object
 */
Gateway.prototype.discoverClimates = function (node) {
  // https://github.com/zwave-js/node-zwave-js/blob/master/packages/config/config/deviceClasses.json#L177
  // check if device it's a thermostat
  if (!node.deviceClass || node.deviceClass.generic !== 0x08) {
    return
  }

  try {
    const nodeDevices = allDevices[node.deviceId] || []

    // skip if there is already a climate device
    if (nodeDevices.length > 0 && nodeDevices.find(d => d.type === 'climate')) {
      return
    }

    // arrays of strings valueIds (without the node prefix)
    const setpoints = []
    const temperatures = []
    const modes = []

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
      }
    }

    // TODO: if the device supports multiple endpoints how could we identify the correct one to use?
    const temperatureId = temperatures[0]

    if (!temperatureId) {
      logger.warn(
        'Unable to discover climate device, there is no valid temperature valueId'
      )
      return
    }

    if (setpoints.length === 0) {
      logger.warn(
        'Unable to discover climate device, there is no valid setpoint valueId'
      )
      return
    }

    // generic configuration
    const config = copy(hassCfg.thermostat)
    config.discovery_payload.current_temperature_topic = temperatureId

    config.values = [temperatureId]

    // take the first as valid
    const modeId = modes[0]

    // some thermostats could support just one mode so haven't a thermostat mode CC
    if (modeId) {
      config.values.push(modeId)

      const mode = node.values[modeId]

      config.discovery_payload.mode_state_topic = modeId
      config.discovery_payload.mode_command_topic = modeId + '/set'

      // [0, 1, 2 ... ] (['off', 'heat', 'cold', ...])
      const availableModes = mode.states.map(s => s.value)

      // Zwave modes: https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/commandclass/ThermostatModeCC.ts#L54
      const allowedModes = ['off', 'heat', 'cool', 'auto', 'dry', 'fan_only']
      const hassModes = [
        'off',
        'heat',
        'cool',
        'auto',
        undefined, // auxiliary
        undefined, //  resume
        'fan_only',
        undefined, // furnace
        'dry',
        undefined, // moist
        'auto', // auto changeover
        'heat', // energy heat
        'cool', // energy cool
        'off', // away
        'heat', // full power
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
 *
 * @param {import('../types').Z2MNode} node Internal node object
 * @param {string} vId value id without the node prefix
 */
Gateway.prototype.discoverValue = function (node, vId) {
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

    const nodeName = getNodeName(node, this.config.ignoreLoc)

    let cfg

    const cmdClass = valueId.commandClass

    switch (cmdClass) {
      case CommandClasses['Binary Switch']:
      case CommandClasses['All Switch']:
      case CommandClasses['Binary Toggle Switch']:
        if (valueId.isCurrentValue) {
          cfg = addRgbDimmer.call(this, hassCfg.light_rgb_switch, node, valueId)
          if (!cfg) {
            cfg = copy(hassCfg.switch)
          }
        } else return
        break
      case CommandClasses['Barrier Operator']:
        if (valueId.isCurrentValue) {
          cfg = copy(hassCfg.barrier_state)
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
            cfg = copy(hassCfg.cover_position)
            cfg.discovery_payload.state_topic = getTopic
            cfg.discovery_payload.command_topic = setTopic
            cfg.discovery_payload.position_topic = getTopic
            cfg.discovery_payload.set_position_topic =
              cfg.discovery_payload.command_topic
            cfg.discovery_payload.value_template =
              '{{ value_json.value | round(0) }}'
            cfg.discovery_payload.position_open = 99
            cfg.discovery_payload.position_closed = 0
            cfg.discovery_payload.payload_open = 99
            cfg.discovery_payload.payload_close = 0
          } else {
            // ... otherwise use a light dimmer configuration
            // brightness level
            cfg = addRgbDimmer.call(
              this,
              hassCfg.light_rgb_dimmer,
              node,
              valueId
            )
            if (!cfg) {
              cfg = copy(hassCfg.light_dimmer)
            }
            cfg.discovery_payload.brightness_state_topic = getTopic
            cfg.discovery_payload.brightness_command_topic = setTopic
          }
        } else return
        break
      case CommandClasses['Door Lock']:
        if (valueId.isCurrentValue) {
          // lock state
          cfg = copy(hassCfg.lock)
        } else {
          return
        }
        break
      case CommandClasses['Sound Switch']:
        // https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/commandclass/SoundSwitchCC.ts
        if (valueId.property === 'volume') {
          // volume control
          cfg = copy(hassCfg.volume_dimmer)
          cfg.discovery_payload.brightness_state_topic = getTopic
          cfg.discovery_payload.command_topic = getTopic + '/set'
          cfg.discovery_payload.brightness_command_topic =
            cfg.discovery_payload.command_topic
        } else {
          return
        }
        break
      case CommandClasses['Central Scene']:
      case CommandClasses['Scene Activation']:
        cfg = copy(hassCfg.central_scene)

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
        let sensorTypeName = valueId.property

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
            cfg = setBinarySensorPayload(sensorTypeName)
            break
          // reverse
          case 'lock':
            cfg = setBinarySensorPayload(sensorTypeName, true)
            break
          // moisture - normal
          case 'contact':
          case 'water':
            cfg = setBinarySensorPayload(
              Constants.deviceClass.sensor_binary.MOISTURE
            )
            break
          // safety - normal
          case 'co':
          case 'co2':
          case 'tamper':
            cfg = setBinarySensorPayload(
              Constants.deviceClass.sensor_binary.SAFETY
            )
            break
          // problem - normal
          case 'alarm':
            cfg = setBinarySensorPayload(
              Constants.deviceClass.sensor_binary.PROBLEM
            )
            break
          // connectivity - normal
          case 'router':
            cfg = setBinarySensorPayload(
              Constants.deviceClass.sensor_binary.CONNECTIVITY
            )
            break
          // battery - normal
          case 'battery_low':
            cfg = setBinarySensorPayload(
              Constants.deviceClass.sensor_binary.BATTERY
            )
            break
          default:
            // in the end build the basic cfg if all fails
            cfg = copy(hassCfg.binary_sensor)
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
          cfg = setBinarySensorPayload(
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
        if (cmdClass === CommandClasses.Basic && valueId.property !== 'event') {
          return
        }

        // Try to define Binary sensor
        if (valueId.list && valueId.states.length === 2) {
          let off = 0 // set default off to 0.
          let discoveredObjectId = valueId.propertyKey
          switch (valueId.propertyKeyName) {
            case 'Access Control':
              cfg = setBinarySensorPayload(
                Constants.deviceClass.sensor_binary.LOCK
              )
              off = 23 // Closed state
              break
            case 'Cover status':
              cfg = setBinarySensorPayload(
                Constants.deviceClass.sensor_binary.OPENING
              )
              break
            case 'Door state':
              cfg = setBinarySensorPayload(
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
              cfg = setBinarySensorPayload(
                Constants.deviceClass.sensor_binary.PROBLEM
              )
              break
            case 'Heat sensor status':
              cfg = setBinarySensorPayload(
                Constants.deviceClass.sensor_binary.HEAT
              )
              break
            case 'Motion sensor status':
              cfg = setBinarySensorPayload(
                Constants.deviceClass.sensor_binary.MOTION
              )
              break
            case 'Water Alarm':
              cfg = setBinarySensorPayload(
                Constants.deviceClass.sensor_binary.MOISTURE
              )
              break
            // sensor status has multiple Properties. therefore is good to work
            // on property basis... user friendly
            case 'Sensor status':
              switch (valueId.propertyName) {
                case 'Smoke Alarm':
                  cfg = setBinarySensorPayload(
                    Constants.deviceClass.sensor_binary.SMOKE
                  )
                  break
                case 'Water Alarm':
                  cfg = setBinarySensorPayload(
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
          cfg = cfg ? copy(cfg) : copy(hassCfg.binary_sensor)
          // correct payload from true/false to numeric values
          cfg = setBinaryPayloadFromSensor(cfg, valueId, off)
          // finally update object_id
          cfg.object_id = discoveredObjectId
        } else {
          // https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/commandclass/NotificationCC.ts
          // https://github.com/zwave-js/node-zwave-js/blob/master/packages/config/config/notifications.json
          cfg = copy(hassCfg.sensor_generic)
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
          cfg.discovery_payload.value_template = getMappedStateTemplate(
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
            cfg = setBinarySensorPayload(
              Constants.deviceClass.sensor_binary.BATTERY
            )
            // support the case a binary sensor is served under multilevel sensor CC
            isSensor = false
          } else return
        }

        // check if is a sensor
        if (isSensor) {
          cfg = copy(hassCfg.sensor_generic)
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
      case 'color':
        if (valueId.property === 'hexColor') {
          cfg = addRgbDimmer.call(this, hassCfg.light_rgb_switch, node, valueId)
        } else return
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
    payload.device = deviceInfo.call(this, node, nodeName)

    // multi instance devices would have same object_id
    if (valueId.endpoint) cfg.object_id += '_' + valueId.endpoint

    // remove chars that are not allowed in object ids
    cfg.object_id = utils.sanitizeTopic(cfg.object_id, true).toLocaleLowerCase()

    // Check if another value already exists and add the index to object_id to make it unique
    if (node.hassDevices[cfg.type + '_' + cfg.object_id]) {
      cfg.object_id += '_' + valueId.endpoint
    }

    // Set a friendly name for this component
    payload.name = getEntityName(
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

    const discoveryTopic = getDiscoveryTopic(cfg, nodeName)

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

module.exports = Gateway
