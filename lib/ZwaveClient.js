'use strict'

var reqlib = require('app-root-path').require,
OpenZWave = require('openzwave-shared'),
utils = reqlib('/lib/utils.js'),
EventEmitter = require('events'),
inherits = require('util').inherits;

//Events to subscribe to
var ozwEvents = {
  'driver ready': driverReady,
  'driver failed': driverFailed,
  'node added': nodeAdded,
  'node ready': nodeReady,
  'node event': nodeEvent,
  'scene event': sceneEvent,
  'value added': valueAdded,
  'value changed': valueChanged,
  'value removed': valueRemoved,
  'notification': notification,
  'scan complete': scanComplete,
  'controller command': controllerCommand
};


/**
* The constructor
*/
function ZwaveClient (config) {
  if (!(this instanceof ZwaveClient)) {
    return new ZwaveClient(config)
  }
  EventEmitter.call(this);
  init.call(this, config);
}

inherits(ZwaveClient, EventEmitter);

function init(cfg){

  this.cfg = cfg;

  //Full option list: https://github.com/OpenZWave/open-zwave/wiki/Config-Options
  var client = new OpenZWave({
    Logging: (cfg.logging != "off"),
    ConsoleOutput: (cfg.logging != "off"),
    QueueLogLevel: ((cfg.logging == "full") ? 8 : 6),
    UserPath: utils.getPath(true), //where to store config files
    DriverMaxAttempts: cfg.driverattempts || 3,
    NetworkKey: cfg.networkkey || "",
    SaveConfiguration: cfg.saveConfig,
    DriverMaxAttempts: 3,
    //ConfigPath: , //where zwave devices database resides
    //PollInterval: 500,
    //SuppressValueRefresh: true,
  });

  this.nodes = [];

  this.client = client;
  this.ozwConfig = {};

  var self = this;

  Object.keys(ozwEvents).forEach(function(evt) {
    client.on(evt, ozwEvents[evt].bind(self));
  });

  sendLog(this, "Connecting to", cfg.port);
  client.connect(cfg.port);
}

function driverReady(homeid) {
  this.driverReadyStatus = true;
  this.ozwConfig.homeid = homeid;
  var homeHex = '0x' + homeid.toString(16);
  this.ozwConfig.name = homeHex;
  sendLog(this, 'Scanning network with homeid:', homeHex);
}

function driverFailed() {
  sendLog(this, 'Driver failed', this.ozwConfig);
}

function nodeAdded(nodeid) {
  this.nodes[nodeid] = {
    manufacturer: '',
    manufacturerid: '',
    product: '',
    producttype: '',
    productid: '',
    type: '',
    name: '',
    loc: '',
    classes: {},
    ready: false,
  };
  sendLog(this, "Node added", nodeid)
}

function valueAdded(nodeid, comclass, valueId) {
  var ozwnode = this.nodes[nodeid];
  if (!ozwnode) {
    sendLog(this, 'ValueAdded: no such node: '+nodeid, 'error');
  }
  if (!ozwnode['classes'][comclass])
  ozwnode['classes'][comclass] = {};
  if (!ozwnode['classes'][comclass][valueId.instance])
  ozwnode['classes'][comclass][valueId.instance] = {};
  // add to cache
  sendLog(this, "ValueAdded", JSON.stringify(valueId));
  ozwnode['classes'][comclass][valueId.instance][valueId.index] = valueId;
}

function valueChanged(nodeid, comclass, valueId) {
  var ozwnode = this.nodes[nodeid];
  if (!ozwnode) {
    sendLog(this, 'valueChanged: no such node: '+nodeid, 'error');
  } else {
    // valueId: OpenZWave ValueID (struct) - not just a boolean
    var oldst;
    if (ozwnode.ready) {
      oldst = ozwnode['classes'][comclass][valueId.instance][valueId.index].value;
      sendLog(this, `zwave node ${nodeid}: changed: ${comclass}:${valueId['label']}:${oldst} -> ${JSON.stringify(valueId)}`);
    }
    // update cache
    ozwnode['classes'][comclass][valueId.instance][valueId.index] = valueId;
  }
}

