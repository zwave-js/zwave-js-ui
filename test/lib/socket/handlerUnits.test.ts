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
 * transport or `jsonStore`; the dynamic-import setup below still isolates
 * `STORE_DIR` before logger/config modules load. These tests run in
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
 *
 * ### Why the `api/socket/*.ts` imports below are dynamic, not static
 *
 * `mqttApi.ts`/`hassApi.ts`/`znifferApi.ts` (and, transitively,
 * `registerSocketApi.ts`, which imports all three) import `api/lib/logger.ts`
 * - which, at module-EVALUATION time, resolves `storeDir`/`logsDir` from
 * `api/config/app.ts` against whatever `process.env.STORE_DIR`/
 * `ZWAVEJS_LOGS_DIR` happen to be ambiently, and unconditionally
 * `ensureDirSync()`s both. A static top-level `import` of any of those
 * modules would evaluate that chain the moment Vitest loads THIS file -
 * before any test, `beforeAll`, or even this file's own module body below
 * had a chance to run `ensureTestEnv()` - silently creating/writing to this
 * repo's real `store/` directory (and, depending on ambient env vars,
 * persisting a real `store/.session-secret`) every time this suite runs.
 * Empirically reproduced: with `store/` removed, `vitest run
 * handlerUnits.test.ts` alone recreated `store/.session-secret` and
 * `store/logs/` before the fix below.
 *
 * `ensureTestEnv()` (re-exported from `./env.ts`, the same isolation
 * `test/lib/http/env.ts` established for the HTTP contract suite - see its
 * doc comment for the full rationale) points `STORE_DIR`/`SESSION_SECRET`
 * at a private throwaway directory instead. Calling it BEFORE dynamically
 * `import()`-ing every `api/socket/*.ts` handler module (all of them,
 * uniformly - not just the three known to import `logger.ts` today, so a
 * future edit adding a new transitive import can't silently reintroduce
 * this same class of bug) guarantees that chain only ever touches the
 * isolated directory, exactly like `test/lib/socket/harness.ts`'s
 * `createSocketHarness()` already does for `api/app.ts` itself.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type { Socket } from 'socket.io'
import type SocketManager from '../../../api/lib/SocketManager.ts'
import type { AppRuntime } from '../../../api/runtime/AppRuntime.ts'
import { inboundEvents } from '../../../api/lib/SocketEvents.ts'
import { noop, getLegacyErrorMessage } from '../../../api/socket/types.ts'
import { ensureTestEnv, cleanupTestEnv, getTestStoreDir } from './env.ts'
import {
	createFakeGateway,
	createFakeZniffer,
	createFakeZwaveClient,
} from './fakes.ts'
import type * as ZwaveApiModule from '../../../api/socket/zwaveApi.ts'
import type * as MqttApiModule from '../../../api/socket/mqttApi.ts'
import type * as HassApiModule from '../../../api/socket/hassApi.ts'
import type * as ZnifferApiModule from '../../../api/socket/znifferApi.ts'
import type * as SubscriptionsModule from '../../../api/socket/subscriptions.ts'
import type * as RegisterSocketApiModule from '../../../api/socket/registerSocketApi.ts'
import type * as ConfigAppModule from '../../../api/config/app.ts'

/**
 * Type-only alias for `znifferApi.ts`'s discriminated `ZnifferApiRequest`
 * union (Finding 5) - erased at compile time, so pulling it off the
 * already-`import type *`'d `ZnifferApiModule` namespace above carries none
 * of that module's runtime/`logger.ts` side effects. Used below purely for
 * `satisfies`/`@ts-expect-error` compile-time shape checks, each paired with
 * a real runtime assertion through the dynamically-imported handler.
 */
type ZnifferApiRequest = ZnifferApiModule.ZnifferApiRequest

