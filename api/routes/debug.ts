import type express from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { PersistedSettings } from '../config/store.ts'
import store from '../config/store.ts'
import jsonStore from '../lib/jsonStore.ts'
import * as loggers from '../lib/logger.ts'
import { getErrorMessage } from '../lib/errors.ts'
import debugManager from '../lib/DebugManager.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { isAuthenticated } from './auth.ts'

const logger = loggers.module('App')

export interface DebugRoutesDeps {
	apisLimiter: RateLimitRequestHandler
}

export function registerDebugRoutes(
	app: express.Express,
	runtime: AppRuntime,
	{ apisLimiter }: DebugRoutesDeps,
): void {
	app.get(
		'/api/debug/status',
		apisLimiter,
		isAuthenticated,
		function (req, res) {
			res.json({
				success: true,
				active: debugManager.isSessionActive(),
			})
		},
	)

	app.post(
		'/api/debug/start',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				if (debugManager.isSessionActive()) {
					return res.json({
						success: false,
						message: 'A debug session is already active',
					})
				}

				const settings: PersistedSettings =
					jsonStore.get(store.settings) || {}
				const originalLogLevel = settings.gateway?.logLevel || 'info'
				const restartDriver = req.body.restartDriver || false

				await debugManager.startSession(
					runtime.requireZwaveClient(),
					originalLogLevel,
					restartDriver,
				)
				runtime.setOwnsDebugSession(true)

				res.json({
					success: true,
					message: 'Debug capture started',
				})
			} catch (err) {
				logger.error('Error starting debug session:', err)
				res.json({
					success: false,
					message: getErrorMessage(err),
				})
			}
		},
	)

	app.post(
		'/api/debug/stop',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				if (!debugManager.isSessionActive()) {
					return res.json({
						success: false,
						message: 'No active debug session',
					})
				}

				const nodeIds: unknown = req.body.nodeIds ?? []
				if (!Array.isArray(nodeIds)) {
					throw new Error('nodeIds must be an array')
				}

				const { archive, cleanup } =
					await debugManager.stopSession(nodeIds)
				runtime.setOwnsDebugSession(false)

				const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
				res.attachment(`zwave-debug-${timestamp}.zip`)
				res.setHeader('Content-Type', 'application/zip')

				// Clean up temp files after the archive has been sent
				archive.on('end', async () => {
					await cleanup()
				})

				archive.pipe(res)
			} catch (err) {
				logger.error('Error stopping debug session:', err)
				res.json({
					success: false,
					message: getErrorMessage(err),
				})
			}
		},
	)

	app.post(
		'/api/debug/cancel',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				if (!debugManager.isSessionActive()) {
					return res.json({
						success: false,
						message: 'No active debug session',
					})
				}

				await debugManager.cancelSession()
				runtime.setOwnsDebugSession(false)

				res.json({
					success: true,
					message: 'Debug capture cancelled',
				})
			} catch (err) {
				logger.error('Error cancelling debug session:', err)
				res.json({
					success: false,
					message: getErrorMessage(err),
				})
			}
		},
	)
}
