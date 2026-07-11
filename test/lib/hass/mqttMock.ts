/**
 * A production-faithful stand-in for the `mqtt` npm package's network
 * client, plus the plumbing to install it as a `vi.mock('mqtt', ...)`
 * factory.
 *
 * ## Why mock only the `mqtt` package (not `MqttClient`)
 *
 * The HASS characterization suite exercises the REAL `api/lib/MqttClient.ts`
 * and REAL `api/lib/Gateway.ts` production code. The only thing that must
 * not happen is a real TCP/TLS connection to a real broker. `MqttClient`
 * reaches the network in exactly one place: `connect(serverUrl, options)`
 * imported from `mqtt` (`MqttClient.ts:9`). Replacing that single upstream
 * boundary with a controllable fake keeps every observable behavior we care
 * about - topic prefixing (`getTopic`/`getStatusTopic`), publish
 * options/QoS/retain defaults, the `_onConnect` subscription list, the
 * `_onMessageReceived` HASS-status/write/command parsing - running through
 * the real `MqttClient` code, driven by real emitted events, instead of
 * being re-implemented in a hand-rolled `MqttClient` fake.
 *
 * ## Synchronous client availability
 *
 * `MqttClient`'s constructor calls `this._init(config)` (un-awaited). On the
 * `disabled: false` + `store: false` path `_init` has NO `await` before it
 * assigns `this.client = connect(...)`, so `new MqttClient(cfg)` sets
 * `this.client` synchronously. Tests therefore never need to await a tick
 * just to have a usable `MqttClient`. Driving the broker's `'connect'` /
 * `'message'` events later then flows through the real (async) `_onConnect`
 * / `_onMessageReceived` handlers.
 *
 * ## Usage
 *
 * A test file that needs the mock declares (the factory below is referenced
 * lazily by Vitest, only when `mqtt` is first imported, so importing it here
 * even though `vi.mock` is hoisted is safe):
 *
 * ```ts
 * import { mqttMockFactory, mqttBrokers, resetMqttBrokers } from './mqttMock.ts'
 * vi.mock('mqtt', () => mqttMockFactory())
 * ```
 *
 * and reads the shared `mqttBrokers` registry (each real `connect()` pushes
 * one `FakeBroker`) to assert/drive broker behavior.
 */
import { EventEmitter } from 'node:events'
import { vi } from 'vitest'

/** One recorded `client.publish(...)` call, in call order. */
export interface RecordedPublish {
	topic: string
	payload: string
	options: Record<string, any> | undefined
}

/** One recorded `client.subscribe(...)` call, in call order. */
export interface RecordedSubscribe {
	topic: string
	options: Record<string, any> | undefined
}

/**
 * Shape-compatible fake of the `mqtt` package's `MqttClient` (the network
 * client, NOT our wrapper). Only the members `api/lib/MqttClient.ts` ever
 * touches are implemented; each records its calls so tests can assert the
 * exact wire effects the real producer emitted.
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
	 * Convenience for tests: deliver a message through the real `mqtt`
	 * event contract (`'message'` with a `Buffer` payload), so
	 * `MqttClient._onMessageReceived` runs exactly as it would for a real
	 * inbound packet - but ONLY if the broker is connected AND the topic
	 * matches an active subscription, exactly like a real broker (which never
	 * pushes a packet to a client that is offline or has not subscribed to a
	 * matching filter). Non-matching / disconnected deliveries are silently
	 * dropped.
	 */
	deliver(topic: string, payload: string | Buffer): void
	/**
	 * Deliver a message straight to the `'message'` handler, BYPASSING the
	 * connected + subscription gate. Models a packet the transport hands the
	 * client even though the client never subscribed to it (e.g. an action
	 * addressed to a different client id shared on a wildcard), so a test can
	 * prove `MqttClient`'s OWN defensive guards drop it - not merely that the
	 * broker never delivered it.
	 */
	deliverRaw(topic: string, payload: string | Buffer): void
	/**
	 * Transition the fake to connected and fire the `'connect'` event, exactly
	 * as the real `mqtt` client does once the TCP/MQTT handshake completes.
	 * `connected` is set BEFORE the event so the real `_onConnect` ->
	 * `subscribe()` path (which checks `client.connected`) succeeds.
	 */
	triggerConnect(): void
	/** Transition offline and fire `'offline'` (real client on link loss). */
	triggerOffline(): void
	/** Fire `'reconnect'` (real client between an offline and a re-connect). */
	triggerReconnect(): void
}

