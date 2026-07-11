import { describe, it, expect, vi } from 'vitest'
import { useHttpHarness } from './harness.ts'
import { createFakeGateway } from '../shared/fakes.ts'
import { createFakeZniffer } from '../socket/fakes.ts'
import { setSettings } from '../shared/authHelpers.ts'

describe('HTTP contract: settings, restart, statistics, versions', () => {
	const getHarness = useHttpHarness()

	describe('GET /api/settings', () => {
		it('returns the settings envelope with devices/scales/flags', async () => {
			const harness = await getHarness()
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
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request.get('/api/settings')
			expect(res.body.devices).toEqual({ 2: { name: 'Fake device' } })
		})

		it('adds zwave.port/zwave.enabled to managedExternally when ZWAVE_PORT is set via env var', async () => {
			const harness = await getHarness()
			const previous = process.env.ZWAVE_PORT
			process.env.ZWAVE_PORT = '/dev/ttyFAKE-env'
			try {
				const res = await harness.request.get('/api/settings')

				expect(res.status).toBe(200)
				expect(res.body.managedExternally).toEqual(
					expect.arrayContaining(['zwave.port', 'zwave.enabled']),
				)
			} finally {
				if (previous === undefined) {
					delete process.env.ZWAVE_PORT
				} else {
					process.env.ZWAVE_PORT = previous
				}
			}
		})
	})

	describe('GET /api/serial-ports', () => {
		it('returns exactly the ports the (mocked) enumerator resolves, with no real serial/mDNS I/O', async () => {
			const harness = await getHarness()
			harness.enumerateSerialPorts.mockImplementation((options) => {
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
			const harness = await getHarness()
			harness.enumerateSerialPorts.mockResolvedValue([])

			const res = await harness.request.get('/api/serial-ports')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({ success: true, serial_ports: [] })
		})

		it('an enumerator rejection is caught and reported as a failed-but-200 envelope with an empty list', async () => {
			const harness = await getHarness()
			harness.enumerateSerialPorts.mockRejectedValue(new Error('boom'))

			const res = await harness.request.get('/api/serial-ports')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({ success: false, serial_ports: [] })
		})

		it('skips enumeration entirely (no enumerator call) when ZWAVE_PORT is set via env var (if-condition false branch)', async () => {
			const harness = await getHarness()
			harness.enumerateSerialPorts.mockImplementation(() => {
				throw new Error('must not be called when ZWAVE_PORT is set')
			})

			const previous = process.env.ZWAVE_PORT
			process.env.ZWAVE_PORT = '/dev/ttyFAKE-env'
			try {
				const res = await harness.request.get('/api/serial-ports')

				expect(res.status).toBe(200)
				expect(res.body).toEqual({
					success: true,
					serial_ports: [],
				})
			} finally {
				if (previous === undefined) {
					delete process.env.ZWAVE_PORT
				} else {
					process.env.ZWAVE_PORT = previous
				}
			}
		})
	})

	describe('POST /api/settings', () => {
		it('rejects immediately while a restart is already in progress, without touching the store', async () => {
			const harness = await getHarness({ restarting: true })

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
			const harness = await getHarness()
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
			const harness = await getHarness()
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
			const harness = await getHarness({ gateway: gw })

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

		it('updates the driver in-place via buildPreferences() when only "scales" changed and a driver is attached', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })
			await setSettings(harness, { zwave: {} })

			const current = harness.jsonStore.get(
				harness.store.settings,
			) as Record<string, any>

			const res = await harness.request.post('/api/settings').send({
				...current,
				zwave: {
					...current.zwave,
					scales: [{ key: 'humidity', label: '%' }],
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
				preferences: expect.anything(),
			})
		})

		it('updates the driver in-place via buildLogConfig() when only a logConfig-related key changed and a driver is attached', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })
			await setSettings(harness, { zwave: {} })

			const current = harness.jsonStore.get(
				harness.store.settings,
			) as Record<string, any>

			const res = await harness.request.post('/api/settings').send({
				...current,
				zwave: {
					...current.zwave,
					logLevel: 'debug',
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
				logConfig: expect.anything(),
			})
		})

		it('requires a full restart with a "non-editable settings changed" reason when a non-editable Z-Wave key changes (and no prior zwave settings existed)', async () => {
			const harness = await getHarness()
			await setSettings(harness, { zwave: undefined })
			const current = harness.jsonStore.get(
				harness.store.settings,
			) as Record<string, unknown>

			const res = await harness.request.post('/api/settings').send({
				...current,
				zwave: { someNonEditableSetting: true },
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

		it('requires a full restart when the incoming body omits "zwave" entirely but stored settings had a truthy zwave object', async () => {
			const harness = await getHarness()
			await setSettings(harness, { zwave: { someRealSetting: 1 } })
			const current = harness.jsonStore.get(
				harness.store.settings,
			) as Record<string, unknown>
			const { zwave: _zwave, ...withoutZwave } = current

			const res = await harness.request
				.post('/api/settings')
				.send(withoutZwave)

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

		it('requires a full restart with a "driver not available" reason when only an editable Z-Wave key changes but no gateway is attached', async () => {
			const harness = await getHarness()
			await setSettings(harness, { zwave: {} })
			const current = harness.jsonStore.get(
				harness.store.settings,
			) as Record<string, any>

			const res = await harness.request.post('/api/settings').send({
				...current,
				zwave: {
					...current.zwave,
					nodeFilter: [1, 2, 3],
				},
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

		it('requires a restart via the zniffer-changed check alone, even when gateway/mqtt/zwave are all unchanged', async () => {
			const harness = await getHarness()
			await setSettings(harness, { zniffer: { enabled: false } })
			const current = harness.jsonStore.get(
				harness.store.settings,
			) as Record<string, unknown>

			const res = await harness.request.post('/api/settings').send({
				...current,
				zniffer: { enabled: true },
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
	})

	describe('POST /api/restart', () => {
		it('rejects immediately while a restart is already in progress', async () => {
			const harness = await getHarness({ restarting: true })

			const res = await harness.request.post('/api/restart')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message:
					'Gateway is already restarting, wait a moment before doing another request',
			})
		})

		it.each([
			['no gateway attached at all', undefined],
			[
				'a gateway attached but with no zwave client',
				createFakeGateway({ zwave: undefined }),
			],
		])(
			'fails with the clean "Z-Wave client not inited" error with %s, without closing anything',
			async (_label, gateway) => {
				const harness = await getHarness({ gateway })

				const res = await harness.request.post('/api/restart')

				expect(res.status).toBe(200)
				expect(res.body).toEqual({
					success: false,
					message: 'Z-Wave client not inited',
				})
				if (gateway) {
					expect(gateway.close).not.toHaveBeenCalled()
				}
			},
		)

		it('restarts successfully end-to-end (real startGateway(), zwave/mqtt kept disabled), and clears the restarting flag so a follow-up restart is accepted', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })
			await setSettings(harness, {
				zwave: undefined,
				mqtt: undefined,
				zniffer: undefined,
			})

			const res = await harness.request.post('/api/restart')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				message: 'Gateway restarted successfully',
			})
			expect(gw.close).toHaveBeenCalledOnce()

			// A follow-up restart being accepted proves `restarting` was cleared after the first one
			const followUp = await harness.request.post('/api/restart')
			expect(followUp.body.message).not.toMatch(/already restarting/)
		})

		it(
			'a request after restart reflects the freshly-started gateway, never a stale pre-restart reference ' +
				'(per-request-fresh-resolution regression - see AppRuntime.ts and test/runtime/AppRuntime.test.ts)',
			async () => {
				const oldGw = createFakeGateway()
				oldGw.zwave.devices = { 1: { name: 'Old device' } }
				const harness = await getHarness({ gateway: oldGw })
				await setSettings(harness, {
					zwave: undefined,
					mqtt: undefined,
					zniffer: undefined,
				})

				const before = await harness.request.get('/api/settings')
				expect(before.body.devices).toEqual({
					1: { name: 'Old device' },
				})

				const restartRes = await harness.request.post('/api/restart')
				expect(restartRes.body).toEqual({
					success: true,
					message: 'Gateway restarted successfully',
				})

				// `startGateway()` replaced the runtime's gateway with a
				// brand-new real `Gateway` (zwave/mqtt disabled per this
				// test's settings, so it has no `zwave` client at all). If
				// any consumer had cached the pre-restart fake instead of
				// resolving the gateway fresh per request, this follow-up
				// request would still see the old gateway's devices - it
				// must not.
				const after = await harness.request.get('/api/settings')
				expect(after.body.devices).toEqual({})
			},
		)

		it('cancels an active debug session before restarting (isSessionActive() true branch)', async () => {
			const gw = createFakeGateway()
			gw.zwave.driverReady = false
			const harness = await getHarness({ gateway: gw })
			await setSettings(harness, {
				zwave: undefined,
				mqtt: undefined,
				zniffer: undefined,
			})

			await harness.request.post('/api/debug/start').send({})
			const statusBefore = await harness.request.get('/api/debug/status')
			expect(statusBefore.body).toEqual({
				success: true,
				active: true,
			})

			const res = await harness.request.post('/api/restart')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				message: 'Gateway restarted successfully',
			})

			const statusAfter = await harness.request.get('/api/debug/status')
			expect(statusAfter.body).toEqual({
				success: true,
				active: false,
			})
		})

		it('closes an existing zniffer before restarting (oldZniffer truthy branch)', async () => {
			const gw = createFakeGateway()
			const fakeZniffer = createFakeZniffer({
				close: vi.fn(() => Promise.resolve()),
			})
			const harness = await getHarness({
				gateway: gw,
				zniffer: fakeZniffer,
			})
			await setSettings(harness, {
				zwave: undefined,
				mqtt: undefined,
				zniffer: undefined,
			})

			const res = await harness.request.post('/api/restart')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				message: 'Gateway restarted successfully',
			})
			expect(fakeZniffer.close).toHaveBeenCalledOnce()
		})

		it('restarts successfully without a "gateway" key in settings (settings.gateway falsy branch)', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })
			await setSettings(harness, {
				zwave: undefined,
				mqtt: undefined,
				gateway: undefined,
				zniffer: undefined,
			})

			const res = await harness.request.post('/api/restart')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				message: 'Gateway restarted successfully',
			})
		})
	})

	describe('POST /api/statistics', () => {
		it('rejects immediately while a restart is already in progress', async () => {
			const harness = await getHarness({ restarting: true })

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
			const harness = await getHarness({ gateway: gw })

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
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request
				.post('/api/statistics')
				.send({ enableStatistics: false })

			expect(res.status).toBe(200)
			expect(res.body.enabled).toBe(false)
			expect(gw.zwave.disableStatistics).toHaveBeenCalledOnce()
			expect(gw.zwave.enableStatistics).not.toHaveBeenCalled()
		})

		it('does not touch gw when no gateway is attached, but still persists settings', async () => {
			const harness = await getHarness()
			const res = await harness.request
				.post('/api/statistics')
				.send({ enableStatistics: true })

			expect(res.status).toBe(200)
			expect(res.body.success).toBe(true)
		})
	})

	describe('POST /api/versions', () => {
		it('persists gateway.versions and disableChangelog, and returns the success envelope', async () => {
			const harness = await getHarness()
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
