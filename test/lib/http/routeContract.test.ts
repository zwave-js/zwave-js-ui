import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express, { type Express } from 'express'
import { createHttpHarness, type HttpHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'

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

/**
 * ONE harness, shared by every `describe` block in this file (created in a
 * file-scoped `beforeAll`/`afterAll`, not nested inside each `describe`).
 *
 * This file used to give each of its two `describe` blocks its OWN
 * `beforeAll`/`afterAll` pair, each creating and closing its own harness.
 * That's unsafe: `harness.ts` caches `api/app.ts`/`api/lib/jsonStore.ts`/
 * `api/lib/Gateway.ts` module imports ONCE per test file
 * (`appModulePromise`/`jsonStoreModulePromise`/`gatewayModulePromise`), so
 * a SECOND `createHttpHarness()` call in the same file reuses those
 * already-evaluated modules instead of re-importing them - while
 * `env.ts`'s `ensureTestEnv()` happily mints a brand new throwaway
 * `STORE_DIR` every time its own `storeDir` variable is `undefined` (i.e.
 * after the first harness's `close()` already called `cleanupTestEnv()`).
 * The result: the cached `api/config/app.ts`-derived `storeDir` constant
 * keeps pointing at the FIRST harness's directory - which the first
 * `close()` already `rmSync`'d - while `Gateway.ts`'s file watchers stay
 * bound to that same deleted path, and the second harness's
 * `__testHooks.loadSnippets()` call would duplicate every bundled snippet
 * name in `defaultSnippets` (that specific duplication is now also fixed
 * at its own root cause: `loadSnippets()` in `api/app.ts` clears
 * `defaultSnippets` before repopulating it, so it's idempotent regardless
 * of how many times - or in how many harnesses - it's called; see the
 * "does not duplicate snippets" test below, which exercises exactly that).
 */
let harness: HttpHarness

beforeAll(async () => {
	harness = await createHttpHarness()
})

afterAll(async () => {
	await harness.close()
})

describe('HTTP contract: full 35-route inventory', () => {
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

	it('does not duplicate bundled snippets when loadSnippets() runs more than once', async () => {
		// Regression for the exact bug the module-level harness comment
		// above describes: before `loadSnippets()` cleared `defaultSnippets`
		// first, calling it twice - which used to happen organically
		// whenever this file created a second harness - would duplicate
		// every bundled snippet name. Calling the seam directly here proves
		// idempotency without needing a second harness (which would
		// reintroduce the very bug this test guards against).
		await harness.testHooks.loadSnippets()
		await harness.testHooks.loadSnippets()

		harness.testHooks.setGateway(createFakeGateway())
		const res = await harness.request.get('/api/snippet')
		expect(res.status).toBe(200)

		const names = (res.body.data as Array<{ name: string }>).map(
			(s) => s.name,
		)
		const counts = new Map<string, number>()
		for (const name of names) {
			counts.set(name, (counts.get(name) ?? 0) + 1)
		}
		const duplicated = [...counts.entries()].filter(
			([, count]) => count > 1,
		)
		expect(duplicated).toEqual([])

		// Don't leak the fake gateway into whatever runs next in this file.
		harness.resetState()
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
 * narrow structural type instead of `any`. `name`/`regexp`/`handle` are
 * present on every middleware layer (not just `.route` layers) - `name` is
 * `'router'` for a layer created by `app.use(mountPath, someRouter)`,
 * `regexp` is the compiled mount-path matcher, and `handle.stack` is that
 * sub-router's OWN layer stack.
 */
interface ExpressRouteLayer {
	route?: {
		path: string
		methods: Record<string, boolean>
	}
	name?: string
	regexp?: RegExp
	handle?: { stack?: ExpressRouteLayer[] }
}

interface ExpressAppInternals {
	_router: { stack: ExpressRouteLayer[] }
}

/**
 * Reverses path-to-regexp@0.1.x's (bundled with this repo's pinned Express
 * 4.x) compiled mount-path regexp back into a literal string prefix - e.g.
 * the regexp Express stores for `app.use('/api/sub', router)`,
 * `/^\/api\/sub\/?(?=\/|$)/i`, becomes `'/api/sub'`.
 *
 * This intentionally only recognizes that one specific, stable shape:
 * a LITERAL mount path (no `:params`, no wildcards), compiled with
 * Express's default router options (`end: false`). It does not - and
 * cannot in general - invert an arbitrary `path-to-regexp` pattern (that
 * transform isn't reversible once params/wildcards are involved); mount
 * paths with those are rare in practice and none exist in this app today,
 * so callers get `undefined` for them instead of a fabricated, incorrect
 * prefix.
 */
function extractLiteralMountPrefix(regexp: RegExp): string | undefined {
	const match = /^\^((?:\\\/[^\\/]+)*)\\\/\?\(\?=\\\/\|\$\)$/.exec(
		regexp.source,
	)
	if (!match) return undefined
	return match[1].replace(/\\\//g, '/')
}

/**
 * Recursively walks the real Express router stack - INCLUDING every
 * mounted sub-router's own stack (`layer.handle.stack`, at any nesting
 * depth), preserving each sub-router's mount prefix - and returns every
 * `{method, path}` pair Express actually registered a handler for. This is
 * the ground truth, not a hard-coded guess: a route registered inside a
 * mounted sub-router (e.g. `app.use('/api/sub', subRouter)` with
 * `subRouter.get('/thing', ...)`) is reported as `GET /api/sub/thing`,
 * exactly as if it had been registered directly with
 * `app.get('/api/sub/thing', ...)`. A flat, top-level-only scan of
 * `app._router.stack` (the previous implementation) would silently miss
 * routes like that entirely - the exact gap this recursion closes; see
 * the "recursive router traversal" tests below for a regression proving a
 * nested router route is detected with its mount prefix intact.
 *
 * Only route layers (`.get/.post/.put/.delete(...)`) are counted; bare
 * middleware (`app.use(fn)`, static file serving, the SPA history
 * fallback, error handlers, ...) has no `.route` and is skipped.
 */
function getActualRegisteredRoutes(
	app: Express,
): Array<{ method: string; path: string }> {
	const routes: Array<{ method: string; path: string }> = []

	function walk(stack: ExpressRouteLayer[], prefix: string) {
		for (const layer of stack) {
			if (layer.route) {
				for (const method of Object.keys(layer.route.methods)) {
					if (layer.route.methods[method]) {
						routes.push({
							method,
							path: `${prefix}${layer.route.path}`,
						})
					}
				}
				continue
			}

			const nestedStack = layer.handle?.stack
			if (layer.name === 'router' && Array.isArray(nestedStack)) {
				const mountPrefix = layer.regexp
					? extractLiteralMountPrefix(layer.regexp)
					: undefined
				walk(nestedStack, `${prefix}${mountPrefix ?? ''}`)
			}
		}
	}

	walk((app as unknown as ExpressAppInternals)._router.stack, '')
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

describe('getActualRegisteredRoutes: recursive router traversal', () => {
	/**
	 * These exercise the traversal function itself against small, disposable
	 * Express apps built inline - NOT the real `api/app.ts` (which has no
	 * mounted sub-routers today; see `EXPECTED_REGISTERED_ROUTES` above,
	 * unchanged). That keeps this a true regression test for the algorithm,
	 * independent of - and unaffected by - whatever the production app
	 * happens to register.
	 */
	it('detects a route registered on a mounted sub-router, with the mount prefix preserved', () => {
		const subRouter = express.Router()
		subRouter.get('/thing', (_req, res) => res.end())
		subRouter.post('/other', (_req, res) => res.end())

		const testApp = express()
		testApp.get('/top-level', (_req, res) => res.end())
		testApp.use('/api/sub', subRouter)

		const routes = getActualRegisteredRoutes(testApp)

		expect(sortRoutes(routes)).toEqual(
			sortRoutes([
				{ method: 'get', path: '/top-level' },
				{ method: 'get', path: '/api/sub/thing' },
				{ method: 'post', path: '/api/sub/other' },
			]),
		)
	})

	it('detects routes nested two levels deep (a sub-router mounted inside another sub-router)', () => {
		const innerRouter = express.Router()
		innerRouter.get('/deep', (_req, res) => res.end())

		const outerRouter = express.Router()
		outerRouter.use('/inner', innerRouter)

		const testApp = express()
		testApp.use('/api/outer', outerRouter)

		const routes = getActualRegisteredRoutes(testApp)

		expect(routes).toEqual([
			{ method: 'get', path: '/api/outer/inner/deep' },
		])
	})

	it('detects a sub-router route mounted at the app root', () => {
		const subRouter = express.Router()
		subRouter.get('/root-mounted', (_req, res) => res.end())

		const testApp = express()
		testApp.use(subRouter)

		const routes = getActualRegisteredRoutes(testApp)

		expect(routes).toEqual([{ method: 'get', path: '/root-mounted' }])
	})
})
