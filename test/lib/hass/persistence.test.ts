/**
 * Characterizes HASS-device persistence + projection in `api/lib/ZwaveClient.ts`
 * (addDevice/updateDevice/storeDevices, getStoreNodes home-id scoping,
 * updateStoreNodes write, and the synchronous emitNodeUpdate projection that
 * precedes the nextTick-deferred NODE_UPDATED emission).
 *
 * These drive the real store-dependent ZwaveClient against an isolated
 * STORE_DIR with a recording socket. ZwaveClient is imported dynamically after
 * ensureTestEnv() repoints STORE_DIR, so every jsonStore.put() lands in a
 * throwaway dir, never the repo store/. No real Driver is constructed.
 *
 * Fixture strategy: makeLoadedClient() seeds a home-scoped nodes.json and fills
 * storeNodes through the real getStoreNodes() loader; makeMutatorClient()
 * injects state directly and is used only for the in-memory
 * addDevice/updateDevice/emitNodeUpdate unit tests.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ensureTestEnv, cleanupTestEnv, getTestStoreDir } from './env.ts'
import { createRecordingSocket, type RecordingSocket } from './fixtures.ts'
import { socketEvents } from '#api/lib/SocketEvents.ts'
import type ZWaveClientType from '#api/lib/ZwaveClient.ts'
import type { HassDevice } from '#api/lib/ZwaveClient.ts'
import type * as JsonStoreModuleNamespace from '#api/lib/jsonStore.ts'
import type * as StoreConfigModuleNamespace from '#api/config/store.ts'

type JsonStoreModule = typeof JsonStoreModuleNamespace
type StoreConfigModule = typeof StoreConfigModuleNamespace

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
 * Real init-only ZwaveClient (no Driver) with a recording socket and
 * driverInfo.name set so homeHex resolves; callers choose load path vs
 * injection.
 */
function newInitClient(home: string | undefined = HOME): {
	zwave: ZWaveClientType
	socket: RecordingSocket
} {
	const socket = createRecordingSocket()
	const zwave = new ZWaveClient({} as any, socket as any)
	if (home !== undefined) {
		;(zwave as any).driverInfo = { name: home }
	}
	return { zwave, socket }
}

/**
 * Narrow mutator-unit fixture: injects storeNodes/_nodes directly, for the
 * addDevice/updateDevice/emitNodeUpdate in-memory unit tests only. Anything
 * exercising real persistence uses makeLoadedClient.
 */
function makeMutatorClient(
	nodeId: number,
	node: any,
): { zwave: ZWaveClientType; socket: RecordingSocket } {
	const { zwave, socket } = newInitClient()
	;(zwave as any).storeNodes = { [nodeId]: {} }
	;(zwave as any)._nodes.set(nodeId, node)
	return { zwave, socket }
}

/**
 * Real-load fixture: seeds a home-scoped nodes.json, then fills storeNodes via
 * the production getStoreNodes() loader (not assignment). The ZUINode is still
 * placed into _nodes directly - the one unavoidable injection, because
 * _createNode() needs a live Driver.controller this init-only client omits.
 */
