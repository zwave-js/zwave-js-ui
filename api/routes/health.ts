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
		// Initialized to `false` (not left implicitly `undefined`) purely to
		// satisfy strict "used before being assigned" analysis - both are
		// falsy, and every use below (`if (mqtt && ...)`, `mqtt && zwave`,
		// `status ? ... : ...`) only ever branches on truthiness, so this is
		// behaviorally identical to the original's uninitialized `let` in
		// every case where `gw` is absent (see `test/lib/http/health.test.ts`).
		let mqtt: Record<string, any> | boolean = false
		let zwave: boolean = false

		const gw = runtime.getGateway()
		if (gw) {
			mqtt = gw.mqtt?.getStatus() ?? false
			zwave = gw.zwave?.getStatus().status ?? false
		}

		// if mqtt is disabled, return true. Fixes #469
		if (mqtt && typeof mqtt !== 'boolean') {
			mqtt = mqtt.status || mqtt.config.disabled
		}

		const status = mqtt && zwave

		res.status(status ? 200 : 500).send(status ? 'Ok' : 'Error')
	})

	app.get('/health/:client', apisLimiter, function (req, res) {
		const client = req.params.client
		// Same "initialize to a falsy default" reasoning as `/health` above -
		// preserves the tested fallthrough quirk (an invalid `client` sends a
		// 500 response, then falls through - no `return` - into a second,
		// no-op `res.status(...).send(...)` on the same, already-sent
		// response; see `test/lib/http/health.test.ts`).
		let status: boolean = false

		if (client !== 'zwave' && client !== 'mqtt') {
			res.status(500).send("Requested client doesn't exist")
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
