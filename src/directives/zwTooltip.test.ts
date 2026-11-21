import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolvePlacement, stringify } from './zwTooltip.ts'

// Only the pure label and placement logic is covered here. The hover, focus and
// popover behaviour needs a DOM harness the repo doesn't carry yet.

afterEach(() => {
	vi.restoreAllMocks()
})

describe('stringify', () => {
	it('keeps strings and numbers', () => {
		expect(stringify('Alive')).toBe('Alive')
		expect(stringify(42)).toBe('42')
		expect(stringify(10n)).toBe('10')
	})

	it('treats everything else as no tooltip', () => {
		expect(stringify(undefined)).toBe('')
		expect(stringify(null)).toBe('')
		expect(stringify(false)).toBe('')
		expect(stringify({ text: 'x' })).toBe('')
	})
})

describe('resolvePlacement', () => {
	it('prefers the options location over the directive arg', () => {
		expect(resolvePlacement('bottom', 'top')).toBe('bottom')
	})

	it('falls back to the arg when no location is given', () => {
		expect(resolvePlacement(undefined, 'right')).toBe('right')
	})

	it('maps start and end without consulting text direction', () => {
		expect(resolvePlacement('start', undefined)).toBe('left')
		expect(resolvePlacement('end', undefined)).toBe('right')
	})

	it('defaults to top when neither is given', () => {
		expect(resolvePlacement(undefined, undefined)).toBe('top')
	})

	it('ignores inherited Object keys', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {})
		expect(resolvePlacement('toString', undefined)).toBe('top')
		expect(resolvePlacement('constructor', 'bottom')).toBe('bottom')
	})

	it('warns on a location it cannot map', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		// Vuetify accepts this compound form; the directive does not
		expect(resolvePlacement('bottom end', undefined)).toBe('top')
		expect(warn).toHaveBeenCalled()
	})
})
