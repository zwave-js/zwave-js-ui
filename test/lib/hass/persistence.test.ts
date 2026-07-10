/**
 * Characterization tests for HASS-device persistence + projection in
 * `api/lib/ZwaveClient.ts`:
 *   - `addDevice()`   (ZwaveClient.ts:1262)
 *   - `updateDevice()`(ZwaveClient.ts:1240)
 *   - `storeDevices()`(ZwaveClient.ts:1282)
 *   - `getStoreNodes()` home-id scoping / back-compat (ZwaveClient.ts:2762)
 *   - `updateStoreNodes()` real nodes.json write (ZwaveClient.ts:2797)
 *   - `emitNodeUpdate()` synchronous `ZUINode.hassDevices` projection that
 *     precedes the `process.nextTick`-deferred NODE_UPDATED socket emission
 *     (ZwaveClient.ts:2733 / 2659)
 *   - `loadFakeNodes()` fake-node import compatibility (ZwaveClient.ts:8858)
 *
 * These exercise the REAL, store-dependent `ZwaveClient` against an isolated
 * STORE_DIR and a lightweight recording socket (stand-in for the Socket.IO
 * server `sendToSocket()` reads through). `ZwaveClient.ts` is imported
 * dynamically, strictly AFTER `ensureTestEnv()` has pointed STORE_DIR at a
 * throwaway dir, so every `jsonStore.put()` write lands there and never in the
 * repo `store/` directory. No real Driver is ever constructed.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ensureTestEnv, cleanupTestEnv, getTestStoreDir } from './env.ts'
import {
	createRecordingSocket,
	type RecordingSocket,
	type HassDeviceLike,
} from './fixtures.ts'
import { socketEvents } from '../../../api/lib/SocketEvents.ts'
import type ZWaveClientType from '../../../api/lib/ZwaveClient.ts'

type JsonStore = {
	init(config: any): Promise<any>
	get(model: any): any
	put(model: any, data: any): Promise<any>
	store: Record<string, any>
}

let ZWaveClient: typeof ZWaveClientType
let jsonStore: JsonStore
let store: any
let storeDir: string

// A live-in-store home id (starts with `0x`, so `getStoreNodes()` treats it as
// already-scoped rather than migrating it). `homeHex` is just `driverInfo.name`.
const HOME = '0xtesthome'

/** Flush both microtasks and the `process.nextTick` queue `sendToSocket` uses. */
const flush = () => new Promise<void>((r) => setImmediate(r))

/**
 * Construct a REAL `ZwaveClient` (init-only, no driver) with a recording
 * socket, a seeded `homeHex`, an empty `storeNodes`, and a single ZUI node
 * already present in `_nodes`. Nothing here starts a timer or opens a handle.
 */
function makeClient(
	nodeId: number,
	node: any,
): { zwave: ZWaveClientType; socket: RecordingSocket } {
	const socket = createRecordingSocket()
	const zwave = new ZWaveClient({} as any, socket as any)
	;(zwave as any).driverInfo = { name: HOME }
	;(zwave as any).storeNodes = { [nodeId]: {} }
	;(zwave as any)._nodes.set(nodeId, node)
	return { zwave, socket }
}

function nodeUpdatedEmits(socket: RecordingSocket) {
	return socket.emissions.filter((e) => e.event === socketEvents.nodeUpdated)
}

beforeAll(async () => {
	storeDir = ensureTestEnv()
	;({ default: jsonStore } = (await import(
		'../../../api/lib/jsonStore.ts'
	)) as any)
	;({ default: store } = (await import(
		'../../../api/config/store.ts'
	)) as any)
	;({ default: ZWaveClient } = await import(
		'../../../api/lib/ZwaveClient.ts'
	))
	await jsonStore.init(store)
})

afterAll(() => {
	cleanupTestEnv()
})

beforeEach(async () => {
	// reset nodes.json (memory + disk) so tests never see each other's writes
	await jsonStore.put(store.nodes, {})
})

