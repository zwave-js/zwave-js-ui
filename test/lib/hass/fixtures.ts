/**
 * Typed fixtures for the HASS suite: Z-Wave node/valueId builders, a recording
 * Socket.IO stand-in, a default MQTT config, and a minimal `ZwaveClient` fake.
 *
 * These are plain builders, not clones of real driver objects: `Gateway`'s
 * discovery reads only a well-defined subset of `ZUINode`/`ZUIValueId`, so a
 * shape-correct literal drives the real production switch without a real
 * `zwave-js` graph. Every builder returns a fresh object.
 */
import { vi, type Mock } from 'vitest'
import { EventEmitter } from 'node:events'
import type { StoreHassDevicesResult } from '#api/hass/types.ts'
import type { MqttConfig } from '#api/lib/MqttClient.ts'
import type { GatewayZwave } from '#api/lib/Gateway.ts'
import type {
	HassDevice,
	ZUINode,
	ZUIValueId,
	ZUIValueIdState,
} from '#api/lib/ZwaveClient.ts'

/**
 * A complete `MqttConfig` that stays local with `store: false` (so
 * `MqttClient._init` skips the filesystem and assigns `this.client`
 * synchronously) and `disabled: false` (so `Gateway.mqttEnabled` is true).
 */
export function defaultMqttConfig(
	overrides: Partial<MqttConfig> = {},
): MqttConfig {
	return {
		name: 'test',
		host: 'mqtt://localhost',
		port: 1883,
		disabled: false,
		reconnectPeriod: 3000,
		prefix: 'zwave',
		qos: 0,
		retain: false,
		clean: true,
		store: false,
		allowSelfsigned: false,
		key: '',
		cert: '',
		ca: '',
		auth: false,
		username: '',
		password: '',
		_ca: '',
		_key: '',
		_cert: '',
		...overrides,
	}
}

/**
 * A recorded Socket.IO emission. `args` is the variadic Socket.IO payload, so
 * it stays `any[]` to mirror the real `emit(event, ...args)` contract.
 */
export interface RecordedEmit {
	/** Room passed to `.to(room)`, or `undefined` for a bare `.emit`. */
	room?: string
	event: string
	args: any[]
}

export interface RecordingSocket {
	emissions: RecordedEmit[]
	to(room: string): { emit(event: string, ...args: any[]): void }
	emit(event: string, ...args: any[]): void
	fetchSockets(): Promise<unknown[]>
}

/**
 * Stand-in for the Socket.IO server `ZwaveClient.sendToSocket()` and
 * `connect()`'s `fetchSockets()` read through. Records every emission so a
 * test can assert what was broadcast to which room, and prove ordering (e.g.
 * `node.hassDevices` is mutated before the `nextTick` `nodeUpdated` emission).
 */
export function createRecordingSocket(
	connectedSockets: unknown[] = [],
): RecordingSocket {
	const emissions: RecordedEmit[] = []
	return {
		emissions,
		to(room: string) {
			return {
				emit(event: string, ...args: any[]) {
					emissions.push({ room, event, args })
				},
			}
		},
		emit(event: string, ...args: any[]) {
			emissions.push({ event, args })
		},
		fetchSockets() {
			return Promise.resolve(connectedSockets)
		},
	}
}

export function state(
	value: number | string | boolean,
	text: string,
): ZUIValueIdState {
	return { value, text }
}

export function requireDefined<T>(value: T, message: string): NonNullable<T> {
	if (value === undefined || value === null) {
		throw new TypeError(message)
	}
	return value
}

/** Narrows a previously bound fixture value after enforcing its presence. */
export function assertDefined<T>(
	value: T,
	message: string,
): asserts value is NonNullable<T> {
	requireDefined(value, message)
}

/**
 * The key `ZwaveClient` uses inside `node.values`:
 * `<cc>-<endpoint>-<property>[-<propertyKey>]`, without the node id (unlike
 * `valueId.id`, which prefixes it). This is the exact `vId`
 * `Gateway.discoverValue(node, vId)` expects.
 */
export function valueMapKey(valueId: {
	commandClass: number
	endpoint?: number
	property: string | number
	propertyKey?: string | number
}): string {
	const parts: (string | number)[] = [
		valueId.commandClass,
		valueId.endpoint || 0,
		valueId.property,
	]
	if (valueId.propertyKey !== undefined) {
		parts.push(valueId.propertyKey)
	}
	return parts.join('-')
}

/**
 * Builds a `ZUIValueId`: only the members discovery reads get opinionated
 * defaults, the rest are inert. `id` is the with-node id
 * (`<nodeId>-<cc>-<endpoint>-<property>`) used in the discovery `unique_id`;
 * register it on a node with `addValue()`.
 */
