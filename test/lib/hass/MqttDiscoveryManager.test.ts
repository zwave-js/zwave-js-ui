/**
 * Direct unit/characterization tests for {@link MqttDiscoveryManager}, the
 * extracted owner of the legacy Home Assistant MQTT discovery subsystem that
 * used to live inline in `Gateway`: the mutable `discovered` device index, the
 * per-instance custom-device catalog fork, the {@link DiscoveryGenerator}
 * instance, and the scoped `homeassistant/status`/broker-reconnect
 * subscription that drives a full rediscovery.
 *
 * These exercise the manager in isolation (fake ports, a real but unstarted
 * `CustomDeviceRegistry` source so no `fs.watch` handles are created, and a
 * hand-rolled status source) so every lifecycle transition, idempotency guard,
 * scoped-subscription disposer, two-manager isolation path and the
 * generator<->manager `discovered` wiring is proven against the manager itself.
 * The end-to-end delivery of a real `homeassistant/status` retained message is
 * still covered by `mqttLifecycle.test.ts` through the Gateway harness.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import MqttDiscoveryManager, {
	type HassStatusSource,
	type MqttDiscoveryManagerOptions,
} from '../../../api/hass/MqttDiscoveryManager.ts'
import { CustomDeviceRegistry } from '../../../api/hass/CustomDeviceRegistry.ts'
import type {
	HassMqttPort,
	HassTopicPort,
	HassZwavePort,
} from '../../../api/hass/ports.ts'
import type { HassDevice } from '../../../api/hass/types.ts'

// A logger whose methods are function-valued PROPERTIES (not method
// signatures) so tests can reference `logger.info` for assertions without the
// unbound-method rule firing; structurally satisfies `HassLogger`.
interface MockLogger {
	debug: Mock
	info: Mock
	warn: Mock
	error: Mock
	log: Mock
}

function makeLogger(): MockLogger {
	return {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		log: vi.fn(),
	}
}

function makeMqttPort(): HassMqttPort {
	return {
		disabled: false,
		getTopic: (topic: string) => topic,
		getStatusTopic: () => 'status',
		publish: vi.fn(),
	}
}

function makeZwavePort(): HassZwavePort {
	return {
		homeHex: '0xdeadbeef',
		getNode: () => undefined,
		getNodes: () => new Map(),
		updateDevice: vi.fn(),
		emitNodeUpdate: vi.fn(),
		writeCoverStop: vi.fn(() => Promise.resolve(undefined)),
	}
}

function makeTopicPort(): HassTopicPort {
	return {
		nodeTopic: () => 'node',
		valueTopic: () => 'value',
	}
}

/**
 * A minimal `HassStatusSource` that records per-event listeners so tests can
 * assert exact subscription counts, drive `online`/`offline` transitions, and
 * prove the disposer removed exactly what it added.
 */
