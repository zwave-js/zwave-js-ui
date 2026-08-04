// Resolves a progress bar's model value for v0's `Progress.Root`.
//
// `undefined` is v0's indeterminate signal, so a caller's `null`/`undefined`
// maps to it. Anything non-finite becomes `min` instead: a stalled feed sending
// `NaN` (or a `0 / 0` rate) would otherwise render `width: NaN%` and leave the
// fill stuck at its last painted size, which reads as real progress.
export function progressValue(
	value: number | null | undefined,
	min: number,
	max: number,
): number | undefined {
	if (value == null) return undefined
	if (!Number.isFinite(value)) return min
	return Math.min(max, Math.max(min, value))
}
