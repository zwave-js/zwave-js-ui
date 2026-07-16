/**
 * Teardown characterization for the HASS integration surface: a real Gateway
 * close releases its broker and listeners, is reentrant, and closes the Z-Wave
 * connection strictly before the MQTT client. mqtt is the only mocked upstream
 * boundary; the Gateway and MqttClient are real.
 */
import { describe, it, expect, vi } from 'vitest'
import { mqttMockFactory } from './mqttMock.ts'
import { useGatewayHarness } from './gatewayHarness.ts'

vi.mock('mqtt', () => mqttMockFactory())

// The managed accessor closes the current harness in afterEach even if a test
// throws before its own explicit close, and resets the broker registry and
// watchers for the file — so these tests can focus on asserting close() itself.
const gatewayHarness = useGatewayHarness()

describe('Gateway teardown releases the broker', () => {
	it('closing releases the broker and is safe to call twice', async () => {
		const harness = await gatewayHarness.get()
		expect(harness.broker.ended).toBe(false)

		await harness.close()
		expect(harness.broker.ended).toBe(true)

		// Second close is a no-op: MqttClient.close short-circuits on
		// this.closed and closeWatchers is idempotent
		await harness.close()
		expect(harness.broker.ended).toBe(true)
	})
})

describe('Gateway close ordering', () => {
	it('closing stops the Z-Wave connection before the broker and removes listeners', async () => {
		const harness = await gatewayHarness.get()

		// A real Gateway.start() registered MQTT event listeners
		expect(harness.mqtt.listenerCount('writeRequest')).toBeGreaterThan(0)

		// Order probe: the Z-Wave connection must close before the broker
		const endSpy = vi.spyOn(harness.broker, 'end')

		expect(harness.gw.closed).toBe(false)
		expect(harness.broker.ended).toBe(false)

		// Drive the real production teardown (not a bypass)
		await harness.gw.close()

		expect(harness.gw.closed).toBe(true)
		expect(harness.zwave.close).toHaveBeenCalledTimes(1)
		expect(harness.broker.ended).toBe(true)
		expect(endSpy).toHaveBeenCalledTimes(1)
		expect(harness.mqtt.listenerCount('writeRequest')).toBe(0)

		// Documented order: Z-Wave closed strictly before the MQTT client
		expect(harness.zwave.close.mock.invocationCallOrder[0]).toBeLessThan(
			endSpy.mock.invocationCallOrder[0],
		)
	})
})
