import { describe, it, expect } from 'vitest'
import {
	isError,
	hasMessage,
	hasErrorCode,
	getErrorMessage,
	toError,
} from '../../api/lib/errors.ts'
import type { ErrnoException } from '../../api/lib/errors.ts'

describe('#errors', () => {
	describe('#isError()', () => {
		it('returns true for Error instances', () => {
			expect(isError(new Error('boom'))).toBe(true)
		})

		it('returns true for Error subclasses', () => {
			expect(isError(new TypeError('boom'))).toBe(true)
		})

		it('returns false for non-Error values', () => {
			expect(isError('boom')).toBe(false)
			expect(isError({ message: 'boom' })).toBe(false)
			expect(isError(null)).toBe(false)
			expect(isError(undefined)).toBe(false)
			expect(isError(42)).toBe(false)
		})
	})

	describe('#hasMessage()', () => {
		it('returns true for objects with a string message', () => {
			expect(hasMessage({ message: 'boom' })).toBe(true)
			expect(hasMessage(new Error('boom'))).toBe(true)
		})

		it('returns false when message is missing or not a string', () => {
			expect(hasMessage({})).toBe(false)
			expect(hasMessage({ message: 42 })).toBe(false)
			expect(hasMessage(null)).toBe(false)
			expect(hasMessage(undefined)).toBe(false)
			expect(hasMessage('boom')).toBe(false)
		})
	})

	describe('#hasErrorCode()', () => {
		it('returns true for objects with a string code', () => {
			const err: ErrnoException = Object.assign(new Error('boom'), {
				code: 'ENOENT',
			})
			expect(hasErrorCode(err)).toBe(true)
		})

		it('returns false when code is missing or not a string', () => {
			expect(hasErrorCode(new Error('boom'))).toBe(false)
			expect(hasErrorCode({ code: 42 })).toBe(false)
			expect(hasErrorCode(null)).toBe(false)
			expect(hasErrorCode(undefined)).toBe(false)
		})
	})

	describe('#getErrorMessage()', () => {
		it('returns the message of an Error instance', () => {
			expect(getErrorMessage(new Error('boom'))).toBe('boom')
		})

		it('returns string values as-is', () => {
			expect(getErrorMessage('boom')).toBe('boom')
		})

		it('returns the message of a message-carrying object', () => {
			expect(getErrorMessage({ message: 'boom' })).toBe('boom')
		})

		it('falls back to JSON.stringify for plain objects', () => {
			expect(getErrorMessage({ foo: 'bar' })).toBe('{"foo":"bar"}')
		})

		it('falls back to String() when JSON.stringify throws', () => {
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

		it('never throws for an object with a throwing Symbol.toPrimitive (and no usable toJSON)', () => {
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
			// JSON.stringify() succeeds here (no toJSON, and the hostile
			// coercion methods are never invoked by JSON.stringify itself),
			// so the message is the JSON form, not the constant fallback.
			expect(getErrorMessage(hostile)).toBe(
				JSON.stringify({
					// jsonify only serializes own enumerable non-symbol keys
				}),
			)
		})

		it('never throws, and returns the constant fallback, for a Proxy whose has/get/getPrototypeOf traps all throw', () => {
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

		it('never throws for a value whose JSON.stringify AND String() coercion both throw', () => {
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

		it('never throws for a BigInt (JSON.stringify throws, String() succeeds)', () => {
			expect(() => getErrorMessage(BigInt(42))).not.toThrow()
			expect(getErrorMessage(BigInt(42))).toBe('42')
		})

		it('never throws for a Symbol value (JSON.stringify/String() both usable)', () => {
			expect(() => getErrorMessage(Symbol('boom'))).not.toThrow()
			expect(getErrorMessage(Symbol('boom'))).toBe('Symbol(boom)')
		})
	})

	describe('#toError()', () => {
		it('returns the same Error instance when given one', () => {
			const err = new Error('boom')
			expect(toError(err)).toBe(err)
		})

		it('wraps non-Error values in a new Error', () => {
			const wrapped = toError('boom')
			expect(wrapped).toBeInstanceOf(Error)
			expect(wrapped.message).toBe('boom')
		})

		it('wraps message-carrying objects in a new Error', () => {
			const wrapped = toError({ message: 'boom' })
			expect(wrapped).toBeInstanceOf(Error)
			expect(wrapped.message).toBe('boom')
		})
	})
})
