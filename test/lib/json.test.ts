import { describe, it, expect } from 'vitest'
import { isJsonObject, isJsonValue } from '../../api/lib/json.ts'

describe('JSON boundaries', () => {
	describe('object validation', () => {
		it('returns true for plain objects', () => {
			expect(isJsonObject({})).toBe(true)
			expect(isJsonObject({ foo: 'bar' })).toBe(true)
		})

		it('returns true for a deeply-nested valid plain object', () => {
			expect(
				isJsonObject({
					a: 1,
					b: { c: [1, 2, { d: 'e', f: null }] },
				}),
			).toBe(true)
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

		it('returns false when a nested (not just top-level) value is hostile', () => {
			expect(isJsonObject({ a: { b: { c: undefined } } })).toBe(false)
			expect(isJsonObject({ a: [1, 2, new Date()] })).toBe(false)
			expect(isJsonObject({ a: () => {} })).toBe(false)
		})

		it('returns false for a plain object with a cycle', () => {
			const cyclic: Record<string, unknown> = { a: 1 }
			cyclic.self = cyclic
			expect(isJsonObject(cyclic)).toBe(false)
		})
	})

	describe('value validation', () => {
		it('accepts every JSON primitive', () => {
			expect(isJsonValue(null)).toBe(true)
			expect(isJsonValue('foo')).toBe(true)
			expect(isJsonValue(42)).toBe(true)
			expect(isJsonValue(0)).toBe(true)
			expect(isJsonValue(-1.5)).toBe(true)
			expect(isJsonValue(true)).toBe(true)
			expect(isJsonValue(false)).toBe(true)
		})

		it('accepts deeply-nested valid arrays/objects', () => {
			expect(
				isJsonValue({
					nested: {
						list: [1, 'two', false, null, { deep: [{}] }],
					},
				}),
			).toBe(true)
		})

		it('accepts an object with a null prototype as a plain object', () => {
			const value = Object.create(null)
			value.foo = 'bar'
			expect(isJsonValue(value)).toBe(true)
		})

		it('rejects undefined', () => {
			expect(isJsonValue(undefined)).toBe(false)
		})

		it('rejects functions', () => {
			expect(isJsonValue(() => {})).toBe(false)
			expect(isJsonValue(function named() {})).toBe(false)
		})

		it('rejects symbols', () => {
			expect(isJsonValue(Symbol('x'))).toBe(false)
		})

		it('rejects bigint', () => {
			expect(isJsonValue(BigInt(42))).toBe(false)
		})

		it('rejects non-finite numbers', () => {
			expect(isJsonValue(NaN)).toBe(false)
			expect(isJsonValue(Infinity)).toBe(false)
			expect(isJsonValue(-Infinity)).toBe(false)
		})

		it('rejects Date instances', () => {
			expect(isJsonValue(new Date())).toBe(false)
		})

		it('rejects Map/Set instances', () => {
			expect(isJsonValue(new Map())).toBe(false)
			expect(isJsonValue(new Set())).toBe(false)
		})

		it('rejects RegExp instances', () => {
			expect(isJsonValue(/abc/)).toBe(false)
		})

		it('rejects class instances (non-plain-object prototype)', () => {
			class Point {
				x = 1
				y = 2
			}
			expect(isJsonValue(new Point())).toBe(false)
		})

		it('rejects an array containing a hostile value', () => {
			expect(isJsonValue([1, 2, undefined])).toBe(false)
			expect(isJsonValue([1, 2, () => {}])).toBe(false)
			expect(isJsonValue([1, 2, new Date()])).toBe(false)
			expect(isJsonValue([1, [2, [3, Symbol('x')]]])).toBe(false)
		})

		it('rejects an object containing a hostile value at any depth', () => {
			expect(isJsonValue({ a: undefined })).toBe(false)
			expect(isJsonValue({ a: { b: { c: () => {} } } })).toBe(false)
			expect(isJsonValue({ a: { b: new Map() } })).toBe(false)
		})

		it('rejects a directly self-referencing object (cycle)', () => {
			const cyclic: Record<string, unknown> = { a: 1 }
			cyclic.self = cyclic
			expect(isJsonValue(cyclic)).toBe(false)
		})

		it('rejects an indirect object cycle', () => {
			const a: Record<string, unknown> = {}
			const b: Record<string, unknown> = { a }
			a.b = b
			expect(isJsonValue(a)).toBe(false)
		})

		it('rejects a self-referencing array (cycle)', () => {
			const cyclic: unknown[] = [1, 2]
			cyclic.push(cyclic)
			expect(isJsonValue(cyclic)).toBe(false)
		})

		it('accepts shared references that do not form a cycle', () => {
			// Shared references remain JSON-serializable when they do not form a cycle
			const shared = { x: 1 }
			expect(isJsonValue({ a: shared, b: shared })).toBe(true)
		})
	})
})
