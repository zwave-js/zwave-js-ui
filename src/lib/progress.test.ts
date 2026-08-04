import { describe, expect, it } from 'vitest'
import { progressValue } from './progress.ts'

describe('progressValue', () => {
	it('maps a missing value to v0 indeterminate', () => {
		expect(progressValue(null, 0, 100)).toBeUndefined()
		expect(progressValue(undefined, 0, 100)).toBeUndefined()
	})

	it('passes a value inside the range through untouched', () => {
		expect(progressValue(42, 0, 100)).toBe(42)
		expect(progressValue(7.5, 0, 10)).toBe(7.5)
	})

	it('clamps to the range', () => {
		expect(progressValue(140, 0, 100)).toBe(100)
		expect(progressValue(-5, 0, 100)).toBe(0)
		expect(progressValue(11, 0, 10)).toBe(10)
	})

	it('falls back to min for non-finite input rather than rendering NaN', () => {
		expect(progressValue(NaN, 0, 100)).toBe(0)
		expect(progressValue(Infinity, 0, 100)).toBe(0)
		expect(progressValue(-Infinity, 0, 100)).toBe(0)
	})

	it('honours a non-zero min', () => {
		expect(progressValue(NaN, 2, 10)).toBe(2)
		expect(progressValue(1, 2, 10)).toBe(2)
	})
})
