import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express, { type Express } from 'express'
import { createHttpHarness, type HttpHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'

const ROUTES: Array<{
	method: 'get' | 'post' | 'put' | 'delete'
	path: string
}> = [
	{ method: 'get', path: '/api/auth-enabled' },
	{ method: 'post', path: '/api/authenticate' },
	{ method: 'get', path: '/api/logout' },
	{ method: 'put', path: '/api/password' },

	{ method: 'get', path: '/health' },
	{ method: 'get', path: '/health/zwave' },
	{ method: 'get', path: '/version' },

	{ method: 'get', path: '/api/settings' },
	{ method: 'get', path: '/api/serial-ports' },
	{ method: 'post', path: '/api/settings' },
	{ method: 'post', path: '/api/restart' },
	{ method: 'post', path: '/api/statistics' },
	{ method: 'post', path: '/api/versions' },

	{ method: 'get', path: '/api/exportConfig' },
	{ method: 'post', path: '/api/importConfig' },

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

	{ method: 'get', path: '/api/store' },
	{ method: 'put', path: '/api/store' },
	{ method: 'delete', path: '/api/store' },
	{ method: 'put', path: '/api/store-multi' },
	{ method: 'post', path: '/api/store-multi' },
	{ method: 'get', path: '/api/store/backup' },
	{ method: 'post', path: '/api/store/upload' },
	{ method: 'get', path: '/api/snippet' },

	{ method: 'get', path: '/api/debug/status' },
	{ method: 'post', path: '/api/debug/start' },
	{ method: 'post', path: '/api/debug/stop' },
	{ method: 'post', path: '/api/debug/cancel' },
]

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
			if (path === '/api/store/backup') {
				// Parse the ZIP as bytes because its JSON content type triggers Superagent's JSON parser
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

const EXPECTED_REGISTERED_ROUTES: Array<{
	method: 'get' | 'post' | 'put' | 'delete'
	path: string
}> = [
	{ method: 'get', path: '/api/auth-enabled' },
	{ method: 'post', path: '/api/authenticate' },
	{ method: 'get', path: '/api/logout' },
	{ method: 'put', path: '/api/password' },

	{ method: 'get', path: '/health' },
	{ method: 'get', path: '/health/:client' },
	{ method: 'get', path: '/version' },

	{ method: 'get', path: '/api/settings' },
	{ method: 'get', path: '/api/serial-ports' },
	{ method: 'post', path: '/api/settings' },
	{ method: 'post', path: '/api/restart' },
	{ method: 'post', path: '/api/statistics' },
	{ method: 'post', path: '/api/versions' },

	{ method: 'get', path: '/api/exportConfig' },
	{ method: 'post', path: '/api/importConfig' },

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

	{ method: 'get', path: '/api/store' },
	{ method: 'put', path: '/api/store' },
	{ method: 'delete', path: '/api/store' },
	{ method: 'put', path: '/api/store-multi' },
	{ method: 'post', path: '/api/store-multi' },
	{ method: 'get', path: '/api/store/backup' },
	{ method: 'post', path: '/api/store/upload' },
	{ method: 'get', path: '/api/snippet' },

	{ method: 'get', path: '/api/debug/status' },
	{ method: 'post', path: '/api/debug/start' },
	{ method: 'post', path: '/api/debug/stop' },
	{ method: 'post', path: '/api/debug/cancel' },
]

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

function extractLiteralMountPrefix(regexp: RegExp): string | undefined {
	// Decode only the literal mount shape emitted by Express 4
	const match = /^\^((?:\\\/[^\\/]+)*)\\\/\?\(\?=\\\/\|\$\)$/.exec(
		regexp.source,
	)
	if (!match) return undefined
	return match[1].replace(/\\\//g, '/')
}

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
