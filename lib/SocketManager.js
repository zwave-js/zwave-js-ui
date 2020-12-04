'use strict'

const reqlib = require('app-root-path').require
const inherits = require('util').inherits
const EventEmitter = require('events')
const debug = reqlib('/lib/debug')('Socket')

debug.color = 3

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

const inboundEvents = {
  init: 'INITED',
  zwave: 'ZWAVE_API',
  hass: 'HASS_API'
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
  debug('New connection', socket.id)

  // register inbound events from this socket
  for (const k in inboundEvents) {
    const eventName = inboundEvents[k]
    // pass socket reference as first parameter
    socket.on(eventName, emitEvent.bind(this, eventName, socket))
  }

  socket.on('disconnect', function () {
    debug('User disconnected', socket.id)
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
  debug(`Event ${eventName} emitted to ${socket.id}`)
  this.emit(eventName, socket, ...args)
}

module.exports = SocketManager
module.exports.socketEvents = socketEvents
module.exports.inboundEvents = inboundEvents
