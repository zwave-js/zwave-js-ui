/**
 * Characterizes: the Socket.IO auth middleware (`socketManager.authMiddleware`
 * in `api/app.ts`) - the handshake gate every connection must pass before
 * `SocketManager._onConnection` (and thus any inbound event handler) ever
 * runs.
 *
 * Real contract (`api/app.ts`):
 *  - `isAuthEnabled()` false (default) -> `next()` unconditionally, no
 *    token needed at all.
 *  - `isAuthEnabled()` true -> requires `socket.handshake.auth.token`,
 *    falling back to `socket.handshake.query.token` -> verified with
 *    `jwt.verify(token, sessionSecret, ...)`.
 *    - invalid/missing token -> `next(new Error('Authentication error'))`,
 *      which `socket.io-client` surfaces as a `connect_error` whose
 *      `.message` is exactly `'Authentication error'`.
 *    - valid token -> `next()`, and `socket.user` is set to the decoded
 *      payload (not independently observable from the client, but
 *      `INITED` etc. still work afterwards).
 *
 * One harness is shared for the whole file (`beforeAll`/`afterAll`) - see
 * `SocketHarness.close()`'s doc comment for why creating/closing a harness
 * per-test is unsafe. Each test resets auth back off and its own gateway
 * fake in `afterEach`.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { createSocketHarness, type SocketHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'
import { seedUser, setSettings, signUserToken } from './authHelpers.ts'

describe('Socket contract: auth middleware', () => {
	let harness: SocketHarness

	beforeAll(async () => {
		harness = await createSocketHarness()
	})

	afterAll(async () => {
		await harness.close()
	})

	afterEach(async () => {
		await harness.disconnectAllClients()
		harness.resetState()
		await setSettings(harness, { gateway: {} })
	})

	it('accepts a connection with no token when auth is disabled (default)', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)

		const client = harness.createClient()
		await expect(harness.connectClient(client)).resolves.toBe(client)
		expect(client.connected).toBe(true)
	})

	it('rejects a connection with no token once auth is enabled, with the exact "Authentication error" message', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		await setSettings(harness, { gateway: { authEnabled: true } })

		const client = harness.createClient()
		await expect(harness.connectClient(client)).rejects.toThrow(
			'Authentication error',
		)
		expect(client.connected).toBe(false)
	})

	it('rejects an invalid/garbage token with the exact "Authentication error" message', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		await setSettings(harness, { gateway: { authEnabled: true } })

		const client = harness.createClient({
			auth: { token: 'not-a-real-jwt' },
		})
		await expect(harness.connectClient(client)).rejects.toThrow(
			'Authentication error',
		)
	})

	it('accepts a valid token in handshake.auth.token', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		await setSettings(harness, { gateway: { authEnabled: true } })
		const user = await seedUser(harness, 'alice', 'irrelevant-password')
		const token = signUserToken(user)

		const client = harness.createClient({ auth: { token } })
		await expect(harness.connectClient(client)).resolves.toBe(client)
		expect(client.connected).toBe(true)

		// The connection isn't just "not rejected" - the real inbound
		// handlers behind the auth gate are reachable afterwards too.
		const state = await new Promise((resolve) => {
			client.emit('INITED', {}, resolve)
		})
		expect(state).toMatchObject({ nodes: [], info: {}, error: null })
	})

	it('falls back to handshake.query.token when auth.token is absent', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		await setSettings(harness, { gateway: { authEnabled: true } })
		const user = await seedUser(harness, 'bob', 'irrelevant-password')
		const token = signUserToken(user)

		const client = harness.createClient({ query: { token } })
		await expect(harness.connectClient(client)).resolves.toBe(client)
		expect(client.connected).toBe(true)
	})

	it('prefers auth.token over query.token when both are present', async () => {
		harness.testHooks.setGateway(createFakeGateway() as any)
		await setSettings(harness, { gateway: { authEnabled: true } })
		const user = await seedUser(harness, 'carol', 'irrelevant-password')
		const token = signUserToken(user)

		const client = harness.createClient({
			auth: { token },
			query: { token: 'garbage-that-would-fail-if-used' },
		})
		await expect(harness.connectClient(client)).resolves.toBe(client)
	})
})
