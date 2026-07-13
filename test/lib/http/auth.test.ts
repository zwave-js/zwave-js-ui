import { describe, it, expect } from 'vitest'
import {
	useHttpHarness,
	type HttpHarness,
	type HttpHarnessOptions,
} from './harness.ts'
import { seedUser, signUserToken, setSettings } from '../shared/authHelpers.ts'

describe('HTTP contract: auth & password', () => {
	const getHttpHarness = useHttpHarness()
	let seededHarness: HttpHarness | undefined

	/**
	 * Lazily builds the per-test harness on first use — optionally with
	 * caller-supplied options — and seeds the default empty-gateway settings
	 * exactly once per harness instance. Nothing is instantiated up front, so a
	 * test can pass its own options on the first call instead of inheriting an
	 * eagerly built default harness from a beforeEach. Each test gets a fresh
	 * instance, so the identity guard re-seeds without any reset hook.
	 */
	async function getHarness(
		options?: HttpHarnessOptions,
	): Promise<HttpHarness> {
		const harness = await getHttpHarness(options)
		if (seededHarness !== harness) {
			await setSettings(harness, { gateway: {} })
			seededHarness = harness
		}
		return harness
	}

	describe('GET /api/auth-enabled', () => {
		it('returns success:true, data:false when auth is disabled (default)', async () => {
			const harness = await getHarness()
			const res = await harness.request.get('/api/auth-enabled')
			expect(res.status).toBe(200)
			expect(res.headers['content-type']).toMatch(/application\/json/)
			expect(res.body).toEqual({ success: true, data: false })
		})

		it('returns data:true once gateway.authEnabled is set', async () => {
			const harness = await getHarness()
			await setSettings(harness, { gateway: { authEnabled: true } })
			const res = await harness.request.get('/api/auth-enabled')
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ success: true, data: true })
		})
	})

	describe('POST /api/authenticate', () => {
		it('logs in with correct username/password, omits passwordHash, sets a session cookie', async () => {
			const harness = await getHarness()
			await seedUser(harness, 'alice', 'correct horse battery staple')

			const res = await harness.request.post('/api/authenticate').send({
				username: 'alice',
				password: 'correct horse battery staple',
			})

			expect(res.status).toBe(200)
			expect(res.body.success).toBe(true)
			expect(res.body.user.username).toBe('alice')
			expect(res.body.user.token).toEqual(expect.any(String))
			expect(res.body.user).not.toHaveProperty('passwordHash')
			expect(res.headers['set-cookie']?.[0]).toMatch(
				/^zwave-js-ui-session=/,
			)
		})

		it('rejects a wrong password with HTTP 200 and the general-error envelope', async () => {
			const harness = await getHarness()
			await seedUser(harness, 'bob', 'correct-password')

			const res = await harness.request.post('/api/authenticate').send({
				username: 'bob',
				password: 'wrong-password',
			})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				code: 3,
				message: 'General Error',
			})
		})

		it('rejects an unknown username the same way as a wrong password', async () => {
			const harness = await getHarness()
			const res = await harness.request.post('/api/authenticate').send({
				username: 'nobody',
				password: 'whatever',
			})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				code: 3,
				message: 'General Error',
			})
		})

		it('accepts a valid bearer JWT via body.token (session restore path)', async () => {
			const harness = await getHarness()
			const user = await seedUser(harness, 'carol', 'super-secret')
			const token = signUserToken(user)

			const res = await harness.request
				.post('/api/authenticate')
				.send({ token })

			expect(res.status).toBe(200)
			expect(res.body.success).toBe(true)
			expect(res.body.user.username).toBe('carol')
		})

		it('rejects a JWT signed with the wrong secret', async () => {
			const harness = await getHarness()
			await seedUser(harness, 'dave', 'irrelevant')
			const jwtLib = await import('jsonwebtoken')
			const badToken = jwtLib.default.sign(
				{ username: 'dave' },
				'not-the-real-secret',
			)

			const res = await harness.request
				.post('/api/authenticate')
				.send({ token: badToken })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'Authentication failed',
				code: 3,
			})
		})
	})

	describe('GET /api/logout', () => {
		it('destroys the session and reports success when auth is disabled', async () => {
			const harness = await getHarness()
			const res = await harness.request.get('/api/logout')
			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				message: 'User logged out',
			})
		})

		it('short-circuits with the HTTP-200 auth-error envelope when auth is enabled and no session/token is presented, without destroying anything', async () => {
			const harness = await getHarness()
			await setSettings(harness, { gateway: { authEnabled: true } })

			const res = await harness.request.get('/api/logout')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'General Error',
				code: 3,
			})
		})

		it('accepts a valid bearer token via the x-access-token header when auth is enabled', async () => {
			const harness = await getHarness()
			const user = await seedUser(harness, 'erin', 'pw')
			const token = signUserToken(user)
			await setSettings(harness, { gateway: { authEnabled: true } })

			const res = await harness.request
				.get('/api/logout')
				.set('x-access-token', token)

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: true,
				message: 'User logged out',
			})
		})
	})

	describe('PUT /api/password', () => {
		it('reports a missing user when there is no logged-in session', async () => {
			const harness = await getHarness()
			// Array.prototype.find never invokes its predicate on an empty users array, so this test's missing-session-user throw only reproduces if a user already exists; seed one directly so it holds regardless of shuffled run order
			await seedUser(harness, 'unrelated-seed-user', 'irrelevant')


			const res = await harness.request.put('/api/password').send({
				current: 'x',
				new: 'y',
				confirmNew: 'y',
			})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'User not found',
			})
		})

		it('changes the password end-to-end for a logged-in session and never leaks passwordHash', async () => {
			const harness = await getHarness()
			await seedUser(harness, 'frank', 'old-password')
			const agent = harness.agent

			const login = await agent.post('/api/authenticate').send({
				username: 'frank',
				password: 'old-password',
			})
			expect(login.body.success).toBe(true)

			const res = await agent.put('/api/password').send({
				current: 'old-password',
				new: 'new-password',
				confirmNew: 'new-password',
			})

			expect(res.status).toBe(200)
			expect(res.body.success).toBe(true)
			expect(res.body.message).toBe('Password updated')
			expect(res.body.user.username).toBe('frank')
			expect(res.body.user).not.toHaveProperty('passwordHash')

			const relogin = await harness.request
				.post('/api/authenticate')
				.send({ username: 'frank', password: 'new-password' })
			expect(relogin.body.success).toBe(true)
		})

		it('rejects with a clear message when the current password is wrong, without changing the password', async () => {
			const harness = await getHarness()
			await seedUser(harness, 'grace', 'right-password')
			const agent = harness.agent
			await agent.post('/api/authenticate').send({
				username: 'grace',
				password: 'right-password',
			})

			const res = await agent.put('/api/password').send({
				current: 'wrong-password',
				new: 'new-password',
				confirmNew: 'new-password',
			})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'Current password is wrong',
			})

			const relogin = await harness.request
				.post('/api/authenticate')
				.send({ username: 'grace', password: 'right-password' })
			expect(relogin.body.success).toBe(true)
		})

		it("rejects when new/confirmNew don't match, without changing the password", async () => {
			const harness = await getHarness()
			await seedUser(harness, 'heidi', 'right-password')
			const agent = harness.agent
			await agent.post('/api/authenticate').send({
				username: 'heidi',
				password: 'right-password',
			})

			const res = await agent.put('/api/password').send({
				current: 'right-password',
				new: 'aaa',
				confirmNew: 'bbb',
			})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: "Passwords doesn't match",
			})
		})
	})
})
