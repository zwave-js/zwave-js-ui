import { describe, expect, it } from 'vitest'
import { progressPercent, progressValue } from './progress.ts'

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

	it('falls back to 0 for non-finite input rather than rendering NaN', () => {
		expect(progressValue(NaN)).toBe(0)
		expect(progressValue(Infinity)).toBe(0)
		expect(progressValue(-Infinity)).toBe(0)
	})
})

describe('progressPercent', () => {
	it('scales a value against its max', () => {
		expect(progressPercent(5, 10)).toBe(50)
		expect(progressPercent(0, 100)).toBe(0)
		expect(progressPercent(100, 100)).toBe(100)
		expect(progressPercent(1, 3)).toBe(33)
	})

	it('clamps out-of-range input', () => {
		expect(progressPercent(140, 100)).toBe(100)
		expect(progressPercent(-5, 100)).toBe(0)
	})

	it('returns 0 for a max that spans nothing', () => {
		expect(progressPercent(5, 0)).toBe(0)
		expect(progressPercent(5, -1)).toBe(0)
	})
})
