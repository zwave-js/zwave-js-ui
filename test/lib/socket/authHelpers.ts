// Structurally typed against { jsonStore, store } so it works with either harness without importing its full type
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

// Signs the JWT the same way /api/authenticate and the socket auth middleware verify it
export function signUserToken(user: { username: string }): string {
	return jwt.sign({ username: user.username }, TEST_SESSION_SECRET, {
		expiresIn: '1d',
	})
}

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
