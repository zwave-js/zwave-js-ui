/**
 * Shared helpers for seeding users / toggling settings / minting JWTs
 * against the exact secret `api/app.ts` verifies with, used by the
 * Socket.IO auth suite. Structurally compatible with any harness exposing
 * `{ jsonStore, store }` (both `SocketHarness` and the HTTP suite's
 * `HttpHarness` satisfy this), so it doesn't need to import - or couple
 * itself to - either harness's full type.
 */
import jwt from 'jsonwebtoken'
import { TEST_SESSION_SECRET } from './env.ts'
import { hashPsw } from '../../../api/lib/utils.ts'

interface JsonStoreLike {
	jsonStore: {
		get: (model: { file: string }) => unknown
		put: (model: { file: string }, data: unknown) => Promise<unknown>
	}
	store: Record<string, { file: string; default: unknown }>
}

export interface TestUser {
	username: string
	passwordHash: string
}

/** Overwrite the users store with a single known user (hashed password). */
export async function seedUser(
	harness: JsonStoreLike,
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

/** Sign a JWT the same way `/api/authenticate` (and the socket auth middleware) verify. */
export function signUserToken(user: { username: string }): string {
	return jwt.sign({ username: user.username }, TEST_SESSION_SECRET, {
		expiresIn: '1d',
	})
}

/** Merge a partial settings object over the current settings and persist it. */
export async function setSettings(
	harness: JsonStoreLike,
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
