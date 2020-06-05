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

const ZWAVE_STATUS = {
  0: 'driverReady',
  1: 'connected',
  2: 'scanDone',
  5: 'driverFailed',
  6: 'closed'
}

const ZWAVE_LOG_FILE = utils.joinPath(storeDir, 'OZW_Log.txt')
const readFile = path =>
  new Promise((resolve, reject) =>
    fs.readFile(path, 'utf8', (err, data) =>
      err ? reject(err) : resolve(data)
    )
  )

// https://github.com/OpenZWave/open-zwave/wiki/Adding-Devices#configuration-variable-types
const VAR_TYPES = {
  bool: v => Boolean(v),
  byte: v => parseInt(v),
  int: v => parseInt(v),
  short: v => parseInt(v),
  decimal: v => +v.toString().replace(',', '.'),
  string: null,
  raw: null,
  list: null,
  bitset: (v, valueId) => {
    valueId.value = parseInt(v)
    var binaryValue = v.toString(2)

    if (binaryValue.length < 8) {
      binaryValue = '0'.repeat(8 - binaryValue.length) + binaryValue
    }
    for (const bit in valueId.bitSetIds) {
      valueId.bitSetIds[bit].value =
        binaryValue.charAt(8 - parseInt(bit)) === '1'
    }
    return valueId.value
  }
}

// Events to subscribe to
// Info at: https://github.com/OpenZWave/node-openzwave-shared/blob/master/src/callbacks.cc
const EVENTS = {
  'driver ready': driverReady,
  'driver failed': driverFailed,
  connected: connected,
  'node added': nodeAdded,
  'node removed': nodeRemoved,
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
  notification: notification,
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

  this.tail.on(
    'line',
    function (data) {
      data = data.substr(23)
      this.emitEvent(
        'DEBUG',
        '\x1b[36m' + 'OpenZWave' + '\x1b[0m' + data + '\n'
      )
    }.bind(this)
  )

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
    SaveConfiguration: Boolean(cfg.saveConfig),
    //  RetryTimeout: 10000,
    //  IntervalBetweenPolls: true,
    PollInterval: cfg.pollInterval,
    AutoUpdateConfigFile: Boolean(cfg.autoUpdateConfig)
    // SuppressValueRefresh: true,
  }

  if (cfg.networkKey) {
    options.NetworkKey = cfg.networkKey.replace(/\s/g, '')
  }

  if (cfg.configPath) {
    options.ConfigPath = cfg.configPath
  }

  if (cfg.assumeAwake) {
    options.AssumeAwake = cfg.assumeAwake
  }

  if (cfg.options) {
    Object.assign(options, cfg.options)
  }

  if (CLIENT) {
    this.client = CLIENT
    this.client.updateOptions(options)
  } else {
    this.client = CLIENT = new OpenZWave(options)
    if (cfg.plugin) {
      try {
        require(cfg.plugin)(this)
      } catch (error) {
        debug(`Error while loading ${cfg.plugin} plugin`, error.message)
      }
    }
  }

  this.nodes = []
  this.zwcfg_nodes = {}
  this.devices = {}
  this.ozwConfig = {}
  this.healTimeout = null

  var self = this
  Object.keys(EVENTS).forEach(function (evt) {
    self.client.on(evt, onEvent.bind(self, evt))
    self.client.on(evt, EVENTS[evt].bind(self))
  })
}

// ---------- ZWAVE EVENTS -------------------------------------

// catch all events
function onEvent (name, ...args) {
  this.lastUpdate = Date.now()
  this.emit('event', name, ...args)
}

