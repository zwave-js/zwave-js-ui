import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

/**
 * Characterizes the exact boundary introduced while fixing the review
 * finding "removes the unsafe `PersistedSettings as Settings` cast" (see
 * `startGateway()`/`startZniffer()` in `api/app.ts`): a sparse (partial)
 * persisted `mqtt`/`zwave`/`gateway`/`zniffer` settings object must reach
 * `MqttClient`/`ZWaveClient`/`Gateway`/`ZnifferManager`'s constructors
 * completely unchanged - no field added, defaulted, or dropped - because
 * the type change threading `PersistedSettings` through `startGateway()`
 * must be purely a type-level correction, not a behavior change.
 *
 * `MqttClient`/`ZWaveClient`/`Gateway`/`ZnifferManager` are mocked here (this
 * file's own isolated module graph - see `authRateLimit.test.ts` for why
 * that's safe) purely to capture constructor arguments; nothing else in the
 * suite relies on their real behavior.
 */

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
		const sparseGateway = { type: 1 }

		await setSettings(harness, {
			mqtt: sparseMqtt,
			zwave: sparseZwave,
			gateway: sparseGateway,
		})

		// `POST /api/restart` closes the currently-attached gateway before
		// calling the real `startGateway()` - give it a closeable fake so
		// the route reaches `startGateway()` (whose constructor calls are
		// what this test actually characterizes).
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

		// Exactly the persisted sparse objects, verbatim - no added keys,
		// no defaults synthesized by the type change. The harness never
		// calls `startServer()` (see `harness.ts`), so `socketManager.io`
		// is genuinely `undefined` here - that's an accurate reflection of
		// this test environment, not a behavior change.
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
		// Gateway is always constructed, even with zwave/mqtt both absent -
		// preserved pre-existing behavior, untouched by this fix.
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
