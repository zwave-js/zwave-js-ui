import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHttpHarness, type HttpHarness } from './harness.ts'

// Isolated in its own file since exhausting loginLimiter's budget (5
// requests/hour, keyed by IP) would otherwise bleed into auth.test.ts's
// other /api/authenticate tests; each test file gets its own module graph,
// so the limiter here starts fresh
describe('HTTP contract: login rate limiting (preserved quirk)', () => {
	let harness: HttpHarness

	beforeAll(async () => {
		harness = await createHttpHarness()
	})

	afterAll(async () => {
		await harness.close()
	})

	it('replies with the HTTP-200 rate-limit envelope once the login budget is exhausted', async () => {
		// A successful login resets the counter, so exhausting the limit
		// requires 6 consecutive failures (max: 5 allows the first 5 through)
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

		// Rate-limit rejections also resolve with HTTP 200, with a distinct
		// envelope shape from the normal auth-failure one (no code field)
		expect(lastStatus).toBe(200)
		expect(lastBody).toEqual({
			success: false,
			message: 'Max requests limit reached',
		})
	})
})
