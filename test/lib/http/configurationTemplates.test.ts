import {
	describe,
	it,
	expect,
	vi,
} from 'vitest'
import type { Express } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { useHttpHarness } from './harness.ts'
import { createFakeGateway } from '../shared/fakes.ts'
import { registerConfigurationTemplatesRoutes } from '../../../api/routes/configurationTemplates.ts'
import type { AppRuntime } from '../../../api/runtime/AppRuntime.ts'

/**
 * Registers the real `registerConfigurationTemplatesRoutes` against a
 * minimal fake `app` whose `.get/.post/.put/.delete` just record
 * `(path, ...handlers)` instead of an actual Express router, then returns
 * the REAL, production handler closure registered for `method`+`path` -
 * i.e. the exact function express would have invoked, retrieved without
 * an HTTP layer in between.
 *
 * Used only for the three `if (!id) return res.json(...)` branches below
 * (PUT/DELETE/POST `:id` routes) that are empirically unreachable via
 * genuine HTTP: Express 4's `path-to-regexp`-based router requires `:id`
 * to match at least one character, so `req.params.id` can never actually
 * be `''`/falsy for a real request - the guard is real, deliberate
 * defensive code, just not exercisable through the router. This invokes
 * the same production closure directly with a synthetic empty `id`,
 * rather than reimplementing or approximating its logic - distinct from
 * (and not barred by) the AppRuntime shutdown/plugin-teardown finding's
 * "don't bypass the production path" constraint, which concerns bypassing
 * real plugin *loading*, not invoking an already-registered real handler.
 */
function captureConfigurationTemplatesHandler(
	method: 'get' | 'post' | 'put' | 'delete',
	routePath: string,
): (req: any, res: any) => unknown {
	type Handler = (req: any, res: any) => unknown
	const registered: Array<{
		method: string
		path: string
		handler: Handler
	}> = []

	const fakeApp = {
		get: (p: string, ...handlers: Handler[]) => {
			registered.push({
				method: 'get',
				path: p,
				handler: handlers.at(-1),
			})
		},
		post: (p: string, ...handlers: Handler[]) => {
			registered.push({
				method: 'post',
				path: p,
				handler: handlers.at(-1),
			})
		},
		put: (p: string, ...handlers: Handler[]) => {
			registered.push({
				method: 'put',
				path: p,
				handler: handlers.at(-1),
			})
		},
		delete: (p: string, ...handlers: Handler[]) => {
			registered.push({
				method: 'delete',
				path: p,
				handler: handlers.at(-1),
			})
		},
	}

	// The `if (!id)` branches return before ever touching `runtime` - a
	// `requireGateway` that throws makes that guaranteed-unused precondition
	// explicit, so this test would fail loudly (rather than silently
	// pass for the wrong reason) if the route ever changed to check
	// `runtime` before `id`.
	const fakeRuntime = {
		requireGateway: vi.fn(() => {
			throw new Error(
				'requireGateway must not be reached: the empty-id guard should return first',
			)
		}),
	}

	registerConfigurationTemplatesRoutes(
		fakeApp as unknown as Express,
		fakeRuntime as unknown as AppRuntime,
		{
			apisLimiter: (() => {}) as unknown as RateLimitRequestHandler,
		},
	)

	const match = registered.find(
		(r) => r.method === method && r.path === routePath,
	)
	if (!match) {
		throw new Error(
			`No ${method.toUpperCase()} ${routePath} handler was registered`,
		)
	}
	return match.handler
}

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

		it('fails with a generic error when no gateway is attached (past the nodeId/name guard, exercising the catch block)', async () => {
			const harness = await getHarness()
			const res = await harness.request
				.post('/api/configuration-templates')
				.send({ nodeId: 2, name: 'My Template' })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message:
					"Cannot read properties of undefined (reading 'zwave')",
			})
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

		it('fails with a generic error when no gateway is attached (past the array/required-fields guards, exercising the catch block)', async () => {
			const harness = await getHarness()
			const res = await harness.request
				.post('/api/configuration-templates/import')
				.send({
					data: [{ name: 'T1', deviceId: '1:1:1:1', values: [] }],
				})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message:
					"Cannot read properties of undefined (reading 'zwave')",
			})
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

		it('fails with a generic error when no gateway is attached (past the id/nodeId guards, exercising the catch block)', async () => {
			const harness = await getHarness()
			const res = await harness.request
				.post('/api/configuration-templates/template-1/apply')
				.send({ nodeId: 2 })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message:
					"Cannot read properties of undefined (reading 'zwave')",
			})
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

	describe('direct-handler-invocation: :id guards unreachable via real HTTP', () => {
		// Express 4 (`path-to-regexp@0.1.x`) requires a named param segment
		// like `:id` to match at least one character, so a real request can
		// never produce `req.params.id === ''` - these three `if (!id)`
		// guards can only be exercised by invoking the real, registered
		// handler function directly with a synthetic empty id, bypassing
		// the router (not the handler itself).

		it('PUT /api/configuration-templates/:id returns "Invalid template ID" for an empty id, without touching the runtime', async () => {
			const handler = captureConfigurationTemplatesHandler(
				'put',
				'/api/configuration-templates/:id',
			)
			const json = vi.fn()

			await handler({ params: { id: '' }, body: {} }, { json })

			expect(json).toHaveBeenCalledExactlyOnceWith({
				success: false,
				message: 'Invalid template ID',
			})
		})

		it('DELETE /api/configuration-templates/:id returns "Invalid template ID" for an empty id, without touching the runtime', async () => {
			const handler = captureConfigurationTemplatesHandler(
				'delete',
				'/api/configuration-templates/:id',
			)
			const json = vi.fn()

			await handler({ params: { id: '' }, body: {} }, { json })

			expect(json).toHaveBeenCalledExactlyOnceWith({
				success: false,
				message: 'Invalid template ID',
			})
		})

		it('POST /api/configuration-templates/:id/apply returns "Invalid template ID" for an empty id, without touching the runtime', async () => {
			const handler = captureConfigurationTemplatesHandler(
				'post',
				'/api/configuration-templates/:id/apply',
			)
			const json = vi.fn()

			await handler({ params: { id: '' }, body: { nodeId: 2 } }, { json })

			expect(json).toHaveBeenCalledExactlyOnceWith({
				success: false,
				message: 'Invalid template ID',
			})
		})
	})
})
