import jwt from 'jsonwebtoken'
import { TEST_SESSION_SECRET } from '../shared/env.ts'
import type { HttpHarness } from './harness.ts'
import { hashPsw } from '#api/lib/utils.ts'

export interface TestUser {
	username: string
	passwordHash: string
}

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

export function signUserToken(user: { username: string }): string {
	return jwt.sign({ username: user.username }, TEST_SESSION_SECRET, {
		expiresIn: '1d',
	})
}

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
