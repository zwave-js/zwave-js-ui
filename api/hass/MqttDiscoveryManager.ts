import { DiscoveryGenerator } from './DiscoveryGenerator.ts'
import { once } from '../lib/utils.ts'
import type {
	HassDiscoveryConfig,
	HassDeviceRegistryLifecyclePort,
	HassDeviceRegistrySourcePort,
	HassLogger,
	HassMqttPort,
	HassNodeUpdatePort,
	HassTopicPort,
	HassZwavePort,
} from './ports.ts'

/**
 * The narrow MQTT surface the scoped status subscription needs; kept minimal so
 * the manager never depends on the concrete `MqttClient`.
 */
export interface HassStatusSource {
	subscribeExact(
		topic: string,
		listener: (payload: string | undefined) => void,
	): { dispose(): void }
	on(event: 'brokerStatus', handler: (online: boolean) => void): unknown
	off(event: 'brokerStatus', handler: (online: boolean) => void): unknown
	emit(event: 'hassStatus', online: boolean): unknown
}

/**
 * The fixed Home Assistant birth/will topic. Home Assistant publishes `online`
 * to it on (re)start; the payload is matched case-insensitively and never
 * prefixed.
 */
export const HASS_STATUS_TOPIC = 'homeassistant/status'

export interface MqttDiscoveryManagerOptions {
	config: HassDiscoveryConfig
	mqtt?: HassMqttPort
	zwave?: HassZwavePort
	nodeUpdates: HassNodeUpdatePort
	topics: HassTopicPort
	/**
	 * Process-wide custom-device catalog source; the manager forks a
	 * per-instance subscribed view so every Gateway owns an isolated catalog
	 * while the source keeps the single import-time watcher pair.
	 */
	registrySource: HassDeviceRegistrySourcePort
	logger: HassLogger
}

/**
 * Owns the Home Assistant MQTT discovery subsystem: the per-instance
 * custom-device catalog fork, the {@link DiscoveryGenerator}, and the scoped
 * `homeassistant/status`/broker-reconnect subscription that drives a full
 * rediscovery. The Gateway keeps its public discovery facades by delegating
 * through the accessors this manager exposes.
 */
export default class MqttDiscoveryManager {
	private readonly logger: HassLogger
	private readonly _customDeviceRegistry: HassDeviceRegistryLifecyclePort
	private readonly _discoveryGenerator: DiscoveryGenerator
	private _statusDisposer: (() => void) | undefined

	public constructor(options: MqttDiscoveryManagerOptions) {
		this.logger = options.logger
		this._customDeviceRegistry = options.registrySource.fork()

		this._discoveryGenerator = new DiscoveryGenerator({
			config: options.config,
			mqtt: options.mqtt,
			zwave: options.zwave,
			nodeUpdates: options.nodeUpdates,
			topics: options.topics,
			registry: this._customDeviceRegistry,
			logger: options.logger,
		})
	}

	/** The owned discovery generator (the Gateway facades delegate to it). */
	public get discoveryGenerator(): DiscoveryGenerator {
		return this._discoveryGenerator
	}

	/** The per-instance custom-device catalog view. */
	public get customDeviceRegistry(): HassDeviceRegistryLifecyclePort {
		return this._customDeviceRegistry
	}

	/**
	 * Start the catalog view, re-arm the generator, and subscribe to status
	 * transitions when enabled. Safe to call again after {@link stop}.
	 */
	public start(statusSource?: HassStatusSource, statusEnabled = false): void {
		this._customDeviceRegistry.start()
		this._discoveryGenerator.reset()
		if (statusSource && statusEnabled) {
			this.subscribeStatus(statusSource)
		}
	}

	/**
	 * Dispose the status subscription and the catalog view; idempotent. The
	 * publication fence drops synchronously first, so no retained discovery can
	 * publish from an event arriving later in the teardown.
	 */
	public stop(): void {
		this._discoveryGenerator.deactivate()
		this._statusDisposer?.()
		this._customDeviceRegistry.dispose()
	}

	/**
	 * Subscribe the Home Assistant birth/will topic plus broker-reconnect
	 * transitions, either of which triggers a full rediscovery. Parsing and its
	 * log messages live here, so the whole status concern stays in the discovery
	 * subsystem.
	 */
	private subscribeStatus(source: HassStatusSource): void {
		if (this._statusDisposer) return

		const onStatusMessage = (payload: string | undefined): void => {
			if (typeof payload !== 'string') {
				this.logger.error('Invalid payload sent to Hass Will topic')
				return
			}
			const online = payload.toLowerCase() === 'online'
			this.logger.info(
				`Home Assistant is ${online ? 'ONLINE' : 'OFFLINE'}`,
			)
			if (online) this._discoveryGenerator.rediscoverAll()
			// Emit after the internal rediscovery, so a misbehaving plugin
			// listener cannot block it
			source.emit('hassStatus', online)
		}
		const onBrokerStatus = (online: boolean): void => {
			if (online) this._discoveryGenerator.rediscoverAll()
		}

		const subscription = source.subscribeExact(
			HASS_STATUS_TOPIC,
			onStatusMessage,
		)
		source.on('brokerStatus', onBrokerStatus)

		this._statusDisposer = once((): void => {
			subscription.dispose()
			source.off('brokerStatus', onBrokerStatus)
			this._statusDisposer = undefined
		})
	}
}
