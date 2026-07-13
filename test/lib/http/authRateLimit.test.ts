import { describe, it, expect } from 'vitest'
import { useHttpHarness } from './harness.ts'

// The limiter budget is isolated from other authentication tests.
describe('HTTP contract: login rate limiting', () => {
	const getHarness = useHttpHarness()

	it('replies with the HTTP-200 rate-limit envelope once the login budget is exhausted', async () => {
		const harness = await getHarness()

		// A successful login resets the counter (`loginLimiter.resetKey`), so
		// exhausting the limit requires consecutive failures. `max: 5` allows
		// the first 5 requests through; the 6th is rejected by the limiter.
		let lastBody: unknown
		let lastStatus: number | undefined
		// Count six attempts because max: 5 lets the first five failures through
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

		// Rate-limit failures use an HTTP-200 envelope without a code field.
		expect(lastStatus).toBe(200)
		expect(lastBody).toEqual({
			success: false,
			message: 'Max requests limit reached',
		})
	})
})