function makeStatusSource() {
	const listeners: Record<string, Array<(online: boolean) => void>> = {
		hassStatus: [],
		brokerStatus: [],
	}
	const source: HassStatusSource & {
		emit(event: 'hassStatus' | 'brokerStatus', online: boolean): void
		count(event: 'hassStatus' | 'brokerStatus'): number
	} = {
		on(event, handler) {
			listeners[event].push(handler)
			return source
		},
		off(event, handler) {
			listeners[event] = listeners[event].filter((h) => h !== handler)
			return source
		},
		emit(event, online) {
			for (const handler of [...listeners[event]]) handler(online)
		},
		count(event) {
			return listeners[event].length
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
	logger: MockLogger
	options: MqttDiscoveryManagerOptions
}

function makeManager(
	overrides: Partial<MqttDiscoveryManagerOptions> = {},
): Harness {
	const logger = makeLogger()
	// A real registry source, deliberately NOT started: the manager forks a
	// child in its constructor and the fork subscribes to this source on
	// start()/unsubscribes on stop(), so no file watchers are ever installed.
	const source = new CustomDeviceRegistry({
		storeDir: '/tmp/mqtt-discovery-manager-test',
		logger,
	})
	const options: MqttDiscoveryManagerOptions = {
		config: { hassDiscovery: true },
		mqtt: makeMqttPort(),
		zwave: makeZwavePort(),
		topics: makeTopicPort(),
		registrySource: source,
		logger,
		...overrides,
	}
	const manager = new MqttDiscoveryManager(options)
	return { manager, source, logger, options }
}

describe('MqttDiscoveryManager construction', () => {
	it('forks an isolated, initially-unsubscribed catalog view and owns a generator', () => {
		const { manager, source } = makeManager()

		expect(source.subscriberCount).toBe(0)
		expect(manager.customDeviceRegistry).toBeInstanceOf(
			CustomDeviceRegistry,
		)
		expect(manager.customDeviceRegistry).not.toBe(source)
		expect(manager.discoveryGenerator).toBeDefined()
		expect(manager.discovered).toEqual({})
	})
})

describe('MqttDiscoveryManager start/stop lifecycle', () => {
	it('start() subscribes the catalog view and resets the discovered index', () => {
		const { manager, source } = makeManager()
		manager.discovered = { seeded: device() }

		manager.start()

		expect(source.subscriberCount).toBe(1)
		expect(manager.discovered).toEqual({})
	})

	it('stop() unsubscribes the catalog view', () => {
		const { manager, source } = makeManager()
		manager.start()
		expect(source.subscriberCount).toBe(1)

		manager.stop()

		expect(source.subscriberCount).toBe(0)
	})

	it('supports restart: subscriber count tracks 0 -> 1 -> 0 -> 1 -> 0', () => {
		const { manager, source } = makeManager()

		expect(source.subscriberCount).toBe(0)
		manager.start()
		expect(source.subscriberCount).toBe(1)
		manager.stop()
		expect(source.subscriberCount).toBe(0)
		manager.start()
		expect(source.subscriberCount).toBe(1)
		manager.stop()
		expect(source.subscriberCount).toBe(0)
	})

	it('start() is idempotent (no double subscription)', () => {
		const { manager, source } = makeManager()

		manager.start()
		manager.start()

		expect(source.subscriberCount).toBe(1)
	})

	it('stop() is idempotent and reentrant', () => {
		const { manager, source } = makeManager()
		manager.start()

		manager.stop()
		expect(() => manager.stop()).not.toThrow()
		expect(source.subscriberCount).toBe(0)
	})
})

describe('MqttDiscoveryManager scoped status subscription', () => {
	it('an online HA status triggers a full rediscovery and logs ONLINE', () => {
		const { manager, logger } = makeManager()
		const rediscoverAll = vi
			.spyOn(manager.discoveryGenerator, 'rediscoverAll')
			.mockImplementation(() => {})
		const status = makeStatusSource()

		manager.subscribeStatus(status)
		status.emit('hassStatus', true)

		expect(rediscoverAll).toHaveBeenCalledTimes(1)
		expect(logger.info).toHaveBeenCalledWith('Home Assistant is ONLINE')
	})

	it('an offline HA status logs OFFLINE and does not rediscover', () => {
		const { manager, logger } = makeManager()
		const rediscoverAll = vi
			.spyOn(manager.discoveryGenerator, 'rediscoverAll')
			.mockImplementation(() => {})
		const status = makeStatusSource()

		manager.subscribeStatus(status)
		status.emit('hassStatus', false)

		expect(logger.info).toHaveBeenCalledWith('Home Assistant is OFFLINE')
		expect(rediscoverAll).not.toHaveBeenCalled()
	})

	it('an online broker reconnect triggers a full rediscovery; offline does not', () => {
		const { manager } = makeManager()
		const rediscoverAll = vi
			.spyOn(manager.discoveryGenerator, 'rediscoverAll')
			.mockImplementation(() => {})
		const status = makeStatusSource()

		manager.subscribeStatus(status)
		status.emit('brokerStatus', false)
		expect(rediscoverAll).not.toHaveBeenCalled()

		status.emit('brokerStatus', true)
		expect(rediscoverAll).toHaveBeenCalledTimes(1)
	})

	it('subscribeStatus is idempotent: a second call returns the same disposer and does not double-subscribe', () => {
		const { manager } = makeManager()
		const status = makeStatusSource()

		const first = manager.subscribeStatus(status)
		const second = manager.subscribeStatus(status)

		expect(second).toBe(first)
		expect(status.count('hassStatus')).toBe(1)
		expect(status.count('brokerStatus')).toBe(1)
	})

	it('the returned disposer removes exactly its listeners and is idempotent', () => {
		const { manager } = makeManager()
		const status = makeStatusSource()

		const dispose = manager.subscribeStatus(status)
		expect(status.count('hassStatus')).toBe(1)
		expect(status.count('brokerStatus')).toBe(1)

		dispose()
		expect(status.count('hassStatus')).toBe(0)
		expect(status.count('brokerStatus')).toBe(0)

		expect(() => dispose()).not.toThrow()
		expect(status.count('hassStatus')).toBe(0)
	})

	it('after disposing, a fresh subscribeStatus re-subscribes with a new disposer', () => {
		const { manager } = makeManager()
		const status = makeStatusSource()

		const first = manager.subscribeStatus(status)
		first()
		const second = manager.subscribeStatus(status)

		expect(second).not.toBe(first)
		expect(status.count('hassStatus')).toBe(1)
	})

	it('disposeStatus() is a no-op when nothing is subscribed', () => {
		const { manager } = makeManager()
		expect(() => manager.disposeStatus()).not.toThrow()
	})

	it('a disposed subscription no longer reacts to status transitions', () => {
		const { manager } = makeManager()
		const rediscoverAll = vi
			.spyOn(manager.discoveryGenerator, 'rediscoverAll')
			.mockImplementation(() => {})
		const status = makeStatusSource()

		manager.subscribeStatus(status)
		manager.disposeStatus()
		status.emit('hassStatus', true)
		status.emit('brokerStatus', true)

		expect(rediscoverAll).not.toHaveBeenCalled()
	})
})

describe('MqttDiscoveryManager start() status wiring', () => {
	it('start(source, true) wires the status subscription', () => {
		const { manager } = makeManager()
		const rediscoverAll = vi
			.spyOn(manager.discoveryGenerator, 'rediscoverAll')
			.mockImplementation(() => {})
		const status = makeStatusSource()

		manager.start(status, true)
		expect(status.count('hassStatus')).toBe(1)

		status.emit('hassStatus', true)
		expect(rediscoverAll).toHaveBeenCalledTimes(1)
	})

	it('start(source, false) does not subscribe to status', () => {
		const { manager } = makeManager()
		const status = makeStatusSource()

		manager.start(status, false)

		expect(status.count('hassStatus')).toBe(0)
		expect(status.count('brokerStatus')).toBe(0)
	})

	it('start() without a status source does not subscribe', () => {
		const { manager } = makeManager()
		const status = makeStatusSource()

		manager.start()

		expect(status.count('hassStatus')).toBe(0)
	})

	it('stop() disposes the status subscription wired by start()', () => {
		const { manager } = makeManager()
		const rediscoverAll = vi
			.spyOn(manager.discoveryGenerator, 'rediscoverAll')
			.mockImplementation(() => {})
		const status = makeStatusSource()

		manager.start(status, true)
		manager.stop()
		expect(status.count('hassStatus')).toBe(0)

		status.emit('hassStatus', true)
		expect(rediscoverAll).not.toHaveBeenCalled()
	})
})

describe('MqttDiscoveryManager rediscoverAll delegation', () => {
	it('delegates rediscoverAll to the owned generator', () => {
		const { manager } = makeManager()
		const rediscoverAll = vi
			.spyOn(manager.discoveryGenerator, 'rediscoverAll')
			.mockImplementation(() => {})

		manager.rediscoverAll()

		expect(rediscoverAll).toHaveBeenCalledTimes(1)
	})
})

describe('MqttDiscoveryManager discovered index wiring', () => {
	it('exposes the live discovered index the generator reads and mutates', () => {
		const { manager } = makeManager()
		manager.discovered = {
			'7-38-0-currentValue': device(),
			'8-38-0-currentValue': device(),
		}

		// removeNode() reads and mutates state.discovered through the manager's
		// live index, proving the generator<->manager wiring end to end.
		manager.discoveryGenerator.removeNode({ id: 7 })

		expect(Object.keys(manager.discovered)).toEqual(['8-38-0-currentValue'])
	})

	it('the discovered setter replaces the index and the getter returns the live reference', () => {
		const { manager } = makeManager()
		const next = { a: device() }

		manager.discovered = next

		expect(manager.discovered).toBe(next)
	})
})

describe('MqttDiscoveryManager multi-instance isolation', () => {
	let sharedSource: CustomDeviceRegistry

	beforeEach(() => {
		sharedSource = new CustomDeviceRegistry({
			storeDir: '/tmp/mqtt-discovery-manager-shared',
			logger: makeLogger(),
		})
	})

	it('keeps discovered indexes and custom-device catalogs isolated across managers', () => {
		const first = makeManager({ registrySource: sharedSource }).manager
		const second = makeManager({ registrySource: sharedSource }).manager

		first.discovered = { only: device() }
		first.customDeviceRegistry.set('custom-device', [device()])

		expect(second.discovered).toEqual({})
		expect(first.customDeviceRegistry.get('custom-device')).toHaveLength(1)
		expect(second.customDeviceRegistry.get('custom-device')).toEqual([])
	})

	it('each manager owns an independent subscription against the shared source', () => {
		const first = makeManager({ registrySource: sharedSource }).manager
		const second = makeManager({ registrySource: sharedSource }).manager

		first.start()
		second.start()
		expect(sharedSource.subscriberCount).toBe(2)

		first.stop()
		expect(sharedSource.subscriberCount).toBe(1)

		second.stop()
		expect(sharedSource.subscriberCount).toBe(0)
	})
})
