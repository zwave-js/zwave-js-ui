import { beforeEach, describe, expect, it } from 'vitest'
import { HassDeviceStore } from '#api/hass/DeviceStore'
import type {
	HassDeviceStorePort,
	HassPersistenceNode,
} from '#api/hass/ports'
import type { HassDevice, HassDeviceMap } from '#api/hass/types'

function device(objectId: string, id?: string): HassDevice {
	return {
		id,
		type: 'sensor',
		object_id: objectId,
		discovery_payload: { name: objectId },
		values: [],
	}
}

class RecordingStorePort implements HassDeviceStorePort {
	public readonly liveNodes = new Map<number, HassDeviceMap>()
	public readonly storedNodes = new Map<number, unknown>()
	public readonly emissions: Array<{
		nodeId: number
		devices: HassDeviceMap
	}> = []
	public updateStoreNodes = (): Promise<void> => Promise.resolve()

	public hasNode(nodeId: number): boolean {
		return this.liveNodes.has(nodeId)
	}

	public getNodeDevices(nodeId: number): HassDeviceMap | undefined {
		return this.liveNodes.get(nodeId)
	}

	public setNodeDevices(nodeId: number, devices: HassDeviceMap): void {
		this.liveNodes.set(nodeId, devices)
	}

	public getStoredNode(nodeId: number): unknown {
		return this.storedNodes.get(nodeId)
	}

	public emitNodeUpdate(nodeId: number, devices: HassDeviceMap): void {
		const projection = structuredClone(devices)
		this.liveNodes.set(nodeId, projection)
		this.emissions.push({ nodeId, devices: projection })
	}
}

describe('HassDeviceStore', () => {
	let port: RecordingStorePort
	let store: HassDeviceStore

	beforeEach(() => {
		port = new RecordingStorePort()
		store = new HassDeviceStore(port)
	})

	function addNode(nodeId: number, storedNode: unknown = {}): void {
		port.liveNodes.set(nodeId, {})
		port.storedNodes.set(nodeId, storedNode)
	}

	it('adds devices under generated identifiers', () => {
		addNode(5)

		store.addDevice(device('temperature', 'wire-id'), 5)

		expect(port.liveNodes.get(5)).toEqual({
			sensor_temperature: {
				type: 'sensor',
				object_id: 'temperature',
				discovery_payload: { name: 'temperature' },
				values: [],
				persistent: false,
			},
		})
		expect(port.emissions.at(-1)?.devices).toEqual(port.liveNodes.get(5))
	})

	it('updates and deletes existing devices by their public id', () => {
		addNode(6)
		port.liveNodes.set(6, {
			old_key: device('old'),
		})

		store.updateDevice(
			{
				...device('updated', 'old_key'),
				discovery_payload: { name: 'updated' },
			},
			6,
		)

		expect(port.liveNodes.get(6)).toEqual({
			old_key: {
				type: 'sensor',
				object_id: 'updated',
				discovery_payload: { name: 'updated' },
				values: [],
			},
		})

		store.updateDevice(device('updated', 'old_key'), 6, true)

		expect(port.liveNodes.get(6)).toEqual({})
	})

	it('persists a detached copy of caller devices', async () => {
		const storedNode: HassPersistenceNode = {}
		addNode(9, storedNode)
		const devices: HassDeviceMap = {
			sensor_a: device('a'),
		}

		const result = await store.storeDevices(devices, 9, false)
		devices.sensor_a.discovery_payload.name = 'changed-after-write'

		expect(result).toEqual({ status: 'stored' })
		expect(storedNode.hassDevices?.sensor_a).toMatchObject({
			object_id: 'a',
			persistent: true,
		})
		expect(port.liveNodes.get(9)?.sensor_a.discovery_payload.name).toBe('a')
		expect(port.emissions.at(-1)).toEqual({
			nodeId: 9,
			devices: {
				sensor_a: {
					type: 'sensor',
					object_id: 'a',
					discovery_payload: { name: 'a' },
					values: [],
					persistent: true,
				},
			},
		})
	})

	it('removes persisted devices and keeps current devices available', async () => {
		const storedNode: HassPersistenceNode = {
			hassDevices: { old: device('old') },
		}
		addNode(10, storedNode)
		const devices: HassDeviceMap = {
			sensor_current: device('current'),
		}

		const result = await store.storeDevices(devices, 10, true)

		expect(result).toEqual({ status: 'stored' })
		expect(storedNode).not.toHaveProperty('hassDevices')
		expect(port.liveNodes.get(10)?.sensor_current.persistent).toBe(false)
	})

	it('does not write devices for unknown nodes', async () => {
		const result = await store.storeDevices(
			{ sensor_missing: device('missing') },
			404,
			false,
		)

		expect(result).toEqual({ status: 'node-not-found' })
		expect(port.emissions).toEqual([])
	})

	it.each([null, []])(
		'rejects malformed stored nodes without writing',
		async (storedNode) => {
			addNode(11, storedNode)

			const result = await store.storeDevices(
				{ sensor_safe: device('safe') },
				11,
				true,
			)

			expect(result).toEqual({ status: 'invalid-stored-node' })
			expect(port.liveNodes.get(11)).toEqual({})
			expect(port.emissions).toEqual([])
		},
	)

	it('emits the most recently requested devices after concurrent writes', async () => {
		addNode(12)
		const persistenceResolvers: Array<() => void> = []
		port.updateStoreNodes = () =>
			new Promise<void>((resolve) => {
				persistenceResolvers.push(resolve)
			})
		const devicesA: HassDeviceMap = {
			sensor_a: device('a'),
		}
		const devicesB: HassDeviceMap = {
			sensor_b: device('b'),
		}

		const writeA = store.storeDevices(devicesA, 12, false)
		const writeB = store.storeDevices(devicesB, 12, false)
		expect(persistenceResolvers).toHaveLength(2)

		persistenceResolvers[1]()
		await writeB
		persistenceResolvers[0]()
		await writeA

		const latestProjection: HassDeviceMap = {
			sensor_b: {
				type: 'sensor',
				object_id: 'b',
				discovery_payload: { name: 'b' },
				values: [],
				persistent: true,
			},
		}
		expect(port.liveNodes.get(12)).toEqual(latestProjection)
		expect(port.emissions.map(({ devices }) => devices)).toEqual([
			latestProjection,
			latestProjection,
		])
	})
})
