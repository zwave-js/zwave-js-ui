/**
 * Shared helpers for seeding users / minting JWTs against the exact secret
 * `api/app.ts` verifies with, used by the auth-dependent HTTP contract
 * suites (auth.test.ts, and any other group that needs an authenticated
 * session or a bearer token).
 */
import jwt from 'jsonwebtoken'
import { TEST_SESSION_SECRET } from './env.ts'
import type { HttpHarness } from './harness.ts'
import { hashPsw } from '../../../api/lib/utils.ts'

export interface TestUser {
	username: string
	passwordHash: string
}

/** Overwrite the users store with a single known user (hashed password). */
export async function seedUser(
	harness: HttpHarness,
	username: string,
	password: string,
): Promise<TestUser> {
	const user: TestUser = {
		username,
		passwordHash: await hashPsw(password),
	}
	await harness.jsonStore.put(harness.store.users, [user])
	return user
}

/** Sign a JWT the same way `/api/authenticate` does for a logged-in user. */
export function signUserToken(user: { username: string }): string {
	return jwt.sign({ username: user.username }, TEST_SESSION_SECRET, {
		expiresIn: '1d',
	})
}

/** Merge a partial settings object over the current settings and persist it. */
export async function setSettings(
	harness: HttpHarness,
	partial: Record<string, unknown>,
): Promise<void> {
	const current = harness.jsonStore.get(harness.store.settings) as Record<
		string,
		unknown
	>
	await harness.jsonStore.put(harness.store.settings, {
		...current,
		...partial,
	})
}
