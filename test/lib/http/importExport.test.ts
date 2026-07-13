import { describe, it, expect } from 'vitest'
import { useHttpHarness } from './harness.ts'
import { createFakeGateway } from '../shared/fakes.ts'

describe('HTTP contract: import/export config', () => {
	const getHarness = useHttpHarness()

	describe('GET /api/exportConfig', () => {
		it('returns the stored nodes JSON verbatim', async () => {
			const harness = await getHarness()
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
					.post('/api/importConfig')
					.send({
						data: { 2: { name: 'New name' } },
					})

				expect(res.status).toBe(200)
				expect(res.body).toEqual({
					success: false,
					message: 'Z-Wave client not inited',
				})
			},
		)

		it('applies name/location/hassDevices via gw.zwave.callApi and storeDevices, in encounter order', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })

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
			const harness = await getHarness({ gateway: gw })

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
			const harness = await getHarness({ gateway: gw })

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

		it('imports the explicitly-selected home id from a multi-home backup, applying only "location" (no "loc"/name/hassDevices) for that network\'s node', async () => {
			const gw = createFakeGateway()
			gw.zwave.homeHex = '0xCAFEBABE'
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request.post('/api/importConfig').send({
				data: {
					'0x11111111': { 2: { location: 'Garage' } },
					'0x22222222': { 3: { name: 'B' } },
				},
				// Explicit selection wins even though neither home id matches the connected controller's own homeHex
				homeId: '0x11111111',
			})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				message: 'Configuration imported successfully',
			})

			// Only the selected network's node 2 is applied; node 3 under the skipped '0x22222222' home id never surfaces
			expect(gw.zwave.callApi).toHaveBeenCalledExactlyOnceWith(
				'setNodeLocation',
				2,
				'Garage',
			)
			expect(gw.zwave.storeDevices).not.toHaveBeenCalled()
		})

		it('ignores a non-string homeId (falls back to normal home-id matching)', async () => {
			const gw = createFakeGateway()
			gw.zwave.homeHex = '0x11111111'
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request.post('/api/importConfig').send({
				data: {
					'0x11111111': { 2: { name: 'Matched by homeHex' } },
				},
				// Not a string, so the route's typeof === 'string' guard must discard it rather than pass it through
				homeId: 12345,
			})

			expect(res.status).toBe(200)
			expect(res.body.success).toBe(true)
			expect(gw.zwave.callApi).toHaveBeenCalledExactlyOnceWith(
				'setNodeName',
				2,
				'Matched by homeHex',
			)
		})

		it('skips a non-object node value (null or a primitive) in a flat config, and falls back to an empty name for a non-string "name"', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request.post('/api/importConfig').send({
				data: {
					// Node-id-looking keys make this a flat config, not a home-id-wrapped one, so nothing pre-filters these non-object values before the route's own per-node guard sees them
					2: null,
					3: 'not an object either',
					4: { name: 42 },
				},
			})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				message: 'Configuration imported successfully',
			})

			// Nodes 2 and 3 are silently skipped; node 4's non-string name falls back to an empty string rather than being coerced or thrown
			expect(gw.zwave.callApi).toHaveBeenCalledExactlyOnceWith(
				'setNodeName',
				4,
				'',
			)
			expect(gw.zwave.storeDevices).not.toHaveBeenCalled()
		})

		it(
			'resolves the gateway fresh before every distinct operation - a gateway swapped mid-import ' +
				'(between two `await`s, simulating a concurrent POST /api/restart) is honored by every ' +
				'later operation, both later in the same node and for every node processed afterwards, ' +
				'never masked by the pre-swap reference',
			async () => {
				const gwA = createFakeGateway()
				const gwB = createFakeGateway()
				harness.testHooks.setGateway(gwA)

				// Swaps the gateway inside the first awaited Z-Wave call, simulating a concurrent restart landing mid-import
				gwA.zwave.callApi.mockImplementationOnce(() => {
					harness.testHooks.setGateway(gwB)
					return { success: true, message: 'OK' }
				})

				const res = await harness.request
					.post('/api/importConfig')
					.send({
						data: {
							// Node 2 exercises setNodeName (triggering the swap), then setNodeLocation and storeDevices, both awaited after the swap
							2: {
								name: 'Kitchen light',
								loc: 'Kitchen',
								hassDevices: {
									light_2: { type: 'light' },
								},
							},
							// Node 3 is processed entirely after node 2 (numeric for...in keys iterate in ascending order), so its setNodeName call must also hit gwB
							3: { name: 'Bedroom light' },
						},
					})

				expect(res.status).toBe(200)
				expect(res.body).toEqual({
					success: true,
					message: 'Configuration imported successfully',
				})

				// Only the operation that triggered the swap reaches gwA
				expect(gwA.zwave.callApi).toHaveBeenCalledExactlyOnceWith(
					'setNodeName',
					2,
					'Kitchen light',
				)
				expect(gwA.zwave.storeDevices).not.toHaveBeenCalled()

				// Every operation after the swap - node 2's setNodeLocation and storeDevices, plus all of node 3 - is applied against the replacement gateway
				expect(gwB.zwave.callApi).toHaveBeenNthCalledWith(
					1,
					'setNodeLocation',
					2,
					'Kitchen',
				)
				expect(gwB.zwave.callApi).toHaveBeenNthCalledWith(
					2,
					'setNodeName',
					3,
					'Bedroom light',
				)
				expect(gwB.zwave.storeDevices).toHaveBeenCalledExactlyOnceWith(
					{ light_2: { type: 'light' } },
					2,
					false,
				)
			},
		)
	})
})
