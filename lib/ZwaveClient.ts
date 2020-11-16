/* eslint-disable camelcase */
'use strict'

// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'reqlib'.
// eslint-disable-next-line one-var
const reqlib = require('app-root-path').require
const { Driver, NodeStatus, InterviewStage } = require('zwave-js')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'utils'.
const utils = reqlib('/lib/utils.js')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'EventEmitt... Remove this comment to see the full error message
const EventEmitter = require('events')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'jsonStore'... Remove this comment to see the full error message
const jsonStore = reqlib('/lib/jsonStore.js')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'store'.
const store = reqlib('config/store.js')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'storeDir'.
const storeDir = utils.joinPath(true, reqlib('config/app.js').storeDir)
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'debug'.
const debug = reqlib('/lib/debug')('Zwave')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'inherits'.
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

const eventEmitter = {
  driver: 'driver',
  controller: 'controller',
  node: 'node'
}

/**
 * The constructor
 */
function ZwaveClient (config: any, socket: any) {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  if (!(this instanceof ZwaveClient)) {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
    return new ZwaveClient(config)
  }
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  EventEmitter.call(this)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  init.call(this, config, socket)
}

inherits(ZwaveClient, EventEmitter)

function init (cfg: any, socket: any) {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.cfg = cfg
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.socket = socket

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.closed = false
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.driverReady = false
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.scenes = jsonStore.get(store.scenes)

  cfg.networkKey = cfg.networkKey || process.env.OZW_NETWORK_KEY

  // @ts-expect-error ts-migrate(2322) FIXME: Type 'null' is not assignable to type 'string | un... Remove this comment to see the full error message
  if (process.env.LOGLEVEL === 'undefined') process.env.LOGLEVEL = null

  // https://github.com/zwave-js/node-zwave-js/blob/master/packages/core/src/log/shared.ts#L13
  // https://github.com/winstonjs/triple-beam/blob/master/config/npm.js#L14-L15
  process.env.LOGLEVEL = process.env.LOGLEVEL || cfg.logLevel

  if (process.env.LOGTOFILE || cfg.logToFile) {
    process.env.LOGTOFILE = 'true'
  }

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.nodes = []
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.storeNodes = jsonStore.get(store.nodes)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.devices = {}
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.ozwConfig = {}
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.healTimeout = null

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
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
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.status = ZWAVE_STATUS.driverReady
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.driverReady = true

  debug('Zwave driver is ready')

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  updateControllerStatus.call(this, 'Driver ready')

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.driver.controller
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('inclusion started', onInclusionStarted.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('exclusion started', onExclusionStarted.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('inclusion stopped', onInclusionStopped.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('exclusion stopped', onExclusionStopped.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('inclusion failed', onInclusionFailed.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('exclusion failed', onExclusionFailed.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('node added', onNodeAdded.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('node removed', onNodeRemoved.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('heal network progress', onHealNetworkProgress.bind(this))
  // .on('heal network done', onHealNetworkDone.bind(this))

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  // eslint-disable-next-line no-unused-vars
  for (const [nodeId, node] of this.driver.controller.nodes) {
    // Reset the node status
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    bindNodeEvents.call(this, node)

    // Make sure we didn't miss the ready event
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    if (node.ready) onNodeReady.call(this, node)
  }

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.ozwConfig.homeid = this.driver.controller.homeId
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  const homeHex = '0x' + this.ozwConfig.homeid.toString(16)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.ozwConfig.name = homeHex
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.ozwConfig.controllerId = this.driver.controller.ownNodeId

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('event', eventEmitter.driver, 'driver ready', this.ozwConfig)

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.error = false

  debug('Scanning network with homeid:', homeHex)
}

function driverError (error: any) {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.error = 'Driver: ' + error.message
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.status = ZWAVE_STATUS.driverFailed
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  updateControllerStatus.call(this, this.error)

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('event', eventEmitter.driver, 'driver error', error)
}

function scanComplete () {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.scanComplete = true

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  updateControllerStatus.call(this, 'Scan completed')

  // all nodes are ready
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.status = ZWAVE_STATUS.scanDone

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  const nodes = this.nodes.filter((n: any) => !n.failed)
  debug('Network scan complete. Found:', nodes.length, 'nodes')

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('scanComplete')

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('event', eventEmitter.driver, 'all nodes ready')
}

// ---------- CONTROLLER EVENTS -------------------------------

function updateControllerStatus (status: any) {
  debug(status)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.cntStatus = status
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emitEvent(socketEvents.controller, status)
}

function onInclusionStarted (secure: any) {
  const message = `${secure ? 'Secure' : 'Non-secure'} inclusion started`
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  updateControllerStatus.call(this, message)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('event', eventEmitter.controller, 'inclusion started', secure)
}

function onExclusionStarted () {
  const message = 'Exclusion started'
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  updateControllerStatus.call(this, message)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('event', eventEmitter.controller, 'exclusion started')
}

function onInclusionStopped () {
  const message = 'Inclusion stopped'
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  updateControllerStatus.call(this, message)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('event', eventEmitter.controller, 'inclusion stopped')
}

function onExclusionStopped () {
  const message = 'Exclusion stopped'
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  updateControllerStatus.call(this, message)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('event', eventEmitter.controller, 'exclusion stopped')
}

function onInclusionFailed () {
  const message = 'Inclusion failed'
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  updateControllerStatus.call(this, message)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('event', eventEmitter.controller, 'inclusion failed')
}

function onExclusionFailed () {
  const message = 'Exclusion failed'
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  updateControllerStatus.call(this, message)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('event', eventEmitter.controller, 'exclusion failed')
}

function onNodeAdded (zwaveNode: any) {
  debug(`Node ${zwaveNode.id}: added`)

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  if (this.driverReady) {
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    bindNodeEvents.call(this, zwaveNode)
  }

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit(
    'event',
    eventEmitter.controller,
    'node added',
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.nodes[zwaveNode.id]
  )
}

function onNodeRemoved (zwaveNode: any) {
  debug(`Node ${zwaveNode.id}: removed`)
  zwaveNode.removeAllListeners()

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit(
    'event',
    eventEmitter.controller,
    'node removed',
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.nodes[zwaveNode.id]
  )

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  removeNode.call(this, zwaveNode.id)
}

function onHealNetworkProgress (progress: any) {
  const toHeal = [...progress.values()]
  const healedNodes = toHeal.filter(v => v !== 'pending')
  let message
  // If this is the final progress report, skip it, so the frontend gets the "done" message
  if (healedNodes.length === toHeal.length) {
    message = `Healing process COMPLETED. Healed ${toHeal.length} nodes`
  } else {
    message = `Healing process IN PROGRESS. Healed ${healedNodes.length} nodes`
  }

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('event', eventEmitter.controller, 'heal network progress', progress)

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  updateControllerStatus.call(this, message)
}

// function onHealNetworkDone (result) {
//   var message = `Healing process COMPLETED. Healed ${result.length} nodes`
//   updateControllerStatus.call(this, message)
// }

// ---------- NODE EVENTS -------------------------------------

// generic node status update
function onNodeStatus (zwaveNode: any) {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  const node = this.nodes[zwaveNode.id]

  if (node) {
    // https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/node/Types.ts#L127
    node.status = NodeStatus[zwaveNode.status]
    node.interviewStage = InterviewStage[zwaveNode.interviewStage]
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.emit('nodeStatus', node)
  }
}

function onNodeReady (zwaveNode: any) {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  const node = this.nodes[zwaveNode.id]

  // node ready event has been already tiggered by this node
  if (!node || node.ready) return

  node.ready = true
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  onNodeStatus.call(this, zwaveNode)

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  initNode.call(this, zwaveNode)

  const values = zwaveNode.getDefinedValueIDs()

  for (const zwaveValue of values) {
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    addValue.call(this, zwaveNode, zwaveValue)
  }

  node.lastActive = Date.now()

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('nodeStatus', node)

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('event', eventEmitter.node, 'node ready', this.nodes[zwaveNode.id])

  debug(
    'Node %d ready: %s - %s (%s)',
    node.id,
    node.manufacturer,
    node.productLabel,
    node.productDescription || 'Unknown'
  )
}

// when this event is triggered all node values and metadata are updated
function onNodeInterviewCompleted (zwaveNode: any) {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  const node = this.nodes[zwaveNode.id]
  node.interviewCompleted = true
  node.neighbors = zwaveNode.neighbors

  // add it to know devices types (if not already present)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  if (!this.devices[node.deviceId]) {
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.devices[node.deviceId] = {
      name: `[${node.deviceId}] ${node.productDescription} (${node.manufacturer})`,
      values: JSON.parse(JSON.stringify(node.values))
    }

    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    const deviceValues = this.devices[node.deviceId].values

    // remove node specific info from values
    for (const id in deviceValues) {
      delete deviceValues[id].nodeId
      delete deviceValues[id].hassDevices
      // remove the node part
      deviceValues[id].id = id
    }
  }

  debug(`Node ${zwaveNode.id}: interview completed, all values are updated`)

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  onNodeStatus.call(this, zwaveNode)

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit(
    'event',
    eventEmitter.node,
    'node interview completed',
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.nodes[zwaveNode.id]
  )
}

function onNodeWakeUp (zwaveNode: any, oldStatus: any) {
  debug(
    `Node ${zwaveNode.id} is ${
      oldStatus === NodeStatus.Unknown ? '' : 'now '
    }awake`
  )

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  onNodeStatus.call(this, zwaveNode)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('event', eventEmitter.node, 'node wakeup', this.nodes[zwaveNode.id])
}

function onNodeSleep (zwaveNode: any, oldStatus: any) {
  debug(
    `Node ${zwaveNode.id} is ${
      oldStatus === NodeStatus.Unknown ? '' : 'now '
    }asleep`
  )
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  onNodeStatus.call(this, zwaveNode)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('event', eventEmitter.node, 'node sleep', this.nodes[zwaveNode.id])
}

function onNodeAlive (zwaveNode: any, oldStatus: any) {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  onNodeStatus.call(this, zwaveNode)
  if (oldStatus === NodeStatus.Dead) {
    debug(`Node ${zwaveNode.id}: has returned from the dead`)
  } else {
    debug(`Node ${zwaveNode.id} is alive`)
  }

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('event', eventEmitter.node, 'node alive', this.nodes[zwaveNode.id])
}

function onNodeDead (zwaveNode: any, oldStatus: any) {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  onNodeStatus.call(this, zwaveNode)
  debug(
    `Node ${zwaveNode.id} is ${
      oldStatus === NodeStatus.Unknown ? '' : 'now '
    }dead`
  )

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('event', eventEmitter.node, 'node dead', this.nodes[zwaveNode.id])
}

function onNodeValueAdded (zwaveNode: any, args: any) {
  debug(
    `Node ${zwaveNode.id}: value added: ${    
// @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
getValueID(args)} =>`,
    args.newValue
  )

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit(
    'event',
    eventEmitter.node,
    'node value added',
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.nodes[zwaveNode.id],
    args
  )
}

function onNodeValueUpdated (zwaveNode: any, args: any) {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  updateValue.call(this, zwaveNode, args)
  debug(
    `Node ${zwaveNode.id}: value updated: ${    
// @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
getValueID(args)}`,
    args.prevValue,
    '=>',
    args.newValue
  )

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit(
    'event',
    eventEmitter.node,
    'node value updated',
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.nodes[zwaveNode.id],
    args
  )
}

function onNodeValueRemoved (zwaveNode: any, args: any) {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  removeValue.call(this, zwaveNode, args)
  debug(`Node ${zwaveNode.id}: value removed: ${args}`)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit(
    'event',
    eventEmitter.node,
    'node value removed',
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.nodes[zwaveNode.id],
    args
  )
}

function onNodeMetadataUpdated (zwaveNode: any, args: any) {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  updateValueMetadata.call(this, zwaveNode, args, args.metadata)
  // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
  debug(`Node ${zwaveNode.id}: metadata updated: ${getValueID(args)}`)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit(
    'event',
    eventEmitter.node,
    'node metadata updated',
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.nodes[zwaveNode.id],
    args
  )
}

function onNodeNotification (zwaveNode: any, notificationLabel: any, parameters: any) {
  debug(
    `Node ${zwaveNode.id}: notification: ${notificationLabel} ${
      parameters ? 'with ' + parameters.toString() : ''
    }`
  )
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('notification', zwaveNode, notificationLabel, parameters)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit(
    'event',
    eventEmitter.node,
    'node notification',
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.nodes[zwaveNode.id],
    notificationLabel,
    parameters
  )
}

function onNodeFirmwareUpdateProgress (
  zwaveNode: any,
  sentFragments: any,
  totalFragments: any
) {
  updateControllerStatus.call(
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this,
    `Node ${zwaveNode.id} firmware update IN PROGRESS: ${sentFragments}/${totalFragments}`
  )
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit(
    'event',
    eventEmitter.node,
    'node firmware update progress',
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.nodes[zwaveNode.id],
    sentFragments,
    totalFragments
  )
}

// https://github.com/zwave-js/node-zwave-js/blob/cb35157da5e95f970447a67cbb2792e364b9d1e1/packages/zwave-js/src/lib/commandclass/FirmwareUpdateMetaDataCC.ts#L59
function onNodeFirmwareUpdateFinished (zwaveNode: any, status: any, waitTime: any) {
  updateControllerStatus.call(
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this,
    `Node ${zwaveNode.id} firmware update FINISHED: Status ${status}, Time: ${waitTime}`
  )

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit(
    'event',
    eventEmitter.node,
    'node firmware update finished',
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.nodes[zwaveNode.id],
    status,
    waitTime
  )
}

// ------- NODE METHODS -------------

function bindNodeEvents (node: any) {
  // add a node to our nodes array
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  addNode.call(this, node)

  // https://zwave-js.github.io/node-zwave-js/#/api/node?id=zwavenode-events
  node
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('ready', onNodeReady.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('interview completed', onNodeInterviewCompleted.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('wake up', onNodeWakeUp.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('sleep', onNodeSleep.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('alive', onNodeAlive.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('dead', onNodeDead.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('value added', onNodeValueAdded.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('value updated', onNodeValueUpdated.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('value removed', onNodeValueRemoved.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('metadata updated', onNodeMetadataUpdated.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('notification', onNodeNotification.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('firmware update progress', onNodeFirmwareUpdateProgress.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    .on('firmware update finished', onNodeFirmwareUpdateFinished.bind(this))
}

function removeNode (nodeid: any) {
  debug('Node removed', nodeid)

  // don't use splice here, nodeid equals to the index in the array
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  const node = this.nodes[nodeid]
  if (node) {
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.nodes[nodeid] = null

    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.emit('nodeRemoved', node)
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.addEmptyNodes()
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.emitEvent(socketEvents.nodeRemoved, this.nodes[nodeid])
  }
}

// Triggered when a node is added but no informations are received yet
function addNode (zwaveNode: any) {
  const nodeId = zwaveNode.id

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.nodes[nodeId] = {
    id: nodeId,
    deviceId: '',
    manufacturer: '',
    manufacturerId: '',
    productType: '',
    productId: '',
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    name: this.storeNodes[nodeId] ? this.storeNodes[nodeId].name : '',
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
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

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  onNodeStatus.call(this, zwaveNode)

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.addEmptyNodes()
  debug('Node added', nodeId)
}

function initNode (zwaveNode: any) {
  const nodeId = zwaveNode.id

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  const node = this.nodes[nodeId]

  const deviceConfig = zwaveNode.deviceConfig || {
    label: 'Unknown product ' + zwaveNode.productId,
    description: zwaveNode.productType,
    manufacturer: 'Unknown manufacturer ' + zwaveNode.manufacturerId
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
    basic: zwaveNode.deviceClass.basic.key,
    generic: zwaveNode.deviceClass.generic.key,
    specific: zwaveNode.deviceClass.specific.key
  }

  node.neighbors = zwaveNode.neighbors

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  const storedNode = this.storeNodes[nodeId]

  if (storedNode) {
    node.loc = storedNode.loc || ''
    node.name = storedNode.name || ''

    if (storedNode.hassDevices) {
      node.hassDevices = copy(storedNode.hassDevices)
    }
  } else {
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.storeNodes[nodeId] = {}
  }

  node.available = true

  const deviceID = getDeviceID(node)
  node.deviceId = deviceID

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.getGroups(zwaveNode.id)
}

function updateValueMetadata (zwaveNode: any, zwaveValue: any, zwaveValueMeta: any) {
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
    label: zwaveValueMeta.label,
    default: zwaveValueMeta.default
  }

  let genre = 'user'

  if (zwaveValue.commandClass === 112) {
    genre = 'config'
  } else if (zwaveValue.commandClass >= 94) {
    genre = 'system'
  }

  // @ts-expect-error ts-migrate(2339) FIXME: Property 'genre' does not exist on type '{ id: str... Remove this comment to see the full error message
  valueId.genre = genre

  // Value types: https://github.com/zwave-js/node-zwave-js/blob/cb35157da5e95f970447a67cbb2792e364b9d1e1/packages/core/src/values/Metadata.ts#L28
  if (zwaveValueMeta.type === 'number') {
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'min' does not exist on type '{ id: strin... Remove this comment to see the full error message
    valueId.min = zwaveValueMeta.min
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'max' does not exist on type '{ id: strin... Remove this comment to see the full error message
    valueId.max = zwaveValueMeta.max
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'step' does not exist on type '{ id: stri... Remove this comment to see the full error message
    valueId.step = zwaveValueMeta.steps
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'unit' does not exist on type '{ id: stri... Remove this comment to see the full error message
    valueId.unit = zwaveValueMeta.unit
  } else if (zwaveValueMeta.type === 'string') {
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'minLength' does not exist on type '{ id:... Remove this comment to see the full error message
    valueId.minLength = zwaveValueMeta.minLength
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'maxLength' does not exist on type '{ id:... Remove this comment to see the full error message
    valueId.maxLength = zwaveValueMeta.maxLength
  }

  if (zwaveValueMeta.states) {
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'list' does not exist on type '{ id: stri... Remove this comment to see the full error message
    valueId.list = true
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'states' does not exist on type '{ id: st... Remove this comment to see the full error message
    valueId.states = []
    for (const k in zwaveValueMeta.states) {
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'states' does not exist on type '{ id: st... Remove this comment to see the full error message
      valueId.states.push({
        text: zwaveValueMeta.states[k],
        value: parseInt(k)
      })
    }
  } else {
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'list' does not exist on type '{ id: stri... Remove this comment to see the full error message
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
function addValue (zwaveNode: any, zwaveValue: any) {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  const node = this.nodes[zwaveNode.id]

  if (!node) {
    debug('ValueAdded: no such node: ' + zwaveNode.id, 'error')
  } else {
    const zwaveValueMeta = zwaveNode.getValueMetadata(zwaveValue)

    const valueId = updateValueMetadata.call(
      // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
      this,
      zwaveNode,
      zwaveValue,
      zwaveValueMeta
    )
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'value' does not exist on type '{ id: str... Remove this comment to see the full error message
    valueId.value = zwaveNode.getValue(zwaveValue)

    // @ts-expect-error ts-migrate(2339) FIXME: Property 'value' does not exist on type '{ id: str... Remove this comment to see the full error message
    debug(`Node ${zwaveNode.id}: value added ${valueId.id} => ${valueId.value}`)

    // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
    node.values[getValueID(valueId)] = valueId

    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.emit('valueChanged', valueId, node)
  }
}

// Triggered when a node is ready and a value changes
function updateValue (zwaveNode: any, args: any) {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  const node = this.nodes[zwaveNode.id]

  if (!node) {
    debug('valueChanged: no such node: ' + zwaveNode.id, 'error')
  } else {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
    const valueId = node.values[getValueID(args)]

    if (valueId) {
      valueId.value = args.newValue

      // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
      this.emit('valueChanged', valueId, node, args.prevValue !== args.newValue)
    }
    node.lastActive = Date.now()
  }
}

function removeValue (zwaveNode: any, args: any) {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  const node = this.nodes[zwaveNode.id]
  // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
  const idString = getValueID(args)

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
function getDeviceID (node: any) {
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
function getValueID (v: any, withNode: any) {
  return `${withNode ? v.nodeId + '-' : ''}${v.commandClass}-${v.endpoint ||
    0}-${v.property}${v.propertyKey !== undefined ? '-' + v.propertyKey : ''}`
}

/**
 * Function wrapping code used for writing queue.
 * fn - reference to function.
 * context - what you want "this" to be.
 * params - array of parameters to pass to function.
 */
function wrapFunction (fn: any, context: any, params: any) {
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
function copy (obj: any) {
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
ZwaveClient.prototype.getNode = function (nodeId: any) {
  return this.driver.controller.nodes.get(nodeId)
}

/**
 * Returns the driver ZWaveNode ValueId object or null
 *
 */
ZwaveClient.prototype.getZwaveValue = function (idString: any) {
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
  hassDevice: any,
  nodeId: any,
  deleteDevice: any
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

    this.emitEvent(socketEvents.nodeUpdated, node)
  }
}

/**
 * Used to Add a new hass device to a specific node
 *
 * @param {Object} hassDevice The Hass device
 * @param {Integer} nodeId The nodeid
 */
ZwaveClient.prototype.addDevice = function (hassDevice: any, nodeId: any) {
  const node = nodeId >= 0 ? this.nodes[nodeId] : null

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
ZwaveClient.prototype.storeDevices = async function (devices: any, nodeId: any, remove: any) {
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
  const status = {}

  // @ts-expect-error ts-migrate(2339) FIXME: Property 'driverReady' does not exist on type '{}'... Remove this comment to see the full error message
  status.driverReady = this.driverReady
  // @ts-expect-error ts-migrate(2339) FIXME: Property 'config' does not exist on type '{}'.
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
ZwaveClient.prototype.getGroups = async function (nodeId: any) {
  const zwaveNode = this.getNode(nodeId)
  if (zwaveNode) {
    let groups = []
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
ZwaveClient.prototype.getAssociations = async function (nodeId: any, groupId: any) {
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
ZwaveClient.prototype.addAssociations = async function (
  nodeId: any,
  groupId: any,
  associations: any
) {
  const zwaveNode = this.getNode(nodeId)

  if (zwaveNode) {
    try {
      for (const a of associations) {
        if (this.driver.controller.isAssociationAllowed(nodeId, groupId, a)) {
          debug(
            `Assocaitions: Adding Node ${a.nodeId} to Group ${groupId} of  Node ${nodeId}`
          )
          await this.driver.controller.addAssociations(nodeId, groupId, [a])
        } else {
          debug(
            `Associations: Unable to add Node ${a.nodeId} to Group ${groupId} of Node ${nodeId}`
          )
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
ZwaveClient.prototype.removeAssociations = async function (
  nodeId: any,
  groupId: any,
  associations: any
) {
  const zwaveNode = this.getNode(nodeId)

  if (zwaveNode) {
    try {
      debug(
        `Assocaitions: Removing associations from Node ${nodeId} Group ${groupId}:`,
        associations
      )
      await this.driver.controller.removeAssociations(
        nodeId,
        groupId,
        associations
      )
    } catch (error) {
      debug(
        `Error while removing associations from ${nodeId}: ${error.message}`
      )
    }
  } else {
    debug(`Node ${nodeId} not found when calling 'removeAssociations'`)
  }
}

/**
 * Remove all associations
 *
 * @param {Integer} nodeId Zwave node id
 */
ZwaveClient.prototype.removeAllAssociations = async function (nodeId: any) {
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
          debug(
            `Assocaitions: Removed ${associations.length} associations from Node ${nodeId} group ${groupId}`
          )
        }
      }
    } catch (error) {
      debug(
        `Error while removing all associations from ${nodeId}: ${error.message}`
      )
    }
  } else {
    debug(`Node ${nodeId} not found when calling 'removeAllAssociations'`)
  }
}

/**
 * Remove node from all associations
 *
 * @param {Integer} nodeId Zwave node id
 */
ZwaveClient.prototype.removeNodeFromAllAssociations = async function (nodeId: any) {
  const zwaveNode = this.getNode(nodeId)

  if (zwaveNode) {
    try {
      debug(`Assocaitions: Removing Node ${nodeId} from all associations`)
      await this.driver.controller.removeNodeFromAllAssocations(nodeId)
    } catch (error) {
      debug(
        `Error while removing Node ${nodeId} from all associations: ${error.message}`
      )
    }
  } else {
    debug(
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

  return this.nodes.map((n: any) => n.neighbors);
}

/**
 * Method used to start Zwave connection using configuration `port`
 */
ZwaveClient.prototype.connect = async function () {
  if (!this.driverReady) {
    let networkKey

    if (this.cfg.networkKey && this.cfg.networkKey.length === 32) {
      networkKey = Buffer.from(this.cfg.networkKey, 'hex')
    } else {
      networkKey = undefined
    }

    // init driver here because if connect fails the driver is destroyed
    this.driver = new Driver(this.cfg.port, {
      cacheDir: storeDir,
      networkKey: networkKey
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
ZwaveClient.prototype.emitEvent = function (evtName: any, data: any) {
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
ZwaveClient.prototype._setNodeName = async function (nodeid: any, name: any) {
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
ZwaveClient.prototype._setNodeLocation = async function (nodeid: any, loc: any) {
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
ZwaveClient.prototype._createScene = async function (label: any) {
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
ZwaveClient.prototype._removeScene = async function (sceneid: any) {
  const index = this.scenes.findIndex((s: any) => s.sceneid === sceneid)

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
ZwaveClient.prototype._setScenes = async function (scenes: any) {
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
ZwaveClient.prototype._sceneGetValues = function (sceneid: any) {
  const scene = this.scenes.find((s: any) => s.sceneid === sceneid)
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
  sceneid: any,
  valueId: any,
  value: any,
  timeout: any
) {
  const scene = this.scenes.find((s: any) => s.sceneid === sceneid)

  if (!scene) throw Error('No scene found with given sceneid')

  if (this.nodes.length < valueId.nodeId || !this.nodes[valueId.nodeId]) {
    throw Error(`Node ${valueId.nodeId} not found`)
  } else {
    // check if it is an existing valueid
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
    if (!this.nodes[valueId.nodeId].values[getValueID(valueId)]) {
      throw Error('No value found with given valueId')
    } else {
      // if this valueid is already in owr scene edit it else create new one
      const index = scene.values.findIndex((s: any) => s.id === valueId.id)

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
ZwaveClient.prototype._removeSceneValue = async function (sceneid: any, valueId: any) {
  const scene = this.scenes.find((s: any) => s.sceneid === sceneid)

  if (!scene) throw Error('No scene found with given sceneid')

  // get the index with also the node identifier as prefix
  const index = scene.values.findIndex((s: any) => s.id === valueId.id)

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
ZwaveClient.prototype._activateScene = function (sceneId: any) {
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
  const info = Object.assign({}, this.ozwConfig)

  info.uptime = process.uptime()
  info.lastUpdate = this.lastUpdate
  info.status = this.status
  info.cntStatus = this.cntStatus

  return info
}

ZwaveClient.prototype.startInclusion = async function (secure: any) {
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

ZwaveClient.prototype.healNode = async function (nodeId: any) {
  if (this.driver && !this.closed) {
    return this.driver.controller.healNode(nodeId)
  }

  throw Error('Driver is closed')
}

ZwaveClient.prototype.isFailedNode = async function (nodeId: any) {
  if (this.driver && !this.closed) {
    const node = this.nodes[nodeId]
    const zwaveNode = this.getNode(nodeId)

    if (!node || zwaveNode) {
      throw Error(`Node ${nodeId} not found`)
    }

    const result = await this.driver.controller.isFailedNode(nodeId)
    node.failed = result
    onNodeStatus.call(this, zwaveNode)
    return result
  }

  throw Error('Driver is closed')
}
ZwaveClient.prototype.removeFailedNode = async function (nodeId: any) {
  if (this.driver && !this.closed) {
    return this.driver.controller.removeFailedNode(nodeId)
  }

  throw Error('Driver is closed')
}

ZwaveClient.prototype.refreshInfo = async function (nodeId: any) {
  if (this.driver && !this.closed) {
    const zwaveNode = this.getNode(nodeId)

    if (!zwaveNode) {
      throw Error(`Node ${nodeId} not found`)
    }

    return zwaveNode.refreshInfo()
  }

  throw Error('Driver is closed')
}

ZwaveClient.prototype.beginFirmwareUpdate = async function (
  nodeId: any,
  data: any,
  target = 0
) {
  if (this.driver && !this.closed) {
    const zwaveNode = this.getNode(nodeId)

    if (!zwaveNode) {
      throw Error(`Node ${nodeId} not found`)
    }

    if (!(data instanceof Buffer)) {
      throw Error('Data must be a buffer')
    }

    return zwaveNode.beginFirmwareUpdate(data, target)
  }

  throw Error('Driver is closed')
}

ZwaveClient.prototype.abortFirmwareUpdate = async function (nodeId: any) {
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
// @ts-expect-error ts-migrate(7019) FIXME: Rest parameter 'args' implicitly has an 'any[]' ty... Remove this comment to see the full error message
ZwaveClient.prototype.callApi = async function (apiName: any, ...args) {
  let err, result

  if (this.driverReady) {
    try {
      // Replace failed node works just with failed nodes so update node failed status
      if (apiName === 'replaceFailedNode') {
        const nodeid = args[0]
        if (nodeid && this.nodes[nodeid]) {
          await this.isFailedNode(nodeid)
        }
      }

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
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
    const vId = getValueID(args[0])

    if (this.nodes[nId] && this.nodes[nId][vId]) {
      this.nodes[nId][vId].isPolled = this.driver.controller.isPolled(args[0])
    }
  }

  debug(result.message, apiName, result.result || '')

  // @ts-expect-error ts-migrate(2339) FIXME: Property 'args' does not exist on type '{ success:... Remove this comment to see the full error message
  result.args = args

  return result
}

/**
 * Set a value of a specific zwave valueId
 *
 * @param {Object} valueId Zwave valueId object
 * @param {Integer|String} value The value to send
 */
ZwaveClient.prototype.writeValue = async function (valueId: any, value: any) {
  if (this.driverReady) {
    let result = false

    if (valueId.type === 'number' && typeof value === 'string') {
      value = Number(value)
    }

    try {
      result = await this.getNode(valueId.nodeId).setValue(valueId, value)
    } catch (error) {
      debug(`Error while writing ${value} on ${valueId.id}: ${error.message}`)
    }
    // https://zwave-js.github.io/node-zwave-js/#/api/node?id=setvalue
    if (result === false) {
      debug(`Unable to write ${value} on ${valueId.id}`)
    }
  }
}

module.exports = ZwaveClient
