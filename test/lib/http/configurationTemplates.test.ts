import { describe, it, expect } from 'vitest'
import { useHttpHarness } from './harness.ts'
import { createFakeGateway } from '../shared/fakes.ts'

describe('HTTP contract: configuration templates', () => {
	const getHarness = useHttpHarness()

	describe('GET /api/configuration-templates', () => {
		it('returns the templates from gw.zwave.getConfigurationTemplates()', async () => {
			const gw = createFakeGateway()
			gw.zwave.getConfigurationTemplates.mockReturnValue([
				{ id: 't1', name: 'Template 1' },
			])
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request.get(
				'/api/configuration-templates',
			)

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				data: [{ id: 't1', name: 'Template 1' }],
			})
		})

		it('fails with the clean "Z-Wave client not inited" error when no gateway is attached', async () => {
			const harness = await getHarness()
			const res = await harness.request.get(
				'/api/configuration-templates',
			)

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'Z-Wave client not inited',
			})
		})
	})

	describe('POST /api/configuration-templates', () => {
		it('rejects when nodeId or name is missing, without calling the collaborator', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request
				.post('/api/configuration-templates')
				.send({ name: 'Missing node id' })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'nodeId and name are required',
			})
			expect(gw.zwave.createConfigurationTemplate).not.toHaveBeenCalled()
		})

		it('creates a template with the exact args/order, in body order', async () => {
			const gw = createFakeGateway()
			gw.zwave.createConfigurationTemplate.mockResolvedValue({
				id: 'template-42',
			})
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request
				.post('/api/configuration-templates')
				.send({
					nodeId: 2,
					name: 'My Template',
					autoApply: true,
					values: [{ commandClass: 112, property: 1, value: 5 }],
					firmwareRange: { min: '1.0', max: '2.0' },
				})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				data: { id: 'template-42' },
				message: 'Template created successfully',
			})
			expect(gw.zwave.createConfigurationTemplate).toHaveBeenCalledWith(
				2,
				'My Template',
				true,
				[{ commandClass: 112, property: 1, value: 5 }],
				{ min: '1.0', max: '2.0' },
			)
		})
	})

	describe('GET /api/configuration-templates/export', () => {
		it('returns all templates with the export-specific message', async () => {
			const gw = createFakeGateway()
			gw.zwave.getConfigurationTemplates.mockReturnValue([{ id: 't1' }])
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request.get(
				'/api/configuration-templates/export',
			)

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				data: [{ id: 't1' }],
				message: 'Templates exported successfully',
			})
		})
	})

	describe('POST /api/configuration-templates/import', () => {
		it('rejects a non-array data payload without calling the collaborator', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request
				.post('/api/configuration-templates/import')
				.send({ data: { not: 'an array' } })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'data must be an array of templates',
			})
			expect(gw.zwave.importConfigurationTemplates).not.toHaveBeenCalled()
		})

		it('rejects a template missing required fields without calling the collaborator', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request
				.post('/api/configuration-templates/import')
				.send({ data: [{ name: 'Incomplete' }] })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message:
					'Each template must have name, deviceId, and values array',
			})
			expect(gw.zwave.importConfigurationTemplates).not.toHaveBeenCalled()
		})

		it('imports valid templates via gw.zwave.importConfigurationTemplates', async () => {
			const gw = createFakeGateway()
			gw.zwave.importConfigurationTemplates.mockResolvedValue({
				imported: 1,
				skipped: 0,
			})
			const harness = await getHarness({ gateway: gw })

			const templates = [{ name: 'T1', deviceId: '1:1:1:1', values: [] }]
			const res = await harness.request
				.post('/api/configuration-templates/import')
				.send({ data: templates })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				data: { imported: 1, skipped: 0 },
				message: 'Templates imported successfully',
			})
			expect(gw.zwave.importConfigurationTemplates).toHaveBeenCalledWith(
				templates,
			)
		})
	})

	describe('GET /api/configuration-templates/device-params/:deviceId', () => {
		it('returns the params for the given deviceId', async () => {
			const gw = createFakeGateway()
			gw.zwave.getDeviceConfigurationParams.mockResolvedValue([
				{ parameterId: 1 },
			])
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request.get(
				'/api/configuration-templates/device-params/0x0086:0x0002:0x0064',
			)

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				data: [{ parameterId: 1 }],
			})
			expect(gw.zwave.getDeviceConfigurationParams).toHaveBeenCalledWith(
				'0x0086:0x0002:0x0064',
			)
		})
	})

	describe('PUT /api/configuration-templates/:id', () => {
		it('updates a template with the given fields', async () => {
			const gw = createFakeGateway()
			gw.zwave.updateConfigurationTemplate.mockResolvedValue({
				id: 'template-1',
				name: 'Renamed',
			})
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request
				.put('/api/configuration-templates/template-1')
				.send({ name: 'Renamed', autoApply: false, values: [] })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				data: { id: 'template-1', name: 'Renamed' },
				message: 'Template updated successfully',
			})
			expect(gw.zwave.updateConfigurationTemplate).toHaveBeenCalledWith(
				'template-1',
				{
					name: 'Renamed',
					autoApply: false,
					firmwareRange: undefined,
					values: [],
				},
			)
		})
	})

	describe('DELETE /api/configuration-templates/:id', () => {
		it('deletes the template by id', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request.delete(
				'/api/configuration-templates/template-1',
			)

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				message: 'Template deleted successfully',
			})
			expect(gw.zwave.deleteConfigurationTemplate).toHaveBeenCalledWith(
				'template-1',
			)
		})
	})

	describe('POST /api/configuration-templates/:id/apply', () => {
		it('rejects when nodeId is missing, without calling the collaborator', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request
				.post('/api/configuration-templates/template-1/apply')
				.send({})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'nodeId is required',
			})
			expect(gw.zwave.applyConfigurationTemplate).not.toHaveBeenCalled()
		})

		it('applies the template to the node, coercing an omitted force to false', async () => {
			const gw = createFakeGateway()
			gw.zwave.applyConfigurationTemplate.mockResolvedValue({
				success: 3,
				failed: 1,
			})
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request
				.post('/api/configuration-templates/template-1/apply')
				.send({ nodeId: 2 })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				data: { success: 3, failed: 1 },
				message: 'Template applied: 3 OK, 1 failed',
			})
			expect(gw.zwave.applyConfigurationTemplate).toHaveBeenCalledWith(
				'template-1',
				2,
				false,
			)
		})

		it('coerces a truthy non-boolean force (e.g. "yes") to the literal boolean true', async () => {
			const gw = createFakeGateway()
			gw.zwave.applyConfigurationTemplate.mockResolvedValue({
				success: 1,
				failed: 0,
			})
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request
				.post('/api/configuration-templates/template-1/apply')
				.send({ nodeId: 2, force: 'yes' })

			expect(res.status).toBe(200)
			expect(gw.zwave.applyConfigurationTemplate).toHaveBeenCalledWith(
				'template-1',
				2,
				true,
			)
		})
	})
})