// Populated by `beforeAll` below, AFTER `ensureTestEnv()` has already
// isolated `STORE_DIR`/`SESSION_SECRET` - see the doc comment above.
let registerInitHandler: typeof ZwaveApiModule.registerInitHandler
let registerZwaveApiHandler: typeof ZwaveApiModule.registerZwaveApiHandler
let registerMqttApiHandler: typeof MqttApiModule.registerMqttApiHandler
let registerHassApiHandler: typeof HassApiModule.registerHassApiHandler
let registerZnifferApiHandler: typeof ZnifferApiModule.registerZnifferApiHandler
let registerSubscriptionHandlers: typeof SubscriptionsModule.registerSubscriptionHandlers
let registerSocketApi: typeof RegisterSocketApiModule.registerSocketApi
/** Only imported so the regression below can assert against the SAME
 * `storeDir`/`logsDir` values `logger.ts` resolved for its `ensureDirSync()`
 * calls, without duplicating `config/app.ts`'s resolution logic. */
let configApp: typeof ConfigAppModule

beforeAll(async () => {
	const isolatedStoreDir = ensureTestEnv()

	;[
		{ registerInitHandler, registerZwaveApiHandler },
		{ registerMqttApiHandler },
		{ registerHassApiHandler },
		{ registerZnifferApiHandler },
		{ registerSubscriptionHandlers },
		{ registerSocketApi },
		configApp,
	] = await Promise.all([
		import('../../../api/socket/zwaveApi.ts'),
		import('../../../api/socket/mqttApi.ts'),
		import('../../../api/socket/hassApi.ts'),
		import('../../../api/socket/znifferApi.ts'),
		import('../../../api/socket/subscriptions.ts'),
		import('../../../api/socket/registerSocketApi.ts'),
		import('../../../api/config/app.ts'),
	])

	// Sanity-check the precondition every test below (and the regression
	// further down) relies on: the dynamic imports above must have
	// resolved `storeDir` against the isolated directory, never the real
	// repo default (`joinPath(true, 'store')`).
	if (configApp.storeDir !== isolatedStoreDir) {
		throw new Error(
			'Expected api/config/app.ts to resolve storeDir to the isolated ' +
				`test directory (${isolatedStoreDir}), got ${configApp.storeDir} - ` +
				'env isolation did not take effect before the dynamic import.',
		)
	}
})

