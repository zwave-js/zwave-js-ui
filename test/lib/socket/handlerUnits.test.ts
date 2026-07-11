/**
 * Focused, isolated unit tests for the individual `api/socket/*.ts` modules
 * extracted out of `api/app.ts`'s `setupSocket()` (Layer 6 of issue #4722).
 *
 * Unlike `inboundApis.test.ts`/`clientLifecycle.test.ts`/`subscriptions.test.ts`
 * (which drive every handler through a REAL `socket.io-client` <-> HTTP
 * server round trip via `createSocketHarness()`), this file calls each
 * `register*Handler(socket, runtime)` export DIRECTLY, against a minimal
 * `FakeSocket` (just enough of the real `Socket` surface - `on()`/`join()`/
 * `leave()`/`rooms`/`id` - to drive the handler under test) and a duck-typed
 * fake `AppRuntime` (`requireGateway`/`getZniffer`/`requireZniffer`/
 * `getDebugManager`, each a `vi.fn()`). No HTTP server, no real Socket.IO
 * transport, no `jsonStore`/`STORE_DIR` isolation - these tests run in
 * milliseconds and exist purely to reach the handful of branches the
 * wire-level characterization suite doesn't (by design - it exercises the
 * ack ENVELOPE/wire contract for a representative subset of actions, not
 * every switch-case), plus `registerSocketApi.ts`'s own registration
 * wiring/order and its `'clients'` first/last-client lifecycle callback in
 * isolation from `SocketManager`'s real connection bookkeeping.
 *
 * Every test below is intentionally narrow - it does NOT re-assert what the
 * wire-level suite already covers (ack shape for the actions it exercises,
 * quirks like the missing `await` on `loadCaptureFromBuffer`, the "no
 * default case" HASS_API quirk, etc.) - only what's missing:
 *  - `mqttApi.ts`'s `removeNodeRetained` action (the wire suite only
 *    exercises `updateNodeTopics`),
 *  - `hassApi.ts`'s `disableDiscovery` SUCCESS path (the wire suite only
 *    exercises its throw branch),
 *  - `znifferApi.ts`'s `stop`/`clear`/`getFrames`/`setFrequency`/
 *    `setLRChannelConfig`/`saveCaptureToFile` actions (the wire suite only
 *    exercises `start`/an unknown action/`loadCaptureFromBuffer`),
 *  - every handler's default (`cb = noop`) ack path, un-exercised by the
 *    wire suite (a real `socket.io-client` always supplies an ack callback
 *    via `emit(event, data, resolve)`) - this is also the only way to
 *    actually CALL `types.ts`'s `noop`, so it's exercised for real function
 *    coverage, not just imported,
 *  - `registerSocketApi.ts`'s registration order/wiring and its `'clients'`
 *    callback's per-firing-fresh gateway resolution, directly (rather than
 *    only inferred from a real connect/disconnect in `clientLifecycle.test.ts`).
 */
import { describe, it, expect, vi } from 'vitest'
import type { Socket } from 'socket.io'
import type SocketManager from '../../../api/lib/SocketManager.ts'
import type { AppRuntime } from '../../../api/runtime/AppRuntime.ts'
import { inboundEvents } from '../../../api/lib/SocketEvents.ts'
import {
	registerInitHandler,
	registerZwaveApiHandler,
} from '../../../api/socket/zwaveApi.ts'
import { registerMqttApiHandler } from '../../../api/socket/mqttApi.ts'
import { registerHassApiHandler } from '../../../api/socket/hassApi.ts'
import { registerZnifferApiHandler } from '../../../api/socket/znifferApi.ts'
import { registerSubscriptionHandlers } from '../../../api/socket/subscriptions.ts'
import { registerSocketApi } from '../../../api/socket/registerSocketApi.ts'
import { noop } from '../../../api/socket/types.ts'
import {
	createFakeGateway,
	createFakeZniffer,
	createFakeZwaveClient,
} from './fakes.ts'

type Listener = (...args: any[]) => unknown

/**
 * Minimal fake `Socket` - just enough of the real `socket.io` `Socket`
 * surface for every `register*Handler` in `api/socket/` to operate against:
 * `on()` captures the listener (and its registration order) instead of
 * wiring a real transport, `join()`/`leave()`/`rooms` back the subscription
 * handlers' real room-membership bookkeeping.
 */
class FakeSocket {
	readonly id = 'fake-socket-id'
	readonly rooms = new Set<string>(['fake-socket-id'])
	readonly registrationOrder: string[] = []
	private readonly handlers = new Map<string, Listener>()

