/* eslint-disable no-case-declarations */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-eval */
/* eslint-disable one-var */
'use strict'

const fs = require('fs')
const path = require('path')
const reqlib = require('app-root-path').require
const utils = reqlib('/lib/utils.js')
const EventEmitter = require('events')
const Constants = reqlib('/lib/Constants.js')
const debug = reqlib('/lib/debug')('Gateway')
const inherits = require('util').inherits
const hassCfg = reqlib('/hass/configurations.js')
const hassDevices = reqlib('/hass/devices.js')
const version = reqlib('package.json').version

const NODE_PREFIX = 'nodeID_'
// const GW_TYPES = ['valueID', 'named', 'manual']
// const PY_TYPES = ['time_value', 'zwave_value', 'just_value']

const CUSTOM_DEVICES = reqlib('config/app.js').storeDir + '/customDevices'
let allDevices = hassDevices // will contain customDevices + hassDevices

debug.color = 2

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

const customDevicesJsPath = utils.joinPath(true, CUSTOM_DEVICES) + '.js'
const customDevicesJsonPath = utils.joinPath(true, CUSTOM_DEVICES) + '.json'

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
    debug('failed to load ' + loaded + ':', error)
    return
  }

  const sha = require('crypto')
    .createHash('sha256')
    .update(JSON.stringify(devices))
    .digest('hex')
  if (lastCustomDevicesLoad === sha) {
    return
  }

  debug('loading custom devices from', loaded)

  lastCustomDevicesLoad = sha

  allDevices = Object.assign({}, hassDevices, devices)
  debug(
    'Loaded',
    Object.keys(devices).length,
    'custom Hass devices configurations'
  )
}

loadCustomDevices()
watch(customDevicesJsPath, loadCustomDevices)
watch(customDevicesJsonPath, loadCustomDevices)

/**
 * The constructor
 */
function Gateway (config, zwave, mqtt) {
  if (!(this instanceof Gateway)) {
    return new Gateway(config)
  }
  EventEmitter.call(this)
  init.call(this, config, zwave, mqtt)
}

inherits(Gateway, EventEmitter)

