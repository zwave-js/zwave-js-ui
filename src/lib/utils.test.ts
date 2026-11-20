import { describe, it, expect } from 'vitest'
import { getValueHint, plural } from './utils.js'

describe('#getValueHint()', () => {
	it.each([
		[{ description: 'Level' }, 'Level'],
		[{ min: 0, max: 99 }, '(Min: 0, max: 99)'],
		[{ min: 0 }, '(Min: 0)'],
		[{ min: 5, max: 5 }, ''],
		[{ min: 0, max: 10, step: 1 }, '(Min: 0, max: 10)'],
		[
			{ description: 'LED', default: 0, min: 0, max: 10, step: 5 },
			'LED (Default: 0, min: 0, max: 10, step: 5)',
		],
		[{ description: 'Mode', list: true, min: 0, max: 10 }, 'Mode'],
		[
			{ list: true, allowManualEntry: true, default: 5, min: 0, max: 10 },
			'(Default: 5, min: 0, max: 10)',
		],
	])('%o -> %s', (valueId, hint) => {
		expect(getValueHint(valueId)).to.equal(hint)
	})
})

describe('#plural()', () => {
	it.each([
		[0, 'node', undefined, '0 nodes'],
		[1, 'node', undefined, '1 node'],
		[2, 'node', undefined, '2 nodes'],
		[1, 'battery', 'batteries', '1 battery'],
		[3, 'battery', 'batteries', '3 batteries'],
	])('%i %s -> %s', (count, word, many, out) => {
		expect(plural(count, word, many)).toBe(out)
	})
})
