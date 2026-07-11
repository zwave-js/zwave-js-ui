'use strict'

import type {
	MqttClient as Client,
	IClientOptions,
	IClientPublishOptions,
	IClientSubscribeOptions,
} from 'mqtt'
import { connect } from 'mqtt'
import {
	allSettled,
	parseJSON,
	sanitizeTopic,
	pkgJson,
	stringifyJSON,
} from './utils.ts'
import { module } from './logger.ts'
import { TypedEventEmitter } from './EventEmitter.ts'
import { storeDir } from '../config/app.ts'
import { ensureDir } from './utils.ts'
import { Manager } from 'mqtt-jsonl-store'
import { join } from 'node:path'
import url from 'node:url'
import { getErrorMessage } from './errors.ts'

const logger = module('Mqtt')

export type MqttConfig = {
	name: string
	host: string
	port: number
	disabled: boolean
	reconnectPeriod: number
	prefix: string
	qos: 0 | 1 | 2
	retain: boolean
	clean: boolean
	store: boolean
	allowSelfsigned: boolean
	key: string
	cert: string
	ca: string
	auth: boolean
	username: string
	password: string
	_ca: string
	_key: string
	_cert: string
}

export interface MqttClientEventCallbacks {
	writeRequest: (parts: string[], payload: any) => void
	broadcastRequest: (parts: string[], payload: any) => void
	multicastRequest: (payload: any) => void
	apiCall: (topic: string, apiName: string, payload: any) => void
	connect: () => void
	brokerStatus: (online: boolean) => void
}

export type MqttClientEvents = Extract<keyof MqttClientEventCallbacks, string>

/**
 * A listener for a scoped exact-topic subscription (see
 * {@link default.subscribeExact}); receives the raw string payload, or
 * `undefined` when the received payload was not decodable text.
 */
export type MqttExactListener = (payload: string | undefined) => void

/**
 * Handle returned by {@link default.subscribeExact}. Disposing it removes
 * exactly the one listener it registered and, when it was the last listener for
 * its topic, unsubscribes that exact topic from the broker. Idempotent and safe
 * to call after the client has closed.
 */
export interface MqttSubscription {
	dispose(): void
}

class MqttClient extends TypedEventEmitter<MqttClientEventCallbacks> {
	// Assigned synchronously at the top of _init(), which the constructor always invokes before any other method can observe `this`
	private config!: MqttConfig
	private toSubscribe!: Map<
		string,
		IClientSubscribeOptions & { addPrefix: boolean }
	>
	// Stay unset for the instance's lifetime when MQTT is disabled, since _init() returns early in that case
	private _clientID?: string
	private client?: Client
	private error?: string
	private closed = false
	private retrySubTimeout: NodeJS.Timeout | null = null
	// Scoped exact-topic subscriptions (e.g. the Home Assistant
	// `homeassistant/status` birth/will topic). Unlike the prefixed
	// write/action subscriptions, these are owned by a subsystem for the
	// duration of ITS own lifecycle: an owner registers a listener via
	// `subscribeExact` and disposes it when it stops. They are (re)subscribed on
	// every `_onConnect` (reconnect-safe) and dispatched in `_onMessageReceived`
	// before any prefix handling. Keeping them here - instead of an
	// unconditional subscribe - means `MqttClient` no longer owns any Home
	// Assistant (or other subsystem) concern.
	private exactSubscriptions = new Map<string, Set<MqttExactListener>>()
	private _closeTimeout: NodeJS.Timeout | null = null
	private storeManager: Manager | null = null

	static CLIENTS_PREFIX = '_CLIENTS'

	public static get EVENTS_PREFIX() {
		return '_EVENTS'
	}

	private static NAME_PREFIX = 'ZWAVE_GATEWAY-'

	private static ACTIONS: string[] = ['broadcast', 'api', 'multicast']

	private static STATUS_TOPIC = 'status'
	private static VERSION_TOPIC = 'version'

