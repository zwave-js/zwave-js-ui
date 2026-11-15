/**
 * Facade-level tests for the scene, group and association services: each test goes through a real
 * ZwaveClient so the port wiring built in init() is exercised, not just the services in isolation.
 * ZwaveClient pulls in config/app.ts, so it's imported dynamically after ensureTestEnv()
 */
import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	afterEach,
	vi,
} from 'vitest'
import { Server as SocketServer } from 'socket.io'
import type { Driver } from 'zwave-js'
import type ZwaveClientType from '#api/lib/ZwaveClient'
import { cleanupTestEnv } from '../shared/env.ts'
import { loadJsonStore } from '../shared/harness.ts'
import { socketEvents } from '#api/lib/SocketEvents'

type JsonStoreContext = Awaited<ReturnType<typeof loadJsonStore>>

let ZwaveClient: typeof ZwaveClientType
let jsonStore: JsonStoreContext['jsonStore']
let store: JsonStoreContext['store']
let socket: SocketServer

beforeAll(async () => {
	;({ jsonStore, store } = await loadJsonStore())
	;({ default: ZwaveClient } = await import('#api/lib/ZwaveClient'))
	await jsonStore.init(structuredClone(store))
	socket = new SocketServer()
})

afterEach(async () => {
	vi.restoreAllMocks()
	vi.useRealTimers()
	await jsonStore.put(store.scenes, [])
	await jsonStore.put(store.groups, [])
})

afterAll(() => {
	cleanupTestEnv()
})

interface FakeController {
	ownNodeId: number
	nodes: Map<number, unknown>
	getMulticastGroup: ReturnType<typeof vi.fn>
	getAllAssociations: ReturnType<typeof vi.fn>
	removeAssociations: ReturnType<typeof vi.fn>
}

function createClient(): ZwaveClientType {
	return new ZwaveClient({}, socket)
}

// Minimal driver: physical nodes 2 and 3, multicast groups with no defined values
function attachReadyDriver(client: ZwaveClientType): FakeController {
	const controller: FakeController = {
		ownNodeId: 1,
		nodes: new Map<number, unknown>([
			[2, { id: 2 }],
			[3, { id: 3 }],
		]),
		getMulticastGroup: vi.fn(() => ({ getDefinedValueIDs: () => [] })),
		getAllAssociations: vi.fn(() => new Map()),
		removeAssociations: vi.fn(() => Promise.resolve()),
	}
	client['_driver'] = { controller } as unknown as Driver
	client.driverReady = true
	return controller
}

describe('ZwaveClient scene/group/association service wiring', () => {
	it('skips socket events when no Socket.IO server is attached', () => {
		const client = new ZwaveClient({}, undefined)

		expect(() =>
			client['sendToSocket'](socketEvents.nodeUpdated, {}),
		).not.toThrow()
	})

	describe('scenes', () => {
		it('persists created and removed scenes through jsonStore', async () => {
			const client = createClient()

			await client._createScene('Party')
			const [scene] = client._getScenes()
			expect(jsonStore.get(store.scenes)).toEqual([
				expect.objectContaining({
					sceneid: scene.sceneid,
					label: 'Party',
				}),
			])

			await client._removeScene(scene.sceneid)
			expect(jsonStore.get(store.scenes)).toEqual([])
			expect(client._getScenes()).toEqual([])
		})

		it('activates a scene through ZwaveClient.writeValue', async () => {
			vi.useFakeTimers()
			const client = createClient()
			const writeValue = vi
				.spyOn(client, 'writeValue')
				.mockResolvedValue(undefined as never)
			const valueId = {
				id: '2-37-0-targetValue',
				nodeId: 2,
				commandClass: 37,
				endpoint: 0,
				property: 'targetValue',
				value: true,
				timeout: 0,
			}
			await client._setScenes([
				{ sceneid: 1, label: 'On', values: [valueId] },
			] as never)

			expect(client._sceneGetValues(1)).toEqual([valueId])
			expect(client._activateScene(1)).toBe(true)
			await vi.runAllTimersAsync()

			expect(writeValue).toHaveBeenCalledWith(valueId, true)
		})
	})

	describe('groups', () => {
		it('persists group create, update and delete through jsonStore', async () => {
			const client = createClient()

			const created = await client._createGroup('Lights', [2, 3])
			expect(jsonStore.get(store.groups)).toEqual([
				{ id: created.id, name: 'Lights', nodeIds: [2, 3] },
			])

			await client._updateGroup(created.id, 'Lamps', [2, 3])
			expect(client._getGroups()).toEqual([
				{ id: created.id, name: 'Lamps', nodeIds: [2, 3] },
			])
			expect(jsonStore.get(store.groups)).toEqual(client._getGroups())

			expect(await client._deleteGroup(created.id)).toBe(true)
			expect(jsonStore.get(store.groups)).toEqual([])
		})

		it('materializes a virtual node on the client when the driver is ready', async () => {
			const client = createClient()
			const controller = attachReadyDriver(client)

			const group = await client._createGroup('Lights', [2, 3])

			expect(controller.getMulticastGroup).toHaveBeenCalledWith([2, 3])
			expect(client.nodes.get(group.id)).toMatchObject({
				id: group.id,
				name: 'Lights',
			})
		})

		it('a second init() stops an in-flight createGroup from touching the new generation', async () => {
			const client = createClient()
			attachReadyDriver(client)
			let releasePut!: () => void
			const putGate = new Promise<void>((resolve) => {
				releasePut = resolve
			})
			const realPut = jsonStore.put.bind(jsonStore)
			vi.spyOn(jsonStore, 'put').mockImplementation(
				async (model, data) => {
					await putGate
					return realPut(model, data)
				},
			)

			const pending = client._createGroup('Lights', [2, 3])
			client.init()
			// The new generation's driver is ready, so only the cancelled fence keeps the old call out
			client.driverReady = true
			releasePut()
			const group = await pending

			expect(jsonStore.get(store.groups)).toEqual([
				{ id: group.id, name: 'Lights', nodeIds: [2, 3] },
			])
			expect(client.nodes.has(group.id)).toBe(false)
		})
	})

	describe('associations', () => {
		it('reads associations through the live driver', async () => {
			const client = createClient()
			const controller = attachReadyDriver(client)
			controller.getAllAssociations.mockReturnValue(
				new Map([
					[
						{ nodeId: 2, endpoint: 0 },
						new Map([[1, [{ nodeId: 1 }]]]),
					],
				]),
			)

			await expect(client.getAssociations(2)).resolves.toEqual([
				{
					endpoint: 0,
					groupId: 1,
					nodeId: 1,
					targetEndpoint: undefined,
				},
			])
			expect(controller.getAllAssociations).toHaveBeenCalledWith(2)
		})

		it('removes every association through the live driver', async () => {
			const client = createClient()
			const controller = attachReadyDriver(client)
			const source = { nodeId: 2, endpoint: 0 }
			controller.getAllAssociations.mockReturnValue(
				new Map([[source, new Map([[1, [{ nodeId: 1 }]]])]]),
			)

			await client.removeAllAssociations(2)

			expect(controller.removeAssociations).toHaveBeenCalledWith(
				source,
				1,
				[{ nodeId: 1 }],
			)
		})
	})
})
