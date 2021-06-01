/* eslint-disable camelcase */
'use strict'

// eslint-disable-next-line one-var
import { Driver, NodeStatus, InterviewStage, extractFirmware, guessFirmwareFileFormat, libVersion, ZWaveNode, ValueID, AssociationGroup, AssociationAddress, CommandClass, FirmwareUpdateStatus, TranslatedValueID, ZWaveOptions, HealNodeStatus, NodeInterviewFailedEventArgs, ValueMetadata, ZWaveNodeMetadataUpdatedArgs, ZWaveNodeValueAddedArgs, ZWaveNodeValueNotificationArgs, ZWaveNodeValueRemovedArgs, ZWaveNodeValueUpdatedArgs } from 'zwave-js'
import { CommandClasses, Duration, ValueMetadataNumeric, ValueMetadataString, ZWaveErrorCodes } from '@zwave-js/core'
import * as utils from './utils.js'
import { EventEmitter } from 'events'
import jsonStore from './jsonStore.js'
import { socketEvents }from './SocketManager.js'
import store from '../config/store.js'
import { storeDir } from '../config/app.js'
import * as LogManager from './logger.js'

import { ZwavejsServer, serverVersion } from '@zwave-js/server'
import * as pkgjson from '../package.json'
import { Socket } from 'dgram'
import {EventSource, ZwaveConfig, Z2MScene, Z2MNode, Z2MDriverInfo, ZwaveClientStatus, HassDevice, Z2MValueIdScene, Z2MValueId } from '../types/index.js'

const logger = LogManager.module('Zwave')
const loglevels = require('triple-beam').configs.npm.levels


const NEIGHBORS_LOCK_REFRESH = 60 * 1000

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
  'installConfigUpdate',
  'pingNode',
  'restart'
]

const ZWAVEJS_LOG_FILE = utils.joinPath(storeDir, 'zwavejs_%DATE%.log')

/**
 * The constructor
 *
 * @param {ZwaveConfig} config
 * @param {Socket} socket
 * @returns {ZwaveClient}
 */
class ZwaveClient extends EventEmitter {

  cfg: ZwaveConfig
  socket: Socket
  closed: boolean
  driverReady: boolean
  scenes: Z2MScene[]
  nodes: Map<number, Z2MNode>
  storeNodes: Record<number, Partial<Z2MNode>>
  devices: Record<string, Partial<Z2MNode>>
  driverInfo: Z2MDriverInfo
  status: ZwaveClientStatus
  error: boolean | string
  scanComplete: boolean
  cntStatus: string
  connected: boolean
  lastUpdate: number

  driver: Driver

  server: ZwavejsServer
  statelessTimeouts: Record<string, NodeJS.Timeout>
  commandsTimeout: NodeJS.Timeout
  reconnectTimeout: NodeJS.Timeout
  healTimeout: NodeJS.Timeout
  updatesCheckTimeout: NodeJS.Timeout
  pollIntervals: Record<string, NodeJS.Timeout>

  private _lockNeighborsRefresh: boolean


  constructor (config, socket) {
    super()

    this.cfg = config
    this.socket = socket

    config.networkKey = config.networkKey || process.env.NETWORK_KEY

    this.init()
  }

  get homeHex () {
    return this.driverInfo.name
  }

  /**
   * Init internal vars
   */
  init () {
    this.statelessTimeouts = {}
    this.pollIntervals = {}

    this._lockNeighborsRefresh = false

    this.closed = false
    this.driverReady = false
    this.scenes = jsonStore.get(store.scenes)

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

    this.status = ZwaveClientStatus.CLOSED
  }

  /**
   * Restart client connection
   *
   * @returns {Promise<void>}
   */
  async restart (): Promise<void> {
    await this.close(true)
    this.init()
    return this.connect()
  }

