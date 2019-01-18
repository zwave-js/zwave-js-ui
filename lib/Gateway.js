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

  //gateway configuration
  this.config = config;

  //clients
  this.mqtt = mqtt;
  this.zwave = zwave;

  // Object where keys are topic and values can be both zwave valueId object
  // or a valueConf if the topic is a broadcast topic
  this.topicValues = {};

  zwave.on('valueChanged', onValueChanged.bind(this));
  zwave.on('nodeStatus', onNodeStatus.bind(this));

  mqtt.on('writeRequest', onWriteRequest.bind(this));
  mqtt.on('broadcastRequest', onBroadRequest.bind(this));
  mqtt.on('apiCall', onApiRequest.bind(this));

  zwave.connect();
}

/**
 * Zwave event triggered when a value changes
 */
function onValueChanged(value, node, valueID){
  var data, topic = [], tmpVal;

  if(this.zwave) this.zwave.emitEvent("VALUE_UPDATED", value);

  //add location to topic
  if(node.loc) topic.push(node.loc);

  switch(this.config.type){
    case 2: //manual
    //just publish changes based on gateway values
    var values = this.config.values.filter(v => v.device == node.device_id);
    if(values && values.length > 0){
      var valueConf = values.find(v => v.value.value_id == valueID);
      if(valueConf){
        topic.push(node.name ? node.name : NODE_PREFIX+value.node_id);
        topic.push(valueConf.topic);

        //store the config in value for writeRequests
        if(!value.conf) value.conf = valueConf;

        if(isValidOperation(valueConf.postOperation)){
          tmpVal = eval(value.value + valueConf.postOperation);
        }

      }
    }
    break;
    case 1: //named
      topic.push(node.name ? node.name : NODE_PREFIX+value.node_id);
      topic.push(comandClass(value.class_id));
      topic.push(value.label.toLowerCase());
    break;
    case 0: //valueid
      topic.push(value.node_id);
      topic.push(value.class_id);
      topic.push(value.instance);
      topic.push(value.index);
    break;
  }

  if(topic.length > 1){

    //clean topic parts
    for (var i = 0; i < topic.length; i++)
      topic[i] = this.mqtt.cleanName(topic[i]);

    tmpVal = value.type == "list" && this.config.integerList ? value.values.indexOf(value.value) : value.value;

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

function onNodeStatus(node){
  var topic = [], data;

  if(this.zwave) this.zwave.emitEvent("NODE_UPDATED", node);

  if(node.loc) topic.push(node.loc);

  switch(this.config.type){
    case 2: //manual
    case 1: //named
        topic.push(node.name ? node.name : NODE_PREFIX + node.node_id);
    break;
    case 0: //valueid
      topic.push(node.node_id);
    break;
    default:
      topic.push(NODE_PREFIX + node.node_id);
  }

  topic.push('status');

  if(this.config.payloadType == 2)
    data = node.status;
  else
    data = {time: Date.now(), value: node.status};

  //clean topic parts
  for (var i = 0; i < topic.length; i++)
    topic[i] = this.mqtt.cleanName(topic[i]);

  this.mqtt.publish(topic.join('/'), data)
}

function onApiRequest(topic, apiName, payload){
  if(this.zwave){
    var args = payload.args || [];
    var result = this.zwave.callApi(apiName, ...args);
    this.mqtt.publish(topic, result);
  }else{
    sendLog(this, "The requested Zwave api", apiName, "doesn't exist")
  }
}

function onBroadRequest(parts, payload){
  if(this.config.type == 2){
    var topic = parts.join('/');
    var valueConf = this.config.values.find(v => v.isBroadcast && v.topic == topic)
    if(valueConf){
      var value = valueConf.value;
      payload = payload.value ? payload.value : payload;
      payload = value.type == "list" && this.config.integerList ? value.values[payload] : payload;

      if(valueConf && isValidOperation(valueConf.postOperation)){
        var op = valueConf.postOperation;
        if(op.includes('/'))
        op = op.replace('/', '*');
        else if(op.includes('*'))
        op = op.replace('*', '/');
        else if(op.includes('+'))
        op = op.replace('+', '-');
        else if(op.includes('-'))
        op = op.replace('-', '+');

        payload = eval(payload + op);
      }

      this.zwave.writeBroadcast(value, valueConf.device, payload);
    }
  }
}

function onWriteRequest(parts, payload){
  var value = this.topicValues[parts.join('/')];

  if(value){

    var valueConf = value.conf;

    payload = payload.value ? payload.value : payload;
    payload = value.type == "list" && this.config.integerList ? value.values[payload] : payload;

    if(valueConf && isValidOperation(valueConf.postOperation)){
      var op = valueConf.postOperation;
      if(op.includes('/'))
      op = op.replace('/', '*');
      else if(op.includes('*'))
      op = op.replace('*', '/');
      else if(op.includes('+'))
      op = op.replace('+', '-');
      else if(op.includes('-'))
      op = op.replace('-', '+');

      payload = eval(payload + op);
    }

    this.zwave.writeValue(value, payload);
  }
}

/**
* Checks if an operation is valid, it must exist and must contains
* only numbers and operators
*/
function isValidOperation(op) {
  return op && !/[^0-9.()\-+*/,]/g.test(op);
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
