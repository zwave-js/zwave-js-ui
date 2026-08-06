/**
 * Maps a null or undefined value to `undefined`, v0's indeterminate signal.
 * A non-finite value falls back to 0.
 */
export function progressValue(
	value: number | null | undefined,
): number | undefined {
	if (value == null) return undefined
	// v0 passes NaN through unclamped, so the value must be finite here
	return Number.isFinite(value) ? value : 0
}

/** Clamps a value into 0..`max` and returns it as a whole percentage. */
export function progressPercent(value: number, max: number): number {
	if (max <= 0) return 0
	return Math.round((Math.min(max, Math.max(0, value)) / max) * 100)
}
