/* eslint-disable camelcase */
'use strict'

// eslint-disable-next-line one-var
var reqlib = require('app-root-path').require,
  OpenZWave = require('openzwave-shared'),
  utils = reqlib('/lib/utils.js'),
  EventEmitter = require('events'),
  fs = require('fs'),
  jsonStore = reqlib('/lib/jsonStore.js'),
  store = reqlib('config/store.js'),
  storeDir = utils.joinPath(true, reqlib('config/app.js').storeDir),
  debug = reqlib('/lib/debug')('Zwave'),
  Tail = require('tail').Tail,
  inherits = require('util').inherits

debug.color = 4

// eslint-disable-next-line no-unused-vars
const nop = () => { }
const ZWAVE_LOG_FILE = utils.joinPath(storeDir, 'OZW_Log.txt')
const readFile = (path) => new Promise((resolve, reject) => fs.readFile(path, 'utf8', (err, data) => err ? reject(err) : resolve(data)))

// https://github.com/OpenZWave/open-zwave/wiki/Adding-Devices#configuration-variable-types
const VAR_TYPES = {
  'bool': Boolean,
  'byte': parseInt,
  'int': parseInt,
  'short': parseInt,
  'decimal': (v) => +v.toString().replace(',', '.'),
  'string': null,
  'raw': null,
  'list': null
}

// Events to subscribe to
// Info at: https://github.com/OpenZWave/node-openzwave-shared/blob/master/src/callbacks.cc
const EVENTS = {
  'driver ready': driverReady,
  'driver failed': driverFailed,
  'node added': nodeAdded,
  'node removed': nodeRemoved,
  // 'node reset': nop,
  'node available': nodeAvailable,
  'node ready': nodeReady,
  // 'node naming': nop,
  'node event': nodeEvent,
  // 'polling disabled': nop,
  // 'polling enabled': nop,
  // 'create button': nop,
  // 'delete button': nop,
  // 'button on': nop,
  // 'button off': nop,
  'scene event': sceneEvent,
  'value added': valueAdded,
  'value changed': valueChanged,
  'value removed': valueRemoved,
  'value refreshed': valueChanged,
  'notification': notification,
  'scan complete': scanComplete,
  'controller command': controllerCommand
}

// Status based on notification
const NODE_STATUS = {
  3: 'Awake',
  4: 'Sleep',
  5: 'Dead',
  6: 'Alive'
}

// the singleton client connection instance
var CLIENT

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

async function init (cfg, socket) {
  this.cfg = cfg
  this.socket = socket

  // create file if doesn't exist
  fs.writeFileSync(ZWAVE_LOG_FILE, '')
  this.tail = new Tail(ZWAVE_LOG_FILE)

  this.tail.on('line', function (data) {
    data = data.substr(23)
    this.emitEvent('DEBUG', '\x1b[36m' + 'OpenZWave' + '\x1b[0m' + data + '\n')
  }.bind(this))

  this.tail.on('error', function (error) {
    debug('Error while tailing log file ', error)
  })

  this.closed = false
  this.scenes = jsonStore.get(store.scenes)

  // Full option list: https://github.com/OpenZWave/open-zwave/wiki/Config-Options
  var options = {
    Logging: cfg.logging,
    ConsoleOutput: cfg.logging,
    QueueLogLevel: cfg.logging ? 8 : 6,
    UserPath: storeDir, // where to store config files
    DriverMaxAttempts: 9999,
    SaveConfiguration: cfg.saveConfig,
    //  RetryTimeout: 10000,
    //  IntervalBetweenPolls: true,
    PollInterval: cfg.pollInterval
    // SuppressValueRefresh: true,
  }

  if (cfg.networkKey) {
    options.NetworkKey = cfg.networkKey
  }

  if (cfg.configPath) {
    options.ConfigPath = cfg.configPath
  }

  if (cfg.assumeAwake) {
    options.AssumeAwake = cfg.assumeAwake
  }

  if (CLIENT) {
    this.client = CLIENT
    this.client.updateOptions(options)
  } else {
    this.client = CLIENT = new OpenZWave(options)
  }

  this.nodes = []
  this.zwcfg_nodes = {}
  this.devices = {}
  this.ozwConfig = {}

  var self = this
  Object.keys(EVENTS).forEach(function (evt) {
    self.client.on(evt, EVENTS[evt].bind(self))
  })
}

