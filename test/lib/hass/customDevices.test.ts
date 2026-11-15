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

	expect(customNode.hassDevices.sensor_from_file).toMatchObject({
		object_id: 'from_file',
	})
	expect(injectedNode.hassDevices.sensor_injected).toMatchObject({
		object_id: 'injected',
	})
})

it('observes root custom-device registry edits after the gateway is built (live reload)', async () => {
	const deviceId = 'live-reload-device'
	const filename = join(storeDir, 'customDevices.json')
	const before: HassDevice = {
		type: 'sensor',
		object_id: 'before',
		discovery_payload: {},
		values: [],
	}
	const after: HassDevice = {
		type: 'sensor',
		object_id: 'after',
		discovery_payload: {},
		values: [],
	}
	writeFileSync(filename, JSON.stringify({ [deviceId]: [before] }))

	// GatewayFactory hands the started ROOT registry to the Gateway, which
	// forks it once inside the discovery manager. That single fork subscribes
	// directly to the watched root, so a live edit to customDevices.json after
	// create() must reach the gateway's discovery catalog. Forking the root a
	// second time in GatewayFactory would break this: the manager's fork would
	// then subscribe to a fork that copies the root's projection but never
	// re-emits, so this reload would never be observed.
	harness = await createGatewayHarness()
	const node = buildNode({ id: 11, deviceId, hassDevices: {} })
	harness.zwave.nodes.set(node.id, node)

	harness.gw.rediscoverNode(node.id)
	expect(node.hassDevices.sensor_before).toMatchObject({
		object_id: 'before',
	})

	writeFileSync(filename, JSON.stringify({ [deviceId]: [after] }))

	await vi.waitFor(() => {
		harness.gw.rediscoverNode(node.id)
		expect(node.hassDevices.sensor_after).toMatchObject({
			object_id: 'after',
		})
	})
})
