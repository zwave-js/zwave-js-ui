/* eslint-disable camelcase */
'use strict'

// eslint-disable-next-line one-var
const reqlib = require('app-root-path').require
const { Driver, NodeStatus, InterviewStage } = require('zwave-js')
const utils = reqlib('/lib/utils.js')
const EventEmitter = require('events')
const jsonStore = reqlib('/lib/jsonStore.js')
const store = reqlib('config/store.js')
const storeDir = utils.joinPath(true, reqlib('config/app.js').storeDir)
const debug = reqlib('/lib/debug')('Zwave')
const inherits = require('util').inherits

debug.color = 4

const ZWAVE_STATUS = {
  connected: 'connected',
  driverReady: 'driver ready',
  scanDone: 'scan done',
  driverFailed: 'driver failed',
  closed: 'closed'
}

const socketEvents = {
  init: 'INIT', // automatically sent when a new client connects to the socket
  controller: 'CONTROLLER_CMD', // controller status updates
  connected: 'CONNECTED', // socket status
  nodeRemoved: 'NODE_REMOVED',
  nodeUpdated: 'NODE_UPDATED',
  valueUpdated: 'VALUE_UPDATED',
  api: 'API_RETURN', // api results
  debug: 'DEBUG'
}

/**
 * The constructor
 */
function ZwaveClient (config, socket) {
  if (!(this instanceof ZwaveClient)) {
    return new ZwaveClient(config)
  }
  EventEmitter.call(this)
  init.call(this, config, socket)
}

inherits(ZwaveClient, EventEmitter)

function init (cfg, socket) {
  this.cfg = cfg
  this.socket = socket

  this.closed = false
  this.driverReady = false
  this.scenes = jsonStore.get(store.scenes)

  cfg.networkKey = cfg.networkKey || process.env.OZW_NETWORK_KEY

  if (cfg.networkKey && cfg.networkKey.length === 32) {
    cfg.networkKey = Buffer.from(cfg.networkKey, 'hex')
  } else {
    cfg.networkKey = undefined
  }

  // https://github.com/zwave-js/node-zwave-js/blob/master/packages/core/src/log/shared.ts#L13
  // https://github.com/winstonjs/triple-beam/blob/master/config/npm.js#L14-L15
  process.env.LOGLEVEL = process.env.LOGLEVEL || cfg.logLevel

  if (process.env.LOGLEVEL || cfg.logToFile) { process.env.LOGTOFILE = 'true' }

  this.nodes = []
  this.storeNodes = {}
  this.devices = {}
  this.ozwConfig = {}
  this.healTimeout = null

  this.status = ZWAVE_STATUS.closed
}

// ---------- DRIVER EVENTS -------------------------------------

function driverReady () {
  /*
    Now the controller interview is complete. This means we know which nodes
    are included in the network, but they might not be ready yet.
    The node interview will continue in the background.
  */

  // driver ready
  this.status = ZWAVE_STATUS.driverReady
  this.driverReady = true

  debug('Zwave driver is ready')

  updateControllerStatus.call(this, 'Driver ready')

  this.driver.controller
    .on('inclusion started', onInclusionStarted.bind(this))
    .on('exclusion started', onExclusionStarted.bind(this))
    .on('inclusion stopped', onInclusionStopped.bind(this))
    .on('exclusion stopped', onExclusionStopped.bind(this))
    .on('inclusion failed', onInclusionFailed.bind(this))
    .on('exclusion failed', onExclusionFailed.bind(this))
    .on('node added', onNodeAdded.bind(this))
    .on('node removed', onNodeRemoved.bind(this))
    .on(
      'heal network progress',
      onHealNetworkProgress.bind(this)
    )
    .on('heal network done', onHealNetworkDone.bind(this))

  // eslint-disable-next-line no-unused-vars
  for (const [nodeId, node] of this.driver.controller.nodes) {
    // Reset the node status
    bindNodeEvents.call(this, node)

    // Make sure we didn't miss the ready event
    if (node.ready) onNodeReady.call(this, node)
  }

  this.ozwConfig.homeid = this.driver.controller.homeId
  var homeHex = '0x' + this.ozwConfig.homeid.toString(16)
  this.ozwConfig.name = homeHex
  this.ozwConfig.controllerId = this.driver.controller.ownNodeId

  this.error = false

  this.storeNodes = jsonStore.get(store.nodes)
  debug('Scanning network with homeid:', homeHex)
}

function driverError (error) {
  this.error = 'Driver: ' + error.message
  this.status = ZWAVE_STATUS.driverFailed
  updateControllerStatus.call(this, this.error)
}

function scanComplete () {
  this.scanComplete = true

  updateControllerStatus.call(this, 'Scan completed')

  // all nodes are ready
  this.status = ZWAVE_STATUS.scanDone

  var nodes = this.nodes.filter(n => !n.failed)
  debug('Network scan complete. Found:', nodes.length, 'nodes')
}

// ---------- CONTROLLER EVENTS -------------------------------

function updateControllerStatus (status) {
  debug(status)
  this.cntStatus = status
  this.emitEvent(socketEvents.controller, status)
}

function onInclusionStarted (secure) {
  var message = `${secure ? 'Secure' : 'Non-secure'} inclusion started`
  updateControllerStatus.call(this, message)
}

function onExclusionStarted () {
  var message = 'Exclusion started'
  updateControllerStatus.call(this, message)
}

function onInclusionStopped () {
  var message = 'Inclusion stopped'
  updateControllerStatus.call(this, message)
}

function onExclusionStopped () {
  var message = 'Exclusion stopped'
  updateControllerStatus.call(this, message)
}

