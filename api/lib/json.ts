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

/** Type guard: is `value` a plain JSON object (not `null`, not an array)? */
export function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
