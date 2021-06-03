"use strict";

import { EventEmitter } from "events";
import { Server as HttpServer } from "http";
import { module } from "./logger";
import { Server as SocketServer, Socket } from "socket.io";

const logger = module("Socket");

// FIXME: this constants are duplicated on /src/plugins/socket.js. When converting this to ES6 module that can be removed
// events from server ---> client
export const socketEvents = {
  init: "INIT", // automatically sent when a new client connects to the socket
  controller: "CONTROLLER_CMD", // controller status updates
  connected: "CONNECTED", // socket status
  nodeAdded: "NODE_ADDED",
  nodeRemoved: "NODE_REMOVED",
  nodeUpdated: "NODE_UPDATED",
  valueUpdated: "VALUE_UPDATED",
  valueRemoved: "VALUE_REMOVED",
  healProgress: "HEAL_PROGRESS",
  info: "INFO",
  api: "API_RETURN", // api results
  debug: "DEBUG",
};

// events from client ---> server
export const inboundEvents = {
  init: "INITED", // get all nodes
  zwave: "ZWAVE_API", // call a zwave api
  hass: "HASS_API", // call an hass api
  mqtt: "MQTT_API", // call an mqtt api
};

/**
 * The constructor
 */
export default class SocketManager extends EventEmitter {
  server: HttpServer;
  io: SocketServer;
  authMiddleware: (socket: Socket, next: () => void) => void | undefined;

  /**
   * Binds socket.io to `server`
   *
   * @param {HttpServer} server
   */
  bindServer(server: HttpServer) {
    this.server = server;

    this.io = new SocketServer(server);

    this.io
      .use(this._authMiddleware())
      .on("connection", this._onConnection.bind(this));
  }

  _authMiddleware(): (socket: Socket, next: () => void) => void {
    return (socket: Socket, next: () => void) => {
      if (this.authMiddleware !== undefined) {
        this.authMiddleware(socket, next);
      } else {
        next();
      }
    };
  }

  /**
   * Handles new socket connections
   *
   * @param {Socket} socket
   */
  _onConnection(socket: {
    id: any;
    on: (arg0: string, arg1: () => void) => void;
  }) {
    logger.debug(`New connection ${socket.id}`);

    // register inbound events from this socket
    for (const k in inboundEvents) {
      const eventName = inboundEvents[k];
      // pass socket reference as first parameter
      socket.on(eventName, this._emitEvent.bind(this, eventName, socket));
    }

    socket.on("disconnect", function () {
      logger.debug(`User disconnected ${socket.id}`);
    });
  }

  /**
   * Logs and emits the `eventName` with `socket` and `args` as parameters
   *
   * @param {string} eventName
   * @param {Socket} socket
   * @param {any} args
   */
  _emitEvent(eventName: string, socket: { id: any }, ...args: any[]) {
    logger.debug(`Event ${eventName} emitted to ${socket.id}`);
    this.emit(eventName, socket, ...args);
  }
}
