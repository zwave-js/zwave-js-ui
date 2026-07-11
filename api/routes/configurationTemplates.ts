import type express from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { getErrorMessage } from '../lib/errors.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { isAuthenticated } from './auth.ts'

export interface ConfigurationTemplatesRoutesDeps {
	apisLimiter: RateLimitRequestHandler
}

/**
 * All routes below intentionally call `runtime.requireGateway('zwave')`, which
 * throws a bare, unguarded `TypeError` if no gateway is currently attached.
 * This preserves the original code's unguarded `gw.zwave.xxx()` access -
 * see `AppRuntime.requireGateway()`'s doc comment for the full rationale.
 * Callers must NOT add a presence guard before using the result.
 */
export function registerConfigurationTemplatesRoutes(
	app: express.Express,
	runtime: AppRuntime,
	{ apisLimiter }: ConfigurationTemplatesRoutesDeps,
): void {
	// get all configuration templates
	app.get(
		'/api/configuration-templates',
		apisLimiter,
		isAuthenticated,
		function (req, res) {
			try {
				const templates = runtime
					.requireGateway('zwave')
					.zwave.getConfigurationTemplates()
				res.json({ success: true, data: templates })
			} catch (error) {
				res.json({ success: false, message: getErrorMessage(error) })
			}
		},
	)

	// create a configuration template from a node
	app.post(
		'/api/configuration-templates',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				const { nodeId, name, autoApply, values, firmwareRange } =
					req.body
				if (!nodeId || !name) {
					return res.json({
						success: false,
						message: 'nodeId and name are required',
					})
				}
				const template = await runtime
					.requireGateway('zwave')
					.zwave.createConfigurationTemplate(
						nodeId,
						name,
						autoApply,
						values,
						firmwareRange,
					)
				res.json({
					success: true,
					data: template,
					message: 'Template created successfully',
				})
			} catch (error) {
				res.json({ success: false, message: getErrorMessage(error) })
			}
		},
	)

	// export all configuration templates (must be before :id routes)
	app.get(
		'/api/configuration-templates/export',
		apisLimiter,
		isAuthenticated,
		function (req, res) {
			try {
				const templates = runtime
					.requireGateway('zwave')
					.zwave.getConfigurationTemplates()
				res.json({
					success: true,
					data: templates,
					message: 'Templates exported successfully',
				})
			} catch (error) {
				res.json({ success: false, message: getErrorMessage(error) })
			}
		},
	)

	// import configuration templates (must be before :id routes)
	app.post(
		'/api/configuration-templates/import',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				const templates = req.body.data
				if (!Array.isArray(templates)) {
					return res.json({
						success: false,
						message: 'data must be an array of templates',
					})
				}
				// Validate each template has required fields
				for (const t of templates) {
					if (!t.name || !t.deviceId || !Array.isArray(t.values)) {
						return res.json({
							success: false,
							message:
								'Each template must have name, deviceId, and values array',
						})
					}
				}
				const result = await runtime
					.requireGateway('zwave')
					.zwave.importConfigurationTemplates(templates)
				res.json({
					success: true,
					data: result,
					message: 'Templates imported successfully',
				})
			} catch (error) {
				res.json({ success: false, message: getErrorMessage(error) })
			}
		},
	)

	// get device configuration params from zwave-js config DB
	app.get(
		'/api/configuration-templates/device-params/:deviceId',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				const params = await runtime
					.requireGateway('zwave')
					.zwave.getDeviceConfigurationParams(req.params.deviceId)
				res.json({ success: true, data: params })
			} catch (error) {
				res.json({ success: false, message: getErrorMessage(error) })
			}
		},
	)

	// update a configuration template
	app.put(
		'/api/configuration-templates/:id',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				const id = req.params.id
				if (!id) {
					return res.json({
						success: false,
						message: 'Invalid template ID',
					})
				}
				const { name, autoApply, firmwareRange, values } = req.body
				const template = await runtime
					.requireGateway('zwave')
					.zwave.updateConfigurationTemplate(id, {
						name,
						autoApply,
						firmwareRange,
						values,
					})
				res.json({
					success: true,
					data: template,
					message: 'Template updated successfully',
				})
			} catch (error) {
				res.json({ success: false, message: getErrorMessage(error) })
			}
		},
	)

	// delete a configuration template
	app.delete(
		'/api/configuration-templates/:id',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				const id = req.params.id
				if (!id) {
					return res.json({
						success: false,
						message: 'Invalid template ID',
					})
				}
				await runtime
					.requireGateway('zwave')
					.zwave.deleteConfigurationTemplate(id)
				res.json({
					success: true,
					message: 'Template deleted successfully',
				})
			} catch (error) {
				res.json({ success: false, message: getErrorMessage(error) })
			}
		},
	)

	// apply a configuration template to a node
	app.post(
		'/api/configuration-templates/:id/apply',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				const id = req.params.id
				if (!id) {
					return res.json({
						success: false,
						message: 'Invalid template ID',
					})
				}
				const { nodeId, force } = req.body
				if (!nodeId) {
					return res.json({
						success: false,
						message: 'nodeId is required',
					})
				}
				const result = await runtime
					.requireGateway('zwave')
					.zwave.applyConfigurationTemplate(id, nodeId, !!force)
				res.json({
					success: true,
					data: result,
					message: `Template applied: ${result.success} OK, ${result.failed} failed`,
				})
			} catch (error) {
				res.json({ success: false, message: getErrorMessage(error) })
			}
		},
	)
}