async function driverReady (homeid) {
  this.driverReadyStatus = true
  this.ozwConfig.homeid = homeid
  var homeHex = '0x' + homeid.toString(16)
  this.ozwConfig.name = homeHex

  this.error = false

  this.zwcfg_nodes = jsonStore.get(store.nodes)

  // pre-load nodes properties by reading zwcfg xml file
  if (this.zwcfg_nodes.length === 0) {
    try {
      var zwcfg = await readFile(utils.joinPath(storeDir, 'zwcfg_' + homeHex + '.xml'))

      var matches
      // Fails if name or location contains " char
      var regex = /Node id="([\d]+)" name="([^"]*)" location="([^"]*)"/g
      // eslint-disable-next-line no-cond-assign
      while (matches = regex.exec(zwcfg)) {
        var nodeID = parseInt(matches[1])
        var name = matches[2] || ''
        var loc = matches[3] || ''

        // this call is async so it is possible that node has been already added
        if (this.nodes[nodeID]) {
          this.nodes[nodeID].name = name
          this.nodes[nodeID].loc = loc
        }

        this.zwcfg_nodes[nodeID] = {}
        this.zwcfg_nodes[nodeID].name = name
        this.zwcfg_nodes[nodeID].loc = loc
      }

      // update in memory file
      if (this.zwcfg_nodes.length > 0) {
        await jsonStore.put(store.nodes, this.zwcfg_nodes)
      }
    } catch (error) {
      debug('Error while reading zwcfg file', error.message)
    }
  }

  this.emitEvent('DRIVER_READY', this.ozwConfig)

  debug('Scanning network with homeid:', homeHex)

  // delete any previous existing config
  if (!this.cfg.saveConfig) {
    fs.readdir(storeDir, (err, files) => {
      if (err) debug('Error while reading configuration dir', err.message)
      else {
        files.forEach(file => {
          if (/zwcfg_[\w]+.xml/g.test(file) || file === 'zwscene.xml') {
            fs.unlinkSync(utils.joinPath(storeDir, file))
          }
        })
      }
    })
  }
}

function driverFailed () {
  this.error = 'Driver failed'
  debug('Driver failed', this.ozwConfig)
}

function nodeRemoved (nodeid) {
  // don't use splice here, nodeid equals to the index in the array
  if (this.nodes[nodeid]) {
    this.nodes[nodeid] = null
  }
  debug('Node removed', nodeid)

  addEmptyNodes(this.nodes)
  this.emitEvent('NODE_REMOVED', this.nodes[nodeid])
}

// Triggered when a node is added
function nodeAdded (nodeid) {
  this.nodes[nodeid] = {
    node_id: nodeid,
    device_id: '',
    manufacturer: '',
    manufacturerid: '',
    product: '',
    producttype: '',
    productid: '',
    type: '',
    name: this.zwcfg_nodes[nodeid] ? this.zwcfg_nodes[nodeid].name : '',
    loc: this.zwcfg_nodes[nodeid] ? this.zwcfg_nodes[nodeid].loc : '',
    values: {},
    groups: [],
    ready: false,
    available: false,
    hassDevices: {},
    failed: false,
    status: NODE_STATUS[5] // dead
  }
  addEmptyNodes(this.nodes)
  debug('Node added', nodeid)
}

// Triggered after node added event when the node info are firstly loaded
// ATTENTION: Values not added yet here
function nodeAvailable (nodeid, nodeinfo) {
  var ozwnode = this.nodes[nodeid]
  if (ozwnode) {
    this.initNode(ozwnode, nodeinfo)
    debug('node %d AVAILABLE: %s - %s (%s)', nodeid, nodeinfo.manufacturer, nodeinfo.product, (nodeinfo.type || 'Unknown'))
  }
}

