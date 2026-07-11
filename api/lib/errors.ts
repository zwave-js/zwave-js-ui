/**
 * Narrow, reusable helpers for working with values caught from a `catch`
 * clause (or any other `unknown`-typed error surface: rejected promises,
 * event-emitter `'error'` payloads, etc.), without resorting to blanket
 * `as any` / `as unknown as X` assertions scattered across the codebase.
 *
 * Under `strict`, a `catch` binding's type is `unknown`, so accessing
 * `.message`/`.code` on it is a compile error until it has been narrowed.
 * These helpers centralize that narrowing in one well-tested place.
 */

/** A Node.js-style error carrying an `errno`/`code` (e.g. from `fs`, `net`). */
export interface ErrnoException extends Error {
	errno?: number
	code?: string
	path?: string
	syscall?: string
}

/** Type guard: is `value` an `Error` instance? */
export function isError(value: unknown): value is Error {
	return value instanceof Error
}

/**
 * Type guard: does `value` look like a plain object carrying a string
 * `message` property (e.g. a non-`Error` object thrown by a library, or a
 * plain `{ message }` shape)?
 */
export function hasMessage(value: unknown): value is { message: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'message' in value &&
		typeof (value as { message: unknown }).message === 'string'
	)
}

/**
 * Type guard: does `value` carry a Node.js-style `code` string, as raised by
 * `fs`/`net` operations (e.g. `ENOENT`, `EEXIST`)?
 */
export function hasErrorCode(value: unknown): value is { code: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'code' in value &&
		typeof (value as { code: unknown }).code === 'string'
	)
}

/**
 * Calls `fn`, returning its result, or `undefined` if it throws for any
 * reason. Used to defensively wrap every individual inspection step in
 * `getErrorMessage` below, since a sufficiently hostile `value` (a `Proxy`
 * whose traps throw, an object with a throwing getter/`toJSON`/`toString`/
 * `Symbol.toPrimitive`, etc.) can make almost any operation on it throw -
 * including `instanceof`, the `in` operator, and property reads.
 */
function tryOrUndefined<T>(fn: () => T): T | undefined {
	try {
		return fn()
	} catch {
		return undefined
	}
}

/**
 * Best-effort, safe human-readable message for any thrown/rejected value.
 * Never throws, even for hostile values: objects with a throwing `toJSON`,
 * `toString`, or `Symbol.toPrimitive`, or `Proxy` instances whose `has`/
 * `get`/`getPrototypeOf` traps themselves throw. Every inspection step is
 * individually wrapped in `tryOrUndefined`, and a constant string is
 * returned if every single one of them fails.
 */
export function getErrorMessage(value: unknown): string {
	// `isError(value)` (an `instanceof` check) and the `.message` read that
	// follows it are wrapped together: a hostile `Proxy` can make
	// `instanceof` itself throw (via a throwing `getPrototypeOf` trap), and
	// a genuine `Error` can still have a throwing `message` getter.
	const errorInstanceMessage = tryOrUndefined(() =>
		isError(value) ? value.message : undefined,
	)
	if (typeof errorInstanceMessage === 'string') {
		return errorInstanceMessage
	}

	if (typeof value === 'string') {
		return value
	}

	// `hasMessage(value)` uses the `in` operator and a property read, both
	// of which can throw on a hostile `Proxy` (`has`/`get` traps).
	const messageCarrierMessage = tryOrUndefined(() =>
		hasMessage(value) ? value.message : undefined,
	)
	if (typeof messageCarrierMessage === 'string') {
		return messageCarrierMessage
	}

	// `JSON.stringify` invokes a custom `toJSON()` if present (which may
	// throw), and returns `undefined` (not a string, without throwing) for
	// values like `undefined` or functions - both cases fall through to the
	// `String()` fallback below.
	const stringified = tryOrUndefined(() => JSON.stringify(value))
	if (typeof stringified === 'string') {
		return stringified
	}

	// Last resort: `String()` invokes `Symbol.toPrimitive`/`toString`/
	// `valueOf`, any of which may throw on a hostile value.
	const coerced = tryOrUndefined(() =>
		// eslint-disable-next-line @typescript-eslint/no-base-to-string -- intentional best-effort fallback for values with no useful string form
		String(value),
	)
	if (typeof coerced === 'string') {
		return coerced
	}

	// Every inspection above threw. This constant is the one guaranteed
	// path that can never itself throw, preserving the "never throws"
	// contract even for a value hostile enough to defeat every other
	// coercion attempt.
	return '[unable to determine error message]'
}

/**
 * Normalizes any thrown/rejected value into an `Error` instance, preserving
 * the original `Error` (and its stack) when it already is one.
 */
export function toError(value: unknown): Error {
	if (isError(value)) {
		return value
	}

	return new Error(getErrorMessage(value))
}