	public get clientID() {
		return this._clientID
	}

	/**
	 * The constructor
	 */
	constructor(config: MqttConfig) {
		super()
		this._init(config).catch((e) => {
			logger.error('Error while initializing MQTT Client', e)
		})
	}

	get connected() {
		return this.client && this.client.connected
	}

	get disabled() {
		return this.config.disabled
	}

	/**
	 * Returns the topic used to send client and devices status updateStates
	 * if name is null the client is the gateway itself
	 */
	getClientTopic(suffix: string) {
		return `${this.config.prefix}/${MqttClient.CLIENTS_PREFIX}/${this._clientID}/${suffix}`
	}

	/**
	 * Returns the topic used to report client status
	 */
	getStatusTopic() {
		return this.getClientTopic(MqttClient.STATUS_TOPIC)
	}

	/**
	 * Method used to close clients connection, use this before destroy
	 */
	close(): Promise<void> {
		return new Promise((resolve) => {
			if (this.closed) {
				resolve()
				return
			}
			this.closed = true

			// Drop scoped exact-topic subscriptions so a closed client can never
			// re-subscribe them on a future connect. Owners still dispose their
			// own handles independently (both are idempotent).
			this.exactSubscriptions.clear()

			if (this.retrySubTimeout) {
				clearTimeout(this.retrySubTimeout)
				this.retrySubTimeout = null
			}

			let resolved = false

			const client = this.client
			if (client) {
				const onClose = async (error?: Error) => {
					// prevent multiple resolve
					if (resolved) {
						return
					}

					resolved = true

					// fix error:Failed to lock DB file when force closing
					await this.storeManager?.close()

					if (this._closeTimeout) {
						clearTimeout(this._closeTimeout)
						this._closeTimeout = null
					}

					if (error) {
						logger.error('Error while closing client', error)
					}
					this.removeAllListeners()
					logger.info('Client closed')
					resolve()
				}
				client.end(false, {}, onClose)
				// in case a clean close doesn't work, force close
				this._closeTimeout = setTimeout(() => {
					client.end(true, {}, onClose)
				}, 5000)
			} else {
				this.removeAllListeners()
				resolve()
			}
		})
	}

	/**
	 * Method used to get status
	 */
	getStatus() {
		const status: Record<string, any> = {}

		status.status = this.client && this.client.connected
		status.error = this.error || 'Offline'
		status.config = this.config

		return status
	}

	/**
	 * Method used to update client connection status
	 */
	updateClientStatus(connected: boolean) {
		if (this.client) {
			this.client.publish(
				this.getClientTopic(MqttClient.STATUS_TOPIC),
				JSON.stringify({ value: connected, time: Date.now() }),
				{ retain: this.config.retain, qos: this.config.qos },
			)
		}
	}

	/**
	 * Method used to publish app version to mqtt
	 */
	publishVersion() {
		if (this.client) {
			this.client.publish(
				this.getClientTopic(MqttClient.VERSION_TOPIC),
				JSON.stringify({ value: pkgJson.version, time: Date.now() }),
				{ retain: this.config.retain, qos: this.config.qos },
			)
		}
	}

	/**
	 * Method used to update client
	 */
	async update(config: MqttConfig) {
		await this.close()

		logger.info('Restarting Mqtt Client after update...')

		await this._init(config)
	}