async function makeLoadedClient(
	nodeId: number,
	node: any,
	seedBucket: Record<string, any> = { [nodeId]: {} },
): Promise<{ zwave: ZWaveClientType; socket: RecordingSocket }> {
	await jsonStore.put(store.nodes, { [HOME]: seedBucket })
	const { zwave, socket } = newInitClient()
	await zwave.getStoreNodes()
	;(zwave as any)._nodes.set(nodeId, node)
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

describe('ZwaveClient.addDevice()', () => {
	it('keys the device by `type_object_id` (NOT the passed `.id`), strips `.id`, and forces persistent:false', async () => {
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
		// args = [changedProps, isPartial=true]
		expect(emits[0].args[1]).toBe(true)
		expect(emits[0].args[0].hassDevices).toBe(node.hassDevices)
		expect(emits[0].args[0].id).toBe(5)
	})

	it('is a no-op (no emission) when the node is unknown', async () => {
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

	it('is a no-op when the incoming device has no `.id`', async () => {
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

describe('ZwaveClient.updateDevice()', () => {
	it('re-keys an EXISTING device under its `.id`, stripping the `.id` field', async () => {
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

	it('deletes the device when `deleteDevice` is true', async () => {
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

	it('is a no-op when the id does not match any existing device (guard)', async () => {
		const node: any = { id: 7, hassDevices: {} }
		const { zwave, socket } = makeMutatorClient(7, node)
		zwave.updateDevice({ id: 'nope' } as any, 7)
		await flush()
		expect(node.hassDevices).toEqual({})
		expect(nodeUpdatedEmits(socket)).toHaveLength(0)
	})
})

describe('ZwaveClient.storeDevices()', () => {
	it('sets persistent=!remove, projects a deep COPY onto the node, and writes nodes.json under homeHex', async () => {
		const node: any = { id: 9, hassDevices: {} }
		const { zwave, socket } = await makeLoadedClient(9, node)

		const devices = {
			sensor_a: { type: 'sensor', object_id: 'a' },
			sensor_b: { type: 'sensor', object_id: 'b' },
		}
		await zwave.storeDevices(devices as any, 9, false)

		expect(devices.sensor_a).toHaveProperty('persistent', true)
		expect(devices.sensor_b).toHaveProperty('persistent', true)

		expect((zwave as any).storeNodes[9].hassDevices).toBe(devices)

		expect(node.hassDevices).not.toBe(devices)
		expect(node.hassDevices).toEqual(devices)

		const nodesFile = join(getTestStoreDir(), 'nodes.json')
		expect(existsSync(nodesFile)).toBe(true)
		const persisted = JSON.parse(readFileSync(nodesFile, 'utf8'))
		expect(persisted[HOME]['9'].hassDevices.sensor_a.persistent).toBe(true)

		await flush()
		expect(nodeUpdatedEmits(socket)).toHaveLength(1)
	})

	it('removes the stored hassDevices when remove is true and sets persistent:false', async () => {
		const node: any = { id: 9, hassDevices: {} }
		// Seed a persisted device and load it for real, so the remove path
		// deletes a genuinely loaded storeNodes[9].hassDevices
		const { zwave } = await makeLoadedClient(9, node, {
			9: { hassDevices: { old: { type: 'sensor', object_id: 'old' } } },
		})
		expect((zwave as any).storeNodes[9].hassDevices.old).toBeDefined()

		const devices = { sensor_a: { type: 'sensor', object_id: 'a' } }
		await zwave.storeDevices(devices as any, 9, true)

		expect(devices.sensor_a).toHaveProperty('persistent', false)
		expect('hassDevices' in (zwave as any).storeNodes[9]).toBe(false)
		expect(node.hassDevices).toEqual(devices)
	})

	it('drops undefined-valued fields but keeps null in the persisted deep copy (utils.copy = JSON round-trip)', async () => {
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

	it('is a no-op when the node is unknown', async () => {
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

	it('loads a previously-persisted home-scoped device, then round-trips a new set through nodes.json', async () => {
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
		expect((zwave as any).storeNodes[11].name).toBe('Kitchen')
		expect(
			(zwave as any).storeNodes[11].hassDevices.sensor_old.persistent,
		).toBe(true)

		const devices = { climate_x: { type: 'climate', object_id: 'x' } }
		await zwave.storeDevices(devices as any, 11, false)

		expect(node.hassDevices.climate_x.persistent).toBe(true)

		// storeDevices replaces (not merges): the new set lands under homeHex,
		// the node name survives, the old device is gone
		const persisted = jsonStore.get(store.nodes)
		expect(persisted[HOME]['11'].name).toBe('Kitchen')
		expect(persisted[HOME]['11'].hassDevices.climate_x.persistent).toBe(
			true,
		)
		expect(persisted[HOME]['11'].hassDevices.sensor_old).toBeUndefined()
	})
})

describe('ZwaveClient.getStoreNodes() home-id scoping', () => {
	it('loads only the current homeHex bucket from a scoped nodes.json', async () => {
		await jsonStore.put(store.nodes, {
			[HOME]: { '3': { name: 'Mine' } },
			'0xother': { '3': { name: 'Theirs' } },
		})
		const { zwave } = newInitClient()

		await zwave.getStoreNodes()

		expect((zwave as any).storeNodes).toEqual({ '3': { name: 'Mine' } })
	})

	it('returns {} when the homeHex bucket is absent', async () => {
		await jsonStore.put(store.nodes, { '0xother': { '3': {} } })
		const { zwave } = newInitClient()

		await zwave.getStoreNodes()

		expect((zwave as any).storeNodes).toEqual({})
	})

	it('migrates a legacy flat (non-0x-keyed) nodes.json to a homeHex-scoped file', async () => {
		await jsonStore.put(store.nodes, { '3': { name: 'Legacy' } })
		const { zwave } = newInitClient()

		await zwave.getStoreNodes()

		// Quirk: storeNodes becomes the whole flat object (pre-migration shape)
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
		const { zwave } = newInitClient()

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
		// driverInfo.name is unset -> homeHex is undefined, so the load refuses
		// to persist against an undefined home id. Assert the rejection contract
		// without pinning the internal message text.
		await expect(zwave.getStoreNodes()).rejects.toThrow()
	})
})

describe('synchronous projection ordering (emitNodeUpdate)', () => {
	it('mutates node.hassDevices synchronously BEFORE the deferred NODE_UPDATED emission', async () => {
		// Doubles as proof that HASS persistence is fake-node compatible: the
		// projection is applied directly to whatever object sits in _nodes
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
