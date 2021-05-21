/* eslint-disable camelcase */
'use strict'

// eslint-disable-next-line one-var
const reqlib = require('app-root-path').require
const {
  Driver,
  NodeStatus,
  InterviewStage,
  extractFirmware,
  guessFirmwareFileFormat,
  libVersion
} = require('zwave-js')
const { CommandClasses, Duration, ZWaveErrorCodes } = require('@zwave-js/core')
const utils = reqlib('/lib/utils.js')
const EventEmitter = require('events')
const jsonStore = reqlib('/lib/jsonStore.js')
const { socketEvents } = reqlib('/lib/SocketManager.js')
const store = reqlib('config/store.js')
const { storeDir } = reqlib('config/app.js')
const LogManager = require('./logger.js')
const logger = LogManager.module('Zwave')
const loglevels = require('triple-beam').configs.npm.levels
const { ZwavejsServer, serverVersion } = require('@zwave-js/server')
const pkgjson = require('../package.json')

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

// ZwaveClient Apis that can be called with MQTT apis
const allowedApis = [
  'setNodeName',
  'setNodeLocation',
  '_createScene',
  '_removeScene',
  '_setScenes',
  '_getScenes',
  '_sceneGetValues',
  '_addSceneValue',
  '_removeSceneValue',
  '_activateScene',
  'refreshNeighbors',
  'getNodeNeighbors',
  'getAssociations',
  'addAssociations',
  'removeAssociations',
  'removeAllAssociations',
  'removeNodeFromAllAssociations',
  'getNodes',
  'getInfo',
  'refreshValues',
  'refreshCCValues',
  'pollValue',
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
  'sendCommand',
  'writeValue',
  'writeBroadcast',
  'writeMulticast',
  'driverFunction',
  'checkForConfigUpdates',
  'installConfigUpdate'
]

const ZWAVEJS_LOG_FILE = utils.joinPath(storeDir, `zwavejs_${process.pid}.log`)

/**
 * The constructor
 *
 * @param {import('../types/index.js').ZwaveConfig} config
 * @param {Socket} socket
 * @returns {import('../types/index.js').ZwaveClient}
 */
class ZwaveClient extends EventEmitter {
  constructor (config, socket) {
    super()

    this.cfg = config
    this.socket = socket

    this.statelessTimeouts = {}
    this.pollIntervals = {}

    this.closed = false
    this.driverReady = false
    this.scenes = jsonStore.get(store.scenes)

    config.networkKey = config.networkKey || process.env.NETWORK_KEY

    this.nodes = new Map()
    this.storeNodes = jsonStore.get(store.nodes)

    // convert store nodes from array to object
    if (Array.isArray(this.storeNodes)) {
      const storeNodes = {}

      for (let i = 0; i < this.storeNodes.length; i++) {
        if (this.storeNodes[i]) {
          storeNodes[i] = this.storeNodes[i]
        }
      }

      this.storeNodes = storeNodes

      jsonStore.put(store.nodes, storeNodes).catch(err => {
        logger.error('Error while updating store nodes', err)
      })
    }

    this.devices = {}
    this.driverInfo = {}
    this.healTimeout = null

    this.status = ZWAVE_STATUS.closed
  }

  get homeHex () {
    return this.driverInfo.name
  }

