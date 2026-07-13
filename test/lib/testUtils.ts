export interface Deferred<T> {
	promise: Promise<T>
	resolve: (value: T | PromiseLike<T>) => void
	reject: (reason?: unknown) => void
}

export function createDeferred<T>(): Deferred<T> {
	let resolvePromise: Deferred<T>['resolve'] = () => {
		throw new Error('Deferred promise resolved before initialization')
	}
	let rejectPromise: Deferred<T>['reject'] = () => {
		throw new Error('Deferred promise rejected before initialization')
	}
	const promise = new Promise<T>((resolve, reject) => {
		resolvePromise = resolve
		rejectPromise = reject
	})
	return { promise, resolve: resolvePromise, reject: rejectPromise }
}

export function requireDefined<T>(
	value: T,
	message = 'Expected value to be defined',
): NonNullable<T> {
	if (value === undefined || value === null) {
		throw new TypeError(message)
	}
	return value
}

export function assertDefined<T>(
	value: T,
	message = 'Expected value to be defined',
): asserts value is NonNullable<T> {
	requireDefined(value, message)
}
