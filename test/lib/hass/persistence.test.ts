/**
 * Characterizes HASS-device persistence and projection: adding, updating, and
 * storing a node's hassDevices, home-id scoping of the persisted nodes file,
 * and the synchronous node projection that precedes the nextTick-deferred node
 * update emission.
 *
 * Tests drive the real store-backed client against an isolated STORE_DIR with a
 * recording socket, so every write lands in a throwaway dir, never the repo
 * store/. No real Driver is constructed; the home id and live nodes are seeded
 * at the injection boundary the Driver would otherwise supply.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Server as SocketServer } from 'socket.io'
import { ensureTestEnv, cleanupTestEnv, getTestStoreDir } from './env.ts'
import {
	buildNode,
	createRecordingSocket,
	type RecordingSocket,
} from './fixtures.ts'
import { socketEvents } from '#api/lib/SocketEvents.ts'
import type ZWaveClientType from '#api/lib/ZwaveClient.ts'
import type {
	HassDevice,
	ZUINode,
	ZUIDriverInfo,
} from '#api/lib/ZwaveClient.ts'
import type * as JsonStoreModuleNamespace from '#api/lib/jsonStore.ts'
import type * as StoreConfigModuleNamespace from '#api/config/store.ts'

type JsonStoreModule = typeof JsonStoreModuleNamespace
type StoreConfigModule = typeof StoreConfigModuleNamespace

/**
 * Narrow view of the home id the Driver would normally own. It has no public
 * setter and is seeded only at the driver-less construction boundary.
 */
type ClientInternals = {
	driverInfo: ZUIDriverInfo
}
const internals = (zwave: ZWaveClientType) =>
	zwave as unknown as ClientInternals

let ZWaveClient: typeof ZWaveClientType
let jsonStore: JsonStoreModule['default']
let store: StoreConfigModule['default']
let storeDir: string

// A live-in-store home id: the 0x prefix makes getStoreNodes() treat it as
// already-scoped rather than migrating it
const HOME = '0xtesthome'

/** Flush microtasks and the process.nextTick queue sendToSocket defers through. */
const flush = () => new Promise<void>((r) => setImmediate(r))

/**
 * Real init-only client (no Driver) with a recording socket and the home id
 * seeded so homeHex resolves; callers choose the load path or direct node seed.
 */
function newInitClient(home: string | null = HOME): {
	zwave: ZWaveClientType
	socket: RecordingSocket
} {
	const socket = createRecordingSocket()
	const zwave = new ZWaveClient({}, socket as unknown as SocketServer)
	if (home !== null) {
		// homeHex derives from the driver-supplied home id and has no public
		// setter; seed it at the injection boundary since these tests run
		// without a real Driver by design
		internals(zwave).driverInfo = { name: home }
	}
	return { zwave, socket }
}

/**
 * In-memory fixture for the add/update/projection paths, which read and mutate
 * only the live node. The node is registered through the public nodes map.
 */
function makeMutatorClient(
	nodeId: number,
	node: ZUINode,
): { zwave: ZWaveClientType; socket: RecordingSocket } {
	const { zwave, socket } = newInitClient()
	zwave.nodes.set(nodeId, node)
	return { zwave, socket }
}

/**
 * Real-load fixture: seeds a home-scoped nodes.json, then fills the store
 * projection through the production getStoreNodes() loader. The live node is
 * registered through the public nodes map, since building it for real needs a
 * Driver.controller this init-only client omits.
 */
async function makeLoadedClient(
	nodeId: number,
	node: ZUINode,
	seedBucket: Record<string, Record<string, unknown>> = { [nodeId]: {} },
): Promise<{ zwave: ZWaveClientType; socket: RecordingSocket }> {
	await jsonStore.put(store.nodes, { [HOME]: seedBucket })
	const { zwave, socket } = newInitClient()
	await zwave.getStoreNodes()
	zwave.nodes.set(nodeId, node)
	return { zwave, socket }
}

function nodeUpdatedEmits(socket: RecordingSocket) {
	return socket.emissions.filter((e) => e.event === socketEvents.nodeUpdated)
}

