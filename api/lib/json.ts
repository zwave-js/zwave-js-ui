/**
 * Precise, minimal types for values that have gone through `JSON.parse`
 * (i.e. what `jsonStore` actually reads from/writes to disk), as opposed to
 * `any`. Used to model genuinely-dynamic, schema-less JSON data (as opposed
 * to the concrete interfaces we already have for `Settings`, `User[]`, etc.)
 * without falling back to `any` or a blanket `Record<string, any>`.
 */

export type JsonPrimitive = string | number | boolean | null

export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject

export interface JsonObject {
	[key: string]: JsonValue
}

/**
 * Type guard: is `value` a genuinely JSON-round-trip-safe value?
 *
 * Recursively validates arrays and objects (so a top-level-valid-looking
 * object with a hostile value buried three levels deep is correctly
 * rejected, not just shallowly approved), and rejects everything
 * `JSON.stringify`/`JSON.parse` can't faithfully round-trip:
 *  - `undefined`, functions, symbols, `bigint`
 *  - non-finite numbers (`NaN`, `Infinity`, `-Infinity`)
 *  - `Date`, `Map`, `Set`, `RegExp`, class instances, and any other object
 *    whose prototype isn't `Object.prototype` or `null` (i.e. not a plain
 *    object literal)
 *  - cyclic references (an object/array that (in)directly contains itself
 *    isn't JSON-serializable at all - `JSON.stringify` itself throws on
 *    one; this guard reports it as invalid instead of throwing)
 *
 * `seen` is an internal recursion accumulator (tracking objects/arrays
 * already being validated, for cycle detection) - callers should never need
 * to pass it explicitly.
 */
export function isJsonValue(
	value: unknown,
	seen: Set<unknown> = new Set(),
): value is JsonValue {
	if (value === null) {
		return true
	}

	switch (typeof value) {
		case 'string':
		case 'boolean':
			return true
		case 'number':
			// Rejects NaN/Infinity/-Infinity: JSON has no representation for
			// them (`JSON.stringify` silently coerces them to `null`, which
			// would be a lossy, surprising round-trip).
			return Number.isFinite(value)
		default:
			// function / symbol / bigint / undefined - handled below.
			break
	}

	if (typeof value !== 'object') {
		return false
	}

	// Cycle detection: an object/array already being validated further up
	// the CURRENT recursion path (an ancestor, not just "seen before
	// anywhere") can't be JSON-serialized (`JSON.stringify` itself throws
	// `TypeError: Converting circular structure to JSON`). Two sibling
	// references to the same non-cyclic object (a DAG, not a cycle) are
	// genuinely JSON-serializable, so `value` is removed from `seen` again
	// once this call's subtree has been fully validated (backtracking),
	// rather than staying flagged for the rest of the traversal.
	if (seen.has(value)) {
		return false
	}
	seen.add(value)

	let result: boolean
	if (Array.isArray(value)) {
		result = value.every((item) => isJsonValue(item, seen))
	} else {
		// Only plain object literals (`Object.prototype` or `null`
		// prototype) are JSON-safe "objects" here - rejects `Date`, `Map`,
		// `Set`, `RegExp`, class instances, etc., which `JSON.stringify`
		// would otherwise silently reduce to something else entirely (e.g.
		// a `Date` becomes an ISO string, a `Map`/`Set` becomes `{}`).
		const proto = Object.getPrototypeOf(value)
		result =
			(proto === Object.prototype || proto === null) &&
			Object.values(value).every((propertyValue) =>
				isJsonValue(propertyValue, seen),
			)
	}

	seen.delete(value)
	return result
}

/**
 * Type guard: is `value` a plain, genuinely JSON-round-trip-safe object (not
 * `null`, not an array, and recursively valid per `isJsonValue`)?
 */
export function isJsonObject(value: unknown): value is JsonObject {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		isJsonValue(value)
	)
}