function valueRemoved(nodeid, comclass, instance, index) {
  var ozwnode = this.nodes[nodeid];
  if (ozwnode &&
    ozwnode['classes'] &&
    ozwnode['classes'][comclass] &&
    ozwnode['classes'][comclass][instance] &&
    ozwnode['classes'][comclass][instance][index]) {
      delete ozwnode['classes'][comclass][instance][index];
    } else {
      sendLog(this, 'valueRemoved: no such node: '+nodeid, 'error');
    }
  }

  function nodeReady(nodeid, nodeinfo) {
    var ozwnode = this.nodes[nodeid];
    if (ozwnode) {
      for (var attrname in nodeinfo) {
        if (nodeinfo.hasOwnProperty(attrname)) {
          ozwnode[attrname] = nodeinfo[attrname];
        }
      }
      ozwnode.ready = true;

      for (var comclass in ozwnode['classes']) {
        switch (comclass) {
          case 0x25: // COMMAND_CLASS_SWITCH_BINARY
          case 0x26: // COMMAND_CLASS_SWITCH_MULTILEVEL
          case 0x30: // COMMAND_CLASS_SENSOR_BINARY
          case 0x31: // COMMAND_CLASS_SENSOR_MULTILEVEL
          case 0x60: // COMMAND_CLASS_MULTI_INSTANCE
          this.client.enablePoll(nodeid, comclass);
          break;
        }
        var values = ozwnode['classes'][comclass];

        for (var inst in values)
        for (var idx in values[inst]) {
          var ozwval = values[inst][idx];
          var rdonly = ozwval.read_only ? '*' : ' ';
          var wronly = ozwval.write_only ? '*' : ' ';
          //log('full', util.format(
          //    '\t|%s|%s| %s: %s:\t%s\t', rdonly, wronly, ozwval.value_id, ozwval.label, ozwval.value));
        }
      }
      //
      sendLog(this, 'node ready', nodeid, nodeinfo);
    }
  }

  function nodeEvent(nodeid, evtcode) {
    sendLog(this, 'node event', nodeid, evtcode);
  }

  function sceneEvent(nodeid, scene) {
    sendLog(this, 'scene event', nodeid, scene);
  }

  function notification(nodeid, notif, help) {
    var msg = "";
    switch (notif) {
      case 0:
      msg = 'node%d: message complete';
      break;
      case 1:
      msg = 'node%d: timeout';
      break;
      case 2:
      msg = 'node%d: nop';
      break;
      case 3:
      msg = 'node%d: node awake';
      break;
      case 4:
      msg = 'node%d: node sleep';
      break;
      case 5:
      msg = 'node%d: node dead';
      this.nodes[nodeid].ready = false;
      break;
      case 6:
      this.nodes[nodeid].ready = true;
      break;
      default:
      msg = "Unknown notification code " + notif
    }

    sendLog(this, 'notification', {
      nodeid: nodeid,
      notification: notif,
      help: help
    });
  }

  function scanComplete() {
    sendLog(this, 'Network scan complete.', this.nodes);
  }

  function controllerCommand(nodeid, state, errcode, help) {
    var obj = {
      nodeid: nodeid,
      state: state,
      errcode: errcode,
      help: help
    };
    sendLog(this, 'controller command', obj);
  }

  /**
  * Method used to close clients connection, use this before destroy
  */
  ZwaveClient.prototype.close = function () {

    if(this.client)
    this.client.disconnect(this.cfg.port);;
  }

  /**
  * Used to identify an unique client
  */
  Object.defineProperty(ZwaveClient.prototype, '_id', {
    get: function () {
      return this.cfg._id;
    },
    enumerable: true
  })

  /**
  * Used to identify a client
  */
  Object.defineProperty(ZwaveClient.prototype, 'name', {
    get: function () {
      return this.cfg.name;
    },
    enumerable: true
  })

  /**
  * Used to get client connection status
  */
  Object.defineProperty(ZwaveClient.prototype, 'connected', {
    get: function () {
      return this.client && this.client.connected;
    },
    enumerable: true
  })


  function sendLog(self, ...args){
    console.log(`Zwave`, ...args);
  }


  module.exports = ZwaveClient;