function onInclusionFailed () {
  var message = 'Inclusion failed'
  updateControllerStatus.call(this, message)
}

function onExclusionFailed () {
  var message = 'Exclusion failed'
  updateControllerStatus.call(this, message)
}

function onNodeAdded (zwaveNode) {
  debug(`Node ${zwaveNode.id}: added`)
}

function onNodeRemoved (zwaveNode) {
  debug(`Node ${zwaveNode.id}: removed`)
  zwaveNode.removeAllListeners()

  removeNode(zwaveNode.id)
}

function onHealNetworkProgress (progress) {
  const toHeal = [...progress.values()]
  const healedNodes = toHeal.filter((v) => v !== 'pending')
  var message
  // If this is the final progress report, skip it, so the frontend gets the "done" message
  if (healedNodes.length === toHeal.length) {
    message = `Healing process COMPLETED. Healed ${toHeal.length} nodes`
  } else {
    message = `Healing process IN PROGRESS. Healed ${healedNodes.length} nodes`
  }

  updateControllerStatus.call(this, message)
}

function onHealNetworkDone (result) {
  var message = `Healing process COMPLETED. Healed ${result.length} nodes`
  updateControllerStatus.call(this, message)
}

// ---------- NODE EVENTS -------------------------------------

// generic node status update
function onNodeStatus (zwaveNode) {
  var node = this.nodes[zwaveNode.id]

  if (node) {
    // https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/node/Types.ts#L127
    node.status = NodeStatus[zwaveNode.status]
    node.interviewStage = InterviewStage[zwaveNode.interviewStage]
    this.emit('nodeStatus', node)
  }
}

function onNodeReady (zwaveNode) {
  var node = this.nodes[zwaveNode.id]

  // node ready event has been already tiggered by this node
  if (!node || node.ready) return

  node.ready = true
  onNodeStatus.call(this, zwaveNode)

  initNode.call(this, zwaveNode)

  var values = zwaveNode.getDefinedValueIDs()

  for (const zwaveValue of values) {
    addValue.call(this, zwaveNode, zwaveValue)
  }

  node.lastActive = Date.now()

  // add it to know devices types (if not already present)
  if (!this.devices[node.deviceId]) {
    this.devices[node.deviceId] = {
      name: `[${node.deviceId}] ${node.product} (${node.manufacturer})`,
      values: JSON.parse(JSON.stringify(node.values))
    }

    const deviceValues = this.devices[node.deviceId].values

    // remove node specific info from values
    for (var id in deviceValues) {
      delete deviceValues[id].nodeId
      delete deviceValues[id].hassDevices
    }
  }

  this.emit('nodeStatus', node)

  debug(
    'Node %d ready: %s - %s (%s)',
    node.id,
    node.manufacturer,
    node.productLabel,
    node.productDescription || 'Unknown'
  )
}

function onNodeInterviewCompleted (zwaveNode) {
  var node = this.nodes[zwaveNode.id]
  node.interviewCompleted = true
  node.neighbors = zwaveNode.neighbors
  debug(
    `Node ${zwaveNode.id}: interview completed, all values are updated`
  )

  onNodeStatus.call(this, zwaveNode)
}

function onNodeWakeUp (zwaveNode, oldStatus) {
  debug(
    `Node ${zwaveNode.id} is ${
      oldStatus === NodeStatus.Unknown ? '' : 'now '
    }awake`
  )

  onNodeStatus.call(this, zwaveNode)
}

function onNodeSleep (
  zwaveNode,
  oldStatus
) {
  debug(
    `Node ${zwaveNode.id} is ${
      oldStatus === NodeStatus.Unknown ? '' : 'now '
    }asleep`
  )
  onNodeStatus.call(this, zwaveNode)
}

function onNodeAlive (
  zwaveNode,
  oldStatus
) {
  onNodeStatus.call(this, zwaveNode)
  if (oldStatus === NodeStatus.Dead) {
    debug(`Node ${zwaveNode.id}: has returned from the dead`)
  } else {
    debug(`Node ${zwaveNode.id} is alive`)
  }
}

function onNodeDead (
  zwaveNode,
  oldStatus
) {
  onNodeStatus.call(this, zwaveNode)
  debug(
    `Node ${zwaveNode.id} is ${
      oldStatus === NodeStatus.Unknown ? '' : 'now '
    }dead`
  )
}

// function onNodeValueAdded (
//   zwaveNode,
//   args
// ) {
//   debug(
//     `Node ${zwaveNode.id}: value added: ${getValueID(args)} => ${String(
//       args.newValue
//     )}`
//   )
// }

function onNodeValueUpdated (
  zwaveNode,
  args
) {
  updateValue.call(this, zwaveNode, args)
  debug(
    `Node ${zwaveNode.id}: value updated: ${getValueID(args)} ${args.prevValue} => ${String(
      args.newValue
    )}`
  )
}

function onNodeValueRemoved (
  zwaveNode,
  args
) {
  removeValue.call(this, zwaveNode, args)
  debug(`Node ${zwaveNode.id}: value removed: ${args}`)
}

function onNodeMetadataUpdated (
  zwaveNode,
  args
) {
  updateValueMetadata.call(this, zwaveNode, args, args.metadata)
  debug(`Node ${zwaveNode.id}: metadata updated: ${getValueID(args)}`)
}

function onNodeFirmwareUpdateProgress (
  zwaveNode,
  sentFragments,
  totalFragments
) {
  debug(`Node ${zwaveNode.id} firmware update IN PROGRESS: ${sentFragments}/${totalFragments}`)
}

