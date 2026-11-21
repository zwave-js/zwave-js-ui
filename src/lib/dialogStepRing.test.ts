import { describe, expect, it } from 'vitest'
import { RING_GAP_DEG, stepRing } from './dialogStepRing.ts'

const C = 2 * Math.PI * 20.5

function numbers(dasharray: string) {
	return dasharray.split(' ').map(Number)
}

function allFinite(...values: number[]) {
	return values.every((v) => Number.isFinite(v))
}

describe('stepRing', () => {
	it('renders one full circle with a single step', () => {
		const ring = stepRing(1, 0, C)
		expect(ring.bgDash).toBe(`${C}`)
		expect(ring.rotationDeg).toBe(-90)
	})

	it('stays finite with no steps', () => {
		const ring = stepRing(0, 0, C)
		expect(numbers(ring.bgDash).every(Number.isFinite)).toBe(true)
		expect(allFinite(...numbers(ring.done.dasharray))).toBe(true)
		expect(allFinite(...numbers(ring.active.dasharray))).toBe(true)
		expect(allFinite(ring.done.dashoffset, ring.active.dashoffset)).toBe(
			true,
		)
	})

	it('emits no active segment once every step is done', () => {
		const ring = stepRing(3, 3, C)
		expect(ring.active.dasharray).toBe('0')
		expect(numbers(ring.done.dasharray)).toHaveLength(6)
	})

	it('clamps a current index past the last step', () => {
		expect(stepRing(3, 99, C)).toEqual(stepRing(3, 3, C))
	})

	it('clamps a negative current index to the first step', () => {
		expect(stepRing(3, -2, C)).toEqual(stepRing(3, 0, C))
	})

	it('never emits a negative dash segment', () => {
		for (let total = 0; total <= 24; total++) {
			for (let current = 0; current <= total; current++) {
				const ring = stepRing(total, current, C)
				const segments = [
					...numbers(ring.bgDash),
					...numbers(ring.done.dasharray),
					...numbers(ring.active.dasharray),
				]
				expect(
					segments.every((s) => Number.isFinite(s) && s >= 0),
				).toBe(true)
			}
		}
	})

	it('shrinks the gap below the default once slots get narrow', () => {
		// 360/17 = 21.2°, narrower than the 22° default gap
		const wide = stepRing(4, 1, C)
		const narrow = stepRing(17, 1, C)
		expect(wide.rotationDeg).toBe(RING_GAP_DEG / 2 - 90)
		// Rotation is half the gap, so a shrunken gap rotates less
		expect(narrow.rotationDeg).toBeLessThan(wide.rotationDeg)
		expect(numbers(narrow.bgDash)[0]).toBeGreaterThan(0)
	})

	it('sums the done pattern to the full circumference', () => {
		const ring = stepRing(4, 4, C)
		const sum = numbers(ring.done.dasharray).reduce((a, b) => a + b, 0)
		expect(sum).toBeCloseTo(C, 6)
	})
})
