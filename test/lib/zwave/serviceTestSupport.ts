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
	let resolve!: Deferred<T>['resolve']
	let reject!: Deferred<T>['reject']
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}
