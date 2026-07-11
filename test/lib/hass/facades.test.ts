import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from 'vitest'
import type GatewayType from '../../../api/lib/Gateway.ts'
import type * as GatewayModuleType from '../../../api/lib/Gateway.ts'
import type { HassDevice } from '../../../api/hass/types.ts'
import {
	cleanupTestEnv,
	ensureTestEnv,
	snapshotRepositoryStore,
	type RepositoryStoreArtifact,
} from './env.ts'

let Gateway: typeof GatewayType
let gatewayModule: typeof GatewayModuleType
let repositoryStoreBefore: RepositoryStoreArtifact[]
const gateways: GatewayType[] = []

function gateway(): GatewayType {
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

beforeAll(async () => {
	repositoryStoreBefore = snapshotRepositoryStore()
	const isolatedStoreDir = ensureTestEnv()
	const [loadedGatewayModule, configModule] = await Promise.all([
		import('../../../api/lib/Gateway.ts'),
		import('../../../api/config/app.ts'),
	])
	gatewayModule = loadedGatewayModule
	Gateway = loadedGatewayModule.default
	expect(configModule.storeDir).toBe(isolatedStoreDir)
	expect(gatewayModule.__getWatcherCountForTests()).toBe(2)
	expect(gatewayModule.__getActiveWatcherCountForTests()).toBe(2)
})

afterEach(() => {
	for (const instance of gateways.splice(0)) {
		instance['customDeviceRegistry'].dispose()
	}
})

afterAll(() => {
	gatewayModule.closeWatchers()
	expect(gatewayModule.__getWatcherCountForTests()).toBe(0)
	expect(gatewayModule.__getActiveWatcherCountForTests()).toBe(0)
	expect(gatewayModule.__getRegistrySubscriberCountForTests()).toBe(0)
	cleanupTestEnv()
	vi.resetModules()
	expect(snapshotRepositoryStore()).toEqual(repositoryStoreBefore)
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

	it('writes the cached cover mapping when its live node value is gone', async () => {
		const instance = gateway()
		const cachedValue = {
			id: '7-38-0-targetValue',
			nodeId: 7,
			commandClass: 38,
			endpoint: 0,
			property: 'targetValue',
			type: 'number',
			readable: true,
			writeable: true,
			default: 0,
			stateless: false,
			ccSpecific: {},
		}
		const writeValue = vi.fn().mockResolvedValue(undefined)
		const values = { '38-0-targetValue': cachedValue }
		Reflect.set(instance, '_zwave', {
			nodes: new Map([[7, { values }]]),
			writeValue,
		})
		Reflect.set(instance, 'discovered', {
			[cachedValue.id]: device(),
		})
		instance['discovered'][cachedValue.id] = {
			...device(),
			type: 'cover',
			discovery_payload: { payload_stop: 'STOP' },
		}
		delete values['38-0-targetValue']

		expect(
			instance.parsePayload('STOP', cachedValue as any, undefined),
		).toBeNull()
		await vi.waitFor(() =>
			expect(writeValue).toHaveBeenCalledWith(
				{ ...cachedValue, property: 'Up' },
				false,
			),
		)
	})
})
