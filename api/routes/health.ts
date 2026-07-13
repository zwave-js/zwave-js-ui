import type express from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { libVersion } from 'zwave-js'
import { serverVersion } from '@zwave-js/server'
import * as utils from '../lib/utils.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'

export interface HealthRoutesDeps {
	apisLimiter: RateLimitRequestHandler
}

export function registerHealthRoutes(
	app: express.Express,
	runtime: AppRuntime,
	{ apisLimiter }: HealthRoutesDeps,
): void {
	app.get('/health', apisLimiter, function (req, res) {
		// Initialized to false only to satisfy strict definite-assignment analysis
		// since every check below just tests truthiness
		let mqtt: Record<string, any> | boolean = false
		let zwave: boolean = false

		const gw = runtime.getGateway()
		if (gw) {
			mqtt = gw.mqtt?.getStatus() ?? false
			zwave = gw.zwave?.getStatus().status ?? false
		}

		// Disabled mqtt reports a status object, not a boolean, but still counts as healthy (see #469)
		if (mqtt && typeof mqtt !== 'boolean') {
			mqtt = mqtt.status || mqtt.config.disabled
		}

		const status = mqtt && zwave

		res.status(status ? 200 : 500).send(status ? 'Ok' : 'Error')
	})

	app.get('/health/:client', apisLimiter, function (req, res) {
		const client = req.params.client
		let status: boolean = false

		if (client !== 'zwave' && client !== 'mqtt') {
			// Falls through without returning into the no-op res.send below, on an already-sent response
			res.status(500).send("Requested client doesn 't exist")
		} else {
			status = runtime.getGateway()?.[client]?.getStatus().status ?? false
		}

		res.status(status ? 200 : 500).send(status ? 'Ok' : 'Error')
	})

	app.get('/version', apisLimiter, function (req, res) {
		res.json({
			appVersion: utils.getVersion(),
			zwavejs: libVersion,
			zwavejsServer: serverVersion,
		})
	})
}
