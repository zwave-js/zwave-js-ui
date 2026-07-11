/**
 * Focused characterization tests for `MqttClient`'s scoped exact-topic
 * subscription API (`subscribeExact`), the seam that moved the
 * `homeassistant/status` subscription OUT of unconditional `MqttClient`
 * ownership and into the (started) Home Assistant discovery subsystem.
 *
 * Everything runs against the REAL `api/lib/MqttClient.ts`; only the upstream
 * `mqtt` package is mocked (see `mqttMock.ts`), so the genuine
 * `_onConnect`/`_onMessageReceived`/`subscribe`/`unsubscribe` code paths are
 * exercised end to end and driven by real emitted `connect`/`message` events.
 *
 * Proven here: an exact topic is (re)subscribed on every connect
 * (reconnect-safe) and NEVER prefixed; inbound messages reach the registered
 * listener with the raw payload; disposing unsubscribes the exact topic from
 * the broker and stops delivery; multiple listeners share a single broker
 * subscription; a reconnect re-subscribes exactly once (no duplicate delivery);
 * and after `close()` no subscription survives (no status after stop).
 */
import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	afterEach,
	vi,
} from 'vitest'
import { mqttMockFactory, latestBroker, resetMqttBrokers } from './mqttMock.ts'
import { defaultMqttConfig } from './fixtures.ts'
import { ensureTestEnv, cleanupTestEnv } from './env.ts'
import MqttClient from '../../../api/lib/MqttClient.ts'

vi.mock('mqtt', () => mqttMockFactory())

const STATUS_TOPIC = 'homeassistant/status'
const tick = () => new Promise<void>((r) => setImmediate(r))

/** Every recorded `subscribe(topic)` for the exact status topic. */
function statusSubscribes(): number {
	return latestBroker().subscribed.filter((s) => s.topic === STATUS_TOPIC)
		.length
}

describe('MqttClient scoped exact-topic subscription', () => {
	beforeAll(() => {
		ensureTestEnv()
	})

	afterAll(() => {
		cleanupTestEnv()
	})

	afterEach(() => {
		resetMqttBrokers()
	})

	function makeClient(): MqttClient {
		// `store: false` keeps `_init` synchronous and off the filesystem, so
		// `this.client` (the fake broker) is available immediately.
		return new MqttClient(defaultMqttConfig())
	}

	it('subscribes the exact topic on connect (never prefixed) and delivers raw payloads', async () => {
		const client = makeClient()
		const received: Array<string | undefined> = []
		client.subscribeExact(STATUS_TOPIC, (payload) => received.push(payload))

		const broker = latestBroker()
		broker.triggerConnect()
		await tick()

		// Subscribed to exactly `homeassistant/status` - no prefix applied.
		expect(broker.subscribed.map((s) => s.topic)).toContain(STATUS_TOPIC)
		expect(statusSubscribes()).toBe(1)

		broker.deliver(STATUS_TOPIC, 'online')
		await tick()
		expect(received).toEqual(['online'])

		await client.close()
	})

	it('subscribeExact after connect subscribes immediately', async () => {
		const client = makeClient()
		const broker = latestBroker()
		broker.triggerConnect()
		await tick()
		broker.subscribed.length = 0

		const received: string[] = []
		client.subscribeExact(STATUS_TOPIC, (p) => received.push(p ?? ''))

		expect(statusSubscribes()).toBe(1)
		broker.deliver(STATUS_TOPIC, 'ONLINE')
		await tick()
		expect(received).toEqual(['ONLINE'])

		await client.close()
	})

	it('disposing unsubscribes the exact topic from the broker and stops delivery', async () => {
		const client = makeClient()
		const received: string[] = []
		const sub = client.subscribeExact(STATUS_TOPIC, (p) =>
			received.push(p ?? ''),
		)

		const broker = latestBroker()
		broker.triggerConnect()
		await tick()
		expect(statusSubscribes()).toBe(1)

		sub.dispose()
		// The broker no longer routes the topic (mock drops the subscription).
		broker.deliver(STATUS_TOPIC, 'online')
		await tick()
		expect(received).toEqual([])

		// Idempotent: a second dispose is a harmless no-op.
		expect(() => sub.dispose()).not.toThrow()

		await client.close()
	})

	it('shares one broker subscription across multiple listeners; only the last dispose unsubscribes', async () => {
		const client = makeClient()
		const a: string[] = []
		const b: string[] = []
		const subA = client.subscribeExact(STATUS_TOPIC, (p) => a.push(p ?? ''))
		const subB = client.subscribeExact(STATUS_TOPIC, (p) => b.push(p ?? ''))

		const broker = latestBroker()
		broker.triggerConnect()
		await tick()

		// One shared broker subscription despite two listeners.
		expect(statusSubscribes()).toBe(1)

		broker.deliver(STATUS_TOPIC, 'online')
		await tick()
		expect(a).toEqual(['online'])
		expect(b).toEqual(['online'])

		// Disposing one keeps the other alive (still subscribed, still delivering).
		subA.dispose()
		expect(broker.subscribed.some((s) => s.topic === STATUS_TOPIC)).toBe(
			true,
		)
		broker.deliver(STATUS_TOPIC, 'again')
		await tick()
		expect(a).toEqual(['online'])
		expect(b).toEqual(['online', 'again'])

		// Disposing the last listener unsubscribes the topic from the broker.
		subB.dispose()
		expect(broker.subscribed.some((s) => s.topic === STATUS_TOPIC)).toBe(
			false,
		)

		await client.close()
	})

	it('re-subscribes the exact topic on reconnect and delivers exactly once', async () => {
		const client = makeClient()
		const received: string[] = []
		client.subscribeExact(STATUS_TOPIC, (p) => received.push(p ?? ''))

		const broker = latestBroker()
		broker.triggerConnect()
		await tick()

		broker.triggerOffline()
		// A real broker drops the subscription on link loss; model that so the
		// re-subscribe on reconnect is what restores delivery.
		broker.subscribed.length = 0

		broker.triggerReconnect()
		broker.triggerConnect()
		await tick()

		// Re-subscribed exactly once after the reconnect.
		expect(statusSubscribes()).toBe(1)

		broker.deliver(STATUS_TOPIC, 'online')
		await tick()
		// Delivered exactly once - no duplicate listener from the reconnect.
		expect(received).toEqual(['online'])

		await client.close()
	})

	it('drops all scoped subscriptions on close (no status after stop)', async () => {
		const client = makeClient()
		const received: string[] = []
		client.subscribeExact(STATUS_TOPIC, (p) => received.push(p ?? ''))

		const broker = latestBroker()
		broker.triggerConnect()
		await tick()

		await client.close()

		// Even a delivery that slips through after close is ignored (the
		// `_onMessageReceived` closed-guard drops it) and nothing is re-armed.
		broker.deliver(STATUS_TOPIC, 'online')
		await tick()
		expect(received).toEqual([])
	})
})
