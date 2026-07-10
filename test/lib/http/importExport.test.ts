import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { createHttpHarness, type HttpHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'

/**
 * Characterizes: GET /api/exportConfig, POST /api/importConfig.
 *
 * `normalizeImportedNodesConfig`/`getImportedNodeLocation` (api/lib/importConfig.ts)
 * already have their own unit tests, so this file focuses on the HTTP-level
 * contract: status/envelope shape, gw.zwave collaborator calls, and the
 * "no side effects on rejected input" requirement.
 */
describe('HTTP contract: import/export config', () => {
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

	describe('GET /api/exportConfig', () => {
		it('returns the stored nodes JSON verbatim', async () => {
			await harness.jsonStore.put(harness.store.nodes, {
				2: { name: 'Kitchen light', loc: 'Kitchen' },
			})

			const res = await harness.request.get('/api/exportConfig')

			expect(res.status).toBe(200)
			expect(res.headers['content-type']).toMatch(/application\/json/)
			expect(res.body).toEqual({
				success: true,
				data: { 2: { name: 'Kitchen light', loc: 'Kitchen' } },
				message: 'Successfully exported nodes JSON configuration',
			})
		})
	})

	describe('POST /api/importConfig', () => {
		it('fails with a generic error when no gateway is attached at all', async () => {
			const res = await harness.request.post('/api/importConfig').send({
				data: { 2: { name: 'New name' } },
			})

			// Preserved quirk: the handler guards `!gw.zwave` but never guards
			// `gw` itself, so with no gateway attached the access to `gw.zwave`
			// throws a TypeError, not the intended "Z-Wave client not inited"
			// message.
			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message:
					"Cannot read properties of undefined (reading 'zwave')",
			})
		})

		it('fails with "Z-Wave client not inited" when a gateway is attached but has no zwave client', async () => {
			harness.testHooks.setGateway(
				createFakeGateway({ zwave: undefined }),
			)

			const res = await harness.request.post('/api/importConfig').send({
				data: { 2: { name: 'New name' } },
			})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'Z-Wave client not inited',
			})
		})

		it('applies name/location/hassDevices via gw.zwave.callApi and storeDevices, in encounter order', async () => {
			const gw = createFakeGateway()
			harness.testHooks.setGateway(gw)

			const res = await harness.request.post('/api/importConfig').send({
				data: {
					2: {
						name: 'Kitchen light',
						loc: 'Kitchen',
						hassDevices: { light_2: { type: 'light' } },
					},
				},
			})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				message: 'Configuration imported successfully',
			})

			expect(gw.zwave.callApi).toHaveBeenNthCalledWith(
				1,
				'setNodeName',
				2,
				'Kitchen light',
			)
			expect(gw.zwave.callApi).toHaveBeenNthCalledWith(
				2,
				'setNodeLocation',
				2,
				'Kitchen',
			)
			expect(gw.zwave.storeDevices).toHaveBeenCalledWith(
				{ light_2: { type: 'light' } },
				2,
				false,
			)
		})

		it('skips non-numeric node-id keys without calling any collaborator', async () => {
			const gw = createFakeGateway()
			harness.testHooks.setGateway(gw)

			const res = await harness.request.post('/api/importConfig').send({
				data: { notANodeId: { name: 'Ignored' } },
			})

			expect(res.status).toBe(200)
			expect(res.body.success).toBe(true)
			expect(gw.zwave.callApi).not.toHaveBeenCalled()
			expect(gw.zwave.storeDevices).not.toHaveBeenCalled()
		})

		it('reports skipped home ids and imports nothing when a wrapped backup has no home id matching the controller', async () => {
			const gw = createFakeGateway()
			gw.zwave.homeHex = '0xCAFEBABE'
			harness.testHooks.setGateway(gw)

			const res = await harness.request.post('/api/importConfig').send({
				data: {
					'0x11111111': { 2: { name: 'A' } },
					'0x22222222': { 3: { name: 'B' } },
				},
			})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message:
					'Import skipped: the backup contains nodes for home ids 0x11111111, 0x22222222, none of which match the connected controller (0xCAFEBABE).',
			})
			expect(gw.zwave.callApi).not.toHaveBeenCalled()
		})
	})
})
