// Maps a caller's null to `undefined`, v0's indeterminate signal, and a
// non-finite value to `min`: v0 clamps but passes `NaN` through, and a
// `width: NaN%` fill sticks at its last painted size and reads as progress
export function progressValue(
	value: number | null | undefined,
	min = 0,
): number | undefined {
	if (value == null) return undefined
	return Number.isFinite(value) ? value : min
}
