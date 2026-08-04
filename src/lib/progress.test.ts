import { describe, expect, it } from 'vitest'
import { progressValue } from './progress.ts'

describe('progressValue', () => {
	it('maps a missing value to v0 indeterminate', () => {
		expect(progressValue(null)).toBeUndefined()
		expect(progressValue(undefined)).toBeUndefined()
	})

	it('passes a number through untouched, leaving clamping to v0', () => {
		expect(progressValue(42)).toBe(42)
		expect(progressValue(7.5)).toBe(7.5)
		expect(progressValue(140)).toBe(140)
		expect(progressValue(-5)).toBe(-5)
	})

	it('falls back to min for non-finite input rather than rendering NaN', () => {
		expect(progressValue(NaN)).toBe(0)
		expect(progressValue(Infinity)).toBe(0)
		expect(progressValue(-Infinity)).toBe(0)
		expect(progressValue(NaN, 2)).toBe(2)
	})
})
