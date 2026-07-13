import type { HassDeviceStorePort } from './ports.ts'
import type {
	HassDevice,
	HassDeviceMap,
	StoreHassDevicesResult,
} from './types.ts'

function copyDevices(devices: HassDeviceMap): HassDeviceMap {
	return JSON.parse(JSON.stringify(devices))
}

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
		if (
			storedNode === null ||
			storedNode === undefined ||
			typeof storedNode !== 'object'
		) {
			return { status: 'invalid-stored-node' }
		}

		for (const device of Object.values(devices)) {
			device.persistent = !remove
		}

		if (remove) delete storedNode.hassDevices
		else storedNode.hassDevices = devices

		const copiedDevices = copyDevices(devices)
		this.port.setNodeDevices(nodeId, copiedDevices)
		await this.port.updateStoreNodes()
		this.port.emitNodeUpdate(
			nodeId,
			this.port.getNodeDevices(nodeId) ?? copiedDevices,
		)
		return { status: 'stored' }
	}
}
