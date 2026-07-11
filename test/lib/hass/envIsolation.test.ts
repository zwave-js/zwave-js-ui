/**
 * Regression for `test/lib/hass/env.ts`'s HASS-specific env-var isolation
 * (`HASS_ENV_VARS`: `UID_DISCOVERY_PREFIX`,
 * `DISCOVERY_DISABLE_CC_CONFIGURATION`, `MQTT_NAME`).
 *
 * These three are read by the discovery modules under characterization but
 * are NOT in the HTTP suite's `APP_ENV_VARS` list, so before this isolation
 * an ambient value from the host shell / CI runner (or a sibling test file
 * that leaked one) could silently:
 *
 *  - repoint every discovery `unique_id`/device `identifiers` prefix
 *    (`UID_DISCOVERY_PREFIX`, captured at `Gateway.ts` import time),
 *  - turn Configuration-CC discovery into a no-op
 *    (`DISCOVERY_DISABLE_CC_CONFIGURATION === 'true'`), or
 *  - rewrite the MQTT client id / status topic (`MQTT_NAME`).
 *
 * Two layers of proof:
 *  1. A direct-helper contract test that `ensureTestEnv()` snapshots + clears
 *     each var and `cleanupTestEnv()` restores it EXACTLY (including the
 *     "was-unset -> stays-unset" case), driving the same `HASS_ENV_VARS` set
 *     the harness protects.
 *  2. A behavioral proof that sets HOSTILE ambient values BEFORE
 *     `createGatewayHarness()` (whose `ensureTestEnv()` clears them before the
 *     dynamic `Gateway.ts`/`MqttClient.ts` import) and asserts none reach the
 *     app under test: default `zwavejs2mqtt_` uid prefix, `ZWAVE_GATEWAY-test`
 *     client id, and a live `config_switch` from a Configuration-CC value.
 */
import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	beforeEach,
	afterEach,
	vi,
} from 'vitest'
import { CommandClasses } from '@zwave-js/core'
import { ensureTestEnv, cleanupTestEnv, HASS_ENV_VARS } from './env.ts'
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

describe('HASS env isolation - ensureTestEnv/cleanupTestEnv contract', () => {
	// Snapshot the pre-test values ourselves so this suite never leaks its own
	// hostile sets into the worker process regardless of assertion outcome.
	let preTest: Record<string, string | undefined>

	beforeEach(() => {
		preTest = {}
		for (const key of HASS_ENV_VARS) {
			preTest[key] = process.env[key]
			delete process.env[key]
		}
	})

	afterEach(() => {
		// Make sure the harness module state is reset even if a test asserted
		// mid-cycle, then restore the real pre-test environment exactly.
		cleanupTestEnv()
		for (const key of HASS_ENV_VARS) {
			if (preTest[key] === undefined) {
				delete process.env[key]
			} else {
				process.env[key] = preTest[key]
			}
		}
	})

	it('snapshots and clears every HASS_ENV_VARS entry, then restores each hostile value exactly', () => {
		process.env.UID_DISCOVERY_PREFIX = HOSTILE_UID_PREFIX
		process.env.MQTT_NAME = HOSTILE_MQTT_NAME
		process.env.DISCOVERY_DISABLE_CC_CONFIGURATION = 'true'

		ensureTestEnv()

		// cleared while the app under test could observe them
		for (const key of HASS_ENV_VARS) {
			expect(process.env[key]).toBeUndefined()
		}

		cleanupTestEnv()

		// restored to the exact pre-test (hostile) values
		expect(process.env.UID_DISCOVERY_PREFIX).toBe(HOSTILE_UID_PREFIX)
		expect(process.env.MQTT_NAME).toBe(HOSTILE_MQTT_NAME)
		expect(process.env.DISCOVERY_DISABLE_CC_CONFIGURATION).toBe('true')
	})

	it('restores a previously-unset var to unset (no leak either direction)', () => {
		// All three start unset (beforeEach cleared them).
		ensureTestEnv()
		for (const key of HASS_ENV_VARS) {
			expect(process.env[key]).toBeUndefined()
		}

		cleanupTestEnv()

		// still absent - cleanup must not invent a value
		for (const key of HASS_ENV_VARS) {
			expect(Object.prototype.hasOwnProperty.call(process.env, key)).toBe(
				false,
			)
		}
	})

	it('is idempotent across repeated ensure/cleanup cycles', () => {
		process.env.MQTT_NAME = HOSTILE_MQTT_NAME

		ensureTestEnv()
		ensureTestEnv() // second call must not re-snapshot the cleared value
		expect(process.env.MQTT_NAME).toBeUndefined()

		cleanupTestEnv()
		expect(process.env.MQTT_NAME).toBe(HOSTILE_MQTT_NAME)

		cleanupTestEnv() // second cleanup is a harmless no-op
		expect(process.env.MQTT_NAME).toBe(HOSTILE_MQTT_NAME)
	})
})

describe('HASS env isolation - hostile ambient values cannot reach the app under test', () => {
	let harness: GatewayHarness
	let restoreHostile: () => void

	beforeAll(async () => {
		// Record and then plant hostile ambient values BEFORE the harness
		// imports Gateway.ts / MqttClient.ts. `createGatewayHarness()` ->
		// `ensureTestEnv()` must clear them first, so the imported modules
		// capture the safe defaults, not these.
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
		// cleanupGatewayHarnessEnv() restores the hostile values (they were the
		// pre-ensure snapshot); delete them so nothing leaks past this file.
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
