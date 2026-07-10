import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Express } from 'express'
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

/**
 * Independent, hard-coded inventory of every `{method, path}` Express
 * registers, as literal *route patterns* (e.g. `/health/:client`, not a
 * concrete `/health/zwave` test path). This is a SEPARATE list from `ROUTES`
 * above (which uses concrete substituted paths so supertest can fire real
 * requests) and is not derived from `app.ts`, `ROUTES`, or any other
 * production constant.
 *
 * Unlike the `ROUTES` inventory - which can only ever tell you that its own
 * 35 hard-coded entries still resolve - this compares against the COMPLETE
 * actual set of routes Express registered (via `app._router.stack`
 * introspection). That means it fails loudly for every kind of drift:
 *  - a new route is added to `app.ts` and forgotten here (actual has an
 *    entry expected doesn't)
 *  - a route is removed/renamed from `app.ts` but left here (expected has an
 *    entry actual doesn't)
 *  - a route's method or path pattern changes (set membership differs even
 *    though the counts might coincidentally match)
 */
const EXPECTED_REGISTERED_ROUTES: Array<{
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
	{ method: 'get', path: '/health/:client' },
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
		path: '/api/configuration-templates/device-params/:deviceId',
	},
	{ method: 'put', path: '/api/configuration-templates/:id' },
	{ method: 'delete', path: '/api/configuration-templates/:id' },
	{ method: 'post', path: '/api/configuration-templates/:id/apply' },

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

/**
 * Express internals aren't part of the public `Express` type, hence the
 * narrow structural type instead of `any`.
 */
interface ExpressRouteLayer {
	route?: {
		path: string
		methods: Record<string, boolean>
	}
}

interface ExpressAppInternals {
	_router: { stack: ExpressRouteLayer[] }
}

/**
 * Walks the real Express router stack and returns every `{method, path}`
 * pair Express actually registered a handler for - the ground truth, not a
 * hard-coded guess. Only route layers (`app.get/post/put/delete(...)`) are
 * counted; bare middleware (`app.use(...)`, static file serving, the SPA
 * history fallback, error handlers, ...) has no `.route` and is skipped.
 */
function getActualRegisteredRoutes(
	app: Express,
): Array<{ method: string; path: string }> {
	const stack = (app as unknown as ExpressAppInternals)._router.stack
	const routes: Array<{ method: string; path: string }> = []
	for (const layer of stack) {
		if (!layer.route) continue
		for (const method of Object.keys(layer.route.methods)) {
			if (layer.route.methods[method]) {
				routes.push({ method, path: layer.route.path })
			}
		}
	}
	return routes
}

function sortRoutes<T extends { method: string; path: string }>(
	routes: T[],
): T[] {
	return [...routes].sort((a, b) =>
		`${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`),
	)
}

describe('HTTP contract: complete Express route inventory (drift detection)', () => {
	let harness: HttpHarness

	beforeAll(async () => {
		harness = await createHttpHarness()
	})

	afterAll(async () => {
		await harness.close()
	})

	it('registers exactly the independently expected 35 routes - no more, no fewer', () => {
		const actual = getActualRegisteredRoutes(harness.app)
		expect(actual).toHaveLength(EXPECTED_REGISTERED_ROUTES.length)
		expect(sortRoutes(actual)).toEqual(
			sortRoutes(EXPECTED_REGISTERED_ROUTES),
		)
	})

	it('has no duplicate {method, path} registrations', () => {
		const actual = getActualRegisteredRoutes(harness.app)
		const seen = new Set<string>()
		const duplicates: string[] = []
		for (const { method, path } of actual) {
			const key = `${method} ${path}`
			if (seen.has(key)) duplicates.push(key)
			seen.add(key)
		}
		expect(duplicates).toEqual([])
	})
})