	/**
	 * Method used to subscribe tags for write requests
	 */
	subscribe(
		topic: string,
		options: IClientSubscribeOptions & { addPrefix: boolean } = {
			qos: 1,
			addPrefix: true,
		},
	): Promise<void> {
		return new Promise((resolve, reject) => {
			const subOptions: IClientSubscribeOptions = {
				qos: options.qos,
			}

			topic = options.addPrefix
				? this.config.prefix + '/' + topic + '/set'
				: topic

			options.addPrefix = false // in case of retry, don't add again the prefix

			if (this.client && this.client.connected) {
				logger.log(
					'debug',
					`Subscribing to ${topic} with options %o`,
					subOptions,
				)
				this.client.subscribe(topic, subOptions, (err, granted) => {
					if (err) {
						logger.error(`Error subscribing to ${topic}`, err)
						this.toSubscribe.set(topic, options)
						reject(err)
					} else {
						for (const res of granted ?? []) {
							if (res.qos === 128) {
								logger.error(
									`Error subscribing to ${topic}, client doesn't have permission to subscribe to it`,
								)
							} else {
								logger.info(`Subscribed to ${topic}`)
							}
							this.toSubscribe.delete(topic)
						}
						resolve()
					}
				})
			} else {
				logger.debug(
					`Client not connected yet, subscribing to ${topic} later...`,
				)
				this.toSubscribe.set(topic, options)
				reject(Error('Client not connected'))
			}
		})
	}

	/**
	 * Register a scoped subscription to an EXACT broker topic (never prefixed),
	 * delivering that topic's raw string payload to `listener`. Returns an
	 * idempotent {@link MqttSubscription} disposer.
	 *
	 * Unlike {@link subscribe} (used for the prefixed write/action topics this
	 * client owns), scoped subscriptions are owned by a caller for the duration
	 * of its own lifecycle - e.g. the Home Assistant discovery subsystem
	 * subscribes `homeassistant/status` only while it is started. They are
	 * reconnect-safe: `_onConnect` (re)subscribes every registered exact topic,
	 * so a caller that subscribes once keeps receiving the topic across
	 * reconnects until it disposes. Disposing removes exactly this listener and,
	 * when it was the topic's last listener, unsubscribes the topic from the
	 * broker. Interpreting the payload (an online check, etc.) is the caller's
	 * concern, so `MqttClient` carries no subsystem-specific status logic.
	 */
	subscribeExact(
		topic: string,
		listener: MqttExactListener,
	): MqttSubscription {
		let listeners = this.exactSubscriptions.get(topic)
		const firstForTopic = !listeners || listeners.size === 0
		if (!listeners) {
			listeners = new Set()
			this.exactSubscriptions.set(topic, listeners)
		}
		listeners.add(listener)

		// Subscribe the broker topic now when already connected and this is its
		// first listener; otherwise `_onConnect` will (re)subscribe it. A
		// not-yet-connected attempt rejects (queued in `toSubscribe`) - swallow
		// it, the topic is tracked in `exactSubscriptions` regardless.
		if (firstForTopic && this.client?.connected) {
			this.subscribe(topic, { addPrefix: false, qos: 1 }).catch(() => {
				/* (re)subscribed on the next connect */
			})
		}

		let disposed = false
		return {
			dispose: (): void => {
				if (disposed) return
				disposed = true
				const set = this.exactSubscriptions.get(topic)
				if (!set) return
				set.delete(listener)
				if (set.size === 0) {
					this.exactSubscriptions.delete(topic)
					this.unsubscribeBroker(topic)
				}
			},
		}
	}

	/**
	 * Best-effort unsubscribe of an exact broker topic plus removal of any
	 * pending retry for it. Safe when disconnected/closed: the topic is already
	 * gone from `exactSubscriptions`, so it will not be re-subscribed on a
	 * future connect either way.
	 */
	private unsubscribeBroker(topic: string): void {
		this.toSubscribe.delete(topic)
		if (this.client?.connected) {
			this.client.unsubscribe(topic, (err?: Error) => {
				if (err) {
					logger.error(`Error unsubscribing from ${topic}`, err)
				} else {
					logger.info(`Unsubscribed from ${topic}`)
				}
			})
		}
	}

