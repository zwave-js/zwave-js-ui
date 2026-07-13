import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// Proves a sparse persisted mqtt/zwave/gateway/zniffer settings object reaches its constructor completely unchanged, since threading PersistedSettings through startGateway()/startZniffer() must be a type-only correction

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
	// Mirrors the real GatewayType values so sparseGateway below can reference a named member instead of a raw number
	GatewayType: { VALUEID: 0, NAMED: 1, MANUAL: 2 } as const,
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
import { GatewayType } from '../../../api/lib/Gateway.ts'

describe('startGateway()/startZniffer() constructor boundary (sparse PersistedSettings)', () => {
	let harness: HttpHarness

	beforeAll(async () => {
		harness = await createHttpHarness()
	})

	afterAll(async () => {
		await harness.close()
	})

	it('passes a sparse persisted mqtt/zwave/gateway settings object through to the constructors unchanged', async () => {
		const sparseMqtt = { name: 'sparse-mqtt-only-one-field' }
		const sparseZwave = { port: '/dev/ttySPARSE' }
		const sparseGateway = { type: GatewayType.NAMED }

		await setSettings(harness, {
			mqtt: sparseMqtt,
			zwave: sparseZwave,
			gateway: sparseGateway,
		})

		// POST /api/restart closes the currently-attached gateway before calling startGateway(), so it needs a closeable fake to reach it
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

		// socketManager.io is genuinely undefined here since the harness never calls startServer()
		expect(mqttCtor).toHaveBeenCalledExactlyOnceWith(sparseMqtt)
		expect(zwaveCtor).toHaveBeenCalledExactlyOnceWith(
			sparseZwave,
			undefined,
		)
		expect(gatewayCtor).toHaveBeenCalledOnce()
		const gatewayArgs = gatewayCtor.mock.calls.at(-1)
		expect(gatewayArgs?.[0]).toEqual(sparseGateway)
	})

	it('never constructs MqttClient/ZWaveClient when their settings sections are falsy, but still constructs Gateway', async () => {
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
		// Gateway is always constructed even with zwave/mqtt both absent, preserved pre-existing behavior
		expect(gatewayCtor).toHaveBeenCalledOnce()
	})

	it('passes a sparse persisted zniffer settings object through to ZnifferManager unchanged', async () => {
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
