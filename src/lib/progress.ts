/**
 * Maps a null or undefined value to `undefined`, v0's indeterminate signal.
 * A non-finite value falls back to `min`.
 */
export function progressValue(
	value: number | null | undefined,
	min = 0,
): number | undefined {
	if (value == null) return undefined
	// v0 passes NaN through unclamped, so the value must be finite here
	return Number.isFinite(value) ? value : min
}
