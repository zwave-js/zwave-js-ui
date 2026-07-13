/**
 * Regression proving `test/lib/hass/env.ts`'s HASS-specific env isolation
 * (`HASS_ENV_VARS`: `UID_DISCOVERY_PREFIX`,
 * `DISCOVERY_DISABLE_CC_CONFIGURATION`, `MQTT_NAME`) keeps hostile ambient
 * values out of the app under test.
 *
 * These three are read by the discovery modules but aren't in the HTTP suite's
 * `APP_ENV_VARS`, so an ambient value could repoint every discovery
 * `unique_id`/`identifiers` prefix, turn Configuration-CC discovery into a
 * no-op, or rewrite the MQTT client id / status topic. The test plants hostile
 * values before `createGatewayHarness()` (whose `ensureTestEnv()` clears them
 * before the dynamic `Gateway.ts`/`MqttClient.ts` import) and asserts none
 * reach production output: default `zwavejs2mqtt_` uid prefix,
 * `ZWAVE_GATEWAY-test` client id, and a live `config_switch`.
 */
import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	beforeEach,
	vi,
} from 'vitest'
import { CommandClasses } from '@zwave-js/core'
import { HASS_ENV_VARS } from './env.ts'
import { mqttMockFactory } from './mqttMock.ts'
import {
	createGatewayHarness,
	cleanupGatewayHarnessEnv,
	discoverValueOnNode,
	type GatewayHarness,
} from './gatewayHarness.ts'
import { buildNode, buildValueId, addValue } from './fixtures.ts'

vi.mock('mqtt', () => mqttMockFactory())

const HOSTILE_UID_PREFIX = 'HOSTILE_UID_'
const HOSTILE_MQTT_NAME = 'hostile-name'

describe('HASS env isolation - hostile ambient values cannot reach the app under test', () => {
	let harness: GatewayHarness
	let restoreHostile: () => void

	beforeAll(async () => {
		// Plant hostile ambient values before the harness imports Gateway.ts /
		// MqttClient.ts; createGatewayHarness() -> ensureTestEnv() must clear
		// them first, so the modules capture safe defaults
		const prior = {
			UID_DISCOVERY_PREFIX: process.env.UID_DISCOVERY_PREFIX,
			MQTT_NAME: process.env.MQTT_NAME,
			DISCOVERY_DISABLE_CC_CONFIGURATION:
				process.env.DISCOVERY_DISABLE_CC_CONFIGURATION,
		}
		restoreHostile = () => {
			for (const [key, value] of Object.entries(prior)) {
				if (value === undefined) delete process.env[key]
				else process.env[key] = value
			}
		}

		process.env.UID_DISCOVERY_PREFIX = HOSTILE_UID_PREFIX
		process.env.MQTT_NAME = HOSTILE_MQTT_NAME
		process.env.DISCOVERY_DISABLE_CC_CONFIGURATION = 'true'

		harness = await createGatewayHarness({
			zwave: { homeHex: '0xabcdef01' },
		})
	})

	afterAll(async () => {
		await harness.close()
		// cleanupGatewayHarnessEnv() restores the hostile values (the
		// pre-ensure snapshot); delete them so nothing leaks past this file
		cleanupGatewayHarnessEnv()
		restoreHostile()
		for (const key of HASS_ENV_VARS) delete process.env[key]
	})

	beforeEach(() => {
		harness.resetState()
		harness.config.hassDiscovery = true
	})

	it('ignores a hostile UID_DISCOVERY_PREFIX: unique_id/identifiers keep the zwavejs2mqtt_ default', () => {
		const node = buildNode({ id: 2, name: 'Dev', firmwareVersion: '1.0.0' })
		addValue(
			node,
			buildValueId({
				commandClass: CommandClasses['Binary Switch'],
				property: 'targetValue',
				propertyName: 'targetValue',
			}),
		)
		const key = addValue(
			node,
			buildValueId({
				commandClass: CommandClasses['Binary Switch'],
				property: 'currentValue',
				propertyName: 'currentValue',
				isCurrentValue: true,
				targetValue: '37-0-targetValue',
			} as any),
		)
		discoverValueOnNode(harness.gw, node, key)
		const payload = harness.lastDiscovery().payload

		expect(payload.unique_id).toBe(
			'zwavejs2mqtt_0xabcdef01_2-37-0-currentValue',
		)
		expect(payload.unique_id.startsWith(HOSTILE_UID_PREFIX)).toBe(false)
		expect(payload.device.identifiers[0]).toBe(
			'zwavejs2mqtt_0xabcdef01_node2',
		)
	})

	it('ignores a hostile MQTT_NAME: client id stays ZWAVE_GATEWAY-test', () => {
		expect(harness.mqtt.clientID).toBe('ZWAVE_GATEWAY-test')
		expect(harness.mqtt.clientID.includes(HOSTILE_MQTT_NAME)).toBe(false)
		expect(harness.mqtt.getStatusTopic()).toBe(
			'zwave/_CLIENTS/ZWAVE_GATEWAY-test/status',
		)
	})

	it('ignores a hostile DISCOVERY_DISABLE_CC_CONFIGURATION=true: Configuration CC still discovers', () => {
		const node = buildNode({ id: 3, name: 'Cfg', firmwareVersion: '1.0.0' })
		const key = addValue(
			node,
			buildValueId({
				commandClass: CommandClasses.Configuration,
				property: 3,
				propertyName: '3',
				type: 'number',
				min: 0,
				max: 1,
			} as any),
		)
		const device = discoverValueOnNode(harness.gw, node, key)
		expect(device?.type).toBe('switch')
		expect(device?.object_id).toBe('config_switch_3')
	})
})
