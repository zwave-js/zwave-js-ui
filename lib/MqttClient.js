'use strict'

// eslint-disable-next-line one-var
const reqlib = require('app-root-path').require,
  mqtt = require('mqtt'),
  utils = reqlib('/lib/utils.js'),
  NeDBStore = require('mqtt-nedb-store'),
  EventEmitter = require('events'),
  storeDir = reqlib('config/app.js').storeDir,
  logger = reqlib('/lib/logger.js').module('Mqtt'),
  url = require('native-url'),
  inherits = require('util').inherits

const appVersion = reqlib('package.json').version

const CLIENTS_PREFIX = '_CLIENTS'
const EVENTS_PREFIX = '_EVENTS'

const BROADCAST_PREFIX = '_BROADCAST'

const NAME_PREFIX = 'ZWAVE_GATEWAY-'

const ACTIONS = ['broadcast', 'api']

const HASS_WILL = 'homeassistant/status'

const STATUS_TOPIC = 'status'
const VERSION_TOPIC = 'version'

/**
 * The constructor
 */
function MqttClient (config) {
  if (!(this instanceof MqttClient)) {
    return new MqttClient(config)
  }
  EventEmitter.call(this)
  init.call(this, config)
}

inherits(MqttClient, EventEmitter)

function init (config) {
  this.config = config
  this.toSubscribe = []

  if (!config || config.disabled) {
    logger.info('MQTT is disabled')
    return
  }

  this.clientID = this.cleanName(NAME_PREFIX + config.name)

  const parsed = url.parse(config.host || '')
  let protocol = 'mqtt'

  if (parsed.protocol) protocol = parsed.protocol.replace(/:$/, '')

  const options = {
    clientId: this.clientID,
    reconnectPeriod: config.reconnectPeriod,
    clean: config.clean,
    rejectUnauthorized: !config.allowSelfsigned,
    will: {
      topic: this.getClientTopic(STATUS_TOPIC),
      payload: JSON.stringify({ value: false }),
      qos: this.config.qos,
      retain: this.config.retain
    }
  }

  if (['mqtts', 'wss', 'wxs', 'alis', 'tls'].indexOf(protocol) >= 0) {
    if (!config.allowSelfsigned) options.ca = config._ca

    if (config._key) {
      options.key = config._key
    }
    if (config._cert) {
      options.cert = config._cert
    }
  }

  if (config.store) {
    const COMPACT = { autocompactionInterval: 30000 }
    const manager = NeDBStore(utils.joinPath(true, storeDir, 'mqtt'), {
      incoming: COMPACT,
      outgoing: COMPACT
    })
    options.incomingStore = manager.incoming
    options.outgoingStore = manager.outgoing
  }

  if (config.auth) {
    options.username = config.username
    options.password = config.password
  }

  try {
    const serverUrl = `${protocol}://${parsed.hostname || config.host}:${
      config.port
    }`
    logger.info(`Connecting to ${serverUrl}`)

    const client = mqtt.connect(serverUrl, options)

    this.client = client

    client.on('connect', onConnect.bind(this))
    client.on('message', onMessageReceived.bind(this))
    client.on('reconnect', onReconnect.bind(this))
    client.on('close', onClose.bind(this))
    client.on('error', onError.bind(this))
    client.on('offline', onOffline.bind(this))
  } catch (e) {
    logger.error(`Error while connecting MQTT ${e.message}`)
    this.error = e.message
  }
}

/**
 * Function called when MQTT client connects
 */
function onConnect () {
  logger.info('MQTT client connected')
  this.emit('connect')

  if (this.toSubscribe) {
    for (let i = 0; i < this.toSubscribe.length; i++) {
      this.subscribe(this.toSubscribe[i])
    }
  }

  this.client.subscribe(HASS_WILL)

  // subscribe to actions
  // eslint-disable-next-line no-redeclare
  for (let i = 0; i < ACTIONS.length; i++) {
    this.client.subscribe(
      [this.config.prefix, CLIENTS_PREFIX, this.clientID, ACTIONS[i], '#'].join(
        '/'
      )
    )
  }

  this.emit('brokerStatus', true)

  this.publishVersion()

  // Update client status
  this.updateClientStatus(true)

  this.toSubscribe = []
}

/**
 * Function called when MQTT client reconnects
 */
function onReconnect () {
  logger.info('MQTT client reconnecting')
}

/**
 * Function called when MQTT client reconnects
 */
function onError (error) {
  logger.info(error.message)
  this.error = error.message
}

/**
 * Function called when MQTT client go offline
 */
function onOffline () {
  logger.info('MQTT client offline')
  this.emit('brokerStatus', false)
}

/**
 * Function called when MQTT client is closed
 */
function onClose () {
  logger.info('MQTT client closed')
}

/**
 * Function called when an MQTT message is received
 */