beforeAll(async () => {
	storeDir = ensureTestEnv()
	;({ default: jsonStore } = await import('#api/lib/jsonStore.ts'))
	;({ default: store } = await import('#api/config/store.ts'))
	;({ default: ZWaveClient } = await import('#api/lib/ZwaveClient.ts'))
	await jsonStore.init(store)
})

afterAll(() => {
	cleanupTestEnv()
})

beforeEach(async () => {
	// Reset nodes.json (memory + disk) so tests never see each other's writes
	await jsonStore.put(store.nodes, {})
})

describe('adding a HASS device to a node', () => {
	it('keys an added device by type_object_id, drops the incoming id, and marks it non-persistent', async () => {
		const node = buildNode({ id: 5 })
		const { zwave, socket } = makeMutatorClient(5, node)

		const device: HassDevice = {
			id: 'ignored-incoming-id',
			type: 'sensor',
			object_id: 'temperature',
			discovery_payload: { name: 'Temp' },
		}
		zwave.addDevice(device, 5)

		expect(Object.keys(node.hassDevices)).toEqual(['sensor_temperature'])
		const stored = node.hassDevices.sensor_temperature
		expect(stored).toBe(device)
		expect('id' in stored).toBe(false)
		expect(stored.persistent).toBe(false)

		await flush()
		const emits = nodeUpdatedEmits(socket)
		expect(emits).toHaveLength(1)
		expect(emits[0].room).toBe('nodes')
		// Emission carries the changed props and a partial-update flag
		expect(emits[0].args[1]).toBe(true)
		expect(emits[0].args[0].hassDevices).toBe(node.hassDevices)
		expect(emits[0].args[0].id).toBe(5)
	})

	it('does nothing when the node is unknown', async () => {
		const { zwave, socket } = makeMutatorClient(5, buildNode({ id: 5 }))
		zwave.addDevice(
			{ id: 'x', type: 'sensor', object_id: 'y', discovery_payload: {} },
			999, // no such node
		)
		await flush()
		expect(nodeUpdatedEmits(socket)).toHaveLength(0)
	})

	it('does nothing when the incoming device has no id', async () => {
		const node = buildNode({ id: 5 })
		const { zwave, socket } = makeMutatorClient(5, node)
		zwave.addDevice(
			{ type: 'sensor', object_id: 'y', discovery_payload: {} },
			5,
		)
		await flush()
		expect(node.hassDevices).toEqual({})
		expect(nodeUpdatedEmits(socket)).toHaveLength(0)
	})
})

describe('updating a HASS device on a node', () => {
	it('re-keys an existing device under its id and drops the id field', async () => {
		const existing: HassDevice = {
			type: 'switch',
			object_id: 'sw',
			discovery_payload: {},
			persistent: true,
		}
		const node = buildNode({
			id: 7,
			hassDevices: { switch_sw: { ...existing } },
		})
		const { zwave, socket } = makeMutatorClient(7, node)

		const incoming: HassDevice = {
			id: 'switch_sw', // must match an existing key
			type: 'switch',
			object_id: 'sw',
			discovery_payload: { name: 'renamed' },
		}
		zwave.updateDevice(incoming, 7)

		expect('id' in node.hassDevices.switch_sw).toBe(false)
		expect(node.hassDevices.switch_sw).toBe(incoming)
		expect(node.hassDevices.switch_sw.discovery_payload.name).toBe(
			'renamed',
		)

		await flush()
		expect(nodeUpdatedEmits(socket)).toHaveLength(1)
	})

	it('deletes the device when deleteDevice is set', async () => {
		const node = buildNode({
			id: 7,
			hassDevices: {
				switch_sw: {
					type: 'switch',
					object_id: 'sw',
					discovery_payload: {},
				},
			},
		})
		const { zwave, socket } = makeMutatorClient(7, node)

		zwave.updateDevice(
			{ id: 'switch_sw' } as unknown as HassDevice,
			7,
			true,
		)

		expect('switch_sw' in node.hassDevices).toBe(false)
		await flush()
		expect(nodeUpdatedEmits(socket)).toHaveLength(1)
	})

	it('does nothing when the id matches no existing device', async () => {
		const node = buildNode({ id: 7 })
		const { zwave, socket } = makeMutatorClient(7, node)
		zwave.updateDevice({ id: 'nope' } as unknown as HassDevice, 7)
		await flush()
		expect(node.hassDevices).toEqual({})
		expect(nodeUpdatedEmits(socket)).toHaveLength(0)
	})
})

