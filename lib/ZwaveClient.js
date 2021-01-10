/* eslint-disable camelcase */
'use strict'

// eslint-disable-next-line one-var
const reqlib = require('app-root-path').require
const {
  Driver,
  NodeStatus,
  InterviewStage,
  extractFirmware
} = require('zwave-js')
const { CommandClasses } = require('@zwave-js/core')
const utils = reqlib('/lib/utils.js')
const EventEmitter = require('events')
const jsonStore = reqlib('/lib/jsonStore.js')
const { socketEvents } = reqlib('/lib/SocketManager.js')
const store = reqlib('config/store.js')
const storeDir = utils.joinPath(true, reqlib('config/app.js').storeDir)
const logger = require('./logger.js').module('Zwave')
const inherits = require('util').inherits
const loglevels = require('triple-beam').configs.npm.levels

const ZWAVE_STATUS = {
  connected: 'connected',
  driverReady: 'driver ready',
  scanDone: 'scan done',
  driverFailed: 'driver failed',
  closed: 'closed'
}

const eventEmitter = {
  driver: 'driver',
  controller: 'controller',
  node: 'node'
}

const ZWAVEJS_LOG_FILE = utils.joinPath(storeDir, `zwavejs_${process.pid}.log`)

/**
 * The constructor
 */
function ZwaveClient (config, socket) {
  if (!(this instanceof ZwaveClient)) {
    return new ZwaveClient(config)
  }

  EventEmitter.call(this)

  this.cfg = config
  this.socket = socket

  this.closed = false
  this.driverReady = false
  this.scenes = jsonStore.get(store.scenes)

  config.networkKey = config.networkKey || process.env.OZW_NETWORK_KEY

  this.nodes = []
  this.storeNodes = jsonStore.get(store.nodes)
  this.devices = {}
  this.driverInfo = {}
  this.healTimeout = null

  this.status = ZWAVE_STATUS.closed
}

inherits(ZwaveClient, EventEmitter)

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

  logger.info('Zwave driver is ready')

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
    .on('heal network progress', onHealNetworkProgress.bind(this))
  // .on('heal network done', onHealNetworkDone.bind(this))

  // eslint-disable-next-line no-unused-vars
  for (const [nodeId, node] of this.driver.controller.nodes) {
    // setup node events
    bindNodeEvents.call(this, node)

    // Make sure we didn't miss the ready event
    if (node.ready) onNodeReady.call(this, node)
  }

  this.driverInfo.homeid = this.driver.controller.homeId
  const homeHex = '0x' + this.driverInfo.homeid.toString(16)
  this.driverInfo.name = homeHex
  this.driverInfo.controllerId = this.driver.controller.ownNodeId

  this.emit('event', eventEmitter.driver, 'driver ready', this.driverInfo)

  this.error = false

  logger.info(`Scanning network with homeid: ${homeHex}`)
}

function driverError (error) {
  this.error = 'Driver: ' + error.message
  this.status = ZWAVE_STATUS.driverFailed
  updateControllerStatus.call(this, this.error)

  this.emit('event', eventEmitter.driver, 'driver error', error)
}

function scanComplete () {
  this.scanComplete = true

  updateControllerStatus.call(this, 'Scan completed')

  // all nodes are ready
  this.status = ZWAVE_STATUS.scanDone

  const nodes = this.nodes.filter(n => !n.failed)
  logger.info(`Network scan complete. Found: ${nodes.length} nodes`)

  this.emit('scanComplete')

  this.emit('event', eventEmitter.driver, 'all nodes ready')
}

// ---------- CONTROLLER EVENTS -------------------------------

function updateControllerStatus (status) {
  logger.info(`Controller status: ${status}`)
  this.cntStatus = status
  this.sendToSocket(socketEvents.controller, status)
}

function onInclusionStarted (secure) {
  const message = `${secure ? 'Secure' : 'Non-secure'} inclusion started`
  updateControllerStatus.call(this, message)
  this.emit('event', eventEmitter.controller, 'inclusion started', secure)
}

function onExclusionStarted () {
  const message = 'Exclusion started'
  updateControllerStatus.call(this, message)
  this.emit('event', eventEmitter.controller, 'exclusion started')
}

function onInclusionStopped () {
  const message = 'Inclusion stopped'
  updateControllerStatus.call(this, message)
  this.emit('event', eventEmitter.controller, 'inclusion stopped')
}

function onExclusionStopped () {
  const message = 'Exclusion stopped'
  updateControllerStatus.call(this, message)
  this.emit('event', eventEmitter.controller, 'exclusion stopped')
}

function onInclusionFailed () {
  const message = 'Inclusion failed'
  updateControllerStatus.call(this, message)
  this.emit('event', eventEmitter.controller, 'inclusion failed')
}

function onExclusionFailed () {
  const message = 'Exclusion failed'
  updateControllerStatus.call(this, message)
  this.emit('event', eventEmitter.controller, 'exclusion failed')
}

