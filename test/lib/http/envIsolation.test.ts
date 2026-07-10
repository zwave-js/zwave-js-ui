import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHttpHarness, type HttpHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'
import { seedUser } from './authHelpers.ts'

/**
 * Regression coverage for `test/lib/http/env.ts`'s ambient-env-var
 * normalization: this file sets representative, disruptive values for every
 * app-affecting env var `ensureTestEnv()` snapshots/normalizes/restores -
 * BEFORE creating the harness (and therefore before `api/app.ts` is
 * imported) - to prove they cannot leak into, or alter, the HTTP contract.
 *
 * Isolated in its own file (its own Vitest module graph) so mutating
 * `process.env` here can never bleed into the other HTTP contract suites,
 * and so this file's `beforeAll` runs before ANY of these ambient values
 * would otherwise have been normalized away by another file's harness.
 */
const AMBIENT_ENV: Record<string, string> = {
	HOST: '203.0.113.1',
	PORT: '1',
	// STORE_DIR / SESSION_SECRET deliberately excluded: the harness itself
	// must always win those two so route handlers never touch real data.
	ZWAVE_PORT: '/dev/ttyAMBIENT',
	ZWAVE_EXTERNAL_SETTINGS: '/nonexistent/ambient-settings.json',
	NETWORK_KEY: 'ambient-network-key',
	HTTPS: 'true',
	USE_SECURE_COOKIE: 'true',
	ZWAVEJS_EXTERNAL_CONFIG: '/nonexistent/ambient-config-db',
	TZ: 'Ambient/Zone',
	LOCALE: 'xx-XX',
	FORCE_DISABLE_SSL: 'true',
	TRUST_PROXY: '99',
	SSL_CERTIFICATE: '/nonexistent/ambient-cert.pem',
	SSL_KEY: '/nonexistent/ambient-key.pem',
	ZWAVEJS_LOGS_DIR: '/nonexistent/ambient-logs',
	BACKUPS_DIR: '/nonexistent/ambient-backups',
	DEFAULT_USERNAME: 'ambient-admin',
	DEFAULT_PASSWORD: 'ambient-password',
	BASE_PATH: '/ambient',
	TAG_NAME: 'zwavejs2mqtt',
}

describe('HTTP contract: ambient env vars cannot alter the app under test', () => {
	let harness: HttpHarness
	let originalValues: Record<string, string | undefined>

	beforeAll(async () => {
		// Simulate a polluted host shell / CI runner / leftover from a prior
		// process by setting every ambient var BEFORE the harness (and thus
		// `api/app.ts`) is ever imported.
		originalValues = {}
		for (const [key, value] of Object.entries(AMBIENT_ENV)) {
			originalValues[key] = process.env[key]
			process.env[key] = value
		}

		harness = await createHttpHarness()
	})

	afterAll(async () => {
		await harness.close()
		for (const [key, original] of Object.entries(originalValues)) {
			if (original === undefined) delete process.env[key]
			else process.env[key] = original
		}
	})

	it('normalizes STORE_DIR to an isolated harness-owned directory, not the real repo store', () => {
		// `ensureTestEnv()` always sets `STORE_DIR` itself (never inherited
		// from ambient state), so route handlers here never read/write the
		// repository's real `store/` directory.
		expect(process.env.STORE_DIR).toBeDefined()
		expect(process.env.STORE_DIR).not.toBe('')
		expect(process.env.STORE_DIR).toContain('zwave-js-ui-http-contract-')
	})

	it('ignores ambient FORCE_DISABLE_SSL/HTTPS: sslDisabled reports false, not the ambient true', async () => {
		const res = await harness.request.get('/api/settings')

		expect(res.status).toBe(200)
		expect(res.body.sslDisabled).toBe(false)
	})

	it('ignores ambient TZ/LOCALE: settings echoes undefined, not the ambient values', async () => {
		const res = await harness.request.get('/api/settings')

		expect(res.status).toBe(200)
		expect(res.body.tz).toBeUndefined()
		expect(res.body.locale).toBeUndefined()
	})

	it('ignores ambient TAG_NAME: deprecationWarning is false, not true', async () => {
		const res = await harness.request.get('/api/settings')

		expect(res.status).toBe(200)
		expect(res.body.deprecationWarning).toBe(false)
	})

	it('ignores ambient ZWAVE_PORT: /api/serial-ports still calls the (mocked) enumerator instead of skipping it', async () => {
		let called = false
		harness.testHooks.setEnumerateSerialPorts(() => {
			called = true
			return Promise.resolve(['/dev/ttyISOLATED0'])
		})

		const res = await harness.request.get('/api/serial-ports')

		expect(called).toBe(true)
		expect(res.status).toBe(200)
		expect(res.body).toEqual({
			success: true,
			serial_ports: ['/dev/ttyISOLATED0'],
		})
	})

	it('ignores ambient HTTPS/USE_SECURE_COOKIE: session cookie is not marked Secure', async () => {
		await seedUser(harness, 'ambient-check', 'correct horse battery staple')

		const res = await harness.request.post('/api/authenticate').send({
			username: 'ambient-check',
			password: 'correct horse battery staple',
		})

		expect(res.status).toBe(200)
		const setCookie = res.headers['set-cookie']?.[0] ?? ''
		expect(setCookie).toMatch(/^zwave-js-ui-session=/)
		expect(setCookie.toLowerCase()).not.toContain('secure')
	})

	it('ignores ambient DEFAULT_USERNAME/DEFAULT_PASSWORD: no such user is auto-seeded from them', async () => {
		const gw = createFakeGateway()
		harness.testHooks.setGateway(gw)

		const res = await harness.request.post('/api/authenticate').send({
			username: AMBIENT_ENV.DEFAULT_USERNAME,
			password: AMBIENT_ENV.DEFAULT_PASSWORD,
		})

		expect(res.status).toBe(200)
		expect(res.body).toEqual({
			success: false,
			code: 3,
			message: 'General Error',
		})
	})
})
