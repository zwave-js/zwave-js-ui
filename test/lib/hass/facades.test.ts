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

	it('writes the cached cover mapping when its live node value is gone', async () => {
		const harness = await createGatewayHarness()
		harnesses.push(harness)
		const target = buildValueId({
			nodeId: 7,
			commandClass: CommandClasses['Barrier Operator'],
			property: 'targetValue',
			type: 'number',
		})
		const cachedValue = buildValueId({
			nodeId: 7,
			commandClass: CommandClasses['Barrier Operator'],
			property: 'currentValue',
			type: 'number',
			isCurrentValue: true,
			targetValue: valueMapKey(target),
		})
		const node = buildNode({ id: 7 })
		addValue(node, target)
		const cachedKey = addValue(node, cachedValue)
		harness.zwave.nodes.set(node.id, node)
		harness.gw.discoverValue(node, cachedKey)
		expect(
			Object.values(node.hassDevices).some(
				({ type }) => type === 'cover',
			),
		).toBe(true)
		delete node.values[valueMapKey(target)]

		expect(harness.gw.parsePayload(253, target, undefined)).toBeNull()
		await vi.waitFor(() => {
			expect(harness.zwave.writeValue).toHaveBeenCalledWith(
				{ ...target, property: 'Up' },
				false,
			)
		})
	})
})
