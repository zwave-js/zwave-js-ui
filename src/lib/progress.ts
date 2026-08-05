// Maps null/undefined to v0's indeterminate signal
export function progressValue(
	value: number | null | undefined,
	min = 0,
): number | undefined {
	if (value == null) return undefined
	// v0 passes NaN through unclamped, so a stuck `width: NaN%` fill would read as progress
	return Number.isFinite(value) ? value : min
}