function init (config, zwave, mqtt) {
  // gateway configuration
  this.config = config || { type: 1 }
  this.config.values = this.config.values || []

  // clients
  this.mqtt = mqtt
  this.zwave = zwave

  // Object where keys are topic and values can be both zwave valueId object
  // or a valueConf if the topic is a broadcast topic
  this.topicValues = {}

  this.discovered = {}

  // topic levels for subscribes using wildecards
  this.topicLevels = []

  if (mqtt) {
    mqtt.on('writeRequest', onWriteRequest.bind(this))
    mqtt.on('broadcastRequest', onBroadRequest.bind(this))
    mqtt.on('multicastRequest', onMulticastRequest.bind(this))
    mqtt.on('apiCall', onApiRequest.bind(this))
    mqtt.on('hassStatus', onHassStatus.bind(this))
    mqtt.on('brokerStatus', onBrokerStatus.bind(this))
  }

  if (zwave) {
    zwave.on('valueChanged', onValueChanged.bind(this))
    zwave.on('nodeStatus', onNodeStatus.bind(this))
    zwave.on('notification', onNotification.bind(this))
    zwave.on('scanComplete', onScanComplete.bind(this))
    zwave.on('nodeSceneEvent', onNodeSceneEvent.bind(this))
    zwave.on('nodeRemoved', onNodeRemoved.bind(this))

    if (config.sendEvents) {
      zwave.on('event', onEvent.bind(this))
    }

    zwave.connect()
  } else {
    debug('Zwave settings are not valid')
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
 * Zwave event triggered when a scan is completed
 */
// eslint-disable-next-line no-unused-vars
function onScanComplete (nodes) {}

/**
 * Zwave event triggered when a node is removed
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
 * Zwave event triggered when there is a node or scene event
 */
function onNodeSceneEvent (event, node, code) {
  let topic = this.nodeTopic(node)

  if (event === 'node') {
    topic += '/event'
  } else if (event === 'scene') {
    topic += '/scene/event'
  } else {
    return
  }

  let data

  if (this.config.payloadType === 2) data = code
  else data = { time: Date.now(), value: code }

  this.mqtt.publish(topic, data, { qos: 1, retain: false })
}

/**
 * Zwave event triggered when a value changes
 */
function onValueChanged (valueId, node, changed) {
  valueId.lastUpdate = Date.now()

  // emit event to socket
  if (this.zwave) {
    this.zwave.emitEvent(this.zwave.socketEvents.valueUpdated, valueId)
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
      const parsedVal = evalFunction(valueConf.sendFunction, valueId, tmpVal)
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

  this.mqtt.publish(topic, data)
}

function onNotification (node, notificationLabel, parameters) {
  const topic =
    this.nodeTopic(node) +
    '/notification/' +
    this.mqtt.cleanName(notificationLabel)
  let data

  parameters = parameters ? parameters.toString() : null

  if (this.config.payloadType === 2) {
    data = parameters
  } else {
    data = { time: Date.now(), value: parameters }
  }

  this.mqtt.publish(topic, data)
}

function onNodeStatus (node) {
  if (node.ready && this.config.hassDiscovery) {
    for (const id in node.hassDevices) {
      if (node.hassDevices[id].persistent) {
        this.publishDiscovery(node.hassDevices[id], node.id)
      }
    }

    const nodeDevices = allDevices[node.deviceId] || []
    nodeDevices.forEach(device => this.discoverDevice(node, device))

    // discover node values (that are not part of a device)
    for (const id in node.values) {
      this.discoverValue(node, node.values[id])
    }
  }

  // TODO: Zwavejs doesn't support polling right now

  // if (node.ready) {
  //   // enable poll and /or verify changes if required
  //   var values = this.config.values.filter(
  //     v => (v.enablePoll || v.verifyChanges) && v.device === node.deviceId
  //   )
  //   for (var i = 0; i < values.length; i++) {
  //     // don't edit the original object, copy it
  //     var v = copy(values[i].value)
  //     v.nodeId = node.id

  //     try {
  //       if (values[i].verifyChanges) {
  //         this.zwave.callApi('setChangeVerified', v, true)
  //       }

  //       if (values[i].enablePoll) {
  //         if (!this.zwave.client.isPolled(v)) {
  //           this.zwave.callApi('enablePoll', v, values[i].pollIntensity || 1)
  //         }
  //       } else if (this.zwave.client.isPolled(v)) {
  //         this.zwave.callApi('disablePoll', v)
  //       }
  //     } catch (error) {
  //       const op = values[i].verifyChanges ? 'verify changes' : 'enable poll'
  //       debug('Error while call', op, error.message)
  //     }
  //   }
  // }

  if (this.zwave) {
    this.zwave.emitEvent(this.zwave.socketEvents.nodeUpdated, node)
  }

  if (!this.config.ignoreStatus) {
    const topic = this.nodeTopic(node) + '/status'
    let data

    if (this.config.payloadType === 2) {
      data = node.ready
    } else {
      data = { time: Date.now(), value: node.ready, status: node.status }
    }

    this.mqtt.publish(topic, data)
  }
}

function onBrokerStatus (online) {
  if (online) {
    this.rediscoverAll()
  }
}

function onHassStatus (online) {
  debug('Home Assistant is ' + (online ? 'ONLINE' : 'OFFLINE'))

  if (online) {
    this.rediscoverAll()
  }
}

async function onApiRequest (topic, apiName, payload) {
  if (this.zwave) {
    const args = payload.args || []
    const result = await this.zwave.callApi(apiName, ...args)
    this.mqtt.publish(topic, result)
  } else {
    debug('Requested Zwave api', apiName, "doesn't exist")
  }
}

async function onBroadRequest (parts, payload) {
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
      await this.zwave.writeValue(this.topicValues[values[i]], payload)
    }
  }
}

async function onWriteRequest (parts, payload) {
  const valueId = this.topicValues[parts.join('/')]

  if (valueId) {
    payload = this.parsePayload(payload, valueId, valueId.conf)
    await this.zwave.writeValue(valueId, payload)
  }
}

async function onMulticastRequest (parts, payload) {
  const topic = parts.join('/')
  const values = Object.keys(this.topicValues).filter(t => t.endsWith(topic))

  const nodes = payload.nodes

  if (!nodes || nodes.length === 0) {
    debug('No nodes found in multicast request to ' + topic)
    return
  }

  if (payload.value === undefined) {
    debug('No value found to write in multicast request')
    return
  }

  if (values.length > 0) {
    // all values are the same type just different node,parse the Payload by using the first one
    payload = this.parsePayload(
      payload,
      this.topicValues[values[0]],
      this.topicValues[values[0]].conf
    )
    for (let i = 0; i < values.length; i++) {
      const valueId = this.topicValues[values[i]]
      if (nodes.indexOf(valueId.nodeId) >= 0) {
        await this.zwave.writeValue(valueId, payload.value)
      }
    }
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
 * @param {String} code The function code
 * @param {Object} valueId The valueId object
 * @param {*} value The actual value to parse
 * @returns
 */
function evalFunction (code, valueId, value) {
  let result = null

  try {
    /* eslint-disable no-new-func */
    const parseFunc = new Function('value', code)
    result = parseFunc(value)
  } catch (error) {
    debug('Error eval function of value ', valueId.id, error.message)
  }

  return result
}

/**
 * Converts an integer to 2 digits hex number
 *
 * @param {Number} rgb A decimal value from 0 to 255
 * @returns An hex string of 2 chars
 */
function rgbToHex (rgb) {
  let hex = Number(rgb).toString(16)
  if (hex.length < 2) {
    hex = '0' + hex
  }
  return hex
}

/**
 * Get node name from node object
 *
 * @param {Object} node The Zwave Node Object
 * @returns A string in the format [<location>-]<name>, if location doesn't exist it will be ignored, if the node name doesn't exists the node id with node prefix string will be used
 */
function getNodeName (node) {
  return (
    (node.loc ? node.loc + '-' : '') +
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
 * Checks if an object_id is a rgb_dimmer
 *
 * @param {String} id object id of the hass discovery payload
 * @returns true if the discovery payload object id is a rgb_dimmer
 */
function isRgbDimmer (id) {
  return id.startsWith('rgb_dimmer')
}

/**
 * Get the device Object to send in discovery payload
 *
 * @param {Object} node A Zwave Node Object
 * @param {String} nodeName Node name from getNodeName function
 * @returns The Hass device object
 */
function deviceInfo (node, nodeName) {
  return {
    identifiers: ['zwavejs2mqtt_' + this.zwave.homeHex + '_node' + node.id],
    manufacturer: node.manufacturer,
    model: node.product + ' (' + node.productid + ')',
    name: nodeName,
    sw_version: node.version || version
  }
}

/**
 * Get the Hass discovery topic for the specific node and hassDevice
 *
 * @param {Object} hassDevice The Hass device object configuration
 * @param {String} nodeName Node name from getNodeName function
 * @returns The topic string for this device discovery
 */
function getDiscoveryTopic (hassDevice, nodeName) {
  return `${hassDevice.type}/${nodeName}/${hassDevice.object_id}/config`
}

/**
 * Calculate the correct template string to use for modes templates
 * based on gateway settings and mapped mode values
 *
 * @param {Object} modeMap The Object with mode mapping key : value
 * @param {String} defaultValue The default value for the mode
 * @returns {String} The template to use for the mode
 */
function getMappedValuesTemplate (modeMap, defaultValue) {
  const map = {}
  for (const key in modeMap) map[modeMap[key]] = key

  return `{{ ${JSON.stringify(
    map
  )}[value_json.value] | default('${defaultValue}') }}`
}

/**
 * Retrives the value of a property from the node valueId
 *
 * @param {Object} payload discovery payload
 * @param {String} prop property name
 * @param {Object} node node object
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
 * Parse the value of the payload received from mqtt
 * based on the type of the payload and the gateway config
 */
Gateway.prototype.parsePayload = function (payload, valueId, valueConf) {
  try {
    payload = payload.hasOwnProperty('value') ? payload.value : payload

    // Hass payload parsing
    if (this.discovered[valueId.id]) {
      // parse payload for switches
      const isDimmer = isRgbDimmer(this.discovered[valueId.id].object_id)

      if (
        (valueId.type === 'boolean' || isDimmer) &&
        typeof payload === 'string'
      ) {
        if (/\btrue\b|\bon\b|\block\b/gi.test(payload)) payload = true
        else if (/\bfalse\b|\boff\b|\bunlock\b/gi.test(payload)) payload = false
      }

      if (isDimmer) {
        if (typeof payload === 'boolean') payload = payload ? 99 : 0
        else payload = Math.round((payload / 255) * 99)
      }

      // map modes coming from hass
      if (valueId.list && valueId.states.find(v => v.value === payload)) {
        const hassDevice = this.discovered[valueId.id]
        if (hassDevice) {
          // for thermostat_fan_mode command class use the fan_mode_map
          if (valueId.commandClass === 0x44 && hassDevice.fan_mode_map) {
            payload = hassDevice.fan_mode_map[payload]
          } else if (hassDevice.mode_map) {
            // for other command classes use the mode_map
            payload = hassDevice.mode_map[payload]
          }
        }
      }

      // switch_toggle_binary and color
      if (valueId.commandClass === 0x28) payload = 1
      else if (valueId.commandClass === 0x29) {
        payload = valueId.value > 0 ? 0 : 0xff
      } else if (valueId.commandClass === 0x33 && typeof payload === 'string') {
        const rgb = payload.split(',')
        if (rgb.length === 3) {
          payload = '#' + rgbToHex(rgb[0]) + rgbToHex(rgb[1]) + rgbToHex(rgb[2])
        }
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
        const parsedVal = evalFunction(
          valueConf.receiveFunction,
          valueId,
          payload
        )
        if (parsedVal != null) {
          payload = parsedVal
        }
      }
    }
  } catch (error) {
    debug('Error while parsing payload', payload, 'for valueID', valueId)
  }

  return payload
}

/**
 * Method used to close clients connection, use this before destroy
 */
Gateway.prototype.close = async function () {
  this.closed = true

  debug('Closing Gateway...')

  if (this.mqtt) {
    await this.mqtt.close()
  }

  if (this.zwave) {
    this.zwave.close()
  }
}

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
    topic[i] = this.mqtt.cleanName(topic[i])
  }

  return topic.join('/')
}

Gateway.prototype.valueTopic = function (node, valueId, returnObject) {
  const topic = []
  let valueConf

  const vID = valueId.id

  // check if this value is in configuration values array
  const values = this.config.values.filter(v => v.device === node.deviceId)
  if (values && values.length > 0) {
    valueConf = values.find(v => v.value.id === vID)
  }

  if (valueConf && valueConf.topic) {
    topic.push(node.name ? node.name : NODE_PREFIX + valueId.nodeId)
    topic.push(valueConf.topic)
  }

  // if is not in configuration values array get the topic
  // based on gateway type if manual type this will be skipped
  if (topic.length === 0) {
    switch (this.config.type) {
      case 1: // named
        topic.push(node.name ? node.name : NODE_PREFIX + valueId.nodeId)
        topic.push(Constants.commandClass(valueId.commandClass))

        if (valueId.endpoint > 0) {
          topic.push('endpoint_' + valueId.endpoint)
        }

        topic.push(valueId.propertyName)
        if (valueId.propertyKey) {
          topic.push(valueId.propertyKey)
        }
        break
      case 0: // valueid
        if (!this.config.nodeNames) {
          topic.push(valueId.nodeId)
        } else {
          topic.push(node.name ? node.name : NODE_PREFIX + valueId.nodeId)
        }
        topic.push(valueId.commandClass)
        topic.push(valueId.endpoint)
        topic.push(valueId.property)
        if (valueId.propertyKey) {
          topic.push(valueId.propertyKey)
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
      topic[i] = this.mqtt.cleanName(topic[i])
    }

    return returnObject
      ? { topic: topic.join('/'), valueConf: valueConf }
      : topic.join('/')
  } else {
    return null
  }
}

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
      this.discoverValue(node, node.values[id])
    }

    this.zwave.emitEvent(this.zwave.socketEvents.nodeUpdated, node)
  }
}

Gateway.prototype.disableDiscovery = function (nodeID) {
  const node = this.zwave.nodes[nodeID]
  if (node && node.hassDevices) {
    for (const id in node.hassDevices) {
      node.hassDevices[id].ignoreDiscovery = true
    }

    this.zwave.emitEvent(this.zwave.socketEvents.nodeUpdated, node)
  }
}

Gateway.prototype.publishDiscovery = function (
  hassDevice,
  nodeId,
  deleteDevice,
  update
) {
  try {
    if (hassDevice.ignoreDiscovery) {
      return
    } else {
      hassDevice.ignoreDiscovery = false
    }

    // set values as discovered
    for (let k = 0; k < hassDevice.values.length; k++) {
      this.discovered[nodeId + '-' + hassDevice.values[k]] = hassDevice
    }

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

    if (update) {
      this.zwave.updateDevice(hassDevice, nodeId, deleteDevice)
    }
  } catch (error) {
    debug('Error while publishing node %d: %s', nodeId, error.message)
  }
}

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

          if (currTemp.units) {
            payload.temperature_unit = currTemp.units.includes('C') ? 'C' : 'F'
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
        const nodeName = getNodeName(node)

        // Set device information using node info
        payload.device = deviceInfo.call(this, node, nodeName)

        // Set a friendly name for this component
        payload.name = `${nodeName}_${hassDevice.object_id}`

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

        node.hassDevices[hassID] = hassDevice

        this.publishDiscovery(hassDevice, node.id)
      }
    }
  } catch (error) {
    debug(
      'Error while discovering device %s of node %d: %s',
      hassID,
      node.id,
      error.message
    )
  }
}

