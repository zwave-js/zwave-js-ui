import type { CustomDeviceRegistry } from './CustomDeviceRegistry.ts'
import { DiscoveryGenerator } from './DiscoveryGenerator.ts'
import type {
	HassDiscoveryConfig,
	HassLogger,
	HassMqttPort,
	HassTopicPort,
	HassZwavePort,
} from './ports.ts'
import type { HassDevice } from './types.ts'

/**
 * A disposable scoped subscription handle (structurally matches
 * `MqttClient.subscribeExact`'s return): disposing it removes exactly the one
 * listener it registered. Kept local so the manager never imports the concrete
 * client.
 */
export interface HassBrokerSubscription {
	dispose(): void
}

/**
 * The narrow MQTT surface the scoped Home Assistant status subscription needs.
 * `MqttClient` satisfies it structurally; kept minimal so the manager never
 * depends on the concrete client.
 *
 * `subscribeExact` registers a reconnect-safe subscription to an exact broker
 * topic and hands back an idempotent disposer; `on`/`off('brokerStatus')` track
 * broker connection transitions (a reconnect triggers a full rediscovery).
 */
export interface HassStatusSource {
	subscribeExact(
		topic: string,
		listener: (payload: string | undefined) => void,
	): HassBrokerSubscription
	on(event: 'brokerStatus', handler: (online: boolean) => void): unknown
	off(event: 'brokerStatus', handler: (online: boolean) => void): unknown
	/**
	 * Re-emit the public, plugin-facing `hassStatus` compatibility event
	 * carrying the parsed online/offline boolean. The concrete `MqttClient`
	 * implements this by emitting on its own typed event bus. Routing the emit
	 * back through the source (rather than re-adding an unconditional
	 * `homeassistant/status` subscription to `MqttClient`) keeps the broker
	 * subscription manager-owned while preserving the legacy plugin event.
	 */
	emitHassStatus(online: boolean): void
}

/**
 * The fixed Home Assistant birth/will topic. Home Assistant publishes `online`
 * to it when it (re)starts; the payload is matched case-insensitively and is
 * never prefixed. Owned here (not by `MqttClient`) so the whole Home Assistant
 * status concern lives inside the discovery subsystem.
 */
export const HASS_STATUS_TOPIC = 'homeassistant/status'

export interface MqttDiscoveryManagerOptions {
	/** Live gateway/discovery configuration (a stable reference). */
	config: HassDiscoveryConfig
	/** MQTT publish/topic port (adapts the live client). */
	mqtt: HassMqttPort
	/** Z-Wave read/write port (adapts the live client). */
	zwave: HassZwavePort
	/** Node/value topic mapping port (provided by the Gateway facade). */
	topics: HassTopicPort
	/**
	 * Process-wide custom-device catalog source. The manager forks a
	 * lightweight, per-instance subscribed view of it so every Gateway owns an
	 * isolated catalog while the source keeps the single import-time watcher
	 * pair.
	 */
	registrySource: CustomDeviceRegistry
	logger: HassLogger
}

/**
 * Owns the legacy Home Assistant MQTT discovery subsystem that used to live
 * inline in `Gateway`: the mutable `discovered` device index, the per-instance
 * custom-device catalog fork, the {@link DiscoveryGenerator} instance, and the
 * scoped `homeassistant/status`/broker-reconnect subscription that drives a
 * full rediscovery.
 *
 * Lifecycle (all idempotent):
 *  - {@link start} forks + starts the catalog view, resets `discovered`, and
 *    (when MQTT is enabled) wires the status subscription.
 *  - {@link stop} disposes the status subscription and the catalog view.
 *
 * The Gateway keeps its public discovery facades by delegating through the
 * {@link discoveryGenerator}/{@link customDeviceRegistry}/{@link discovered}
 * accessors this manager exposes, so behaviour and the reach-in test surface
 * are unchanged.
 */
export default class MqttDiscoveryManager {
	private readonly logger: HassLogger
	private readonly _customDeviceRegistry: CustomDeviceRegistry
	private readonly _discoveryGenerator: DiscoveryGenerator
	private _discovered: Record<string, HassDevice> = {}
	private _statusDisposer: (() => void) | undefined

	public constructor(options: MqttDiscoveryManagerOptions) {
		this.logger = options.logger
		this._customDeviceRegistry = options.registrySource.fork()

		const getDiscovered = (): Record<string, HassDevice> => this._discovered
		this._discoveryGenerator = new DiscoveryGenerator({
			config: options.config,
			mqtt: options.mqtt,
			zwave: options.zwave,
			topics: options.topics,
			registry: this._customDeviceRegistry,
			state: {
				get discovered() {
					return getDiscovered()
				},
			},
			logger: options.logger,
		})
	}

