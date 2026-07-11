/**
 * Typed, production-faithful fixtures for the HASS characterization suite:
 * Z-Wave node/valueId builders, a recording Socket.IO stand-in, a default
 * MQTT config, and a minimal `ZwaveClient` fake usable as the `Gateway`'s
 * `zwave` collaborator.
 *
 * These are deliberately plain builders (not deep clones of real driver
 * objects): `Gateway`'s discovery code only ever reads a well-defined subset
 * of `ZUINode`/`ZUIValueId` (device class, endpoints, values, command class,
 * property, states, ...), and TypeScript's structural typing lets a
 * shape-correct literal drive the real production switch without a real
 * `zwave-js` `Driver`/`Node` graph. Every builder returns a fresh object so
 * tests never share mutable state.
 */
import { vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type { MqttConfig } from '../../../api/lib/MqttClient.ts'
import type {
	HassDevice,
	ZUINode,
	ZUIValueId,
	ZUIValueIdState,
} from '../../../api/lib/ZwaveClient.ts'

/**
 * A complete `MqttConfig` with the network fully local/self-contained and
 * `store: false` (so `MqttClient._init` never touches the filesystem and
 * assigns `this.client` synchronously - see `mqttMock.ts`). `disabled` is
 * `false` so `Gateway.mqttEnabled` is `true`.
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
 * The minimal shape of a persisted HASS device as the `ZwaveClient`
 * persistence methods (`addDevice`/`updateDevice`/`storeDevices`) read/write
 * it. `id` is the transient wire-only key that those methods strip off before
 * storing; everything else is what actually lands in `node.hassDevices`.
 */
export interface HassDeviceLike {
	id?: string
	type?: string
	object_id?: string
	persistent?: boolean
	discovery_payload?: Record<string, any>
	discoveryTopic?: string
	values?: string[]
	[key: string]: any
}

/** One captured socket emission (broadcast or room-scoped). */
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
 * A stand-in for the Socket.IO server that `ZwaveClient.sendToSocket()` (and
 * `connect()`'s `fetchSockets()`) reads through. Records every emission so a
 * test can assert exactly what was broadcast, and to which room, and prove
 * ordering (e.g. that `node.hassDevices` is mutated synchronously BEFORE the
 * `nodeUpdated` emission that `sendToSocket` schedules on `process.nextTick`).
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

/** Convenience builder for a `ZUIValueIdState` (`{ text, value }`). */
export function state(
	value: number | string | boolean,
	text: string,
): ZUIValueIdState {
	return { value, text }
}

/**
 * The key `ZwaveClient` uses for a valueId inside `node.values` -
 * `<cc>-<endpoint>-<property>[-<propertyKey>]`, WITHOUT the node id
 * (`ZwaveClient._getValueID(valueId)` with `withNode = false`). This is the
 * exact `vId` string `Gateway.discoverValue(node, vId)` expects, and the one
 * pushed into `hassDevice.values` (which `setDiscovery`/delete then match
 * against `valueId.id`). Distinct from `valueId.id`, which is the SAME parts
 * but WITH the node id prefixed.
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
 * Builds a `ZUIValueId`. Only the members `Gateway`'s discovery code reads
 * have opinionated defaults; everything else is filled with inert values so
 * the object satisfies the type without influencing behavior.
 *
 * `id` is the production WITH-node id (`<nodeId>-<cc>-<endpoint>-<property>`),
 * used verbatim in the discovery `unique_id`. Register the value on a node
 * with `addValue()` (which keys `node.values` by the WITHOUT-node id, exactly
 * like `ZwaveClient`).
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
 * Builds a `ZUINode`. Defaults to a `ready`, physical node with empty
 * `values`/`hassDevices` and a generic device class, so discovery can run.
 * `endpoints` defaults to `[]` (so `node.endpoints[endpoint]?.deviceClass`
 * safely falls back to `node.deviceClass`, exactly as production does).
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
 * Registers a valueId on a node's `values` map (keyed by the same
 * `commandClass-endpoint-property[-propertyKey]` id Gateway expects) and
 * returns the value-map key, ready to pass to `gw.discoverValue(node, key)`.
 */
export function addValue(node: ZUINode, valueId: ZUIValueId): string {
	const key = valueMapKey(valueId)
	node.values[key] = valueId
	return key
}

/**
 * Minimal `ZwaveClient` fake for use as the `Gateway`'s `zwave`
 * collaborator. It is a real `EventEmitter` (so `Gateway.start()` wires its
 * listeners on it and tests can drive genuine producer events like
 * `emit('nodeInited', node)` / `emit('valueChanged', ...)` through the real
 * `Gateway` handlers). Discovery reads `homeHex` (for `unique_id`/
 * `identifiers`) and `nodes` (for `rediscoverNode`/`disableDiscovery`/
 * `rediscoverAll`), and routes `forceUpdate` publishes back through
 * `updateDevice`; the collaborator methods are `vi.fn()`s so tests can assert
 * exact call arguments. `emitNodeUpdate` is a spy too, so
 * `rediscoverNode`/`disableDiscovery` node-update emissions are observable
 * without a real client. `connect`/`setPollInterval` are spies so the real
 * `Gateway.start()` / `_onNodeInited` can run.
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
	/** Real `Gateway.close()` awaits `zwave.close()` before closing MQTT. */
	close: ReturnType<typeof vi.fn>
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
		storeDevices: vi.fn(() => Promise.resolve(undefined)),
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
		close: vi.fn(() => Promise.resolve(undefined)),
		...overrides,
	}) as FakeGatewayZwave
}

/** Deep-clones a captured discovery payload for stable snapshot assertions. */
export function clonePayload(device: HassDevice): Record<string, any> {
	return JSON.parse(JSON.stringify(device.discovery_payload))
}