Gateway.prototype.discoverValue = function (node, valueId) {
  if (this.discovered[valueId.id] || valueId.genre !== 'user') return

  try {
    const result = this.valueTopic(node, valueId, true)

    const topic = result.topic

    if (!topic) return

    const valueConf = result.valueConf

    const nodeName = getNodeName(node)

    const type = Constants.commandClass(valueId.commandClass)
    let cfg

    switch (type) {
      case 'switch_binary':
      case 'switch_all':
      case 'switch_toggle_binary':
        if (valueId.index === 0) {
          const rgb = node.values['51-1-0']
          if (rgb) {
            cfg = copy(hassCfg.light_rgb_switch)
            cfg.discovery_payload.rgb_state_topic = this.mqtt.getTopic(
              this.valueTopic(node, rgb)
            )
            cfg.discovery_payload.rgb_command_topic =
              cfg.discovery_payload.rgb_state_topic + '/set'
          } else {
            cfg = copy(hassCfg.switch)
          }
        } else return
        break
      case 'barrier_operator':
        if (valueId.index === 1) {
          cfg = copy(hassCfg.barrier_state)
        } else return
        break
      case 'switch_multilevel':
      case 'switch_toggle_multilevel':
        if (valueId.index === 0) {
          const specificDeviceClass = Constants.specificDeviceClass(
            node.generic_device_class,
            node.specific_device_class
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
            cfg.discovery_payload.state_topic = this.mqtt.getTopic(topic)
            cfg.discovery_payload.command_topic =
              cfg.discovery_payload.state_topic + '/set'
            cfg.discovery_payload.position_topic = this.mqtt.getTopic(topic)
            cfg.discovery_payload.set_position_topic =
              cfg.discovery_payload.position_topic + '/set'
            cfg.discovery_payload.value_template =
              '{{ value_json.value | round(0) }}'
            cfg.discovery_payload.position_open = 99
            cfg.discovery_payload.position_closed = 0
            cfg.discovery_payload.payload_open = 99
            cfg.discovery_payload.payload_close = 0
          } else {
            // ... otherwise use a light dimmer configuration
            // brightness level
            const rgb = node.values['51-1-0']
            if (rgb) {
              cfg = copy(hassCfg.light_rgb_dimmer)
              cfg.discovery_payload.rgb_state_topic = this.mqtt.getTopic(
                this.valueTopic(node, rgb)
              )
              cfg.discovery_payload.rgb_command_topic =
                cfg.discovery_payload.rgb_state_topic + '/set'
              cfg.discovery_payload.brightness_state_topic = this.mqtt.getTopic(
                topic
              )
              cfg.discovery_payload.brightness_command_topic =
                cfg.discovery_payload.brightness_state_topic + '/set'
            } else {
              cfg = copy(hassCfg.light_dimmer)
            }
          }
        } else return
        break
      case 'door_lock':
        if (valueId.index === 0) {
          // lock state
          cfg = copy(hassCfg.lock)
        } else {
          return
        }
        break
      case 'sound_switch':
        // https://github.com/OpenZWave/open-zwave/blob/master/config/Localization.xml#L1575
        if (valueId.index === 2) {
          // volume control
          cfg = copy(hassCfg.volume_dimmer)
          cfg.discovery_payload.brightness_state_topic = this.mqtt.getTopic(
            topic
          )
          cfg.discovery_payload.command_topic =
            cfg.discovery_payload.brightness_state_topic + '/set'
          cfg.discovery_payload.brightness_command_topic =
            cfg.discovery_payload.command_topic
        } else {
          return
        }
        break
      case 'central_scene':
      case 'scene_activation':
        cfg = copy(hassCfg.central_scene)
        break
      case 'sensor_binary':
        // try to guess the type
        if (/\bmotion\b/gi.test(valueId.label)) {
          cfg = copy(hassCfg.binary_sensor_occupancy)
        } else if (/\btamper\b/gi.test(valueId.label)) {
          cfg = copy(hassCfg.binary_sensor_tamper)
        } else if (/\balarm\b/gi.test(valueId.label)) {
          cfg = copy(hassCfg.binary_sensor_alarm)
        } else {
          cfg = copy(hassCfg.binary_sensor_contact)
        }

        if (valueConf) {
          if (valueConf.device_class) {
            cfg.discovery_payload.device_class = valueConf.device_class
            cfg.object_id = valueConf.device_class
          }
          // binary sensors doesn't support icons
        }

        break
      case 'sensor_alarm':
        const alarmMap = {
          0: 'general',
          1: 'smoke',
          2: 'carbon_monoxide',
          3: 'carbon_dioxide',
          4: 'heat',
          5: 'flood'
        }
        cfg = copy(hassCfg.binary_sensor_alarm)
        cfg.object_id += alarmMap[valueId.index]
          ? '_' + alarmMap[valueId.index]
          : ''
        break

      case 'alarm':
        cfg = copy(hassCfg.sensor_generic)
        cfg.object_id = 'alarm_' + Constants.alarmType(valueId.index)
        cfg.discovery_payload.icon = 'mdi:alarm-light'
        break
      case 'sensor_multilevel':
      case 'meter':
      case 'meter_pulse':
      case 'time':
      case 'energy_production':
      case 'battery':
        let sensor = null

        // https://github.com/OpenZWave/open-zwave/blob/master/config/Localization.xml#L885
        if (type === 'sensor_multilevel') {
          sensor = Constants.sensorType(valueId.index)
        } else if (type === 'meter') {
          // https://github.com/OpenZWave/open-zwave/blob/master/config/Localization.xml#L680
          sensor = Constants.meterType(valueId.index)
        } else if (type === 'meter_pulse') {
          sensor = {
            sensor: 'pulse',
            objectId: 'meter',
            props: {}
          }
        } else if (type === 'time') {
          if (valueId.index === 0) {
            sensor = {
              sensor: 'date',
              objectId: 'current',
              props: {
                device_class: 'timestamp'
              }
            }
          } else return
        } else if (type === 'energy_production') {
          sensor = Constants.productionType(valueId.index)
        } else if (type === 'battery') {
          if (valueId.index === 0) {
            sensor = {
              sensor: 'battery',
              objectId: 'level',
              props: {
                device_class: 'battery'
              }
            }
          } else return
        }

        cfg = copy(hassCfg.sensor_generic)
        cfg.object_id =
          sensor.sensor + (sensor.objectId ? '_' + sensor.objectId : '')

        Object.assign(cfg.discovery_payload, sensor.props || {})

        if (valueId.units) {
          const hassUnitOfMeasurementMap = {
            C: '°C',
            F: '°F'
          }
          cfg.discovery_payload.unit_of_measurement =
            hassUnitOfMeasurementMap[valueId.units] || valueId.units
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
      // case 'color':
      //   if (valueId.index === 0) {
      //     cfg = copy(hassCfg.light_rgb)
      //     cfg.discovery_payload.rgb_state_topic = this.mqtt.getTopic(topic)
      //     cfg.discovery_payload.rgb_command_topic = cfg.discovery_payload.rgb_state_topic + '/set'
      //   } else return
      //   break
      default:
        return
    }

    const payload = cfg.discovery_payload

    if (
      !payload.hasOwnProperty('state_topic') ||
      payload.state_topic === true
    ) {
      payload.state_topic = this.mqtt.getTopic(topic)
    } else if (payload.state_topic === false) {
      delete payload.state_topic
    }

    if (payload.command_topic === true) {
      payload.command_topic = this.mqtt.getTopic(topic, true)
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
    if (valueId.endpoint > 1) cfg.object_id += '_' + valueId.endpoint

    // Check if another value already exists and add the index to object_id to make it unique
    if (node.hassDevices[cfg.type + '_' + cfg.object_id]) {
      cfg.object_id += '_' + valueId.index
    }

    // Set a friendly name for this component
    payload.name = `${nodeName}_${cfg.object_id}`

    // Set a unique id for the component
    payload.unique_id = 'zwavejs2mqtt_' + this.zwave.homeHex + '_' + valueId.id

    const discoveryTopic = getDiscoveryTopic(cfg, nodeName)

    cfg.discoveryTopic = discoveryTopic
    cfg.values = [valueId.id]

    // This configuration is not stored in nodes.json
    cfg.persistent = false

    node.hassDevices[cfg.type + '_' + cfg.object_id] = cfg

    this.publishDiscovery(cfg, node.id)
  } catch (error) {
    debug(
      'Error while discovering value %s of node %d: %s',
      valueId.id,
      node.id,
      error.message
    )
  }
}

module.exports = Gateway