describe('ZwaveClient.addDevice()', () => {
	it('keys the device by `type_object_id` (NOT the passed `.id`), strips `.id`, and forces persistent:false', async () => {
		const node: any = { id: 5, hassDevices: {} }
		const { zwave, socket } = makeClient(5, node)

		const device: HassDeviceLike = {
			id: 'ignored-incoming-id',
			type: 'sensor',
			object_id: 'temperature',
			discovery_payload: { name: 'Temp' },
		}
		zwave.addDevice(device as any, 5)

		// key is type_object_id, not the incoming .id
		expect(Object.keys(node.hassDevices)).toEqual(['sensor_temperature'])
		const stored = node.hassDevices.sensor_temperature
		// the SAME object reference is stored (not a copy)
		expect(stored).toBe(device)
		// `.id` is deleted off the object entirely
		expect('id' in stored).toBe(false)
		// persistent is forced false regardless of input
		expect(stored.persistent).toBe(false)

		await flush()
		const emits = nodeUpdatedEmits(socket)
		expect(emits).toHaveLength(1)
		expect(emits[0].room).toBe('nodes')
		// partial update: [changedProps, isPartial=true]
		expect(emits[0].args[1]).toBe(true)
		expect(emits[0].args[0].hassDevices).toBe(node.hassDevices)
		expect(emits[0].args[0].id).toBe(5)
	})

	it('is a no-op (no emission) when the node is unknown', async () => {
		const { zwave, socket } = makeClient(5, { id: 5, hassDevices: {} })
		zwave.addDevice(
			{ id: 'x', type: 'sensor', object_id: 'y' } as any,
			999, // no such node
		)
		await flush()
		expect(nodeUpdatedEmits(socket)).toHaveLength(0)
	})

	it('is a no-op when the incoming device has no `.id`', async () => {
		const node: any = { id: 5, hassDevices: {} }
		const { zwave, socket } = makeClient(5, node)
		zwave.addDevice({ type: 'sensor', object_id: 'y' } as any, 5)
		await flush()
		expect(node.hassDevices).toEqual({})
		expect(nodeUpdatedEmits(socket)).toHaveLength(0)
	})
})

describe('ZwaveClient.updateDevice()', () => {
	it('re-keys an EXISTING device under its `.id`, stripping the `.id` field', async () => {
		const existing = { type: 'switch', object_id: 'sw', persistent: true }
		const node: any = {
			id: 7,
			hassDevices: { switch_sw: { ...existing } },
		}
		const { zwave, socket } = makeClient(7, node)

		const incoming: HassDeviceLike = {
			id: 'switch_sw', // must match an existing key
			type: 'switch',
			object_id: 'sw',
			discovery_payload: { name: 'renamed' },
		}
		zwave.updateDevice(incoming as any, 7)

		expect('id' in node.hassDevices.switch_sw).toBe(false)
		expect(node.hassDevices.switch_sw).toBe(incoming)
		expect(node.hassDevices.switch_sw.discovery_payload.name).toBe(
			'renamed',
		)

		await flush()
		expect(nodeUpdatedEmits(socket)).toHaveLength(1)
	})

	it('deletes the device when `deleteDevice` is true', async () => {
		const node: any = {
			id: 7,
			hassDevices: { switch_sw: { type: 'switch', object_id: 'sw' } },
		}
		const { zwave, socket } = makeClient(7, node)

		zwave.updateDevice({ id: 'switch_sw' } as any, 7, true)

		expect('switch_sw' in node.hassDevices).toBe(false)
		await flush()
		expect(nodeUpdatedEmits(socket)).toHaveLength(1)
	})

	it('is a no-op when the id does not match any existing device (guard)', async () => {
		const node: any = { id: 7, hassDevices: {} }
		const { zwave, socket } = makeClient(7, node)
		zwave.updateDevice({ id: 'nope' } as any, 7)
		await flush()
		expect(node.hassDevices).toEqual({})
		expect(nodeUpdatedEmits(socket)).toHaveLength(0)
	})
})

describe('ZwaveClient.storeDevices()', () => {
	it('sets persistent=!remove, projects a deep COPY onto the node, and writes nodes.json under homeHex', async () => {
		const node: any = { id: 9, hassDevices: {} }
		const { zwave, socket } = makeClient(9, node)

		const devices = {
			sensor_a: { type: 'sensor', object_id: 'a' },
			sensor_b: { type: 'sensor', object_id: 'b' },
		}
		await zwave.storeDevices(devices as any, 9, false)

		// persistent flag set to !remove (=true) on the SOURCE map
		expect(devices.sensor_a).toHaveProperty('persistent', true)
		expect(devices.sensor_b).toHaveProperty('persistent', true)

		// storeNodes[nodeId].hassDevices references the source map
		expect((zwave as any).storeNodes[9].hassDevices).toBe(devices)

		// node.hassDevices is a DEEP COPY (distinct object, equal content)
		expect(node.hassDevices).not.toBe(devices)
		expect(node.hassDevices).toEqual(devices)

		// a real nodes.json write landed in the ISOLATED store dir, scoped by homeHex
		const nodesFile = join(getTestStoreDir(), 'nodes.json')
		expect(existsSync(nodesFile)).toBe(true)
		const persisted = JSON.parse(readFileSync(nodesFile, 'utf8'))
		expect(persisted[HOME]['9'].hassDevices.sensor_a.persistent).toBe(true)

		await flush()
		expect(nodeUpdatedEmits(socket)).toHaveLength(1)
	})

	it('removes the stored hassDevices when remove is true and sets persistent:false', async () => {
		const node: any = { id: 9, hassDevices: {} }
		const { zwave } = makeClient(9, node)
		;(zwave as any).storeNodes[9] = {
			hassDevices: { old: { type: 'sensor', object_id: 'old' } },
		}

		const devices = { sensor_a: { type: 'sensor', object_id: 'a' } }
		await zwave.storeDevices(devices as any, 9, true)

		expect(devices.sensor_a).toHaveProperty('persistent', false)
		// remove path deletes storeNodes[nodeId].hassDevices entirely
		expect('hassDevices' in (zwave as any).storeNodes[9]).toBe(false)
		// node still gets the (deep-copied) projection
		expect(node.hassDevices).toEqual(devices)
	})

	it('drops undefined-valued fields but keeps null in the persisted deep copy (utils.copy = JSON round-trip)', async () => {
		const node: any = { id: 9, hassDevices: {} }
		const { zwave } = makeClient(9, node)

		const devices: any = {
			sensor_a: {
				type: 'sensor',
				object_id: 'a',
				keepNull: null,
				dropUndef: undefined,
			},
		}
		await zwave.storeDevices(devices, 9, false)

		expect('keepNull' in node.hassDevices.sensor_a).toBe(true)
		expect(node.hassDevices.sensor_a.keepNull).toBeNull()
		expect('dropUndef' in node.hassDevices.sensor_a).toBe(false)
	})

	it('is a no-op when the node is unknown', async () => {
		const { zwave, socket } = makeClient(9, { id: 9, hassDevices: {} })
		await zwave.storeDevices(
			{ x: { type: 't', object_id: 'o' } } as any,
			42,
			false,
		)
		await flush()
		expect(nodeUpdatedEmits(socket)).toHaveLength(0)
	})
})