describe('persisting HASS devices for a node', () => {
	it('marks devices persistent, projects a copy onto the node, and persists them under the home id', async () => {
		const node = buildNode({ id: 9 })
		const { zwave, socket } = await makeLoadedClient(9, node)

		const devices = {
			sensor_a: { type: 'sensor', object_id: 'a' },
			sensor_b: { type: 'sensor', object_id: 'b' },
		}
		await zwave.storeDevices(
			devices as unknown as Record<string, HassDevice>,
			9,
			false,
		)

		expect(devices.sensor_a).toHaveProperty('persistent', true)
		expect(devices.sensor_b).toHaveProperty('persistent', true)

		// The node receives a copy, not the caller's object
		expect(node.hassDevices).not.toBe(devices)
		expect(node.hassDevices).toEqual(devices)

		const nodesFile = join(getTestStoreDir(), 'nodes.json')
		expect(existsSync(nodesFile)).toBe(true)
		const persisted = JSON.parse(readFileSync(nodesFile, 'utf8'))
		expect(persisted[HOME]['9'].hassDevices.sensor_a.persistent).toBe(true)

		await flush()
		expect(nodeUpdatedEmits(socket)).toHaveLength(1)
	})

	it('removes the stored devices under the home id and marks them non-persistent', async () => {
		const node = buildNode({ id: 9 })
		// Seed and load a real persisted device so the remove path clears a
		// genuinely loaded entry
		const { zwave } = await makeLoadedClient(9, node, {
			9: { hassDevices: { old: { type: 'sensor', object_id: 'old' } } },
		})

		const devices = { sensor_a: { type: 'sensor', object_id: 'a' } }
		await zwave.storeDevices(
			devices as unknown as Record<string, HassDevice>,
			9,
			true,
		)

		expect(devices.sensor_a).toHaveProperty('persistent', false)
		expect(node.hassDevices).toEqual(devices)
		// Removal leaves nothing to persist, so the node drops out of the file
		const persisted = jsonStore.get(store.nodes)
		expect(persisted[HOME]['9']).toBeUndefined()
	})

	it('keeps null but drops undefined-valued fields in the persisted copy', async () => {
		const node = buildNode({ id: 9 })
		const { zwave } = await makeLoadedClient(9, node)

		const devices: Record<
			string,
			HassDevice & { keepNull: null; dropUndef?: undefined }
		> = {
			sensor_a: {
				type: 'sensor',
				object_id: 'a',
				discovery_payload: {},
				keepNull: null,
				dropUndef: undefined,
			},
		}
		await zwave.storeDevices(devices, 9, false)

		expect('keepNull' in node.hassDevices.sensor_a).toBe(true)
		expect(node.hassDevices.sensor_a.keepNull).toBeNull()
		expect('dropUndef' in node.hassDevices.sensor_a).toBe(false)
	})

	it('does nothing when the node is unknown', async () => {
		const { zwave, socket } = await makeLoadedClient(
			9,
			buildNode({ id: 9 }),
		)
		await zwave.storeDevices(
			{ x: { type: 't', object_id: 'o' } } as unknown as Record<
				string,
				HassDevice
			>,
			42,
			false,
		)
		await flush()
		expect(nodeUpdatedEmits(socket)).toHaveLength(0)
	})

	it('replaces persisted devices under the home id and preserves the node name', async () => {
		const node = buildNode({ id: 11 })
		const { zwave } = await makeLoadedClient(11, node, {
			11: {
				name: 'Kitchen',
				hassDevices: {
					sensor_old: {
						type: 'sensor',
						object_id: 'old',
						persistent: true,
					},
				},
			},
		})

		const devices = { climate_x: { type: 'climate', object_id: 'x' } }
		await zwave.storeDevices(
			devices as unknown as Record<string, HassDevice>,
			11,
			false,
		)

		expect(node.hassDevices.climate_x.persistent).toBe(true)

		// storeDevices replaces rather than merges: the new set lands under the
		// home id, the node name survives, the old device is gone
		const persisted = jsonStore.get(store.nodes)
		expect(persisted[HOME]['11'].name).toBe('Kitchen')
		expect(persisted[HOME]['11'].hassDevices.climate_x.persistent).toBe(
			true,
		)
		expect(persisted[HOME]['11'].hassDevices.sensor_old).toBeUndefined()
	})
})

