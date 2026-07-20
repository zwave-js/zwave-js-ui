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
		let mqttHealthy = false
		let zwaveHealthy = false

		const gw = runtime.gateway
		if (gw) {
			const mqttStatus = gw.mqtt?.getStatus()
			mqttHealthy =
				(mqttStatus?.status || mqttStatus?.config.disabled) ?? false
			zwaveHealthy = gw.zwave?.getStatus().status ?? false
		}

		const status = mqttHealthy && zwaveHealthy

		res.status(status ? 200 : 500).send(status ? 'Ok' : 'Error')
	})
	app.get('/health/:client', apisLimiter, function (req, res) {
		const client = req.params.client

		if (client !== 'zwave' && client !== 'mqtt') {
			res.status(500).send("Requested client doesn't exist")
			return
		}

		const status = runtime.gateway?.[client]?.getStatus().status ?? false
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