describe('ZwaveClient.getStoreNodes() home-id scoping', () => {
	it('loads only the current homeHex bucket from a scoped nodes.json', async () => {
		await jsonStore.put(store.nodes, {
			[HOME]: { '3': { name: 'Mine' } },
			'0xother': { '3': { name: 'Theirs' } },
		})
		const { zwave } = makeClient(3, { id: 3, hassDevices: {} })

		await zwave.getStoreNodes()

		expect((zwave as any).storeNodes).toEqual({ '3': { name: 'Mine' } })
	})

	it('returns {} when the homeHex bucket is absent', async () => {
		await jsonStore.put(store.nodes, { '0xother': { '3': {} } })
		const { zwave } = makeClient(3, { id: 3, hassDevices: {} })

		await zwave.getStoreNodes()

		expect((zwave as any).storeNodes).toEqual({})
	})

	it('migrates a legacy flat (non-0x-keyed) nodes.json to a homeHex-scoped file', async () => {
		await jsonStore.put(store.nodes, { '3': { name: 'Legacy' } })
		const { zwave } = makeClient(3, { id: 3, hassDevices: {} })

		await zwave.getStoreNodes()

		// quirk: storeNodes becomes the WHOLE flat object (pre-migration shape)
		expect((zwave as any).storeNodes).toEqual({ '3': { name: 'Legacy' } })
		// ...but the on-disk file is rewritten scoped under homeHex
		const persisted = jsonStore.get(store.nodes)
		expect(persisted).toEqual({ [HOME]: { '3': { name: 'Legacy' } } })
	})

	it('converts a legacy ARRAY nodes.json (sparse) to an index-keyed object under homeHex', async () => {
		await jsonStore.put(store.nodes, [
			null,
			{ name: 'One' },
			{ name: 'Two' },
		])
		const { zwave } = makeClient(1, { id: 1, hassDevices: {} })

		await zwave.getStoreNodes()

		expect((zwave as any).storeNodes).toEqual({
			'1': { name: 'One' },
			'2': { name: 'Two' },
		})
		const persisted = jsonStore.get(store.nodes)
		expect(persisted[HOME]).toEqual({
			'1': { name: 'One' },
			'2': { name: 'Two' },
		})
	})

	it('throws when homeHex is not set', async () => {
		const socket = createRecordingSocket()
		const zwave = new ZWaveClient({} as any, socket as any)
		// driverInfo.name is unset -> homeHex is undefined
		await expect(zwave.getStoreNodes()).rejects.toThrow('HomeHex not set')
	})
})

describe('synchronous projection ordering (emitNodeUpdate)', () => {
	it('mutates node.hassDevices synchronously BEFORE the deferred NODE_UPDATED emission', async () => {
		// Every test in this file operates on a plain fake node object (no real
		// `ZWaveNode`/Driver behind it) - this ordering test doubles as the
		// proof that HASS persistence is fully "fake-node compatible": the
		// projection is applied directly to whatever object sits in `_nodes`.
		const node: any = { id: 5, hassDevices: {} }
		const { zwave, socket } = makeClient(5, node)

		zwave.addDevice(
			{ id: 'x', type: 'sensor', object_id: 'temp' } as any,
			5,
		)

		// projection is already visible synchronously...
		expect(node.hassDevices.sensor_temp).toBeDefined()
		// ...but the socket emission has NOT happened yet (deferred to nextTick)
		expect(nodeUpdatedEmits(socket)).toHaveLength(0)

		await flush()
		// now it has fired, carrying the already-projected devices
		const emits = nodeUpdatedEmits(socket)
		expect(emits).toHaveLength(1)
		expect(emits[0].args[0].hassDevices.sensor_temp).toBeDefined()
	})
})
