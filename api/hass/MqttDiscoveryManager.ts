import { DiscoveryGenerator } from './DiscoveryGenerator.ts'
import type {
	HassDiscoveryConfig,
	HassDeviceRegistryLifecyclePort,
	HassDeviceRegistrySourcePort,
	HassLogger,
	HassMqttPort,
	HassNodeUpdatePort,
	HassStatusSource,
	HassTopicPort,
	HassZwavePort,
} from './ports.ts'

// Re-exported so the discovery subsystem's status-source shape stays reachable
// from the manager that consumes it, while it is declared with the sibling ports
export type { HassStatusSource } from './ports.ts'

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
	 * publish from an event arriving later in the teardown. Each step is isolated,
	 * so one throwing does not skip the rest, and the first error is rethrown.
	 */
	public stop(): void {
		const errors: unknown[] = []
		const step = (label: string, fn: () => void): void => {
			try {
				fn()
			} catch (error) {
				errors.push(error)
				this.logger.error(
					`Error while stopping discovery (${label})`,
					error,
				)
			}
		}

		step('deactivate', () => this._discoveryGenerator.deactivate())
		// Clear the field before invoking the disposer, so a throwing disposer
		// still leaves it clear and a later start() can re-subscribe
		const disposeStatus = this._statusDisposer
		this._statusDisposer = undefined
		if (disposeStatus) step('status', disposeStatus)
		step('registry', () => this._customDeviceRegistry.dispose())

		if (errors.length > 0) throw errors[0]
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

		// `stop()` clears `_statusDisposer` before invoking this, so a throwing
		// dispose cannot wedge the field truthy and block a later re-subscribe.
		// The `finally` drops the broker listener even if the unsubscribe throws,
		// so a later start() cannot leave a duplicate `brokerStatus` listener
		this._statusDisposer = (): void => {
			try {
				subscription.dispose()
			} finally {
				source.off('brokerStatus', onBrokerStatus)
			}
		}
	}
}