// Triggered after node available event when a value is added
function valueAdded (nodeid, comclass, valueId) {
  var ozwnode = this.nodes[nodeid]
  if (!ozwnode) {
    debug('ValueAdded: no such node: ' + nodeid, 'error')
  } else {
    parseValue(valueId)
    debug('ValueAdded: %s %s', valueId.value_id, valueId.label)
    var id = getValueID(valueId)
    if (valueId.type === 'list') {
      for (let i = 0; i < valueId.values.length; i++) {
        let fix = valueId.values[i].indexOf('|') >= 0
        if (fix) valueId.values[i] = valueId.values[i].split('|').pop()
      }
    }
    ozwnode.values[id] = valueId

    if (comclass === 0x86) { // version
      ozwnode.version = valueId.value
    }

    this.emit('valueChanged', valueId, ozwnode)
  }
}

// Triggered after all values have been added
function nodeReady (nodeid, nodeinfo) {
  var ozwnode = this.nodes[nodeid]
  if (ozwnode) {
    // When a node is added 'on fly' it never triggers 'node available'
    if (!ozwnode.available) {
      this.initNode(ozwnode, nodeinfo)
    }

    ozwnode.ready = true
    ozwnode.status = NODE_STATUS[6]

    // add it to know devices types (if not already present)
    if (!this.devices[ozwnode.device_id]) {
      this.devices[ozwnode.device_id] = {
        name: `${ozwnode.product} (${ozwnode.manufacturer})`,
        values: JSON.parse(JSON.stringify(ozwnode.values))
      }

      // remove node specific info from values
      for (var v in this.devices[ozwnode.device_id].values) {
        var tmp = this.devices[ozwnode.device_id].values[v]
        delete tmp.node_id
        delete tmp.hassDevices
        tmp.value_id = getValueID(tmp)
      }
    }

    // Update values and subscribe for changes
    for (const id in ozwnode.values) {
      this.emit('valueChanged', ozwnode.values[id], ozwnode)
    }

    this.emit('nodeStatus', ozwnode)

    debug('node %d ready: %s - %s (%s)', nodeid, nodeinfo.manufacturer, nodeinfo.product, (nodeinfo.type || 'Unknown'))
  }
}

// Triggered when a node is ready and a value changes
function valueChanged (nodeid, comclass, valueId) {
  var ozwnode = this.nodes[nodeid]
  var value_id = getValueID(valueId)

  parseValue(valueId)

  if (!ozwnode) {
    debug('valueChanged: no such node: ' + nodeid, 'error')
  } else {
    var oldst
    if (ozwnode.ready) {
      oldst = ozwnode.values[value_id].value
      debug(`zwave node ${nodeid}: changed: ${value_id}:${valueId.label}:${oldst} -> ${valueId.value}`)
      this.emit('valueChanged', valueId, ozwnode, oldst !== valueId.value)
    }
    // update cache
    ozwnode.values[value_id] = valueId
  }
}

function valueRemoved (nodeid, comclass, instance, index) {
  var ozwnode = this.nodes[nodeid]
  var value_id = getValueID({
    class_id: comclass,
    instance: instance,
    index: index
  })
  if (ozwnode.values[value_id]) {
    delete ozwnode.values[value_id]
  } else {
    debug('valueRemoved: no such node: ' + nodeid, 'error')
  }
}

function nodeEvent (nodeid, evtcode) {
  debug('node event', nodeid, evtcode)
  this.emit('event', 'node', this.nodes[nodeid], evtcode)
}

function sceneEvent (nodeid, sceneCode) {
  debug('scene event', nodeid, sceneCode)
  this.emit('event', 'scene', this.nodes[nodeid], sceneCode)
}

