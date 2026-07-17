import { describe, it, expect } from 'vitest'
import { hasErrorCode, getErrorMessage } from '#api/lib/errors.ts'

describe('error boundaries', () => {
	describe('error code recognition', () => {
		it('returns true for objects with a string code', () => {
			const err: NodeJS.ErrnoException = Object.assign(
				new Error('boom'),
				{
					code: 'ENOENT',
				},
			)
			expect(hasErrorCode(err)).toBe(true)
		})

		it('returns false when code is missing or not a string', () => {
			expect(hasErrorCode(new Error('boom'))).toBe(false)
			expect(hasErrorCode({ code: 42 })).toBe(false)
			expect(hasErrorCode(null)).toBe(false)
			expect(hasErrorCode(undefined)).toBe(false)
		})
	})

	describe('error message extraction', () => {
		it('returns the message of an Error instance', () => {
			expect(getErrorMessage(new Error('boom'))).toBe('boom')
		})

		it('returns string values as-is', () => {
			expect(getErrorMessage('boom')).toBe('boom')
		})

		it('returns the message of a message-carrying object', () => {
			expect(getErrorMessage({ message: 'boom' })).toBe('boom')
		})

		it('serializes plain objects', () => {
			expect(getErrorMessage({ foo: 'bar' })).toBe('{"foo":"bar"}')
		})

		it('uses string coercion for cyclic objects', () => {
			const circular: Record<string, unknown> = {}
			circular.self = circular
			expect(getErrorMessage(circular)).toBe('[object Object]')
		})

		it('handles null/undefined without throwing', () => {
			expect(getErrorMessage(null)).toBe('null')
			expect(getErrorMessage(undefined)).toBe(String(undefined))
		})

		it('never throws for an object with a throwing toJSON AND a throwing toString', () => {
			const hostile = {
				toJSON() {
					throw new Error('toJSON boom')
				},
				toString() {
					throw new Error('toString boom')
				},
			}
			expect(() => getErrorMessage(hostile)).not.toThrow()
			expect(getErrorMessage(hostile)).toBe(
				'[unable to determine error message]',
			)
		})

		it('handles objects whose primitive coercion throws', () => {
			const hostile = {
				[Symbol.toPrimitive]() {
					throw new Error('toPrimitive boom')
				},
				toString() {
					throw new Error('toString boom')
				},
				valueOf() {
					throw new Error('valueOf boom')
				},
			}
			expect(() => getErrorMessage(hostile)).not.toThrow()
			expect(getErrorMessage(hostile)).toBe(JSON.stringify({}))
		})

		it('returns the stable fallback when all Proxy inspection traps throw', () => {
			const hostile = new Proxy(
				{},
				{
					has() {
						throw new Error('has boom')
					},
					get() {
						throw new Error('get boom')
					},
					getPrototypeOf() {
						throw new Error('getPrototypeOf boom')
					},
				},
			)
			expect(() => getErrorMessage(hostile)).not.toThrow()
			expect(getErrorMessage(hostile)).toBe(
				'[unable to determine error message]',
			)
		})

		it('returns the stable fallback when serialization and coercion throw', () => {
			const hostile = {
				toJSON() {
					throw new Error('toJSON boom')
				},
				[Symbol.toPrimitive]() {
					throw new Error('toPrimitive boom')
				},
				toString() {
					throw new Error('toString boom')
				},
				valueOf() {
					throw new Error('valueOf boom')
				},
			}
			expect(() => getErrorMessage(hostile)).not.toThrow()
			expect(getErrorMessage(hostile)).toBe(
				'[unable to determine error message]',
			)
		})

		it('extracts a message from a BigInt', () => {
			expect(() => getErrorMessage(BigInt(42))).not.toThrow()
			expect(getErrorMessage(BigInt(42))).toBe('42')
		})

		it('extracts a message from a Symbol', () => {
			expect(() => getErrorMessage(Symbol('boom'))).not.toThrow()
			expect(getErrorMessage(Symbol('boom'))).toBe('Symbol(boom)')
		})
	})
})
