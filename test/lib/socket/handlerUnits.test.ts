import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import type { Socket } from 'socket.io'
import type SocketManager from '../../../api/lib/SocketManager.ts'
import type { AppRuntime } from '../../../api/runtime/AppRuntime.ts'
import { inboundEvents } from '../../../api/lib/SocketEvents.ts'
import { ensureTestEnv, cleanupTestEnv } from './env.ts'
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

type ZnifferApiRequest = ZnifferApiModule.ZnifferApiRequest

let registerInitHandler: typeof ZwaveApiModule.registerInitHandler
let registerZwaveApiHandler: typeof ZwaveApiModule.registerZwaveApiHandler
let registerMqttApiHandler: typeof MqttApiModule.registerMqttApiHandler
let registerHassApiHandler: typeof HassApiModule.registerHassApiHandler
let registerZnifferApiHandler: typeof ZnifferApiModule.registerZnifferApiHandler
let registerSubscriptionHandlers: typeof SubscriptionsModule.registerSubscriptionHandlers
let registerSocketApi: typeof RegisterSocketApiModule.registerSocketApi

beforeAll(async () => {
	ensureTestEnv()
	// Import every handler after STORE_DIR isolation because logger creates paths during module evaluation
	;[
		{ registerInitHandler, registerZwaveApiHandler },
		{ registerMqttApiHandler },
		{ registerHassApiHandler },
		{ registerZnifferApiHandler },
		{ registerSubscriptionHandlers },
		{ registerSocketApi },
	] = await Promise.all([
		import('../../../api/socket/zwaveApi.ts'),
		import('../../../api/socket/mqttApi.ts'),
		import('../../../api/socket/hassApi.ts'),
		import('../../../api/socket/znifferApi.ts'),
		import('../../../api/socket/subscriptions.ts'),
		import('../../../api/socket/registerSocketApi.ts'),
	])
})

afterAll(() => {
	cleanupTestEnv()
})

type Listener = (...args: any[]) => unknown

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

	it('mutates the request object in place: a falsy `args` (e.g. null) is rewritten to [] on the SAME object the client sent, before dispatch', async () => {
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

		expect(data.args).toStrictEqual([])
		expect(gateway.zwave.callApi).toHaveBeenCalledWith('x')
		expect(result).toStrictEqual({ success: true, message: 'OK', api: 'x' })
	})

	it('quirk: a malformed truthy, non-iterable `args` (e.g. a plain object) crashes synchronously while spreading - BEFORE callApi is ever invoked - producing no ACK at all', async () => {
		// Drive this directly because the rejected listener would leave a wire-level ACK pending
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

	it('quirk: a thrown `null` crashes INSIDE the catch block itself (direct `.message` read on null) - the handler throws synchronously, producing no ACK at all', () => {
		// Direct invocation exposes the synchronous throw that would leave a wire ACK pending
		const socket = new FakeSocket()
		const gateway = createFakeGateway({
			removeNodeRetained: vi.fn(() => {
				// eslint-disable-next-line @typescript-eslint/only-throw-error -- Non-Error throws preserve direct message access
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

	it('quirk: a thrown `null` crashes INSIDE the catch block itself (direct `.message` read on null) - the handler REJECTS with no ACK ever sent', async () => {
		// Direct invocation exposes the rejection that would leave a wire ACK pending
		const socket = new FakeSocket()
		const gateway = createFakeGateway({
			disableDiscovery: vi.fn(() => {
				// eslint-disable-next-line @typescript-eslint/only-throw-error -- Non-Error throws preserve direct message access
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

	it('quirk: a thrown `null` crashes INSIDE the catch block itself (direct `.message` read on null) - the handler REJECTS with no ACK ever sent', async () => {
		// Direct invocation exposes the rejection that would leave a wire ACK pending
		const zniffer = createFakeZniffer({
			clear: vi.fn(() => {
				// eslint-disable-next-line @typescript-eslint/only-throw-error -- Non-Error throws preserve direct message access
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

describe('ZnifferApiRequest: discriminated union enforces required fields per apiName at compile time', () => {
	it('start/stop/clear/getFrames/saveCaptureToFile compile with ONLY `apiName` - no frequency/channelConfig/buffer required', () => {
		const forms: ZnifferApiRequest[] = [
			{ apiName: 'start' },
			{ apiName: 'stop' },
			{ apiName: 'clear' },
			{ apiName: 'getFrames' },
			{ apiName: 'saveCaptureToFile' },
		]
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
		// @ts-expect-error frequency is required for setFrequency
		const missingFrequency: ZnifferApiRequest = { apiName: 'setFrequency' }
		// @ts-expect-error channelConfig is required for setLRChannelConfig
		const missingChannelConfig: ZnifferApiRequest = {
			apiName: 'setLRChannelConfig',
		}
		// @ts-expect-error buffer is required for loadCaptureFromBuffer
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

		// Buffer conversion fails first, yielding a messaged TypeError ACK before the collaborator runs
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