	/**
	 * Method used to publish an update
	 */
	publish(
		topic: string,
		data: any,
		options?: IClientPublishOptions,
		prefix?: string,
	) {
		if (this.client) {
			const settingOptions = {
				qos: this.config.qos,
				retain: this.config.retain,
			}

			// by default use settingsOptions
			options = Object.assign(settingOptions, options)

			topic = (prefix || this.config.prefix) + '/' + topic

			logger.log(
				'debug',
				'Publishing to %s: %o with options %o',
				topic,
				data,
				options,
			)

			this.client.publish(
				topic,
				stringifyJSON(data),
				options,
				function (err) {
					if (err) {
						logger.error(
							`Error while publishing a value ${err.message}`,
						)
					}
				},
			)
		} // end if client
	}

	/**
	 * Method used to get the topic with prefix/suffix
	 */
	getTopic(topic: string, set = false) {
		return this.config.prefix + '/' + topic + (set ? '/set' : '')
	}

	/**
	 * Initialize client
	 */
	private async _init(config: MqttConfig) {
		this.config = config
		this.toSubscribe = new Map()

		if (!config || config.disabled) {
			logger.info('MQTT is disabled')
			return
		}

		this._clientID = sanitizeTopic(
			MqttClient.NAME_PREFIX + (process.env.MQTT_NAME || config.name),
		)

		const parsed = url.parse(config.host || '')
		let protocol = 'mqtt'

		if (parsed.protocol) protocol = parsed.protocol.replace(/:$/, '')

		const options: IClientOptions = {
			clientId: this._clientID,
			reconnectPeriod: config.reconnectPeriod,
			clean: config.clean,
			rejectUnauthorized: !config.allowSelfsigned,
			will: {
				topic: this.getStatusTopic(),
				payload: JSON.stringify({ value: false }) as any,
				qos: this.config.qos,
				retain: this.config.retain,
			},
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
			const dbDir = join(storeDir, 'mqtt-packets-store')
			await ensureDir(dbDir)
			this.storeManager = new Manager(dbDir)
			await this.storeManager.open()

			// no reason to use a memory store for incoming messages
			options.incomingStore = this.storeManager.incoming
			options.outgoingStore = this.storeManager.outgoing
		}

		if (config.auth) {
			options.username = config.username
			options.password = config.password
		}

		try {
			const serverUrl = `${protocol}://${
				parsed.hostname || config.host
			}:${config.port}`
			logger.info(`Connecting to ${serverUrl}`)

			const client = connect(serverUrl, options)

			this.client = client

			client.on('connect', this._onConnect.bind(this))
			client.on('message', this._onMessageReceived.bind(this))
			client.on('reconnect', this._onReconnect.bind(this))
			client.on('close', this._onClose.bind(this))
			client.on('error', this._onError.bind(this))
			client.on('offline', this._onOffline.bind(this))
		} catch (e) {
			logger.error(`Error while connecting MQTT ${getErrorMessage(e)}`)
			this.error = getErrorMessage(e)
		}
	}

	/**
	 * Function called when MQTT client connects
	 */
	private async _onConnect() {
		logger.info('MQTT client connected')
		this.emit('connect')

		const subscribePromises: Promise<void>[] = []

		// (Re)subscribe every scoped exact topic an owner registered via
		// `subscribeExact` (e.g. `homeassistant/status`). Doing this on every
		// connect makes those subscriptions reconnect-safe without MqttClient
		// owning any of them; when none are registered this is a no-op.
		for (const topic of this.exactSubscriptions.keys()) {
			subscribePromises.push(
				this.subscribe(topic, { addPrefix: false, qos: 1 }),
			)
		}

		// subscribe to actions
		for (let i = 0; i < MqttClient.ACTIONS.length; i++) {
			subscribePromises.push(
				this.subscribe(
					[
						this.config.prefix,
						MqttClient.CLIENTS_PREFIX,
						this._clientID,
						MqttClient.ACTIONS[i],
						'#',
					].join('/'),
					{ addPrefix: false, qos: 1 },
				),
			)
		}

		await allSettled(subscribePromises)

		await this._retrySubscribe()

		this.emit('brokerStatus', true)

		this.publishVersion()

		// Update client status
		this.updateClientStatus(true)
	}