function onMessageReceived (topic, payload) {
  payload = payload ? payload.toString() : payload

  logger.log('info', `Message received on ${topic}, %o`, payload)

  if (topic === HASS_WILL) {
    this.emit('hassStatus', payload.toLowerCase() === 'online')
    return
  }

  // remove prefix
  topic = topic.substring(this.config.prefix.length + 1)

  const parts = topic.split('/')

  // It's not a write request
  if (parts.pop() !== 'set') return

  if (this.closed) return

  if (isNaN(payload)) {
    try {
      payload = JSON.parse(payload)
    } catch (e) {} // it' ok fallback to string
  } else payload = Number(payload)

  // It's an action
  if (parts[0] === CLIENTS_PREFIX) {
    if (parts.length < 3) return

    const action = ACTIONS.indexOf(parts[2])

    switch (action) {
      case 0: // broadcast
        this.emit('broadcastRequest', parts.slice(3), payload)
        // publish back to give a feedback the action is received
        // same topic without /set suffix
        this.publish(parts.join('/'), payload)
        break
      case 1: // api
        this.emit('apiCall', parts.join('/'), parts[3], payload)
        break
      default:
        logger.warn(`Unknown action received ${action} ${topic}`)
    }
  } else {
    // It's a write request on zwave network
    this.emit('writeRequest', parts, payload)
  }
} // end onMessageReceived

/**
 * Returns the topic used to send client and devices status updateStates
 * if name is null the client is the gateway itself
 */
MqttClient.prototype.getClientTopic = function (suffix) {
  return `${this.config.prefix}/${CLIENTS_PREFIX}/${this.clientID}/${suffix}`
}

MqttClient.prototype.cleanName = function (name, removeSlash) {
  if (!isNaN(name) || !name) return name

  if (removeSlash) {
    name = this.removeSlash(name)
  }

  name = name.replace(/\s/g, '_')
  return name.replace(/[+*#\\.'`!?^=(),"%[\]:;{}]+/g, '')
}

MqttClient.prototype.removeSlash = function (name) {
  return name.replace(/\//g, '-')
}

/**
 * Method used to close clients connection, use this before destroy
 */
MqttClient.prototype.close = function () {
  const self = this
  return new Promise(resolve => {
    if (self.closed) {
      resolve()
      return
    }
    self.closed = true

    if (self.client) {
      self.client.end(true, {}, function () {
        self.removeAllListeners()
        resolve()
      })
    } else {
      self.removeAllListeners()
      resolve()
    }
  })
}

/**
 * Method used to get status
 */
MqttClient.prototype.getStatus = function () {
  const status = {}

  status.status = this.client && this.client.connected
  status.error = this.error || 'Offline'
  status.config = this.config

  return status
}

/**
 * Method used to update client connection status
 */
MqttClient.prototype.updateClientStatus = function (connected) {
  if (this.client) {
    this.client.publish(
      this.getClientTopic(STATUS_TOPIC),
      JSON.stringify({ value: connected, time: Date.now() }),
      { retain: this.config.retain, qos: this.config.qos }
    )
  }
}

/**
 * Method used to publish app version to mqtt
 */
MqttClient.prototype.publishVersion = function () {
  if (this.client) {
    this.client.publish(
      this.getClientTopic(VERSION_TOPIC),
      JSON.stringify({ value: appVersion, time: Date.now() }),
      { retain: this.config.retain, qos: this.config.qos }
    )
  }
}

/**
 * Method used to update client
 */
MqttClient.prototype.update = function (config) {
  this.close()

  logger.info('Restarting Mqtt Client after update...')

  init.call(this, config)
}

/**
 * Method used to subscribe tags for write requests
 */
MqttClient.prototype.subscribe = function (topic) {
  if (this.client && this.client.connected) {
    topic = this.config.prefix + '/' + topic + '/set'
    logger.info(`Subscribing to ${topic}`)
    this.client.subscribe(topic)
  } else {
    this.toSubscribe.push(topic)
  }
}

/**
 * Method used to publish an update
 */
MqttClient.prototype.publish = function (topic, data, options, prefix) {
  if (this.client) {
    const settingOptions = {
      qos: this.config.qos,
      retain: this.config.retain
    }

    // by default use settingsOptions
    options = Object.assign(settingOptions, options)

    topic = (prefix || this.config.prefix) + '/' + topic

    logger.log(
      'debug',
      'Publishing to %s: %o with options %o',
      topic,
      data,
      options
    )

    this.client.publish(topic, JSON.stringify(data), options, function (err) {
      if (err) {
        logger.error(`Error while publishing a value ${err.message}`)
      }
    })
  } // end if client
}

/**
 * Method used to get the topic with prefix/suffix
 */
MqttClient.prototype.getTopic = function (topic, set) {
  return this.config.prefix + '/' + topic + (set ? '/set' : '')
}

/**
 * Used to get client connection status
 */
Object.defineProperty(MqttClient.prototype, 'connected', {
  get: function () {
    return this.client && this.client.connected
  },
  enumerable: true
})

/**
 * The prefix to add to broadcast values
 */
Object.defineProperty(MqttClient.prototype, 'broadcastPrefix', {
  get: function () {
    return BROADCAST_PREFIX
  },
  enumerable: true
})

/**
 * The prefix to add to events
 */
Object.defineProperty(MqttClient.prototype, 'eventsPrefix', {
  get: function () {
    return EVENTS_PREFIX
  },
  enumerable: true
})

module.exports = MqttClient
