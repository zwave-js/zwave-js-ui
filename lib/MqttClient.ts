'use strict'

// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'reqlib'.
// eslint-disable-next-line one-var
const reqlib = require('app-root-path').require,
  mqtt = require('mqtt'),
  // @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'utils'.
  utils = reqlib('/lib/utils.js'),
  NeDBStore = require('mqtt-nedb-store'),
  // @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'EventEmitt... Remove this comment to see the full error message
  EventEmitter = require('events'),
  // @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'storeDir'.
  storeDir = reqlib('config/app.js').storeDir,
  // @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'debug'.
  debug = reqlib('/lib/debug')('Mqtt'),
  url = require('native-url'),
  // @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'inherits'.
  inherits = require('util').inherits

debug.color = 5

const CLIENTS_PREFIX = '_CLIENTS'
const EVENTS_PREFIX = '_EVENTS'

const DEVICES_PREFIX = '$devices'

const BROADCAST_PREFIX = '_BROADCAST'

const NAME_PREFIX = 'ZWAVE_GATEWAY-'

const ACTIONS = ['broadcast', 'api']

const HASS_WILL = 'homeassistant/status'

/**
 * The constructor
 */
// @ts-expect-error ts-migrate(2300) FIXME: Duplicate identifier 'MqttClient'.
function MqttClient (config: any) {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  if (!(this instanceof MqttClient)) {
    return new MqttClient(config)
  }
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  EventEmitter.call(this)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  init.call(this, config)
}

inherits(MqttClient, EventEmitter)

