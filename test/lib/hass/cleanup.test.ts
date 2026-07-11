/**
 * Cleanup / reentrancy / real-store-isolation regression tests for the HASS
 * integration surface. These guard the invariants the rest of the suite relies
 * on so that, in ANY test order, nothing leaks between files or into the real
 * repository `store/` directory:
 *
 *   - `api/lib/Gateway.ts` custom-device `fs.watch` watchers install at import
 *     and are fully releasable via `closeWatchers()` (idempotent / reentrant).
 *   - A real `Gateway` + real `MqttClient` harness releases its broker
 *     (`client.end()`) and every watcher on `close()`, and `close()` is safe to
 *     call more than once.
 *   - The real `Gateway.close()` teardown path runs `zwave.close()` ->
 *     `cancelJobs()` -> `mqtt.close()` in that order, flips `closed`, removes
 *     the MQTT listeners it registered, and deliberately leaves the
 *     module-global custom-device watchers for a separate `closeWatchers()`.
 *   - Multiple harnesses can be torn down in arbitrary order with no residual
 *     watchers or open brokers.
 *   - A real `ZwaveClient.storeDevices()` disk write lands ONLY in this file's
 *     isolated STORE_DIR and never mutates the repo `store/` directory.
 *
 * `mqtt` is the only mocked upstream boundary; `Gateway`/`MqttClient`/
 * `ZwaveClient` are the real modules, imported dynamically AFTER
 * `ensureTestEnv()`.
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

beforeAll(async () => {
	ensureTestEnv()
	gwMod = await import('../../../api/lib/Gateway.ts')
	// captured ONCE, before any test closes watchers, so the assertion below is
	// independent of the order tests run in
	importTimeWatcherCount = gwMod.__getWatcherCountForTests()

	const { default: jsonStore } = (await import(
		'../../../api/lib/jsonStore.ts'
	)) as any
	const { default: store } = (await import(
		'../../../api/config/store.ts'
	)) as any
	;({ default: ZWaveClient } = await import(
		'../../../api/lib/ZwaveClient.ts'
	))
	await jsonStore.init(store)
})

afterAll(() => {
	// belt-and-suspenders: ensure no watcher survives the file, then drop the
	// isolated STORE_DIR
	gwMod.closeWatchers()
	cleanupGatewayHarnessEnv()
})

afterEach(() => {
	// never let a broker leak into the next test's `latestBroker()`
	resetMqttBrokers()
})

describe('Gateway custom-device watcher lifecycle', () => {
	it('installs watchers at import and fully releases them; closeWatchers() is reentrant', () => {
		expect(importTimeWatcherCount).toBeGreaterThan(0)

		gwMod.closeWatchers()
		expect(gwMod.__getWatcherCountForTests()).toBe(0)

		// calling again must be a safe no-op (no throw, still zero)
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

		// second close is a safe no-op (MqttClient.close short-circuits on
		// `this.closed`; closeWatchers is idempotent)
		await harness.close()
		expect(harness.broker.ended).toBe(true)
		expect(gwMod.__getWatcherCountForTests()).toBe(0)
	})

	it('tears down two harnesses in reverse creation order with no residual watchers or open brokers', async () => {
		const h1 = await createGatewayHarness()
		const h2 = await createGatewayHarness()
		const b1 = h1.broker
		const b2 = h2.broker

		// close in the OPPOSITE order they were created
		await h2.close()
		await h1.close()

		expect(b1.ended).toBe(true)
		expect(b2.ended).toBe(true)
		expect(gwMod.__getWatcherCountForTests()).toBe(0)
	})
})

describe('real Gateway.close() lifecycle', () => {
	it('close() runs zwave.close -> cancelJobs -> mqtt.close in order, sets closed, removes listeners, and leaves watchers for separate release', async () => {
		const harness = await createGatewayHarness()

		// The custom-device watchers are module-global and an earlier harness
		// close() in this worker may already have released them, so rebind to
		// make "present before teardown" deterministic for THIS test.
		gwMod.__rebindWatchersForTests()
		const watchersBefore = gwMod.__getWatcherCountForTests()
		expect(watchersBefore).toBeGreaterThan(0)

		// a real Gateway.start() registered MQTT event listeners
		expect(harness.mqtt.listenerCount('writeRequest')).toBeGreaterThan(0)

		// seed a scheduled job so cancelJobs() has something concrete to stop
		const job = { stop: vi.fn() }
		;(harness.gw as any).jobs.set('char-test-job', job)

		// order probe: the Z-Wave connection must be closed BEFORE the broker
		const endSpy = vi.spyOn(harness.broker, 'end')

		expect(harness.gw.closed).toBe(false)
		expect(harness.broker.ended).toBe(false)

		// drive the REAL production teardown (not a bypass)
		await harness.gw.close()

		// closed flag flipped
		expect(harness.gw.closed).toBe(true)
		// Z-Wave connection closed exactly once
		expect(harness.zwave.close).toHaveBeenCalledTimes(1)
		// scheduled jobs stopped and cleared
		expect(job.stop).toHaveBeenCalledTimes(1)
		expect((harness.gw as any).jobs.size).toBe(0)
		// MQTT broker ended and the wrapper removed its listeners
		expect(harness.broker.ended).toBe(true)
		expect(endSpy).toHaveBeenCalledTimes(1)
		expect(harness.mqtt.listenerCount('writeRequest')).toBe(0)

		// documented order: Z-Wave closed strictly before the MQTT client
		expect(harness.zwave.close.mock.invocationCallOrder[0]).toBeLessThan(
			endSpy.mock.invocationCallOrder[0],
		)

		// Gateway.close() deliberately does NOT touch the module-global
		// watchers - they are STILL present immediately after close()...
		expect(gwMod.__getWatcherCountForTests()).toBe(watchersBefore)
		// ...and only a separate closeWatchers() releases them.
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

		const socket = createRecordingSocket()
		const zwave = new ZWaveClient({} as any, socket as any)
		;(zwave as any).driverInfo = { name: '0xcleanup' }
		;(zwave as any).storeNodes = { 4: {} }
		;(zwave as any)._nodes.set(4, { id: 4, hassDevices: {} })

		await zwave.storeDevices(
			{ sensor_x: { type: 'sensor', object_id: 'x' } } as any,
			4,
			false,
		)

		// the write really happened, in the isolated dir
		expect(existsSync(isolatedNodes)).toBe(true)
		const persisted = JSON.parse(readFileSync(isolatedNodes, 'utf8'))
		expect(persisted['0xcleanup']['4'].hassDevices.sensor_x).toBeDefined()

		// the real repo store/ is byte-for-byte unchanged
		const repoAfter = existsSync(repoNodes)
			? readFileSync(repoNodes, 'utf8')
			: undefined
		expect(repoAfter).toBe(repoBefore)
	})
})
