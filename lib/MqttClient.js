'use strict'

// eslint-disable-next-line one-var
const reqlib = require('app-root-path').require
const mqtt = require('mqtt')
const { joinPath, sanitizeTopic } = reqlib('/lib/utils.js')
const NeDBStore = require('mqtt-nedb-store')
const EventEmitter = require('events')
const { storeDir } = reqlib('config/app.js')
const logger = reqlib('/lib/logger.js').module('Mqtt')
const url = require('native-url')

const appVersion = reqlib('package.json').version

const CLIENTS_PREFIX = '_CLIENTS'
const EVENTS_PREFIX = '_EVENTS'

const BROADCAST_PREFIX = '_BROADCAST'

const NAME_PREFIX = 'ZWAVE_GATEWAY-'

const ACTIONS = ['broadcast', 'api', 'multicast']

const HASS_WILL = 'homeassistant/status'

const STATUS_TOPIC = 'status'
const VERSION_TOPIC = 'version'

class MqttClient extends EventEmitter {
  /**
   * The constructor
   *
   * @param {import('../types').MqttConfig} config
   * @returns {import('../types').MqttClient}
   */
  constructor (config) {
    super()
    this._init(config)
  }

  get broadcastPrefix () {
    return BROADCAST_PREFIX
  }

  get eventsPrefix () {
    return EVENTS_PREFIX
  }

  get connected () {
    return this.client && this.client.connected
  }

  /**
   * Returns the topic used to send client and devices status updateStates
   * if name is null the client is the gateway itself
   */
  getClientTopic (suffix) {
    return `${this.config.prefix}/${CLIENTS_PREFIX}/${this.clientID}/${suffix}`
  }

  /**
   * Method used to close clients connection, use this before destroy
   */
  close () {
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
          logger.info('Client closed')
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
  getStatus () {
    const status = {}

    status.status = this.client && this.client.connected
    status.error = this.error || 'Offline'
    status.config = this.config

    return status
  }

  /**
   * Method used to update client connection status
   */
  updateClientStatus (connected) {
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
  publishVersion () {
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
  update (config) {
    this.close()

    logger.info('Restarting Mqtt Client after update...')

    this._init(config)
  }

  /**
   * Method used to subscribe tags for write requests
   */
  subscribe (topic) {
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
  publish (topic, data, options, prefix) {
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
  getTopic (topic, set) {
    return this.config.prefix + '/' + topic + (set ? '/set' : '')
  }

  /**
   * Initialize client
   *
   * @param {import('../types').MqttConfig} config
   */
  _init (config) {
    this.config = config
    this.toSubscribe = []

    if (!config || config.disabled) {
      logger.info('MQTT is disabled')
      return
    }

    this.clientID = sanitizeTopic(NAME_PREFIX + config.name)

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
      const manager = NeDBStore(joinPath(storeDir, 'mqtt'), {
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

      client.on('connect', this._onConnect.bind(this))
      client.on('message', this._onMessageReceived.bind(this))
      client.on('reconnect', this._onReconnect.bind(this))
      client.on('close', this._onClose.bind(this))
      client.on('error', this._onError.bind(this))
      client.on('offline', this._onOffline.bind(this))
    } catch (e) {
      logger.error(`Error while connecting MQTT ${e.message}`)
      this.error = e.message
    }
  }

  /**
   * Function called when MQTT client connects
   */
  _onConnect () {
    logger.info('MQTT client connected')
    this.emit('connect')

    if (this.toSubscribe) {
      // don't use toSubscribe here to prevent infinite loops when subscribe fails
      const topics = [...this.toSubscribe]
      for (const t of topics) {
        this.subscribe(t)
      }
    }

    this.client.subscribe(HASS_WILL)

    // subscribe to actions
    // eslint-disable-next-line no-redeclare
    for (let i = 0; i < ACTIONS.length; i++) {
      this.client.subscribe(
        [
          this.config.prefix,
          CLIENTS_PREFIX,
          this.clientID,
          ACTIONS[i],
          '#'
        ].join('/')
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
  _onReconnect () {
    logger.info('MQTT client reconnecting')
  }

  /**
   * Function called when MQTT client reconnects
   */
  _onError (error) {
    logger.info(error.message)
    this.error = error.message
  }

  /**
   * Function called when MQTT client go offline
   */
  _onOffline () {
    logger.info('MQTT client offline')
    this.emit('brokerStatus', false)
  }

  /**
   * Function called when MQTT client is closed
   */
  _onClose () {
    logger.info('MQTT client closed')
  }

  /**
   * Function called when an MQTT message is received
   */
  _onMessageReceived (topic, payload) {
    if (this.closed) return

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
          // publish back to give a feedback the action has been received
          // same topic without /set suffix
          this.publish(parts.join('/'), payload)
          break
        case 1: // api
          this.emit('apiCall', parts.join('/'), parts[3], payload)
          break
        case 2: // multicast
          this.emit('multicastRequest', payload)
          // publish back to give a feedback the action has been received
          // same topic without /set suffix
          this.publish(parts.join('/'), payload)
          break
        default:
          logger.warn(`Unknown action received ${action} ${topic}`)
      }
    } else {
      // It's a write request on zwave network
      this.emit('writeRequest', parts, payload)
    }
  } // end onMessageReceived
}

module.exports = MqttClient