// https://github.com/zwave-js/node-zwave-js/blob/cb35157da5e95f970447a67cbb2792e364b9d1e1/packages/zwave-js/src/lib/commandclass/FirmwareUpdateMetaDataCC.ts#L59
function onNodeFirmwareUpdateFinished (
  zwaveNode,
  status,
  waitTime
) {
  debug(`Node ${zwaveNode.id} firmware update FINISHED: Status ${status}, Time: ${waitTime}`)
}

// ------- NODE METHODS -------------

function bindNodeEvents (node) {
  // add a node to our nodes array
  addNode.call(this, node)

  // https://zwave-js.github.io/node-zwave-js/#/api/node?id=zwavenode-events
  node.on('ready', onNodeReady.bind(this))
    .on('interview completed', onNodeInterviewCompleted.bind(this))
    .on('wake up', onNodeWakeUp.bind(this))
    .on('sleep', onNodeSleep.bind(this))
    .on('alive', onNodeAlive.bind(this))
    .on('dead', onNodeDead.bind(this))
  // .on('value added', onNodeValueAdded.bind(this))
    .on('value updated', onNodeValueUpdated.bind(this))
    .on('value removed', onNodeValueRemoved.bind(this))
    .on('metadata updated', onNodeMetadataUpdated.bind(this))
    .on(
      'firmware update progress',
      onNodeFirmwareUpdateProgress.bind(this)
    )
    .on(
      'firmware update finished',
      onNodeFirmwareUpdateFinished.bind(this)
    )
}

function removeNode (nodeid) {
  // don't use splice here, nodeid equals to the index in the array
  var node = this.nodes[nodeid]
  if (node) {
    this.nodes[nodeid] = null
  }
  debug('Node removed', nodeid)

  this.emit('nodeRemoved', node)

  this.addEmptyNodes()
  this.emitEvent(socketEvents.nodeRemoved, this.nodes[nodeid])
}

// Triggered when a node is added but no informations are received yet
function addNode (zwaveNode) {
  var nodeId = zwaveNode.id

  this.nodes[nodeId] = {
    id: nodeId,
    deviceId: '',
    manufacturer: '',
    manufacturerId: '',
    productType: '',
    productId: '',
    name: this.storeNodes[nodeId] ? this.storeNodes[nodeId].name : '',
    loc: this.storeNodes[nodeId] ? this.storeNodes[nodeId].loc : '',
    values: {},
    groups: [],
    neighbors: [],
    ready: false,
    available: false,
    hassDevices: {},
    failed: false,
    lastActive: null,
    interviewCompleted: false,
    firmwareVersion: '',
    isBeaming: false,
    isSecure: false,
    keepAwake: false,
    maxBaudRate: null,
    isRouting: null,
    isFrequentListening: false,
    isListening: false
  }

  onNodeStatus.call(this, zwaveNode)

  this.addEmptyNodes()
  debug('Node added', nodeId)
}

function initNode (zwaveNode) {
  var nodeId = zwaveNode.id

  var node = this.nodes[nodeId]

  // https://zwave-js.github.io/node-zwave-js/#/api/node?id=zwavenode-properties
  node.manufacturerId = zwaveNode.manufacturerId
  node.productId = zwaveNode.productId
  node.productLabel = zwaveNode.deviceConfig.label
  node.productDescription = zwaveNode.deviceConfig.description
  node.productType = zwaveNode.productType
  node.manufacturerId = zwaveNode.manufacturerId
  node.manufacturer = zwaveNode.deviceConfig.manufacturer
  node.firmwareVersion = zwaveNode.firmwareVersion
  node.zwaveVersion = zwaveNode.version
  node.isSecure = zwaveNode.isSecure
  node.isBeaming = zwaveNode.isBeaming
  node.isListening = zwaveNode.isListening
  node.isFrequentListening = zwaveNode.isFrequentListening
  node.isRouting = zwaveNode.isRouting
  node.keepAwake = zwaveNode.keepAwake
  node.deviceClass = {
    basic: zwaveNode.deviceClass.basic.key,
    generic: zwaveNode.deviceClass.generic.key,
    specific: zwaveNode.deviceClass.specific.key
  }

  node.neighbors = zwaveNode.neighbors

  const storedNode = this.storeNodes[nodeId]

  if (storedNode) {
    node.loc = storedNode.loc || ''
    node.name = storedNode.name || ''

    if (storedNode.hassDevices) {
      node.hassDevices = copy(storedNode.hassDevices)
    }
  } else {
    this.storeNodes[nodeId] = {}
  }

  node.available = true

  var deviceID = getDeviceID(node)
  node.deviceId = deviceID

  this.getGroups(zwaveNode.id)
}

