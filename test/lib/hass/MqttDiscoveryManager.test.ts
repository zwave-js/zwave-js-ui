/**
 * Direct unit/characterization tests for {@link MqttDiscoveryManager}, the owner
 * of the Home Assistant MQTT discovery subsystem: the mutable `discovered`
 * device index, the per-instance custom-device catalog fork, the
 * {@link DiscoveryGenerator} instance, and the scoped
 * `homeassistant/status`/broker-reconnect subscription that drives a full
 * rediscovery.
 *
 * These exercise the manager in isolation (fake ports, a real but unstarted
 * `CustomDeviceRegistry` source so no `fs.watch` handles are created, and a
 * hand-rolled status source) so every lifecycle transition, idempotency guard,
 * scoped-subscription disposer, two-manager isolation path and the
 * generator<->manager `discovered` wiring is proven against the manager itself.
 * The end-to-end delivery of a real `homeassistant/status` retained message is
 * covered by `mqttLifecycle.test.ts` through the Gateway harness.
 */
import {
	describe,
	it,
	expect,
	beforeAll,
	beforeEach,
	afterAll,
	vi,
} from 'vitest'
import type { Mock } from 'vitest'
import type MqttDiscoveryManagerClass from '#api/hass/MqttDiscoveryManager'
import type {
	HASS_STATUS_TOPIC as HassStatusTopic,
	HassStatusSource,
	MqttDiscoveryManagerOptions,
} from '#api/hass/MqttDiscoveryManager'
import { CustomDeviceRegistry } from '#api/hass/CustomDeviceRegistry'
import type {
	HassMqttPort,
	HassTopicPort,
	HassZwavePort,
} from '#api/hass/ports'
import type { HassDevice } from '#api/hass/types'
import { cleanupTestEnv, ensureTestEnv } from '../shared/env.ts'

let MqttDiscoveryManager: typeof MqttDiscoveryManagerClass
let HASS_STATUS_TOPIC: typeof HassStatusTopic

beforeAll(async () => {
	ensureTestEnv()
	const managerModule = await import('#api/hass/MqttDiscoveryManager')
	MqttDiscoveryManager = managerModule.default
	HASS_STATUS_TOPIC = managerModule.HASS_STATUS_TOPIC
})

afterAll(cleanupTestEnv)

// Methods declared as function-valued properties let tests reference
// `logger.info` for assertions without the unbound-method rule firing
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
		emitHassStatus(online) {
			source.hassStatusEmits.push(online)
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
	manager: MqttDiscoveryManagerClass
	source: CustomDeviceRegistry
	logger: MockLogger
	options: MqttDiscoveryManagerOptions
}

function makeManager(
	overrides: Partial<MqttDiscoveryManagerOptions> = {},
): Harness {
	const logger = makeLogger()
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
		manager.discovered = { seeded: device() }

		manager.start()

		expect(manager.discovered).toEqual({})
	})

	it('stop() is idempotent and reentrant', () => {
		const { manager } = makeManager()
		manager.start()

		manager.stop()
		expect(() => manager.stop()).not.toThrow()
	})

	it('stop() fences discovery publication synchronously; start() re-arms it', () => {
		const { manager } = makeManager()
		const generator = manager.discoveryGenerator

		manager.start()
		expect(generator.active).toBe(true)

		// stop() must drop the fence synchronously (before any await a
		// coordinator performs on the server destroy), so no producer can
		// publish retained discovery once the teardown has begun.
		manager.stop()
		expect(generator.active).toBe(false)

		const rediscoverAll = vi.spyOn(generator, 'rediscoverAll')
		manager.rediscoverAll()
		// The manager facade still forwards, but the fenced generator no-ops
		// its retained publication (proven in DiscoveryGenerator.test.ts).
		expect(rediscoverAll).toHaveBeenCalledTimes(1)
		expect(generator.active).toBe(false)

		// A restart reusing this same generator instance re-arms the fence.
		manager.start()
		expect(generator.active).toBe(true)
	})
})

describe('MqttDiscoveryManager scoped status subscription', () => {
	it('subscribes to the fixed homeassistant/status topic (never prefixed)', () => {
		const { manager } = makeManager()
		const status = makeStatusSource()

		manager.subscribeStatus(status)

		expect(status.exactCount('homeassistant/status')).toBe(1)
	})

	it('an online HA status triggers a full rediscovery and logs ONLINE', () => {
		const { manager, logger } = makeManager()
		const rediscoverAll = vi
			.spyOn(manager.discoveryGenerator, 'rediscoverAll')
			.mockImplementation(() => {})
		const status = makeStatusSource()

		manager.subscribeStatus(status)
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

		manager.subscribeStatus(status)
		status.deliver(HASS_STATUS_TOPIC, 'OnLiNe')

		expect(rediscoverAll).toHaveBeenCalledTimes(1)
	})

	it('an offline HA status logs OFFLINE and does not rediscover', () => {
		const { manager, logger } = makeManager()
		const rediscoverAll = vi
			.spyOn(manager.discoveryGenerator, 'rediscoverAll')
			.mockImplementation(() => {})
		const status = makeStatusSource()

		manager.subscribeStatus(status)
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

		manager.subscribeStatus(status)
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

		manager.subscribeStatus(status)
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

		manager.subscribeStatus(status)
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

		manager.subscribeStatus(status)
		status.emitBroker(false)
		expect(rediscoverAll).not.toHaveBeenCalled()

		status.emitBroker(true)
		expect(rediscoverAll).toHaveBeenCalledTimes(1)
	})

	it('subscribeStatus is idempotent: a second call returns the same disposer and does not double-subscribe', () => {
		const { manager } = makeManager()
		const status = makeStatusSource()

		const first = manager.subscribeStatus(status)
		const second = manager.subscribeStatus(status)

		expect(second).toBe(first)
		expect(status.exactCount()).toBe(1)
		expect(status.brokerCount()).toBe(1)
	})

	it('the returned disposer removes exactly its listeners and is idempotent', () => {
		const { manager } = makeManager()
		const status = makeStatusSource()

		const dispose = manager.subscribeStatus(status)
		expect(status.exactCount()).toBe(1)
		expect(status.brokerCount()).toBe(1)

		dispose()
		expect(status.exactCount()).toBe(0)
		expect(status.brokerCount()).toBe(0)

		expect(() => dispose()).not.toThrow()
		expect(status.exactCount()).toBe(0)
	})

	it('after disposing, a fresh subscribeStatus re-subscribes with a new disposer', () => {
		const { manager } = makeManager()
		const status = makeStatusSource()

		const first = manager.subscribeStatus(status)
		first()
		const second = manager.subscribeStatus(status)

		expect(second).not.toBe(first)
		expect(status.exactCount()).toBe(1)
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
		status.deliver(HASS_STATUS_TOPIC, 'online')
		status.emitBroker(true)

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
		expect(status.exactCount()).toBe(1)

		status.deliver(HASS_STATUS_TOPIC, 'online')
		expect(rediscoverAll).toHaveBeenCalledTimes(1)
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
})
