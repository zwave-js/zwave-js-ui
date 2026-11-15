function isError(value: unknown): value is Error {
	return value instanceof Error
}

function hasMessage(value: unknown): value is { message: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'message' in value &&
		typeof (value as { message: unknown }).message === 'string'
	)
}

export function hasErrorCode(value: unknown): value is { code: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'code' in value &&
		typeof (value as { code: unknown }).code === 'string'
	)
}

// Swallows the exception instead of propagating it, since a hostile value can make almost any inspection of it throw
function tryOrUndefined<T>(fn: () => T): T | undefined {
	try {
		return fn()
	} catch {
		return undefined
	}
}

// Never throws, even for hostile values whose toJSON/toString/Symbol.toPrimitive or Proxy traps themselves throw
export function getErrorMessage(value: unknown): string {
	// A hostile Proxy can make instanceof itself throw via a throwing getPrototypeOf trap
	const errorInstanceMessage = tryOrUndefined(() =>
		isError(value) ? value.message : undefined,
	)
	if (typeof errorInstanceMessage === 'string') {
		return errorInstanceMessage
	}

	if (typeof value === 'string') {
		return value
	}

	// A hostile Proxy's has/get traps can make the 'in' check and property read themselves throw
	const messageCarrierMessage = tryOrUndefined(() =>
		hasMessage(value) ? value.message : undefined,
	)
	if (typeof messageCarrierMessage === 'string') {
		return messageCarrierMessage
	}

	// Falls through to the String() fallback below for undefined/functions, which JSON.stringify returns as undefined rather than throwing
	const stringified = tryOrUndefined(() => JSON.stringify(value))
	if (typeof stringified === 'string') {
		return stringified
	}

	// String() invokes Symbol.toPrimitive/toString/valueOf, any of which can throw on a hostile value
	const coerced = tryOrUndefined(() => String(value))
	if (typeof coerced === 'string') {
		return coerced
	}

	// Every inspection above threw, so return the one path that can never itself throw
	return '[unable to determine error message]'
}
