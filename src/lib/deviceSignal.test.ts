// Signal-display helper tests.

import { describe, it, expect } from 'vitest'
import { signalDisplay } from './deviceSignal.ts'
import { SignalHighIcon, SignalLowIcon } from './icons.ts'

describe('signalDisplay', () => {
	it('maps weak health to the low icon, warning color and "Weak"', () => {
		const s = signalDisplay('weak')
		expect(s.icon).to.equal(SignalLowIcon)
		expect(s.color).to.equal('var(--zw-warning)')
		expect(s.label).to.equal('Weak')
	})

	it('maps any non-weak health to the high icon, soft color and "Strong"', () => {
		for (const health of ['ok', 'unknown', undefined] as const) {
			const s = signalDisplay(health)
			expect(s.icon).to.equal(SignalHighIcon)
			expect(s.color).to.equal('var(--zw-fg-soft)')
			expect(s.label).to.equal('Strong')
		}
	})
})
