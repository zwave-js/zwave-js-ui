import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { HassDevice } from '#api/hass/types.ts'
import { buildNode } from './fixtures.ts'
import {
	cleanupGatewayHarnessEnv,
	createGatewayHarness,
	type GatewayHarness,
} from './gatewayHarness.ts'
import { ensureTestEnv } from './env.ts'
import { mqttMockFactory } from './mqttMock.ts'
import { requireDefined } from './fixtures.ts'

vi.mock('mqtt', () => mqttMockFactory())

let storeDir: string
let harness: GatewayHarness | undefined

beforeAll(() => {
	storeDir = ensureTestEnv()
})

afterEach(async () => {
	if (harness) await harness.close()
	harness = undefined
	for (const extension of ['js', 'json']) {
		rmSync(join(storeDir, `customDevices.${extension}`), { force: true })
	}
})

afterAll(() => {
	cleanupGatewayHarnessEnv()
})

it('discovers devices from custom files', async () => {
	const deviceId = 'custom-device'
	const customDevice: HassDevice = {
		type: 'sensor',
		object_id: 'from_file',
		discovery_payload: {},
		values: [],
	}
	const injectedDevice: HassDevice = {
		type: 'sensor',
		object_id: 'injected',
		discovery_payload: {},
		values: [],
	}
	writeFileSync(
		join(storeDir, 'customDevices.json'),
		JSON.stringify({ [deviceId]: [customDevice] }),
	)
	harness = await createGatewayHarness({
		catalogs: { injected: [injectedDevice] },
	})
	const customNode = buildNode({
		id: 7,
		deviceId,
		hassDevices: {},
	})
	const injectedNode = buildNode({
		id: 8,
		deviceId: 'injected',
		hassDevices: {},
	})

	harness.zwave.nodes.set(customNode.id, customNode)
	harness.zwave.nodes.set(injectedNode.id, injectedNode)
	harness.gw.rediscoverNode(customNode.id)
	harness.gw.rediscoverNode(injectedNode.id)

	expect(
		requireDefined(customNode.hassDevices, 'expected file-backed discovery')
			.sensor_from_file,
	).toMatchObject({
		object_id: 'from_file',
	})
	expect(
		requireDefined(injectedNode.hassDevices, 'expected injected discovery')
			.sensor_injected,
	).toMatchObject({
		object_id: 'injected',
	})
})
