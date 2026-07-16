// Characterizes the real handshake gate: skips the token check when auth is disabled, otherwise
// requires a valid JWT via handshake.auth.token or its query.token fallback
import { describe, it, expect, afterEach } from 'vitest'
import { useSocketHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'
import { seedUser, setSettings, signUserToken } from '../shared/authHelpers.ts'
import { emit } from './helpers.ts'

describe('Socket contract: auth middleware', () => {
	const getHarness = useSocketHarness()

	afterEach(async () => {
		const harness = await getHarness()
		await setSettings(harness, { gateway: {} })
	})

	it('accepts a connection with no token when auth is disabled (default)', async () => {
		const harness = await getHarness({ gateway: createFakeGateway() })

		const client = harness.createClient()
		await expect(harness.connectClient(client)).resolves.toBe(client)
		expect(client.connected).toBe(true)
	})

	it('rejects a connection with no token once auth is enabled, with the exact "Authentication error" message', async () => {
		const harness = await getHarness({ gateway: createFakeGateway() })
		await setSettings(harness, { gateway: { authEnabled: true } })

		const client = harness.createClient()
		await expect(harness.connectClient(client)).rejects.toThrow(
			'Authentication error',
		)
		expect(client.connected).toBe(false)
	})

	it('rejects an invalid/garbage token with the exact "Authentication error" message', async () => {
		const harness = await getHarness({ gateway: createFakeGateway() })
		await setSettings(harness, { gateway: { authEnabled: true } })

		const client = harness.createClient({
			auth: { token: 'not-a-real-jwt' },
		})
		await expect(harness.connectClient(client)).rejects.toThrow(
			'Authentication error',
		)
	})

	it('accepts a valid token in handshake.auth.token', async () => {
		const harness = await getHarness({ gateway: createFakeGateway() })
		await setSettings(harness, { gateway: { authEnabled: true } })
		const user = await seedUser(harness, 'alice', 'irrelevant-password')
		const token = signUserToken(user)

		const client = harness.createClient({ auth: { token } })
		await expect(harness.connectClient(client)).resolves.toBe(client)
		expect(client.connected).toBe(true)

		// Proves the real INITED handler runs behind the gate, not just that the handshake passes
		const state = await emit(client, 'INITED', {})
		expect(state).toMatchObject({ nodes: [], info: {}, error: null })
	})

	it('falls back to handshake.query.token when auth.token is absent', async () => {
		const harness = await getHarness({ gateway: createFakeGateway() })
		await setSettings(harness, { gateway: { authEnabled: true } })
		const user = await seedUser(harness, 'bob', 'irrelevant-password')
		const token = signUserToken(user)

		const client = harness.createClient({ query: { token } })
		await expect(harness.connectClient(client)).resolves.toBe(client)
		expect(client.connected).toBe(true)
	})

	it('prefers auth.token over query.token when both are present', async () => {
		const harness = await getHarness({ gateway: createFakeGateway() })
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
