// relativeTime tests.

import { describe, it, expect } from 'vitest'
import { relativeTime } from './time.ts'

const NOW = 1700000000000

describe('relativeTime', () => {
	it('returns "never" for undefined', () => {
		expect(relativeTime(undefined, NOW)).to.equal('never')
	})
	it('returns "just now" within 10 seconds', () => {
		expect(relativeTime(NOW - 3000, NOW)).to.equal('just now')
		expect(relativeTime(NOW - 9999, NOW)).to.equal('just now')
	})
	it('formats seconds (10–59s)', () => {
		expect(relativeTime(NOW - 12000, NOW)).to.equal('12s ago')
	})
	it('formats minutes', () => {
		expect(relativeTime(NOW - 5 * 60 * 1000, NOW)).to.equal('5m ago')
	})
	it('formats hours', () => {
		expect(relativeTime(NOW - 3 * 3600 * 1000, NOW)).to.equal('3h ago')
	})
	it('formats days', () => {
		expect(relativeTime(NOW - 2 * 86400 * 1000, NOW)).to.equal('2d ago')
	})
})
