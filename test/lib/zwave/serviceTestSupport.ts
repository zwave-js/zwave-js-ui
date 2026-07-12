import { vi, type MockInstance } from 'vitest'

import type { ServiceLogger } from '#api/lib/zwave/ports.ts'

export type MockServiceLogger = ServiceLogger & {
	info: MockInstance<ServiceLogger['info']>
	warn: MockInstance<ServiceLogger['warn']>
	error: MockInstance<ServiceLogger['error']>
}

export function createServiceLogger(): MockServiceLogger {
	return {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}
}

export interface Deferred<T> {
	promise: Promise<T>
	resolve: (value: T | PromiseLike<T>) => void
	reject: (reason?: unknown) => void
}

export function createDeferred<T = void>(): Deferred<T> {
	let resolvePromise: Deferred<T>['resolve'] | undefined
	let rejectPromise: Deferred<T>['reject'] | undefined
	const promise = new Promise<T>((res, rej) => {
		resolvePromise = res
		rejectPromise = rej
	})
	return {
		promise,
		resolve: (value) => {
			if (!resolvePromise) {
				throw new Error('Deferred promise resolver was not initialized')
			}
			resolvePromise(value)
		},
		reject: (reason) => {
			if (!rejectPromise) {
				throw new Error('Deferred promise rejecter was not initialized')
			}
			rejectPromise(reason)
		},
	}
}

export function requireDefined<T>(value: T, message: string): NonNullable<T> {
	if (value === undefined || value === null) {
		throw new TypeError(message)
	}
	return value
}
