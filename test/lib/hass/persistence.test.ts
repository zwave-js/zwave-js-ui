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
import { ensureTestEnv, cleanupTestEnv, getTestStoreDir } from './env.ts'
import { createRecordingSocket, type RecordingSocket } from './fixtures.ts'
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
 * Narrow view of the two internals the Driver would normally own: the home id
 * (driverInfo) that has no public setter, and the store projection cache that
 * has no public getter. Used only to seed the home id and to read the load
 * target where no observable file rewrite happens.
 */
type ClientInternals = {
	driverInfo: ZUIDriverInfo
	storeNodes: Record<number, Partial<ZUINode>>
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
function newInitClient(home: string | undefined = HOME): {
	zwave: ZWaveClientType
	socket: RecordingSocket
} {
	const socket = createRecordingSocket()
	const zwave = new ZWaveClient({} as any, socket as any)
	if (home !== undefined) {
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
	node: Partial<ZUINode>,
): { zwave: ZWaveClientType; socket: RecordingSocket } {
	const { zwave, socket } = newInitClient()
	zwave.nodes.set(nodeId, node as ZUINode)
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
	node: Partial<ZUINode>,
	seedBucket: Record<string, any> = { [nodeId]: {} },
): Promise<{ zwave: ZWaveClientType; socket: RecordingSocket }> {
	await jsonStore.put(store.nodes, { [HOME]: seedBucket })
	const { zwave, socket } = newInitClient()
	await zwave.getStoreNodes()
	zwave.nodes.set(nodeId, node as ZUINode)
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
		const node: any = { id: 5, hassDevices: {} }
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
		const { zwave, socket } = makeMutatorClient(5, {
			id: 5,
			hassDevices: {},
		})
		zwave.addDevice(
			{ id: 'x', type: 'sensor', object_id: 'y', discovery_payload: {} },
			999, // no such node
		)
		await flush()
		expect(nodeUpdatedEmits(socket)).toHaveLength(0)
	})

	it('does nothing when the incoming device has no id', async () => {
		const node: any = { id: 5, hassDevices: {} }
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
		const existing = { type: 'switch', object_id: 'sw', persistent: true }
		const node: any = {
			id: 7,
			hassDevices: { switch_sw: { ...existing } },
		}
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
		const node: any = {
			id: 7,
			hassDevices: { switch_sw: { type: 'switch', object_id: 'sw' } },
		}
		const { zwave, socket } = makeMutatorClient(7, node)

		zwave.updateDevice({ id: 'switch_sw' } as any, 7, true)

		expect('switch_sw' in node.hassDevices).toBe(false)
		await flush()
		expect(nodeUpdatedEmits(socket)).toHaveLength(1)
	})

	it('does nothing when the id matches no existing device', async () => {
		const node: any = { id: 7, hassDevices: {} }
		const { zwave, socket } = makeMutatorClient(7, node)
		zwave.updateDevice({ id: 'nope' } as any, 7)
		await flush()
		expect(node.hassDevices).toEqual({})
		expect(nodeUpdatedEmits(socket)).toHaveLength(0)
	})
})

describe('persisting HASS devices for a node', () => {
	it('marks devices persistent, projects a copy onto the node, and persists them under the home id', async () => {
		const node: any = { id: 9, hassDevices: {} }
		const { zwave, socket } = await makeLoadedClient(9, node)

		const devices = {
			sensor_a: { type: 'sensor', object_id: 'a' },
			sensor_b: { type: 'sensor', object_id: 'b' },
		}
		await zwave.storeDevices(devices as any, 9, false)

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
		const node: any = { id: 9, hassDevices: {} }
		// Seed and load a real persisted device so the remove path clears a
		// genuinely loaded entry
		const { zwave } = await makeLoadedClient(9, node, {
			9: { hassDevices: { old: { type: 'sensor', object_id: 'old' } } },
		})

		const devices = { sensor_a: { type: 'sensor', object_id: 'a' } }
		await zwave.storeDevices(devices as any, 9, true)

		expect(devices.sensor_a).toHaveProperty('persistent', false)
		expect(node.hassDevices).toEqual(devices)
		// Removal leaves nothing to persist, so the node drops out of the file
		const persisted = jsonStore.get(store.nodes)
		expect(persisted[HOME]['9']).toBeUndefined()
	})

	it('keeps null but drops undefined-valued fields in the persisted copy', async () => {
		const node: any = { id: 9, hassDevices: {} }
		const { zwave } = await makeLoadedClient(9, node)

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

	it('does nothing when the node is unknown', async () => {
		const { zwave, socket } = await makeLoadedClient(9, {
			id: 9,
			hassDevices: {},
		})
		await zwave.storeDevices(
			{ x: { type: 't', object_id: 'o' } } as any,
			42,
			false,
		)
		await flush()
		expect(nodeUpdatedEmits(socket)).toHaveLength(0)
	})

	it('replaces persisted devices under the home id and preserves the node name', async () => {
		const node: any = { id: 11, hassDevices: {} }
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
		await zwave.storeDevices(devices as any, 11, false)

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

		expect(internals(zwave).storeNodes).toEqual({ '3': { name: 'Mine' } })
	})

	it('loads nothing when the current home is absent', async () => {
		await jsonStore.put(store.nodes, { '0xother': { '3': {} } })
		const { zwave } = newInitClient()

		await zwave.getStoreNodes()

		expect(internals(zwave).storeNodes).toEqual({})
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
		const socket = createRecordingSocket()
		const zwave = new ZWaveClient({} as any, socket as any)
		// With no home id, the load refuses to run against an undefined home.
		// Assert the rejection contract without pinning the message text.
		await expect(zwave.getStoreNodes()).rejects.toThrow()
	})
})

describe('node update projection ordering', () => {
	it('applies the device to the node synchronously before the deferred node update', async () => {
		// The projection is applied directly to the live node object
		const node: any = { id: 5, hassDevices: {} }
		const { zwave, socket } = makeMutatorClient(5, node)

		zwave.addDevice(
			{ id: 'x', type: 'sensor', object_id: 'temp' } as any,
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
