import { describe, it, expect } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { useHttpHarness } from './harness.ts'
import { seedUser } from '../shared/authHelpers.ts'
import { getTestStoreDir } from '../shared/env.ts'
import type { User } from '#api/config/store.ts'

interface SessionFile {
	user?: Partial<User>
}

// Reads back the on-disk session files to inspect req.session.user's actual persisted shape, which is typed User | PublicUser
async function readAllSessionFiles(): Promise<SessionFile[]> {
	const sessionsDir = path.join(getTestStoreDir(), 'sessions')
	let files: string[]
	try {
		files = await readdir(sessionsDir)
	} catch {
		return []
	}
	const sessions: SessionFile[] = []
	for (const file of files) {
		if (!file.endsWith('.json')) continue
		const raw = await readFile(path.join(sessionsDir, file), 'utf8')
		sessions.push(JSON.parse(raw) as SessionFile)
	}
	return sessions
}

function findSessionForUsername(
	sessions: SessionFile[],
	username: string,
): SessionFile {
	const match = sessions.find((s) => s.user?.username === username)
	expect(match).toBeDefined()
	return match
}

describe('session store serialization', () => {
	const getHarness = useHttpHarness()

	it('does NOT persist passwordHash in the session after POST /api/authenticate', async () => {
		const harness = await getHarness()
		await seedUser(harness, 'session-auth-user', 'a-password')
		const agent = harness.agent

		const res = await agent.post('/api/authenticate').send({
			username: 'session-auth-user',
			password: 'a-password',
		})
		expect(res.body.success).toBe(true)

		const sessions = await readAllSessionFiles()
		const match = findSessionForUsername(sessions, 'session-auth-user')

		expect(match.user).not.toHaveProperty('passwordHash')
	})

	it('persists passwordHash in the session after PUT /api/password', async () => {
		const harness = await getHarness()
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
