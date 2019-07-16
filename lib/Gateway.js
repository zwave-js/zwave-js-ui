/* eslint-disable no-eval */
/* eslint-disable one-var */
'use strict'

const reqlib = require('app-root-path').require
const EventEmitter = require('events')
const comandClass = reqlib('/lib/Constants.js').comandClass
const debug = reqlib('/lib/debug')('Gateway')
const inherits = require('util').inherits
const hassCfg = reqlib('/hass/configurations.js')
const hassDevices = reqlib('/hass/devices.js')
const version = reqlib('package.json').version

debug.color = 2

const NODE_PREFIX = 'nodeID_'
// const GW_TYPES = ['valueID', 'named', 'manual']
// const PY_TYPES = ['time_value', 'zwave_value', 'just_value']

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

  if (mqtt && zwave) {
    mqtt.on('writeRequest', onWriteRequest.bind(this))
    mqtt.on('broadcastRequest', onBroadRequest.bind(this))
    mqtt.on('apiCall', onApiRequest.bind(this))
    mqtt.on('hassStatus', onHassStatus.bind(this))

    zwave.on('valueChanged', onValueChanged.bind(this))
    zwave.on('nodeStatus', onNodeStatus.bind(this))
    zwave.on('scanComplete', onScanComplete.bind(this))
    zwave.on('event', onEvent.bind(this))

    zwave.connect()
  } else {
    debug('Gateway needs both MQTT and Zwave Configuration to work')
  }
}

/**
 * Zwave event triggered when a scan is completed
 */
function onScanComplete (nodes) {

}

/**
 * Zwave event triggered when there is a node or scene event
 */
function onEvent (event, node, code) {
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

  this.mqtt.publish(topic, data)
}

/**
 * Zwave event triggered when a value changes
 */
function onValueChanged (valueId, node, changed) {
  var data, topic, valueConf

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
          this.publishDiscovery(hassDevice)
        }
      }
    }
  }

  tmpVal = valueId.type === 'list' && this.config.integerList ? valueId.values.indexOf(valueId.value) : tmpVal

  switch (this.config.payloadType) {
    case 1: // entire zwave valueId object
      data = valueId
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
      valueId = Object.assign({}, valueId)
      valueId.conf = valueConf
    }

    this.topicValues[topic] = valueId
  }

  this.mqtt.publish(topic, data)
}

function onNodeStatus (node) {
  if (this.zwave) this.zwave.emitEvent('NODE_UPDATED', node)

  if (node.available && this.config.hassDiscovery) {
    var nodeDevices = hassDevices[node.device_id] || []

    // discover node devices
    for (let i = 0; i < nodeDevices.length; i++) {
      this.discoverDevice(node, nodeDevices[i])
    }

    // discover node values (that are not part of a device)
    for (let id in node.values) {
      this.discoverValue(node, node.values[id])
    }
  }

  if (node.ready) { // enable poll and /or verify changes if required
    var values = this.config.values.filter(v => (v.enablePoll || v.verifyChanges) && v.device === node.device_id)
    for (var i = 0; i < values.length; i++) {
      // don't edit the original object, copy it
      var v = Object.assign({}, values[i].value)
      v.node_id = node.node_id
      if (values[i].enablePoll) {
        if (!this.zwave.client.isPolled(v)) {
          this.zwave.callApi('enablePoll', v, values[i].pollIntensity || 1)
        }
      } else if (values[i].verifyChanges) {
        this.zwave.callApi('setChangeVerified', v, true)
      }
    }
  }

  var topic = this.nodeTopic(node) + '/status'
  var data

  if (this.config.payloadType === 2) {
    data = node.ready
  } else {
    data = { time: Date.now(), value: node.ready }
  }

  this.mqtt.publish(topic, data)
}