function onNodeAdded (zwaveNode) {
  logger.info(`Node ${zwaveNode.id}: added`)

  if (this.driverReady) {
    bindNodeEvents.call(this, zwaveNode)
  }

  this.emit(
    'event',
    eventEmitter.controller,
    'node added',
    this.nodes[zwaveNode.id]
  )
}

function onNodeRemoved (zwaveNode) {
  logger.info(`Node ${zwaveNode.id}: removed`)
  zwaveNode.removeAllListeners()

  this.emit(
    'event',
    eventEmitter.controller,
    'node removed',
    this.nodes[zwaveNode.id]
  )

  removeNode.call(this, zwaveNode.id)
}

function onHealNetworkProgress (progress) {
  const toHeal = [...progress.values()]
  const healedNodes = toHeal.filter(v => v !== 'pending')
  let message
  // If this is the final progress report, skip it, so the frontend gets the "done" message
  if (healedNodes.length === toHeal.length) {
    message = `Healing process COMPLETED. Healed ${toHeal.length} nodes`
  } else {
    message = `Healing process IN PROGRESS. Healed ${healedNodes.length} nodes`
  }

  this.emit('event', eventEmitter.controller, 'heal network progress', progress)

  updateControllerStatus.call(this, message)
}

// function onHealNetworkDone (result) {
//   var message = `Healing process COMPLETED. Healed ${result.length} nodes`
//   updateControllerStatus.call(this, message)
// }

// ---------- NODE EVENTS -------------------------------------

// generic node status update
function onNodeStatus (zwaveNode) {
  const node = this.nodes[zwaveNode.id]

  if (node) {
    // https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/node/Types.ts#L127
    node.status = NodeStatus[zwaveNode.status]
    node.interviewStage = InterviewStage[zwaveNode.interviewStage]
    this.emit('nodeStatus', node)
  }
}

function onNodeReady (zwaveNode) {
  const node = this.nodes[zwaveNode.id]

  // node ready event has been already tiggered by this node
  if (!node) return

  node.lastActive = Date.now()

  // ignore the init when node is readt
  if (!node.ready) {
    initNode.call(this, zwaveNode)

    const values = zwaveNode.getDefinedValueIDs()

    for (const zwaveValue of values) {
      addValue.call(this, zwaveNode, zwaveValue)
    }

    // set node ready after adding values to prevent discovery
    node.ready = true
  }

  node.lastActive = Date.now()

  onNodeStatus.call(this, zwaveNode)

  this.emit('event', eventEmitter.node, 'node ready', this.nodes[zwaveNode.id])

  logger.info(
    `Node ${node.id} ready: ${node.manufacturer} - ${
      node.productLabel
    } (${node.productDescription || 'Unknown'})`
  )
}

// when this event is triggered all node values and metadata are updated
function onNodeInterviewCompleted (zwaveNode) {
  const node = this.nodes[zwaveNode.id]
  node.interviewCompleted = true
  node.neighbors = zwaveNode.neighbors

  // add it to know devices types (if not already present)
  if (!this.devices[node.deviceId]) {
    this.devices[node.deviceId] = {
      name: `[${node.deviceId}] ${node.productDescription} (${node.manufacturer})`,
      values: JSON.parse(JSON.stringify(node.values))
    }

    const deviceValues = this.devices[node.deviceId].values

    // remove node specific info from values
    for (const id in deviceValues) {
      delete deviceValues[id].nodeId
      delete deviceValues[id].hassDevices
      // remove the node part
      deviceValues[id].id = id
    }
  }

  logger.info(
    `Node ${zwaveNode.id}: interview completed, all values are updated`
  )

  onNodeStatus.call(this, zwaveNode)

  this.emit(
    'event',
    eventEmitter.node,
    'node interview completed',
    this.nodes[zwaveNode.id]
  )
}

function onNodeWakeUp (zwaveNode, oldStatus) {
  logger.info(
    `Node ${zwaveNode.id} is ${
      oldStatus === NodeStatus.Unknown ? '' : 'now '
    }awake`
  )

  onNodeStatus.call(this, zwaveNode)
  this.emit('event', eventEmitter.node, 'node wakeup', this.nodes[zwaveNode.id])
}

function onNodeSleep (zwaveNode, oldStatus) {
  logger.info(
    `Node ${zwaveNode.id} is ${
      oldStatus === NodeStatus.Unknown ? '' : 'now '
    }asleep`
  )
  onNodeStatus.call(this, zwaveNode)
  this.emit('event', eventEmitter.node, 'node sleep', this.nodes[zwaveNode.id])
}

function onNodeAlive (zwaveNode, oldStatus) {
  onNodeStatus.call(this, zwaveNode)
  if (oldStatus === NodeStatus.Dead) {
    logger.info(`Node ${zwaveNode.id}: has returned from the dead`)
  } else {
    logger.info(`Node ${zwaveNode.id} is alive`)
  }

  this.emit('event', eventEmitter.node, 'node alive', this.nodes[zwaveNode.id])
}

function onNodeDead (zwaveNode, oldStatus) {
  onNodeStatus.call(this, zwaveNode)
  logger.info(
    `Node ${zwaveNode.id} is ${
      oldStatus === NodeStatus.Unknown ? '' : 'now '
    }dead`
  )

  this.emit('event', eventEmitter.node, 'node dead', this.nodes[zwaveNode.id])
}