function updateValueMetadata (zwaveNode, zwaveValue, zwaveValueMeta) {
  var valueId = {
    id: getValueID(zwaveValue, zwaveNode),
    nodeId: zwaveNode.id,
    commandClass: zwaveValue.commandClass,
    commandClassName: zwaveValue.commandClassName,
    endpoint: zwaveValue.endpoint,
    property: zwaveValue.property,
    propertyName: zwaveValue.propertyName,
    propertyKey: zwaveValue.propertyKey,
    type: zwaveValueMeta.type, // https://github.com/zwave-js/node-zwave-js/blob/cb35157da5e95f970447a67cbb2792e364b9d1e1/packages/core/src/values/Metadata.ts#L28
    readable: zwaveValueMeta.readable,
    writeable: zwaveValueMeta.writeable,
    description: zwaveValueMeta.description,
    label: zwaveValueMeta.label,
    genre: zwaveValue.commandClass === 112 ? 'config' : (zwaveValue.commandClass < 112 ? 'user' : 'system'),
    default: zwaveValueMeta.default
  }

  // Value types: https://github.com/zwave-js/node-zwave-js/blob/cb35157da5e95f970447a67cbb2792e364b9d1e1/packages/core/src/values/Metadata.ts#L28
  if (zwaveValueMeta.type === 'number') {
    valueId.min = zwaveValueMeta.min
    valueId.max = zwaveValueMeta.max
    valueId.step = zwaveValueMeta.steps
    valueId.unit = zwaveValueMeta.unit
  } else if (zwaveValueMeta.type === 'string') {
    valueId.minLength = zwaveValueMeta.minLength
    valueId.maxLength = zwaveValueMeta.maxLength
  }

  if (zwaveValueMeta.states) {
    valueId.list = true
    valueId.states = []
    for (const k in zwaveValueMeta.states) {
      valueId.states.push({
        text: zwaveValueMeta.states[k],
        value: parseInt(k)
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
 * @param { ZWaveNode } zwaveNode
 * @param { ValueAddedArgs } valueAddedArgs https://github.com/zwave-js/node-zwave-js/blob/cb35157da5e95f970447a67cbb2792e364b9d1e1/packages/core/src/values/ValueDB.ts#L8
 */
function addValue (zwaveNode, zwaveValue) {
  var node = this.nodes[zwaveNode.id]

  if (!node) {
    debug('ValueAdded: no such node: ' + zwaveNode.id, 'error')
  } else {
    var zwaveValueMeta = zwaveNode.getValueMetadata(zwaveValue)

    var valueId = updateValueMetadata.call(this, zwaveNode, zwaveValue, zwaveValueMeta)
    valueId.value = zwaveNode.getValue(zwaveValue)

    debug(`Node ${zwaveNode.id}: value added ${valueId.id} => ${valueId.value}`)

    node.values[getValueID(valueId)] = valueId

    this.emit('valueChanged', valueId, node)
  }
}

// Triggered when a node is ready and a value changes
function updateValue (zwaveNode, args) {
  var node = this.nodes[zwaveNode.id]

  if (!node) {
    debug('valueChanged: no such node: ' + zwaveNode.id, 'error')
  } else {
    var valueId = node.values[getValueID(args)]

    if (valueId) {
      valueId.value = args.newValue

      this.emit('valueChanged', valueId, node, args.prevValue !== args.newValue)
    }
    node.lastActive = Date.now()
  }
}

function removeValue (zwaveNode, args) {
  var node = this.nodes[zwaveNode.id]
  var idString = getValueID(args)

  if (node.values[idString]) {
    delete node.values[idString]
    debug('ValueRemoved: %s from node %d', idString, zwaveNode.id)
  } else {
    debug('ValueRemoved: no such node: ' + zwaveNode.id, 'error')
  }
}

// ------- Utils ------------------------

/**
 * Get the device id of a specific node
 *
 * @param {Object} node Internal node object
 * @returns A string in the format `<manufacturerId>-<productId>-<producttype>` that unique identifhy a zwave device
 */
function getDeviceID (node) {
  if (!node) return ''

  return `${parseInt(node.manufacturerId)}-${parseInt(
    node.productId
  )}-${parseInt(node.productType)}`
}

/**
 * Get a valueId from a valueId object
 *
 * @param {Object} v Zwave valueId object
 * @param {Boolean} nodeId Add node identifier
 * @returns The value id unique identifier
 */
function getValueID (v, nodeId) {
  return `${nodeId >= 0 ? nodeId + '-' : ''}${v.commandClass}-${v.endpoint || 0}-${v.property}${v.propertyKey !== undefined ? '-' + v.propertyKey : ''}`
}

/**
 * Function wrapping code used for writing queue.
 * fn - reference to function.
 * context - what you want "this" to be.
 * params - array of parameters to pass to function.
 */
function wrapFunction (fn, context, params) {
  return function () {
    fn.apply(context, params)
  }
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

// -------- Public methods --------------

/**
 * Used to get unique homeHex of driver
 */
Object.defineProperty(ZwaveClient.prototype, 'homeHex', {
  get: function () {
    return this.ozwConfig.name
  },
  enumerable: true
})

Object.defineProperty(ZwaveClient.prototype, 'socketEvents', {
  get: function () {
    return socketEvents
  },
  enumerable: true
})

/**
 * Used to schedule next network heal at hours: cfg.healHours
 */
ZwaveClient.prototype.scheduleHeal = function () {
  if (!this.cfg.healNetwork) {
    return
  }

  var now = new Date()
  var start
  var hour = this.cfg.healHour

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

  var wait = start.getTime() - now.getTime()

  if (wait < 0) {
    this.scheduleHeal()
  } else {
    this.healTimeout = setTimeout(this.heal.bind(this), wait)
  }
}

/**
 * Returns the driver ZWaveNode object
 *
 */
ZwaveClient.prototype.getNode = function (nodeId) {
  return this.driver.controller.nodes.get(nodeId)
}

/**
 * Returns the driver ZWaveNode ValueId object or null
 *
 */
ZwaveClient.prototype.getZwaveValue = function (idString) {
  if (!idString || typeof idString !== 'string') {
    return null
  }

  var parts = idString.split('-')

  if (parts.length < 3) {
    return null
  }

  return {
    commandClass: parseInt(parts[0]),
    endpoint: parseInt(parts[1]),
    property: parts[2],
    propertyKey: parts[3]
  }
}

/**
 * Calls client healNetwork function and schedule next heal
 *
 */
ZwaveClient.prototype.heal = function () {
  if (this.healTimeout) {
    clearTimeout(this.healTimeout)
    this.healTimeout = null
  }

  try {
    this.client.healNetwork()
    debug('Network auto heal started')
  } catch (error) {
    debug('Error while doing scheduled network heal', error.message)
  }

  // schedule next
  this.scheduleHeal()
}

/**
 * Used to Update an hass device of a specific node
 *
 * @param {Object} hassDevice The Hass device
 * @param {Integer} nodeId The nodeid
 * @param {Boolean} deleteDevice True to remove the hass device from node hass devices
 */
ZwaveClient.prototype.updateDevice = function (
  hassDevice,
  nodeId,
  deleteDevice
) {
  var node = nodeId >= 0 ? this.nodes[nodeId] : null

  // check for existing node and node hassdevice with given id
  if (node && hassDevice.id && node.hassDevices[hassDevice.id]) {
    if (deleteDevice) {
      delete node.hassDevices[hassDevice.id]
    } else {
      var id = hassDevice.id
      delete hassDevice.id
      node.hassDevices[id] = hassDevice
    }

    this.emitEvent(socketEvents.nodeUpdated, node)
  }
}

/**
 * Used to Add a new hass device to a specific node
 *
 * @param {Object} hassDevice The Hass device
 * @param {Integer} nodeId The nodeid
 */
ZwaveClient.prototype.addDevice = function (hassDevice, nodeId) {
  var node = nodeId >= 0 ? this.nodes[nodeId] : null

  // check for existing node and node hassdevice with given id
  if (node && hassDevice.id) {
    delete hassDevice.id
    const id = hassDevice.type + '_' + hassDevice.object_id
    hassDevice.persistent = false
    node.hassDevices[id] = hassDevice

    this.emitEvent(socketEvents.nodeUpdated, node)
  }
}

/**
 * Used to update hass devices list of a specific node and store them in `nodes.json`
 *
 * @param {Object} devices List of devices `"<deviceId>" : <deviceObject>`
 * @param {*} nodeId The node to send this devices
 */
ZwaveClient.prototype.storeDevices = async function (devices, nodeId, remove) {
  var node = this.nodes[nodeId]

  if (node) {
    for (const id in devices) {
      devices[id].persistent = !remove
    }

    if (remove) {
      delete this.storeNodes[nodeId].hassDevices
    } else {
      this.storeNodes[nodeId].hassDevices = devices
    }

    node.hassDevices = copy(devices)
    await jsonStore.put(store.nodes, this.storeNodes)

    this.emitEvent(socketEvents.nodeUpdated, node)
  }
}

/**
 * Method used to close client connection, use this before destroy
 */
ZwaveClient.prototype.close = async function () {
  this.status = ZWAVE_STATUS.closed

  if (this.commandsTimeout) {
    clearTimeout(this.commandsTimeout)
    this.commandsTimeout = null
  }

  if (this.reconnectTimeout) {
    clearTimeout(this.reconnectTimeout)
    this.reconnectTimeout = null
  }

  this.closed = true

  if (this.healTimeout) {
    clearTimeout(this.healTimeout)
    this.healTimeout = null
  }

  if (this.driver) {
    this.driverReady = false
    this.removeAllListeners()
    await this.driver.destroy()
  }
}

ZwaveClient.prototype.getStatus = function () {
  var status = {}

  status.driverReady = this.driverReady
  status.config = this.cfg

  return status
}

/**
 * Used to replace `null` nodes in nodes Array
 *
 */
ZwaveClient.prototype.addEmptyNodes = function () {
  for (var i = 0; i < this.nodes.length; i++) {
    if (!this.nodes[i]) {
      this.nodes[i] = {
        id: i,
        status: 'Removed',
        name: this.storeNodes[i] ? this.storeNodes[i].name : '',
        loc: this.storeNodes[i] ? this.storeNodes[i].loc : '',
        failed: true,
        values: {}
      }
    }
  }
}
/**
 * Popolate node `groups`
 *
 * @param {Integer} nodeId Zwave node id
 */
ZwaveClient.prototype.getGroups = async function (nodeId) {
  var zwaveNode = this.getNode(nodeId)
  if (zwaveNode) {
    var groups = []
    try {
      groups = await this.driver.controller.getAssociationGroups(nodeId)
    } catch (error) {
      debug(`Node ${nodeId} doesn't support groups associations`)
      // node doesn't support groups associations
    }
    for (const [groupIndex, group] of groups) {
      // https://zwave-js.github.io/node-zwave-js/#/api/controller?id=associationgroup-interface
      this.nodes[nodeId].groups.push({
        text: group.label,
        value: groupIndex,
        maxNodes: group.maxNodes,
        isLifeline: group.isLifeline,
        multiChannel: group.multiChannel
      })
    }
  }

  onNodeStatus.call(this, zwaveNode)
}

/**
 * Get current associations of a specific group
 *
 * @param {Integer} nodeId Zwave node id
 * @param {Integer} groupId Zwave node group Id
 */
ZwaveClient.prototype.getAssociations = async function (nodeId, groupId) {
  var zwaveNode = this.getNode(nodeId)
  var associations = []

  if (zwaveNode) {
    try {
      // https://zwave-js.github.io/node-zwave-js/#/api/controller?id=association-interface
      // the result is a map where the key is the group number and the value is the array of associations {nodeId, endpoint?}
      associations = (await this.driver.controller.getAssociations(nodeId)).get(groupId)
    } catch (error) {
      debug(`Node ${nodeId} doesn't support groups associations`)
      // node doesn't support groups associations
    }
  } else {
    debug(`Node ${nodeId} not found when calling 'getAssociations'`)
  }

  return associations
}

/**
 * Add a node to an association group
 *
 * @param {Integer} nodeId Zwave node id
 * @param { Integer} groupId Zwave node group Id
 * @param {Association} associations Array of associations
 */
ZwaveClient.prototype.addAssociations = async function (nodeId, groupId, associations) {
  var zwaveNode = this.getNode(nodeId)
  associations = associations.map(cleanAssociation)

  if (zwaveNode) {
    try {
      for (const a of associations) {
        if (this.driver.controller.isAssociationAllowed(nodeId, groupId, a)) {
          debug(`Assocaitions: Adding Node ${a.nodeId} to Group ${groupId} of  Node ${nodeId}`)
          await this.driver.controller.addAssociations(nodeId, groupId, [a])
        } else {
          debug(`Associations: Unable to add Node ${a.nodeId} to Group ${groupId} of Node ${nodeId}`)
        }
      }
    } catch (error) {
      debug(`Error while adding associations to ${nodeId}: ${error.message}`)
    }
  } else {
    debug(`Node ${nodeId} not found when calling 'addAssociations'`)
  }
}

/**
 * Remove a node from an association group
 *
 * @param {Integer} nodeId Zwave node id
 * @param { Integer} groupId Zwave node group Id
 * @param {Association} associations Array of associations
 */
ZwaveClient.prototype.removeAssociations = async function (nodeId, groupId, associations) {
  var zwaveNode = this.getNode(nodeId)

  if (zwaveNode) {
    try {
      debug(`Assocaitions: Removing associations from Node ${nodeId} Group ${groupId}: ${associations}`)
      associations = associations.map(cleanAssociation)
      await this.driver.controller.removeAssociations(nodeId, groupId, associations)
    } catch (error) {
      debug(`Error while removing associations from ${nodeId}: ${error.message}`)
    }
  } else {
    debug(`Node ${nodeId} not found when calling 'removeAssociations'`)
  }
}

function cleanAssociation (a) {
  if (a.endpoint === 0) {
    delete a.endpoint
  }

  return a
}

/**
 * Remove all associations
 *
 * @param {Integer} nodeId Zwave node id
 */
ZwaveClient.prototype.removeAllAssociations = async function (nodeId) {
  var zwaveNode = this.getNode(nodeId)

  if (zwaveNode) {
    try {
      debug(`Assocaitions: Removing all associations from Node ${nodeId}`)
      await this.driver.controller.removeNodeFromAllAssocations(nodeId)
    } catch (error) {
      debug(`Error while removing all associations from ${nodeId}: ${error.message}`)
    }
  } else {
    debug(`Node ${nodeId} not found when calling 'removeAllAssociations'`)
  }
}

/**
 * Refresh all nodes neighbors
 *
 * @returns The nodes array where `nodeId` is the array index and the value is the array
 * of neighburns of that `nodeId`
 */
ZwaveClient.prototype.refreshNeighbors = function () {
  for (let i = 0; i < this.nodes.length; i++) {
    if (!this.nodes[i].failed) {
      this.nodes[i].neighbors = this.getNode(i).neighbors
    }
  }

  return this.nodes.map(n => n.neighbors)
}

/**
 * Method used to start Zwave connection using configuration `port`
 */
ZwaveClient.prototype.connect = async function () {
  if (!this.driverReady) {
    // init driver here because if connect fails the driver is destroyed
    this.driver = new Driver(this.cfg.port, {
      cacheDir: storeDir,
      networkKey: this.cfg.networkKey
    })
    this.driver.on('error', driverError.bind(this))
    this.driver.once('driver ready', driverReady.bind(this))
    this.driver.on('all nodes ready', scanComplete.bind(this))

    debug('Connecting to', this.cfg.port)

    try {
      await this.driver.start()
      this.status = ZWAVE_STATUS.connected
      this.connected = true
    } catch (error) {
      driverError.call(this, error)
      debug('Retry connection in 3 seconds...')
      this.reconnectTimeout = setTimeout(this.connect.bind(this), 3000)
    }
  } else {
    debug('Driver already connected to', this.cfg.port)
  }
}

/**
 *
 *
 * @param {String} evtName Event name
 * @param {Object} data Event data object
 */
ZwaveClient.prototype.emitEvent = function (evtName, data) {
  if (this.socket) {
    this.socket.emit(evtName, data)
  }
}

// ------------NODES MANAGEMENT-----------------------------------

/**
 * Updates node `name` property and stores updated config in `nodes.json`
 *
 * @param {Integer} nodeid Zwave node id
 * @param {String} name The node name
 * @returns True if the node name is updated correctly
 * @throws Invalid node id if the node id provided doesn't exists
 */
ZwaveClient.prototype._setNodeName = async function (nodeid, name) {
  if (!this.storeNodes[nodeid]) this.storeNodes[nodeid] = {}

  if (this.nodes[nodeid]) this.nodes[nodeid].name = name
  else throw Error('Invalid Node ID')

  this.storeNodes[nodeid].name = name

  await jsonStore.put(store.nodes, this.storeNodes)

  this.emit('nodeStatus', this.nodes[nodeid])

  return true
}

/**
 * Updates node `loc` property and stores updated config in `nodes.json`
 *
 * @param {Integer} nodeid Zwave node id
 * @param {String} loc The node name
 * @returns True if the node location is updated correctly
 * @throws Invalid node id if the node id provided doesn't exists
 */
ZwaveClient.prototype._setNodeLocation = async function (nodeid, loc) {
  if (!this.storeNodes[nodeid]) this.storeNodes[nodeid] = {}

  if (this.nodes[nodeid]) this.nodes[nodeid].loc = loc
  else throw Error('Invalid Node ID')

  this.storeNodes[nodeid].loc = loc

  await jsonStore.put(store.nodes, this.storeNodes)

  this.emit('nodeStatus', this.nodes[nodeid])

  return true
}

// ------------SCENES MANAGEMENT-----------------------------------

/**
 * Creates a new scene with a specific `label` and stores it in `scenes.json`
 *
 * @param {String} label Scene label
 * @returns True if the scene is created without error
 */
ZwaveClient.prototype._createScene = async function (label) {
  var id =
    this.scenes.length > 0 ? this.scenes[this.scenes.length - 1].sceneid + 1 : 1
  this.scenes.push({
    sceneid: id,
    label: label,
    values: []
  })

  await jsonStore.put(store.scenes, this.scenes)

  return true
}

/**
 * Delete a scene with a specific `sceneid` and updates `scenes.json`
 *
 * @param {Integer} sceneid Scene id
 * @returns True if the scene is deleted without error
 */
ZwaveClient.prototype._removeScene = async function (sceneid) {
  var index = this.scenes.findIndex(s => s.sceneid === sceneid)

  if (index < 0) throw Error('No scene found with given sceneid')

  this.scenes.splice(index, 1)

  await jsonStore.put(store.scenes, this.scenes)

  return true
}

/**
 * Imports scenes Array in `scenes.json`
 *
 * @param {Array} scenes The scenes Array
 * @returns The scenes Array
 */
ZwaveClient.prototype._setScenes = async function (scenes) {
  // TODO: add scenes validation
  this.scenes = scenes
  await jsonStore.put(store.scenes, this.scenes)

  return scenes
}

/**
 * Get all scenes
 *
 * @returns The scenes Array
 */
ZwaveClient.prototype._getScenes = function () {
  return this.scenes
}

/**
 * Return all values of the scene with given `sceneid`
 *
 * @param {Integer} sceneid The scene id
 * @returns The scene values Array
 */
ZwaveClient.prototype._sceneGetValues = function (sceneid) {
  var scene = this.scenes.find(s => s.sceneid === sceneid)
  if (!scene) throw Error('No scene found with given sceneid')
  return scene.values
}

/**
 * Add a value to a scene
 *
 * @param {Integer} sceneid The scene id
 * @param {Array} args Array or argument. Can be `[{valueid}, value, ?timeout]`
 * @returns True if value is added without any error
 * @throws Error if args valueid isn't valid
 */
ZwaveClient.prototype._addSceneValue = async function (sceneid, valueId, value, timeout) {
  var scene = this.scenes.find(s => s.sceneid === sceneid)

  if (!scene) throw Error('No scene found with given sceneid')

  if (this.nodes.length < valueId.nodeId || !this.nodes[valueId.nodeId]) {
    throw Error('Node not found')
  } else {
    // get the valueId object with all properties
    valueId = this.nodes[valueId.nodeId].values[getValueID(valueId)]

    // check if it is an existing valueid
    if (!valueId) throw Error('No value found with given valueId')
    else {
      // if this valueid is already in owr scene edit it else create new one
      var index = scene.values.findIndex(s => s.value_id === valueId.value_id)

      valueId = index < 0 ? valueId : scene.values[index]
      valueId.value = value
      valueId.timeout = timeout || 0

      if (index < 0) {
        scene.values.push(valueId)
      }
    }
  }

  await jsonStore.put(store.scenes, this.scenes)

  return true
}

/**
 * Remove a value from scene
 *
 * @param {Integer} sceneid The scene id
 * @param {Array} args Array or argument
 * @throws Error if args valueid isn't valid
 */
ZwaveClient.prototype._removeSceneValue = async function (sceneid, valueId) {
  var scene = this.scenes.find(s => s.sceneid === sceneid)

  if (!scene) throw Error('No scene found with given sceneid')

  // here I don't fetch the valueId obj from nodes because
  // it's possible that the scene contains
  // a value of a node that doesn't exist anymore
  var id = valueId.nodeId + '-' + getValueID(valueId)

  var index = scene.values.findIndex(s => s.id === id)

  if (index < 0) throw Error('No valueid match found in given scene')
  else {
    scene.values.splice(index, 1)
  }

  await jsonStore.put(store.scenes, this.scenes)

  return true
}

/**
 * Activate a scene with given scene id
 *
 * @param {Integer} sceneId The scene Id
 * @returns True if activation is successfull
 */
ZwaveClient.prototype._activateScene = function (sceneId) {
  var values = this._sceneGetValues(sceneId)

  // eslint-disable-next-line no-unmodified-loop-condition
  for (var i = 0; values && i < values.length; i++) {
    var fun = wrapFunction(this.client.setValue, this.client, [
      values[i],
      values[i].value
    ])
    setTimeout(fun, values[i].timeout ? values[i].timeout * 1000 : 0)
  }

  return true
}

ZwaveClient.prototype.getNodes = function () {
  return this.nodes
}

ZwaveClient.prototype.getInfo = function () {
  var info = Object.assign({}, this.ozwConfig)

  info.uptime = process.uptime()
  info.lastUpdate = this.lastUpdate
  info.status = this.status
  info.cntStatus = this.cntStatus

  return info
}

ZwaveClient.prototype.startInclusion = async function (secure) {
  if (this.driver && !this.closed) {
    if (this.commandsTimeout) {
      clearTimeout(this.commandsTimeout)
      this.commandsTimeout = null
    }

    this.commandsTimeout = setTimeout(
      this.stopInclusion.bind(this),
      this.cfg.commandsTimeout * 1000 || 30000
    )
    // by default beginInclusion is secured, pass true to make it not secured
    return this.driver.beginInclusion(!secure)
  }
}

ZwaveClient.prototype.startExclusion = async function () {
  if (this.driver && !this.closed) {
    if (this.commandsTimeout) {
      clearTimeout(this.commandsTimeout)
      this.commandsTimeout = null
    }

    this.commandsTimeout = setTimeout(
      this.stopExclusion.bind(this),
      this.cfg.commandsTimeout * 1000 || 30000
    )

    return this.driver.controller.beginExclusion()
  }
}

ZwaveClient.prototype.stopExclusion = async function () {
  if (this.driver && !this.closed) {
    if (this.commandsTimeout) {
      clearTimeout(this.commandsTimeout)
      this.commandsTimeout = null
    }
    return this.driver.controller.stopExclusion()
  }
}

ZwaveClient.prototype.stopInclusion = async function () {
  if (this.driver && !this.closed) {
    if (this.commandsTimeout) {
      clearTimeout(this.commandsTimeout)
      this.commandsTimeout = null
    }
    return this.driver.controller.stopInclusion()
  }
}

ZwaveClient.prototype.stopInclusion = async function () {
  if (this.driver && !this.closed) {
    if (this.commandsTimeout) {
      clearTimeout(this.commandsTimeout)
      this.commandsTimeout = null
    }
    return this.driver.controller.stopInclusion()
  }
}

ZwaveClient.prototype.healNode = async function (nodeId) {
  if (this.driver && !this.closed) {
    return this.driver.controller.healNode(nodeId)
  }
}

ZwaveClient.prototype.isFailedNode = async function (nodeId) {
  if (this.driver && !this.closed) {
    return this.driver.controller.isFailedNode(nodeId)
  }
}
ZwaveClient.prototype.removeFailedNode = async function (nodeId) {
  if (this.driver && !this.closed) {
    return this.driver.controller.removeFailedNode(nodeId)
  }
}

ZwaveClient.prototype.beginHealingNetwork = async function () {
  if (this.driver && !this.closed) {
    return this.driver.controller.beginHealingNetwork()
  }
}

ZwaveClient.prototype.stopHealingNetwork = async function () {
  if (this.driver && !this.closed) {
    return this.driver.controller.stopHealingNetwork()
  }
}
/**
 * Calls a specific `client` or `ZwaveClient` method based on `apiName`
 * ZwaveClients methods used are the ones that overrides default Zwave methods
 * like nodes name and location and scenes management.
 *
 * @param {String} apiName The api name
 * @param {Array} args Array of arguments to use for the api call
 * @returns An object `{success: <success>, message: <message>, args: <args>, result: <the response>}`,  if success is false the message contains the error
 */
ZwaveClient.prototype.callApi = async function (apiName, ...args) {
  var err, result

  if (this.driverReady) {
    try {
      // Replace failed node works just with failed nodes so update node failed status
      if (apiName === 'replaceFailedNode') {
        var nodeid = args[0]
        if (nodeid && this.nodes[nodeid]) {
          var node = this.nodes[nodeid]
          this.client.assignReturnRoute(nodeid)
          node.failed = this.client.hasNodeFailed(nodeid)
        }
      }

      // ZwaveClient Apis that can be called with MQTT apis
      var allowedApis = [
        '_setNodeName',
        '_setNodeLocation',
        'refreshneighbors',
        'getAssociations',
        'addAssociations',
        'removeAssociations',
        'removeAllAssociations',
        'getNodes',
        'getInfo',
        '_createScene',
        '_removeScene',
        '_setScenes',
        '_getScenes',
        '_sceneGetValues',
        '_addSceneValue',
        '_removeSceneValue',
        '_activateScene',
        'startInclusion',
        'startExclusion',
        'stopInclusion',
        'stopExclusion',
        'healNode',
        'beginHealingNetwork',
        'stopHealingNetwork',
        'isFailedNode',
        'removeFailedNode',
        'writeValue'
      ]

      // Check if I need to call a ZwaveClient function or this.client function
      var useCustom =
        typeof this[apiName] === 'function' && allowedApis.indexOf(apiName) >= 0

      // Send raw data expects a buffer as the fifth argument, which JSON does not support, so we convert an array of bytes into a buffer.
      if (apiName === 'sendRawData') {
        args[4] = Buffer.from(args[4])
      }

      if (useCustom) {
        result = await this[apiName](...args)
        // custom scenes and node/location management
      } else {
        err = 'Unknown API'
      }
    } catch (e) {
      err = e.message
    }
  } else err = 'Zwave client not connected'

  if (err) {
    result = {
      success: false,
      message: err
    }
  } else {
    result = {
      success: true,
      message: 'Success zwave api call',
      result: result
    }
  }

  // update isPolled flag of values
  if (
    (apiName === 'enablePoll' || apiName === 'disablePoll') &&
    args[0] &&
    args[0].nodeId
  ) {
    var nid = args[0].nodeId
    var vid = getValueID(args[0])

    if (this.nodes[nid] && this.nodes[nid][vid]) {
      this.nodes[nid][vid].isPolled = this.driver.controller.isPolled(args[0])
    }
  }

  debug(result.message, apiName, result.result || '')

  result.args = args

  return result
}

/**
 * Set a value of a specific zwave valueId
 *
 * @param {Object} valueId Zwave valueId object
 * @param {Integer|String} value The value to send
 */
ZwaveClient.prototype.writeValue = async function (valueId, value) {
  if (this.driverReady) {
    var result = false
    try {
      result = await this.getNode(valueId.nodeId).setValue(valueId, value)
    } catch (error) {
      debug(
        `Error while writing ${value} on ${valueId.id}: ${error.message}`
      )
    }
    // https://zwave-js.github.io/node-zwave-js/#/api/node?id=setvalue
    if (result === false) {
      debug(`Unable to write ${value} on ${valueId.id}`)
    }
  }
}

module.exports = ZwaveClient
