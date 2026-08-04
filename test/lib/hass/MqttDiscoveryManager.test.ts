/**
 * Direct unit/characterization tests for {@link MqttDiscoveryManager}, the owner
 * of the Home Assistant MQTT discovery subsystem: the per-instance
 * custom-device catalog fork, the {@link DiscoveryGenerator} instance, and the
 * scoped `homeassistant/status`/broker-reconnect subscription that drives a
 * full rediscovery.
 *
 * These exercise the manager in isolation (fake ports, a real but unstarted
 * `CustomDeviceRegistry` source so no `fs.watch` handles are created, and a
 * hand-rolled status source) so every lifecycle transition, idempotency guard,
 * scoped-subscription disposer and two-manager isolation path are proven
 * against the manager itself.
 * The end-to-end delivery of a real `homeassistant/status` retained message is
 * covered by `mqttLifecycle.test.ts` through the Gateway harness.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import MqttDiscoveryManager, {
	HASS_STATUS_TOPIC,
	type HassStatusSource,
	type MqttDiscoveryManagerOptions,
} from '#api/hass/MqttDiscoveryManager.ts'
import { CustomDeviceRegistry } from '#api/hass/CustomDeviceRegistry.ts'
import type { HassDevice } from '#api/hass/types.ts'
import {
	makeHassLogger,
	makeMqttPort,
	makeNodeUpdatePort,
	makeTopicPort,
	makeZwavePort,
	type MockHassLogger,
} from './fixtures.ts'

/**
 * A minimal `HassStatusSource` that records the scoped exact-topic
 * subscriptions and broker-reconnect listeners so tests can assert exact
 * subscription counts, drive `homeassistant/status` payload deliveries and
 * broker transitions, and prove each disposer removed exactly what it added.
 */
function makeStatusSource() {
	const brokerListeners: Array<(online: boolean) => void> = []
	const exactListeners = new Map<
		string,
		Set<(payload: string | undefined) => void>
	>()
	const source: HassStatusSource & {
		deliver(topic: string, payload: string | undefined): void
		emitBroker(online: boolean): void
		exactCount(topic?: string): number
		brokerCount(): number
		hassStatusEmits: boolean[]
	} = {
		subscribeExact(topic, listener) {
			let set = exactListeners.get(topic)
			if (!set) {
				set = new Set()
				exactListeners.set(topic, set)
			}
			set.add(listener)
			let disposed = false
			return {
				dispose() {
					if (disposed) return
					disposed = true
					exactListeners.get(topic)?.delete(listener)
				},
			}
		},
		on(_event, handler) {
			brokerListeners.push(handler)
			return source
		},
		off(_event, handler) {
			const index = brokerListeners.indexOf(handler)
			if (index >= 0) brokerListeners.splice(index, 1)
			return source
		},
		emit(_event, online) {
			source.hassStatusEmits.push(online)
			return true
		},
		hassStatusEmits: [],
		deliver(topic, payload) {
			for (const listener of [...(exactListeners.get(topic) ?? [])]) {
				listener(payload)
			}
		},
		emitBroker(online) {
			for (const handler of [...brokerListeners]) handler(online)
		},
		exactCount(topic = HASS_STATUS_TOPIC) {
			return exactListeners.get(topic)?.size ?? 0
		},
		brokerCount() {
			return brokerListeners.length
		},
	}
	return source
}

function device(overrides: Partial<HassDevice> = {}): HassDevice {
	return {
		type: 'sensor',
		object_id: 'test',
		discovery_payload: {},
		values: ['37-0-currentValue'],
		...overrides,
	}
}

interface Harness {
	manager: MqttDiscoveryManager
	source: CustomDeviceRegistry
	logger: MockHassLogger
	options: MqttDiscoveryManagerOptions
}

function makeManager(
	overrides: Partial<MqttDiscoveryManagerOptions> = {},
): Harness {
	const logger = makeHassLogger()
	// A real registry source, deliberately not started: the manager forks a
	// child in its constructor and the fork subscribes to this source on
	// start()/unsubscribes on stop(), so no file watchers are ever installed
	const source = new CustomDeviceRegistry({
		storeDir: '/tmp/mqtt-discovery-manager-test',
		logger,
	})
	const options: MqttDiscoveryManagerOptions = {
		config: { hassDiscovery: true },
		mqtt: makeMqttPort(),
		zwave: makeZwavePort(),
		nodeUpdates: makeNodeUpdatePort(),
		topics: makeTopicPort(),
		registrySource: source,
		logger,
		...overrides,
	}
	const manager = new MqttDiscoveryManager(options)
	return { manager, source, logger, options }
}