function onNodeValueAdded (zwaveNode, args) {
  logger.info(
    `Node ${zwaveNode.id}: value added: ${getValueID(args)} => ${args.newValue}`
  )

  // handle node values added 'on fly'
  if (zwaveNode.ready) {
    addValue.call(this, zwaveNode, args)
  }

  this.emit(
    'event',
    eventEmitter.node,
    'node value added',
    this.nodes[zwaveNode.id],
    args
  )
}

function onNodeValueNotification (zwaveNode, args) {
  onNodeValueUpdated.call(this, zwaveNode, args, true)
}

function onNodeValueUpdated (zwaveNode, args, isNotification) {
  updateValue.call(this, zwaveNode, args)
  logger.info(
    `Node ${zwaveNode.id}: value ${
      isNotification ? 'notification' : 'updated'
    }: ${getValueID(args)} ${args.prevValue} => ${args.newValue}`
  )

  this.emit(
    'event',
    eventEmitter.node,
    'node value updated',
    this.nodes[zwaveNode.id],
    args
  )
}

function onNodeValueRemoved (zwaveNode, args) {
  removeValue.call(this, zwaveNode, args)
  logger.info(`Node ${zwaveNode.id}: value removed: ${getValueID(args)}`)
  this.emit(
    'event',
    eventEmitter.node,
    'node value removed',
    this.nodes[zwaveNode.id],
    args
  )
}

function onNodeMetadataUpdated (zwaveNode, args) {
  const valueId = parseValue.call(this, zwaveNode, args, args.metadata)
  logger.info(`Node ${valueId.nodeId}: metadata updated: ${getValueID(args)}`)
  this.emit(
    'event',
    eventEmitter.node,
    'node metadata updated',
    this.nodes[zwaveNode.id],
    args
  )
}

function onNodeNotification (zwaveNode, notificationLabel, parameters) {
  logger.info(
    `Node ${zwaveNode.id}: notification: ${notificationLabel} ${
      parameters ? 'with ' + parameters.toString() : ''
    }`
  )
  this.emit('notification', zwaveNode, notificationLabel, parameters)
  this.emit(
    'event',
    eventEmitter.node,
    'node notification',
    this.nodes[zwaveNode.id],
    notificationLabel,
    parameters
  )
}

function onNodeFirmwareUpdateProgress (
  zwaveNode,
  sentFragments,
  totalFragments
) {
  updateControllerStatus.call(
    this,
    `Node ${zwaveNode.id} firmware update IN PROGRESS: ${sentFragments}/${totalFragments}`
  )
  this.emit(
    'event',
    eventEmitter.node,
    'node firmware update progress',
    this.nodes[zwaveNode.id],
    sentFragments,
    totalFragments
  )
}

// https://github.com/zwave-js/node-zwave-js/blob/cb35157da5e95f970447a67cbb2792e364b9d1e1/packages/zwave-js/src/lib/commandclass/FirmwareUpdateMetaDataCC.ts#L59
function onNodeFirmwareUpdateFinished (zwaveNode, status, waitTime) {
  updateControllerStatus.call(
    this,
    `Node ${zwaveNode.id} firmware update FINISHED: Status ${status}, Time: ${waitTime}`
  )

  this.emit(
    'event',
    eventEmitter.node,
    'node firmware update finished',
    this.nodes[zwaveNode.id],
    status,
    waitTime
  )
}

// ------- NODE METHODS -------------

function bindNodeEvents (node) {
  // add a node to our nodes array
  addNode.call(this, node)

  // https://zwave-js.github.io/node-zwave-js/#/api/node?id=zwavenode-events
  node
    .on('ready', onNodeReady.bind(this))
    .on('interview completed', onNodeInterviewCompleted.bind(this))
    .on('wake up', onNodeWakeUp.bind(this))
    .on('sleep', onNodeSleep.bind(this))
    .on('alive', onNodeAlive.bind(this))
    .on('dead', onNodeDead.bind(this))
    .on('value added', onNodeValueAdded.bind(this))
    .on('value updated', onNodeValueUpdated.bind(this))
    .on('value notification', onNodeValueNotification.bind(this))
    .on('value removed', onNodeValueRemoved.bind(this))
    .on('metadata updated', onNodeMetadataUpdated.bind(this))
    .on('notification', onNodeNotification.bind(this))
    .on('firmware update progress', onNodeFirmwareUpdateProgress.bind(this))
    .on('firmware update finished', onNodeFirmwareUpdateFinished.bind(this))
}

function removeNode (nodeid) {
  logger.info(`Node removed ${nodeid}`)

  // don't use splice here, nodeid equals to the index in the array
  const node = this.nodes[nodeid]
  if (node) {
    this.nodes[nodeid] = null

    this.emit('nodeRemoved', node)
    this.addEmptyNodes()
    this.sendToSocket(socketEvents.nodeRemoved, this.nodes[nodeid])
  }
}

