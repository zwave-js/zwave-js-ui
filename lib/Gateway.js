'use strict'

var reqlib = require('app-root-path').require,
    utils = reqlib('/lib/utils.js'),
    EventEmitter = require('events'),
    comandClass = reqlib('/lib/Constants.js').comandClass,
    inherits = require('util').inherits;

    const NODE_PREFIX = "nodeID_";
    const GW_TYPES = ["valueID", "named", "manual"];
    const PY_TYPES = ["time_value", "zwave_value", "just_value"];
/**
 * The constructor
 */
function Gateway (config, zwave, mqtt) {
  if (!(this instanceof Gateway)) {
    return new Gateway(config)
  }
  EventEmitter.call(this);
  init.call(this, config, zwave, mqtt);
}

inherits(Gateway, EventEmitter);

function init(config, zwave, mqtt){

  this.config = config;
  this.mqtt = mqtt;
  this.zwave = zwave;

  this.topicValues = {};

  zwave.on('valueChanged', onValueChanged.bind(this));
  zwave.on('nodeStatus', onNodeStatus.bind(this));

  mqtt.on('writeRequest', onWriteRequest.bind(this));

  zwave.connect();
}

function onValueChanged(value, node, deviceID, valueID){
  var data, topic = [];

  if(node.loc) topic.push(node.loc);

  switch(this.config.type){
    case 2: //manual
    var values = this.config.values.filter(v => v.device == deviceID);
    if(values && values.length > 0){
      var valueConf = values.find(v => v.value.value_id == valueID);
      if(valueConf){
        topic.push(node.name ? node.name : NODE_PREFIX+value.node_id);
        topic.push(valueConf.topic);
      }
    }
    break;
    case 1: //named
      topic.push(node.name ? node.name : NODE_PREFIX+value.node_id);
      topic.push(comandClass(value.class_id));
      topic.push(this.mqtt.cleanName(value.label.toLowerCase()));
    break;
    case 0: //valueid
      topic.push(value.node_id);
      topic.push(value.class_id);
      topic.push(value.instance);
      topic.push(value.index);
    break;
  }

  if(topic.length > 1){

    var tmpVal = value.type == "list" && this.config.integerList ? value.values.indexOf(value.value) : value.value;

    switch(this.config.payloadType){
      case 1: //entire zwave object
      data = value;
      break;
      case 2: //just value
      data = tmpVal;
      break;
      default:
      data = {time: Date.now(), value: tmpVal};
    }

    topic = topic.join('/');

    if(!value.read_only && !this.topicValues[topic]){
      this.mqtt.subscribe(topic);
      this.topicValues[topic] = value;
    }

    this.mqtt.publish(topic, data)
  }
}

function onNodeStatus(node, status){

}

function onWriteRequest(parts, payload){
  var value = this.topicValues[parts.join('/')];

  if(value){
    payload = payload.value ? payload.value : payload;
    payload = value.type == "list" && this.config.integerList ? value.values[payload] : payload;
    this.zwave.writeValue(value, payload);
  }
}

/**
 * Method used to close clients connection, use this before destroy
 */
Gateway.prototype.close = function () {
  this.closed = true;

  if(this.mqtt)
    this.mqtt.close();

  if(this.zwave)
    this.zwave.close();
}


/**
 * Method used to update client
 */
Gateway.prototype.update = function (config) {

  this.close();

  sendLog(this, `Restarting Gateway after update...`);

  init.call(this, config);
}


function sendLog(self, ...args){
  console.log(`Gateway:`, ...args);
}

module.exports = Gateway