	/** The owned discovery generator (the Gateway facades delegate to it). */
	public get discoveryGenerator(): DiscoveryGenerator {
		return this._discoveryGenerator
	}

	/** The per-instance custom-device catalog view. */
	public get customDeviceRegistry(): CustomDeviceRegistry {
		return this._customDeviceRegistry
	}

	/** The mutable index of currently discovered devices. */
	public get discovered(): Record<string, HassDevice> {
		return this._discovered
	}

	public set discovered(value: Record<string, HassDevice>) {
		this._discovered = value
	}

	/**
	 * Start the discovery subsystem: fork/start the catalog view, reset the
	 * discovered index, and (when a status source is supplied and MQTT status
	 * updates are enabled) subscribe to HA/broker status transitions. Safe to
	 * call again after {@link stop} (restart).
	 */
	public start(statusSource?: HassStatusSource, statusEnabled = false): void {
		// Re-arm the publication fence first (a restart may reuse this very
		// generator instance on the standalone Gateway path).
		this._discoveryGenerator.activate()
		this._customDeviceRegistry.start()
		this._discovered = {}
		if (statusSource && statusEnabled) {
			this.subscribeStatus(statusSource)
		}
	}

	/**
	 * Dispose the status subscription and the catalog view. Idempotent and
	 * reentrant, so it is safe to call from both the Gateway teardown and an
	 * outer coordinator.
	 *
	 * The publication fence is dropped FIRST and synchronously, before any
	 * subscription/watcher is disposed, so from the instant stop begins no
	 * further retained discovery can be published - even by an event that
	 * arrives while an outer coordinator is still awaiting the server destroy.
	 */
	public stop(): void {
		this._discoveryGenerator.deactivate()
		this.disposeStatus()
		this._customDeviceRegistry.dispose()
	}

	/**
	 * Scoped subscription to the Home Assistant birth/will topic
	 * (`homeassistant/status`, subscribed through the caller-supplied scoped
	 * MQTT API) plus broker-reconnect (`brokerStatus`) transitions. An HA
	 * `online` status (case-insensitive) or a broker reconnect triggers a full
	 * {@link rediscoverAll}. Returns an idempotent disposer and never
	 * double-subscribes: a second call while already subscribed returns the
	 * existing disposer.
	 *
	 * The online check, the `Home Assistant is ONLINE/OFFLINE` log and the
	 * legacy `Invalid payload sent to Hass Will topic` complaint live here (not
	 * in `MqttClient`), so the entire Home Assistant status concern is owned by
	 * the discovery subsystem.
	 */
	public subscribeStatus(source: HassStatusSource): () => void {
		if (this._statusDisposer) return this._statusDisposer

		const onStatusMessage = (payload: string | undefined): void => {
			if (typeof payload !== 'string') {
				this.logger.error('Invalid payload sent to Hass Will topic')
				return
			}
			const online = payload.toLowerCase() === 'online'
			this.logger.info(
				`Home Assistant is ${online ? 'ONLINE' : 'OFFLINE'}`,
			)
			if (online) this.rediscoverAll()
			// Re-emit the legacy plugin-facing compatibility event LAST, from
			// this single manager-owned status subscription, so a plugin's
			// `mqtt.on('hassStatus')` observes the same boolean value and the
			// same once-per-message cadence as before the refactor - without a
			// second, unconditional broker subscription and without letting a
			// misbehaving listener block the internal quiesce/rediscovery above.
			source.emitHassStatus(online)
		}
		const onBrokerStatus = (online: boolean): void => {
			if (online) this.rediscoverAll()
		}

		const subscription = source.subscribeExact(
			HASS_STATUS_TOPIC,
			onStatusMessage,
		)
		source.on('brokerStatus', onBrokerStatus)

		let disposed = false
		this._statusDisposer = (): void => {
			if (disposed) return
			disposed = true
			subscription.dispose()
			source.off('brokerStatus', onBrokerStatus)
			this._statusDisposer = undefined
		}
		return this._statusDisposer
	}

	/** Dispose the active status subscription, if any. Idempotent. */
	public disposeStatus(): void {
		this._statusDisposer?.()
	}

	/** Rediscover every persistent device on every node. */
	public rediscoverAll(): void {
		this._discoveryGenerator.rediscoverAll()
	}
}