function onHassStatus (online) {
  debug('Home Assistant is ' + (online ? 'ONLINE' : 'OFFLINE'))

  if (online) {
    var nodes = this.zwave ? this.zwave.nodes : []
    for (let i = 0; i < nodes.length; i++) {
      const hassDevices = nodes[i] && nodes[i].hassDevices ? nodes[i].hassDevices : {}
      for (const id in hassDevices) {
        const hassDevice = hassDevices[id]
        if (hassDevice && hassDevice.discoveryTopic && hassDevice.discovery_payload) {
          this.publishDiscovery(hassDevice)
        }
      } // end foreach hassdevice
    } // end foreach node
  } // end if online
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
 * Get the device Object to send in discovery payload
 *
 * @param {Object} node A Zwave Node Object
 * @param {String} nodeName Node name from getNodeName function
 * @returns The Hass device object
 */
function deviceInfo (node, nodeName) {
  return {
    identifiers: ['zwave2mqtt_' + nodeName],
    manufacturer: node.manufacturer,
    model: node.productid,
    name: node.product,
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
 * Calcolate the correct template string to use for Hass climate mode value
 * based on gateway settings and mapped mode values
 *
 * @param {Object} valueId Zwave ValueId object
 * @param {Object} modeMap The Object with mode mapping key : value
 * @param {Boolean} integerList Gateway setting for sending list values as integer index
 * @returns A string with the template to use for mode
 */
function getMappedValues (valueId, modeMap, integerList) {
  var map = {}
  for (const k in modeMap) map[modeMap[k]] = k

  if (!integerList) return { map: map, check: 'values[value_json.value] if value_json.value in values.keys() else \'off\'' }

  var mapi = {}

  for (let i = 0; i < valueId.values.length; i++) {
    mapi[i.toString()] = map[valueId.values[i]]
  }

  return { map: mapi, check: 'values[value_json.value | string] if value_json.value | string in values else \'off\'' }
}

/**
* Parse the value of the payload received from mqtt
* based on the type of the payload and the gateway config
*/
Gateway.prototype.parsePayload = function (payload, valueId, valueConf) {
  payload = payload.hasOwnProperty('value') ? payload.value : payload

  // Hass payload parsing
  if (this.discovered[valueId.value_id]) {
    // parse payload for switchs
    if (valueId.type === 'bool' && typeof payload === 'string') {
      if (/\btrue\b|\bon\b/gi.test(payload)) payload = true
      else if (/\bfalse\b|\boff\b/gi.test(payload)) payload = false
    }

    // map modes coming from hass
    if (valueId.type === 'list' && valueId.values.indexOf(payload) < 0) {
      var hassDevice = this.discovered[valueId.value_id]
      payload = hassDevice.mode_map ? hassDevice.mode_map[payload] : payload
    }

    // switch_toggle_binary and color
    if (valueId.class_id === 0x28) payload = 1
    else if (valueId.class_id === 0x29) payload = valueId.value > 0 ? 0 : 0xFF
    else if (valueId.class_id === 0x33 && typeof payload === 'string') {
      var rgb = payload.split(',')
      if (rgb.length === 3) {
        payload = '#' + rgbToHex(rgb[0]) + rgbToHex(rgb[1]) + rgbToHex(rgb[2]) + '00'
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

  if (valueConf && isValidOperation(valueConf.postOperation)) {
    var op = valueConf.postOperation

    // revert operation to write
    if (op.includes('/')) { op = op.replace('/', '*') } else if (op.includes('*')) { op = op.replace('*', '/') } else if (op.includes('+')) { op = op.replace('+', '-') } else if (op.includes('-')) { op = op.replace('-', '+') }

    payload = eval(payload + op)
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

  if (node.loc) topic.push(node.loc)

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
        topic.push(comandClass(valueId.class_id))

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
    if (node.loc) topic.unshift(node.loc)

    // clean topic parts
    for (var i = 0; i < topic.length; i++) {
      topic[i] = this.mqtt.cleanName(topic[i])
    }

    return returnObject ? { topic: topic.join('/'), valueConf: valueConf } : topic.join('/')
  } else {
    return null
  }
}

Gateway.prototype.publishDiscovery = function (hassDevice, deleteDevice, nodeId) {
  this.mqtt.publish(hassDevice.discoveryTopic, deleteDevice ? '' : hassDevice.discovery_payload, { qos: 0, retain: false })
  if (nodeId && this.zwave.nodes[nodeId] && hassDevice.id && this.zwave.nodes[nodeId].hassDevices[hassDevice.id]) {
    if (deleteDevice) {
      delete this.zwave.nodes.hassDevices[hassDevice.id]
    } else {
      var id = hassDevice.id
      delete hassDevice.id
      this.zwave.nodes.hassDevices[id] = hassDevice
    }
  }
}

Gateway.prototype.discoverDevice = function (node, hassDevice) {
  var hassID = hassDevice ? hassDevice.type + '_' + hassDevice.object_id : null

  if (hassID && !node.hassDevices[hassID]) { // discover the device
    var payload

    // copy the configuration without edit the original object
    hassDevice = JSON.parse(JSON.stringify(hassDevice))

    if (hassDevice.type === 'climate') {
      payload = hassDevice.discovery_payload

      var mode = node.values[payload.mode_state_topic]
      var currTemp = node.values[payload.current_temperature_topic]
      var setId = hassDevice.setpoint_topic && hassDevice.setpoint_topic[mode.value] ? hassDevice.setpoint_topic[mode.value] : hassDevice.default_setpoint
      var setpoint = node.values[setId]

      var map = getMappedValues(mode, hassDevice.mode_map, this.config.integerList)

      payload.mode_state_template = `{% set values = ${JSON.stringify(map.map)} %} {{ ${map.check} }}`

      payload.mode_state_topic = this.mqtt.getTopic(this.valueTopic(node, mode))
      payload.mode_command_topic = payload.mode_state_topic + '/set'
      payload.current_temperature_topic = this.mqtt.getTopic(this.valueTopic(node, currTemp))
      payload.temperature_state_topic = this.mqtt.getTopic(this.valueTopic(node, setpoint))
      payload.temperature_command_topic = payload.temperature_state_topic + '/set'
    }

    if (payload) {
      const nodeName = getNodeName(node)

      // Set device information using node info
      payload.device = deviceInfo(node, nodeName)

      // Set a friendly name for this component
      payload.name = `${nodeName}_${hassDevice.object_id}`
      // set a unique id for the component
      payload.unique_id = `zwave2mqtt_` + '_' + payload.name

      // set values as discovered
      for (let k = 0; k < hassDevice.values.length; k++) {
        this.discovered[node.node_id + '-' + hassDevice.values[k]] = hassDevice
      }

      const discoveryTopic = getDiscoveryTopic(hassDevice, nodeName)
      hassDevice.discoveryTopic = discoveryTopic

      node.hassDevices[hassID] = hassDevice

      this.publishDiscovery(hassDevice)
    }
  }
}

Gateway.prototype.discoverValue = function (node, valueId) {
  if (this.discovered[valueId.value_id] || valueId.genre !== 'user') return

  var topic, valueConf

  var result = this.valueTopic(node, valueId, true)

  topic = result.topic

  if (!topic) return

  valueConf = result.valueConf

  const nodeName = getNodeName(node)

  var type = comandClass(valueId.class_id)
  var cfg, payload

  switch (type) {
    case 'switch_binary':
    case 'switch_all':
    case 'switch_toggle_binary':
      cfg = Object.assign({}, hassCfg.switch)
      break
    case 'switch_multilevel':
    case 'switch_toggle_multilevel':
      // cfg = Object.assign({}, hassCfg.cover_position)
      // cfg.discovery_payload.position_open = valueId.max || 100
      // cfg.discovery_payload.position_closed = valueId.min || 0
      // cfg.discovery_payload.position_topic = this.mqtt.getTopic(topic)
      // cfg.discovery_payload.set_position_topic = cfg.discovery_payload.position_topic + '/set'
      if (valueId.index === 0) { // brightness level
        cfg = Object.assign({}, hassCfg.light_dimmer)
        cfg.discovery_payload.brightness_scale = valueId.max || 255
        cfg.discovery_payload.state_topic = this.mqtt.getTopic(topic)
        cfg.discovery_payload.brightness_state_topic = cfg.discovery_payload.state_topic
        cfg.discovery_payload.brightness_command_topic = cfg.discovery_payload.state_topic + '/set'
        cfg.discovery_payload.state_value_template = `{{ 'off' if value_json.value == 0 else 'on }}`
        cfg.discovery_payload.command_off_template = '{"value": 0}}'
        cfg.discovery_payload.command_on_template = `{"value": ${valueId.max || 255}}`
      } else {
        return
      }
      break
    case 'sensor_binary':
      // try to guess the type
      if (/\bmotion\b/gi.test(valueId.label)) {
        cfg = Object.assign({}, hassCfg.binary_sensor_occupancy)
      } else if (/\tamper\b/gi.test(valueId.label)) {
        cfg = Object.assign({}, hassCfg.binary_sensor_tamper)
      } else if (/\balarm\b/gi.test(valueId.label)) {
        cfg = Object.assign({}, hassCfg.binary_sensor_alarm)
      } else {
        cfg = Object.assign({}, hassCfg.binary_sensor_contact)
      }

      if (valueConf) {
        if (valueConf.device_class) {
          cfg.discovery_payload.device_class = valueConf.device_class
          cfg.object_id = valueConf.device_class
        }
        if (valueConf.icon) cfg.discovery_payload.icon = valueConf.icon
      }

      break
    case 'sensor_alarm':
      cfg = Object.assign({}, hassCfg.binary_sensor_alarm)
      break
    case 'sensor_multilevel':
    case 'meter':
    case 'meter_pulse':

      // https://github.com/OpenZWave/open-zwave/blob/master/config/Localization.xml#L885
      if (type === 'sensor_multilevel') {
        let index = valueId.index > 255 ? valueId.index - 255 : valueId.index
        switch (index) {
          case 1: // air temp
          case 23: // water temperature
          case 24: // soil temperature
          case 72: // return air temperature
          case 73: // supply air temperature
          case 74: // condenser coil temperature
          case 75: // evaporator coil temperature
          case 76: // liquid line temperature
          case 77: // discharge temperature
          case 80: // defrost temperature
            cfg = 'sensor_temperature'
            break
          case 3: // luminance
            cfg = 'sensor_illuminance'
            break
          case 5: // humidity
            cfg = 'sensor_humidity'
            break
          case 15: // voltage
          case 4: // power
            cfg = 'sensor_power'
            break
          case 17: // carbon dioxide
          case 40: // carbon monoxide
          case 55: // smoke density
            cfg = 'sensor_gas_density'
            break
          case 57: // water pressure
          case 45: // blood pressure
          case 8: // athmosferic pressure
          case 9: // barometric pressure
            cfg = 'sensor_pressure'
            break
        }
      } else if (type === 'meter') { // https://github.com/OpenZWave/open-zwave/blob/master/config/Localization.xml#L680
        let index = valueId.index
        if (index <= 9 || index === 48 || index === 64) cfg = 'sensor_power'
        else {
          switch (index) {
            case 32:
            case 33:
            case 34:
              cfg = 'sensor_water'
              break
            case 16:
            case 17:
              cfg = 'sensor_gas_density'
              break
            case 19:
            case 35:
              cfg = 'sensor_pulse'
          }
        }
      }

      if (cfg) cfg = Object.assign({}, hassCfg[cfg])
      else {
        // try to guess sensor type
        if (/°|C/gi.test(valueId.units)) {
          cfg = Object.assign({}, hassCfg.sensor_temperature)
        } else if (/W/gi.test(valueId.units)) {
          cfg = Object.assign({}, hassCfg.sensor_power)
        } else {
          cfg = Object.assign({}, hassCfg.sensor_generic)
        }
      }

      if (valueId.units) cfg.discovery_payload.unit_of_measurement = valueId.units

      if (valueConf) {
        if (valueConf.device_class) {
          cfg.discovery_payload.device_class = valueConf.device_class
          cfg.object_id = valueConf.device_class
        }
        if (valueConf.icon) cfg.discovery_payload.icon = valueConf.icon
      }
      break
    case 'color':
      cfg = Object.assign({}, hassCfg.light_rgb)
      cfg.discovery_payload.rgb_state_topic = this.mqtt.getTopic(topic)
      cfg.discovery_payload.rgb_command_topic = cfg.discovery_payload.rgb_state_topic + '/set'
      break
    case 'battery':
      cfg = Object.assign({}, hassCfg.sensor_battery)
      break
    case 'time':
      cfg = Object.assign({}, hassCfg.sensor_generic)
      cfg.object_id = 'timestamp'
      cfg.discovery_payload.device_class = 'timestamp'
      break
    case 'energy_production':
      cfg = Object.assign({}, hassCfg.sensor_power)
      break
    default: return
  }

  payload = cfg.discovery_payload

  if (!payload.hasOwnProperty('state_topic') || payload.state_topic) payload.state_topic = this.mqtt.getTopic(topic)

  if (payload.command_topic) payload.command_topic = this.mqtt.getTopic(topic, true)

  // Set availability topic using node status topic
  // payload.availability_topic = this.mqtt.getTopic(this.nodeTopic(node)) + '/status/hass'
  // payload.payload_available = true
  // payload.payload_not_available = false

  if (['binary_sensor', 'sensor', 'lock', 'climate', 'fan'].includes(cfg.type)) {
    payload.json_attributes_topic = payload.state_topic
  }

  // Set device information using node info
  payload.device = deviceInfo(node, nodeName)

  // multi instance devices would have same object_id
  if (valueId.instance > 1) cfg.object_id += '_' + valueId.instance

  // Set a friendly name for this component
  payload.name = `${nodeName}_${cfg.object_id}`

  // Set a unique id for the component
  payload.unique_id = 'zwave2mqtt_' + nodeName + '_' + valueId.value_id

  const discoveryTopic = getDiscoveryTopic(cfg, nodeName)

  cfg.discoveryTopic = discoveryTopic

  this.discovered[valueId.value_id] = cfg
  node.hassDevices[cfg.type + '_' + cfg.object_id] = cfg

  this.publishDiscovery(cfg)
}

module.exports = Gateway
