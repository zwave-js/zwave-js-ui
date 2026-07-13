/**
 * Production-faithful stand-in for the `mqtt` npm package's network client,
 * plus the `vi.mock('mqtt', ...)` factory that installs it.
 *
 * Fakes only the single network boundary (`connect` from `mqtt`, the one place
 * `MqttClient.ts` reaches the network), so the real `MqttClient`/`Gateway`
 * publish/subscribe/parse paths run against real emitted events instead of a
 * hand-rolled `MqttClient` fake. `MqttClient`'s constructor assigns
 * `this.client = connect(...)` synchronously, so `new MqttClient(cfg)` is
 * usable without awaiting a tick.
 *
 * ```ts
 * vi.mock('mqtt', () => mqttMockFactory())
 * ```
 */
import { EventEmitter } from 'node:events'
import { vi } from 'vitest'

export interface RecordedPublish {
	topic: string
	payload: string
	options: Record<string, any> | undefined
}

export interface RecordedSubscribe {
	topic: string
	options: Record<string, any> | undefined
}

/**
 * Shape-compatible fake of the `mqtt` package's client (not our `MqttClient`
 * wrapper): only the members `MqttClient.ts` touches are implemented, each
 * recording its calls for assertions.
 */
export interface FakeBroker extends EventEmitter {
	connected: boolean
	published: RecordedPublish[]
	subscribed: RecordedSubscribe[]
	ended: boolean
	publish(
		topic: string,
		payload: string,
		options?: Record<string, any> | ((err?: Error) => void),
		cb?: (err?: Error) => void,
	): FakeBroker
	subscribe(
		topic: string,
		options?: Record<string, any>,
		cb?: (
			err: Error | null,
			granted: { topic: string; qos: number }[],
		) => void,
	): FakeBroker
	end(
		force?: boolean,
		opts?: Record<string, any>,
		cb?: () => void,
	): FakeBroker
	/**
	 * Deliver an inbound message through the real `'message'`/`Buffer`
	 * contract so `_onMessageReceived` runs — but only when connected and the
	 * topic matches a subscription, like a real broker. Others are dropped.
	 */
	deliver(topic: string, payload: string | Buffer): void
	/**
	 * Deliver straight to the `'message'` handler, bypassing the
	 * connected/subscription gate, so a test can prove `MqttClient`'s own
	 * defensive guards drop the packet rather than the broker never sending it.
	 */
	deliverRaw(topic: string, payload: string | Buffer): void
	/**
	 * Go connected and fire `'connect'`; `connected` is set before the event so
	 * the real `_onConnect` -> `subscribe()` path (which checks
	 * `client.connected`) succeeds.
	 */
	triggerConnect(): void
	/** Transition offline and fire `'offline'` (real client on link loss). */
	triggerOffline(): void
	/** Fire `'reconnect'` (real client between an offline and a re-connect). */
	triggerReconnect(): void
	/**
	 * Reset to not-connected without emitting an event: the shared broker is
	 * constructed once per file, so a test characterizing the pre-`'connect'`
	 * state must re-establish that precondition regardless of run order. Leaves
	 * `subscribed` intact so it can't disturb another suite's routing.
	 */
	forceDisconnected(): void
}

/**
 * Every `FakeBroker` a `connect()` produced, in creation order; shared with
 * the importing test file. `resetMqttBrokers()` clears it between tests.
 */
export const mqttBrokers: FakeBroker[] = []

/** The most recently created broker (the one the live `MqttClient` uses). */
export function latestBroker(): FakeBroker {
	const broker = mqttBrokers[mqttBrokers.length - 1]
	if (!broker) {
		throw new Error(
			'No FakeBroker created yet - construct MqttClient first',
		)
	}
	return broker
}

export function resetMqttBrokers(): void {
	mqttBrokers.length = 0
}

/**
 * Match `topic` against an MQTT subscription `filter`, honoring `+`
 * (single-level) and `#` (multi-level) wildcards like a real broker.
 * `MqttClient` uses both kinds, so the fake must too.
 */
export function topicMatchesFilter(topic: string, filter: string): boolean {
	const t = topic.split('/')
	const f = filter.split('/')
	for (let i = 0; i < f.length; i++) {
		if (f[i] === '#') return true
		if (i >= t.length) return false
		if (f[i] === '+') continue
		if (f[i] !== t[i]) return false
	}
	return t.length === f.length
}

/**
 * Build a fresh `FakeBroker` (the `vi.mock('mqtt')` factory calls this once
 * per real `connect()`). Starts disconnected, like a real `mqtt` client, so
 * inbound traffic only flows after `triggerConnect()`.
 */
export function createFakeBroker(): FakeBroker {
	const broker = new EventEmitter() as FakeBroker
	broker.connected = false
	broker.published = []
	broker.subscribed = []
	broker.ended = false

	broker.publish = (topic, payload, options, cb) => {
		// Mirror `mqtt`'s `publish(topic, payload, cb)` overload where the 3rd
		// arg is the callback. Like the real client, publishing isn't gated on
		// `connected` (only `this.client`), so publishes record before
		// `'connect'`; only inbound `deliver()` is connection/subscription gated.
		let opts: Record<string, any> | undefined
		let callback: ((err?: Error) => void) | undefined
		if (typeof options === 'function') {
			callback = options
		} else {
			opts = options
			callback = cb
		}
		broker.published.push({
			topic,
			payload: payload,
			options: opts,
		})
		callback?.()
		return broker
	}

	broker.subscribe = (topic, options, cb) => {
		broker.subscribed.push({ topic, options })
		// Real `mqtt` grants `{ topic, qos }[]`; the wrapper treats qos 128 as
		// a permission error, so return the requested qos to model a grant.
		cb?.(null, [{ topic, qos: (options?.qos as number) ?? 0 }])
		return broker
	}

	broker.end = (_force, _opts, cb) => {
		broker.ended = true
		broker.connected = false
		cb?.()
		return broker
	}

	const toBuffer = (payload: string | Buffer) =>
		Buffer.isBuffer(payload) ? payload : Buffer.from(payload)

	broker.deliver = (topic, payload) => {
		// A real broker delivers nothing to an offline client or an
		// unsubscribed topic
		if (!broker.connected) return
		const matches = broker.subscribed.some((s) =>
			topicMatchesFilter(topic, s.topic),
		)
		if (!matches) return
		broker.emit('message', topic, toBuffer(payload))
	}

	broker.deliverRaw = (topic, payload) => {
		broker.emit('message', topic, toBuffer(payload))
	}

	broker.triggerConnect = () => {
		broker.connected = true
		broker.emit('connect')
	}

	broker.triggerOffline = () => {
		broker.connected = false
		broker.emit('offline')
	}

	broker.triggerReconnect = () => {
		broker.emit('reconnect')
	}

	broker.forceDisconnected = () => {
		// No event: only re-establishes the pre-`'connect'` precondition on the
		// shared broker
		broker.connected = false
	}

	mqttBrokers.push(broker)
	return broker
}

/**
 * The object a test passes to `vi.mock('mqtt', () => mqttMockFactory())`.
 * `connect` is a `vi.fn()` returning a new `FakeBroker` per call, matching
 * `mqtt.connect()`'s one-client-per-call contract.
 */
export function mqttMockFactory() {
	return {
		connect: vi.fn((_url?: string, _options?: Record<string, any>) =>
			createFakeBroker(),
		),
	}
}
