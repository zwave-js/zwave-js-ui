import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHttpHarness, type HttpHarness } from './harness.ts'

describe('HTTP contract: login rate limiting (preserved quirk)', () => {
	let harness: HttpHarness

	beforeAll(async () => {
		harness = await createHttpHarness()
	})

	afterAll(async () => {
		await harness.close()
	})

	it('replies with the HTTP-200 rate-limit envelope once the login budget is exhausted', async () => {
		let lastBody: unknown
		let lastStatus: number | undefined
		for (let attempt = 1; attempt <= 6; attempt++) {
			const res = await harness.request
				.post('/api/authenticate')
				.send({ username: 'nobody', password: 'nope' })
			lastBody = res.body
			lastStatus = res.status

			if (attempt <= 5) {
				expect(res.body).toEqual({
					success: false,
					code: 3,
					message: 'General Error',
				})
			}
		}

		expect(lastStatus).toBe(200)
		expect(lastBody).toEqual({
			success: false,
			message: 'Max requests limit reached',
		})
	})
})
