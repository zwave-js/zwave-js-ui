import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express, { type Express } from 'express'
import { createHttpHarness, type HttpHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'

// Every {method, path} route api/app.ts registers, listed independently
// (not introspected from app.ts) so a renamed/removed/re-methoded route
// fails loudly here too. Response content is characterized per route group
// in auth.test.ts, health.test.ts, settings.test.ts, importExport.test.ts,
// configurationTemplates.test.ts, store.test.ts, and debug.test.ts.
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

// One harness for the whole file, in a beforeAll/afterAll, not per describe
// block: harness.ts caches api/app.ts's module import per file, so a second
// createHttpHarness() call here would reuse that cached module while
// pointing at the first harness's already-`rmSync`'d STORE_DIR
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
			// Superagent would otherwise try to auto-parse this ZIP body as
			// JSON and throw before the status code is ever seen
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
		// Regression for a duplicate-snippet bug that used to appear whenever
		// this file created a second harness, calling loadSnippets() twice
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

		harness.resetState()
	})
})

// Literal route *patterns* (e.g. /health/:client, not a concrete test
// path), compared below against Express's actual registered stack to catch
// drift the concrete ROUTES list above can't: a route added, removed,
// renamed, or changed method without this list being updated
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

// Express doesn't export a type for its internal router stack, so this
// narrows just the fields every layer actually has (route layers and
// `router`-named mount layers alike)
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

// Reverses path-to-regexp@0.1.x's compiled mount-path regexp (bundled with
// this repo's pinned Express 4.x) back into a literal prefix, e.g.
// /^\/api\/sub\/?(?=\/|$)/i becomes '/api/sub'. Only that one literal-mount
// shape is supported; params/wildcards aren't invertible and none exist in
// this app's mount points today, so callers get undefined for those
function extractLiteralMountPrefix(regexp: RegExp): string | undefined {
	const match = /^\^((?:\\\/[^\\/]+)*)\\\/\?\(\?=\\\/\|\$\)$/.exec(
		regexp.source,
	)
	if (!match) return undefined
	return match[1].replace(/\\\//g, '/')
}

// Recursively walks the real Express router stack, including every mounted
// sub-router's own stack at any nesting depth, so a route registered inside
// a mounted sub-router (e.g. app.use('/api/sub', subRouter)) is reported
// with its mount prefix intact instead of being silently missed by a
// flat, top-level-only scan. Only route layers count; bare middleware
// (static serving, the SPA fallback, error handlers, ...) has no `.route`
// and is skipped.
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
	// Exercises the traversal algorithm against disposable apps built inline,
	// independent of api/app.ts (which has no mounted sub-routers today)
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
