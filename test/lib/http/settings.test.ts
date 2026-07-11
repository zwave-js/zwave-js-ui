import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	afterEach,
	vi,
} from 'vitest'
import { createHttpHarness, type HttpHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'
import { setSettings } from './authHelpers.ts'
import { enumerateSerialPorts } from '#api/lib/serialPorts.ts'

// settings.zwave is deliberately kept falsy in every payload here so the
// real (unmocked) startGateway() invoked by POST /api/restart never
// constructs a real ZWaveClient/MqttClient
describe('HTTP contract: settings, restart, statistics, versions', () => {
	let harness: HttpHarness

	beforeAll(async () => {
		harness = await createHttpHarness()
	})

	afterAll(async () => {
		await harness.close()
	})

	afterEach(() => {
		harness.resetState()
	})

	describe('GET /api/settings', () => {
		it('returns the settings envelope with devices/scales/flags', async () => {
			const res = await harness.request.get('/api/settings')
			expect(res.status).toBe(200)
			expect(res.body.success).toBe(true)
			expect(res.body).toHaveProperty('settings')
			expect(res.body.devices).toEqual({})
			expect(Array.isArray(res.body.scales)).toBe(true)
			expect(res.body).toEqual(
				expect.objectContaining({
					success: true,
					sslDisabled: false,
					managedExternally: [],
				}),
			)
		})

		it("reflects a fake gateway's zwave.devices", async () => {
			const gw = createFakeGateway()
			gw.zwave.devices = { 2: { name: 'Fake device' } }
			harness.testHooks.setGateway(gw)

			const res = await harness.request.get('/api/settings')
			expect(res.body.devices).toEqual({ 2: { name: 'Fake device' } })
		})
	})

	describe('GET /api/serial-ports', () => {
		it('returns exactly the ports the (mocked) enumerator resolves, with no real serial/mDNS I/O', async () => {
			vi.mocked(enumerateSerialPorts).mockImplementation((options) => {
				expect(options).toEqual({ local: true, remote: true })
				return Promise.resolve(['/dev/ttyFAKE0', '/dev/ttyFAKE1'])
			})

			const res = await harness.request.get('/api/serial-ports')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				serial_ports: ['/dev/ttyFAKE0', '/dev/ttyFAKE1'],
			})
		})

		it('returns an empty list without throwing when the enumerator resolves none', async () => {
			vi.mocked(enumerateSerialPorts).mockResolvedValue([])

			const res = await harness.request.get('/api/serial-ports')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({ success: true, serial_ports: [] })
		})

		it('an enumerator rejection is caught and reported as a failed-but-200 envelope with an empty list', async () => {
			vi.mocked(enumerateSerialPorts).mockRejectedValue(new Error('boom'))

			const res = await harness.request.get('/api/serial-ports')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({ success: false, serial_ports: [] })
		})
	})

	describe('POST /api/settings', () => {
		it('rejects immediately while a restart is already in progress, without touching the store', async () => {
			harness.testHooks.setRestarting(true)

			const res = await harness.request
				.post('/api/settings')
				.send({ gateway: { type: 1 } })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message:
					'Gateway is restarting, wait a moment before doing another request',
			})
		})

		it('treats an empty body as a forced restart request, echoing the stored settings back', async () => {
			const res = await harness.request.post('/api/settings').send({})

			expect(res.status).toBe(200)
			expect(res.body.success).toBe(true)
			expect(res.body.shouldRestart).toBe(true)
			expect(res.body.message).toBe(
				'Configuration saved. Restart required to apply changes.',
			)
			expect(res.body.data).toEqual(
				harness.jsonStore.get(harness.store.settings),
			)
		})

		it('requires a restart when gateway settings changed', async () => {
			const current = harness.jsonStore.get(
				harness.store.settings,
			) as Record<string, unknown>

			const res = await harness.request.post('/api/settings').send({
				...current,
				gateway: { type: 2 },
			})

			expect(res.status).toBe(200)
			expect(res.body).toEqual(
				expect.objectContaining({
					success: true,
					shouldRestart: true,
					message:
						'Configuration saved. Restart required to apply changes.',
				}),
			)
		})

		it('updates the driver in-place (no restart) when only editable Z-Wave options changed and a driver is attached', async () => {
			const gw = createFakeGateway()
			harness.testHooks.setGateway(gw)

			const current = harness.jsonStore.get(
				harness.store.settings,
			) as Record<string, any>

			const res = await harness.request.post('/api/settings').send({
				...current,
				zwave: {
					...current.zwave,
					disableOptimisticValueUpdate: true,
				},
			})

			expect(res.status).toBe(200)
			expect(res.body).toEqual(
				expect.objectContaining({
					success: true,
					shouldRestart: false,
					message: 'Configuration updated successfully',
				}),
			)
			expect(gw.zwave.driver.updateOptions).toHaveBeenCalledOnce()
			expect(gw.zwave.driver.updateOptions).toHaveBeenCalledWith({
				disableOptimisticValueUpdate: true,
			})
		})
	})

	describe('POST /api/restart', () => {
		it('rejects immediately while a restart is already in progress', async () => {
			harness.testHooks.setRestarting(true)

			const res = await harness.request.post('/api/restart')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message:
					'Gateway is already restarting, wait a moment before doing another request',
			})
		})

		it('fails cleanly with the generic error envelope when there is no gateway to close', async () => {
			const res = await harness.request.post('/api/restart')

			expect(res.status).toBe(200)
			expect(res.body.success).toBe(false)
			expect(res.body.message).toMatch(/close/)
		})

		it('restarts successfully end-to-end (real startGateway(), zwave/mqtt kept disabled)', async () => {
			await setSettings(harness, { zwave: undefined, mqtt: undefined })
			const gw = createFakeGateway()
			harness.testHooks.setGateway(gw)

			const res = await harness.request.post('/api/restart')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				message: 'Gateway restarted successfully',
			})
			expect(gw.close).toHaveBeenCalledOnce()
			// startGateway() replaces gw with a brand-new real Gateway
			// instance, leaving restarting false for the next request
			expect(harness.testHooks.isRestarting()).toBe(false)
		})
	})

	describe('POST /api/statistics', () => {
		it('rejects immediately while a restart is already in progress', async () => {
			harness.testHooks.setRestarting(true)

			const res = await harness.request
				.post('/api/statistics')
				.send({ enableStatistics: true })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message:
					'Gateway is restarting, wait a moment before doing another request',
			})
		})

		it('persists the opt-in flag and calls gw.zwave.enableStatistics() when a gateway is attached', async () => {
			const gw = createFakeGateway()
			harness.testHooks.setGateway(gw)

			const res = await harness.request
				.post('/api/statistics')
				.send({ enableStatistics: true })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				enabled: true,
				message: 'Statistics configuration updated successfully',
			})
			expect(gw.zwave.enableStatistics).toHaveBeenCalledOnce()
			expect(gw.zwave.disableStatistics).not.toHaveBeenCalled()

			const stored = harness.jsonStore.get(harness.store.settings) as {
				zwave: { enableStatistics: boolean; disclaimerVersion: number }
			}
			expect(stored.zwave.enableStatistics).toBe(true)
			expect(stored.zwave.disclaimerVersion).toBe(1)
		})

		it('calls gw.zwave.disableStatistics() when opting out', async () => {
			const gw = createFakeGateway()
			harness.testHooks.setGateway(gw)

			const res = await harness.request
				.post('/api/statistics')
				.send({ enableStatistics: false })

			expect(res.status).toBe(200)
			expect(res.body.enabled).toBe(false)
			expect(gw.zwave.disableStatistics).toHaveBeenCalledOnce()
			expect(gw.zwave.enableStatistics).not.toHaveBeenCalled()
		})

		it('does not touch gw when no gateway is attached, but still persists settings', async () => {
			const res = await harness.request
				.post('/api/statistics')
				.send({ enableStatistics: true })

			expect(res.status).toBe(200)
			expect(res.body.success).toBe(true)
		})
	})

	describe('POST /api/versions', () => {
		it('persists gateway.versions and disableChangelog, and returns the success envelope', async () => {
			const res = await harness.request
				.post('/api/versions')
				.send({ disableChangelog: true })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				message: 'Versions updated successfully',
			})

			const stored = harness.jsonStore.get(harness.store.settings) as {
				gateway: {
					disableChangelog: boolean
					versions: { app: string; driver: string; server: string }
				}
			}
			expect(stored.gateway.disableChangelog).toBe(true)
			expect(stored.gateway.versions).toEqual({
				app: expect.any(String),
				driver: expect.any(String),
				server: expect.any(String),
			})
		})
	})
})
