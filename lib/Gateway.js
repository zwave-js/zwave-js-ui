/* eslint-disable no-eval */
/* eslint-disable one-var */
'use strict'

const fs = require('fs')
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

var CUSTOM_DEVICES = reqlib('config/app.js').storeDir + '/customDevices'
var allDevices = hassDevices // will contain customDevices + hassDevices

debug.color = 2

// util function to watch for file changes, prevents the watch to be called twice
const watch = (path, fn) => {
  var lock = false
  fs.watch(path, function () {
    if (lock) return

    lock = true
    fn()
    setTimeout(() => { lock = false }, 1000)
  })
}

function loadCustomDevices (devices) {
  allDevices = Object.assign({}, hassDevices, devices)
  debug('Loaded', Object.keys(devices).length, 'custom Hass devices configurations')
}

try {
  const devices = reqlib(CUSTOM_DEVICES)
  loadCustomDevices(devices)
  CUSTOM_DEVICES = utils.joinPath(true, CUSTOM_DEVICES)
  if (fs.existsSync(CUSTOM_DEVICES + '.json')) {
    watch(CUSTOM_DEVICES + '.json', function () {
      try {
        const fileContent = fs.readFileSync(CUSTOM_DEVICES + '.json')
        loadCustomDevices(JSON.parse(fileContent))
      } catch (error) {
        debug('Error while reading', CUSTOM_DEVICES + '.json', error.message)
      }
    })
  }
} catch (error) {
  if (error.message.indexOf('Cannot find module') >= 0) {
    debug('No customDevices file found')
  } else {
    debug('Error while parsing customDevices file:', error.message)
  }
}

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

  if (mqtt) {
    mqtt.on('writeRequest', onWriteRequest.bind(this))
    mqtt.on('broadcastRequest', onBroadRequest.bind(this))
    mqtt.on('apiCall', onApiRequest.bind(this))
    mqtt.on('hassStatus', onHassStatus.bind(this))
    mqtt.on('brokerStatus', onBrokerStatus.bind(this))
  }

  if (zwave) {
    zwave.on('valueChanged', onValueChanged.bind(this))
    zwave.on('nodeStatus', onNodeStatus.bind(this))
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
function onEvent (name, ...args) {
  var topic = this.mqtt.eventsPrefix + '/' + this.mqtt.clientID + '/' + name.replace(/\s/g, '_')
  this.mqtt.publish(topic, {data: args}, { qos: 1, retain: false })
}

/**
 * Zwave event triggered when a scan is completed
 */
function onScanComplete (nodes) {

}

/**
 * Zwave event triggered when a node is removed
 */
function onNodeRemoved (node) {
  const prefix = node.node_id + '-'

  // delete discovered values
  for (var id in this.discovered) {
    if (id.startsWith(prefix)) {
      delete this.discovered[id]
    }
  }
}

/**
 * Zwave event triggered when there is a node or scene event
 */
function onNodeSceneEvent (event, node, code) {
  var topic = this.nodeTopic(node)

  if (event === 'node') {
    topic += '/event'
  } else if (event === 'scene') {
    topic += '/scene/event'
  } else {
    return
  }

  var data

  if (this.config.payloadType === 2) data = code
  else data = { time: Date.now(), value: code }

  this.mqtt.publish(topic, data, { qos: 1, retain: false })
}

/**
 * Zwave event triggered when a value changes
 */
function onValueChanged (valueId, node, changed) {
  var data, topic, valueConf

  valueId.lastUpdate = Date.now()

  // emit event to socket
  if (this.zwave) this.zwave.emitEvent('VALUE_UPDATED', valueId)

  var result = this.valueTopic(node, valueId, true)

  if (!result) return

  // if there is a valid topic for this value publish it

  topic = result.topic
  valueConf = result.valueConf
  // Parse valueId value and create the payload
  var tmpVal = valueId.value

  if (valueConf && isValidOperation(valueConf.postOperation)) {
    tmpVal = eval(valueId.value + valueConf.postOperation)
  }

  // Check if I need to update discovery topics of this device
  if (changed && valueId.type === 'list' && this.discovered[valueId.value_id]) {
    var hassDevice = this.discovered[valueId.value_id]
    var isOff = hassDevice.mode_map ? hassDevice.mode_map['off'] === valueId.value : false

    if (hassDevice && hassDevice.setpoint_topic && !isOff) {
      var setId = hassDevice.setpoint_topic[valueId.value]
      if (setId && node.values[setId]) {
        // check if the setpoint topic has changed
        var setpoint = node.values[setId]
        var setTopic = this.mqtt.getTopic(this.valueTopic(node, setpoint))
        if (setTopic !== hassDevice.discovery_payload.temperature_state_topic) {
          hassDevice.discovery_payload.temperature_state_topic = setTopic
          hassDevice.discovery_payload.temperature_command_topic = setTopic + '/set'
          this.publishDiscovery(hassDevice, node.node_id)
        }
      }
    }
  }

  tmpVal = valueId.type === 'list' && this.config.integerList ? valueId.values.indexOf(valueId.value) : tmpVal

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

  if (!valueId.read_only && !this.topicValues[topic]) {
    this.mqtt.subscribe(topic)

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

function onNodeStatus (node) {
  if (node.ready && this.config.hassDiscovery) {
    for (const id in node.hassDevices) {
      if (node.hassDevices[id].persistent) {
        this.publishDiscovery(node.hassDevices[id], node.node_id)
      }
    }

    const nodeDevices = allDevices[node.device_id] || []
    nodeDevices.forEach(device => this.discoverDevice(node, device))

    // discover node values (that are not part of a device)
    for (let id in node.values) {
      this.discoverValue(node, node.values[id])
    }
  }

  if (node.ready) { // enable poll and /or verify changes if required
    var values = this.config.values.filter(v => (v.enablePoll || v.verifyChanges) && v.device === node.device_id)
    for (var i = 0; i < values.length; i++) {
      // don't edit the original object, copy it
      var v = copy(values[i].value)
      v.node_id = node.node_id

      try {
        if (values[i].verifyChanges) {
          this.zwave.callApi('setChangeVerified', v, true)
        }

        if (values[i].enablePoll) {
          if (!this.zwave.client.isPolled(v)) {
            this.zwave.callApi('enablePoll', v, values[i].pollIntensity || 1)
          }
        } else if (this.zwave.client.isPolled(v)) {
          this.zwave.callApi('disablePoll', v)
        }
      } catch (error) {
        let op = values[i].verifyChanges ? 'verify changes' : 'enable poll'
        debug('Error while call', op, error.message)
      }
    }
  }

  if (this.zwave) this.zwave.emitEvent('NODE_UPDATED', node)

  if (!this.config.ignoreStatus) {
    var topic = this.nodeTopic(node) + '/status'
    var data

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
    var args = payload.args || []
    var result = await this.zwave.callApi(apiName, ...args)
    this.mqtt.publish(topic, result)
  } else {
    debug('Requested Zwave api', apiName, "doesn't exist")
  }
}

function onBroadRequest (parts, payload) {
  var topic = parts.join('/')
  var values = Object.keys(this.topicValues).filter(t => t.endsWith(topic))

  if (values.length > 0) {
    // all values are the same type just different node,parse the Payload by using the first one
    payload = this.parsePayload(payload, this.topicValues[values[0]], this.topicValues[values[0]].conf)
    for (var i = 0; i < values.length; i++) {
      this.zwave.writeValue(this.topicValues[values[i]], payload)
    }
  }
}

function onWriteRequest (parts, payload) {
  var valueId = this.topicValues[parts.join('/')]

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
 * Converts an integer to 2 digits hex number
 *
 * @param {Number} rgb A decimal value from 0 to 255
 * @returns An hex string of 2 chars
 */
function rgbToHex (rgb) {
  var hex = Number(rgb).toString(16)
  if (hex.length < 2) {
    hex = '0' + hex
  }
  return hex
}

/**
 * Get the valueid string without the node part
 *
 * @param {*} v The zwave valueId object
 * @returns The value id in the form <comClass>-<instance>-index>
 */
function getValueID (v) {
  return v.value_id.substr(v.value_id.indexOf('-') + 1)
}

/**
 * Get node name from node object
 *
 * @param {Object} node The Zwave Node Object
 * @returns A string in the format [<location>-]<name>, if location doesn't exist it will be ignored, if the node name doesn't exists the node id with node prefix string will be used
 */
function getNodeName (node) {
  return (node.loc ? node.loc + '-' : '') + (node.name ? node.name : NODE_PREFIX + node.node_id)
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
 * Get Hass configurations based on valueID units
 *
 * @param {String} units The valueID units
 * @returns An array with compatible configurations
 */
// eslint-disable-next-line no-unused-vars
function typeByUnits (units) {
  var cfg = null

  // TODO: Support more units: https://github.com/OpenZWave/open-zwave/blob/master/config/SensorMultiLevelCCTypes.xml

  if (/\b(%)\b/gi.test(units)) {
    cfg = ['sensor_illuminance', 'sensor_humidity', 'sensor_gas_density']
  } else if (/\b(m\/s|mph|km\/h|kmh)\b/gi.test(units)) {
    cfg = ['sensor_speed']
  } else if (/\b(°)\b/gi.test(units)) {
    cfg = ['sensor_angle']
  } else if (/\b(c|f)\b/gi.test(units)) {
    cfg = ['sensor_temperature']
  } else if (/\b(w|v|watt|volt|kw|kwh|kw\/h)\b/gi.test(units)) {
    cfg = ['sensor_electricity']
  } else if (/\b(bar|pa|g\/m3|mmhg)\b/gi.test(units)) {
    cfg = ['sensor_humidity']
  }

  return cfg
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
    identifiers: ['zwave2mqtt_' + this.zwave.homeHex + '_node' + node.node_id],
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
 * @param {Object} valueId Zwave ValueId object
 * @param {Object} modeMap The Object with mode mapping key : value
 * @param {Boolean} integerList Gateway setting for sending list values as integer index
 * @param {String} defaultValue The default value for the mode
 * @returns {String} The template to use for the mode
 */
function getMappedValuesTemplate (valueId, modeMap, integerList, defaultValue) {
  let valueFilter = ''
  let map = {}
  for (const key in modeMap) map[modeMap[key]] = key
  let finalMap = map

  if (integerList) {
    valueFilter = ' | string'
    let mapi = {}

    for (let i = 0; i < valueId.values.length; i++) {
      mapi[i.toString()] = map[valueId.values[i]]
    }

    finalMap = mapi
  }

  return `{{ ${JSON.stringify(finalMap)}[value_json.value${valueFilter}] | default('${defaultValue}') }}`
}

/**
 * Parse the value of the payload received from mqtt
 * based on the type of the payload and the gateway config
 */
Gateway.prototype.parsePayload = function (payload, valueId, valueConf) {
  try {
    payload = payload.hasOwnProperty('value') ? payload.value : payload

    // Hass payload parsing
    if (this.discovered[valueId.value_id]) {
      // parse payload for switches
      if ((valueId.type === 'bool' || this.discovered[valueId.value_id].object_id === 'rgb_dimmer') && typeof payload === 'string') {
        if (/\btrue\b|\bon\b|\block\b/gi.test(payload)) payload = true
        else if (/\bfalse\b|\boff\b|\bunlock\b/gi.test(payload)) payload = false
      }

      if (this.discovered[valueId.value_id].object_id === 'rgb_dimmer') {
        if (typeof payload === 'boolean') payload = payload ? 99 : 0
        else payload = Math.round(payload / 255 * 99)
      }

      // map modes coming from hass
      if (valueId.type === 'list' && valueId.values.indexOf(payload) < 0) {
        let hassDevice = this.discovered[valueId.value_id]
        if (hassDevice) {
          // for thermostat_fan_mode command class use the fan_mode_map
          if (valueId.class_id === 0x44 && hassDevice.fan_mode_map) payload = hassDevice.fan_mode_map[payload]
          // for other command classes use the mode_map
          else if (hassDevice.mode_map) payload = hassDevice.mode_map[payload]
        }
      }

      // switch_toggle_binary and color
      if (valueId.class_id === 0x28) payload = 1
      else if (valueId.class_id === 0x29) payload = valueId.value > 0 ? 0 : 0xFF
      else if (valueId.class_id === 0x33 && typeof payload === 'string') {
        let rgb = payload.split(',')
        if (rgb.length === 3) {
          payload = '#' + rgbToHex(rgb[0]) + rgbToHex(rgb[1]) + rgbToHex(rgb[2])
        }
      }
    }

    // check if valueId is list type and payload is an index
    if (valueId.type === 'list' &&
      this.config.integerList &&
      !isNaN(payload) &&
      payload >= 0 &&
      payload < valueId.values.length) {
      payload = valueId.values[payload]
    }

    if (valueId.type === 'raw') {
      if (payload.type === 'Buffer' && payload.data) {
        payload = Buffer.from(payload.data)
      } else {
        payload = Buffer.from(payload)
      }
    }

    if (valueConf && isValidOperation(valueConf.postOperation)) {
      let op = valueConf.postOperation

      // revert operation to write
      if (op.includes('/')) op = op.replace('/', '*')
      else if (op.includes('*')) op = op.replace('*', '/')
      else if (op.includes('+')) op = op.replace('+', '-')
      else if (op.includes('-')) op = op.replace('-', '+')

      payload = eval(payload + op)
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

  if (this.mqtt) { await this.mqtt.close() }

  if (this.zwave) { this.zwave.close() }
}

Gateway.prototype.nodeTopic = function (node) {
  var topic = []

  if (node.loc && !this.config.ignoreLoc) topic.push(node.loc)

  switch (this.config.type) {
    case 2: // manual
    case 1: // named
      topic.push(node.name ? node.name : NODE_PREFIX + node.node_id)
      break
    case 0: // valueid
      if (!this.config.nodeNames) {
        topic.push(node.node_id)
      } else {
        topic.push(node.name ? node.name : NODE_PREFIX + node.node_id)
      }
      break
    default:
      topic.push(NODE_PREFIX + node.node_id)
  }

  // clean topic parts
  // eslint-disable-next-line no-redeclare
  for (let i = 0; i < topic.length; i++) {
    topic[i] = this.mqtt.cleanName(topic[i])
  }

  return topic.join('/')
}

Gateway.prototype.valueTopic = function (node, valueId, returnObject) {
  var topic = [], valueConf

  var vID = getValueID(valueId)

  // check if this value is in configuration values array
  var values = this.config.values.filter(v => v.device === node.device_id)
  if (values && values.length > 0) {
    valueConf = values.find(v => v.value.value_id === vID)
  }

  if (valueConf && valueConf.topic) {
    topic.push(node.name ? node.name : NODE_PREFIX + valueId.node_id)
    topic.push(valueConf.topic)
  }

  // if is not in configuration values array get the topic
  // based on gateway type if manual type this will be skipped
  if (topic.length === 0) {
    switch (this.config.type) {
      case 1: // named
        topic.push(node.name ? node.name : NODE_PREFIX + valueId.node_id)
        topic.push(Constants.commandClass(valueId.class_id))

        if (valueId.instance > 1) {
          topic.push('instance_' + valueId.instance)
        }

        topic.push(valueId.label.toLowerCase())
        break
      case 0: // valueid
        if (!this.config.nodeNames) {
          topic.push(valueId.node_id)
        } else {
          topic.push(node.name ? node.name : NODE_PREFIX + valueId.node_id)
        }
        topic.push(valueId.class_id)
        topic.push(valueId.instance)
        topic.push(valueId.index)
        break
    }
  }

  // if there is a valid topic for this value publish it
  if (topic.length > 0) {
    // add location prefix
    if (node.loc && !this.config.ignoreLoc) topic.unshift(node.loc)

    // clean topic parts
    for (var i = 0; i < topic.length; i++) {
      topic[i] = this.mqtt.cleanName(topic[i])
    }

    return returnObject ? { topic: topic.join('/'), valueConf: valueConf } : topic.join('/')
  } else {
    return null
  }
}

Gateway.prototype.rediscoverNode = function (nodeID) {
  var node = this.zwave.nodes[nodeID]
  if (node) {
    // delete all discovered values
    onNodeRemoved.call(this, node)
    node.hassDevices = {}

    // rediscover all values
    const nodeDevices = allDevices[node.device_id] || []
    nodeDevices.forEach(device => this.discoverDevice(node, device))

    // discover node values (that are not part of a device)
    for (let id in node.values) {
      this.discoverValue(node, node.values[id])
    }

    this.zwave.emitEvent('NODE_UPDATED', node)
  }
}

Gateway.prototype.publishDiscovery = function (hassDevice, nodeId, deleteDevice, update) {
  try {
    // set values as discovered
    for (let k = 0; k < hassDevice.values.length; k++) {
      this.discovered[nodeId + '-' + hassDevice.values[k]] = hassDevice
    }

    if (this.config.payloadType === 2) { // Payload is set to "Just Value"
      var p = hassDevice.discovery_payload
      var template = 'value' + (p.hasOwnProperty('payload_on') && p.hasOwnProperty('payload_off') ? ' == \'true\'' : '')

      for (const k in p) {
        if (typeof p[k] === 'string') {
          p[k] = p[k].replace(/value_json\.value/g, template)
        }
      }
    }

    this.mqtt.publish(hassDevice.discoveryTopic, deleteDevice ? '' : hassDevice.discovery_payload, { qos: 0, retain: this.config.retainedDiscovery || false }, this.config.discoveryPrefix)

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

  var nodes = this.zwave ? this.zwave.nodes : []
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
  let hassID = hassDevice ? hassDevice.type + '_' + hassDevice.object_id : null

  try {
    if (hassID && !node.hassDevices[hassID]) { // discover the device
      let payload

      // copy the configuration without edit the original object
      hassDevice = JSON.parse(JSON.stringify(hassDevice))

      if (hassDevice.type === 'climate') {
        payload = hassDevice.discovery_payload

        let mode = node.values[payload.mode_state_topic]
        let setId

        if (mode !== undefined) {
          setId = hassDevice.setpoint_topic && hassDevice.setpoint_topic[mode.value] ? hassDevice.setpoint_topic[mode.value] : hassDevice.default_setpoint
          // only setup modes if a state topic was defined
          payload.mode_state_template = getMappedValuesTemplate(mode, hassDevice.mode_map, this.config.integerList, 'off')
          payload.mode_state_topic = this.mqtt.getTopic(this.valueTopic(node, mode))
          payload.mode_command_topic = payload.mode_state_topic + '/set'
        } else {
          setId = hassDevice.default_setpoint
        }

        let setpoint = node.values[setId]
        payload.temperature_state_topic = this.mqtt.getTopic(this.valueTopic(node, setpoint))
        payload.temperature_command_topic = payload.temperature_state_topic + '/set'

        let action = node.values[payload.action_topic]
        if (action) payload.action_topic = this.mqtt.getTopic(this.valueTopic(node, action))

        let fan = node.values[payload.fan_mode_state_topic]
        if (fan !== undefined) {
          payload.fan_mode_state_topic = this.mqtt.getTopic(this.valueTopic(node, fan))
          payload.fan_mode_command_topic = payload.fan_mode_state_topic + '/set'

          if (hassDevice.fan_mode_map) {
            payload.fan_mode_state_template = getMappedValuesTemplate(fan, hassDevice.fan_mode_map, this.config.integerList, 'auto')
          }
        }

        let currTemp = node.values[payload.current_temperature_topic]
        if (currTemp !== undefined) {
          payload.current_temperature_topic = this.mqtt.getTopic(this.valueTopic(node, currTemp))
          // hass will default the precision to 0.1 for Celsius and 1.0 for Fahrenheit.
          // 1.0 is not granular enough as a default and there seems to be no harm in making it more precise.
          if (!payload.precision) payload.precision = 0.1
        }
      } else {
        payload = hassDevice.discovery_payload

        let topics = {}

        // populate topics object with valueId: valueTopic
        for (let i = 0; i < hassDevice.values.length; i++) {
          const v = hassDevice.values[i] // the value id
          topics[v] = node.values[v] ? this.mqtt.getTopic(this.valueTopic(node, node.values[v])) : null
        }

        // set the correct command/state topics
        for (const key in payload) {
          if (key.indexOf('topic') >= 0 && topics[payload[key]]) {
            payload[key] = topics[payload[key]] + ((key.indexOf('command') >= 0 || key.indexOf('set_')) >= 0 ? '/set' : '')
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
        payload.unique_id = `zwave2mqtt_` + this.zwave.homeHex + '_Node' + node.node_id + '_' + hassDevice.object_id

        const discoveryTopic = getDiscoveryTopic(hassDevice, nodeName)
        hassDevice.discoveryTopic = discoveryTopic

        // This configuration is not stored in nodes.json
        hassDevice.persistent = false

        node.hassDevices[hassID] = hassDevice

        this.publishDiscovery(hassDevice, node.node_id)
      }
    }
  } catch (error) {
    debug('Error while discovering device %s of node %d: %s', hassID, node.node_id, error.message)
  }
}

Gateway.prototype.discoverValue = function (node, valueId) {
  if (this.discovered[valueId.value_id] || valueId.genre !== 'user') return

  try {
    var topic, valueConf

    var result = this.valueTopic(node, valueId, true)

    topic = result.topic

    if (!topic) return

    valueConf = result.valueConf

    const nodeName = getNodeName(node)

    var type = Constants.commandClass(valueId.class_id)
    var cfg, payload

    switch (type) {
      case 'switch_binary':
      case 'switch_all':
      case 'switch_toggle_binary':
        if (valueId.index === 0) {
          let rgb = node.values['51-1-0']
          if (rgb) {
            cfg = copy(hassCfg.light_rgb_switch)
            cfg.discovery_payload.rgb_state_topic = this.mqtt.getTopic(this.valueTopic(node, rgb))
            cfg.discovery_payload.rgb_command_topic = cfg.discovery_payload.rgb_state_topic + '/set'
          } else {
            cfg = copy(hassCfg.switch)
          }
        } else return
        break
      case 'switch_multilevel':
      case 'switch_toggle_multilevel':
        // cfg = copy(hassCfg.cover_position)
        // cfg.discovery_payload.position_open = valueId.max || 100
        // cfg.discovery_payload.position_closed = valueId.min || 0
        // cfg.discovery_payload.position_topic = this.mqtt.getTopic(topic)
        // cfg.discovery_payload.set_position_topic = cfg.discovery_payload.position_topic + '/set'
        if (valueId.index === 0) { // brightness level
          let rgb = node.values['51-1-0']
          if (rgb) {
            cfg = copy(hassCfg.light_rgb_dimmer)
            cfg.discovery_payload.rgb_state_topic = this.mqtt.getTopic(this.valueTopic(node, rgb))
            cfg.discovery_payload.rgb_command_topic = cfg.discovery_payload.rgb_state_topic + '/set'
            cfg.discovery_payload.brightness_state_topic = this.mqtt.getTopic(topic)
            cfg.discovery_payload.brightness_command_topic = cfg.discovery_payload.brightness_state_topic + '/set'
          } else {
            cfg = copy(hassCfg.light_dimmer)
          }
        } else return
        break
      case 'door_lock':
        if (valueId.index === 0) { // lock state
          cfg = copy(hassCfg.lock)
        } else {
          return
        }
        break
      case 'sound_switch':
        // https://github.com/OpenZWave/open-zwave/blob/master/config/Localization.xml#L1575
        if (valueId.index === 2) { // volume control
          cfg = copy(hassCfg.volume_dimmer)
          cfg.discovery_payload.brightness_state_topic = this.mqtt.getTopic(topic)
          cfg.discovery_payload.command_topic = cfg.discovery_payload.brightness_state_topic + '/set'
          cfg.discovery_payload.brightness_command_topic = cfg.discovery_payload.command_topic
        } else {
          return
        }
        break
      case 'central_scene':
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
        let alarmMap = {
          0: 'general',
          1: 'smoke',
          2: 'carbon_monoxide',
          3: 'carbon_dioxide',
          4: 'heat',
          5: 'flood'
        }
        cfg = copy(hassCfg.binary_sensor_alarm)
        cfg.object_id += alarmMap[valueId.index] ? '_' + alarmMap[valueId.index] : ''
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
        } else if (type === 'meter') { // https://github.com/OpenZWave/open-zwave/blob/master/config/Localization.xml#L680
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
        cfg.object_id = sensor.sensor + (sensor.objectId ? '_' + sensor.objectId : '')

        Object.assign(cfg.discovery_payload, sensor.props || {})

        if (valueId.units) {
          cfg.discovery_payload.unit_of_measurement = valueId.units
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
      default: return
    }

    payload = cfg.discovery_payload

    if (!payload.hasOwnProperty('state_topic') || payload.state_topic === true) {
      payload.state_topic = this.mqtt.getTopic(topic)
    } else if (payload.state_topic === false) {
      delete payload.state_topic
    }

    if (payload.command_topic === true) payload.command_topic = this.mqtt.getTopic(topic, true)

    // Set availability topic using node status topic
    // payload.availability_topic = this.mqtt.getTopic(this.nodeTopic(node)) + '/status/hass'
    // payload.payload_available = true
    // payload.payload_not_available = false

    if (['binary_sensor', 'sensor', 'lock', 'climate', 'fan'].includes(cfg.type)) {
      payload.json_attributes_topic = payload.state_topic
    }

    // Set device information using node info
    payload.device = deviceInfo.call(this, node, nodeName)

    // multi instance devices would have same object_id
    if (valueId.instance > 1) cfg.object_id += '_' + valueId.instance

    // Check if another value already exists and add the index to object_id to make it unique
    if (node.hassDevices[cfg.type + '_' + cfg.object_id]) cfg.object_id += '_' + valueId.index

    // Set a friendly name for this component
    payload.name = `${nodeName}_${cfg.object_id}`

    // Set a unique id for the component
    payload.unique_id = 'zwave2mqtt_' + this.zwave.homeHex + '_' + valueId.value_id

    const discoveryTopic = getDiscoveryTopic(cfg, nodeName)

    cfg.discoveryTopic = discoveryTopic
    cfg.values = [getValueID(valueId)]

    // This configuration is not stored in nodes.json
    cfg.persistent = false

    node.hassDevices[cfg.type + '_' + cfg.object_id] = cfg

    this.publishDiscovery(cfg, node.node_id)
  } catch (error) {
    debug('Error while discovering value %s of node %d: %s', valueId.value_id, node.node_id, error.message)
  }
}

module.exports = Gateway