  /**
   * Used to schedule next network heal at hours: cfg.healHours
   */
  scheduleHeal () {
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
   * @param {number} nodeId
   * @returns {import('zwave-js').ZWaveNode}
   */
  getNode (nodeId) {
    return this.driver.controller.nodes.get(nodeId)
  }

  /**
   * Returns the driver ZWaveNode ValueId object or null
   *
   * @param idString the valueId string id
   * @returns {ValueID} zwavejs valueid
   */
  getZwaveValue (idString) {
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
  heal () {
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
   * @param {HassDevice} hassDevice The Hass device
   * @param {number} nodeId The nodeid
   * @param {boolean} deleteDevice True to remove the hass device from node hass devices
   */
  updateDevice (hassDevice, nodeId, deleteDevice) {
    const node = this.nodes.get(nodeId)

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
   * @param {HassDevice} hassDevice The Hass device
   * @param {number} nodeId The nodeid
   */
  addDevice (hassDevice, nodeId) {
    const node = this.nodes.get(nodeId)

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
   * @param {Map<string, import('../types/index.js').HassDevice>} devices List of devices `"<deviceId>" : <deviceObject>`
   * @param {number} nodeId The node to send this devices
   * @param {boolean} remove If we should remove this device from store
   */
  async storeDevices (devices, nodeId, remove) {
    const node = this.nodes.get(nodeId)

    if (node) {
      for (const id in devices) {
        devices[id].persistent = !remove
      }

      if (remove) {
        delete this.storeNodes[nodeId].hassDevices
      } else {
        this.storeNodes[nodeId].hassDevices = devices
      }

      node.hassDevices = utils.copy(devices)
      await jsonStore.put(store.nodes, this.storeNodes)

      this.sendToSocket(socketEvents.nodeUpdated, node)
    }
  }

  /**
   * Method used to close client connection, use this before destroy
   */
  async close () {
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

    if (this.updatesCheckTimeout) {
      clearTimeout(this.updatesCheckTimeout)
      this.updatesCheckTimeout = null
    }

    if (this.statelessTimeouts) {
      for (const k in this.statelessTimeouts) {
        clearTimeout(this.statelessTimeouts[k])
        delete this.statelessTimeouts[k]
      }
    }

    if (this.pollIntervals) {
      for (const k in this.pollIntervals) {
        clearTimeout(this.pollIntervals[k])
        delete this.pollIntervals[k]
      }
    }

    if (this.server) {
      await this.server.destroy()
    }

    if (this.driver) {
      this.driverReady = false
      this.removeAllListeners()
      await this.driver.destroy()
    }

    logger.info('Client closed')
  }

  getStatus () {
    const status = {}

    status.driverReady = this.driverReady
    status.status = this.driverReady && !this.closed
    status.config = this.cfg

    return status
  }

  /**
   * Popolate node `groups`
   *
   * @param {number} nodeId Zwave node id
   */
  async getGroups (nodeId, ignoreUpdate = false) {
    const zwaveNode = this.getNode(nodeId)
    const node = this.nodes.get(nodeId)
    if (node && zwaveNode) {
      let endpointGroups = []
      try {
        endpointGroups = await this.driver.controller.getAllAssociationGroups(
          nodeId
        )
      } catch (error) {
        logger.warn(
          `Node ${nodeId} error while fetching groups associations: ` +
            error.message
        )
      }
      for (const [endpoint, groups] of endpointGroups) {
        for (const [groupIndex, group] of groups) {
          // https://zwave-js.github.io/node-zwave-js/#/api/controller?id=associationgroup-interface
          node.groups.push({
            text: group.label,
            endpoint: endpoint,
            value: groupIndex,
            maxNodes: group.maxNodes,
            isLifeline: group.isLifeline,
            multiChannel: group.multiChannel
          })
        }
      }
    }

    if (!ignoreUpdate) {
      this._onNodeStatus(zwaveNode)
    }
  }

  /**
   * Get current associations of a specific group
   *
   * @param {number} nodeId Zwave node id
   * @returns {import('zwave-js').AssociationAddress[]} The array of associations
   */
  async getAssociations (nodeId) {
    const zwaveNode = this.getNode(nodeId)
    const toReturn = []

    if (zwaveNode) {
      try {
        // https://zwave-js.github.io/node-zwave-js/#/api/controller?id=association-interface
        // the result is a map where the key is the group number and the value is the array of associations {nodeId, endpoint?}
        const result = await this.driver.controller.getAllAssociations(nodeId)
        for (const [source, group] of result.entries()) {
          for (const [groupId, associations] of group) {
            for (const a of associations) {
              toReturn.push({
                endpoint: source.endpoint,
                groupId: groupId,
                nodeId: a.nodeId,
                targetEndpoint: a.endpoint
              })
            }
          }
        }
      } catch (error) {
        logger.warn(
          `Error while looking for Node ${nodeId}
          associations: ${error.message}`
        )
        // node doesn't support groups associations
      }
    } else {
      logger.warn(`Node ${nodeId} not found when calling 'getAssociations'`)
    }

    return toReturn
  }

  /**
   * Add a node to an association group
   *
   * @param {import('zwave-js').AssociationAddress} source Zwave node id
   * @param {number} groupId Zwave node group Id
   * @param {import('zwave-js').AssociationAddress[]} associations Array of associations
   */
  async addAssociations (source, groupId, associations) {
    const zwaveNode = this.getNode(source.nodeId)

    const sourceMsg = `Node ${source.nodeId +
      (source.endpoint ? ' Endpoint ' + source.endpoint : '')}`

    if (zwaveNode) {
      try {
        for (const a of associations) {
          if (this.driver.controller.isAssociationAllowed(source, groupId, a)) {
            logger.info(
              `Assocaitions: Adding Node ${a.nodeId} to Group ${groupId} of ${sourceMsg}`
            )
            await this.driver.controller.addAssociations(source, groupId, [a])
          } else {
            logger.warn(
              `Associations: Unable to add Node ${a.nodeId} to Group ${groupId} of ${sourceMsg}`
            )
          }
        }
      } catch (error) {
        logger.warn(
          `Error while adding associations to ${sourceMsg}: ${error.message}`
        )
      }
    } else {
      logger.warn(
        `Node ${source.nodeId} not found when calling 'addAssociations'`
      )
    }
  }

  /**
   * Remove a node from an association group
   *
   * @param {import('zwave-js').AssociationAddress} source Zwave node id
   * @param {number} groupId Zwave node group Id
   * @param {import('zwave-js').AssociationAddress[]} associations Array of associations
   */
  async removeAssociations (source, groupId, associations) {
    const zwaveNode = this.getNode(source.nodeId)

    const sourceMsg = `Node ${source.nodeId +
      (source.endpoint ? ' Endpoint ' + source.endpoint : '')}`

    if (zwaveNode) {
      try {
        logger.log(
          'info',
          `Assocaitions: Removing associations from ${sourceMsg} Group ${groupId}: %o`,
          associations
        )
        await this.driver.controller.removeAssociations(
          source,
          groupId,
          associations
        )
      } catch (error) {
        logger.warn(
          `Error while removing associations from ${sourceMsg}: ${error.message}`
        )
      }
    } else {
      logger.warn(
        `Node ${source.nodeId} not found when calling 'removeAssociations'`
      )
    }
  }

  /**
   * Remove all associations
   *
   * @param {number} nodeId Zwave node id
   */
  async removeAllAssociations (nodeId) {
    const zwaveNode = this.getNode(nodeId)

    if (zwaveNode) {
      try {
        const allAssociations = await this.driver.controller.getAllAssociations(
          nodeId
        )

        for (const [source, groupAssociations] of allAssociations.entries()) {
          for (const [groupId, associations] of groupAssociations) {
            if (associations.length > 0) {
              await this.driver.controller.removeAssociations(
                source,
                groupId,
                associations
              )
              logger.info(
                `Assocaitions: Removed ${
                  associations.length
                } associations from Node ${source.nodeId +
                  (source.endpoint
                    ? ' Endpoint ' + source.endpoint
                    : '')} group ${groupId}`
              )
            }
          }
        }
      } catch (error) {
        logger.warn(
          `Error while removing all associations from ${nodeId}: ${error.message}`
        )
      }
    } else {
      logger.warn(
        `Node ${nodeId} not found when calling 'removeAllAssociations'`
      )
    }
  }

  /**
   * Remove node from all associations
   *
   * @param {number} nodeId Zwave node id
   */
  async removeNodeFromAllAssociations (nodeId) {
    const zwaveNode = this.getNode(nodeId)

    if (zwaveNode) {
      try {
        logger.info(
          `Assocaitions: Removing Node ${nodeId} from all associations`
        )
        await this.driver.controller.removeNodeFromAllAssociations(nodeId)
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
   * @returns {Map<number, number[]>} The nodes array where `nodeId` is the array index and the value is the array
   * of neighburns of that `nodeId`
   */
  async refreshNeighbors () {
    const toReturn = {}
    for (const [nodeId, node] of this.nodes) {
      try {
        node.neighbors = await this.getNodeNeighbors(nodeId, true)
      } catch (error) {}
      toReturn[nodeId] = node.neighbors
    }

    return toReturn
  }

  /**
   * Get neighbors of a specific node
   *
   * @param {number} nodeId
   * @param {boolean} dontThrow
   * @returns {Promise<number[]>} Node neighbors
   * of neighburns of that `nodeId`
   */
  async getNodeNeighbors (nodeId, dontThrow) {
    let neighbors = []
    try {
      neighbors = await this.driver.controller.getNodeNeighbors(nodeId)
    } catch (error) {
      logger.error(
        `Node ${nodeId} error while updating Neighbors: ${error.message}`
      )
      if (!dontThrow) {
        throw error
      }
    }

    return neighbors
  }

  /**
   * Execute a custom function with the driver
   *
   * @param {string} code The function body
   * @returns { Promise<any> }
   */
  driverFunction (code) {
    if (!this.driverReady) {
      throw Error('Driver is not ready')
    }

    if (this.closed) {
      throw Error('Client is closed')
    }

    const AsyncFunction = Object.getPrototypeOf(async function () {})
      .constructor

    const fn = new AsyncFunction('driver', code)

    return fn.call({ zwaveClient: this, require }, this.driver)
  }

  /**
   * Method used to start Zwave connection using configuration `port`
   */
  async connect () {
    if (!this.driverReady) {
      // this could happen when the driver fails the connect and a reconnect timeout triggers
      if (this.closed) {
        return
      }

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
            forceConsole: true,
            nodeFilter:
              this.cfg.nodeFilter && this.cfg.nodeFilter.length > 0
                ? this.cfg.nodeFilter.map(n => parseInt(n))
                : undefined
          },
          deviceConfigPriorityDir: storeDir + '/config'
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

        this.driver.on('error', this._onDriverError.bind(this))
        this.driver.once('driver ready', this._onDriverReady.bind(this))
        this.driver.on('all nodes ready', this._onScanComplete.bind(this))

        logger.info(`Connecting to ${this.cfg.port}`)

        await this.driver.start()

        if (this.cfg.serverEnabled) {
          this.server = new ZwavejsServer(this.driver, {
            port: this.cfg.serverPort || 3000,
            logger: LogManager.module('Zwave-Server')
          })
        }

        if (this.cfg.enableStatistics) {
          this.enableStatistics()
        }

        await this._scheduledConfigCheck()

        this.status = ZWAVE_STATUS.connected
        this.connected = true
      } catch (error) {
        // destroy diver instance when it fails
        if (this.driver) {
          this.driver.destroy().catch(err => {
            logger.error(`Error while destroing driver ${err.message}`, error)
          })
        }
        this._onDriverError(error)
        logger.warn('Retry connection in 3 seconds...')
        this.reconnectTimeout = setTimeout(this.connect.bind(this), 3000)
      }
    } else {
      logger.info(`Driver already connected to ${this.cfg.port}`)
    }
  }

  /**
   * Send an event to socket with `data`
   *
   * @param {string} evtName Socket event name
   * @param {any} data Event data object
   */
  sendToSocket (evtName, data) {
    if (this.socket) {
      this.socket.emit(evtName, data)
    }
  }

  // ------------NODES MANAGEMENT-----------------------------------
  /**
   * Updates node `name` property and stores updated config in `nodes.json`
   *
   * @param {number} nodeid Zwave node id
   * @param {string} name The node name
   * @returns True if the node name is updated correctly
   * @throws Invalid node id if the node id provided doesn't exists
   */
  async setNodeName (nodeid, name) {
    if (!this.storeNodes[nodeid]) {
      this.storeNodes[nodeid] = {}
    }

    const node = this.nodes.get(nodeid)
    const zwaveNode = this.getNode(nodeid)

    if (zwaveNode && node) {
      node.name = name
      zwaveNode.name = name
    } else {
      throw Error('Invalid Node ID')
    }

    this.storeNodes[nodeid].name = name

    await jsonStore.put(store.nodes, this.storeNodes)

    this.emit('nodeStatus', node)

    return true
  }

  /**
   * Updates node `loc` property and stores updated config in `nodes.json`
   *
   * @param {number} nodeid Zwave node id
   * @param {string} loc The node name
   * @returns True if the node location is updated correctly
   * @throws Invalid node id if the node id provided doesn't exists
   */
  async setNodeLocation (nodeid, loc) {
    if (!this.storeNodes[nodeid]) {
      this.storeNodes[nodeid] = {}
    }

    const node = this.nodes.get(nodeid)
    const zwaveNode = this.getNode(nodeid)

    if (node) {
      node.loc = loc
      zwaveNode.location = loc
    } else {
      throw Error('Invalid Node ID')
    }

    this.storeNodes[nodeid].loc = loc

    await jsonStore.put(store.nodes, this.storeNodes)

    this.emit('nodeStatus', node)

    return true
  }

  // ------------SCENES MANAGEMENT-----------------------------------
  /**
   * Creates a new scene with a specific `label` and stores it in `scenes.json`
   *
   * @param {string} label Scene label
   * @returns True if the scene is created without error
   */
  async _createScene (label) {
    const id =
      this.scenes.length > 0
        ? this.scenes[this.scenes.length - 1].sceneid + 1
        : 1
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
   * @param {number} sceneid Scene id
   * @returns True if the scene is deleted without error
   */
  async _removeScene (sceneid) {
    const index = this.scenes.findIndex(s => s.sceneid === sceneid)

    if (index < 0) {
      throw Error('No scene found with given sceneid')
    }

    this.scenes.splice(index, 1)

    await jsonStore.put(store.scenes, this.scenes)

    return true
  }

  /**
   * Imports scenes Array in `scenes.json`
   *
   * @param {import('../types/index.js').Z2MScene[]} scenes The scenes Array
   * @returns The scenes Array
   */
  async _setScenes (scenes) {
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
  _getScenes () {
    return this.scenes
  }

  /**
   * Return all values of the scene with given `sceneid`
   *
   * @param {number} sceneid The scene id
   * @returns The scene values Array
   */
  _sceneGetValues (sceneid) {
    const scene = this.scenes.find(s => s.sceneid === sceneid)
    if (!scene) {
      throw Error('No scene found with given sceneid')
    }
    return scene.values
  }

  /**
   * Add a value to a scene
   *
   * @param {number} sceneid The scene id
   * @param {import('../types/index.js').Z2MValueIdScene} valueId internal valueId
   * @param {any} value the value
   * @param {number} timeout timeout in seconds
   * @returns True if value is added without any error
   * @throws Error if args valueid isn't valid
   */
  async _addSceneValue (sceneid, valueId, value, timeout) {
    const scene = this.scenes.find(s => s.sceneid === sceneid)
    const node = this.nodes.get(valueId.nodeId)

    if (!scene) {
      throw Error('No scene found with given sceneid')
    }

    if (!node) {
      throw Error(`Node ${valueId.nodeId} not found`)
    } else {
      // check if it is an existing valueid
      if (!node.values[this._getValueID(valueId)]) {
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
   * @param {number} sceneid The scene id
   * @param {import('../types/index.js').Z2MValueIdScene} valueId The valueId to remove
   * @throws Error if args valueid isn't valid
   */
  async _removeSceneValue (sceneid, valueId) {
    const scene = this.scenes.find(s => s.sceneid === sceneid)

    if (!scene) {
      throw Error('No scene found with given sceneid')
    }

    // get the index with also the node identifier as prefix
    const index = scene.values.findIndex(s => s.id === valueId.id)

    if (index < 0) {
      throw Error('No ValueId match found in given scene')
    } else {
      scene.values.splice(index, 1)
    }

    return jsonStore.put(store.scenes, this.scenes)
  }

  /**
   * Activate a scene with given scene id
   *
   * @param {number} sceneId The scene Id
   * @returns {boolean} True if activation is successfull
   */
  _activateScene (sceneId) {
    const values = this._sceneGetValues(sceneId) || []

    // eslint-disable-next-line no-unmodified-loop-condition
    for (let i = 0; i < values.length; i++) {
      const fun = this._wrapFunction(this.writeValue, this, [
        values[i],
        values[i].value
      ])
      setTimeout(fun, values[i].timeout ? values[i].timeout * 1000 : 0)
    }

    return true
  }

  /**
   * Get the nodes array
   *
   * @returns {import('../types/index.js').Z2MNode[]}
   */
  getNodes () {
    const toReturn = []

    for (const [, node] of this.nodes) {
      toReturn.push(node)
    }
    return toReturn
  }

  /**
   * Enable Statistics
   *
   */
  enableStatistics () {
    this.driver.enableStatistics({
      applicationName:
        pkgjson.name + (this.cfg.serverEnabled ? ' / zwave-js-server' : ''),
      applicationVersion: pkgjson.version
    })

    logger.info('Zwavejs usage statistics ENABLED')
  }

  /**
   * Disable Statistics
   *
   */
  disableStatistics () {
    this.driver.disableStatistics()

    logger.info('Zwavejs usage statistics DISABLED')
  }

  getInfo () {
    const info = Object.assign({}, this.driverInfo)

    info.uptime = process.uptime()
    info.lastUpdate = this.lastUpdate
    info.status = this.status
    info.cntStatus = this.cntStatus
    info.appVersion = utils.getVersion()
    info.zwaveVersion = libVersion
    info.serverVersion = serverVersion

    return info
  }

  /**
   * Refresh all node values
   *
   * @param {number} nodeId
   * @returns {Promise<void>}
   */
  async refreshValues (nodeId) {
    if (this.driver && !this.closed) {
      const zwaveNode = this.getNode(nodeId)

      return zwaveNode.refreshValues()
    }

    throw Error('Driver is closed')
  }

  /**
   * Refresh all node values of a specific CC
   *
   * @param {number} nodeId Zwave node id
   * @param {CommandClass} cc The command calss
   * @returns {Promise<void>}
   */
  async refreshCCValues (nodeId, cc) {
    if (this.driver && !this.closed) {
      const zwaveNode = this.getNode(nodeId)

      return zwaveNode.refreshCCValues(cc)
    }

    throw Error('Driver is closed')
  }

  /**
   * Set a poll interval
   *
   * @param {import('../types/index.js').Z2MValueId} valueId
   * @param {number} interval in seconds
   */
  setPollInterval (valueId, interval) {
    if (this.driver && !this.closed) {
      const vID = this._getValueID(valueId, true)

      if (this.pollIntervals[vID]) {
        clearTimeout(this.pollIntervals[vID])
      }

      logger.debug(`${vID} will be polled in ${interval} seconds`)

      this.pollIntervals[vID] = setTimeout(
        this._tryPoll.bind(this, valueId, interval),
        interval * 1000
      )
    } else {
      throw Error('Driver is closed')
    }
  }

  /**
   * Checks for configs updates
   *
   * @returns {Promise<string | undefined} The new version if present
   */
  async checkForConfigUpdates () {
    if (this.driver && !this.closed) {
      this.driverInfo.newConfigVersion = await this.driver.checkForConfigUpdates()
      this.sendToSocket(socketEvents.info, this.getInfo())
      return this.driverInfo.newConfigVersion
    } else {
      throw Error('Driver is closed')
    }
  }

  /**
   * Checks for configs updates and installs them
   *
   * @returns {Promise<boolean>} True when update is installed, false otherwise
   */
  async installConfigUpdate () {
    if (this.driver && !this.closed) {
      const updated = await this.driver.installConfigUpdate()
      if (updated) {
        this.driverInfo.newConfigVersion = undefined
        this.sendToSocket(socketEvents.info, this.getInfo())
      }
      return updated
    } else {
      throw Error('Driver is closed')
    }
  }

  /**
   * Request an update of this value
   *
   * @param {import('../types/index.js').Z2MValueId} valueId
   * @returns {Promise<any>} The polled value
   */
  async pollValue (valueId) {
    if (this.driver && !this.closed) {
      const zwaveNode = this.getNode(valueId.nodeId)

      logger.debug(`Polling value ${this._getValueID(valueId)}`)

      return zwaveNode.pollValue(valueId)
    }

    throw Error('Driver is closed')
  }

  /**
   * Replace failed node
   *
   * @param {number} nodeId
   * @returns {Promise<boolean>}
   */
  async replaceFailedNode (nodeId, secure) {
    if (this.driver && !this.closed) {
      if (this.commandsTimeout) {
        clearTimeout(this.commandsTimeout)
        this.commandsTimeout = null
      }

      this.commandsTimeout = setTimeout(
        () => this.stopInclusion().catch(logger.error),
        this.cfg.commandsTimeout * 1000 || 30000
      )
      // by default replaceFailedNode is secured, pass true to make it not secured
      return this.driver.controller.replaceFailedNode(nodeId, !secure)
    }

    throw Error('Driver is closed')
  }

  /**
   * Start inclusion
   *
   * @param {boolean} secure
   * @returns {Promise<boolean>}
   */
  async startInclusion (secure) {
    if (this.driver && !this.closed) {
      if (this.commandsTimeout) {
        clearTimeout(this.commandsTimeout)
        this.commandsTimeout = null
      }

      this.commandsTimeout = setTimeout(
        () => this.stopInclusion().catch(logger.error),
        this.cfg.commandsTimeout * 1000 || 30000
      )
      // by default beginInclusion is secured, pass true to make it not secured
      return this.driver.controller.beginInclusion(!secure)
    }

    throw Error('Driver is closed')
  }

  /**
   * Start exclusion
   *
   * @returns {Promise<boolean>}
   */
  async startExclusion () {
    if (this.driver && !this.closed) {
      if (this.commandsTimeout) {
        clearTimeout(this.commandsTimeout)
        this.commandsTimeout = null
      }

      this.commandsTimeout = setTimeout(
        () => this.stopExclusion().catch(logger.error),
        this.cfg.commandsTimeout * 1000 || 30000
      )

      return this.driver.controller.beginExclusion()
    }

    throw Error('Driver is closed')
  }

  /**
   * Stop exclusion
   *
   * @returns {Promise<boolean>}
   */
  async stopExclusion () {
    if (this.driver && !this.closed) {
      if (this.commandsTimeout) {
        clearTimeout(this.commandsTimeout)
        this.commandsTimeout = null
      }
      return this.driver.controller.stopExclusion()
    }

    throw Error('Driver is closed')
  }

  /**
   * Stops inclusion
   *
   * @returns {Promise<boolean>}
   */
  async stopInclusion () {
    if (this.driver && !this.closed) {
      if (this.commandsTimeout) {
        clearTimeout(this.commandsTimeout)
        this.commandsTimeout = null
      }
      return this.driver.controller.stopInclusion()
    }

    throw Error('Driver is closed')
  }

  /**
   * Heal a node
   *
   * @param {number} nodeId
   * @returns {Promise<boolean>}
   */
  async healNode (nodeId) {
    if (this.driver && !this.closed) {
      return this.driver.controller.healNode(nodeId)
    }

    throw Error('Driver is closed')
  }

  /**
   * Check if a node is failed
   *
   * @param {number} nodeId
   * @returns {Promise<boolean>}
   */
  async isFailedNode (nodeId) {
    if (this.driver && !this.closed) {
      const node = this.nodes.get(nodeId)
      const zwaveNode = this.getNode(nodeId)

      // checks if a node was marked as failed in the controller
      const result = await this.driver.controller.isFailedNode(nodeId)
      if (node) {
        node.failed = result
      }

      if (zwaveNode) {
        this._onNodeStatus(zwaveNode)
      }
      return result
    }

    throw Error('Driver is closed')
  }

  /**
   * Remove a failed node
   *
   * @param {number} nodeId
   * @returns {Promise<void>}
   */
  async removeFailedNode (nodeId) {
    if (this.driver && !this.closed) {
      return this.driver.controller.removeFailedNode(nodeId)
    }

    throw Error('Driver is closed')
  }

  /**
   * Re interview the node
   *
   * @param {number} nodeId
   * @returns {Promise<void>}
   */
  async refreshInfo (nodeId) {
    if (this.driver && !this.closed) {
      const zwaveNode = this.getNode(nodeId)

      if (!zwaveNode) {
        throw Error(`Node ${nodeId} not found`)
      }

      return zwaveNode.refreshInfo()
    }

    throw Error('Driver is closed')
  }

  /**
   * Start a firmware update
   *
   * @param {number} nodeId
   * @param {string} fileName
   * @param {Buffer} data
   * @param {number} target
   * @returns {Promise<void>}
   */
  async beginFirmwareUpdate (nodeId, fileName, data, target) {
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
        const format = guessFirmwareFileFormat(fileName, data)
        actualFirmware = extractFirmware(data, format)
      } catch (e) {
        throw Error('Unable to extract firmware from file: ' + e.message)
      }

      if (target >= 0) {
        actualFirmware.firmwareTarget = target
      }

      return zwaveNode.beginFirmwareUpdate(
        actualFirmware.data,
        actualFirmware.firmwareTarget
      )
    }

    throw Error('Driver is closed')
  }

  async abortFirmwareUpdate (nodeId) {
    if (this.driver && !this.closed) {
      const zwaveNode = this.getNode(nodeId)

      if (!zwaveNode) {
        throw Error(`Node ${nodeId} not found`)
      }

      return zwaveNode.abortFirmwareUpdate()
    }

    throw Error('Driver is closed')
  }

  async beginHealingNetwork () {
    if (this.driver && !this.closed) {
      return this.driver.controller.beginHealingNetwork()
    }

    throw Error('Driver is closed')
  }

  async stopHealingNetwork () {
    if (this.driver && !this.closed) {
      return this.driver.controller.stopHealingNetwork()
    }

    throw Error('Driver is closed')
  }

  async hardReset () {
    if (this.driver && !this.closed) {
      return this.driver.hardReset()
    }

    throw Error('Driver is closed')
  }

  /**
   * Send a command
   *
   * @param {{nodeId: number, endpoint: number, commandClass: CommandClasses | keyof typeof CommandClasses}} ctx context to get the instance to send the command
   * @param {string} command command name
   * @param {any[]} args args to pass to `command`
   * @returns {Promise<any>}
   */
  async sendCommand (ctx, command, args) {
    if (this.driver && !this.closed) {
      if (typeof ctx.nodeId !== 'number') {
        throw Error('nodeId must be a number')
      }

      if (args !== undefined && !Array.isArray(args)) {
        throw Error('if args is given, it must be an array')
      }

      // get node instance
      const node = this.getNode(ctx.nodeId)
      if (!node) {
        throw Error(`Node ${ctx.nodeId} was not found!`)
      }

      // get the endpoint instance
      const endpoint = node.getEndpoint(ctx.endpoint || 0)
      if (!endpoint) {
        throw Error(
          `Endpoint ${ctx.endpoint} does not exist on Node ${ctx.nodeId}!`
        )
      }

      const commandClass =
        typeof ctx.commandClass === 'number'
          ? ctx.commandClass
          : CommandClasses[ctx.commandClass]

      // get the command class instance to send the command
      const api = endpoint.commandClasses[commandClass]
      if (!api || !api.isSupported()) {
        throw Error(
          `Node ${ctx.nodeId} (Endpoint ${ctx.endpoint}) does not support CC ${ctx.commandClass} or it has not been implemented yet`
        )
      } else if (!(command in api)) {
        throw Error(
          `The command ${command} does not exist for CC ${ctx.commandClass}`
        )
      }

      // send the command with args
      const method = api[command].bind(api)
      const result = args ? await method(...args) : await method()
      return result
    }

    throw Error('Driver is closed')
  }

  /**
   * Calls a specific `client` or `ZwaveClient` method based on `apiName`
   * ZwaveClients methods used are the ones that overrides default Zwave methods
   * like nodes name and location and scenes management.
   *
   * @param {string} apiName The api name
   * @param {any[]} args Array of arguments to use for the api call
   * @returns An object `{success: <success>, message: <message>, args: <args>, result: <the response>}`,  if success is false the message contains the error
   */
  async callApi (apiName, ...args) {
    let err, result

    logger.log('info', 'Calling api %s with args: %o', apiName, args)

    if (this.driverReady) {
      try {
        const allowed =
          typeof this[apiName] === 'function' &&
          allowedApis.indexOf(apiName) >= 0

        // Send raw data expects a buffer as the fifth argument, which JSON does not support, so we convert an array of bytes into a buffer.
        if (apiName === 'sendRawData') {
          args[4] = Buffer.from(args[4])
        }

        if (allowed) {
          result = await this[apiName](...args)
          // custom scenes and node/location management
        } else {
          err = 'Unknown API'
        }
      } catch (e) {
        err = e.message
      }
    } else {
      err = 'Zwave client not connected'
    }

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
    // if (
    //   (apiName === 'enablePoll' || apiName === 'disablePoll') &&
    //   args[0] &&
    //   args[0].nodeId
    // ) {
    //   const nId = args[0].nodeId
    //   const vId = getValueID(args[0])
    //   if (this.nodes.get(nId) && this.nodes.get(nId).values[vId]) {
    //     this.nodes.get(nId).values[vId].isPolled = this.driver.controller.isPolled(args[0])
    //   }
    // }
    logger.log('info', `${result.message} ${apiName} %o`, result)

    result.args = args

    return result
  }

  /**
   * Send broadcast write request
   *
   * @param {import('zwave-js').ValueID} valueId Zwave valueId object
   * @param {unknown} value The value to send
   */
  async writeBroadcast (valueId, value) {
    if (this.driverReady) {
      try {
        const broadcastNode = this.driver.controller.getBroadcastNode()

        await broadcastNode.setValue(valueId, value)
      } catch (error) {
        logger.error(
          `Error while sending broadcast ${value} to CC ${
            valueId.commandClass
          } ${valueId.property} ${valueId.propertyKey || ''}: ${error.message}`
        )
      }
    }
  }

  /**
   * Send multicast write request to a group of nodes
   *
   * @param {number[]} nodes Array of nodes ids
   * @param {import('zwave-js').ValueID} valueId Zwave valueId object
   * @param {unknown} value The value to send
   */
  async writeMulticast (nodes, valueId, value) {
    if (this.driverReady) {
      let fallback = false
      try {
        const multicastGroup = this.driver.controller.getMulticastGroup(nodes)
        await multicastGroup.setValue(valueId, value)
      } catch (error) {
        fallback = error.code === ZWaveErrorCodes.CC_NotSupported
        logger.error(
          `Error while sending multicast ${value} to CC ${
            valueId.commandClass
          } ${valueId.property} ${valueId.propertyKey || ''}: ${error.message}`
        )
      }
      // try single writes requests
      if (fallback) {
        for (const n of nodes) {
          await this.writeValue({ ...valueId, nodeId: n }, value)
        }
      }
    }
  }

  /**
   * Set a value of a specific zwave valueId
   *
   * @param {import('../types/index.js').Z2MValueId} valueId Zwave valueId object
   * @param {number|string} value The value to send
   */
  async writeValue (valueId, value) {
    if (this.driverReady) {
      const vID = this._getValueID(valueId, true)
      logger.log('info', `Writing %o to ${vID}`, value)

      let result = false

      // coerce string to numbers when value type is number and received a string
      if (
        valueId.type === 'number' &&
        typeof value === 'string' &&
        !isNaN(value)
      ) {
        value = Number(value)
      } else if (
        valueId.property === 'hexColor' &&
        typeof value === 'string' &&
        value.startsWith('#')
      ) {
        // remove the leading `#` if present
        value = value.substr(1)
      }

      if (typeof value === 'string' && utils.isBufferAsHex(value)) {
        value = utils.bufferFromHex(value)
      }

      try {
        const zwaveNode = await this.getNode(valueId.nodeId)

        const isDuration = typeof value === 'object'

        // handle multilevel switch 'start' and 'stop' commands
        if (
          !isDuration &&
          valueId.commandClass === CommandClasses['Multilevel Switch'] &&
          isNaN(value)
        ) {
          if (/stop/i.test(value)) {
            await zwaveNode.commandClasses[
              'Multilevel Switch'
            ].stopLevelChange()
          } else if (/start/i.test(value)) {
            await zwaveNode.commandClasses[
              'Multilevel Switch'
            ].startLevelChange()
          } else {
            throw Error('Command not valid for Multilevel Switch')
          }
          result = true
        } else {
          result = await this.getNode(valueId.nodeId).setValue(valueId, value)
        }
      } catch (error) {
        logger.log(
          'error',
          `Error while writing %o on ${vID}: ${error.message}`,
          value
        )
      }
      // https://zwave-js.github.io/node-zwave-js/#/api/node?id=setvalue
      if (result === false) {
        logger.log('error', `Unable to write %o on ${vID}`, value)
      }
    }
  }

  // ---------- DRIVER EVENTS -------------------------------------

  async _onDriverReady () {
    /*
    Now the controller interview is complete. This means we know which nodes
    are included in the network, but they might not be ready yet.
    The node interview will continue in the background.
  */

    // driver ready
    this.status = ZWAVE_STATUS.driverReady
    this.driverReady = true

    logger.info('Zwave driver is ready')

    this._updateControllerStatus('Driver ready')

    this.driver.controller
      .on('inclusion started', this._onInclusionStarted.bind(this))
      .on('exclusion started', this._onExclusionStarted.bind(this))
      .on('inclusion stopped', this._onInclusionStopped.bind(this))
      .on('exclusion stopped', this._onExclusionStopped.bind(this))
      .on('inclusion failed', this._onInclusionFailed.bind(this))
      .on('exclusion failed', this._onExclusionFailed.bind(this))
      .on('node added', this._onNodeAdded.bind(this))
      .on('node removed', this._onNodeRemoved.bind(this))
      .on('heal network progress', this._onHealNetworkProgress.bind(this))
      .on('heal network done', this._onHealNetworkDone.bind(this))

    for (const [, node] of this.driver.controller.nodes) {
      // node added will not be triggered if the node is in cache
      this._addNode(node)

      // Make sure we didn't miss the ready event
      if (node.ready) {
        await this._onNodeReady(node)
      }
    }

    this.driverInfo.homeid = this.driver.controller.homeId
    const homeHex = '0x' + this.driverInfo.homeid.toString(16)
    this.driverInfo.name = homeHex
    this.driverInfo.controllerId = this.driver.controller.ownNodeId

    this.emit('event', eventEmitter.driver, 'driver ready', this.driverInfo)

    this.error = false

    // start server only when driver is ready. Fixes #602
    if (this.cfg.serverEnabled && this.server) {
      this.server.start().catch(err => {
        logger.error('Error while starting Zwavejs Server', err)
      })
    }

    logger.info(`Scanning network with homeid: ${homeHex}`)
  }

  _onDriverError (error) {
    this.error = 'Driver: ' + error.message
    this.status = ZWAVE_STATUS.driverFailed
    this._updateControllerStatus(this.error)

    this.emit('event', eventEmitter.driver, 'driver error', error)
  }

  _onScanComplete () {
    this.scanComplete = true

    this._updateControllerStatus('Scan completed')

    // all nodes are ready
    this.status = ZWAVE_STATUS.scanDone

    logger.info(`Network scan complete. Found: ${this.nodes.size} nodes`)

    this.emit('scanComplete')

    this.emit('event', eventEmitter.driver, 'all nodes ready')
  }

  // ---------- CONTROLLER EVENTS -------------------------------

  _updateControllerStatus (status) {
    logger.info(`Controller status: ${status}`)
    this.cntStatus = status
    this.sendToSocket(socketEvents.controller, status)
  }

  _onInclusionStarted (secure) {
    const message = `${secure ? 'Secure' : 'Non-secure'} inclusion started`
    this._updateControllerStatus(message)
    this.emit('event', eventEmitter.controller, 'inclusion started', secure)
  }

  _onExclusionStarted () {
    const message = 'Exclusion started'
    this._updateControllerStatus(message)
    this.emit('event', eventEmitter.controller, 'exclusion started')
  }

  _onInclusionStopped () {
    const message = 'Inclusion stopped'
    this._updateControllerStatus(message)
    this.emit('event', eventEmitter.controller, 'inclusion stopped')
  }

  _onExclusionStopped () {
    const message = 'Exclusion stopped'
    this._updateControllerStatus(message)
    this.emit('event', eventEmitter.controller, 'exclusion stopped')
  }

  _onInclusionFailed () {
    const message = 'Inclusion failed'
    this._updateControllerStatus(message)
    this.emit('event', eventEmitter.controller, 'inclusion failed')
  }

  _onExclusionFailed () {
    const message = 'Exclusion failed'
    this._updateControllerStatus(message)
    this.emit('event', eventEmitter.controller, 'exclusion failed')
  }

  /**
   * Triggered when a node is added
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   */
  _onNodeAdded (zwaveNode) {
    logger.info(`Node ${zwaveNode.id}: added`)

    // the driver is ready so this node has been added on fly
    if (this.driverReady) {
      const node = this._addNode(zwaveNode)
      this.sendToSocket(socketEvents.nodeAdded, node)
    }

    this.emit(
      'event',
      eventEmitter.controller,
      'node added',
      this.nodes.get(zwaveNode.id)
    )
  }

  /**
   * Triggered when node is removed
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   */
  _onNodeRemoved (zwaveNode) {
    logger.info(`Node ${zwaveNode.id}: removed`)
    zwaveNode.removeAllListeners()

    this.emit(
      'event',
      eventEmitter.controller,
      'node removed',
      this.nodes.get(zwaveNode.id)
    )

    this._removeNode(zwaveNode.id)
  }

  /**
   * Triggered on each progress of healing process
   *
   * @param {ReadonlyMap<number, import('zwave-js').HealNodeStatus>} progress
   */
  _onHealNetworkProgress (progress) {
    const toHeal = [...progress.values()]
    const healedNodes = toHeal.filter(v => v !== 'pending')
    const message = `Healing process IN PROGRESS. Healed ${healedNodes.length} nodes`
    this._updateControllerStatus(message)

    this.emit(
      'event',
      eventEmitter.controller,
      'heal network progress',
      progress
    )
  }

  _onHealNetworkDone (result) {
    const message = `Healing process COMPLETED. Healed ${result.size} nodes`
    this._updateControllerStatus(message)
  }

  // ---------- NODE EVENTS -------------------------------------

  /**
   * Update current node status and interviewState
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   */
  _onNodeStatus (zwaveNode) {
    const node = this.nodes.get(zwaveNode.id)

    if (node) {
      // https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/node/Types.ts#L127
      node.status = NodeStatus[zwaveNode.status]
      node.available = zwaveNode.status !== NodeStatus.Dead
      node.interviewStage = InterviewStage[zwaveNode.interviewStage]
      this.emit('nodeStatus', node)
    } else {
      logger.error(
        Error(`Received update from node ${zwaveNode.id} that doesn't exists`)
      )
    }
  }

  /**
   * Triggered when a node is ready. All values are added and all node info are received
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   */
  async _onNodeReady (zwaveNode) {
    const node = this.nodes.get(zwaveNode.id)

    if (!node) {
      logger.error(
        `Node ${zwaveNode.id} ready event called on a node that doesn't exists in memory`
      )
      return
    }

    // keep track of existing values (if any)
    const existingValues = node.values

    // node can trigger the ready event multiple times. Set it to false to prevent discovery
    node.ready = false
    node.values = {}

    this._dumpNode(zwaveNode)
    node.neighbors = await this.getNodeNeighbors(zwaveNode.id, true)

    const values = zwaveNode.getDefinedValueIDs()

    for (const zwaveValue of values) {
      this._addValue(zwaveNode, zwaveValue, existingValues)
    }

    // add it to know devices types (if not already present)
    if (!this.devices[node.deviceId]) {
      this.devices[node.deviceId] = {
        name: `[${node.deviceId}] ${node.productDescription} (${node.manufacturer})`,
        values: utils.copy(node.values)
      }

      const deviceValues = this.devices[node.deviceId].values

      delete this.devices[node.deviceId].hassDevices

      // remove node specific info from values
      for (const id in deviceValues) {
        delete deviceValues[id].nodeId

        // remove the node part
        deviceValues[id].id = id
      }
    }

    // node is ready when all it's info are parsed and all values added
    // don't set the node as ready before all values are added, to prevent discovery
    node.ready = true

    node.lastActive = Date.now()

    await this.getGroups(zwaveNode.id, true)

    this._onNodeStatus(zwaveNode)

    this.emit(
      'event',
      eventEmitter.node,
      'node ready',
      this.nodes.get(zwaveNode.id)
    )

    logger.info(
      `Node ${node.id} ready: ${node.manufacturer} - ${
        node.productLabel
      } (${node.productDescription || 'Unknown'})`
    )
  }

  /**
   * Triggered when a node interview starts for the first time or when the node is manually re-interviewed
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   */
  _onNodeInterviewStarted (zwaveNode) {
    const node = this.nodes.get(zwaveNode.id)

    logger.info(`Node ${zwaveNode.id}: interview started`)

    this.emit('event', eventEmitter.node, 'node interview started', node)
  }

  /**
   * Triggered when an interview stage complete
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {string} stageName completed stage name
   */
  _onNodeInterviewStageCompleted (zwaveNode, stageName) {
    const node = this.nodes.get(zwaveNode.id)

    logger.info(
      `Node ${
        zwaveNode.id
      }: interview stage ${stageName.toUpperCase()} completed`
    )

    this._onNodeStatus(zwaveNode)

    this.emit(
      'event',
      eventEmitter.node,
      'node interview stage completed',
      node
    )
  }

  /**
   * Triggered when a node finish its interview. When this event is triggered all node values and metadata are updated
   * Starting from zwave-js v7 this event is only triggered when the node is added the first time or manually re-interviewed
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   */
  _onNodeInterviewCompleted (zwaveNode) {
    const node = this.nodes.get(zwaveNode.id)

    if (node.manufacturerId === undefined) {
      this._dumpNode(zwaveNode)
    }

    logger.info(
      `Node ${zwaveNode.id}: interview COMPLETED, all values are updated`
    )

    this._onNodeStatus(zwaveNode)

    this.emit(
      'event',
      eventEmitter.node,
      'node interview completed',
      this.nodes.get(zwaveNode.id)
    )
  }

  /**
   * Triggered when a node interview fails.
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {import('zwave-js').NodeInterviewFailedEventArgs} args
   */
  _onNodeInterviewFailed (zwaveNode, args) {
    logger.error(
      `Interview of node ${zwaveNode.id} has failed: ${args.errorMessage}`
    )

    this._onNodeStatus(zwaveNode)

    this.emit(
      'event',
      eventEmitter.node,
      'node interview failed',
      this.nodes.get(zwaveNode.id)
    )
  }

  /**
   * Triggered when a node wake ups
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {NodeStatus} oldStatus
   */
  _onNodeWakeUp (zwaveNode, oldStatus) {
    logger.info(
      `Node ${zwaveNode.id} is ${
        oldStatus === NodeStatus.Unknown ? '' : 'now '
      }awake`
    )

    this._onNodeStatus(zwaveNode)
    this.emit(
      'event',
      eventEmitter.node,
      'node wakeup',
      this.nodes.get(zwaveNode.id)
    )
  }

  /**
   * Triggered when a node is sleeping
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {NodeStatus} oldStatus
   */
  _onNodeSleep (zwaveNode, oldStatus) {
    logger.info(
      `Node ${zwaveNode.id} is ${
        oldStatus === NodeStatus.Unknown ? '' : 'now '
      }asleep`
    )
    this._onNodeStatus(zwaveNode)
    this.emit(
      'event',
      eventEmitter.node,
      'node sleep',
      this.nodes.get(zwaveNode.id)
    )
  }

  /**
   * Triggered when a node is alive
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {NodeStatus} oldStatus
   */
  _onNodeAlive (zwaveNode, oldStatus) {
    this._onNodeStatus(zwaveNode)
    if (oldStatus === NodeStatus.Dead) {
      logger.info(`Node ${zwaveNode.id}: has returned from the dead`)
    } else {
      logger.info(`Node ${zwaveNode.id} is alive`)
    }

    this.emit(
      'event',
      eventEmitter.node,
      'node alive',
      this.nodes.get(zwaveNode.id)
    )
  }

  /**
   * Triggered when a node is dead
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {NodeStatus} oldStatus
   */
  _onNodeDead (zwaveNode, oldStatus) {
    this._onNodeStatus(zwaveNode)
    logger.info(
      `Node ${zwaveNode.id} is ${
        oldStatus === NodeStatus.Unknown ? '' : 'now '
      }dead`
    )

    this.emit(
      'event',
      eventEmitter.node,
      'node dead',
      this.nodes.get(zwaveNode.id)
    )
  }

  /**
   * Triggered when a node value is added
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {import('zwave-js').ZWaveNodeValueAddedArgs} args
   */
  _onNodeValueAdded (zwaveNode, args) {
    logger.info(
      `Node ${zwaveNode.id}: value added: ${this._getValueID(args)} => ${
        args.newValue
      }`
    )

    // handle node values added 'on fly'
    if (zwaveNode.ready) {
      this._addValue(zwaveNode, args)
    }

    this.emit(
      'event',
      eventEmitter.node,
      'node value added',
      this.nodes.get(zwaveNode.id),
      args
    )
  }

  /**
   * Emitted when we receive a `value notification` event
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {import('zwave-js').ZWaveNodeValueNotificationArgs} args
   */
  _onNodeValueNotification (zwaveNode, args) {
    // notification hasn't `newValue`
    args.newValue = args.value
    // specify that this is stateless
    args.stateless = true

    this._onNodeValueUpdated(zwaveNode, args)
  }

  /**
   * Emitted when we receive a `value updated` event
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {import('zwave-js').ZWaveNodeValueUpdatedArgs} args
   * @param {boolean} isNotification
   */
  _onNodeValueUpdated (zwaveNode, args) {
    this._updateValue(zwaveNode, args)
    logger.info(
      `Node ${zwaveNode.id}: value ${
        args.stateless ? 'notification' : 'updated'
      }: ${this._getValueID(args)} ${
        args.stateless ? args.newValue : `${args.prevValue} => ${args.newValue}`
      }`
    )

    this.emit(
      'event',
      eventEmitter.node,
      'node value updated',
      this.nodes.get(zwaveNode.id),
      args
    )
  }

  /**
   * Emitted when we receive a `value removed` event
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {import('zwave-js').ZWaveNodeValueRemovedArgs} args
   */
  _onNodeValueRemoved (zwaveNode, args) {
    this._removeValue(zwaveNode, args)
    logger.info(
      `Node ${zwaveNode.id}: value removed: ${this._getValueID(args)}`
    )
    this.emit(
      'event',
      eventEmitter.node,
      'node value removed',
      this.nodes.get(zwaveNode.id),
      args
    )
  }

  /**
   * Emitted when we receive a `metadata updated` event
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {import('zwave-js').ZWaveNodeMetadataUpdatedArgs} args
   */
  _onNodeMetadataUpdated (zwaveNode, args) {
    const valueId = this._parseValue(zwaveNode, args, args.metadata)
    logger.info(
      `Node ${valueId.nodeId}: metadata updated: ${this._getValueID(args)}`
    )
    this.emit(
      'event',
      eventEmitter.node,
      'node metadata updated',
      this.nodes.get(zwaveNode.id),
      args
    )
  }

  /**
   * Emitted when we receive a node `notification` event
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {CommandClasses} ccId
   * @param {Record<string, unknown>} args
   */
  _onNodeNotification (zwaveNode, ccId, args) {
    const valueId = {
      id: null,
      nodeId: zwaveNode.id,
      commandClass: ccId,
      commandClassName: CommandClasses[ccId],
      property: null
    }

    let data = null

    if (ccId === CommandClasses.Notification) {
      valueId.property = args.label
      valueId.propertyKey = args.eventLabel

      data = this._parseNotification(args.parameters)
    } else if (ccId === CommandClasses['Entry Control']) {
      valueId.property = args.eventType
      valueId.propertyKey = args.dataType
      data =
        args.eventData instanceof Buffer
          ? utils.buffer2hex(args.eventData)
          : args.eventData
    } else {
      logger.log(
        'error',
        'Unknown notification received from node %d CC %s: %o',
        zwaveNode.id,
        valueId.commandClassName,
        args
      )

      return
    }

    valueId.id = this._getValueID(valueId, true)
    valueId.propertyName = valueId.property // must be defined in named topics

    logger.log(
      'info',
      'Node %d CC %s %o',
      zwaveNode.id,
      valueId.commandClassName,
      args
    )

    const node = this.nodes.get(zwaveNode.id)

    this.emit('notification', node, valueId, data)

    this.emit(
      'event',
      eventEmitter.node,
      'node notification',
      node,
      valueId,
      data
    )
  }

  /**
   * Emitted when we receive a node `firmware update progress` event
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {number} sentFragments
   * @param {number} totalFragments
   */
  _onNodeFirmwareUpdateProgress (zwaveNode, sentFragments, totalFragments) {
    this._updateControllerStatus(
      `Node ${zwaveNode.id} firmware update IN PROGRESS: ${sentFragments}/${totalFragments}`
    )
    this.emit(
      'event',
      eventEmitter.node,
      'node firmware update progress',
      this.nodes.get(zwaveNode.id),
      sentFragments,
      totalFragments
    )
  }

  /**
   * Triggered we receive a node `firmware update finished` event
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {FirmwareUpdateStatus} status
   * @param {number} waitTime
   */
  _onNodeFirmwareUpdateFinished (zwaveNode, status, waitTime) {
    this._updateControllerStatus(
      `Node ${zwaveNode.id} firmware update FINISHED: Status ${status}, Time: ${waitTime}`
    )

    this.emit(
      'event',
      eventEmitter.node,
      'node firmware update finished',
      this.nodes.get(zwaveNode.id),
      status,
      waitTime
    )
  }

  // ------- NODE METHODS -------------

  /**
   * Bind to ZwaveNode events
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   */
  _bindNodeEvents (zwaveNode) {
    logger.debug(`Binding to node ${zwaveNode.id} events`)

    // https://zwave-js.github.io/node-zwave-js/#/api/node?id=zwavenode-events
    zwaveNode
      .on('ready', this._onNodeReady.bind(this))
      .on('interview started', this._onNodeInterviewStarted.bind(this))
      .on(
        'interview stage completed',
        this._onNodeInterviewStageCompleted.bind(this)
      )
      .on('interview completed', this._onNodeInterviewCompleted.bind(this))
      .on('interview failed', this._onNodeInterviewFailed.bind(this))
      .on('wake up', this._onNodeWakeUp.bind(this))
      .on('sleep', this._onNodeSleep.bind(this))
      .on('alive', this._onNodeAlive.bind(this))
      .on('dead', this._onNodeDead.bind(this))
      .on('value added', this._onNodeValueAdded.bind(this))
      .on('value updated', this._onNodeValueUpdated.bind(this))
      .on('value notification', this._onNodeValueNotification.bind(this))
      .on('value removed', this._onNodeValueRemoved.bind(this))
      .on('metadata updated', this._onNodeMetadataUpdated.bind(this))
      .on('notification', this._onNodeNotification.bind(this))
      .on(
        'firmware update progress',
        this._onNodeFirmwareUpdateProgress.bind(this)
      )
      .on(
        'firmware update finished',
        this._onNodeFirmwareUpdateFinished.bind(this)
      )
  }

  /**
   * Remove a node from internal nodes array
   *
   * @param {number} nodeid
   */
  _removeNode (nodeid) {
    logger.info(`Node removed ${nodeid}`)

    // don't use splice here, nodeid equals to the index in the array
    const node = this.nodes.get(nodeid)
    if (node) {
      this.nodes.delete(nodeid)

      this.emit('nodeRemoved', node)
      this.sendToSocket(socketEvents.nodeRemoved, node)
    }
  }

  /**
   * Add a new node to our nodes array. No informations are available yet, the node needs to be ready
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @returns {import('../types/index.js').Z2MNode}
   */
  _addNode (zwaveNode) {
    const nodeId = zwaveNode.id

    let node = this.nodes.get(nodeId)

    // this shouldn't happen
    if (node && node.ready) {
      logger.error(
        'Error while adding node ' + nodeId,
        Error('node has been added twice')
      )
      return
    }

    node = {
      id: nodeId,
      deviceId: null,
      manufacturer: null,
      manufacturerId: null,
      productType: null,
      productId: null,
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
      firmwareVersion: null,
      supportsBeaming: false,
      supportsSecurity: false,
      isSecure: false,
      keepAwake: false,
      maxBaudRate: null,
      isRouting: null,
      isFrequentListening: false,
      isListening: false,
      inited: false
    }

    this.nodes.set(nodeId, node)

    this._dumpNode(zwaveNode)
    this._bindNodeEvents(zwaveNode)
    this._onNodeStatus(zwaveNode)
    logger.debug(`Node ${nodeId} has been added to nodes array`)

    return node
  }

  /**
   * Initialize a node with all its info
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   */
  _dumpNode (zwaveNode) {
    const nodeId = zwaveNode.id

    const node = this.nodes.get(nodeId)

    const hexIds = [
      utils.num2hex(zwaveNode.manufacturerId),
      utils.num2hex(zwaveNode.productId),
      utils.num2hex(zwaveNode.productType)
    ]
    node.hexId = `${hexIds[0]}-${hexIds[2]}-${hexIds[1]}`
    node.dbLink = `https://devices.zwave-js.io/?jumpTo=${hexIds[0]}:${
      hexIds[2]
    }:${hexIds[1]}:${node.firmwareVersion || '0.0'}`

    const deviceConfig = zwaveNode.deviceConfig || {
      label: `Unknown product ${hexIds[1]}`,
      description: hexIds[2],
      manufacturer: `Unknown manufacturer ${hexIds[0]}`
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
    node.manufacturer = deviceConfig.manufacturer
    node.firmwareVersion = zwaveNode.firmwareVersion
    node.protocolVersion = zwaveNode.protocolVersion
    node.zwavePlusVersion = zwaveNode.zwavePlusVersion
    node.zwavePlusNodeType = zwaveNode.zwavePlusNodeType
    node.zwavePlusRoleType = zwaveNode.zwavePlusRoleType
    node.nodeType = zwaveNode.nodeType
    node.endpointsCount = zwaveNode.getEndpointCount()
    node.endpointIndizes = zwaveNode.getEndpointIndizes()
    node.isSecure = zwaveNode.isSecure
    node.supportsSecurity = zwaveNode.supportsSecurity
    node.supportsBeaming = zwaveNode.supportsBeaming
    node.isControllerNode = zwaveNode.isControllerNode()
    node.isListening = zwaveNode.isListening
    node.isFrequentListening = zwaveNode.isFrequentListening
    node.isRouting = zwaveNode.isRouting
    node.keepAwake = zwaveNode.keepAwake
    node.dataRate = zwaveNode.maxDataRate
    node.deviceClass = {
      basic: deviceClass.basic.key,
      generic: deviceClass.generic.key,
      specific: deviceClass.specific.key
    }

    const storedNode = this.storeNodes[nodeId]

    if (storedNode) {
      node.loc = storedNode.loc || ''
      node.name = storedNode.name || ''

      if (storedNode.hassDevices) {
        node.hassDevices = utils.copy(storedNode.hassDevices)
      }

      // keep zwaveNode and node name and location synced
      if (node.name && node.name !== zwaveNode.name) {
        zwaveNode.name = node.name
      }
      if (node.loc && node.loc !== zwaveNode.location) {
        zwaveNode.location = node.loc
      }
    } else {
      this.storeNodes[nodeId] = {}
    }

    node.deviceId = this._getDeviceID(node)
  }

  /**
   * Set value metadata to the internal valueId
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {import('zwave-js').TranslatedValueID} zwaveValue
   * @param {import('zwave-js').ValueMetadata} zwaveValueMeta
   * @returns The internal valueId
   */
  _updateValueMetadata (zwaveNode, zwaveValue, zwaveValueMeta) {
    zwaveValue.nodeId = zwaveNode.id

    const valueId = {
      id: this._getValueID(zwaveValue, true), // the valueId unique in the entire network, it also has the nodeId
      nodeId: zwaveNode.id,
      commandClass: zwaveValue.commandClass,
      commandClassName: zwaveValue.commandClassName,
      endpoint: zwaveValue.endpoint,
      property: zwaveValue.property,
      propertyName: zwaveValue.propertyName,
      propertyKey: zwaveValue.propertyKey,
      propertyKeyName: zwaveValue.propertyKeyName,
      type: zwaveValueMeta.type, // https://github.com/zwave-js/node-zwave-js/blob/cb35157da5e95f970447a67cbb2792e364b9d1e1/packages/core/src/values/Metadata.ts#L28
      readable: zwaveValueMeta.readable,
      writeable: zwaveValueMeta.writeable,
      description: zwaveValueMeta.description,
      label: zwaveValueMeta.label || zwaveValue.propertyName + ' (property)', // when label is missing, re use propertyName. Usefull for webinterface
      default: zwaveValueMeta.default,
      stateless: zwaveValue.stateless || false // used for notifications to specify that this should not be persisted (retained)
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
      valueId.allowManualEntry = zwaveValueMeta.allowManualEntry
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
   * @param { import('zwave-js').ZWaveNode } zwaveNode
   * @param { import('zwave-js').TranslatedValueID } zwaveValue
   * @param { Map<string, import('../types/index.js').Z2MValueId | undefined } oldValues old valueIds, used to check if the value was existing or not
   */
  _addValue (zwaveNode, zwaveValue, oldValues) {
    const node = this.nodes.get(zwaveNode.id)

    if (!node) {
      logger.info(`ValueAdded: no such node: ${zwaveNode.id} error`)
    } else {
      const zwaveValueMeta = zwaveNode.getValueMetadata(zwaveValue)

      const valueId = this._parseValue(zwaveNode, zwaveValue, zwaveValueMeta)

      const vID = this._getValueID(valueId)

      // a valueId is udpated when it doesn't exist or its value is updated
      const updated =
        !oldValues || !oldValues[vID] || oldValues[vID].value !== valueId.value

      logger.info(
        `Node ${zwaveNode.id}: value added ${valueId.id} => ${valueId.value}`
      )

      if (updated) {
        this.emit('valueChanged', valueId, node)
      }
    }
  }

  /**
   * Parse a zwave value into a valueID
   *
   * @param { import('zwave-js').ZWaveNode } zwaveNode
   * @param { import('zwave-js').TranslatedValueID } zwaveValue
   */
  _parseValue (zwaveNode, zwaveValue, zwaveValueMeta) {
    const node = this.nodes.get(zwaveNode.id)
    const valueId = this._updateValueMetadata(
      zwaveNode,
      zwaveValue,
      zwaveValueMeta
    )

    const vID = this._getValueID(valueId)

    valueId.value = zwaveNode.getValue(zwaveValue)

    if (valueId.value === undefined) {
      const prevValue = node.values[vID] ? node.values[vID].value : undefined
      valueId.value =
        zwaveValue.newValue !== undefined ? zwaveValue.newValue : prevValue
    }

    // ensure duration is never undefined
    if (valueId.type === 'duration' && valueId.value === undefined) {
      valueId.value = new Duration(undefined, 'seconds')
    }

    if (this._isCurrentValue(valueId)) {
      valueId.isCurrentValue = true
      const targetValue = this._findTargetValue(
        valueId,
        zwaveNode.getDefinedValueIDs()
      )
      if (targetValue) {
        valueId.targetValue = this._getValueID(targetValue)
      }
    }

    node.values[vID] = valueId

    return valueId
  }

  /**
   * Triggered when a node is ready and a value changes
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {import('zwave-js').ZWaveNodeValueUpdatedArgs} args
   */
  _updateValue (zwaveNode, args) {
    const node = this.nodes.get(zwaveNode.id)

    if (!node) {
      logger.info(`valueChanged: no such node: ${zwaveNode.id} error`)
    } else {
      let skipUpdate = false

      // notifications events are not defined as values, manually create them once we get the first update
      if (!node.values[this._getValueID(args)]) {
        this._addValue(zwaveNode, args)
        // addValue call already trigger valueChanged event
        skipUpdate = true
      }

      const valueId = node.values[this._getValueID(args)]

      if (valueId) {
        let newValue = args.newValue
        if (Buffer.isBuffer(newValue)) {
          // encode Buffers as HEX strings
          newValue = utils.buffer2hex(newValue)
        }

        let prevValue = args.prevValue
        if (Buffer.isBuffer(prevValue)) {
          // encode Buffers as HEX strings
          prevValue = utils.buffer2hex(prevValue)
        }

        valueId.value = newValue
        valueId.stateless = !!args.stateless

        // ensure duration is never undefined
        if (valueId.type === 'duration' && valueId.value === undefined) {
          valueId.value = new Duration(undefined, 'seconds')
        }

        if (!skipUpdate) {
          this.emit('valueChanged', valueId, node, prevValue !== newValue)
        }
      }

      // if valueId is stateless, automatically reset the value after 1 sec
      if (valueId.stateless) {
        if (this.statelessTimeouts[valueId.id]) {
          clearTimeout(this.statelessTimeouts[valueId.id])
        }

        this.statelessTimeouts[valueId.id] = setTimeout(() => {
          valueId.value = undefined
          this.emit('valueChanged', valueId, node, false)
        }, 1000)
      }

      node.lastActive = Date.now()
    }
  }

  /**
   * Remove a value from internal node values
   *
   * @param {import('zwave-js').ZWaveNode} zwaveNode
   * @param {import('zwave-js').ZWaveNodeValueRemovedArgs} args
   */
  _removeValue (zwaveNode, args) {
    const node = this.nodes.get(zwaveNode.id)
    const vID = this._getValueID(args)
    const toRemove = node ? node.values[vID] : null

    if (toRemove) {
      delete node.values[vID]
      this.sendToSocket(socketEvents.valueRemoved, toRemove)
      logger.info(`ValueRemoved: ${vID} from node ${zwaveNode.id}`)
    } else {
      logger.info(`ValueRemoved: no such node: ${zwaveNode.id} error`)
    }
  }

  // ------- Utils ------------------------

  _parseNotification (parameters) {
    if (Buffer.isBuffer(parameters)) {
      return parameters.toString('hex')
    } else if (parameters instanceof Duration) {
      return parameters.toMilliseconds()
    } else {
      return parameters
    }
  }

  /**
   * Get the device id of a specific node
   *
   * @param {import('../types/index.js').Z2MNode} node Internal node object
   * @returns A string in the format `<manufacturerId>-<productId>-<producttype>` that unique identifhy a zwave device
   */
  _getDeviceID (node) {
    if (!node) return ''

    return `${parseInt(node.manufacturerId)}-${parseInt(
      node.productId
    )}-${parseInt(node.productType)}`
  }

  /**
   * Check if a valueID is a current value
   *
   * @param {import('zwave-js').TranslatedValueID} valueId
   * @returns true if this is a current value, false otherwise
   */
  _isCurrentValue (valueId) {
    return valueId.propertyName && /current/i.test(valueId.propertyName)
  }

  /**
   * Find the target valueId of a current valueId
   *
   * @param {import('zwave-js').TranslatedValueID} valueId
   * @param {TranslatedValueID[]} definedValueIds
   * @returns
   */
  _findTargetValue (zwaveValue, definedValueIds) {
    return definedValueIds.find(
      v =>
        v.commandClass === zwaveValue.commandClass &&
        v.endpoint === zwaveValue.endpoint &&
        v.propertyKey === zwaveValue.propertyKey &&
        /target/i.test(v.property)
    )
  }

  /**
   * Get a valueId from a valueId object
   *
   * @param {import('../types/index.js').Z2MValueId} v The internal value id
   * @param {boolean} withNode Add node identifier
   * @returns The value id unique identifier
   */
  _getValueID (v, withNode) {
    return `${withNode ? v.nodeId + '-' : ''}${v.commandClass}-${v.endpoint ||
      0}-${v.property}${v.propertyKey !== undefined ? '-' + v.propertyKey : ''}`
  }

  /**
   * Function wrapping code used for writing queue.
   * fn - reference to function.
   * context - what you want "this" to be.
   * params - array of parameters to pass to function.
   */
  _wrapFunction (fn, context, params) {
    return function () {
      fn.apply(context, params)
    }
  }

  /**
   * Internal function to check for config updates automatically once a day
   *
   */
  async _scheduledConfigCheck () {
    try {
      await this.checkForConfigUpdates()
    } catch (error) {
      logger.warn(`Scheduled update check has failed: ${error.message}`)
    }

    const nextUpdate = new Date()
    nextUpdate.setHours(24, 0, 0, 0) // next midnight

    const waitMillis = nextUpdate.getTime() - Date.now()

    logger.info(`Next update scheduled for: ${nextUpdate}`)

    this.updatesCheckTimeout = setTimeout(
      this._scheduledConfigCheck.bind(this),
      waitMillis > 0 ? waitMillis : 1000
    )
  }

  /**
   * Try to poll a value, don't throw. Used in the setTimeout
   *
   * @param {import('../types/index.js').Z2MValueId} valueId
   * @param {number} interval seconds
   */
  async _tryPoll (valueId, interval) {
    try {
      await this.pollValue(valueId)
    } catch (error) {
      logger.error(
        `Error while polling value ${this._getValueID(valueId, true)}: ${
          error.message
        }`
      )
    }

    this.setPollInterval(valueId, interval)
  }
}

module.exports = ZwaveClient
