import { afterEach, describe, expect, it, vi } from 'vitest'
import { mqttMockFactory } from './mqttMock.ts'
import {
	createGatewayHarness,
	type GatewayHarness,
	useGatewayHarness,
} from './gatewayHarness.ts'

vi.mock('mqtt', () => mqttMockFactory())

const gatewayHarness = useGatewayHarness()
const manualHarnesses: GatewayHarness[] = []

afterEach(async () => {
	for (const harness of manualHarnesses.splice(0)) {
		await harness.close()
	}
})

describe('Gateway cleanup', () => {
	it('releases the broker and is safe to call twice', async () => {
		const harness = await gatewayHarness.get()
		expect(harness.broker.ended).toBe(false)

		await harness.close()
		expect(harness.broker.ended).toBe(true)

		await harness.close()
		expect(harness.broker.ended).toBe(true)
	})

	it('disconnects MQTT and Z-Wave events on close', async () => {
		const harness = await gatewayHarness.get()
		expect(harness.broker.ended).toBe(false)
		expect(harness.mqtt.listenerCount('writeRequest')).toBeGreaterThan(0)
		expect(harness.zwave.listenerCount('nodeInited')).toBeGreaterThan(0)

		await harness.close()

		expect(harness.broker.ended).toBe(true)
		expect(harness.mqtt.listenerCount('writeRequest')).toBe(0)
		expect(harness.zwave.listenerCount('nodeInited')).toBe(0)
	})

	it('closes simultaneous gateways independently', async () => {
		const first = await createGatewayHarness()
		const second = await createGatewayHarness()
		manualHarnesses.push(first, second)

		await second.close()

		expect(second.broker.ended).toBe(true)
		expect(second.zwave.listenerCount('nodeInited')).toBe(0)
		expect(first.broker.ended).toBe(false)
		expect(first.zwave.listenerCount('nodeInited')).toBeGreaterThan(0)

		await first.close()

		expect(first.broker.ended).toBe(true)
		expect(first.zwave.listenerCount('nodeInited')).toBe(0)
	})

	it('disconnects MQTT when Z-Wave shutdown fails', async () => {
		const harness = await createGatewayHarness()
		manualHarnesses.push(harness)
		const closeError = new Error('zwave close failed')
		harness.zwave.close.mockRejectedValueOnce(closeError)

		await expect(harness.gw.close()).rejects.toBe(closeError)

		expect(harness.broker.ended).toBe(true)
		expect(harness.mqtt.listenerCount('writeRequest')).toBe(0)
		expect(harness.zwave.listenerCount('nodeInited')).toBe(0)
	})

	it('closes Z-Wave before MQTT and marks the gateway closed', async () => {
		const harness = await gatewayHarness.get()
		const endSpy = vi.spyOn(harness.broker, 'end')

		await harness.gw.close()

		expect(harness.gw.closed).toBe(true)
		expect(harness.zwave.close).toHaveBeenCalled()
		expect(endSpy).toHaveBeenCalled()
		expect(harness.zwave.close.mock.invocationCallOrder[0]).toBeLessThan(
			endSpy.mock.invocationCallOrder[0],
		)
	})
})
