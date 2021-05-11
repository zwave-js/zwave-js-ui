'use strict'

const reqlib = require('app-root-path').require
const EventEmitter = require('events')
const logger = reqlib('/lib/logger.js').module('Socket')

// FIXME: this constants are duplicated on /src/plugins/socket.js. When converting this to ES6 module that can be removed
// events from server ---> client
const socketEvents = {
  init: 'INIT', // automatically sent when a new client connects to the socket
  controller: 'CONTROLLER_CMD', // controller status updates
  connected: 'CONNECTED', // socket status
  nodeAdded: 'NODE_ADDED',
  nodeRemoved: 'NODE_REMOVED',
  nodeUpdated: 'NODE_UPDATED',
  valueUpdated: 'VALUE_UPDATED',
  valueRemoved: 'VALUE_REMOVED',
  info: 'INFO',
  api: 'API_RETURN', // api results
  debug: 'DEBUG'
}

// events from client ---> server
const inboundEvents = {
  init: 'INITED', // get all nodes
  zwave: 'ZWAVE_API', // call a zwave api
  hass: 'HASS_API', // call an hass api
  mqtt: 'MQTT_API' // call an mqtt api
}

/**
 * The constructor
 */
class SocketManager extends EventEmitter {
  /**
   * Binds socket.io to `server`
   *
   * @param {HttpServer} server
   */
  bindServer (server) {
    this.server = server

    this.io = require('socket.io')(server)

    this.io
      .use(this._authMiddleware())
      .on('connection', this._onConnection.bind(this))
  }

  _authMiddleware () {
    return (socket, next) => {
      if (this.authMiddleware) {
        this.authMiddleware(socket, next)
      } else {
        next()
      }
    }
  }

  /**
   * Handles new socket connections
   *
   * @param {Socket} socket
   */
  _onConnection (socket) {
    logger.debug(`New connection ${socket.id}`)

    // register inbound events from this socket
    for (const k in inboundEvents) {
      const eventName = inboundEvents[k]
      // pass socket reference as first parameter
      socket.on(eventName, this._emitEvent.bind(this, eventName, socket))
    }

    socket.on('disconnect', function () {
      logger.debug(`User disconnected ${socket.id}`)
    })
  }

  /**
   * Logs and emits the `eventName` with `socket` and `args` as parameters
   *
   * @param {string} eventName
   * @param {Socket} socket
   * @param {any} args
   */
  _emitEvent (eventName, socket, ...args) {
    logger.debug(`Event ${eventName} emitted to ${socket.id}`)
    this.emit(eventName, socket, ...args)
  }
}

module.exports = SocketManager
module.exports.socketEvents = socketEvents
module.exports.inboundEvents = inboundEvents