export function buildValueId(partial: Partial<ZUIValueId> = {}): ZUIValueId {
	const commandClass = partial.commandClass ?? 0
	const endpoint = partial.endpoint ?? 0
	const property = partial.property ?? 'currentValue'
	const propertyName = partial.propertyName ?? (property as string).toString()
	const nodeId = partial.nodeId ?? 2

	const idParts: (string | number)[] = [
		nodeId,
		commandClass,
		endpoint,
		property,
	]
	if (partial.propertyKey !== undefined) {
		idParts.push(partial.propertyKey)
	}

	return {
		id: partial.id ?? idParts.join('-'),
		nodeId,
		commandClass,
		commandClassName: partial.commandClassName ?? `CC_${commandClass}`,
		endpoint,
		property,
		propertyName,
		type: partial.type ?? 'number',
		readable: partial.readable ?? true,
		writeable: partial.writeable ?? true,
		default: partial.default,
		stateless: partial.stateless ?? false,
		ccSpecific: partial.ccSpecific ?? {},
		...partial,
	} as ZUIValueId
}

/**
 * Builds a `ZUINode`: a `ready` node with empty `values`/`hassDevices` and a
 * generic device class. `endpoints` defaults to `[]`, so
 * `node.endpoints[endpoint]?.deviceClass` falls back to `node.deviceClass`,
 * exactly as production does.
 */
export function buildNode(partial: Partial<ZUINode> = {}): ZUINode {
	return {
		id: partial.id ?? 2,
		ready: partial.ready ?? true,
		available: partial.available ?? true,
		failed: partial.failed ?? false,
		inited: partial.inited ?? true,
		eventsQueue: partial.eventsQueue ?? [],
		values: partial.values ?? {},
		hassDevices: partial.hassDevices ?? {},
		deviceClass: partial.deviceClass ?? {
			basic: 0,
			generic: 0,
			specific: 0,
		},
		endpoints: partial.endpoints ?? [],
		...partial,
	} as ZUINode
}

/**
 * Registers a valueId on `node.values` (keyed as `Gateway` expects) and
 * returns the value-map key to pass to `gw.discoverValue(node, key)`.
 */
export function addValue(node: ZUINode, valueId: ZUIValueId): string {
	const key = valueMapKey(valueId)
	const values = requireDefined(
		node.values,
		`Expected node ${node.id} to have a values map`,
	)
	values[key] = valueId
	return key
}

/**
 * Minimal `ZwaveClient` fake for the `Gateway`'s `zwave` collaborator. It's a
 * real `EventEmitter`, so `Gateway.start()` wires its listeners and tests can
 * drive genuine producer events (`emit('nodeInited', node)`). Discovery reads
 * `homeHex` and `nodes`; the methods are `vi.fn()`s so tests can assert call
 * arguments without a real client.
 */
export type FakeGatewayZwave = EventEmitter & {
	homeHex: string
	nodes: Map<number, ZUINode>
	updateDevice: ReturnType<typeof vi.fn>
	addDevice: ReturnType<typeof vi.fn>
	storeDevices: ReturnType<typeof vi.fn>
	emitNodeUpdate: ReturnType<typeof vi.fn>
	getNode: ReturnType<typeof vi.fn>
	connect: ReturnType<typeof vi.fn>
	setPollInterval: ReturnType<typeof vi.fn>
	writeValue: ReturnType<typeof vi.fn>
	writeBroadcast: ReturnType<typeof vi.fn>
	writeMulticast: ReturnType<typeof vi.fn>
	callApi: ReturnType<typeof vi.fn>
	driverFunction: ReturnType<typeof vi.fn>
	/** Real `Gateway.close()` awaits `zwave.close()` before closing MQTT. */
	close: Mock<GatewayZwave['close']>
}

export function createFakeGatewayZwave(
	overrides: Partial<FakeGatewayZwave> = {},
): FakeGatewayZwave {
	const emitter = new EventEmitter()
	return Object.assign(emitter, {
		homeHex: '0xabcdef01',
		nodes: new Map<number, ZUINode>(),
		updateDevice: vi.fn(),
		addDevice: vi.fn(),
		storeDevices: vi.fn(() =>
			Promise.resolve({
				status: 'stored',
			} satisfies StoreHassDevicesResult),
		),
		emitNodeUpdate: vi.fn(),
		getNode: vi.fn(() => undefined),
		connect: vi.fn(() => Promise.resolve(undefined)),
		setPollInterval: vi.fn(),
		writeValue: vi.fn(() => Promise.resolve(undefined)),
		writeBroadcast: vi.fn(() => Promise.resolve(undefined)),
		writeMulticast: vi.fn(() => Promise.resolve(undefined)),
		callApi: vi.fn(() =>
			Promise.resolve({ success: true, message: 'ok', result: [] }),
		),
		driverFunction: vi.fn(() => Promise.resolve(undefined)),
		close: vi.fn<GatewayZwave['close']>(() => Promise.resolve(undefined)),
		...overrides,
	})
}

/** Deep-clones a captured discovery payload for stable snapshot assertions. */
export function clonePayload(
	device: HassDevice,
): HassDevice['discovery_payload'] {
	return JSON.parse(JSON.stringify(device.discovery_payload))
}
