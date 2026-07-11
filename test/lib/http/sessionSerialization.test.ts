import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { createHttpHarness, type HttpHarness } from './harness.ts'
import { seedUser } from './authHelpers.ts'
import { getTestStoreDir } from './env.ts'

/**
 * Characterizes what `express-session`'s file-based store (`storeDir/
 * sessions/*.json`, see `api/app.ts`'s `session({ store: new FileStore(...)
 * })` setup) actually persists to disk for `req.session.user`, across every
 * code path that assigns it.
 *
 * This is a type-honesty regression, not a behavior test: `SessionData.user`
 * is typed `User | PublicUser` (see `api/app.ts`) specifically because the
 * two paths below genuinely persist different shapes. Neither shape is
 * changed here - this suite exists to prove that fact stays true (and to
 * document, rather than fix, the `passwordHash`-in-session quirk on the
 * `PUT /api/password` path) across future refactors.
 *
 * Parsed session file contents are intentionally left as `any`: they're
 * arbitrary on-disk JSON blobs owned by a third-party session store, not
 * something this test suite has (or needs) a static type for.
 */
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

		// Documented current behavior: `/api/authenticate` assigns a
		// PublicUser (passwordHash already stripped) to `req.session.user`,
		// so the on-disk session file for this login never contains it.
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
		// The HTTP response itself never leaks the hash...
		expect(res.body.user).not.toHaveProperty('passwordHash')

		// ...but the on-disk session file genuinely does: `PUT /api/password`
		// assigns the full `User` record (with the freshly-hashed password)
		// to `req.session.user`. This is a real, pre-existing quirk
		// (SessionData.user is honestly typed `User | PublicUser` because of
		// it) - documented and characterized here as a follow-up, not
		// changed by this suite.
		const sessions = await readAllSessionFiles()
		const match = findSessionForUsername(sessions, 'session-pw-user')

		expect(match.user).toHaveProperty('passwordHash')
		expect(typeof match.user.passwordHash).toBe('string')
	})
})