afterAll(() => {
	cleanupTestEnv()
})

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

	it('mutates the request object in place: a falsy `args` (e.g. null) is rewritten to [] on the SAME object the client sent, before dispatch (Finding 4)', async () => {
		const socket = new FakeSocket()
		const gateway = createFakeGateway()
		const runtime = createFakeRuntime({ requireGateway: () => gateway })
		registerZwaveApiHandler(
			socket as unknown as Socket,
			runtime as unknown as AppRuntime,
		)
		const handler = socket.getHandler(inboundEvents.zwave)
		const data: { api: string; args?: unknown } = { api: 'x', args: null }

		const result = await emitAck(handler, data)

		// The exact object the "client" sent was mutated - not replaced by a
		// fresh object built for dispatch.
		expect(data.args).toStrictEqual([])
		expect(gateway.zwave.callApi).toHaveBeenCalledWith('x')
		expect(result).toStrictEqual({ success: true, message: 'OK', api: 'x' })
	})

	it('quirk: a malformed truthy, non-iterable `args` (e.g. a plain object) crashes synchronously while spreading - BEFORE callApi is ever invoked - producing no ACK at all (Finding 4)', async () => {
		// Unlike every falsy value above, a truthy non-iterable object never
		// hits the `if (!data.args) data.args = []` guard - it goes straight
		// to `wireArguments()`'s `[...args]` spread, which throws for any
		// non-iterable value. Because `registerZwaveApiHandler`'s listener is
		// `async`, that synchronous throw still becomes a REJECTED PROMISE,
		// not a synchronous exception - and since nothing ever calls `cb`,
		// this is exercised directly (not over the real wire, where the
		// rejection would just be an unhandled one with no ACK ever
		// resolving the client's `emit()` promise, hanging the test).
		const socket = new FakeSocket()
		const gateway = createFakeGateway()
		const runtime = createFakeRuntime({ requireGateway: () => gateway })
		registerZwaveApiHandler(
			socket as unknown as Socket,
			runtime as unknown as AppRuntime,
		)
		const handler = socket.getHandler(inboundEvents.zwave)
		const cb = vi.fn()
		const data: { api: string; args?: unknown } = {
			api: 'x',
			args: { foo: 1 },
		}

		await expect(handler(data, cb)).rejects.toThrow(/not iterable/)

		expect(gateway.zwave.callApi).not.toHaveBeenCalled()
		expect(cb).not.toHaveBeenCalled()
		// The falsy-check guard never fires for a truthy object - `data.args`
		// is left exactly as sent, right up to the point spreading it throws.
		expect(data.args).toStrictEqual({ foo: 1 })
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

	it('quirk: a thrown `null` crashes INSIDE the catch block itself (direct `.message` read on null) - the handler throws synchronously, producing no ACK at all (Finding 3)', () => {
		// `registerMqttApiHandler`'s listener is a plain (non-`async`)
		// function, unlike HASS/ZNIFFER below - so a throw from
		// `getLegacyErrorMessage(null)` propagates as a genuine SYNCHRONOUS
		// exception out of the handler call itself, never a rejected
		// promise. Driving this directly (not through a real
		// `socket.io-client` round trip) is the only deterministic way to
		// observe it: over the real wire this would just be an uncaught
		// exception with no ack ever sent, hanging the client's `emit()`
		// callback forever.
		const socket = new FakeSocket()
		const gateway = createFakeGateway({
			removeNodeRetained: vi.fn(() => {
				// eslint-disable-next-line @typescript-eslint/only-throw-error -- intentionally non-Error, to characterize getLegacyErrorMessage's direct property read (Finding 3)
				throw null
			}),
		})
		const runtime = createFakeRuntime({ requireGateway: () => gateway })
		registerMqttApiHandler(
			socket as unknown as Socket,
			runtime as unknown as AppRuntime,
		)
		const handler = socket.getHandler(inboundEvents.mqtt)
		const cb = vi.fn()

		expect(() =>
			handler({ api: 'removeNodeRetained', args: [7] }, cb),
		).toThrow(/Cannot read propert/)
		expect(gateway.removeNodeRetained).toHaveBeenCalledWith(7)
		expect(cb).not.toHaveBeenCalled()
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

	it('quirk: a thrown `null` crashes INSIDE the catch block itself (direct `.message` read on null) - the handler REJECTS with no ACK ever sent (Finding 3)', async () => {
		// Unlike MQTT_API above, `registerHassApiHandler`'s listener IS
		// `async` - so the same synchronous throw from
		// `getLegacyErrorMessage(null)` instead surfaces as a REJECTED
		// promise, not a synchronous exception. Driven directly (not over
		// the real wire) so the rejection is deterministically observed
		// instead of leaving an unhandled rejection / a client `emit()`
		// callback that never resolves.
		const socket = new FakeSocket()
		const gateway = createFakeGateway({
			disableDiscovery: vi.fn(() => {
				// eslint-disable-next-line @typescript-eslint/only-throw-error -- intentionally non-Error, to characterize getLegacyErrorMessage's direct property read (Finding 3)
				throw null
			}),
		})
		const runtime = createFakeRuntime({ requireGateway: () => gateway })
		registerHassApiHandler(
			socket as unknown as Socket,
			runtime as unknown as AppRuntime,
		)
		const handler = socket.getHandler(inboundEvents.hass)
		const cb = vi.fn()

		await expect(
			handler({ apiName: 'disableDiscovery', nodeId: 3 }, cb),
		).rejects.toThrow(/Cannot read propert/)
		expect(gateway.disableDiscovery).toHaveBeenCalledWith(3)
		expect(cb).not.toHaveBeenCalled()
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
		const result = await emitAck(handler, {
			apiName: 'stop',
		} satisfies ZnifferApiRequest)
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
		const result = await emitAck(handler, {
			apiName: 'clear',
		} satisfies ZnifferApiRequest)
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
		const result = await emitAck(handler, {
			apiName: 'getFrames',
		} satisfies ZnifferApiRequest)
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
		} satisfies ZnifferApiRequest)
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
		} satisfies ZnifferApiRequest)
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
		const result = await emitAck(handler, {
			apiName: 'saveCaptureToFile',
		} satisfies ZnifferApiRequest)
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

	it('quirk: a thrown `null` crashes INSIDE the catch block itself (direct `.message` read on null) - the handler REJECTS with no ACK ever sent (Finding 3)', async () => {
		// `registerZnifferApiHandler`'s listener is `async` too (like HASS),
		// so this is the same "rejects, never acks" shape - driven directly
		// rather than over the real wire for the same determinism reason.
		const zniffer = createFakeZniffer({
			clear: vi.fn(() => {
				// eslint-disable-next-line @typescript-eslint/only-throw-error -- intentionally non-Error, to characterize getLegacyErrorMessage's direct property read (Finding 3)
				throw null
			}),
		})
		const { handler } = setup(zniffer)
		const cb = vi.fn()

		await expect(
			handler({ apiName: 'clear' } satisfies ZnifferApiRequest, cb),
		).rejects.toThrow(/Cannot read propert/)
		expect(zniffer.clear).toHaveBeenCalledOnce()
		expect(cb).not.toHaveBeenCalled()
	})
})

