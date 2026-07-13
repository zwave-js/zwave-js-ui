import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const mqttCtor = vi.fn()
const zwaveCtor = vi.fn()
const gatewayCtor = vi.fn()
const znifferCtor = vi.fn()

vi.mock('../../../api/lib/MqttClient.ts', () => ({
	default: class MockMqttClient {
		constructor(...args: unknown[]) {
			mqttCtor(...args)
		}
		on = vi.fn()
	},
}))

vi.mock('../../../api/lib/ZwaveClient.ts', () => ({
	default: class MockZWaveClient {
		constructor(...args: unknown[]) {
			zwaveCtor(...args)
		}
		on = vi.fn()
		connect = vi.fn(() => Promise.resolve())
	},
}))

vi.mock('../../../api/lib/Gateway.ts', () => ({
	default: class MockGateway {
		constructor(...args: unknown[]) {
			gatewayCtor(...args)
		}
		start = vi.fn(() => Promise.resolve())
	},
	closeWatchers: vi.fn(),
}))

vi.mock('../../../api/lib/ZnifferManager.ts', () => ({
	default: class MockZnifferManager {
		constructor(...args: unknown[]) {
			znifferCtor(...args)
		}
	},
}))

import { createHttpHarness, type HttpHarness } from './harness.ts'
import { setSettings } from './authHelpers.ts'
import { createFakeGateway } from './fakes.ts'

describe('sparse persisted settings', () => {
	let harness: HttpHarness

	beforeAll(async () => {
		harness = await createHttpHarness()
	})

	afterAll(async () => {
		await harness.close()
	})

	it('accepts sparse persisted MQTT, Z-Wave, and gateway settings unchanged', async () => {
		const sparseMqtt = { name: 'sparse-mqtt-only-one-field' }
		const sparseZwave = { port: '/dev/ttySPARSE' }
		const sparseGateway = { sendEvents: true }

		await setSettings(harness, {
			mqtt: sparseMqtt,
			zwave: sparseZwave,
			gateway: sparseGateway,
		})

		// The restart route closes the active gateway before constructing its replacement
		harness.testHooks.setGateway(createFakeGateway())

		mqttCtor.mockClear()
		zwaveCtor.mockClear()
		gatewayCtor.mockClear()

		const res = await harness.request.post('/api/restart')

		expect(res.status).toBe(200)
		expect(res.body).toEqual({
			success: true,
			message: 'Gateway restarted successfully',
		})

		// The harness leaves the Socket.IO server unset
		expect(mqttCtor).toHaveBeenCalledExactlyOnceWith(sparseMqtt)
		expect(zwaveCtor).toHaveBeenCalledExactlyOnceWith(
			sparseZwave,
			undefined,
		)
		expect(gatewayCtor).toHaveBeenCalledOnce()
		const gatewayArgs = gatewayCtor.mock.calls.at(-1)
		expect(gatewayArgs?.[0]).toEqual(sparseGateway)
	})

	it('skips absent MQTT and Z-Wave settings while still starting the gateway', async () => {
		await setSettings(harness, { mqtt: undefined, zwave: undefined })
		harness.testHooks.setGateway(createFakeGateway())

		mqttCtor.mockClear()
		zwaveCtor.mockClear()
		gatewayCtor.mockClear()

		const res = await harness.request.post('/api/restart')

		expect(res.status).toBe(200)
		expect(res.body.success).toBe(true)
		expect(mqttCtor).not.toHaveBeenCalled()
		expect(zwaveCtor).not.toHaveBeenCalled()
		expect(gatewayCtor).toHaveBeenCalledOnce()
	})

	it('accepts sparse persisted Zniffer settings unchanged', async () => {
		const sparseZniffer = { securityKeys: {} }

		await setSettings(harness, {
			mqtt: undefined,
			zwave: undefined,
			zniffer: sparseZniffer,
		})
		harness.testHooks.setGateway(createFakeGateway())

		znifferCtor.mockClear()

		const res = await harness.request.post('/api/restart')

		expect(res.status).toBe(200)
		expect(res.body.success).toBe(true)
		expect(znifferCtor).toHaveBeenCalledExactlyOnceWith(
			sparseZniffer,
			undefined,
		)
	})
})