function notification (nodeid, notif, help) {
  // eslint-disable-next-line no-unused-vars
  var msg
  var ozwnode = this.nodes[nodeid]
  switch (notif) {
    case 0:
      msg = 'node' + nodeid + ': message complete'
      break
    case 1:
      msg = 'node' + nodeid + ': timeout'
      break
    case 2:
      msg = 'node' + nodeid + ': nop'
      break
    case 3: // awake
    case 4: // sleep
    case 5: // dead
    case 6: // alive
      msg = 'node' + nodeid + ': node ' + NODE_STATUS[notif]
      ozwnode.status = NODE_STATUS[notif]
      ozwnode.ready = notif !== 5

      this.emit('nodeStatus', ozwnode)
      break
    default:
      msg = 'Unknown notification code ' + notif
  }

  debug('Notification from node %d: %s (%s)', nodeid, help, notif)
}

function scanComplete () {
  this.scanComplete = true

  var nodes = this.nodes.filter(n => !n.failed)

  // popolate groups (just for active nodes)
  for (var i = 0; i < nodes.length; i++) {
    this.getGroups(nodes[i].node_id)
  }

  debug('Network scan complete. Found:', nodes.length, 'nodes')
}

function controllerCommand (nodeid, state, errcode, help) {
  var obj = {
    nodeid: nodeid,
    state: state,
    errcode: errcode,
    help: help.replace('ControllerCommand - ', '')
  }
  debug('controller command', obj)

  this.cntStatus = obj.help

  // NodeFailed
  if (errcode === 0 && state === 10) {
    nodeRemoved.call(this, nodeid)
  }

  this.emitEvent('CONTROLLER_CMD', obj)
}

// ------- Utils ------------------------

function getDeviceID (ozwnode) {
  if (!ozwnode) return ''

  return `${parseInt(ozwnode.manufacturerid)}-${parseInt(ozwnode.productid)}-${parseInt(ozwnode.producttype)}`
}

function addEmptyNodes (nodes) {
  for (var i = 0; i < nodes.length; i++) {
    if (!nodes[i]) {
      nodes[i] = {
        node_id: i,
        type: i === 0 ? 'Main controller' : '',
        status: i === 0 ? '' : 'Removed',
        failed: true
      }
    }
  }
}

function parseValue (valueId) {
  var fun = VAR_TYPES[valueId.type]
  if (fun) {
    valueId.value = fun(valueId.value)
  }
}

