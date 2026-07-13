/**
 * Cleanup / reentrancy / real-store-isolation regression tests for the HASS
 * integration surface, guarding that in any test order nothing leaks between
 * files or into the real repository `store/` directory: watchers are fully
 * releasable, a real `Gateway.close()` releases its broker and listeners (and
 * is reentrant), and a real `storeDevices()` write lands only in the isolated
 * STORE_DIR. `mqtt` is the only mocked upstream boundary; `Gateway`/
 * `MqttClient`/`ZwaveClient` are real, imported after `ensureTestEnv()`.
 */
import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	afterEach,
	vi,
} from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { ensureTestEnv, getTestStoreDir } from './env.ts'
import { createRecordingSocket } from './fixtures.ts'
import { mqttMockFactory, resetMqttBrokers } from './mqttMock.ts'
import {
	createGatewayHarness,
	cleanupGatewayHarnessEnv,
} from './gatewayHarness.ts'
import type ZWaveClientType from '../../../api/lib/ZwaveClient.ts'
import type * as GatewayModuleNS from '../../../api/lib/Gateway.ts'

vi.mock('mqtt', () => mqttMockFactory())

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../..',
)

type GatewayModule = typeof GatewayModuleNS

let gwMod: GatewayModule
let importTimeWatcherCount: number
let ZWaveClient: typeof ZWaveClientType
let jsonStore: any
let store: any

beforeAll(async () => {
	ensureTestEnv()
	gwMod = await import('../../../api/lib/Gateway.ts')
	// Captured once, before any test closes watchers, so the assertion is
	// order-independent
	importTimeWatcherCount = gwMod.__getWatcherCountForTests()
	;({ default: jsonStore } = (await import(
		'../../../api/lib/jsonStore.ts'
	)) as any)
	;({ default: store } = (await import(
		'../../../api/config/store.ts'
	)) as any)
	;({ default: ZWaveClient } = await import(
		'../../../api/lib/ZwaveClient.ts'
	))
	await jsonStore.init(store)
})

afterAll(() => {
	// Ensure no watcher survives the file, then drop the isolated STORE_DIR
	gwMod.closeWatchers()
	cleanupGatewayHarnessEnv()
})

afterEach(() => {
	// Never let a broker leak into the next test's latestBroker()
	resetMqttBrokers()
})

describe('Gateway custom-device watcher lifecycle', () => {
	it('installs watchers at import and fully releases them; closeWatchers() is reentrant', () => {
		expect(importTimeWatcherCount).toBeGreaterThan(0)

		gwMod.closeWatchers()
		expect(gwMod.__getWatcherCountForTests()).toBe(0)

		expect(() => gwMod.closeWatchers()).not.toThrow()
		expect(gwMod.__getWatcherCountForTests()).toBe(0)
	})
})

describe('real Gateway + MqttClient harness teardown', () => {
	it('releases the broker (client.end) and all watchers on close(), and close() is reentrant', async () => {
		const harness = await createGatewayHarness()
		expect(harness.broker.ended).toBe(false)

		await harness.close()
		expect(harness.broker.ended).toBe(true)
		expect(gwMod.__getWatcherCountForTests()).toBe(0)

		// Second close is a no-op: MqttClient.close short-circuits on
		// this.closed and closeWatchers is idempotent
		await harness.close()
		expect(harness.broker.ended).toBe(true)
		expect(gwMod.__getWatcherCountForTests()).toBe(0)
	})
})

describe('real Gateway.close() lifecycle', () => {
	it('close() runs zwave.close -> cancelJobs -> mqtt.close in order, sets closed, removes listeners, and leaves watchers for separate release', async () => {
		const harness = await createGatewayHarness()

		// The watchers are module-global and an earlier harness close() may
		// already have released them, so rebind to make "present before
		// teardown" deterministic for this test
		gwMod.__rebindWatchersForTests()
		const watchersBefore = gwMod.__getWatcherCountForTests()
		expect(watchersBefore).toBeGreaterThan(0)

		// A real Gateway.start() registered MQTT event listeners
		expect(harness.mqtt.listenerCount('writeRequest')).toBeGreaterThan(0)

		// Seed a scheduled job so cancelJobs() has something concrete to stop
		const job = { stop: vi.fn() }
		;(harness.gw as any).jobs.set('char-test-job', job)

		// Order probe: the Z-Wave connection must close before the broker
		const endSpy = vi.spyOn(harness.broker, 'end')

		expect(harness.gw.closed).toBe(false)
		expect(harness.broker.ended).toBe(false)

		// Drive the real production teardown (not a bypass)
		await harness.gw.close()

		expect(harness.gw.closed).toBe(true)
		expect(harness.zwave.close).toHaveBeenCalledTimes(1)
		expect(job.stop).toHaveBeenCalledTimes(1)
		expect((harness.gw as any).jobs.size).toBe(0)
		expect(harness.broker.ended).toBe(true)
		expect(endSpy).toHaveBeenCalledTimes(1)
		expect(harness.mqtt.listenerCount('writeRequest')).toBe(0)

		// Documented order: Z-Wave closed strictly before the MQTT client
		expect(harness.zwave.close.mock.invocationCallOrder[0]).toBeLessThan(
			endSpy.mock.invocationCallOrder[0],
		)

		// Gateway.close() deliberately leaves the module-global watchers
		expect(gwMod.__getWatcherCountForTests()).toBe(watchersBefore)
		// Only a separate closeWatchers() releases them
		gwMod.closeWatchers()
		expect(gwMod.__getWatcherCountForTests()).toBe(0)
	})
})

describe('real-store isolation', () => {
	it('a real storeDevices() write lands ONLY in the isolated STORE_DIR, never the repo store/', async () => {
		const isolatedNodes = path.join(getTestStoreDir(), 'nodes.json')
		const repoNodes = path.join(repoRoot, 'store', 'nodes.json')
		const repoBefore = existsSync(repoNodes)
			? readFileSync(repoNodes, 'utf8')
			: undefined

		// Drive the real load path (getStoreNodes()) rather than injecting
		// storeNodes, so load -> projection -> write runs end-to-end. The live
		// node map still needs one physical entry (no real controller to build
		// it), the only narrow injection here
		await jsonStore.put(store.nodes, { '0xcleanup': { '4': {} } })

		const socket = createRecordingSocket()
		const zwave = new ZWaveClient({} as any, socket as any)
		;(zwave as any).driverInfo = { name: '0xcleanup' }
		await zwave.getStoreNodes()
		;(zwave as any)._nodes.set(4, { id: 4, hassDevices: {} })

		await zwave.storeDevices(
			{ sensor_x: { type: 'sensor', object_id: 'x' } } as any,
			4,
			false,
		)

		expect(existsSync(isolatedNodes)).toBe(true)
		const persisted = JSON.parse(readFileSync(isolatedNodes, 'utf8'))
		expect(persisted['0xcleanup']['4'].hassDevices.sensor_x).toBeDefined()

		// The real repo store/ is byte-for-byte unchanged
		const repoAfter = existsSync(repoNodes)
			? readFileSync(repoNodes, 'utf8')
			: undefined
		expect(repoAfter).toBe(repoBefore)
	})
})