	on(event: string, listener: Listener): this {
		this.handlers.set(event, listener)
		this.registrationOrder.push(event)
		return this
	}

	getHandler(event: string): Listener {
		const handler = this.handlers.get(event)
		if (!handler) {
			throw new Error(`No handler registered for "${event}"`)
		}
		return handler
	}

	join(room: string): void {
		this.rooms.add(room)
	}

	leave(room: string): void {
		this.rooms.delete(room)
	}
}

interface FakeRuntimeOverrides {
	requireGateway?: (property: string) => any
	getZniffer?: () => any
	requireZniffer?: (property: string) => any
	getDebugManager?: () => any
}

/**
 * Duck-typed fake `AppRuntime` - every `api/socket/*.ts` handler only ever
 * calls these 4 methods (never anything else `AppRuntime` exposes), so a
 * plain object of `vi.fn()`s (cast `as unknown as AppRuntime`) stands in
 * without constructing the real class or its heavier collaborators. Absent
 * gateway/zniffer default to the same native `TypeError` the real
 * `AppRuntime.requireGateway()`/`requireZniffer()` throw, so a test that
 * forgets to install one fails loudly instead of silently passing `undefined`
 * through.
 */
function createFakeRuntime(overrides: FakeRuntimeOverrides = {}) {
	return {
		requireGateway: vi.fn(
			overrides.requireGateway ??
				((property: string) => {
					throw new TypeError(
						`Cannot read properties of undefined (reading '${property}')`,
					)
				}),
		),
		getZniffer: vi.fn(overrides.getZniffer ?? (() => undefined)),
		requireZniffer: vi.fn(
			overrides.requireZniffer ??
				((property: string) => {
					throw new TypeError(
						`Cannot read properties of undefined (reading '${property}')`,
					)
				}),
		),
		getDebugManager: vi.fn(
			overrides.getDebugManager ??
				(() => ({ isSessionActive: () => false })),
		),
	}
}

/** Resolves with whatever `handler` acks via its `cb` argument. */
function emitAck(handler: Listener, data: unknown): Promise<any> {
	return new Promise((resolve) => handler(data, resolve))
}

function createFakeSocketManager() {
	let connectionHandler: ((socket: unknown) => void) | undefined
	let clientsHandler:
		| ((
				event: 'connection' | 'disconnect',
				activeSockets: Map<string, unknown>,
		  ) => void)
		| undefined

	const manager = {
		io: {
			on: (event: string, cb: Listener) => {
				if (event === 'connection') {
					connectionHandler = cb as (socket: unknown) => void
				}
			},
		},
		on: (event: string, cb: Listener) => {
			if (event === 'clients') {
				clientsHandler = cb as (
					event: 'connection' | 'disconnect',
					activeSockets: Map<string, unknown>,
				) => void
			}
		},
	}

	return {
		manager,
		fireConnection: (socket: unknown) => {
			if (!connectionHandler) {
				throw new Error('No "connection" handler was registered')
			}
			connectionHandler(socket)
		},
		fireClients: (
			event: 'connection' | 'disconnect',
			activeSockets: Map<string, unknown>,
		) => {
			if (!clientsHandler) {
				throw new Error('No "clients" handler was registered')
			}
			clientsHandler(event, activeSockets)
		},
	}
}

