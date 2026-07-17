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
 * A disposable scoped subscription handle; kept local so the manager never
 * imports the concrete `MqttClient`.
 */
export interface HassBrokerSubscription {
	dispose(): void
}

/**
 * The narrow MQTT surface the scoped status subscription needs; kept minimal so
 * the manager never depends on the concrete `MqttClient`.
 */
export interface HassStatusSource {
	subscribeExact(
		topic: string,
		listener: (payload: string | undefined) => void,
	): HassBrokerSubscription
	on(event: 'brokerStatus', handler: (online: boolean) => void): unknown
	off(event: 'brokerStatus', handler: (online: boolean) => void): unknown
	/**
	 * Re-emit the plugin-facing `hassStatus` event with the parsed boolean.
	 * Routing the emit back through the source keeps the broker subscription
	 * manager-owned rather than re-adding an unconditional one to `MqttClient`.
	 */
	emitHassStatus(online: boolean): void
}

/**
 * The fixed Home Assistant birth/will topic. Home Assistant publishes `online`
 * to it on (re)start; the payload is matched case-insensitively and never
 * prefixed.
 */
export const HASS_STATUS_TOPIC = 'homeassistant/status'

export interface MqttDiscoveryManagerOptions {
	/** Live gateway/discovery configuration; a stable reference */
	config: HassDiscoveryConfig
	mqtt: HassMqttPort
	zwave: HassZwavePort
	topics: HassTopicPort
	/**
	 * Process-wide custom-device catalog source; the manager forks a
	 * per-instance subscribed view so every Gateway owns an isolated catalog
	 * while the source keeps the single import-time watcher pair.
	 */
	registrySource: CustomDeviceRegistry
	logger: HassLogger
}

/**
 * Owns the Home Assistant MQTT discovery subsystem: the mutable `discovered`
 * device index, the per-instance custom-device catalog fork, the {@link
 * DiscoveryGenerator}, and the scoped `homeassistant/status`/broker-reconnect
 * subscription that drives a full rediscovery. The Gateway keeps its public
 * discovery facades by delegating through the accessors this manager exposes.
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
	 * Fork/start the catalog view, reset the discovered index, and subscribe to
	 * status transitions when enabled. Safe to call again after {@link stop}.
	 */
	public start(statusSource?: HassStatusSource, statusEnabled = false): void {
		// Re-arm the publication fence because a restart may reuse this very
		// generator instance on the standalone Gateway path
		this._discoveryGenerator.activate()
		this._customDeviceRegistry.start()
		this._discovered = {}
		if (statusSource && statusEnabled) {
			this.subscribeStatus(statusSource)
		}
	}

	/**
	 * Dispose the status subscription and the catalog view; idempotent. The
	 * publication fence is dropped synchronously before anything else, so no
	 * retained discovery can publish once stop begins - even from an event that
	 * arrives while an outer coordinator still awaits the server destroy.
	 */
	public stop(): void {
		this._discoveryGenerator.deactivate()
		this.disposeStatus()
		this._customDeviceRegistry.dispose()
	}

	/**
	 * Subscribe the Home Assistant birth/will topic plus broker-reconnect
	 * transitions; an `online` status (case-insensitive) or a broker reconnect
	 * triggers a full {@link rediscoverAll}. Returns an idempotent disposer and
	 * never double-subscribes. The status parsing and its log messages live here
	 * so the whole Home Assistant status concern stays in the discovery subsystem.
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
			// Emit the plugin-facing compatibility event after the internal
			// rediscovery, so a misbehaving listener cannot block it, and only
			// from this single manager-owned subscription
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
