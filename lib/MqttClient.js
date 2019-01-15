'use strict'

var reqlib = require('app-root-path').require,
    mqtt = require('mqtt'),
    utils = reqlib('/lib/utils.js'),
    NeDBStore = reqlib('/lib/Store.js'),
    EventEmitter = require('events'),
    inherits = require('util').inherits,
    configMQTT = reqlib('/config/mqtt.js');

    let CLIENTS_PREFIX = '_CLIENTS';
    let DEVICES_PREFIX = '$devices';

    var ACTIONS = ['restart'];

/**
 * The constructor
 */
function MqttClient (config) {
  if (!(this instanceof MqttClient)) {
    return new MqttClient(config)
  }
  EventEmitter.call(this);
  init.call(this, config);
}

inherits(MqttClient, EventEmitter);

function init(config){

  this.config = config;
  this.toSubscribe = [];

  var manager = NeDBStore(utils.joinPath(utils.getPath(true), "store", config.name), {compactionInterval: 30000});

  this.clientID = cleanName("ZWAVE_GATEWAY-" + config.name);

  var options = {
    clientId: this.clientID,
    reconnectPeriod: config.reconnectPeriod,
    clean: config.clean,
    incomingStore: manager.incoming,
    outgoingStore: manager.outgoing,
    servers: [{ host: config.host, port: config.port }],
    will: {
      topic: this.getClientTopic(),
      payload: JSON.stringify({value: false}),
      qos: 1,
      retain: true
    }
  };

  if(config.auth){
    options.username = config.username;
    options.password = config.password;
  }

  try {
    var client  = mqtt.connect(options);

    this.client = client;

    client.on('connect', onConnect.bind(this));
    client.on('message', onMessageReceived.bind(this));
    client.on('reconnect', onReconnect.bind(this));
    client.on('close', onClose.bind(this));
    client.on('error', onError.bind(this));
    client.on('offline', onOffline.bind(this));

  } catch (e) {
    sendLog(self, 'Error while connecting MQTT', e.message);
    this.error = e.message;
  }
}

/**
 * Function called when MQTT client connects
 */
function onConnect() {
  sendLog(this, "MQTT client connected");
  this.emit('connect');

  if(this.toSubscribe){
    for (var i = 0; i < this.toSubscribe.length; i++) {
      this.subscribe(this.toSubscribe[i]);
    }
  }

  //Update client status
  this.updateClientStatus(true);

  this.toSubscribe = [];
}

/**
 * Function called when MQTT client reconnects
 */
function onReconnect() {
  sendLog(this, "MQTT client reconnecting");
}

/**
 * Function called when MQTT client reconnects
 */
function onError(error) {
  sendLog(this, error.message);
  this.error = error.message;
}

/**
 * Function called when MQTT client go offline
 */
function onOffline() {
  sendLog(this, "MQTT client offline");
}

/**
 * Function called when MQTT client is closed
 */
function onClose() {
  sendLog(this, "MQTT client closed");
}

/**
 * Function called when an MQTT message is received
 */
function onMessageReceived(topic, payload) {

  var parts = topic.split('/');
  var self = this;

  sendLog(self, "Message received on", topic);

  if(self.closed) return;

  try {
    payload = JSON.parse(payload);
  } catch(e) {
    sendLog(self, "Unable to parse payload:", payload);
  }

  if(!payload || payload.value == null) return;

  parts.shift(); //remove prefix;
  parts.pop(); //remove set

  this.emit('writeRequest', parts, payload)

}// end onMessageReceived

/**
 * Returns the topic used to send client and devices status updateStates
 * if name is null the client is the gateway itself
 */
MqttClient.prototype.getClientTopic = function(...devices){
  var subTopic = "";
  if(devices){
    for (var i = 0; i < devices.length; i++) {
      var name = cleanName(devices[i]);
      subTopic += '/'+DEVICES_PREFIX+'/' + name;
    }
  }

  return configMQTT.prefix_topic + "/" + CLIENTS_PREFIX + "/" + this.clientID + subTopic + "/status";
}

function cleanName(name){
  return name.replace(/[\s\+\*\#\\/.''``!?^=(),""%[\]:;{}]+/g, '')
}

/**
 * Method used to close clients connection, use this before destroy
 */
MqttClient.prototype.close = function () {
  this.closed = true;

  if(this.client)
    this.client.end();
}

/**
 * Method used to get status
 */
MqttClient.prototype.getStatus = function () {
  var status = {};

  status.status = this.client && this.client.connected;
  status.error = this.error || 'Offline';
  status.config = this.config;

  return status;
}

/**
 * Method used to update client connection status
 */
MqttClient.prototype.updateClientStatus = function (connected, ...devices) {
  this.client.publish(this.getClientTopic(...devices), JSON.stringify({value:connected, time: Date.now()}),{retain:true,qos:1});
}

/**
 * Method used to update client
 */
MqttClient.prototype.update = function (config) {

  this.close();

  sendLog(this, `Restarting Mqtt Client after update...`);

  init.call(this, config);
}

/**
 * Method used to subscribe tags for write requests
 */
MqttClient.prototype.subscribe = function (tagName) {
  if(this.client && this.client.connected){
    this.client.subscribe(configMQTT.prefix_topic + '/' + tagName.join('/') + "/set");
  }
  else
    this.toSubscribe.push(tagName);
}

/**
 * Method used to publish an update
 */
MqttClient.prototype.publish = function (tag, value, dontStore) {

  if(this.client){

    var self = this;

    var options = {
      qos: 1, // 0, 1: at least once, or 2: exactly once
      retain: true // or true
    };

    var topic = configMQTT.prefix_topic + '/' + tag.name.join('/');

    var data = {
        value: value,
        time: new Date()
    };

    if(dontStore)
      data.dontStore = true;
    else{
      tag.lastStore = new Date();
      tag.lastStoredValue = value;
    }

    if(value instanceof Array && tag.sendSeparately){
      var lastSent = tag.lastSentValue;
      for (var i = 0; i < value.length; i++) {
        //send just changed indexes
        if(!lastSent || i >= lastSent.length || value[i] != lastSent[i]){
          data.value = value[i];
          this.client.publish(topic + '/' + i, JSON.stringify(data), options, function(err){
            if(err)
            sendLog(self, "Error while publishing a value", err.message);
          });
        }
      }
    }else{
      this.client.publish(topic, JSON.stringify(data), options, function(err){
        if(err)
          sendLog(self, "Error while publishing a value", err.message);
      });
    }

    tag.lastSentValue = value;
  } //end if client
}


/**
 * Used to identify an unique client
 */
Object.defineProperty(MqttClient.prototype, '_id', {
  get: function () {
    return this.config._id;
  },
  enumerable: true
})

/**
* Used to identify a client
*/
Object.defineProperty(MqttClient.prototype, 'name', {
  get: function () {
    return this.config.name;
  },
  enumerable: true
})

/**
 * Used to get client connection status
 */
Object.defineProperty(MqttClient.prototype, 'connected', {
  get: function () {
    return this.client && this.client.connected;
  },
  enumerable: true
})


function sendLog(self, ...args){
  console.log(`MQTT ${self.config.name}:`, ...args);
}


module.exports = MqttClient