	/**
	 * Function called when MQTT client reconnects
	 */
	private _onReconnect() {
		logger.info('MQTT client reconnecting')
	}

	/**
	 * Function called when MQTT client reconnects
	 */
	private _onError(error: Error) {
		logger.error('Mqtt client error', error)
		this.error = error.message
	}

	/**
	 * Function called when MQTT client go offline
	 */
	private _onOffline() {
		if (this.retrySubTimeout) {
			clearTimeout(this.retrySubTimeout)
			this.retrySubTimeout = null
		}
		logger.info('MQTT client offline')
		this.emit('brokerStatus', false)
	}

	/**
	 * Function called when MQTT client is closed
	 */
	private _onClose() {
		logger.info('MQTT client closed')
	}

	/**
	 * Function called when an MQTT message is received
	 */
	private _onMessageReceived(topic: string, payload: Buffer) {
		if (this.closed) return

		let parsed: string | number | Record<string, any> | undefined =
			payload?.toString()

		logger.log('info', `Message received on ${topic}: %o`, parsed)

		// Deliver scoped exact-topic messages (e.g. `homeassistant/status`) to
		// their registered listeners before any prefix handling. The payload is
		// handed over as raw text; interpreting it (online check, an "invalid
		// payload" complaint, etc.) is the owning subsystem's concern.
		const exactListeners = this.exactSubscriptions.get(topic)
		if (exactListeners && exactListeners.size > 0) {
			const text = typeof parsed === 'string' ? parsed : undefined
			for (const listener of exactListeners) {
				listener(text)
			}
			return
		}

		// remove prefix
		topic = topic.substring(this.config.prefix.length + 1)

		const parts = topic.split('/')

		// It's not a write request
		if (parts.pop() !== 'set') return

		if (isNaN(parseInt(parsed))) {
			try {
				parsed = parseJSON(parsed)
			} catch (e) {
				// it' ok fallback to string
			}
		} else {
			parsed = Number(parsed)
		}

		// It's an action
		if (parts[0] === MqttClient.CLIENTS_PREFIX) {
			if (parts.length < 3 || parts[1] !== this._clientID) {
				// it could be we receive a message from another Z-UI client, ignore it
				return
			}

			const action = MqttClient.ACTIONS.indexOf(parts[2])

			switch (action) {
				case 0: // broadcast
					this.emit('broadcastRequest', parts.slice(3), parsed)
					// publish back to give a feedback the action has been received
					// same topic without /set suffix
					this.publish(parts.join('/'), parsed)
					break
				case 1: // api
					this.emit('apiCall', parts.join('/'), parts[3], parsed)
					break
				case 2: // multicast
					this.emit('multicastRequest', parsed)
					// publish back to give a feedback the action has been received
					// same topic without /set suffix
					this.publish(parts.join('/'), parsed)
					break
				default:
					logger.warn(`Unknown action received ${action} ${topic}`)
			}
		} else {
			// It's a write request on zwave network
			this.emit('writeRequest', parts, parsed)
		}
	} // end onMessageReceived

	private async _retrySubscribe() {
		if (this.retrySubTimeout) {
			clearTimeout(this.retrySubTimeout)
			this.retrySubTimeout = null
		}

		if (this.toSubscribe.size === 0) {
			return
		}

		logger.debug('Retry to subscribe to topics...')
		const subscribePromises: Promise<void>[] = []

		const topics = this.toSubscribe.keys()

		for (const t of topics) {
			subscribePromises.push(this.subscribe(t, this.toSubscribe.get(t)))
		}

		this.toSubscribe = new Map()

		await allSettled(subscribePromises)

		if (this.toSubscribe.size > 0) {
			this.retrySubTimeout = setTimeout(
				this._retrySubscribe.bind(this),
				5000,
			)
		}
	}
}

export default MqttClient