describe('MqttDiscoveryManager start/stop lifecycle', () => {
	it('resets the discovered index when it starts', () => {
		const { manager } = makeManager()
		const reset = vi.spyOn(manager.discoveryGenerator, 'reset')

		manager.start()

		expect(reset).toHaveBeenCalledOnce()
	})

	it('stop() is idempotent and reentrant', () => {
		const { manager } = makeManager()
		manager.start()

		manager.stop()
		expect(() => manager.stop()).not.toThrow()
	})

	it('stop() fences discovery publication synchronously, and a later start re-arms it', () => {
		const { manager } = makeManager()
		const generator = manager.discoveryGenerator

		manager.start()
		expect(generator.active).toBe(true)

		// stop() must drop the fence synchronously, before anything it awaits, so
		// no producer can publish retained discovery once teardown has begun
		manager.stop()
		expect(generator.active).toBe(false)

		// A restart re-arms, so a manager started again publishes as documented
		manager.start()
		expect(generator.active).toBe(true)
	})
})

describe('MqttDiscoveryManager scoped status subscription', () => {
	it('subscribes to the fixed homeassistant/status topic (never prefixed)', () => {
		const { manager } = makeManager()
		const status = makeStatusSource()

		manager.start(status, true)

		expect(status.exactCount('homeassistant/status')).toBe(1)
	})

	it('an online HA status triggers a full rediscovery and logs ONLINE', () => {
		const { manager, logger } = makeManager()
		const rediscoverAll = vi
			.spyOn(manager.discoveryGenerator, 'rediscoverAll')
			.mockImplementation(() => {})
		const status = makeStatusSource()

		manager.start(status, true)
		status.deliver(HASS_STATUS_TOPIC, 'online')

		expect(rediscoverAll).toHaveBeenCalledTimes(1)
		expect(logger.info).toHaveBeenCalledWith('Home Assistant is ONLINE')
	})

	it('the online check is case-insensitive', () => {
		const { manager } = makeManager()
		const rediscoverAll = vi
			.spyOn(manager.discoveryGenerator, 'rediscoverAll')
			.mockImplementation(() => {})
		const status = makeStatusSource()

		manager.start(status, true)
		status.deliver(HASS_STATUS_TOPIC, 'OnLiNe')

		expect(rediscoverAll).toHaveBeenCalledTimes(1)
	})

	it('an offline HA status logs OFFLINE and does not rediscover', () => {
		const { manager, logger } = makeManager()
		const rediscoverAll = vi
			.spyOn(manager.discoveryGenerator, 'rediscoverAll')
			.mockImplementation(() => {})
		const status = makeStatusSource()

		manager.start(status, true)
		status.deliver(HASS_STATUS_TOPIC, 'offline')

		expect(logger.info).toHaveBeenCalledWith('Home Assistant is OFFLINE')
		expect(rediscoverAll).not.toHaveBeenCalled()
	})

	it('re-emits the plugin-facing hassStatus compatibility event for each status message', () => {
		const { manager } = makeManager()
		vi.spyOn(
			manager.discoveryGenerator,
			'rediscoverAll',
		).mockImplementation(() => {})
		const status = makeStatusSource()

		manager.start(status, true)
		status.deliver(HASS_STATUS_TOPIC, 'online')
		status.deliver(HASS_STATUS_TOPIC, 'offline')
		status.deliver(HASS_STATUS_TOPIC, 'ONLINE')

		// Same boolean values, same once-per-message order, no duplicates.
		expect(status.hassStatusEmits).toEqual([true, false, true])
	})

	it('does not emit hassStatus for a non-string payload or a broker reconnect', () => {
		const { manager } = makeManager()
		vi.spyOn(
			manager.discoveryGenerator,
			'rediscoverAll',
		).mockImplementation(() => {})
		const status = makeStatusSource()

		manager.start(status, true)
		// Non-string payload logs a complaint with no compat emit
		status.deliver(HASS_STATUS_TOPIC, undefined)
		// Broker reconnect drives an internal rediscovery but is not a HA
		// birth/will message, so it must not surface as a hassStatus event
		status.emitBroker(true)

		expect(status.hassStatusEmits).toEqual([])
	})

	it('a non-string status payload is rejected and does not rediscover', () => {
		const { manager, logger } = makeManager()
		const rediscoverAll = vi
			.spyOn(manager.discoveryGenerator, 'rediscoverAll')
			.mockImplementation(() => {})
		const status = makeStatusSource()

		manager.start(status, true)
		status.deliver(HASS_STATUS_TOPIC, undefined)

		expect(logger.error).toHaveBeenCalledWith(
			'Invalid payload sent to Hass Will topic',
		)
		expect(rediscoverAll).not.toHaveBeenCalled()
	})

	it('an online broker reconnect triggers a full rediscovery; offline does not', () => {
		const { manager } = makeManager()
		const rediscoverAll = vi
			.spyOn(manager.discoveryGenerator, 'rediscoverAll')
			.mockImplementation(() => {})
		const status = makeStatusSource()

		manager.start(status, true)
		status.emitBroker(false)
		expect(rediscoverAll).not.toHaveBeenCalled()

		status.emitBroker(true)
		expect(rediscoverAll).toHaveBeenCalledTimes(1)
	})

	it('a second start does not double-subscribe', () => {
		const { manager } = makeManager()
		const status = makeStatusSource()

		manager.start(status, true)
		manager.start(status, true)

		expect(status.exactCount()).toBe(1)
		expect(status.brokerCount()).toBe(1)
	})

	it('stop() removes exactly the listeners start() added, and is idempotent', () => {
		const { manager } = makeManager()
		const status = makeStatusSource()

		manager.start(status, true)
		expect(status.exactCount()).toBe(1)
		expect(status.brokerCount()).toBe(1)

		manager.stop()
		expect(status.exactCount()).toBe(0)
		expect(status.brokerCount()).toBe(0)

		expect(() => manager.stop()).not.toThrow()
		expect(status.exactCount()).toBe(0)
	})

	it('a start after a stop re-subscribes', () => {
		const { manager } = makeManager()
		const status = makeStatusSource()

		manager.start(status, true)
		manager.stop()
		manager.start(status, true)

		expect(status.exactCount()).toBe(1)
		expect(status.brokerCount()).toBe(1)
	})

	it('stop() is a no-op when nothing was subscribed', () => {
		const { manager } = makeManager()
		expect(() => manager.stop()).not.toThrow()
	})

	it('a stopped subscription no longer reacts to status transitions', () => {
		const { manager } = makeManager()
		const rediscoverAll = vi
			.spyOn(manager.discoveryGenerator, 'rediscoverAll')
			.mockImplementation(() => {})
		const status = makeStatusSource()

		manager.start(status, true)
		manager.stop()
		status.deliver(HASS_STATUS_TOPIC, 'online')
		status.emitBroker(true)

		expect(rediscoverAll).not.toHaveBeenCalled()
	})

	it('start(source, false) does not subscribe to status', () => {
		const { manager } = makeManager()
		const status = makeStatusSource()

		manager.start(status, false)

		expect(status.exactCount()).toBe(0)
		expect(status.brokerCount()).toBe(0)
	})

	it('start() without a status source does not subscribe', () => {
		const { manager } = makeManager()
		const status = makeStatusSource()

		manager.start()

		expect(status.exactCount()).toBe(0)
	})

	it('stop() disposes the status subscription wired by start()', () => {
		const { manager } = makeManager()
		const rediscoverAll = vi
			.spyOn(manager.discoveryGenerator, 'rediscoverAll')
			.mockImplementation(() => {})
		const status = makeStatusSource()

		manager.start(status, true)
		manager.stop()
		expect(status.exactCount()).toBe(0)

		status.deliver(HASS_STATUS_TOPIC, 'online')
		expect(rediscoverAll).not.toHaveBeenCalled()
	})
})

describe('MqttDiscoveryManager multi-instance isolation', () => {
	let sharedSource: CustomDeviceRegistry

	beforeEach(() => {
		sharedSource = new CustomDeviceRegistry({
			storeDir: '/tmp/mqtt-discovery-manager-shared',
			logger: makeHassLogger(),
		})
	})

	it('keeps generators and custom-device catalogs isolated across managers', () => {
		const first = makeManager({ registrySource: sharedSource }).manager
		const second = makeManager({ registrySource: sharedSource }).manager

		first.customDeviceRegistry.set('custom-device', [device()])

		expect(first.discoveryGenerator).not.toBe(second.discoveryGenerator)
		expect(first.customDeviceRegistry.get('custom-device')).toHaveLength(1)
		expect(second.customDeviceRegistry.get('custom-device')).toEqual([])
	})
})
