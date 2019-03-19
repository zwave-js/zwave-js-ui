'use strict'

var reqlib = require('app-root-path').require,
    utils = reqlib('/lib/utils.js'),
    EventEmitter = require('events'),
    comandClass = reqlib('/lib/Constants.js').comandClass,
    debug = reqlib('/lib/debug')('Gateway'),
    inherits = require('util').inherits;

    debug.color = 2;

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
  this.config = config || {type: 1};
  this.config.values = this.config.values || [];

  //clients
  this.mqtt = mqtt;
  this.zwave = zwave;

  // Object where keys are topic and values can be both zwave valueId object
  // or a valueConf if the topic is a broadcast topic
  this.topicValues = {};

  if(mqtt && zwave){
    mqtt.on('writeRequest', onWriteRequest.bind(this));
    mqtt.on('broadcastRequest', onBroadRequest.bind(this));
    mqtt.on('apiCall', onApiRequest.bind(this));

    zwave.on('valueChanged', onValueChanged.bind(this));
    zwave.on('nodeStatus', onNodeStatus.bind(this));
    zwave.on('scanComplete', onScanComplete.bind(this));
    zwave.connect();
  }else{
    debug("Gateway needs both MQTT and Zwave Configuration to work")
  }

}

/**
 * Zwave event triggered when a value changes
 */
function onScanComplete(nodes){

}

/**
 * Zwave event triggered when a value changes
 */
function onValueChanged(value, node, valueID){
  var data, topic = [], tmpVal, valueConf;

  //emit event to socket
  if(this.zwave) this.zwave.emitEvent("VALUE_UPDATED", value);

  tmpVal = value.value;

  //check if this value is in configuration values array
  var values = this.config.values.filter(v => v.device == node.device_id);
  if(values && values.length > 0){
    valueConf = values.find(v => v.value.value_id == valueID);
    if(valueConf){

      if(valueConf.topic){
        topic.push(node.name ? node.name : NODE_PREFIX+value.node_id);
        topic.push(valueConf.topic);
      }

      if(isValidOperation(valueConf.postOperation)){
        tmpVal = eval(value.value + valueConf.postOperation);
      }

    }
  }

  // if is not in configuration values array get the topic
  // based on gateway type if manual type this will be skipped
  if(topic.length == 0){
    switch(this.config.type){
      case 1: //named
      topic.push(node.name ? node.name : NODE_PREFIX+value.node_id);
      topic.push(comandClass(value.class_id));

      if(value.instance > 1)
        topic.push('instance_' + value.instance);

      topic.push(value.label.toLowerCase());
      break;
      case 0: //valueid
      topic.push(value.node_id);
      topic.push(value.class_id);
      topic.push(value.instance);
      topic.push(value.index);
      break;
    }
  }

  //if there is a valid topic for this value publish it
  if(topic.length > 0){

    //add location prefix
    if(node.loc) topic.unshift(node.loc);

    //clean topic parts
    for (var i = 0; i < topic.length; i++)
      topic[i] = this.mqtt.cleanName(topic[i]);

    tmpVal = value.type == "list" && this.config.integerList ? value.values.indexOf(value.value) : tmpVal;

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

      // I need to add the conf to the value but I don't want to edit
      // original value object so I create a copy
      if(valueConf){
        value = Object.assign({}, value);
        value.conf = valueConf;
      }

      this.topicValues[topic] = value;
    }

    this.mqtt.publish(topic, data)
  }
}

function onNodeStatus(node){
  var topic = [], data;

  if(this.zwave) this.zwave.emitEvent("NODE_UPDATED", node);

  if(node.ready){ //enable poll if required
    var values = this.config.values.filter(v => v.enablePoll && v.device == node.device_id);
    for (var i = 0; i < values.length; i++) {
      //don't edit the original object, copy it
      var v = Object.assign({}, values[i].value);
      v.node_id = node.node_id;
      if(!this.zwave.client.isPolled(v))
        this.zwave.callApi('enablePoll', v, values[i].pollIntensity || 1)
    }
  }

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
    data = node.ready;
  else
    data = {time: Date.now(), value: node.ready};

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
    debug("Requested Zwave api", apiName, "doesn't exist")
  }
}

function onBroadRequest(parts, payload){
  var topic = parts.join('/');
  var values = Object.keys(this.topicValues).filter(t => t.endsWith(topic));

  if(values.length > 0){
    //all values are the same type just different node,parse the Payload by using the first one
    payload = parsePayload(payload, this.topicValues[values[0]], this.topicValues[values[0]].conf, this.config)
    for (var i = 0; i < values.length; i++) {
      this.zwave.writeValue(this.topicValues[values[i]], payload);
    }
  }
}

function onWriteRequest(parts, payload){
  var value = this.topicValues[parts.join('/')];

  if(value){
    payload = parsePayload(payload, value, value.conf, this.config)
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
* Parse the value of the payload received from mqtt
* based on the type of the payload and the gateway config
*/
function parsePayload(payload, value, valueConf, config){

  payload = payload.hasOwnProperty('value') ? payload.value : payload;

  //check if value is list type and payload is an index
  if(value.type == "list" &&
  config.integerList &&
  !isNaN(payload) &&
  payload >= 0 &&
  payload < value.values.length){
    payload = value.values[payload];
  }

  if(valueConf && isValidOperation(valueConf.postOperation)){
    var op = valueConf.postOperation;

    //revert operation to write
    if(op.includes('/'))
    op = op.replace('/', '*');
    else if(op.includes('*'))
    op = op.replace('*', '/');
    else if(op.includes('+'))
    op = op.replace('+', '-');
    else if(op.includes('-'))
    op = op.replace('-', '+');

    payload = eval(payload+op)
  }

  return payload;
}

/**
 * Method used to close clients connection, use this before destroy
 */
Gateway.prototype.close = function () {
  this.closed = true;

  debug("Closing Gateway...")

  if(this.mqtt)
    this.mqtt.close();

  if(this.zwave)
    this.zwave.close();
}

module.exports = Gateway
