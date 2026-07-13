import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from 'vitest'
import { CommandClasses } from '@zwave-js/core'
import type { GatewayFactory as GatewayFactoryType } from '../../../api/hass/GatewayFactory.ts'
import type { HassDevice } from '../../../api/hass/types.ts'
import type { GatewayHarness } from './gatewayHarness.ts'
import {
	cleanupGatewayHarnessEnv,
	createGatewayHarness,
} from './gatewayHarness.ts'
import { addValue, buildNode, buildValueId, valueMapKey } from './fixtures.ts'
import { ensureTestEnv } from './env.ts'
import { mqttMockFactory } from './mqttMock.ts'

vi.mock('mqtt', () => mqttMockFactory())

describe('Gateway HASS facades', () => {
	const harnesses: GatewayHarness[] = []
	const factories: GatewayFactoryType[] = []
	let storeDir: string

	beforeAll(() => {
		storeDir = ensureTestEnv()
	})

	afterEach(async () => {
		for (const harness of harnesses.splice(0)) await harness.close()
		for (const factory of factories.splice(0)) factory.dispose()
	})

	afterAll(() => {
		cleanupGatewayHarnessEnv()
	})

	it('discovers injected catalog content without leaking dynamic devices across gateways', async () => {
		const deviceId = 'test-thermostat'
		const configuredDevice: HassDevice = {
			type: 'sensor',
			object_id: 'configured',
			discovery_payload: {},
			values: [],
		}
		const { GatewayFactory } = await import(
			'../../../api/hass/GatewayFactory.ts'
		)
		const factory = new GatewayFactory({
			storeDir,
			logger: {
				error: vi.fn(),
				info: vi.fn(),
			},
			devices: { [deviceId]: [configuredDevice] },
		})
		factories.push(factory)
		const first = await createGatewayHarness({ gatewayFactory: factory })
		const second = await createGatewayHarness({ gatewayFactory: factory })
		harnesses.push(first, second)
		const thermostat = buildNode({
			id: 7,
			deviceId,
			deviceClass: { basic: 1, generic: 0x08, specific: 1 },
			hassDevices: {},
		})
		addValue(
			thermostat,
			buildValueId({
				id: '7-67-0-setpoint-1',
				nodeId: 7,
				commandClass: CommandClasses['Thermostat Setpoint'],
				property: 'setpoint',
				propertyKey: 1,
				type: 'number',
				min: 5,
				max: 30,
				unit: '°C',
			}),
		)
		const sibling = buildNode({
			id: 8,
			deviceId,
			hassDevices: {},
		})

		first.zwave.nodes.set(thermostat.id, thermostat)
		second.zwave.nodes.set(sibling.id, sibling)
		first.gw.discoverClimates(thermostat)
		first.gw.rediscoverNode(thermostat.id)
		second.gw.rediscoverNode(sibling.id)

		expect(
			Object.values(thermostat.hassDevices).map(({ type }) => type),
		).toEqual(expect.arrayContaining(['sensor', 'climate']))
		expect(
			Object.values(sibling.hassDevices).map(({ type }) => type),
		).toEqual(['sensor'])
		expect(sibling.hassDevices.sensor_configured).toMatchObject({
			object_id: 'configured',
		})
	})

	it('clears stale node topics before public rediscovery', async () => {
		const harness = await createGatewayHarness()
		harnesses.push(harness)
		const stale = buildValueId({ id: '7-37-0-currentValue', nodeId: 7 })
		const other = buildValueId({ id: '8-37-0-currentValue', nodeId: 8 })
		harness.zwave.nodes.set(7, buildNode({ id: 7 }))
		harness.gw.topicValues = {
			'old/topic': stale,
			'other/topic': other,
		}

		harness.gw.rediscoverNode(7)

		expect(harness.gw.topicValues).toEqual({ 'other/topic': other })
	})

	it('writes the cached cover mapping when its live node value is gone', async () => {
		const harness = await createGatewayHarness()
		harnesses.push(harness)
		const cachedValue = buildValueId({
			id: '7-38-0-targetValue',
			nodeId: 7,
			commandClass: CommandClasses['Multilevel Switch'],
			property: 'targetValue',
			type: 'number',
		})
		const node = buildNode({ id: 7 })
		addValue(node, cachedValue)
		harness.zwave.nodes.set(node.id, node)
		harness.gw.discovered[cachedValue.id] = {
			type: 'cover',
			object_id: 'test',
			discovery_payload: { payload_stop: 'STOP' },
			values: [valueMapKey(cachedValue)],
		}
		delete node.values[valueMapKey(cachedValue)]

		expect(
			harness.gw.parsePayload('STOP', cachedValue, undefined),
		).toBeNull()
		await vi.waitFor(() => {
			expect(harness.zwave.writeValue).toHaveBeenCalledWith(
				{ ...cachedValue, property: 'Up' },
				false,
			)
		})
	})
})
