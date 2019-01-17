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
function ZwaveClient (config, socket) {
  if (!(this instanceof ZwaveClient)) {
    return new ZwaveClient(config)
  }
  EventEmitter.call(this);
  init.call(this, config, socket);
}

inherits(ZwaveClient, EventEmitter);

function init(cfg, socket){

  this.cfg = cfg;
  this.socket = socket;

  this.closed = false;

  //Full option list: https://github.com/OpenZWave/open-zwave/wiki/Config-Options
  var client = new OpenZWave({
    Logging: cfg.logging,
    ConsoleOutput: cfg.logging,
    QueueLogLevel: cfg.logging ? 8 : 6,
    UserPath: utils.getPath(true), //where to store config files
    DriverMaxAttempts: 3,
    NetworkKey: cfg.networkKey || "",
    SaveConfiguration: cfg.saveConfig,
    //ConfigPath: , //where zwave devices database resides
    //PollInterval: 500,
    //SuppressValueRefresh: true,
  });

  this.nodes = [];
  this.devices = {};

  this.client = client;
  this.ozwConfig = {};

  var self = this;

  Object.keys(ozwEvents).forEach(function(evt) {
    client.on(evt, ozwEvents[evt].bind(self));
  });
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
    node_id: nodeid,
    device_id: '',
    manufacturer: '',
    manufacturerid: '',
    product: '',
    producttype: '',
    productid: '',
    type: '',
    name: '',
    loc: '',
    values: {},
    ready: false,
  };
  sendLog(this, "Node added", nodeid)
}

function valueAdded(nodeid, comclass, valueId) {
  var ozwnode = this.nodes[nodeid];
  if (!ozwnode) {
    sendLog(this, 'ValueAdded: no such node: '+nodeid, 'error');
  }

  sendLog(this, "ValueAdded", valueId.value_id);
  ozwnode.values[getValueID(valueId)] = valueId;
}

function valueChanged(nodeid, comclass, valueId) {
  var ozwnode = this.nodes[nodeid];
  var value_id = getValueID(valueId);
  if (!ozwnode) {
    sendLog(this, 'valueChanged: no such node: '+nodeid, 'error');
  } else {
    var oldst;
    if (ozwnode.ready) {
      oldst = ozwnode.values[value_id].value;
      sendLog(this, `zwave node ${nodeid}: changed: ${comclass}:${valueId.label}:${oldst} -> ${valueId.value}`);
      this.emit('valueChanged', valueId, ozwnode, getValueID(valueId));
    }
    // update cache
    ozwnode.values[value_id] = valueId;
  }
}

function valueRemoved(nodeid, comclass, instance, index) {
  var ozwnode = this.nodes[nodeid];
  var value_id = getValueID({class_id: comclass, instance:instance, index:index});
  if (ozwnode.values[value_id]) {
      delete ozwnode.values[value_id];
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

      //enable poll
      for (var v in ozwnode.values) {
        var comclass = ozwnode.values[v].class_id;
          switch (comclass) {
            case 0x25: // COMMAND_CLASS_SWITCH_BINARY
            case 0x26: // COMMAND_CLASS_SWITCH_MULTILEVEL
            case 0x30: // COMMAND_CLASS_SENSOR_BINARY
            case 0x31: // COMMAND_CLASS_SENSOR_MULTILEVEL
            case 0x60: // COMMAND_CLASS_MULTI_INSTANCE
            this.client.enablePoll(ozwnode.values[v], 0);
            break;
          }
      }

      var deviceID = getDeviceID(ozwnode);

      ozwnode.device_id = deviceID;

      for(var v in ozwnode.values){
        this.emit('valueChanged', ozwnode.values[v], ozwnode, v);
      }

      if(!this.devices[deviceID]){
        this.devices[deviceID] = {
          name: `${ozwnode.product} (${ozwnode.manufacturer})`,
          values: JSON.parse(JSON.stringify(ozwnode.values))
        };

        //remove node specific info from values
        for (var v in this.devices[deviceID].values) {
          var tmp = this.devices[deviceID].values[v];
          delete tmp.node_id;
          tmp.value_id = getValueID(tmp);
        }
      }

      this.emit('nodeStatus', nodeid, ozwnode, true);

      this.emitEvent('NODE_UPDATED', ozwnode);

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
    var ozwnode = this.nodes[nodeid];
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
      ozwnode.ready = false;
      this.emit('nodeStatus', nodeid, ozwnode, false);
      break;
      case 6:
      ozwnode.ready = true;
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

  //------- Utils ------------------------

  function getDeviceID(ozwnode){
    if(!ozwnode) return "";

    return `${parseInt(ozwnode.manufacturerid)}-${parseInt(ozwnode.productid)}-${parseInt(ozwnode.producttype)}`;
  }

  function getValueID(v){
    return `${v.class_id}-${v.instance}-${v.index}`;
  }

  //-------- Public methods --------------

  /**
  * Method used to close client connection, use this before destroy
  */
  ZwaveClient.prototype.close = function () {
    if(this.connected && this.client){
      this.connected = false;
      this.client.disconnect(this.cfg.port);
    }
  }

  /**
  * Method used to close client connection, use this before destroy
  */
  ZwaveClient.prototype.connect = function () {
    if(!this.connected){
      sendLog(this, "Connecting to", this.cfg.port);
      this.client.connect(this.cfg.port);
      this.connected = true;
    }else{
      sendLog(this, "Client already connected to", this.cfg.port);
    }
  }

  /**
  * Method used to emit zwave events to the socket
  */
  ZwaveClient.prototype.emitEvent = function (evtName, data) {
    if(this.socket){
      this.socket.emit(evtName, data)
    }
  }

  /**
  * Method used to close call an API of zwave client
  */
  ZwaveClient.prototype.callApi = function (apiName, ...args) {
    if(this.connected){
      if(this.client[apiName]){
        this.client[apiName](...args);
      }
      else{
        sendLog(this, "Unknown API call received:", apiName);
      }
    }
  }

  /**
  * Method used to write a value to zwave network
  */
  ZwaveClient.prototype.writeValue = function (valueId, value) {
    if(this.connected){
      this.client.setValue(valueId, value);
    }
  }

  /**
  * Method used to send a broadcast value to all devices of a specific type
  */
  ZwaveClient.prototype.writeBroadcast = function (valueId, deviceID, value) {
    if(this.connected){
      var devices = [];

      for (var i = 0; i < this.nodes.length; i++) {
        if(this.nodes[i] && this.nodes[i].device_id == deviceID)
          devices.push(i)
      }

      for (var i = 0; i < devices.length; i++)
        this.client.setValue(devices[i], valueId.class_id, valueId.instance, valueId.index, value);
    }
  }


  function sendLog(self, ...args){
    console.log(`Zwave`, ...args);
  }


  module.exports = ZwaveClient;
