import * as utils from '#api/lib/utils'
import type { HassDeviceStorePort, HassPersistenceNode } from '#api/hass/ports'
import type {
	HassDevice,
	HassDeviceMap,
	StoreHassDevicesResult,
} from '#api/hass/types'

export class HassDeviceStore {
	private readonly port: HassDeviceStorePort

	public constructor(port: HassDeviceStorePort) {
		this.port = port
	}

	public updateDevice(
		hassDevice: HassDevice,
		nodeId: number,
		deleteDevice = false,
	): void {
		const devices = this.port.getNodeDevices(nodeId)
		if (!hassDevice.id || !devices?.[hassDevice.id]) return

		if (deleteDevice) {
			delete devices[hassDevice.id]
		} else {
			const id = hassDevice.id
			delete hassDevice.id
			devices[id] = hassDevice
		}

		this.port.emitNodeUpdate(nodeId, devices)
	}

	public addDevice(hassDevice: HassDevice, nodeId: number): void {
		const devices = this.port.getNodeDevices(nodeId)
		if (!hassDevice.id || !devices) return

		delete hassDevice.id
		const id = hassDevice.type + '_' + hassDevice.object_id
		hassDevice.persistent = false
		devices[id] = hassDevice
		this.port.emitNodeUpdate(nodeId, devices)
	}

	public async storeDevices(
		devices: HassDeviceMap,
		nodeId: number,
		remove: unknown,
	): Promise<StoreHassDevicesResult> {
		if (!this.port.hasNode(nodeId)) return { status: 'node-not-found' }

		const storedNode = this.port.getStoredNode(nodeId)
		if (!utils.isRecord(storedNode)) {
			return { status: 'invalid-stored-node' }
		}
		const persistenceNode: HassPersistenceNode = storedNode

		for (const device of Object.values(devices)) {
			device.persistent = !remove
		}

		if (remove) delete persistenceNode.hassDevices
		else persistenceNode.hassDevices = devices

		const copiedDevices = utils.copy(devices)
		this.port.setNodeDevices(nodeId, copiedDevices)
		await this.port.updateStoreNodes()
		this.port.emitNodeUpdate(
			nodeId,
			this.port.getNodeDevices(nodeId) ?? copiedDevices,
		)
		return { status: 'stored' }
	}
}
