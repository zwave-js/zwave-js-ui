// Precise types for values that have gone through JSON.parse, i.e. what jsonStore reads from/writes to disk, instead of `any`

export type JsonPrimitive = string | number | boolean | null

export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject

export interface JsonObject {
	[key: string]: JsonValue
}

// Recursively validates arrays/objects so a hostile value buried several levels deep is rejected, not just approved at the top level
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
			// Rejects NaN/Infinity/-Infinity, which JSON.stringify would otherwise silently and lossily coerce to null
			return Number.isFinite(value)
		default:
			break
	}

	if (typeof value !== 'object') {
		return false
	}

	// Rejects a value already on the current recursion path (a cycle, which JSON.stringify itself throws on), but allows two sibling references to the same non-cyclic object
	if (seen.has(value)) {
		return false
	}
	seen.add(value)

	let result: boolean
	if (Array.isArray(value)) {
		result = value.every((item) => isJsonValue(item, seen))
	} else {
		// Rejects Date/Map/Set/RegExp/class instances, which JSON.stringify would otherwise silently reduce to something else entirely
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

export function isJsonObject(value: unknown): value is JsonObject {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		isJsonValue(value)
	)
}
