/**
 * Teardown characterization for the HASS integration surface: a real
 * `Gateway.close()` releases its broker and listeners, is reentrant, and closes
 * the Z-Wave connection strictly before the MQTT client. `mqtt` is the only
 * mocked upstream boundary; `Gateway`/`MqttClient` are real, imported after
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
import { ensureTestEnv } from './env.ts'
import { mqttMockFactory, resetMqttBrokers } from './mqttMock.ts'
import {
	createGatewayHarness,
	cleanupGatewayHarnessEnv,
} from './gatewayHarness.ts'
import type * as GatewayModuleNS from '../../../api/lib/Gateway.ts'

vi.mock('mqtt', () => mqttMockFactory())

type GatewayModule = typeof GatewayModuleNS

let gwMod: GatewayModule

beforeAll(async () => {
	ensureTestEnv()
	gwMod = await import('../../../api/lib/Gateway.ts')
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

describe('real Gateway + MqttClient harness teardown', () => {
	it('releases the broker (client.end) on close(), and close() is reentrant', async () => {
		const harness = await createGatewayHarness()
		expect(harness.broker.ended).toBe(false)

		await harness.close()
		expect(harness.broker.ended).toBe(true)

		// Second close is a no-op: MqttClient.close short-circuits on
		// this.closed and closeWatchers is idempotent
		await harness.close()
		expect(harness.broker.ended).toBe(true)
	})
})

describe('real Gateway.close() lifecycle', () => {
	it('close() runs zwave.close -> cancelJobs -> mqtt.close in order, sets closed, and removes listeners', async () => {
		const harness = await createGatewayHarness()

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
	})
})
