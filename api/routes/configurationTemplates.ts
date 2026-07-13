import type express from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { getErrorMessage } from '../lib/errors.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { isAuthenticated } from './auth.ts'

export interface ConfigurationTemplatesRoutesDeps {
	apisLimiter: RateLimitRequestHandler
}

/**
 * Every `runtime.requireGateway('zwave')` call below is deliberately unguarded,
 * preserving the legacy crash-on-missing-gateway behavior - see
 * `AppRuntime.requireGateway()` for the full rationale
 */
export function registerConfigurationTemplatesRoutes(
	app: express.Express,
	runtime: AppRuntime,
	{ apisLimiter }: ConfigurationTemplatesRoutesDeps,
): void {
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

	// Placed before the :id routes so Express doesn't match "export" as an :id
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

	// Placed before the :id routes so Express doesn't match "import" as an :id
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
