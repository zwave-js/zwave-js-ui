import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { createHttpHarness, type HttpHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'

/**
 * Characterizes: GET /health, GET /health/:client, GET /version.
 */
describe('HTTP contract: health & version', () => {
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

	describe('GET /health', () => {
		it('returns 500 "Error" (text) when no gateway has been started', async () => {
			const res = await harness.request.get('/health')
			expect(res.status).toBe(500)
			expect(res.type).toBe('text/html')
			expect(res.text).toBe('Error')
		})

		it('returns 200 "Ok" when both mqtt and zwave are connected', async () => {
			const gw = createFakeGateway()
			harness.testHooks.setGateway(gw)

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
			harness.testHooks.setGateway(gw)

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

			harness.testHooks.setGateway(gw)

			const res = await harness.request.get('/health')
			expect(res.status).toBe(200)
			expect(res.text).toBe('Ok')
		})
	})

	describe('GET /health/:client', () => {
		it('returns 500 "Error" for zwave when no gateway is set', async () => {
			const res = await harness.request.get('/health/zwave')
			expect(res.status).toBe(500)
			expect(res.text).toBe('Error')
		})

		it('returns 200 "Ok" for a connected mqtt client', async () => {
			const gw = createFakeGateway()
			harness.testHooks.setGateway(gw)

			const res = await harness.request.get('/health/mqtt')
			expect(res.status).toBe(200)
			expect(res.text).toBe('Ok')
		})

		it('returns 200 "Ok" for a connected zwave client', async () => {
			const gw = createFakeGateway()
			harness.testHooks.setGateway(gw)

			const res = await harness.request.get('/health/zwave')
			expect(res.status).toBe(200)
			expect(res.text).toBe('Ok')
		})

		it(
			'preserved quirk: an invalid client name sends the 500 error body ' +
				'then falls through into a second res.send() for the same request',
			async () => {
				const res = await harness.request.get('/health/not-a-client')

				// The first `res.status(500).send(...)` is what actually reaches
				// the socket; the handler doesn't `return` after it, so it falls
				// through to a second `res.status(...).send(...)` call against an
				// already-sent response. Express/Node ignore the second write
				// (headers already sent) rather than crashing the process - this
				// test pins that the *first* response body is what clients see.
				expect(res.status).toBe(500)
				expect(res.text).toBe("Requested client doesn 't exist")
			},
		)
	})

	describe('GET /version', () => {
		it('returns the app/zwavejs/zwavejs-server version triplet', async () => {
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