describe('registerSocketApi: registration wiring/order + "clients" lifecycle (unit-level)', () => {
	it('registers exactly the 7 real inbound events, in source order, on every connection', () => {
		const { manager, fireConnection } = createFakeSocketManager()
		const runtime = createFakeRuntime()

		registerSocketApi(
			manager as unknown as SocketManager,
			runtime as unknown as AppRuntime,
		)

		const socket = new FakeSocket()
		fireConnection(socket)

		expect(socket.registrationOrder).toEqual([
			inboundEvents.init,
			inboundEvents.zwave,
			inboundEvents.mqtt,
			inboundEvents.hass,
			inboundEvents.zniffer,
			inboundEvents.subscribe,
			inboundEvents.unsubscribe,
		])
	})

	it('registers a fresh, independent set of handlers for every new connection', () => {
		const { manager, fireConnection } = createFakeSocketManager()
		const runtime = createFakeRuntime()
		registerSocketApi(
			manager as unknown as SocketManager,
			runtime as unknown as AppRuntime,
		)

		const socketA = new FakeSocket()
		const socketB = new FakeSocket()
		fireConnection(socketA)
		fireConnection(socketB)

		expect(socketA.registrationOrder).toHaveLength(7)
		expect(socketB.registrationOrder).toHaveLength(7)
	})

	it('calls gw.zwave.setUserCallbacks() exactly once when a connection brings activeSockets to size 1, not again for a further connection', () => {
		const { manager, fireClients } = createFakeSocketManager()
		const gateway = createFakeGateway()
		const runtime = createFakeRuntime({ requireGateway: () => gateway })
		registerSocketApi(
			manager as unknown as SocketManager,
			runtime as unknown as AppRuntime,
		)

		fireClients('connection', new Map([['a', {}]]))
		expect(gateway.zwave.setUserCallbacks).toHaveBeenCalledOnce()

		fireClients(
			'connection',
			new Map([
				['a', {}],
				['b', {}],
			]),
		)
		expect(gateway.zwave.setUserCallbacks).toHaveBeenCalledOnce()
		expect(gateway.zwave.removeUserCallbacks).not.toHaveBeenCalled()
	})

	it('calls gw.zwave.removeUserCallbacks() only when a disconnect brings activeSockets to size 0', () => {
		const { manager, fireClients } = createFakeSocketManager()
		const gateway = createFakeGateway()
		const runtime = createFakeRuntime({ requireGateway: () => gateway })
		registerSocketApi(
			manager as unknown as SocketManager,
			runtime as unknown as AppRuntime,
		)

		fireClients('disconnect', new Map([['a', {}]]))
		expect(gateway.zwave.removeUserCallbacks).not.toHaveBeenCalled()

		fireClients('disconnect', new Map())
		expect(gateway.zwave.removeUserCallbacks).toHaveBeenCalledOnce()
	})

	it('resolves the gateway fresh on every "clients" firing - a later firing observes a runtime-level swap, never the gateway an earlier firing resolved', () => {
		const { manager, fireClients } = createFakeSocketManager()
		const gwA = createFakeGateway()
		const gwB = createFakeGateway()
		const runtime = createFakeRuntime({ requireGateway: () => gwA })
		registerSocketApi(
			manager as unknown as SocketManager,
			runtime as unknown as AppRuntime,
		)

		fireClients('connection', new Map([['a', {}]]))
		expect(gwA.zwave.setUserCallbacks).toHaveBeenCalledOnce()

		// Swap the gateway the runtime resolves BETWEEN firings, then fire
		// the last-client disconnect - the callback must resolve gwB now,
		// never the gwA it resolved for the earlier connection event.
		runtime.requireGateway.mockReturnValue(gwB)
		fireClients('disconnect', new Map())

		expect(gwB.zwave.removeUserCallbacks).toHaveBeenCalledOnce()
		expect(gwA.zwave.removeUserCallbacks).not.toHaveBeenCalled()
	})
})

describe('registerZwaveApiHandler: per-call gateway freshness + default ack (unit-level)', () => {
	it('resolves the gateway fresh on each ZWAVE_API call - a runtime swap between two calls is observed by the second one, not cached from the first', async () => {
		const socket = new FakeSocket()
		const gwA = createFakeGateway({
			zwave: createFakeZwaveClient({
				callApi: vi.fn(() =>
					Promise.resolve({ success: true, message: 'A' }),
				),
			}),
		})
		const gwB = createFakeGateway({
			zwave: createFakeZwaveClient({
				callApi: vi.fn(() =>
					Promise.resolve({ success: true, message: 'B' }),
				),
			}),
		})
		const runtime = createFakeRuntime({ requireGateway: () => gwA })
		registerZwaveApiHandler(
			socket as unknown as Socket,
			runtime as unknown as AppRuntime,
		)
		const handler = socket.getHandler(inboundEvents.zwave)

		const first = await emitAck(handler, { api: 'x' })
		expect(first).toStrictEqual({ success: true, message: 'A', api: 'x' })

		runtime.requireGateway.mockReturnValue(gwB)

		const second = await emitAck(handler, { api: 'x' })
		expect(second).toStrictEqual({ success: true, message: 'B', api: 'x' })
		expect(gwA.zwave.callApi).toHaveBeenCalledTimes(1)
		expect(gwB.zwave.callApi).toHaveBeenCalledTimes(1)
	})

	it('never throws when the ack is omitted - falls back to the shared no-op default, still driving the real callApi side effect', async () => {
		const socket = new FakeSocket()
		const gateway = createFakeGateway()
		const runtime = createFakeRuntime({ requireGateway: () => gateway })
		registerZwaveApiHandler(
			socket as unknown as Socket,
			runtime as unknown as AppRuntime,
		)
		const handler = socket.getHandler(inboundEvents.zwave)

		await expect(handler({ api: 'fireAndForget' })).resolves.toBeUndefined()
		expect(gateway.zwave.callApi).toHaveBeenCalledWith('fireAndForget')
	})
})

