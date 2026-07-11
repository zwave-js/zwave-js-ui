import { afterEach, describe, expect, it, vi } from 'vitest'
import Gateway, { closeWatchers } from '../../../api/lib/Gateway.ts'
import type { HassDevice } from '../../../api/hass/types.ts'

const gateways: Gateway[] = []

function gateway(): Gateway {
	const instance = new Gateway({ type: 0 }, null, null)
	gateways.push(instance)
	return instance
}

function device(): HassDevice {
	return {
		type: 'sensor',
		object_id: 'test',
		discovery_payload: {},
		values: ['value'],
	}
}

afterEach(() => {
	for (const instance of gateways.splice(0)) {
		instance['customDeviceRegistry'].dispose()
	}
	closeWatchers()
})

describe('Gateway HASS compatibility facades', () => {
	it('delegates public discovery operations to the extracted domain', () => {
		const instance = gateway()
		Reflect.set(instance, '_zwave', { nodes: new Map() })
		const generator = instance['discoveryGenerator']
		const rediscoverNode = vi
			.spyOn(generator, 'rediscoverNode')
			.mockImplementation(() => {})
		const disableDiscovery = vi
			.spyOn(generator, 'disableDiscovery')
			.mockImplementation(() => {})
		const publishDiscovery = vi
			.spyOn(generator, 'publishDiscovery')
			.mockImplementation(() => {})
		const setDiscovery = vi
			.spyOn(generator, 'setDiscovery')
			.mockImplementation(() => {})
		const rediscoverAll = vi
			.spyOn(generator, 'rediscoverAll')
			.mockImplementation(() => {})
		const hassDevice = device()

		instance.rediscoverNode(7)
		instance.disableDiscovery(7)
		instance.publishDiscovery(hassDevice, 7, { forceUpdate: true })
		instance.setDiscovery(7, hassDevice, true)
		instance.rediscoverAll()

		expect(rediscoverNode).toHaveBeenCalledWith(7)
		expect(disableDiscovery).toHaveBeenCalledWith(7)
		expect(publishDiscovery).toHaveBeenCalledWith(hassDevice, 7, {
			forceUpdate: true,
		})
		expect(setDiscovery).toHaveBeenCalledWith(7, hassDevice, true)
		expect(rediscoverAll).toHaveBeenCalledOnce()
	})

	it('keeps custom-device catalogs isolated across simultaneous Gateways', () => {
		const first = gateway()
		const second = gateway()
		const custom = device()

		first['customDeviceRegistry'].set('custom-device', [custom])

		expect(first['customDeviceRegistry'].get('custom-device')).toEqual([
			custom,
		])
		expect(second['customDeviceRegistry'].get('custom-device')).toEqual([])
	})

	it('clears generic MQTT topic mappings before rediscovering a node', () => {
		const instance = gateway()
		Reflect.set(instance, '_zwave', {
			nodes: new Map([[7, { id: 7, virtual: false }]]),
		})
		Reflect.set(instance, 'topicValues', {
			'old/topic': { nodeId: 7 },
			'other/topic': { nodeId: 8 },
		})
		vi.spyOn(
			instance['discoveryGenerator'],
			'rediscoverNode',
		).mockImplementation(() => {})

		instance.rediscoverNode(7)

		expect(Reflect.get(instance, 'topicValues')).toEqual({
			'other/topic': { nodeId: 8 },
		})
	})

	it('treats an absent MQTT client as disabled during node initialization', () => {
		const instance = gateway()

		expect(() =>
			instance['discoveryGenerator'].onNodeInited({
				id: 7,
				ready: true,
				values: {},
				hassDevices: {},
			}),
		).not.toThrow()
	})
})