  /**
   * Used to schedule next network heal at hours: cfg.healHours
   */
  scheduleHeal () {
    if (!this.cfg.healNetwork) {
      return
    }

    const now = new Date()
    let start : Date
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
   */
  getNode (nodeId: number): ZWaveNode {
    return this.driver.controller.nodes.get(nodeId)
  }

  /**
   * Returns the driver ZWaveNode ValueId object or null
   */
  getZwaveValue (idString: string): ValueID {
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
   */
  updateDevice (hassDevice: HassDevice, nodeId: number, deleteDevice: boolean) {
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
  addDevice (hassDevice: HassDevice, nodeId: number) {
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
   */
  async storeDevices (devices: {[key: string]: HassDevice}, nodeId: number, remove: any) {
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
   *
   * @param {boolean} keepListeners Prevents to remove all ZwaveCLient listeners (used when restarting)
   * @memberof ZwaveClient
   */
  async close (keepListeners: boolean) {
    this.status = ZwaveClientStatus.CLOSED
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
      await this.driver.destroy()
    }

    if (!keepListeners) {
      this.removeAllListeners()
    }

    logger.info('Client closed')
  }

  getStatus () {
    const status: {driverReady: boolean, status: boolean, config: ZwaveConfig} = {
      driverReady: this.driverReady,
      status: this.driverReady && !this.closed,
      config: this.cfg 
    }

    return status
  }

  /**
   * Popolate node `groups`
   *
   * @param {number} nodeId Zwave node id
   */
  async getGroups (nodeId: number, ignoreUpdate = false) {
    const zwaveNode = this.getNode(nodeId)
    const node = this.nodes.get(nodeId)
    if (node && zwaveNode) {
      let endpointGroups: ReadonlyMap<number, ReadonlyMap<number, AssociationGroup>>
      try {
        endpointGroups = this.driver.controller.getAllAssociationGroups(
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
   */
  async getAssociations (nodeId: number): Promise<AssociationAddress[]> {
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
   */
  async addAssociations (source: AssociationAddress, groupId: number, associations: AssociationAddress[]) {
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
   */
  async removeAssociations (source: AssociationAddress, groupId: number, associations: AssociationAddress[]) {
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
  async removeAllAssociations (nodeId: number) {
    const zwaveNode = this.getNode(nodeId)

    if (zwaveNode) {
      try {
        const allAssociations = this.driver.controller.getAllAssociations(
          nodeId
        )

        for (const [source, groupAssociations] of allAssociations.entries()) {
          for (const [groupId, associations] of groupAssociations) {
            if (associations.length > 0) {
              await this.driver.controller.removeAssociations(
                source as AssociationAddress,
                groupId,
                associations as AssociationAddress[]
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
  async removeNodeFromAllAssociations (nodeId: number) {
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
   */
  async refreshNeighbors (): Promise<Record<number, number[]>> {
    if (this._lockNeighborsRefresh === true) {
      throw Error('you can refresh neighbors only once every 60 seconds')
    }

    this._lockNeighborsRefresh = true

    // set the timeout here so if something fails later we don't keep the lock
    setTimeout(
      () => (this._lockNeighborsRefresh = false),
      NEIGHBORS_LOCK_REFRESH
    )

    const toReturn = {}
    // when accessing the controller memory, the Z-Wave radio must be turned off with to avoid resource conflicts and inconsistent data
    await this.driver.controller.toggleRF(false)
    for (const [nodeId, node] of this.nodes) {
      try {
        node.neighbors = (await this.getNodeNeighbors(nodeId, true)) as number[]
      } catch (error) {}
      toReturn[nodeId] = node.neighbors
    }
    // turn rf back to on
    await this.driver.controller.toggleRF(true)

    return toReturn
  }

  /**
   * Get neighbors of a specific node
   */
  async getNodeNeighbors (nodeId: number, dontThrow: boolean): Promise<Readonly<number[]>> {
    let neighbors : Readonly<number[]>
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
  driverFunction (code: string): Promise<any> {
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
      const zwaveOptions: ZWaveOptions = Object.assign(
        {
          storage: {
            cacheDir: storeDir,
            deviceConfigPriorityDir: storeDir + '/config'
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
          }
        },
        this.cfg.options
      )

      // transform network key to buffer
      if (zwaveOptions.networkKey && zwaveOptions.networkKey.length === 32) {
        zwaveOptions.networkKey = Buffer.from((zwaveOptions.networkKey as unknown) as string, 'hex')
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

        this.status = ZwaveClientStatus.CONNECTED
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
  sendToSocket (evtName: string, data: any) {
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
  async setNodeName (nodeid: number, name: string) {
    if (!this.storeNodes[nodeid]) {
      this.storeNodes[nodeid] = {} as Z2MNode
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
  async setNodeLocation (nodeid: number, loc: string) {
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
  async _createScene (label: string) {
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
  async _removeScene (sceneid: number) {
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
   */
  async _setScenes (scenes: Z2MScene[]) {
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
   */
  _sceneGetValues (sceneid: number) {
    const scene = this.scenes.find(s => s.sceneid === sceneid)
    if (!scene) {
      throw Error('No scene found with given sceneid')
    }
    return scene.values
  }

  /**
   * Add a value to a scene
   *
   */
  async _addSceneValue (sceneid: number, valueId: Z2MValueIdScene, value: any, timeout: number) {
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
   * @param {Z2MValueIdScene} valueId The valueId to remove
   * @throws Error if args valueid isn't valid
   */
  async _removeSceneValue (sceneid: number, valueId: Z2MValueIdScene) {
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
  _activateScene (sceneId: number): boolean {
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
   * @returns {Z2MNode[]}
   */
  getNodes (): Z2MNode[] {
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
  async refreshValues (nodeId: number): Promise<void> {
    if (this.driver && !this.closed) {
      const zwaveNode = this.getNode(nodeId)

      return zwaveNode.refreshValues()
    }

    throw Error('Driver is closed')
  }

  /**
   * Ping a node
   *
   * @param {number} nodeId
   * @returns {Promise<boolean>}
   */
  async pingNode (nodeId: number): Promise<boolean> {
    if (this.driver && !this.closed) {
      const zwaveNode = this.getNode(nodeId)

      return zwaveNode.ping()
    }

    throw Error('Driver is closed')
  }

  /**
   * Refresh all node values of a specific CC
   */
  async refreshCCValues (nodeId: number, cc: CommandClasses): Promise<void> {
    if (this.driver && !this.closed) {
      const zwaveNode = this.getNode(nodeId)

      return zwaveNode.refreshCCValues(cc)
    }

    throw Error('Driver is closed')
  }

  /**
   * Set a poll interval
   */
  setPollInterval (valueId: Z2MValueId, interval: number) {
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
   */
  async checkForConfigUpdates (): Promise<string | undefined> {
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
   */
  async installConfigUpdate (): Promise<boolean> {
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
   */
  async pollValue (valueId: Z2MValueId): Promise<any> {
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
  async replaceFailedNode (nodeId: number, secure: boolean = false): Promise<boolean> {
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
   */
  async startInclusion (secure: boolean): Promise<boolean> {
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
   */
  async startExclusion (): Promise<boolean> {
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
   */
  async stopExclusion (): Promise<boolean> {
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
   */
  async stopInclusion (): Promise<boolean> {
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
   */
  async healNode (nodeId: number): Promise<boolean> {
    if (this.driver && !this.closed) {
      return this.driver.controller.healNode(nodeId)
    }

    throw Error('Driver is closed')
  }

  /**
   * Check if a node is failed
   */
  async isFailedNode (nodeId: number): Promise<boolean> {
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
   */
  async removeFailedNode (nodeId: number): Promise<void> {
    if (this.driver && !this.closed) {
      return this.driver.controller.removeFailedNode(nodeId)
    }

    throw Error('Driver is closed')
  }

  /**
   * Re interview the node
   */
  async refreshInfo (nodeId: number): Promise<void> {
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
   */
  async beginFirmwareUpdate (nodeId: number, fileName: string, data: Buffer, target: number): Promise<void> {
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

  async abortFirmwareUpdate (nodeId: number) {
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
   */
  async sendCommand (ctx: { nodeId: number; endpoint: number; commandClass: CommandClasses | keyof typeof CommandClasses }, command: string, args: any[]): Promise<any> {
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
  async callApi (apiName: string, ...args: any[]) {
    let err: string, result: { message: any; args?: any; success?: boolean; result?: any }

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
    logger.log('info', `${result.message} ${apiName} %o`, result)

    result.args = args

    return result
  }

  /**
   * Send broadcast write request
   *
   */
  async writeBroadcast (valueId: ValueID, value: unknown) {
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
   */
  async writeMulticast (nodes: number[], valueId: Z2MValueId, value: unknown) {
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
   */
  async writeValue (valueId: Z2MValueId, value: any) {
    if (this.driverReady) {
      const vID = this._getValueID(valueId, true)
      logger.log('info', `Writing %o to ${vID}`, value)

      let result = false

      // coerce string to numbers when value type is number and received a string
      if (
        valueId.type === 'number' &&
        typeof value === 'string'
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
          this.emit('valueWritten', valueId, value)
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
    this.status = ZwaveClientStatus.DRIVER_READY
  
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

    this.emit('event', EventSource.DRIVER, 'driver ready', this.driverInfo)

    this.error = false

    // start server only when driver is ready. Fixes #602
    if (this.cfg.serverEnabled && this.server) {
      this.server.start()
    }

    logger.info(`Scanning network with homeid: ${homeHex}`)
  }

  async _onDriverError (error) {
    this.error = 'Driver: ' + error.message
    this.status = ZwaveClientStatus.DRIVER_FAILED
    this._updateControllerStatus(this.error)
    this.emit('event', EventSource.DRIVER, 'driver error', error)

    if (error.code === ZWaveErrorCodes.Driver_Failed) {
      // this cannot be recovered by zwave-js, requires a manual restart
      try {
        await this.restart()
      } catch (error) {
        logger.error(`Error while restarting driver: ${error.message}`)
      }
    }
  }

  _onScanComplete () {
    this.scanComplete = true

    this._updateControllerStatus('Scan completed')

    // all nodes are ready
    this.status = ZwaveClientStatus.SCAN_DONE

    logger.info(`Network scan complete. Found: ${this.nodes.size} nodes`)

    this.emit('scanComplete')

    this.emit('event', EventSource.DRIVER, 'all nodes ready')
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
    this.emit('event', EventSource.CONTROLLER, 'inclusion started', secure)
  }

  _onExclusionStarted () {
    const message = 'Exclusion started'
    this._updateControllerStatus(message)
    this.emit('event', EventSource.CONTROLLER, 'exclusion started')
  }

  _onInclusionStopped () {
    const message = 'Inclusion stopped'
    this._updateControllerStatus(message)
    this.emit('event', EventSource.CONTROLLER, 'inclusion stopped')
  }

  _onExclusionStopped () {
    const message = 'Exclusion stopped'
    this._updateControllerStatus(message)
    this.emit('event', EventSource.CONTROLLER, 'exclusion stopped')
  }

  _onInclusionFailed () {
    const message = 'Inclusion failed'
    this._updateControllerStatus(message)
    this.emit('event', EventSource.CONTROLLER, 'inclusion failed')
  }

  _onExclusionFailed () {
    const message = 'Exclusion failed'
    this._updateControllerStatus(message)
    this.emit('event', EventSource.CONTROLLER, 'exclusion failed')
  }

  /**
   * Triggered when a node is added
   *
   * @param {ZWaveNode} zwaveNode
   */
  _onNodeAdded (zwaveNode: ZWaveNode) {
    logger.info(`Node ${zwaveNode.id}: added`)

    // the driver is ready so this node has been added on fly
    if (this.driverReady) {
      const node = this._addNode(zwaveNode)
      this.sendToSocket(socketEvents.nodeAdded, node)
    }

    this.emit(
      'event',
      EventSource.CONTROLLER,
      'node added',
      this.nodes.get(zwaveNode.id)
    )
  }

  /**
   * Triggered when node is removed
   *
   * @param {ZWaveNode} zwaveNode
   */
  _onNodeRemoved (zwaveNode: ZWaveNode) {
    logger.info(`Node ${zwaveNode.id}: removed`)
    zwaveNode.removeAllListeners()

    this.emit(
      'event',
      EventSource.CONTROLLER,
      'node removed',
      this.nodes.get(zwaveNode.id)
    )

    this._removeNode(zwaveNode.id)
  }

  /**
   * Triggered on each progress of healing process
   */
  _onHealNetworkProgress (progress: ReadonlyMap<number, HealNodeStatus>) {
    const toHeal = [...progress.values()]
    const healedNodes = toHeal.filter(v => v !== 'pending')
    const message = `Healing process IN PROGRESS. Healed ${healedNodes.length} nodes`
    this._updateControllerStatus(message)
    this.sendToSocket(socketEvents.healProgress, [...progress.entries()])

    // update heal progress status
    for (const [nodeId, status] of progress) {
      this.nodes.get(nodeId).healProgress = status
    }

    this.emit(
      'event',
      EventSource.CONTROLLER,
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
   * @param {ZWaveNode} zwaveNode
   */
  _onNodeStatus (zwaveNode: ZWaveNode) {
    const node = this.nodes.get(zwaveNode.id)

    if (node) {
      // https://github.com/zwave-js/node-zwave-js/blob/master/packages/zwave-js/src/lib/node/Types.ts#L127
      node.status = NodeStatus[zwaveNode.status] as keyof typeof NodeStatus
      node.available = zwaveNode.status !== NodeStatus.Dead
      node.interviewStage = InterviewStage[zwaveNode.interviewStage] as keyof typeof InterviewStage
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
   * @param {ZWaveNode} zwaveNode
   */
  async _onNodeReady (zwaveNode: ZWaveNode) {
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
      EventSource.NODE,
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
   * @param {ZWaveNode} zwaveNode
   */
  _onNodeInterviewStarted (zwaveNode: ZWaveNode) {
    const node = this.nodes.get(zwaveNode.id)

    logger.info(`Node ${zwaveNode.id}: interview started`)

    this.emit('event', EventSource.NODE, 'node interview started', node)
  }

  /**
   * Triggered when an interview stage complete
   *
   * @param {ZWaveNode} zwaveNode
   * @param {string} stageName completed stage name
   */
  _onNodeInterviewStageCompleted (zwaveNode: ZWaveNode, stageName: string) {
    const node = this.nodes.get(zwaveNode.id)

    logger.info(
      `Node ${
        zwaveNode.id
      }: interview stage ${stageName.toUpperCase()} completed`
    )

    this._onNodeStatus(zwaveNode)

    this.emit(
      'event',
      EventSource.NODE,
      'node interview stage completed',
      node
    )
  }

  /**
   * Triggered when a node finish its interview. When this event is triggered all node values and metadata are updated
   * Starting from zwave-js v7 this event is only triggered when the node is added the first time or manually re-interviewed
   *
   * @param {ZWaveNode} zwaveNode
   */
  _onNodeInterviewCompleted (zwaveNode: ZWaveNode) {
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
      EventSource.NODE,
      'node interview completed',
      this.nodes.get(zwaveNode.id)
    )
  }

  /**
   * Triggered when a node interview fails.
   *
   * @param {ZWaveNode} zwaveNode
   * @param {NodeInterviewFailedEventArgs} args
   */
  _onNodeInterviewFailed (zwaveNode: ZWaveNode, args: NodeInterviewFailedEventArgs) {
    logger.error(
      `Interview of node ${zwaveNode.id} has failed: ${args.errorMessage}`
    )

    this._onNodeStatus(zwaveNode)

    this.emit(
      'event',
      EventSource.NODE,
      'node interview failed',
      this.nodes.get(zwaveNode.id)
    )
  }

  /**
   * Triggered when a node wake ups
   *
   * @param {ZWaveNode} zwaveNode
   * @param {NodeStatus} oldStatus
   */
  _onNodeWakeUp (zwaveNode: ZWaveNode, oldStatus: NodeStatus) {
    logger.info(
      `Node ${zwaveNode.id} is ${
        oldStatus === NodeStatus.Unknown ? '' : 'now '
      }awake`
    )

    this._onNodeStatus(zwaveNode)
    this.emit(
      'event',
      EventSource.NODE,
      'node wakeup',
      this.nodes.get(zwaveNode.id)
    )
  }

  /**
   * Triggered when a node is sleeping
   *
   * @param {ZWaveNode} zwaveNode
   * @param {NodeStatus} oldStatus
   */
  _onNodeSleep (zwaveNode: ZWaveNode, oldStatus: NodeStatus) {
    logger.info(
      `Node ${zwaveNode.id} is ${
        oldStatus === NodeStatus.Unknown ? '' : 'now '
      }asleep`
    )
    this._onNodeStatus(zwaveNode)
    this.emit(
      'event',
      EventSource.NODE,
      'node sleep',
      this.nodes.get(zwaveNode.id)
    )
  }

  /**
   * Triggered when a node is alive
   *
   * @param {ZWaveNode} zwaveNode
   * @param {NodeStatus} oldStatus
   */
  _onNodeAlive (zwaveNode: ZWaveNode, oldStatus: NodeStatus) {
    this._onNodeStatus(zwaveNode)
    if (oldStatus === NodeStatus.Dead) {
      logger.info(`Node ${zwaveNode.id}: has returned from the dead`)
    } else {
      logger.info(`Node ${zwaveNode.id} is alive`)
    }

    this.emit(
      'event',
      EventSource.NODE,
      'node alive',
      this.nodes.get(zwaveNode.id)
    )
  }

  /**
   * Triggered when a node is dead
   *
   * @param {ZWaveNode} zwaveNode
   * @param {NodeStatus} oldStatus
   */
  _onNodeDead (zwaveNode: ZWaveNode, oldStatus: NodeStatus) {
    this._onNodeStatus(zwaveNode)
    logger.info(
      `Node ${zwaveNode.id} is ${
        oldStatus === NodeStatus.Unknown ? '' : 'now '
      }dead`
    )

    this.emit(
      'event',
      EventSource.NODE,
      'node dead',
      this.nodes.get(zwaveNode.id)
    )
  }

  /**
   * Triggered when a node value is added
   *
   * @param {ZWaveNode} zwaveNode
   * @param {ZWaveNodeValueAddedArgs} args
   */
  _onNodeValueAdded (zwaveNode: ZWaveNode, args: ZWaveNodeValueAddedArgs) {
    logger.info(
      `Node ${zwaveNode.id}: value added: ${this._getValueID((args as unknown) as Z2MValueId)} => ${
        args.newValue
      }`
    )

    // handle node values added 'on fly'
    if (zwaveNode.ready) {
      this._addValue(zwaveNode, args)
    }

    this.emit(
      'event',
      EventSource.NODE,
      'node value added',
      this.nodes.get(zwaveNode.id),
      args
    )
  }

  /**
   * Emitted when we receive a `value notification` event
   *
   * @param {ZWaveNode} zwaveNode
   * @param {ZWaveNodeValueNotificationArgs} args
   */
  _onNodeValueNotification (zwaveNode: ZWaveNode, args: ZWaveNodeValueNotificationArgs & {newValue?: any, stateless: boolean}) {
    // notification hasn't `newValue`
    args.newValue = args.value
    // specify that this is stateless
    args.stateless = true

    this._onNodeValueUpdated(zwaveNode, args)
  }

  /**
   * Emitted when we receive a `value updated` event
   *
   * @param {ZWaveNode} zwaveNode
   * @param {ZWaveNodeValueUpdatedArgs} args
   * @param {boolean} isNotification
   */
  _onNodeValueUpdated (zwaveNode: ZWaveNode, args: (ZWaveNodeValueUpdatedArgs | ZWaveNodeValueNotificationArgs) & {prevValue?: any, newValue?: any, stateless: boolean}) {
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
      EventSource.NODE,
      'node value updated',
      this.nodes.get(zwaveNode.id),
      args
    )
  }

  /**
   * Emitted when we receive a `value removed` event
   *
   * @param {ZWaveNode} zwaveNode
   * @param {ZWaveNodeValueRemovedArgs} args
   */
  _onNodeValueRemoved (zwaveNode: ZWaveNode, args: ZWaveNodeValueRemovedArgs) {
    this._removeValue(zwaveNode, args)
    logger.info(
      `Node ${zwaveNode.id}: value removed: ${this._getValueID(args)}`
    )
    this.emit(
      'event',
      EventSource.NODE,
      'node value removed',
      this.nodes.get(zwaveNode.id),
      args
    )
  }

  /**
   * Emitted when we receive a `metadata updated` event
   *
   * @param {ZWaveNode} zwaveNode
   * @param {ZWaveNodeMetadataUpdatedArgs} args
   */
  _onNodeMetadataUpdated (zwaveNode: ZWaveNode, args: ZWaveNodeMetadataUpdatedArgs) {
    const valueId = this._parseValue(zwaveNode, args, args.metadata)
    logger.info(
      `Node ${valueId.nodeId}: metadata updated: ${this._getValueID(args as unknown as Z2MValueId)}`
    )
    this.emit(
      'event',
      EventSource.NODE,
      'node metadata updated',
      this.nodes.get(zwaveNode.id),
      args
    )
  }

  /**
   * Emitted when we receive a node `notification` event
   *
   * @param {ZWaveNode} zwaveNode
   * @param {CommandClasses} ccId
   * @param {Record<string, unknown>} args
   */
  _onNodeNotification (zwaveNode: ZWaveNode, ccId: CommandClasses, args: Record<string, unknown>) {
    const valueId: Partial<Z2MValueId>= {
      id: null,
      nodeId: zwaveNode.id,
      commandClass: ccId,
      commandClassName: CommandClasses[ccId],
      property: null
    }

    let data = null

    if (ccId === CommandClasses.Notification) {
      valueId.property = args.label as string
      valueId.propertyKey = args.eventLabel as string

      data = this._parseNotification(args.parameters)
    } else if (ccId === CommandClasses['Entry Control']) {
      valueId.property = args.eventType as string
      valueId.propertyKey = args.dataType as string
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
      EventSource.NODE,
      'node notification',
      node,
      valueId,
      data
    )
  }

  /**
   * Emitted when we receive a node `firmware update progress` event
   *
   * @param {ZWaveNode} zwaveNode
   * @param {number} sentFragments
   * @param {number} totalFragments
   */
  _onNodeFirmwareUpdateProgress (zwaveNode: ZWaveNode, sentFragments: number, totalFragments: number) {
    this._updateControllerStatus(
      `Node ${zwaveNode.id} firmware update IN PROGRESS: ${sentFragments}/${totalFragments}`
    )
    this.emit(
      'event',
      EventSource.NODE,
      'node firmware update progress',
      this.nodes.get(zwaveNode.id),
      sentFragments,
      totalFragments
    )
  }

  /**
   * Triggered we receive a node `firmware update finished` event
   *
   * @param {ZWaveNode} zwaveNode
   * @param {FirmwareUpdateStatus} status
   * @param {number} waitTime
   */
  _onNodeFirmwareUpdateFinished (zwaveNode: ZWaveNode, status: FirmwareUpdateStatus, waitTime: number) {
    this._updateControllerStatus(
      `Node ${zwaveNode.id} firmware update FINISHED: Status ${status}, Time: ${waitTime}`
    )

    this.emit(
      'event',
      EventSource.NODE,
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
   * @param {ZWaveNode} zwaveNode
   */
  _bindNodeEvents (zwaveNode: ZWaveNode) {
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
  _removeNode (nodeid: number) {
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
   * @param {ZWaveNode} zwaveNode
   * @returns {Z2MNode}
   */
  _addNode (zwaveNode: ZWaveNode): Z2MNode {
    const nodeId = zwaveNode.id

    let existingNode = this.nodes.get(nodeId)

    // this shouldn't happen
    if (existingNode && existingNode.ready) {
      logger.error(
        'Error while adding node ' + nodeId,
        Error('node has been added twice')
      )
      return
    }

    const node: Z2MNode = {
      id: nodeId,
      name: this.storeNodes[nodeId] ? this.storeNodes[nodeId].name : '',
      loc: this.storeNodes[nodeId] ? this.storeNodes[nodeId].loc : '',
      values: {},
      groups: [],
      neighbors: [],
      ready: false,
      available: false,
      hassDevices: {},
      failed: false,
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
   * @param {ZWaveNode} zwaveNode
   */
  _dumpNode (zwaveNode: ZWaveNode) {
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

    // https://zwave-js.github.io/node-zwave-js/#/api/node?id=zwavenode-properties
    node.manufacturerId = zwaveNode.manufacturerId
    node.productId = zwaveNode.productId
    node.productType = zwaveNode.productType

    node.productLabel = deviceConfig.label
    node.productDescription = deviceConfig.description
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
    node.maxDataRate = zwaveNode.maxDataRate
    node.deviceClass = {
      basic: zwaveNode.deviceClass?.basic.key,
      generic: zwaveNode.deviceClass?.generic.key,
      specific: zwaveNode.deviceClass?.specific.key
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
   * @param {ZWaveNode} zwaveNode
   * @param {TranslatedValueID} zwaveValue
   * @param {ValueMetadata} zwaveValueMeta
   * @returns The internal valueId
   */
  _updateValueMetadata (zwaveNode: ZWaveNode, zwaveValue: TranslatedValueID & {[x:string]: any}, zwaveValueMeta: ValueMetadata): Z2MValueId {
    zwaveValue.nodeId = zwaveNode.id

    const valueId: Z2MValueId = {
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
      ccSpecific: zwaveValueMeta.ccSpecific,
      stateless: zwaveValue.stateless || false // used for notifications to specify that this should not be persisted (retained)
    }

    // Value types: https://github.com/zwave-js/node-zwave-js/blob/cb35157da5e95f970447a67cbb2792e364b9d1e1/packages/core/src/values/Metadata.ts#L28
    if (zwaveValueMeta.type === 'number') {
      valueId.min = (zwaveValueMeta as ValueMetadataNumeric).min
      valueId.max = (zwaveValueMeta as ValueMetadataNumeric).max
      valueId.step = (zwaveValueMeta as ValueMetadataNumeric).steps
      valueId.unit = (zwaveValueMeta as ValueMetadataNumeric).unit
    } else if (zwaveValueMeta.type === 'string') {
      valueId.minLength = (zwaveValueMeta as ValueMetadataString).minLength
      valueId.maxLength = (zwaveValueMeta as ValueMetadataString).maxLength
    }

    if (utils.hasProperty(zwaveValueMeta, 'states')) {
      valueId.list = true
      // @ts-ignore TODO: Missing type in zwave-js
      valueId.allowManualEntry = zwaveValueMeta.allowManualEntry
      valueId.states = []
      for (const k in (zwaveValueMeta as ValueMetadataNumeric).states) {
        valueId.states.push({
          text: (zwaveValueMeta as ValueMetadataNumeric).states[k],
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
   */
  _addValue (zwaveNode: ZWaveNode, zwaveValue: TranslatedValueID, oldValues?: {
    [key: string]: Z2MValueId;
}) {
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
   * @param { ZWaveNode } zwaveNode
   * @param { TranslatedValueID } zwaveValue
   */
  _parseValue (zwaveNode: ZWaveNode, zwaveValue: TranslatedValueID & {[x: string]: any}, zwaveValueMeta: ValueMetadata) {
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
   * @param {ZWaveNode} zwaveNode
   * @param {ZWaveNodeValueUpdatedArgs} args
   */
  _updateValue (zwaveNode: ZWaveNode, args: TranslatedValueID & {[x:string]: any} ) {
    const node = this.nodes.get(zwaveNode.id)

    if (!node) {
      logger.info(`valueChanged: no such node: ${zwaveNode.id} error`)
    } else {
      let skipUpdate = false

      const vID = this._getValueID(args as unknown as Z2MValueId)

      // notifications events are not defined as values, manually create them once we get the first update
      if (!node.values[vID]) {
        this._addValue(zwaveNode, args)
        // addValue call already trigger valueChanged event
        skipUpdate = true
      }

      const valueId = node.values[vID]

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
   * @param {ZWaveNode} zwaveNode
   * @param {ZWaveNodeValueRemovedArgs} args
   */
  _removeValue (zwaveNode: ZWaveNode, args: ZWaveNodeValueRemovedArgs) {
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
   * @param {Z2MNode} node Internal node object
   * @returns A string in the format `<manufacturerId>-<productId>-<producttype>` that unique identifhy a zwave device
   */
  _getDeviceID (node: Z2MNode) {
    if (!node) return ''

    return `${node.manufacturerId}-${node.productId}-${node.productType}`
  }

  /**
   * Check if a valueID is a current value
   */
  _isCurrentValue (valueId: TranslatedValueID | Z2MValueId) {
    return valueId.propertyName && /current/i.test(valueId.propertyName)
  }

  /**
   * Find the target valueId of a current valueId
   */
  _findTargetValue (zwaveValue: TranslatedValueID, definedValueIds: TranslatedValueID[]) {
    return definedValueIds.find(
      v =>
        v.commandClass === zwaveValue.commandClass &&
        v.endpoint === zwaveValue.endpoint &&
        v.propertyKey === zwaveValue.propertyKey &&
        /target/i.test(v.property.toString())
    )
  }

  /**
   * Get a valueId from a valueId object
   */
  _getValueID (v: Partial<Z2MValueId> & {[x: string]: any} , withNode: boolean = false) {
    return `${withNode ? v.nodeId + '-' : ''}${v.commandClass}-${v.endpoint ||
      0}-${v.property}${v.propertyKey !== undefined ? '-' + v.propertyKey : ''}`
  }

  /**
   * Function wrapping code used for writing queue.
   * fn - reference to function.
   * context - what you want "this" to be.
   * params - array of parameters to pass to function.
   */
  _wrapFunction (fn: (...args: any) => any, context: any, params: any[]) {
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
   * @param {Z2MValueId} valueId
   * @param {number} interval seconds
   */
  async _tryPoll (valueId: Z2MValueId, interval: number) {
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