describe('registerMqttApiHandler: removeNodeRetained + default ack (unit-level; not reached by the wire suite)', () => {
	it('calls gw.removeNodeRetained(args[0]) for the "removeNodeRetained" action', () => {
		const socket = new FakeSocket()
		const gateway = createFakeGateway({ removeNodeRetained: vi.fn() })
		const runtime = createFakeRuntime({ requireGateway: () => gateway })
		registerMqttApiHandler(
			socket as unknown as Socket,
			runtime as unknown as AppRuntime,
		)
		const handler = socket.getHandler(inboundEvents.mqtt)

		const cb = vi.fn()
		handler({ api: 'removeNodeRetained', args: [7] }, cb)

		expect(gateway.removeNodeRetained).toHaveBeenCalledWith(7)
		expect(cb).toHaveBeenCalledWith({
			success: true,
			message: 'Success MQTT api call',
			result: undefined,
			api: 'removeNodeRetained',
		})
	})

	it('never throws when the ack is omitted - falls back to the shared no-op default', () => {
		const socket = new FakeSocket()
		const gateway = createFakeGateway({ removeNodeRetained: vi.fn() })
		const runtime = createFakeRuntime({ requireGateway: () => gateway })
		registerMqttApiHandler(
			socket as unknown as Socket,
			runtime as unknown as AppRuntime,
		)
		const handler = socket.getHandler(inboundEvents.mqtt)

		expect(() =>
			handler({ api: 'removeNodeRetained', args: [7] }),
		).not.toThrow()
		expect(gateway.removeNodeRetained).toHaveBeenCalledWith(7)
	})
})

describe('registerHassApiHandler: disableDiscovery success + default ack (unit-level; the wire suite only exercises its throw branch)', () => {
	it('calls gw.disableDiscovery(nodeId) and reports success on the happy path', async () => {
		const socket = new FakeSocket()
		const gateway = createFakeGateway({ disableDiscovery: vi.fn() })
		const runtime = createFakeRuntime({ requireGateway: () => gateway })
		registerHassApiHandler(
			socket as unknown as Socket,
			runtime as unknown as AppRuntime,
		)
		const handler = socket.getHandler(inboundEvents.hass)

		const result = await emitAck(handler, {
			apiName: 'disableDiscovery',
			nodeId: 3,
		})

		expect(gateway.disableDiscovery).toHaveBeenCalledWith(3)
		expect(result).toStrictEqual({
			success: true,
			message: 'Success HASS api call',
			result: undefined,
			api: 'disableDiscovery',
		})
	})

	it('never throws when the ack is omitted - falls back to the shared no-op default', async () => {
		const socket = new FakeSocket()
		const gateway = createFakeGateway({ disableDiscovery: vi.fn() })
		const runtime = createFakeRuntime({ requireGateway: () => gateway })
		registerHassApiHandler(
			socket as unknown as Socket,
			runtime as unknown as AppRuntime,
		)
		const handler = socket.getHandler(inboundEvents.hass)

		await expect(
			handler({ apiName: 'disableDiscovery', nodeId: 3 }),
		).resolves.toBeUndefined()
		expect(gateway.disableDiscovery).toHaveBeenCalledWith(3)
	})
})

