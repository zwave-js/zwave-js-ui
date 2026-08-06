/**
 * Focused characterization tests for `MqttClient`'s scoped exact-topic
 * subscription API (`subscribeExact`), the seam the Home Assistant discovery
 * subsystem uses to own the `homeassistant/status` subscription.
 *
 * Everything runs against the real `api/lib/MqttClient.ts`; only the upstream
 * `mqtt` package is mocked (see `mqttMock.ts`), so the genuine connect,
 * message, subscribe and unsubscribe handling runs end to end, driven by real
 * emitted `connect`/`message` events.
 *
 * Proven here: an exact topic is resubscribed on every connect and never
 * prefixed; inbound messages reach the registered listener with the raw
 * payload; disposing unsubscribes the exact topic and stops delivery; multiple
 * listeners share a single broker subscription; a reconnect resubscribes once
 * with no duplicate delivery; and after `close()` no subscription survives.
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
import { defaultMqttConfig, tick } from './fixtures.ts'
import { ensureTestEnv, cleanupTestEnv } from './env.ts'
import MqttClient from '#api/lib/MqttClient.ts'
import { module } from '#api/lib/logger.ts'

vi.mock('mqtt', () => mqttMockFactory())

const STATUS_TOPIC = 'homeassistant/status'

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
		// After dispose the broker drops the subscription and stops routing
		broker.deliver(STATUS_TOPIC, 'online')
		await tick()
		expect(received).toEqual([])

		// a second dispose is a harmless no-op
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
		// client's closed-state guard drops it) and nothing is re-armed.
		broker.deliver(STATUS_TOPIC, 'online')
		await tick()
		expect(received).toEqual([])
	})

	it('unsubscribes the desired exact topic from the broker before ending (clean:false session)', async () => {
		const client = makeClient()
		client.subscribeExact(STATUS_TOPIC, () => {})

		const broker = latestBroker()
		broker.triggerConnect()
		await tick()
		expect(statusSubscribes()).toBe(1)

		await client.close()

		// close() unsubscribes while the link is still up, before it ends the
		// connection, so a recorded unsubscribe of the exact topic proves the
		// clean:false server-side subscription was cleared before disconnect
		expect(broker.unsubscribed).toContain(STATUS_TOPIC)
		expect(broker.ended).toBe(true)
	})

	it('a delayed subscribe SUCCESS landing after dispose neither delivers nor re-arms the topic', async () => {
		const client = makeClient()
		const received: string[] = []

		const broker = latestBroker()
		broker.triggerConnect()
		await tick()

		// From here the broker withholds subscribe callbacks so we can land one
		// late
		broker.deferSubscribe = true
		broker.subscribed.length = 0

		const sub = client.subscribeExact(STATUS_TOPIC, (p) =>
			received.push(p ?? ''),
		)
		expect(broker.pendingSubscribes).toHaveLength(1)

		// Owner disposes while the subscribe callback is still in flight, then
		// the late grant lands and must not re-arm delivery
		sub.dispose()
		broker.flushSubscribes()

		broker.deferSubscribe = false
		broker.subscribed.length = 0
		broker.triggerOffline()
		broker.triggerReconnect()
		broker.triggerConnect()
		await tick()

		// The disposed topic is not re-subscribed on the fresh connect...
		expect(statusSubscribes()).toBe(0)
		broker.deliver(STATUS_TOPIC, 'online')
		await tick()
		expect(received).toEqual([])

		await client.close()
	})

	it('a delayed subscribe FAILURE landing after dispose does not requeue the topic for reconnect', async () => {
		const client = makeClient()
		const received: string[] = []

		const broker = latestBroker()
		broker.triggerConnect()
		await tick()

		broker.deferSubscribe = true
		broker.subscribed.length = 0

		const sub = client.subscribeExact(STATUS_TOPIC, (p) =>
			received.push(p ?? ''),
		)
		sub.dispose()
		// A broker subscribe error lands after dispose. The desired-state-aware
		// path must not requeue the disposed topic, so it can never be
		// re-subscribed on a later connect
		broker.flushSubscribes(new Error('not authorized'))

		broker.deferSubscribe = false
		broker.subscribed.length = 0
		broker.triggerOffline()
		broker.triggerReconnect()
		broker.triggerConnect()
		await tick()

		expect(statusSubscribes()).toBe(0)
		broker.deliver(STATUS_TOPIC, 'online')
		await tick()
		expect(received).toEqual([])

		await client.close()
	})

	it('a subscribe FAILURE while still desired is retried on the next connect', async () => {
		const client = makeClient()
		const received: string[] = []

		const broker = latestBroker()
		broker.triggerConnect()
		await tick()

		broker.deferSubscribe = true
		broker.subscribed.length = 0

		client.subscribeExact(STATUS_TOPIC, (p) => received.push(p ?? ''))
		// The subscribe fails but the owner never disposed: the topic stays
		// desired and is retried by the next connect.
		broker.flushSubscribes(new Error('transient'))

		broker.deferSubscribe = false
		broker.subscribed.length = 0
		broker.triggerOffline()
		broker.triggerReconnect()
		broker.triggerConnect()
		await tick()

		expect(statusSubscribes()).toBe(1)
		broker.deliver(STATUS_TOPIC, 'online')
		await tick()
		expect(received).toEqual(['online'])

		await client.close()
	})

	it('a close concurrent with an in-flight subscribe neither delivers nor re-subscribes', async () => {
		const client = makeClient()
		const received: string[] = []

		const broker = latestBroker()
		broker.triggerConnect()
		await tick()

		broker.deferSubscribe = true
		broker.subscribed.length = 0

		client.subscribeExact(STATUS_TOPIC, (p) => received.push(p ?? ''))
		expect(broker.pendingSubscribes).toHaveLength(1)

		// Close races the in-flight subscribe.
		await client.close()
		// The grant lands after close: the closed guard makes it a no-op.
		broker.flushSubscribes()

		broker.deliver(STATUS_TOPIC, 'online')
		await tick()
		expect(received).toEqual([])
		// The desired topic was unsubscribed as part of the close.
		expect(broker.unsubscribed).toContain(STATUS_TOPIC)
	})

	it('re-subscribes on a connected client when the refcount drops to 0 and rises again', async () => {
		const client = makeClient()
		const first: string[] = []
		const second: string[] = []

		const broker = latestBroker()
		broker.triggerConnect()
		await tick()

		// First owner subscribes, then disposes: the last listener leaving
		// unsubscribes the exact topic from the broker while still connected
		const subA = client.subscribeExact(STATUS_TOPIC, (p) =>
			first.push(p ?? ''),
		)
		expect(statusSubscribes()).toBe(1)
		subA.dispose()
		expect(broker.subscribed.some((s) => s.topic === STATUS_TOPIC)).toBe(
			false,
		)
		broker.subscribed.length = 0

		// A new owner subscribes on the still-connected client: the topic is
		// re-subscribed immediately (not left waiting for a reconnect)
		const subB = client.subscribeExact(STATUS_TOPIC, (p) =>
			second.push(p ?? ''),
		)
		expect(statusSubscribes()).toBe(1)

		broker.deliver(STATUS_TOPIC, 'online')
		await tick()
		expect(first).toEqual([])
		expect(second).toEqual(['online'])

		subB.dispose()
		await client.close()
	})

	it('a dispose before any connect never subscribes the topic on the eventual connect', async () => {
		const client = makeClient()
		const received: string[] = []

		// Subscribe and dispose while still offline: nothing was sent to the
		// broker yet, and the disposed topic must not be armed for the connect
		const sub = client.subscribeExact(STATUS_TOPIC, (p) =>
			received.push(p ?? ''),
		)
		sub.dispose()

		const broker = latestBroker()
		broker.triggerConnect()
		await tick()

		expect(statusSubscribes()).toBe(0)
		broker.deliver(STATUS_TOPIC, 'online')
		await tick()
		expect(received).toEqual([])

		await client.close()
	})

	it('does not deliver a near-miss topic to the exact listener', async () => {
		const client = makeClient()
		const received: Array<string | undefined> = []
		client.subscribeExact(STATUS_TOPIC, (payload) => received.push(payload))

		const broker = latestBroker()
		broker.triggerConnect()
		await tick()

		// A sibling topic under the same prefix must not reach the exact
		// listener: dispatch is an exact-key `Map.get(topic)`, so only the
		// registered topic matches
		broker.deliver(`${STATUS_TOPIC}/foo`, 'online')
		await tick()
		expect(received).toEqual([])

		broker.deliver(STATUS_TOPIC, 'online')
		await tick()
		expect(received).toEqual(['online'])

		await client.close()
	})

	it('rejects a wildcard topic and rejects subscribing after close', async () => {
		const client = makeClient()

		// `+`/`#` would widen the broker subscription past the named exact topic
		// and can never match the exact-key dispatch, so both are rejected
		expect(() =>
			client.subscribeExact('homeassistant/+', () => {}),
		).toThrow(/wildcard/)
		expect(() =>
			client.subscribeExact('homeassistant/#', () => {}),
		).toThrow(/wildcard/)

		const broker = latestBroker()
		broker.triggerConnect()
		await tick()
		await client.close()

		// A closed client can never (re)subscribe, so a scoped subscribe must
		// fail loudly rather than hand back a silently-dead handle
		expect(() => client.subscribeExact(STATUS_TOPIC, () => {})).toThrow(
			/closed/,
		)
	})

	it('retries a transient scoped subscribe failure on the 5s timer while still connected', async () => {
		const client = makeClient()
		const received: string[] = []

		const broker = latestBroker()
		broker.triggerConnect()
		await tick()

		vi.useFakeTimers()
		try {
			broker.deferSubscribe = true
			broker.subscribed.length = 0

			client.subscribeExact(STATUS_TOPIC, (p) => received.push(p ?? ''))
			// The first attempt fails transiently while still connected and
			// desired, so it schedules a retry rather than waiting for a reconnect
			broker.flushSubscribes(new Error('transient'))
			await vi.advanceTimersByTimeAsync(0)

			// No reconnect happened: the link stayed up, one attempt was made
			expect(broker.connected).toBe(true)
			expect(statusSubscribes()).toBe(1)

			// The shared 5s timer fires a second attempt that succeeds
			broker.deferSubscribe = false
			await vi.advanceTimersByTimeAsync(5000)
			expect(statusSubscribes()).toBe(2)

			broker.deliver(STATUS_TOPIC, 'online')
			expect(received).toEqual(['online'])
		} finally {
			vi.useRealTimers()
		}

		await client.close()
	})

	it('logs a qos-128 denial on the scoped path and never retries it', async () => {
		const client = makeClient()
		const errorSpy = vi.spyOn(module('Mqtt'), 'error')

		try {
			const broker = latestBroker()
			// The broker denies the topic: the grant comes back qos 128, exactly
			// how mqtt.js surfaces a permission denial
			broker.denySubscribe.add(STATUS_TOPIC)
			broker.triggerConnect()
			await tick()

			vi.useFakeTimers()
			try {
				broker.subscribed.length = 0
				client.subscribeExact(STATUS_TOPIC, () => {})
				await vi.advanceTimersByTimeAsync(0)

				// Attempted once and denied, logged as a permission error
				expect(statusSubscribes()).toBe(1)
				expect(errorSpy).toHaveBeenCalledWith(
					expect.stringContaining("doesn't have permission"),
				)

				// A denial is final: the 5s retry timer never re-attempts it
				await vi.advanceTimersByTimeAsync(5000)
				expect(statusSubscribes()).toBe(1)
			} finally {
				vi.useRealTimers()
			}
		} finally {
			errorSpy.mockRestore()
		}

		await client.close()
	})

	it('logs a qos-128 denial on the ordinary subscribe path and never requeues it', async () => {
		const client = makeClient()
		const errorSpy = vi.spyOn(module('Mqtt'), 'error')
		const DENIED = 'zwave/denied/topic'

		try {
			const broker = latestBroker()
			broker.denySubscribe.add(DENIED)
			broker.triggerConnect()
			await tick()
			broker.subscribed.length = 0

			// A denial resolves the subscribe (a retry cannot fix a permission
			// error), it does not reject
			await expect(
				client.subscribe(DENIED, { addPrefix: false, qos: 1 }),
			).resolves.toBeUndefined()
			expect(
				broker.subscribed.filter((s) => s.topic === DENIED),
			).toHaveLength(1)
			expect(errorSpy).toHaveBeenCalledWith(
				expect.stringContaining("doesn't have permission"),
			)

			// Not requeued: a reconnect does not re-attempt the denied topic
			broker.triggerOffline()
			broker.triggerReconnect()
			broker.triggerConnect()
			await tick()
			expect(
				broker.subscribed.filter((s) => s.topic === DENIED),
			).toHaveLength(1)
		} finally {
			errorSpy.mockRestore()
		}

		await client.close()
	})
})