function init (config: any) {
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.config = config
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.toSubscribe = []

  if (!config || config.disabled) {
    debug('MQTT is disabled')
    return
  }

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.clientID = this.cleanName(NAME_PREFIX + config.name)

  const parsed = url.parse(config.host || '')
  let protocol = 'mqtt'

  if (parsed.protocol) protocol = parsed.protocol.replace(/:$/, '')

  const options = {
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    clientId: this.clientID,
    reconnectPeriod: config.reconnectPeriod,
    clean: config.clean,
    rejectUnauthorized: !config.allowSelfsigned,
    protocol: protocol,
    host: parsed.hostname || config.host,
    port: config.port,
    will: {
      // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
      topic: this.getClientTopic(),
      payload: JSON.stringify({ value: false }),
      // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
      qos: this.config.qos,
      // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
      retain: this.config.retain
    }
  }

  if (['mqtts', 'wss', 'wxs', 'alis', 'tls'].indexOf(protocol) >= 0) {
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'ca' does not exist on type '{ clientId: ... Remove this comment to see the full error message
    if (!config.allowSelfsigned) options.ca = config._ca
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'key' does not exist on type '{ clientId:... Remove this comment to see the full error message
    options.key = config._key
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'cert' does not exist on type '{ clientId... Remove this comment to see the full error message
    options.cert = config._cert
  }

  if (config.store) {
    const COMPACT = { autocompactionInterval: 30000 }
    const manager = NeDBStore(utils.joinPath(true, storeDir, 'mqtt'), {
      incoming: COMPACT,
      outgoing: COMPACT
    })
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'incomingStore' does not exist on type '{... Remove this comment to see the full error message
    options.incomingStore = manager.incoming
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'outgoingStore' does not exist on type '{... Remove this comment to see the full error message
    options.outgoingStore = manager.outgoing
  }

  if (config.auth) {
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'username' does not exist on type '{ clie... Remove this comment to see the full error message
    options.username = config.username
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'password' does not exist on type '{ clie... Remove this comment to see the full error message
    options.password = config.password
  }

  try {
    const client = mqtt.connect(options)

    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.client = client

    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    client.on('connect', onConnect.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    client.on('message', onMessageReceived.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    client.on('reconnect', onReconnect.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    client.on('close', onClose.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    client.on('error', onError.bind(this))
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    client.on('offline', onOffline.bind(this))
  } catch (e) {
    debug('Error while connecting MQTT', e.message)
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.error = e.message
  }
}

/**
 * Function called when MQTT client connects
 */
function onConnect () {
  debug('MQTT client connected')
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('connect')

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  if (this.toSubscribe) {
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    for (let i = 0; i < this.toSubscribe.length; i++) {
      // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
      this.subscribe(this.toSubscribe[i])
    }
  }

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.client.subscribe(HASS_WILL)

  // subscribe to actions
  // eslint-disable-next-line no-redeclare
  for (let i = 0; i < ACTIONS.length; i++) {
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.client.subscribe(
      // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
      [this.config.prefix, CLIENTS_PREFIX, this.clientID, ACTIONS[i], '#'].join(
        '/'
      )
    )
  }

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('brokerStatus', true)

  // Update client status
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.updateClientStatus(true)

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.toSubscribe = []
}

/**
 * Function called when MQTT client reconnects
 */
function onReconnect () {
  debug('MQTT client reconnecting')
}

/**
 * Function called when MQTT client reconnects
 */
function onError (error: any) {
  debug(error.message)
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.error = error.message
}

/**
 * Function called when MQTT client go offline
 */
function onOffline () {
  debug('MQTT client offline')
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  this.emit('brokerStatus', false)
}

/**
 * Function called when MQTT client is closed
 */
function onClose () {
  debug('MQTT client closed')
}

/**
 * Function called when an MQTT message is received
 */
function onMessageReceived (topic: any, payload: any) {
  debug('Message received on', topic)

  if (topic === HASS_WILL) {
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.emit('hassStatus', payload.toString().toLowerCase() === 'online')
    return
  }

  // remove prefix
  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  topic = topic.substring(this.config.prefix.length + 1)

  const parts = topic.split('/')

  // It's not a write request
  if (parts.pop() !== 'set') return

  // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
  if (this.closed) return

  if (isNaN(payload)) {
    try {
      payload = JSON.parse(payload)
    } catch (e) {
      payload = payload.toString()
    }
  } else payload = Number(payload)

  // It's an action
  if (parts[0] === CLIENTS_PREFIX) {
    if (parts.length < 3) return

    const action = ACTIONS.indexOf(parts[2])

    switch (action) {
      case 0: // broadcast
        // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
        this.emit('broadcastRequest', parts.slice(3), payload)
        // publish back to give a feedback the action is received
        // same topic without /set suffix
        // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
        this.publish(parts.join('/'), payload)
        break
      case 1: // api
        // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
        this.emit('apiCall', parts.join('/'), parts[3], payload)
        break
      default:
        debug('Unknown action received', action, topic)
    }
  } else {
    // It's a write request on zwave network
    // @ts-expect-error ts-migrate(2683) FIXME: 'this' implicitly has type 'any' because it does n... Remove this comment to see the full error message
    this.emit('writeRequest', parts, payload)
  }
} // end onMessageReceived

/**
 * Returns the topic used to send client and devices status updateStates
 * if name is null the client is the gateway itself
 */
// @ts-expect-error ts-migrate(7019) FIXME: Rest parameter 'devices' implicitly has an 'any[]'... Remove this comment to see the full error message
MqttClient.prototype.getClientTopic = function (...devices) {
  let subTopic = ''

  for (let i = 0; i < devices.length; i++) {
    const name = this.cleanName(devices[i])
    subTopic += '/' + DEVICES_PREFIX + '/' + name
  }

  return (
    this.config.prefix +
    '/' +
    CLIENTS_PREFIX +
    '/' +
    this.clientID +
    subTopic +
    '/status'
  )
}

MqttClient.prototype.cleanName = function (name: any) {
  if (!isNaN(name) || !name) return name

  name = name.replace(/\s/g, '_')
  return name.replace(/[+*#\\.'`!?^=(),"%[\]:;{}]+/g, '');
}

/**
 * Method used to close clients connection, use this before destroy
 */
MqttClient.prototype.close = function () {
  return new Promise(resolve => {
    this.closed = true

    if (this.client) {
      this.client.end(!this.client.connected, () => resolve())
    } else {
      resolve()
    }

    this.removeAllListeners()

    if (this.client) {
      this.client.removeAllListeners()
    }
  })
}

/**
 * Method used to get status
 */
MqttClient.prototype.getStatus = function () {
  const status = {}

  // @ts-expect-error ts-migrate(2339) FIXME: Property 'status' does not exist on type '{}'.
  status.status = this.client && this.client.connected
  // @ts-expect-error ts-migrate(2339) FIXME: Property 'error' does not exist on type '{}'.
  status.error = this.error || 'Offline'
  // @ts-expect-error ts-migrate(2339) FIXME: Property 'config' does not exist on type '{}'.
  status.config = this.config

  return status
}

/**
 * Method used to update client connection status
 */
// @ts-expect-error ts-migrate(7019) FIXME: Rest parameter 'devices' implicitly has an 'any[]'... Remove this comment to see the full error message
MqttClient.prototype.updateClientStatus = function (connected: any, ...devices) {
  if (this.client) {
    this.client.publish(
      this.getClientTopic(...devices),
      JSON.stringify({ value: connected, time: Date.now() }),
      { retain: this.config.retain, qos: this.config.qos }
    )
  }
}

/**
 * Method used to update client
 */
MqttClient.prototype.update = function (config: any) {
  this.close()

  debug('Restarting Mqtt Client after update...')

  // @ts-expect-error ts-migrate(2554) FIXME: Expected 1 arguments, but got 2.
  init.call(this, config)
}

/**
 * Method used to subscribe tags for write requests
 */
MqttClient.prototype.subscribe = function (topic: any) {
  if (this.client && this.client.connected) {
    topic = this.config.prefix + '/' + topic + '/set'
    debug('Subscribing to %s', topic)
    this.client.subscribe(topic)
  } else {
    this.toSubscribe.push(topic)
  }
}

/**
 * Method used to publish an update
 */
MqttClient.prototype.publish = function (topic: any, data: any, options: any, prefix: any) {
  if (this.client) {
    options = options || {
      qos: this.config.qos,
      retain: this.config.retain
    }

    topic = (prefix || this.config.prefix) + '/' + topic

    this.client.publish(topic, JSON.stringify(data), options, function (err: any) {
      if (err) {
        debug('Error while publishing a value', err.message)
      }
    })
  } // end if client
}

/**
 * Method used to get the topic with prefix/suffix
 */
MqttClient.prototype.getTopic = function (topic: any, set: any) {
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
