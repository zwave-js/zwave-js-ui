'use strict'

const reqlib = require('app-root-path').require
const inherits = require('util').inherits
const EventEmitter = require('events')
const logger = reqlib('/lib/logger.js').module('Socket')

// FIXME: this constants are duplicated on /src/plugins/socket.js. When converting this to ES6 module that can be removed
// events from server ---> client
const socketEvents = {
  init: 'INIT', // automatically sent when a new client connects to the socket
  controller: 'CONTROLLER_CMD', // controller status updates
  connected: 'CONNECTED', // socket status
  nodeRemoved: 'NODE_REMOVED',
  nodeUpdated: 'NODE_UPDATED',
  valueUpdated: 'VALUE_UPDATED',
  valueRemoved: 'VALUE_REMOVED',
  api: 'API_RETURN', // api results
  debug: 'DEBUG'
}

// events from client ---> server
const inboundEvents = {
  init: 'INITED', // get all nodes
  zwave: 'ZWAVE_API', // call a zwave api
  hass: 'HASS_API' // call an hass api
}

/**
 * The constructor
 */
function SocketManager () {
  if (!(this instanceof SocketManager)) {
    return new SocketManager()
  }
  EventEmitter.call(this)
}

inherits(SocketManager, EventEmitter)

/**
 * Binds socket.io to `server`
 *
 * @param {HttpServer} server
 */
SocketManager.prototype.bindServer = function (server) {
  this.server = server

  this.io = require('socket.io')(server)

  this.io.on('connection', onConnection.bind(this))
}

/**
 * Handles new socket connections
 *
 * @param {Socket} socket
 */
function onConnection (socket) {
  logger.info(`New connection ${socket.id}`)

  // register inbound events from this socket
  for (const k in inboundEvents) {
    const eventName = inboundEvents[k]
    // pass socket reference as first parameter
    socket.on(eventName, emitEvent.bind(this, eventName, socket))
  }

  socket.on('disconnect', function () {
    logger.info(`User disconnected ${socket.id}`)
  })
}

/**
 * Logs and emits the `eventName` with `socket` and `args` as parameters
 *
 * @param {string} eventName
 * @param {Socket} socket
 * @param {any} args
 */
function emitEvent (eventName, socket, ...args) {
  logger.info(`Event ${eventName} emitted to ${socket.id}`)
  this.emit(eventName, socket, ...args)
}

module.exports = SocketManager
module.exports.socketEvents = socketEvents
module.exports.inboundEvents = inboundEvents
