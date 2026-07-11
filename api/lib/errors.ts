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
 * Best-effort, safe human-readable message for any thrown/rejected value.
 * Never throws.
 */
export function getErrorMessage(value: unknown): string {
	if (isError(value)) {
		return value.message
	}

	if (typeof value === 'string') {
		return value
	}

	if (hasMessage(value)) {
		return value.message
	}

	try {
		// `JSON.stringify` returns `undefined` (not a string, and without
		// throwing) for values like `undefined` or functions - fall back to
		// `String()` for those too, so this always returns an actual string.
		const stringified = JSON.stringify(value)
		// eslint-disable-next-line @typescript-eslint/no-base-to-string -- intentional best-effort fallback for values with no useful string form
		return stringified === undefined ? String(value) : stringified
	} catch {
		// eslint-disable-next-line @typescript-eslint/no-base-to-string -- intentional best-effort fallback; this function must never throw
		return String(value)
	}
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