/**
 * Registry of every `FakeBroker` a `connect()` call has produced, in
 * creation order. Shared (same module singleton) between this helper and the
 * importing test file. `resetMqttBrokers()` clears it between tests.
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

/** Clears the broker registry. Call in `afterEach` so tests never leak. */
export function resetMqttBrokers(): void {
	mqttBrokers.length = 0
}

/**
 * True when `topic` matches an MQTT subscription `filter`, honoring the
 * single-level (`+`) and multi-level (`#`) wildcards - the same matching a
 * real broker applies to decide whether to deliver a packet to a subscriber.
 * `MqttClient` subscribes to concrete topics (`homeassistant/status`),
 * action wildcards (`zwave/_CLIENTS/<id>/api/#`) and value wildcards
 * (`zwave/+/+/+/+/set`), so the fake must implement both wildcard kinds.
 */
export function topicMatchesFilter(topic: string, filter: string): boolean {
	const t = topic.split('/')
	const f = filter.split('/')
	for (let i = 0; i < f.length; i++) {
		if (f[i] === '#') return true // matches this level and everything below
		if (i >= t.length) return false
		if (f[i] === '+') continue // matches exactly one level
		if (f[i] !== t[i]) return false
	}
	return t.length === f.length
}

/**
 * Builds a fresh `FakeBroker`. Not normally called directly by tests - the
 * `vi.mock('mqtt')` factory calls it once per real `connect()`. Starts
 * DISCONNECTED, exactly like a real `mqtt` client, which only becomes usable
 * for inbound traffic after it fires `'connect'` (drive that with
 * `triggerConnect()`).
 */
export function createFakeBroker(): FakeBroker {
	const broker = new EventEmitter() as FakeBroker
	broker.connected = false
	broker.published = []
	broker.subscribed = []
	broker.ended = false

	broker.publish = (topic, payload, options, cb) => {
		// `mqtt`'s real signature allows `publish(topic, payload, cb)` where
		// the 3rd arg is the callback; mirror that so the real
		// `MqttClient.publish`/`updateClientStatus`/`publishVersion` call
		// shapes all resolve. NOTE: like the real client, publishing does NOT
		// require `connected` (the real `MqttClient.publish` only checks
		// `this.client`), so discovery publishes are recorded even before a
		// `'connect'`; only inbound `deliver()` is connection/subscription
		// gated.
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
		// Real `mqtt` grants an array of `{ topic, qos }`; the wrapper's
		// `subscribe()` iterates `granted` and treats `qos === 128` as a
		// permission error, so hand back the requested qos to model a
		// successful grant.
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
		// A real broker delivers nothing to an offline client, and nothing for
		// a topic the client never subscribed to (with a matching filter).
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

	mqttBrokers.push(broker)
	return broker
}

/**
 * The object a test file passes to `vi.mock('mqtt', () => mqttMockFactory())`.
 * `connect` is a `vi.fn()` (so tests can assert it was/ wasn't called and
 * with what) that returns a brand-new `FakeBroker` each time - matching the
 * real `mqtt.connect()` contract of one client per call (e.g. after
 * `MqttClient.update()` closes and re-inits).
 */
export function mqttMockFactory() {
	return {
		connect: vi.fn((_url?: string, _options?: Record<string, any>) =>
			createFakeBroker(),
		),
	}
}
