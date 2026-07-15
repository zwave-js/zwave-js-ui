import { describe, it, expect } from 'vitest'
import { useHttpHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'

describe('HTTP contract: health & version', () => {
	const getHarness = useHttpHarness()

	describe('GET /health', () => {
		it('returns 500 "Error" (text) when no gateway has been started', async () => {
			const harness = await getHarness()
			const res = await harness.request.get('/health')
			expect(res.status).toBe(500)
			expect(res.type).toBe('text/html')
			expect(res.text).toBe('Error')
		})

		it('returns 200 "Ok" when both mqtt and zwave are connected', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request.get('/health')
			expect(res.status).toBe(200)
			expect(res.text).toBe('Ok')
		})

		it('returns 500 "Error" when zwave is disconnected even if mqtt is fine', async () => {
			const gw = createFakeGateway()
			gw.zwave.getStatus.mockReturnValue({
				driverReady: false,
				status: false,
				config: {},
			})
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request.get('/health')
			expect(res.status).toBe(500)
			expect(res.text).toBe('Error')
		})

		it('treats a disabled mqtt client as healthy (#469)', async () => {
			const gw = createFakeGateway()
			gw.mqtt.getStatus.mockReturnValue({
				status: false,
				error: 'Offline',
				config: { disabled: true },
			})

			const harness = await getHarness({ gateway: gw })

			const res = await harness.request.get('/health')
			expect(res.status).toBe(200)
			expect(res.text).toBe('Ok')
		})
	})

	describe('GET /health/:client', () => {
		it('returns 500 "Error" for zwave when no gateway is set', async () => {
			const harness = await getHarness()
			const res = await harness.request.get('/health/zwave')
			expect(res.status).toBe(500)
			expect(res.text).toBe('Error')
		})

		it('returns 200 "Ok" for a connected mqtt client', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request.get('/health/mqtt')
			expect(res.status).toBe(200)
			expect(res.text).toBe('Ok')
		})

		it('returns 200 "Ok" for a connected zwave client', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request.get('/health/zwave')
			expect(res.status).toBe(200)
			expect(res.text).toBe('Ok')
		})

		it('returns exactly one 500 response with the corrected message for an invalid client name', async () => {
			const harness = await getHarness()
			const res = await harness.request.get('/health/not-a-client')

			expect(res.status).toBe(500)
			expect(res.text).toBe("Requested client doesn't exist")
		})
	})

	describe('GET /version', () => {
		it('returns the app/zwavejs/zwavejs-server version triplet', async () => {
			const harness = await getHarness()
			const res = await harness.request.get('/version')
			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				appVersion: expect.any(String),
				zwavejs: expect.any(String),
				zwavejsServer: expect.any(String),
			})
		})
	})
})
