import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { useHttpHarness, bufferResponse } from './harness.ts'
import { createFakeGateway } from '../shared/fakes.ts'

interface DebugManagerLike {
	isSessionActive(): boolean
	cancelSession(): Promise<void>
}

describe('HTTP contract: debug capture', () => {
	const getHarness = useHttpHarness()
	let debugManager: DebugManagerLike

	beforeAll(async () => {
		// Import after harness setup so DebugManager uses the isolated store
		debugManager = (await import('#api/lib/DebugManager.ts'))
			.default as DebugManagerLike
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

		it(
			"reports a generic failure when nodeIds is not an array - debugManager.stopSession()'s " +
				"`for (const nodeId of nodeIds)` isn't guarded by its own per-node try/catch " +
				'(that only wraps each iteration once already inside the loop), so a non-iterable ' +
				"body value throws past it to this route's own catch block",
			async () => {
				const gw = createFakeGateway()
				gw.zwave.driverReady = false
				const harness = await getHarness({ gateway: gw })
				await harness.request.post('/api/debug/start').send({})

				const res = await harness.request
					.post('/api/debug/stop')
					.send({ nodeIds: 5 })

				expect(res.status).toBe(200)
				expect(res.body.success).toBe(false)
				expect(res.body.message).toMatch(/is not iterable/)

				// stopSession() already restores/clears the session (inside
				// restoreSession()) before it ever reaches the nodeIds loop
				// that throws, so - unlike a failure earlier in the method -
				// no session is left active to clean up here.
				const status = await harness.request.get('/api/debug/status')
				expect(status.body).toEqual({ success: true, active: false })
			},
		)
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

		it('reports a generic failure when restoring the driver log level throws (uncaught inside cancelSession())', async () => {
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

			// restoreSession() throws before ever reaching its own
			// `this.session = null` line, so the session is still
			// (internally) marked active - assert that, then reset the
			// manager's private state directly rather than calling
			// cancelSession()/stopSession() again (which would re-run the
			// same already-.end()-ed winston transport teardown and hang
			// forever waiting on a 'finish' event that can't fire twice),
			// so the shared afterEach hook's own cleanup has nothing left
			// to do.
			const status = await harness.request.get('/api/debug/status')
			expect(status.body).toEqual({ success: true, active: true })
			;(debugManager as unknown as { session: unknown }).session = null
		})
	})
})
