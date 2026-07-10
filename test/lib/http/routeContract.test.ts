import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHttpHarness, type HttpHarness } from './harness.ts'

/**
 * Independent, hard-coded inventory of every HTTP route registered in
 * `api/app.ts`. These 35 `{method, path}` pairs are written out literally -
 * NOT derived by introspecting `app._router`/`app.ts` constants - so this
 * file fails loudly if a route is ever renamed, removed, or its method
 * changed, independently of the deeper per-route-group behavior suites.
 *
 * Each entry is exercised with a generic request and only checked for
 * "the route exists" (any status other than Express's default 404 for an
 * unmatched route). Response *content* is characterized in the dedicated
 * route-group files (auth.test.ts, health.test.ts, settings.test.ts,
 * importExport.test.ts, configurationTemplates.test.ts, store.test.ts,
 * debug.test.ts).
 */
const ROUTES: Array<{
	method: 'get' | 'post' | 'put' | 'delete'
	path: string
}> = [
	// auth / password (4)
	{ method: 'get', path: '/api/auth-enabled' },
	{ method: 'post', path: '/api/authenticate' },
	{ method: 'get', path: '/api/logout' },
	{ method: 'put', path: '/api/password' },

	// health / version (3)
	{ method: 'get', path: '/health' },
	{ method: 'get', path: '/health/zwave' },
	{ method: 'get', path: '/version' },

	// settings / restart / statistics / versions (6)
	{ method: 'get', path: '/api/settings' },
	{ method: 'get', path: '/api/serial-ports' },
	{ method: 'post', path: '/api/settings' },
	{ method: 'post', path: '/api/restart' },
	{ method: 'post', path: '/api/statistics' },
	{ method: 'post', path: '/api/versions' },

	// import / export (2)
	{ method: 'get', path: '/api/exportConfig' },
	{ method: 'post', path: '/api/importConfig' },

	// configuration templates (8)
	{ method: 'get', path: '/api/configuration-templates' },
	{ method: 'post', path: '/api/configuration-templates' },
	{ method: 'get', path: '/api/configuration-templates/export' },
	{ method: 'post', path: '/api/configuration-templates/import' },
	{
		method: 'get',
		path: '/api/configuration-templates/device-params/0x0086:0x0002:0x0064',
	},
	{ method: 'put', path: '/api/configuration-templates/template-1' },
	{ method: 'delete', path: '/api/configuration-templates/template-1' },
	{ method: 'post', path: '/api/configuration-templates/template-1/apply' },

	// store / upload / snippets (8)
	{ method: 'get', path: '/api/store' },
	{ method: 'put', path: '/api/store' },
	{ method: 'delete', path: '/api/store' },
	{ method: 'put', path: '/api/store-multi' },
	{ method: 'post', path: '/api/store-multi' },
	{ method: 'get', path: '/api/store/backup' },
	{ method: 'post', path: '/api/store/upload' },
	{ method: 'get', path: '/api/snippet' },

	// debug (4)
	{ method: 'get', path: '/api/debug/status' },
	{ method: 'post', path: '/api/debug/start' },
	{ method: 'post', path: '/api/debug/stop' },
	{ method: 'post', path: '/api/debug/cancel' },
]

describe('HTTP contract: full 35-route inventory', () => {
	let harness: HttpHarness

	beforeAll(async () => {
		harness = await createHttpHarness()
	})

	afterAll(async () => {
		await harness.close()
	})

	it('registers exactly 35 hard-coded routes', () => {
		expect(ROUTES).toHaveLength(35)
	})

	it.each(ROUTES)(
		'$method $path is a registered route (not a 404)',
		async ({ method, path }) => {
			let req = harness.request[method](path)
			// This route responds with a ZIP body under a (quirky, preserved)
			// `application/json` Content-Type header; superagent would
			// otherwise try to auto-parse the binary body as JSON and throw
			// before we ever see the status code.
			if (path === '/api/store/backup') {
				req = req.buffer(true).parse((response, callback) => {
					const chunks: Buffer[] = []
					response.on('data', (chunk: Buffer) => chunks.push(chunk))
					response.on('end', () =>
						callback(null, Buffer.concat(chunks)),
					)
				})
			}
			const res = await req
			expect(res.status).not.toBe(404)
		},
	)

	it("returns Express's default 404 for a path that truly does not exist", async () => {
		const res = await harness.request.get('/api/this-route-does-not-exist')
		expect(res.status).toBe(404)
	})
})
