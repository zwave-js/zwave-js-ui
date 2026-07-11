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
