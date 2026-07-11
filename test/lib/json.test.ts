import { describe, it, expect } from 'vitest'
import { isJsonObject } from '../../api/lib/json.ts'
import type { JsonValue } from '../../api/lib/json.ts'

describe('#json', () => {
	describe('#isJsonObject()', () => {
		it('returns true for plain objects', () => {
			expect(isJsonObject({})).toBe(true)
			expect(isJsonObject({ foo: 'bar' })).toBe(true)
		})

		it('returns false for arrays', () => {
			expect(isJsonObject([])).toBe(false)
			expect(isJsonObject([1, 2, 3])).toBe(false)
		})

		it('returns false for null', () => {
			expect(isJsonObject(null)).toBe(false)
		})

		it('returns false for primitives', () => {
			expect(isJsonObject('foo')).toBe(false)
			expect(isJsonObject(42)).toBe(false)
			expect(isJsonObject(true)).toBe(false)
			expect(isJsonObject(undefined)).toBe(false)
		})
	})

	describe('JsonValue', () => {
		it('accepts the full range of JSON-compatible shapes', () => {
			const values: JsonValue[] = [
				null,
				'string',
				42,
				true,
				false,
				[1, 'two', false, null],
				{ nested: { a: 1, b: [1, 2, 3], c: null } },
			]

			for (const value of values) {
				// The type-level assertion above is the real point of this
				// test: if `JsonValue` regresses, this file fails to compile
				// under `tsc --noEmit`. This runtime check just guards
				// against `JSON.stringify`/`JSON.parse` round-tripping
				// losing information for each accepted shape.
				expect(JSON.parse(JSON.stringify(value))).toEqual(value)
			}
		})
	})
})