describe('ZnifferApiRequest: discriminated union enforces required fields per apiName at compile time (Finding 5)', () => {
	it('start/stop/clear/getFrames/saveCaptureToFile compile with ONLY `apiName` - no frequency/channelConfig/buffer required', () => {
		const forms: ZnifferApiRequest[] = [
			{ apiName: 'start' },
			{ apiName: 'stop' },
			{ apiName: 'clear' },
			{ apiName: 'getFrames' },
			{ apiName: 'saveCaptureToFile' },
		]
		// Runtime coverage for each of these 5 forms lives with their own
		// dedicated tests: "start" and "saveCaptureToFile"/"loadCaptureFromBuffer"
		// in `inboundApis.test.ts` (real wire), "stop"/"clear"/"getFrames" just
		// above (unit-level) - this test only proves the TYPE shape compiles
		// without the other variants' extra fields.
		expect(forms).toHaveLength(5)
	})

	it('setFrequency/setLRChannelConfig/loadCaptureFromBuffer each compile ONLY with their own required extra field', () => {
		const setFrequency = {
			apiName: 'setFrequency',
			frequency: 42,
		} satisfies ZnifferApiRequest
		const setLRChannelConfig = {
			apiName: 'setLRChannelConfig',
			channelConfig: 2,
		} satisfies ZnifferApiRequest
		const loadCaptureFromBuffer = {
			apiName: 'loadCaptureFromBuffer',
			buffer: [1, 2, 3],
		} satisfies ZnifferApiRequest

		expect([
			setFrequency,
			setLRChannelConfig,
			loadCaptureFromBuffer,
		]).toHaveLength(3)
	})

	it('compile-time: omitting the one required extra field is a type error - but the untyped wire payload still executes with it `undefined`, exactly like the original untyped handler always did', async () => {
		// @ts-expect-error setFrequency requires `frequency`
		const missingFrequency: ZnifferApiRequest = { apiName: 'setFrequency' }
		// @ts-expect-error setLRChannelConfig requires `channelConfig`
		const missingChannelConfig: ZnifferApiRequest = {
			apiName: 'setLRChannelConfig',
		}
		// @ts-expect-error loadCaptureFromBuffer requires `buffer`
		const missingBuffer: ZnifferApiRequest = {
			apiName: 'loadCaptureFromBuffer',
		}

		const zniffer = createFakeZniffer()
		const runtime = createFakeRuntime({ requireZniffer: () => zniffer })
		const socket = new FakeSocket()
		registerZnifferApiHandler(
			socket as unknown as Socket,
			runtime as unknown as AppRuntime,
		)
		const handler = socket.getHandler(inboundEvents.zniffer)

		await emitAck(handler, missingFrequency)
		expect(zniffer.setFrequency).toHaveBeenCalledWith(undefined)

		await emitAck(handler, missingChannelConfig)
		expect(zniffer.setLRChannelConfig).toHaveBeenCalledWith(undefined)

		// `loadCaptureFromBuffer` is the one variant where a missing field
		// doesn't just forward `undefined` to the collaborator - the
		// handler itself does `Buffer.from(data.buffer)` BEFORE ever
		// calling `zniffer.loadCaptureFromBuffer()`, and `Buffer.from(undefined)`
		// throws synchronously - caught by the handler's own try/catch, so
		// this still yields success:false (not the "no ACK at all" null
		// quirk above - a real `TypeError` here always HAS a `.message`).
		const result = await emitAck(handler, missingBuffer)
		expect(zniffer.loadCaptureFromBuffer).not.toHaveBeenCalled()
		expect(result.success).toBe(false)
		expect(typeof result.message).toBe('string')
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

describe('types.ts: getLegacyErrorMessage - direct `error.message` property read (Finding 3)', () => {
	it('returns the message string for a thrown Error with a truthy message', () => {
		expect(getLegacyErrorMessage(new Error('boom'))).toBe('boom')
	})

	it('returns undefined for a thrown string - strings have no own/inherited `.message` property', () => {
		expect(getLegacyErrorMessage('boom')).toBeUndefined()
	})

	it('returns undefined for a thrown plain object with no `.message` property', () => {
		expect(getLegacyErrorMessage({ code: 'EFAKE' })).toBeUndefined()
	})

	it('edge case: a thrown plain object that DOES carry a `.message` property is read verbatim, whatever its type - never normalized to a string', () => {
		expect(getLegacyErrorMessage({ message: 'custom' })).toBe('custom')
		expect(getLegacyErrorMessage({ message: 0 })).toBe(0)
	})

	it('quirk: throws when reading `.message` directly off a thrown `null` (the direct property read has no null-guard)', () => {
		expect(() => getLegacyErrorMessage(null)).toThrow(/Cannot read propert/)
	})

	it('throws the same way for a thrown `undefined` - the same class of quirk as null, just less commonly thrown', () => {
		expect(() => getLegacyErrorMessage(undefined)).toThrow(
			/Cannot read propert/,
		)
	})
})

describe('module isolation: dynamically importing the handlers never touches the real repo store/logs (regression for the static-import ordering bug)', () => {
	it('resolves storeDir/logsDir against the isolated harness directory - never the real repo default - and only creates directories there', () => {
		const isolatedStoreDir = getTestStoreDir()

		// `getTestStoreDir()` (this file's own env handle) and
		// `api/config/app.ts`'s module-level `storeDir` (resolved the
		// moment the dynamic imports in `beforeAll` above ran) must be the
		// exact same isolated directory - if `beforeAll` had dynamically
		// imported the handlers BEFORE calling `ensureTestEnv()` (or if a
		// static top-level import had done so even earlier, before
		// `beforeAll` ran at all), `configApp.storeDir` would instead have
		// captured the real repo default (`joinPath(true, 'store')`) at
		// that earlier point in time, permanently - reassigning
		// `process.env.STORE_DIR` afterwards cannot change an already
		// module-evaluated `const`.
		expect(configApp.storeDir).toBe(isolatedStoreDir)

		// Structurally distinct from the real repo path: `ensureTestEnv()`
		// always creates a fresh `mkdtempSync` directory under the OS temp
		// directory, never anywhere under the repo checkout - so this alone
		// proves `configApp.storeDir` can't be the real repo default.
		expect(isolatedStoreDir.startsWith(tmpdir())).toBe(true)

		// Positive proof the dynamic imports actually ran their real
		// module-evaluation side effects (not a vacuously-passing check):
		// `logger.ts`'s top-level `ensureDirSync(storeDir)` /
		// `ensureDirSync(logsDir)` did fire, just against the isolated
		// directory instead of the real repo one.
		expect(existsSync(isolatedStoreDir)).toBe(true)
		expect(existsSync(configApp.logsDir)).toBe(true)
		expect(configApp.logsDir.startsWith(isolatedStoreDir)).toBe(true)
	})
})
