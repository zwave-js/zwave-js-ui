import { describe, it, expect } from 'vitest'
import { useHttpHarness } from './harness.ts'
import { setSettings } from './authHelpers.ts'

// Keep this inventory independent so production auth-guard drift fails the suite
const GUARDED_ROUTES: Array<{
	method: 'get' | 'post' | 'put' | 'delete'
	path: string
}> = [
	{ method: 'get', path: '/api/logout' },
	{ method: 'put', path: '/api/password' },

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
		path: '/api/configuration-templates/device-params/1',
	},
	{ method: 'put', path: '/api/configuration-templates/template-1' },
	{ method: 'delete', path: '/api/configuration-templates/template-1' },
	{
		method: 'post',
		path: '/api/configuration-templates/template-1/apply',
	},

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

const DENIED_ENVELOPE = {
	success: false,
	message: 'General Error',
	code: 3,
}

describe('HTTP contract: auth guard coverage', () => {
	const getHarness = useHttpHarness()

	it(`has ${GUARDED_ROUTES.length} routes in the independent guarded-route inventory`, () => {
		expect(GUARDED_ROUTES.length).toBe(30)
	})

	it.each(GUARDED_ROUTES)(
		'$method $path denies with the HTTP-200 { success:false, message:"General Error", code:3 } envelope when auth is enabled and no session/token is presented',
		async ({ method, path }) => {
			const harness = await getHarness()
			await setSettings(harness, { gateway: { authEnabled: true } })

			const req = harness.request[method](path)
			const res = await (method === 'get' ? req : req.send({}))

			expect(res.status).toBe(200)
			expect(res.body).toEqual(DENIED_ENVELOPE)
		},
	)
})
