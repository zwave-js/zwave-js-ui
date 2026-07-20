import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { useHttpHarness, bufferResponse } from './harness.ts'
import { createFakeGateway } from '../shared/fakes.ts'
import type DebugManagerModule from '#api/lib/DebugManager.ts'

describe('HTTP contract: debug capture', () => {
	const getHarness = useHttpHarness()
	let debugManager: typeof DebugManagerModule

	beforeAll(async () => {
		// Import after harness setup so DebugManager uses the isolated store
		debugManager = (await import('#api/lib/DebugManager.ts')).default
	})

	afterEach(async () => {
		if (debugManager.isSessionActive()) {
			await debugManager.cancelSession()
		}
	})

	describe('GET /api/debug/status', () => {
		it('reports inactive when no session has been started', async () => {
			const harness = await getHarness()
			const res = await harness.request.get('/api/debug/status')
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ success: true, active: false })
		})

		it('reports active once a session has been started', async () => {
			const gw = createFakeGateway()
			gw.zwave.driverReady = false
			const harness = await getHarness({ gateway: gw })

			await harness.request.post('/api/debug/start').send({})

			const res = await harness.request.get('/api/debug/status')
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ success: true, active: true })
		})
	})

	describe('POST /api/debug/start', () => {
		it('starts a session and registers the extra log transport on the fake driver', async () => {
			const gw = createFakeGateway()
			gw.zwave.driverReady = false
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request.post('/api/debug/start').send({})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				message: 'Debug capture started',
			})
			expect(gw.zwave.addExtraLogTransport).toHaveBeenCalledOnce()
			expect(gw.zwave.addExtraLogTransport.mock.calls[0][1]).toBe('debug')
		})

		it('restarts the driver when restartDriver is requested and the driver is ready', async () => {
			const gw = createFakeGateway()
			gw.zwave.driverReady = true
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request
				.post('/api/debug/start')
				.send({ restartDriver: true })

			expect(res.status).toBe(200)
			expect(res.body.success).toBe(true)
			expect(gw.zwave.restart).toHaveBeenCalledOnce()
		})

		it('rejects starting a second session while one is already active', async () => {
			const gw = createFakeGateway()
			gw.zwave.driverReady = false
			const harness = await getHarness({ gateway: gw })

			await harness.request.post('/api/debug/start').send({})

			const res = await harness.request.post('/api/debug/start').send({})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'A debug session is already active',
			})
		})

		it.each([
			['no gateway attached at all', undefined],
			[
				'a gateway attached but with no zwave client',
				createFakeGateway({ zwave: undefined }),
			],
		])(
			'fails with the clean "Z-Wave client not inited" error with %s',
			async (_label, gateway) => {
				const harness = await getHarness({ gateway })

				const res = await harness.request
					.post('/api/debug/start')
					.send({})

				expect(res.status).toBe(200)
				expect(res.body).toEqual({
					success: false,
					message: 'Z-Wave client not inited',
				})
			},
		)
	})

	describe('POST /api/debug/stop', () => {
		it('rejects when there is no active session', async () => {
			const harness = await getHarness()
			const res = await harness.request.post('/api/debug/stop').send({
				nodeIds: [],
			})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'No active debug session',
			})
		})

		it('streams a ZIP archive with the ZIP content type/attachment header', async () => {
			const gw = createFakeGateway()
			gw.zwave.driverReady = false
			const harness = await getHarness({ gateway: gw })
			await harness.request.post('/api/debug/start').send({})

			const res = await bufferResponse(
				harness.request.post('/api/debug/stop').send({ nodeIds: [] }),
			)

			expect(res.status).toBe(200)
			expect(res.headers['content-type']).toBe('application/zip')
			expect(res.headers['content-disposition']).toMatch(
				/^attachment; filename="zwave-debug-.+\.zip"$/,
			)
			// PK\x03\x04 is the ZIP local-file-header signature, proving the body is a real archive
			expect((res.body as Buffer).subarray(0, 4).toString('hex')).toBe(
				'504b0304',
			)

			// Archive cleanup runs after the response finishes
			const status = await harness.request.get('/api/debug/status')
			expect(status.body).toEqual({ success: true, active: false })
		})

		it('rejects a non-array nodeIds value without stopping the session', async () => {
			const gw = createFakeGateway()
			gw.zwave.driverReady = false
			const harness = await getHarness({ gateway: gw })
			await harness.request.post('/api/debug/start').send({})

			const res = await harness.request
				.post('/api/debug/stop')
				.send({ nodeIds: 5 })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'nodeIds must be an array',
			})

			const status = await harness.request.get('/api/debug/status')
			expect(status.body).toEqual({ success: true, active: true })
		})
	})

	describe('POST /api/debug/cancel', () => {
		it('rejects when there is no active session', async () => {
			const harness = await getHarness()
			const res = await harness.request.post('/api/debug/cancel')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'No active debug session',
			})
		})

		it('cancels an active session and reports inactive afterwards', async () => {
			const gw = createFakeGateway()
			gw.zwave.driverReady = false
			const harness = await getHarness({ gateway: gw })
			await harness.request.post('/api/debug/start').send({})

			const res = await harness.request.post('/api/debug/cancel')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				message: 'Debug capture cancelled',
			})

			const status = await harness.request.get('/api/debug/status')
			expect(status.body).toEqual({ success: true, active: false })
		})

		it('reports a generic failure when restoring the driver log level throws while canceling', async () => {
			const gw = createFakeGateway()
			gw.zwave.driverReady = true
			gw.zwave.driver.updateLogConfig = vi.fn(() => {
				throw new Error('driver rejected log config update')
			})
			const harness = await getHarness({ gateway: gw })
			await harness.request.post('/api/debug/start').send({})

			const res = await harness.request.post('/api/debug/cancel')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'driver rejected log config update',
			})

			const status = await harness.request.get('/api/debug/status')
			expect(status.body).toEqual({ success: true, active: false })
		})
	})
})
