import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { createHttpHarness, type HttpHarness } from './harness.ts'
import { seedUser } from './authHelpers.ts'
import { getTestStoreDir } from './env.ts'

// Proves req.session.user's on-disk shape differs by login path, since SessionData.user is typed User | PublicUser for exactly that reason
async function readAllSessionFiles(): Promise<any[]> {
	const sessionsDir = path.join(getTestStoreDir(), 'sessions')
	let files: string[]
	try {
		files = await readdir(sessionsDir)
	} catch {
		return []
	}
	const sessions: any[] = []
	for (const file of files) {
		if (!file.endsWith('.json')) continue
		const raw = await readFile(path.join(sessionsDir, file), 'utf8')
		sessions.push(JSON.parse(raw))
	}
	return sessions
}

function findSessionForUsername(sessions: any[], username: string): any {
	const match = sessions.find((s) => s?.user?.username === username)
	expect(match).toBeDefined()
	return match
}

describe('session store serialization (passwordHash-in-session quirk)', () => {
	let harness: HttpHarness

	beforeAll(async () => {
		harness = await createHttpHarness()
	})

	afterAll(async () => {
		await harness.close()
	})

	it('does NOT persist passwordHash in the session after POST /api/authenticate', async () => {
		await seedUser(harness, 'session-auth-user', 'a-password')
		const agent = harness.agent

		const res = await agent.post('/api/authenticate').send({
			username: 'session-auth-user',
			password: 'a-password',
		})
		expect(res.body.success).toBe(true)

		const sessions = await readAllSessionFiles()
		const match = findSessionForUsername(sessions, 'session-auth-user')

		// /api/authenticate assigns a PublicUser with passwordHash already stripped to req.session.user
		expect(match.user).not.toHaveProperty('passwordHash')
	})

	it('DOES persist passwordHash in the session after PUT /api/password (documented quirk, not fixed here)', async () => {
		await seedUser(harness, 'session-pw-user', 'old-password')
		const agent = harness.agent

		const login = await agent.post('/api/authenticate').send({
			username: 'session-pw-user',
			password: 'old-password',
		})
		expect(login.body.success).toBe(true)

		const res = await agent.put('/api/password').send({
			current: 'old-password',
			new: 'new-password',
			confirmNew: 'new-password',
		})
		expect(res.body.success).toBe(true)
		expect(res.body.user).not.toHaveProperty('passwordHash')

		// PUT /api/password assigns the full User record, including the freshly-hashed password, to req.session.user
		const sessions = await readAllSessionFiles()
		const match = findSessionForUsername(sessions, 'session-pw-user')

		expect(match.user).toHaveProperty('passwordHash')
		expect(typeof match.user.passwordHash).toBe('string')
	})
})