// Triggered when a node is added but no informations are received yet
function addNode (zwaveNode) {
  const nodeId = zwaveNode.id

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
  logger.info(`Node added ${nodeId}`)
}

function initNode (zwaveNode) {
  const nodeId = zwaveNode.id

  const node = this.nodes[nodeId]

  const deviceConfig = zwaveNode.deviceConfig || {
    label: 'Unknown product ' + zwaveNode.productId,
    description: zwaveNode.productType,
    manufacturer: 'Unknown manufacturer ' + zwaveNode.manufacturerId
  }

  const deviceClass = zwaveNode.deviceClass || {
    basic: {},
    generic: {},
    specific: {}
  }

  // https://zwave-js.github.io/node-zwave-js/#/api/node?id=zwavenode-properties
  node.manufacturerId = zwaveNode.manufacturerId
  node.productId = zwaveNode.productId
  node.productLabel = deviceConfig.label
  node.productDescription = deviceConfig.description
  node.productType = zwaveNode.productType
  node.manufacturerId = zwaveNode.manufacturerId
  node.manufacturer = deviceConfig.manufacturer
  node.firmwareVersion = zwaveNode.firmwareVersion
  node.zwaveVersion = zwaveNode.version
  node.isSecure = zwaveNode.isSecure
  node.isBeaming = zwaveNode.isBeaming
  node.isListening = zwaveNode.isListening
  node.isFrequentListening = zwaveNode.isFrequentListening
  node.isRouting = zwaveNode.isRouting
  node.keepAwake = zwaveNode.keepAwake
  node.deviceClass = {
    basic: deviceClass.basic.key,
    generic: deviceClass.generic.key,
    specific: deviceClass.specific.key
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

  node.deviceId = getDeviceID(node)
  node.hexId = `${utils.num2hex(node.manufacturerId)}-${utils.num2hex(
    node.productId
  )}-${utils.num2hex(node.productType)}`

  this.getGroups(zwaveNode.id, true)
}

function updateValueMetadata (zwaveNode, zwaveValue, zwaveValueMeta) {
  zwaveValue.nodeId = zwaveNode.id

  const valueId = {
    id: getValueID(zwaveValue, true),
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
    label: zwaveValueMeta.label || zwaveValue.propertyName + ' (property)', // when label is missing, re use propertyName. Usefull for webinterface
    default: zwaveValueMeta.default
  }

  if (zwaveValueMeta.ccSpecific) {
    valueId.ccSpecific = zwaveValueMeta.ccSpecific
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
  const node = this.nodes[zwaveNode.id]

  if (!node) {
    logger.info(`ValueAdded: no such node: ${zwaveNode.id} error`)
  } else {
    const zwaveValueMeta = zwaveNode.getValueMetadata(zwaveValue)

    const valueId = parseValue.call(this, zwaveNode, zwaveValue, zwaveValueMeta)

    logger.info(
      `Node ${zwaveNode.id}: value added ${valueId.id} => ${valueId.value}`
    )

    this.emit('valueChanged', valueId, node)
  }
}

function parseValue (zwaveNode, zwaveValue, zwaveValueMeta) {
  const node = this.nodes[zwaveNode.id]
  const valueId = updateValueMetadata.call(
    this,
    zwaveNode,
    zwaveValue,
    zwaveValueMeta
  )

  const vID = getValueID(valueId)

  valueId.value = zwaveNode.getValue(zwaveValue)

  if (valueId.value === undefined) {
    const prevValue = node.values[vID] ? node.values[vID].value : undefined
    valueId.value =
      zwaveValue.newValue !== undefined ? zwaveValue.newValue : prevValue
  }

  if (isCurrentValue(valueId)) {
    valueId.isCurrentValue = true
    const targetValue = findTargetValue(valueId, zwaveNode.getDefinedValueIDs())
    if (targetValue) {
      valueId.targetValue = getValueID(targetValue, false)
    }
  }

  node.values[vID] = valueId

  return valueId
}

// Triggered when a node is ready and a value changes
function updateValue (zwaveNode, args) {
  const node = this.nodes[zwaveNode.id]

  if (!node) {
    logger.info(`valueChanged: no such node: ${zwaveNode.id} error`)
  } else {
    const valueId = node.values[getValueID(args)]

    if (valueId) {
      valueId.value = args.newValue

      this.emit('valueChanged', valueId, node, args.prevValue !== args.newValue)
    }
    node.lastActive = Date.now()
  }
}

function removeValue (zwaveNode, args) {
  const node = this.nodes[zwaveNode.id]
  const idString = getValueID(args)
  const toRemove = node ? node.values[idString] : null

  if (toRemove) {
    delete node.values[idString]
    this.sendToSocket(socketEvents.valueRemoved, toRemove)
    logger.info(`ValueRemoved: ${idString} from node ${zwaveNode.id}`)
  } else {
    logger.info(`ValueRemoved: no such node: ${zwaveNode.id} error`)
  }
}

// ------- Utils ------------------------

/**
 * Get the device id of a specific node
 *
 * @param {any} node Internal node object
 * @returns A string in the format `<manufacturerId>-<productId>-<producttype>` that unique identifhy a zwave device
 */
function getDeviceID (node) {
  if (!node) return ''

  return `${parseInt(node.manufacturerId)}-${parseInt(
    node.productId
  )}-${parseInt(node.productType)}`
}

function isCurrentValue (valueId) {
  return valueId.propertyName && /current/i.test(valueId.propertyName)
}

function findTargetValue (zwaveValue, definedValueIds) {
  return definedValueIds.find(
    v =>
      v.commandClass === zwaveValue.commandClass &&
      v.endpoint === zwaveValue.endpoint &&
      v.propertyKey === zwaveValue.propertyKey &&
      /target/i.test(v.propertyName)
  )
}

/**
 * Get a valueId from a valueId object
 *
 * @param {any} v Zwave valueId object
 * @param {boolean} nodeId Add node identifier
 * @returns The value id unique identifier
 */
function getValueID (v, withNode) {
  return `${withNode ? v.nodeId + '-' : ''}${v.commandClass}-${v.endpoint ||
    0}-${v.property}${v.propertyKey !== undefined ? '-' + v.propertyKey : ''}`
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
    return this.driverInfo.name
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

  const now = new Date()
  let start
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

  const parts = idString.split('-')

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
 * Calls driver healNetwork function and schedule next heal
 *
 */
ZwaveClient.prototype.heal = function () {
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
 * @param {any} hassDevice The Hass device
 * @param {number} nodeId The nodeid
 * @param {boolean} deleteDevice True to remove the hass device from node hass devices
 */
ZwaveClient.prototype.updateDevice = function (
  hassDevice,
  nodeId,
  deleteDevice
) {
  const node = nodeId >= 0 ? this.nodes[nodeId] : null

  // check for existing node and node hassdevice with given id
  if (node && hassDevice.id && node.hassDevices[hassDevice.id]) {
    if (deleteDevice) {
      delete node.hassDevices[hassDevice.id]
    } else {
      const id = hassDevice.id
      delete hassDevice.id
      node.hassDevices[id] = hassDevice
    }

    this.sendToSocket(socketEvents.nodeUpdated, node)
  }
}

/**
 * Used to Add a new hass device to a specific node
 *
 * @param {Object} hassDevice The Hass device
 * @param {Integer} nodeId The nodeid
 */
ZwaveClient.prototype.addDevice = function (hassDevice, nodeId) {
  const node = nodeId >= 0 ? this.nodes[nodeId] : null

  // check for existing node and node hassdevice with given id
  if (node && hassDevice.id) {
    delete hassDevice.id
    const id = hassDevice.type + '_' + hassDevice.object_id
    hassDevice.persistent = false
    node.hassDevices[id] = hassDevice

    this.sendToSocket(socketEvents.nodeUpdated, node)
  }
}

/**
 * Used to update hass devices list of a specific node and store them in `nodes.json`
 *
 * @param {Object} devices List of devices `"<deviceId>" : <deviceObject>`
 * @param {*} nodeId The node to send this devices
 */
ZwaveClient.prototype.storeDevices = async function (devices, nodeId, remove) {
  const node = this.nodes[nodeId]

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

    this.sendToSocket(socketEvents.nodeUpdated, node)
  }
}

/**
 * Method used to close client connection, use this before destroy
 */
ZwaveClient.prototype.close = async function () {
  this.status = ZWAVE_STATUS.closed
  this.closed = true

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

  if (this.driver) {
    this.driverReady = false
    this.removeAllListeners()
    await this.driver.destroy()
  }
}

ZwaveClient.prototype.getStatus = function () {
  const status = {}

  status.driverReady = this.driverReady
  status.status = this.driverReady && !this.closed
  status.config = this.cfg

  return status
}

/**
 * Used to replace `null` nodes in nodes Array
 *
 */
ZwaveClient.prototype.addEmptyNodes = function () {
  for (let i = 0; i < this.nodes.length; i++) {
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
ZwaveClient.prototype.getGroups = async function (
  nodeId,
  ignoreUpdate = false
) {
  const zwaveNode = this.getNode(nodeId)
  if (zwaveNode) {
    let groups = []
    try {
      groups = await this.driver.controller.getAssociationGroups(nodeId)
    } catch (error) {
      logger.warn(`Node ${nodeId} doesn't support groups associations`)
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

  if (!ignoreUpdate) {
    onNodeStatus.call(this, zwaveNode)
  }
}

/**
 * Get current associations of a specific group
 *
 * @param {Integer} nodeId Zwave node id
 * @param {Integer} groupId Zwave node group Id
 */
ZwaveClient.prototype.getAssociations = async function (nodeId, groupId) {
  const zwaveNode = this.getNode(nodeId)
  let associations = []

  if (zwaveNode) {
    try {
      // https://zwave-js.github.io/node-zwave-js/#/api/controller?id=association-interface
      // the result is a map where the key is the group number and the value is the array of associations {nodeId, endpoint?}
      associations = (await this.driver.controller.getAssociations(nodeId)).get(
        groupId
      )
    } catch (error) {
      logger.warn(`Node ${nodeId} doesn't support groups associations`)
      // node doesn't support groups associations
    }
  } else {
    logger.warn(`Node ${nodeId} not found when calling 'getAssociations'`)
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
ZwaveClient.prototype.addAssociations = async function (
  nodeId,
  groupId,
  associations
) {
  const zwaveNode = this.getNode(nodeId)

  if (zwaveNode) {
    try {
      for (const a of associations) {
        if (this.driver.controller.isAssociationAllowed(nodeId, groupId, a)) {
          logger.info(
            `Assocaitions: Adding Node ${a.nodeId} to Group ${groupId} of  Node ${nodeId}`
          )
          await this.driver.controller.addAssociations(nodeId, groupId, [a])
        } else {
          logger.warn(
            `Associations: Unable to add Node ${a.nodeId} to Group ${groupId} of Node ${nodeId}`
          )
        }
      }
    } catch (error) {
      logger.warn(
        `Error while adding associations to ${nodeId}: ${error.message}`
      )
    }
  } else {
    logger.warn(`Node ${nodeId} not found when calling 'addAssociations'`)
  }
}

/**
 * Remove a node from an association group
 *
 * @param {Integer} nodeId Zwave node id
 * @param { Integer} groupId Zwave node group Id
 * @param {Association} associations Array of associations
 */
ZwaveClient.prototype.removeAssociations = async function (
  nodeId,
  groupId,
  associations
) {
  const zwaveNode = this.getNode(nodeId)

  if (zwaveNode) {
    try {
      logger.log(
        'info',
        `Assocaitions: Removing associations from Node ${nodeId} Group ${groupId}: %o`,
        associations
      )
      await this.driver.controller.removeAssociations(
        nodeId,
        groupId,
        associations
      )
    } catch (error) {
      logger.warn(
        `Error while removing associations from ${nodeId}: ${error.message}`
      )
    }
  } else {
    logger.warn(`Node ${nodeId} not found when calling 'removeAssociations'`)
  }
}

/**
 * Remove all associations
 *
 * @param {Integer} nodeId Zwave node id
 */
ZwaveClient.prototype.removeAllAssociations = async function (nodeId) {
  const zwaveNode = this.getNode(nodeId)

  if (zwaveNode) {
    try {
      const associationsGroups = await this.driver.controller.getAssociations(
        nodeId
      )

      for (const [groupId, associations] of associationsGroups) {
        if (associations.length > 0) {
          await this.driver.controller.removeAssociations(
            nodeId,
            groupId,
            associations
          )
          logger.info(
            `Assocaitions: Removed ${associations.length} associations from Node ${nodeId} group ${groupId}`
          )
        }
      }
    } catch (error) {
      logger.warn(
        `Error while removing all associations from ${nodeId}: ${error.message}`
      )
    }
  } else {
    logger.warn(`Node ${nodeId} not found when calling 'removeAllAssociations'`)
  }
}

/**
 * Remove node from all associations
 *
 * @param {Integer} nodeId Zwave node id
 */
ZwaveClient.prototype.removeNodeFromAllAssociations = async function (nodeId) {
  const zwaveNode = this.getNode(nodeId)

  if (zwaveNode) {
    try {
      logger.info(`Assocaitions: Removing Node ${nodeId} from all associations`)
      await this.driver.controller.removeNodeFromAllAssocations(nodeId)
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
    // this could happen when the driver fails the connect and a reconnect timeout triggers
    if (this.closed) return

    // extend options with hidden `options`
    const zwaveOptions = Object.assign(
      {
        storage: {
          cacheDir: storeDir
        },
        networkKey: this.cfg.networkKey,
        logConfig: {
          // https://zwave-js.github.io/node-zwave-js/#/api/driver?id=logconfig
          enabled: this.cfg.logEnabled,
          level: loglevels[this.cfg.logLevel],
          logToFile: this.cfg.logToFile,
          filename: ZWAVEJS_LOG_FILE,
          forceConsole: true
        }
      },
      this.cfg.options
    )

    // transform network key to buffer
    if (zwaveOptions.networkKey && zwaveOptions.networkKey.length === 32) {
      zwaveOptions.networkKey = Buffer.from(zwaveOptions.networkKey, 'hex')
    } else {
      delete zwaveOptions.networkKey
    }

    try {
      // init driver here because if connect fails the driver is destroyed
      // this could throw so include in the try/catch
      this.driver = new Driver(this.cfg.port, zwaveOptions)

      this.driver.on('error', driverError.bind(this))
      this.driver.once('driver ready', driverReady.bind(this))
      this.driver.on('all nodes ready', scanComplete.bind(this))

      logger.info(`Connecting to ${this.cfg.port}`)

      await this.driver.start()
      this.status = ZWAVE_STATUS.connected
      this.connected = true
    } catch (error) {
      // destroy diver instance when it fails
      if (this.driver) {
        this.driver.destroy().catch(err => {
          logger.error(`Error while destroing driver ${err.message}`, error)
        })
      }
      driverError.call(this, error)
      logger.warn('Retry connection in 3 seconds...')
      this.reconnectTimeout = setTimeout(this.connect.bind(this), 3000)
    }
  } else {
    logger.info(`Driver already connected to ${this.cfg.port}`)
  }
}

/**
 *
 *
 * @param {String} evtName Socket event name
 * @param {Object} data Event data object
 */
ZwaveClient.prototype.sendToSocket = function (evtName, data) {
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
  const id =
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
  const index = this.scenes.findIndex(s => s.sceneid === sceneid)

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
  const scene = this.scenes.find(s => s.sceneid === sceneid)
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
ZwaveClient.prototype._addSceneValue = async function (
  sceneid,
  valueId,
  value,
  timeout
) {
  const scene = this.scenes.find(s => s.sceneid === sceneid)

  if (!scene) throw Error('No scene found with given sceneid')

  if (this.nodes.length < valueId.nodeId || !this.nodes[valueId.nodeId]) {
    throw Error(`Node ${valueId.nodeId} not found`)
  } else {
    // check if it is an existing valueid
    if (!this.nodes[valueId.nodeId].values[getValueID(valueId)]) {
      throw Error('No value found with given valueId')
    } else {
      // if this valueid is already in owr scene edit it else create new one
      const index = scene.values.findIndex(s => s.id === valueId.id)

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
 *
 * @param {Integer} sceneid The scene id
 * @param {Array} args Array or argument
 * @throws Error if args valueid isn't valid
 */
ZwaveClient.prototype._removeSceneValue = async function (sceneid, valueId) {
  const scene = this.scenes.find(s => s.sceneid === sceneid)

  if (!scene) throw Error('No scene found with given sceneid')

  // get the index with also the node identifier as prefix
  const index = scene.values.findIndex(s => s.id === valueId.id)

  if (index < 0) throw Error('No ValueId match found in given scene')
  else {
    scene.values.splice(index, 1)
  }

  return jsonStore.put(store.scenes, this.scenes)
}

/**
 * Activate a scene with given scene id
 *
 * @param {Integer} sceneId The scene Id
 * @returns True if activation is successfull
 */
ZwaveClient.prototype._activateScene = function (sceneId) {
  const values = this._sceneGetValues(sceneId)

  // eslint-disable-next-line no-unmodified-loop-condition
  for (let i = 0; values && i < values.length; i++) {
    const fun = wrapFunction(this.writeValue, this, [
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
  const info = Object.assign({}, this.driverInfo)

  info.uptime = process.uptime()
  info.lastUpdate = this.lastUpdate
  info.status = this.status
  info.cntStatus = this.cntStatus
  info.appVersion = utils.getVersion()

  return info
}

ZwaveClient.prototype.replaceFailedNode = async function (nodeId, secure) {
  if (this.driver && !this.closed) {
    if (this.commandsTimeout) {
      clearTimeout(this.commandsTimeout)
      this.commandsTimeout = null
    }

    this.commandsTimeout = setTimeout(
      this.stopInclusion.bind(this),
      this.cfg.commandsTimeout * 1000 || 30000
    )
    // by default replaceFailedNode is secured, pass true to make it not secured
    return this.driver.controller.replaceFailedNode(nodeId, !secure)
  }

  throw Error('Driver is closed')
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
    return this.driver.controller.beginInclusion(!secure)
  }

  throw Error('Driver is closed')
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

  throw Error('Driver is closed')
}

ZwaveClient.prototype.stopExclusion = async function () {
  if (this.driver && !this.closed) {
    if (this.commandsTimeout) {
      clearTimeout(this.commandsTimeout)
      this.commandsTimeout = null
    }
    return this.driver.controller.stopExclusion()
  }

  throw Error('Driver is closed')
}

ZwaveClient.prototype.stopInclusion = async function () {
  if (this.driver && !this.closed) {
    if (this.commandsTimeout) {
      clearTimeout(this.commandsTimeout)
      this.commandsTimeout = null
    }
    return this.driver.controller.stopInclusion()
  }

  throw Error('Driver is closed')
}

ZwaveClient.prototype.stopInclusion = async function () {
  if (this.driver && !this.closed) {
    if (this.commandsTimeout) {
      clearTimeout(this.commandsTimeout)
      this.commandsTimeout = null
    }
    return this.driver.controller.stopInclusion()
  }

  throw Error('Driver is closed')
}

ZwaveClient.prototype.healNode = async function (nodeId) {
  if (this.driver && !this.closed) {
    return this.driver.controller.healNode(nodeId)
  }

  throw Error('Driver is closed')
}

ZwaveClient.prototype.isFailedNode = async function (nodeId) {
  if (this.driver && !this.closed) {
    const node = this.nodes[nodeId]
    const zwaveNode = this.getNode(nodeId)

    const result = await this.driver.controller.isFailedNode(nodeId)
    if (node) {
      node.failed = result
    }

    if (zwaveNode) {
      onNodeStatus.call(this, zwaveNode)
    }
    return result
  }

  throw Error('Driver is closed')
}
ZwaveClient.prototype.removeFailedNode = async function (nodeId) {
  if (this.driver && !this.closed) {
    return this.driver.controller.removeFailedNode(nodeId)
  }

  throw Error('Driver is closed')
}

ZwaveClient.prototype.refreshInfo = async function (nodeId) {
  if (this.driver && !this.closed) {
    const zwaveNode = this.getNode(nodeId)

    if (!zwaveNode) {
      throw Error(`Node ${nodeId} not found`)
    }

    return zwaveNode.refreshInfo()
  }

  throw Error('Driver is closed')
}

function guessFirmwareFormat (filename, firmware) {
  if (
    (filename.endsWith('.exe') || filename.endsWith('.ex_')) &&
    firmware.includes(Buffer.from('Aeon Labs', 'utf8'))
  ) {
    return 'aeotec'
  } else if (/\.(hex|ota|otz)$/.test(filename)) {
    return filename.slice(-3)
  } else {
    throw new Error('could not detect firmware format')
  }
}

ZwaveClient.prototype.beginFirmwareUpdate = async function (
  nodeId,
  fileName,
  data
) {
  if (this.driver && !this.closed) {
    const zwaveNode = this.getNode(nodeId)

    if (!zwaveNode) {
      throw Error(`Node ${nodeId} not found`)
    }

    if (!(data instanceof Buffer)) {
      throw Error('Data must be a buffer')
    }

    let actualFirmware
    try {
      const format = guessFirmwareFormat(fileName, data)
      actualFirmware = extractFirmware(data, format)
    } catch (e) {
      throw Error('Unable to extract firmware from file: ' + e.message)
    }

    return zwaveNode.beginFirmwareUpdate(
      actualFirmware.data,
      actualFirmware.firmwareTarget
    )
  }

  throw Error('Driver is closed')
}

ZwaveClient.prototype.abortFirmwareUpdate = async function (nodeId) {
  if (this.driver && !this.closed) {
    const zwaveNode = this.getNode(nodeId)

    if (!zwaveNode) {
      throw Error(`Node ${nodeId} not found`)
    }

    return zwaveNode.abortFirmwareUpdate()
  }

  throw Error('Driver is closed')
}

ZwaveClient.prototype.beginHealingNetwork = async function () {
  if (this.driver && !this.closed) {
    return this.driver.controller.beginHealingNetwork()
  }

  throw Error('Driver is closed')
}

ZwaveClient.prototype.stopHealingNetwork = async function () {
  if (this.driver && !this.closed) {
    return this.driver.controller.stopHealingNetwork()
  }

  throw Error('Driver is closed')
}

ZwaveClient.prototype.hardReset = async function () {
  if (this.driver && !this.closed) {
    return this.driver.hardReset()
  }

  throw Error('Driver is closed')
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
  let err, result

  if (this.driverReady) {
    try {
      // ZwaveClient Apis that can be called with MQTT apis
      const allowedApis = [
        '_setNodeName',
        '_setNodeLocation',
        'refreshNeighbors',
        'getAssociations',
        'addAssociations',
        'removeAssociations',
        'removeAllAssociations',
        'removeNodeFromAllAssociations',
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
        'replaceFailedNode',
        'hardReset',
        'healNode',
        'beginHealingNetwork',
        'stopHealingNetwork',
        'isFailedNode',
        'removeFailedNode',
        'refreshInfo',
        'beginFirmwareUpdate',
        'abortFirmwareUpdate',
        'writeValue'
      ]

      const useCustom =
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
    const nId = args[0].nodeId
    const vId = getValueID(args[0])

    if (this.nodes[nId] && this.nodes[nId][vId]) {
      this.nodes[nId][vId].isPolled = this.driver.controller.isPolled(args[0])
    }
  }

  logger.info(`${result.message} ${apiName} ${result.result || ''}`)

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
    logger.info(`Writing ${value} to ${getValueID(valueId)}`)

    let result = false

    if (
      valueId.type === 'number' &&
      typeof value === 'string' &&
      !isNaN(value)
    ) {
      value = Number(value)
    }

    try {
      const zwaveNode = await this.getNode(valueId.nodeId)

      // handle multilevel switch 'start' and 'stop' commands
      if (
        valueId.commandClass === CommandClasses['Multilevel Switch'] &&
        isNaN(value)
      ) {
        if (/stop/i.test(value)) {
          await zwaveNode.commandClasses['Multilevel Switch'].stopLevelChange()
        } else if (/start/i.test(value)) {
          await zwaveNode.commandClasses['Multilevel Switch'].startLevelChange()
        } else {
          throw Error('Command not valid for Multilevel Switch')
        }
        result = true
      } else {
        result = await this.getNode(valueId.nodeId).setValue(valueId, value)
      }
    } catch (error) {
      logger.error(
        `Error while writing ${value} on ${getValueID(valueId)}: ${
          error.message
        }`,
        error
      )
    }
    // https://zwave-js.github.io/node-zwave-js/#/api/node?id=setvalue
    if (result === false) {
      logger.error(`Unable to write ${value} on ${getValueID(valueId)}`)
    }
  }
}

module.exports = ZwaveClient