async function driverReady (homeid) {
  this.driverReadyStatus = true
  this.ozwConfig.homeid = homeid
  var homeHex = '0x' + homeid.toString(16)
  this.ozwConfig.name = homeHex

  this.error = false
  this.status = ZWAVE_STATUS[0]

  this.zwcfg_nodes = jsonStore.get(store.nodes)

  // pre-load nodes properties by reading zwcfg xml file
  if (this.zwcfg_nodes.length === 0) {
    try {
      var zwcfg = await readFile(
        utils.joinPath(storeDir, 'zwcfg_' + homeHex + '.xml')
      )

      var matches
      // Fails if name or location contains " char
      var regex = /Node id="([\d]+)" name="([^"]*)" location="([^"]*)"/g
      // eslint-disable-next-line no-cond-assign
      while ((matches = regex.exec(zwcfg))) {
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
  this.status = ZWAVE_STATUS[5]
  debug('Driver failed', this.ozwConfig)
}

function connected (version) {
  this.ozwConfig.version = version
  debug('Zwave connected, Openzwave version:', version)
  this.status = ZWAVE_STATUS[1]

  this.emitEvent('CONNECTED', this.ozwConfig)
}

function nodeRemoved (nodeid) {
  // don't use splice here, nodeid equals to the index in the array
  var node = this.nodes[nodeid]
  if (node) {
    this.nodes[nodeid] = null
  }
  debug('Node removed', nodeid)

  this.emit('nodeRemoved', node)

  this.addEmptyNodes()
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
    neighborns: [],
    ready: false,
    available: false,
    hassDevices: {},
    failed: false,
    lastActive: null,
    status: NODE_STATUS[5] // dead
  }
  this.addEmptyNodes()
  debug('Node added', nodeid)
}

// Triggered after node added event when the node info are firstly loaded
// ATTENTION: Values not added yet here
function nodeAvailable (nodeid, nodeinfo) {
  var ozwnode = this.nodes[nodeid]
  if (ozwnode) {
    this.initNode(ozwnode, nodeinfo)
    debug(
      'node %d AVAILABLE: %s - %s (%s)',
      nodeid,
      nodeinfo.manufacturer,
      nodeinfo.product,
      nodeinfo.type || 'Unknown'
    )
  }
}

// Triggered after node available event when a value is added
function valueAdded (nodeid, comclass, valueId) {
  var ozwnode = this.nodes[nodeid]
  if (!ozwnode) {
    debug('ValueAdded: no such node: ' + nodeid, 'error')
  } else {
    // if (comclass === 0x86) {
    //   valueId = {
    //     "value_id": nodeid+"-112-1-48",
    //     "node_id": 5,
    //     "class_id": 112,
    //     "type": "bitset",
    //     "genre": "config",
    //     "instance": 1,
    //     "index": 48,
    //     "label": "Enable/disable to send a report on Threshold",
    //     "units": "",
    //     "help": "Enable/disable to send a report when the measurement is more than the upper limit value or less than the lower limit value. Note: If USB power, the Sensor will check the limit every 10 seconds. If battery power, the Sensor will check the limit when it is waken up.",
    //     "read_only": false,
    //     "write_only": false,
    //     "min": 0,
    //     "max": 0,
    //     "is_polled": false,
    //     "bitSetIds": {
    //       "1": {
    //         "help": "Lower Temperature Threshold",
    //         "label": "Lower Temperature",
    //         "value": false
    //       },
    //       "2": {
    //         "help": "Lower Humdity Threshold",
    //         "label": "Lower Humidity",
    //         "value": false
    //       },
    //       "3": {
    //         "help": "Lower Luminance Threshold",
    //         "label": "Lower Luminance",
    //         "value": false
    //       },
    //       "4": {
    //         "help": "Lower Ultraviolet Threshold",
    //         "label": "Lower Ultraviolet",
    //         "value": false
    //       },
    //       "5": {
    //         "help": "Upper Temerature Threshold",
    //         "label": "Upper Temperature",
    //         "value": false
    //       },
    //       "6": {
    //         "help": "Upper Humdity Threshold",
    //         "label": "Upper Humidity",
    //         "value": false
    //       },
    //       "7": {
    //         "help": "Upper Luminance Threshold",
    //         "label": "Upper Luminance",
    //         "value": false
    //       },
    //       "8": {
    //         "help": "Upper Ultraviolet Threshold",
    //         "label": "Upper Ultraviolet",
    //         "value": false
    //       }
    //     },
    //     "bitMask": 255,
    //     "value": 0
    //   }
    // }

    // if (comclass === 94 && valueId.instance === 1 && valueId.index === 0) {
    //   valueId = {
    //     'value_id': nodeid + '-49-1-1',
    //     'node_id': nodeid,
    //     'class_id': 49,
    //     'index': 1,
    //     'type': 'decimal',
    //     'genre': 'user',
    //     'instance': 1,
    //     'label': 'Temperature',
    //     'units': '°C',
    //     'help': 'Test temperature',
    //     'read_only': true,
    //     'write_only': false,
    //     'min': 0,
    //     'max': 40,
    //     'is_polled': false,
    //     'value': 28
    //   }
    // }

    parseValue(valueId)

    debug('ValueAdded: %s %s', valueId.value_id, valueId.label)
    var id = getValueID(valueId)

    ozwnode.values[id] = valueId

    if (comclass === 0x86 && valueId.index === 2) {
      // application version
      ozwnode.version = valueId.value
    }

    // check if node is added as secure node
    if (comclass === 0x98 && valueId.index === 0) {
      ozwnode.secure = valueId.value
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
    ozwnode.lastActive = Date.now()

    // add it to know devices types (if not already present)
    if (!this.devices[ozwnode.device_id]) {
      this.devices[ozwnode.device_id] = {
        name: `[${ozwnode.device_id}] ${ozwnode.product} (${ozwnode.manufacturer})`,
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

    debug(
      'node %d ready: %s - %s (%s)',
      nodeid,
      nodeinfo.manufacturer,
      nodeinfo.product,
      nodeinfo.type || 'Unknown'
    )
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
      debug(
        `zwave node ${nodeid}: changed: ${value_id}:${valueId.label}:${oldst} -> ${valueId.value}`
      )
      this.emit('valueChanged', valueId, ozwnode, oldst !== valueId.value)
    }
    // update cache
    ozwnode.values[value_id] = valueId
  }

  // check if node is added as secure node
  if (comclass === 0x98 && valueId.index === 0) {
    ozwnode.secure = valueId.value
    this.emit('nodeStatus', ozwnode)
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
    debug('ValueRemoved: %s from node %d', value_id, nodeid)
  } else {
    debug('ValueRemoved: no such node: ' + nodeid, 'error')
  }
}

function nodeEvent (nodeid, evtcode) {
  debug('node event', nodeid, evtcode)
  this.emit('nodeSceneEvent', 'node', this.nodes[nodeid], evtcode)
}

function sceneEvent (nodeid, sceneCode) {
  debug('scene event', nodeid, sceneCode)
  this.emit('nodeSceneEvent', 'scene', this.nodes[nodeid], sceneCode)
}

function notification (nodeid, notif, help) {
  var ozwnode = this.nodes[nodeid]
  switch (notif) {
    case 0: // message complete
    case 1: // timeout
    case 2: // nop
      break
    case 3: // awake
    case 4: // sleep
    case 5: // dead
    case 6: // alive
      // eslint-disable-next-line no-case-declarations
      const ready = notif !== 5
      // eslint-disable-next-line no-case-declarations
      const wasReady = ozwnode.ready

      if (ready || (!ready && wasReady)) {
        ozwnode.lastActive = Date.now()
      }

      if (ozwnode.available) {
        ozwnode.status = NODE_STATUS[notif]
        ozwnode.ready = ready

        this.emit('nodeStatus', ozwnode)
      }
  }

  debug('Notification from node %d: %s (%s)', nodeid, help, notif)
}

function scanComplete () {
  this.scanComplete = true

  this.status = ZWAVE_STATUS[2]

  var nodes = this.nodes.filter(n => !n.failed)

  // popolate groups (just for active nodes)
  for (var i = 0; i < nodes.length; i++) {
    this.getGroups(nodes[i].node_id)
    nodes[i].neighborns = this.client.getNodeNeighbors(nodes[i].node_id)
    if (this.cfg.refreshNodeInfo) {
      this.client.refreshNodeInfo(nodes[i].node_id)
    }
  }

  if (this.cfg.saveConfig && typeof this.client.writeConfig === 'function') {
    this.client.writeConfig()
  }

  this.scheduleHeal()

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

/**
 * Get the device id of a specific node
 *
 * @param {Object} ozwnode Zwave node Object
 * @returns A string in the format `<manufacturerId>-<productId>-<producttype>` that unique identifhy a zwave device
 */
function getDeviceID (ozwnode) {
  if (!ozwnode) return ''

  return `${parseInt(ozwnode.manufacturerid)}-${parseInt(
    ozwnode.productid
  )}-${parseInt(ozwnode.producttype)}`
}

/**
 * Used to parse a valueId value based on value type
 *
 * @param {Object} valueId Zwave valueId object
 */
function parseValue (valueId) {
  var fun = VAR_TYPES[valueId.type]
  if (fun) {
    valueId.value = fun(valueId.value, valueId)
  }
}

/**
 * Get a valueId from a valueId object
 *
 * @param {Object} v Zwave valueId object
 * @returns The value id without node reference: `${v.class_id}-${v.instance}-${v.index}`
 */
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

/**
 * Used to get unique homeHex of driver
 */
Object.defineProperty(ZwaveClient.prototype, 'homeHex', {
  get: function () {
    return this.ozwConfig.name
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

    this.emitEvent('NODE_UPDATED', node)
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

    this.emitEvent('NODE_UPDATED', node)
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
      delete this.zwcfg_nodes[nodeId].hassDevices
    } else {
      this.zwcfg_nodes[nodeId].hassDevices = devices
    }

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

  this.status = ZWAVE_STATUS[6]

  if (this.commandsTimeout) {
    this.stopControllerCommand()
  }

  if (this.connected && this.client) {
    if (this.cfg.saveConfig && typeof this.client.writeConfig === 'function') {
      this.client.writeConfig()
    }
    this.connected = false
    this.closed = true

    if (this.healTimeout) {
      clearTimeout(this.healTimeout)
      this.healTimeout = null
    }

    this.client.removeAllListeners()
    this.removeAllListeners()
    this.client.disconnect(this.cfg.port)
  }
}

ZwaveClient.prototype.getStatus = function () {
  var status = {}

  status.status = this.connected
  status.config = this.cfg

  return status
}

/**
 * Inits a Zwave node object with give nodeinfo object
 * Overrides `name` and `loc` properties and add node specific `hassDevices` using info stored in `nodes.json`
 * Calculates node `device_id`
 *
 * @param {Object} ozwnode The Node Zwave Object
 * @param {Object} nodeinfo Node Info Object
 */
ZwaveClient.prototype.initNode = function (ozwnode, nodeinfo) {
  var nodeid = ozwnode.node_id
  for (var attrname in nodeinfo) {
    // Use custom node naming and location
    if (attrname === 'name' || attrname === 'loc') {
      ozwnode[attrname] = this.zwcfg_nodes[nodeid]
        ? this.zwcfg_nodes[nodeid][attrname]
        : ''
    } else {
      ozwnode[attrname] = nodeinfo[attrname]
    }
  }

  if (this.zwcfg_nodes[nodeid] && this.zwcfg_nodes[nodeid].hassDevices) {
    ozwnode.hassDevices = copy(this.zwcfg_nodes[nodeid].hassDevices)
  }

  if (!this.zwcfg_nodes[nodeid]) this.zwcfg_nodes[nodeid] = {}

  ozwnode.status = NODE_STATUS[4] // sleeping
  ozwnode.available = true

  var deviceID = getDeviceID(ozwnode)
  ozwnode.device_id = deviceID

  // if scan is complete update node groups (for nodes added 'on fly')
  if (this.scanComplete) {
    this.getGroups(nodeid)
    ozwnode.neighborns = this.client.getNodeNeighbors(nodeid)
  }
}

/**
 * Used to replace `null` nodes in nodes Array
 *
 */
ZwaveClient.prototype.addEmptyNodes = function () {
  for (var i = 0; i < this.nodes.length; i++) {
    if (!this.nodes[i]) {
      this.nodes[i] = {
        node_id: i,
        type: i === 0 ? 'Main controller' : '',
        status: i === 0 ? '' : 'Removed',
        name: this.zwcfg_nodes[i] ? this.zwcfg_nodes[i].name : '',
        loc: this.zwcfg_nodes[i] ? this.zwcfg_nodes[i].loc : '',
        failed: true,
        values: {}
      }
    }
  }
}
/**
 * Popolate node `groups` property by creating an array of groups `{text: <groupLabel>, value: <groupIndex>}`
 *
 * @param {Integer} nodeID Zwave node id
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
 * Refresh all nodes neighborns
 *
 * @returns The nodes array where `node_id` is the array index and the value is the array
 * of neighburns of that `node_id`
 */
ZwaveClient.prototype.refreshNeighborns = function () {
  for (let i = 0; i < this.nodes.length; i++) {
    if (!this.nodes[i].failed) {
      this.nodes[i].neighborns = this.client.getNodeNeighbors(i)
    }
  }

  return this.nodes.map(n => n.neighborns)
}

/**
 * Method used to start Zwave connection using configuration `port`
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
  if (!this.zwcfg_nodes[nodeid]) this.zwcfg_nodes[nodeid] = {}

  if (this.nodes[nodeid]) this.nodes[nodeid].name = name
  else throw Error('Invalid Node ID')

  this.zwcfg_nodes[nodeid].name = name

  await jsonStore.put(store.nodes, this.zwcfg_nodes)

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
 * @param {Array} args Array or argument. Can be `[{valueid}, value, ?timeout]` or `[node_id, class_id, instance, index, value, ?timeout]`
 * @returns True if value is added without any error
 * @throws Error if args valueid isn't valid
 */
ZwaveClient.prototype._addSceneValue = async function (sceneid, ...args) {
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

  if (this.nodes.length < valueId.node_id || !this.nodes[valueId.node_id]) {
    throw Error('Node not found')
  } else {
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
 * Remove a value from scene
 *
 * @param {Integer} sceneid The scene id
 * @param {Array} args Array or argument. Can be `[{valueid}, value, ?timeout]` or `[node_id, class_id, instance, index, value, ?timeout]`
 * @returns True if value is removed without any error
 * @throws Error if args valueid isn't valid
 */
ZwaveClient.prototype._removeSceneValue = async function (sceneid, ...args) {
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

ZwaveClient.prototype.startInclusion = function (secure) {
  if (this.client && !this.closed) {
    if (this.commandsTimeout) {
      clearTimeout(this.commandsTimeout)
      this.commandsTimeout = null
    }

    this.commandsTimeout = setTimeout(
      this.stopControllerCommand.bind(this),
      this.cfg.commandsTimeout * 1000 || 30000
    )
    this.client.addNode(secure)
  }
}

ZwaveClient.prototype.startExclusion = function () {
  if (this.client && !this.closed) {
    if (this.commandsTimeout) {
      clearTimeout(this.commandsTimeout)
      this.commandsTimeout = null
    }

    this.commandsTimeout = setTimeout(
      this.stopControllerCommand.bind(this),
      this.cfg.commandsTimeout * 1000 || 30000
    )
    this.client.removeNode()
  }
}

ZwaveClient.prototype.stopControllerCommand = function () {
  if (this.client && !this.closed) {
    if (this.commandsTimeout) {
      clearTimeout(this.commandsTimeout)
      this.commandsTimeout = null
    }
    this.client.cancelControllerCommand()
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
      } else if (apiName === 'addNode') {
        apiName = 'startInclusion'
      } else if (apiName === 'removeNode') {
        apiName = 'startExclusion'
      } else if (apiName === 'cancelControllerCommand') {
        apiName = 'stopControllerCommand'
      }

      // ZwaveClient Apis that can be called with MQTT apis
      var curtomApis = [
        '_setNodeName',
        '_setNodeLocation',
        'refreshNeighborns',
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
        'stopControllerCommand'
      ]

      // Check if I need to call a ZwaveClient function or this.client function
      var useCustom =
        typeof this[apiName] === 'function' && curtomApis.indexOf(apiName) >= 0

      // Send raw data expects a buffer as the fifth argument, which JSON does not support, so we convert an array of bytes into a buffer.
      if (apiName === 'sendRawData') {
        args[4] = Buffer.from(args[4])
      }

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
  if (
    (apiName === 'enablePoll' || apiName === 'disablePoll') &&
    args[0] &&
    args[0].node_id
  ) {
    var nid = args[0].node_id
    var vid = getValueID(args[0])

    if (this.nodes[nid] && this.nodes[nid][vid]) {
      this.nodes[nid][vid].is_polled = this.client.isPolled(args[0])
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
ZwaveClient.prototype.writeValue = function (valueId, value) {
  if (this.connected) {
    try {
      this.client.setValue(valueId, value)
    } catch (error) {
      debug(
        `Error while writing ${value} on ${valueId.value_id}: ${error.message}`
      )
    }
  }
}

module.exports = ZwaveClient