describe('home-id scoping of persisted nodes', () => {
	it('loads only the current home from a multi-home file', async () => {
		await jsonStore.put(store.nodes, {
			[HOME]: { '3': { name: 'Mine' } },
			'0xother': { '3': { name: 'Theirs' } },
		})
		const { zwave } = newInitClient()

		await zwave.getStoreNodes()
		await zwave.updateStoreNodes()

		expect(jsonStore.get(store.nodes)).toEqual({
			[HOME]: { '3': { name: 'Mine' } },
			'0xother': { '3': { name: 'Theirs' } },
		})
	})

	it('loads nothing when the current home is absent', async () => {
		await jsonStore.put(store.nodes, { '0xother': { '3': {} } })
		const { zwave } = newInitClient()

		await zwave.getStoreNodes()
		await zwave.updateStoreNodes()

		expect(jsonStore.get(store.nodes)).toEqual({
			'0xother': { '3': {} },
			[HOME]: {},
		})
	})

	it('migrates a legacy flat nodes.json to a home-scoped file', async () => {
		await jsonStore.put(store.nodes, { '3': { name: 'Legacy' } })
		const { zwave } = newInitClient()

		await zwave.getStoreNodes()

		// The on-disk file is rewritten scoped under the home id
		const persisted = jsonStore.get(store.nodes)
		expect(persisted).toEqual({ [HOME]: { '3': { name: 'Legacy' } } })
	})

	it('converts a legacy array nodes.json to an index-keyed object under the home id', async () => {
		await jsonStore.put(store.nodes, [
			null,
			{ name: 'One' },
			{ name: 'Two' },
		])
		const { zwave } = newInitClient()

		await zwave.getStoreNodes()

		const persisted = jsonStore.get(store.nodes)
		expect(persisted[HOME]).toEqual({
			'1': { name: 'One' },
			'2': { name: 'Two' },
		})
	})

	it('rejects when the home id is not set', async () => {
		const { zwave } = newInitClient(null)
		// With no home id, the load refuses to run against an undefined home.
		// Assert the rejection contract without pinning the message text.
		await expect(zwave.getStoreNodes()).rejects.toThrow()
	})

	it('preserved quirk: a malformed per-node entry (null instead of an object) crashes when storeDevices() removes hass devices', async () => {
		// Neither getStoreNodes/updateStoreNodes nor storeDevices validates per-node entry shape at runtime, so a corrupted nodes.json loads successfully but crashes downstream; fix owned by #4736
		const node: any = { id: 9, hassDevices: {} }
		const { zwave } = await makeLoadedClient(9, node, { 9: null })

		expect((zwave as any).storeNodes[9]).toBeNull()

		await expect(zwave.storeDevices({} as any, 9, true)).rejects.toThrow(
			TypeError,
		)
	})
})

describe('node update projection ordering', () => {
	it('applies the device to the node synchronously before the deferred node update', async () => {
		// The projection is applied directly to the live node object
		const node = buildNode({ id: 5 })
		const { zwave, socket } = makeMutatorClient(5, node)

		zwave.addDevice(
			{
				id: 'x',
				type: 'sensor',
				object_id: 'temp',
			} as unknown as HassDevice,
			5,
		)

		expect(node.hassDevices.sensor_temp).toBeDefined()
		// Emission is deferred to nextTick, so none yet despite the sync projection
		expect(nodeUpdatedEmits(socket)).toHaveLength(0)

		await flush()
		const emits = nodeUpdatedEmits(socket)
		expect(emits).toHaveLength(1)
		expect(emits[0].args[0].hassDevices.sensor_temp).toBeDefined()
	})
})
