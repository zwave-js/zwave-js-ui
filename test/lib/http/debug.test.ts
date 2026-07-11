import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { createHttpHarness, type HttpHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'

interface DebugManagerLike {
	isSessionActive(): boolean
	cancelSession(): Promise<void>
}

// Exercises the real debugManager singleton rather than mocking it: its
// session methods only touch the isolated per-test STORE_DIR and the fake
// ZWaveClient's vi.fn() collaborators, so it's safe and more faithful than
// a hand-rolled mock. Every test cleans up any session it starts.
describe('HTTP contract: debug capture', () => {
	let harness: HttpHarness
	let debugManager: DebugManagerLike

	beforeAll(async () => {
		harness = await createHttpHarness()
		// Dynamic import so it resolves after createHttpHarness() sets
		// STORE_DIR, keeping debugTempDir out of the real project store
		debugManager = (await import('#api/lib/DebugManager.ts'))
			.default as DebugManagerLike
	})

	afterAll(async () => {
		await harness.close()
	})

	afterEach(async () => {
		harness.resetState()
		if (debugManager.isSessionActive()) {
			await debugManager.cancelSession()
		}
	})

	describe('GET /api/debug/status', () => {
		it('reports inactive when no session has been started', async () => {
			const res = await harness.request.get('/api/debug/status')
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ success: true, active: false })
		})

		it('reports active once a session has been started', async () => {
			const gw = createFakeGateway()
			gw.zwave.driverReady = false
			harness.testHooks.setGateway(gw)

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
			harness.testHooks.setGateway(gw)

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
			harness.testHooks.setGateway(gw)

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
			harness.testHooks.setGateway(gw)

			await harness.request.post('/api/debug/start').send({})

			const res = await harness.request.post('/api/debug/start').send({})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'A debug session is already active',
			})
		})
	})

	describe('POST /api/debug/stop', () => {
		it('rejects when there is no active session', async () => {
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
			harness.testHooks.setGateway(gw)
			await harness.request.post('/api/debug/start').send({})

			const res = await harness.request
				.post('/api/debug/stop')
				.send({ nodeIds: [] })
				.buffer(true)
				.parse((response, callback) => {
					const chunks: Buffer[] = []
					response.on('data', (chunk: Buffer) => chunks.push(chunk))
					response.on('end', () =>
						callback(null, Buffer.concat(chunks)),
					)
				})

			expect(res.status).toBe(200)
			expect(res.headers['content-type']).toBe('application/zip')
			expect(res.headers['content-disposition']).toMatch(
				/^attachment; filename="zwave-debug-.+\.zip"$/,
			)
			expect((res.body as Buffer).subarray(0, 4).toString('hex')).toBe(
				'504b0304',
			)

			// archive.on('end', cleanup) runs asynchronously after the
			// response finishes, so status only reports inactive afterward
			const status = await harness.request.get('/api/debug/status')
			expect(status.body).toEqual({ success: true, active: false })
		})
	})

	describe('POST /api/debug/cancel', () => {
		it('rejects when there is no active session', async () => {
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
			harness.testHooks.setGateway(gw)
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
	})
})