describe('registerZnifferApiHandler: remaining actions + default ack (unit-level; the wire suite only exercises start/unknown/loadCaptureFromBuffer)', () => {
	function setup(zniffer = createFakeZniffer()) {
		const socket = new FakeSocket()
		const runtime = createFakeRuntime({ requireZniffer: () => zniffer })
		registerZnifferApiHandler(
			socket as unknown as Socket,
			runtime as unknown as AppRuntime,
		)
		return { zniffer, handler: socket.getHandler(inboundEvents.zniffer) }
	}

	it('awaits zniffer.stop() for "stop"', async () => {
		const { zniffer, handler } = setup()
		const result = await emitAck(handler, { apiName: 'stop' })
		expect(zniffer.stop).toHaveBeenCalledOnce()
		expect(result).toStrictEqual({
			success: true,
			message: 'Success ZNIFFER api call',
			result: undefined,
			api: 'stop',
		})
	})

	it('calls zniffer.clear() synchronously for "clear"', async () => {
		const { zniffer, handler } = setup()
		const result = await emitAck(handler, { apiName: 'clear' })
		expect(zniffer.clear).toHaveBeenCalledOnce()
		expect(result).toStrictEqual({
			success: true,
			message: 'Success ZNIFFER api call',
			result: undefined,
			api: 'clear',
		})
	})

	it('calls zniffer.getFrames() synchronously for "getFrames"', async () => {
		const zniffer = createFakeZniffer({
			getFrames: vi.fn(() => ['frame-1']),
		})
		const { handler } = setup(zniffer)
		const result = await emitAck(handler, { apiName: 'getFrames' })
		expect(zniffer.getFrames).toHaveBeenCalledOnce()
		expect(result).toStrictEqual({
			success: true,
			message: 'Success ZNIFFER api call',
			result: ['frame-1'],
			api: 'getFrames',
		})
	})

	it('awaits zniffer.setFrequency(frequency) for "setFrequency"', async () => {
		const { zniffer, handler } = setup()
		const result = await emitAck(handler, {
			apiName: 'setFrequency',
			frequency: 42,
		})
		expect(zniffer.setFrequency).toHaveBeenCalledWith(42)
		expect(result).toStrictEqual({
			success: true,
			message: 'Success ZNIFFER api call',
			result: undefined,
			api: 'setFrequency',
		})
	})

	it('awaits zniffer.setLRChannelConfig(channelConfig) for "setLRChannelConfig"', async () => {
		const { zniffer, handler } = setup()
		const result = await emitAck(handler, {
			apiName: 'setLRChannelConfig',
			channelConfig: 2,
		})
		expect(zniffer.setLRChannelConfig).toHaveBeenCalledWith(2)
		expect(result).toStrictEqual({
			success: true,
			message: 'Success ZNIFFER api call',
			result: undefined,
			api: 'setLRChannelConfig',
		})
	})

	it('awaits zniffer.saveCaptureToFile() for "saveCaptureToFile"', async () => {
		const { zniffer, handler } = setup()
		const result = await emitAck(handler, { apiName: 'saveCaptureToFile' })
		expect(zniffer.saveCaptureToFile).toHaveBeenCalledOnce()
		expect(result).toStrictEqual({
			success: true,
			message: 'Success ZNIFFER api call',
			result: '/tmp/capture.zlf',
			api: 'saveCaptureToFile',
		})
	})

	it('never throws when the ack is omitted - falls back to the shared no-op default', async () => {
		const { zniffer, handler } = setup()
		await expect(handler({ apiName: 'clear' })).resolves.toBeUndefined()
		expect(zniffer.clear).toHaveBeenCalledOnce()
	})
})

describe('registerSubscriptionHandlers: default ack (unit-level; SUBSCRIBE/UNSUBSCRIBE always get a real client-supplied cb on the wire suite)', () => {
	it('SUBSCRIBE still joins the requested room when no ack is supplied', async () => {
		const socket = new FakeSocket()
		registerSubscriptionHandlers(socket as unknown as Socket)
		const handler = socket.getHandler(inboundEvents.subscribe)

		await expect(handler({ channels: ['nodes'] })).resolves.toBeUndefined()
		expect(socket.rooms.has('nodes')).toBe(true)
	})

	it('UNSUBSCRIBE still leaves the requested room when no ack is supplied', async () => {
		const socket = new FakeSocket()
		registerSubscriptionHandlers(socket as unknown as Socket)
		const subscribeHandler = socket.getHandler(inboundEvents.subscribe)
		const unsubscribeHandler = socket.getHandler(inboundEvents.unsubscribe)

		await emitAck(subscribeHandler, { channels: ['nodes'] })
		expect(socket.rooms.has('nodes')).toBe(true)

		await expect(
			unsubscribeHandler({ channels: ['nodes'] }),
		).resolves.toBeUndefined()
		expect(socket.rooms.has('nodes')).toBe(false)
	})
})

describe('registerInitHandler: default ack (unit-level)', () => {
	it('never throws when the ack is omitted - falls back to the shared no-op default', () => {
		const socket = new FakeSocket()
		const gateway = createFakeGateway()
		const runtime = createFakeRuntime({ requireGateway: () => gateway })
		registerInitHandler(
			socket as unknown as Socket,
			runtime as unknown as AppRuntime,
		)
		const handler = socket.getHandler(inboundEvents.init)

		expect(() => handler({})).not.toThrow()
		expect(gateway.zwave.getState).toHaveBeenCalledOnce()
	})
})

describe('types.ts: the shared noop default', () => {
	it('is a callable no-op that returns undefined', () => {
		expect(noop()).toBeUndefined()
	})
})