function getValueID (v) {
  return `${v.class_id}-${v.instance}-${v.index}`
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

ZwaveClient.prototype.updateDevice = function (hassDevice, nodeId, deleteDevice) {
  var node = nodeId >= 0 ? this.nodes[nodeId] : null
  if (node && hassDevice.id && node.hassDevices[hassDevice.id]) {
    if (deleteDevice) {
      delete node.hassDevices[hassDevice.id]
    } else {
      var id = hassDevice.id
      delete hassDevice.id
      node.hassDevices[id] = hassDevice
    }

    this.emitEvent('NODE_UPDATED', node)
  }
}

ZwaveClient.prototype.storeDevices = async function (devices, nodeId) {
  var node = this.nodes[nodeId]

  if (node) {
    for (const id in devices) {
      devices[id].persistent = true
    }

    this.zwcfg_nodes[nodeId].hassDevices = devices
    node.hassDevices = copy(devices)
    await jsonStore.put(store.nodes, this.zwcfg_nodes)

    this.emitEvent('NODE_UPDATED', node)
  }
}

/**
 * Method used to close client connection, use this before destroy
 */
ZwaveClient.prototype.close = function () {
  if (this.tail) {
    this.tail.unwatch()
  }

  if (this.connected && this.client) {
    this.connected = false
    this.closed = true
    this.client.removeAllListeners()
    this.removeAllListeners()
    this.client.disconnect(this.cfg.port)
  }
}

/**
 * Used to init a node once nodeinfo are ready
 *
 */
ZwaveClient.prototype.initNode = function (ozwnode, nodeinfo) {
  var nodeid = ozwnode.node_id
  for (var attrname in nodeinfo) {
    // Use custom node naming and location
    if (attrname === 'name' || attrname === 'loc') {
      ozwnode[attrname] = this.zwcfg_nodes[nodeid] ? this.zwcfg_nodes[nodeid][attrname] : ''
    } else {
      ozwnode[attrname] = nodeinfo[attrname]
    }
  }

  if (this.zwcfg_nodes[nodeid] && this.zwcfg_nodes[nodeid].hassDevices) {
    ozwnode.hassDevices = copy(this.zwcfg_nodes[nodeid].hassDevices)
  }

  ozwnode.status = NODE_STATUS[4] // sleeping
  ozwnode.available = true

  var deviceID = getDeviceID(ozwnode)
  ozwnode.device_id = deviceID

  // if scan is complete update node groups (for nodes added 'on fly')
  if (this.scanComplete) {
    this.getGroups(nodeid)
  }
}

/**
 * Method used to get nodeID groups
 */
ZwaveClient.prototype.getGroups = function (nodeID) {
  if (this.nodes[nodeID]) {
    var numGrups = this.client.getNumGroups(nodeID)
    for (var n = 0; n < numGrups; n++) {
      var label = this.client.getGroupLabel(nodeID, n + 1)
      this.nodes[nodeID].groups.push({
        text: label,
        value: n + 1
      })
    }
  }
}

/**
 * Method used to close client connection, use this before destroy
 */
ZwaveClient.prototype.connect = function () {
  if (!this.connected) {
    debug('Connecting to', this.cfg.port)
    this.client.connect(this.cfg.port)
    this.connected = true
  } else {
    debug('Client already connected to', this.cfg.port)
  }
}

/**
 * Method used to emit zwave events to the socket
 */
ZwaveClient.prototype.emitEvent = function (evtName, data) {
  if (this.socket) {
    this.socket.emit(evtName, data)
  }
}

// ------------NODES MANAGEMENT-----------------------------------

ZwaveClient.prototype.setNodeName = async function (nodeid, name) {
  if (!this.zwcfg_nodes[nodeid]) this.zwcfg_nodes[nodeid] = {}

  if (this.nodes[nodeid]) this.nodes[nodeid].name = name
  else throw Error('Invalid Node ID')

  this.zwcfg_nodes[nodeid].name = name

  await jsonStore.put(store.nodes, this.zwcfg_nodes)

  this.emit('nodeStatus', this.nodes[nodeid])

  return true
}

ZwaveClient.prototype.setNodeLocation = async function (nodeid, loc) {
  if (!this.zwcfg_nodes[nodeid]) this.zwcfg_nodes[nodeid] = {}

  if (this.nodes[nodeid]) this.nodes[nodeid].loc = loc
  else throw Error('Invalid Node ID')

  this.zwcfg_nodes[nodeid].loc = loc

  await jsonStore.put(store.nodes, this.zwcfg_nodes)

  this.emit('nodeStatus', this.nodes[nodeid])

  return true
}

// ------------SCENES MANAGEMENT-----------------------------------

/**
 * Create a new scene with a label
 */
ZwaveClient.prototype.createScene = async function (label) {
  var id = this.scenes.length > 0 ? this.scenes[this.scenes.length - 1].sceneid + 1 : 1
  this.scenes.push({
    sceneid: id,
    label: label,
    values: []
  })

  await jsonStore.put(store.scenes, this.scenes)

  return true
}

/**
 * Delete a scene
 */
ZwaveClient.prototype.removeScene = async function (sceneid) {
  var index = this.scenes.findIndex(s => s.sceneid === sceneid)

  if (index < 0) throw Error('No scene found with given sceneid')

  this.scenes.splice(index, 1)

  await jsonStore.put(store.scenes, this.scenes)

  return true
}

/**
 * Update scenes (NOT A ZWAVE API)
 */
ZwaveClient.prototype.setScenes = async function (scenes) {
  // TODO: add scenes validation
  this.scenes = scenes
  await jsonStore.put(store.scenes, this.scenes)

  return scenes
}

/**
 * Get all scenes
 */
ZwaveClient.prototype.getScenes = function () {
  return this.scenes
}

/**
 * Get scene values
 */
ZwaveClient.prototype.sceneGetValues = function (sceneid) {
  var scene = this.scenes.find(s => s.sceneid === sceneid)
  if (!scene) throw Error('No scene found with given sceneid')
  return scene.values
}

/**
 * Add a value to a scene
 * args can be [{valueid}, value, ?timeout] or
 * [node_id, class_id, instance, index, value, ?timeout]
 */
ZwaveClient.prototype.addSceneValue = async function (sceneid, ...args) {
  var valueId
  var value
  var timeout
  var scene = this.scenes.find(s => s.sceneid === sceneid)

  if (!scene) throw Error('No scene found with given sceneid')

  if (typeof args[0] === 'object' && args.length >= 2) {
    valueId = args[0]
    value = args[1]
    timeout = args[2]
  } else if (args.length >= 5) {
    valueId = {
      node_id: args[0],
      class_id: args[1],
      instance: args[2],
      index: args[3]
    }
    value = args[4]
    timeout = args[5]
  } else {
    throw Error('No valueId found in parameters')
  }

  if (this.nodes.length < valueId.node_id || !this.nodes[valueId.node_id]) throw Error('Node not found')
  else {
    // get the valueId object with all properties
    valueId = this.nodes[valueId.node_id].values[getValueID(valueId)]

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
 * Remove a value from a scene
 * args can be [{valueid}] or
 * [node_id, class_id, instance, index]
 */
ZwaveClient.prototype.removeSceneValue = async function (sceneid, ...args) {
  var valueId
  var scene = this.scenes.find(s => s.sceneid === sceneid)

  if (!scene) throw Error('No scene found with given sceneid')

  if (args.length === 1) {
    valueId = args[0]
  } else if (args.length === 4) {
    valueId = {
      node_id: args[0],
      class_id: args[1],
      instance: args[2],
      index: args[3]
    }
  } else {
    throw Error('No valueId found in parameters')
  }

  // here I don't fetch the valueId obj from nodes because
  // it's possible that the scene contains
  // a value of a node that doesn't exist anymore
  var id = valueId.node_id + '-' + getValueID(valueId)

  var index = scene.values.findIndex(s => s.value_id === id)

  if (index < 0) throw Error('No valueid match found in given scene')
  else {
    scene.values.splice(index, 1)
  }

  await jsonStore.put(store.scenes, this.scenes)

  return true
}

/**
 * Activate a scene by its id (fix for activateScene not working properly)
 */
ZwaveClient.prototype.activateScene = function (sceneId) {
  var values = this.sceneGetValues(sceneId)

  // eslint-disable-next-line no-unmodified-loop-condition
  for (var i = 0; values && i < values.length; i++) {
    var fun = wrapFunction(this.client.setValue, this.client, [values[i], values[i].value])
    setTimeout(fun, values[i].timeout ? values[i].timeout * 1000 : 0)
  }

  return true
}

/**
 * Method used to close call an API of zwave client
 */
ZwaveClient.prototype.callApi = async function (apiName, ...args) {
  var err, result

  if (this.connected) {
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
      // Check if I need to call a zwave client function or a custom function
      var useCustom = typeof this[apiName] === 'function' && (apiName.toLowerCase().includes('scene') || apiName === 'setNodeName' || apiName === 'setNodeLocation')

      if (useCustom) {
        result = await this[apiName](...args)
        // custom scenes and node/location management
      } else if (typeof this.client[apiName] === 'function') {
        result = this.client[apiName](...args)
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

  // update is_polled flag of values
  if ((apiName === 'enablePoll' || apiName === 'disablePoll') && args[0] && args[0].node_id) {
    var nid = args[0].node_id
    var vid = getValueID(args[0])

    if (this.nodes[nid] && this.nodes[nid][vid]) {
      this.nodes[nid][vid].is_polled = this.client.isPolled(args[0])
    }
  }

  debug(result.message, apiName, result.result || '')

  return result
}

/**
 * Method used to write a value to zwave network
 */
ZwaveClient.prototype.writeValue = function (valueId, value) {
  if (this.connected) {
    this.client.setValue(valueId, value)
  }
}

module.exports = ZwaveClient
