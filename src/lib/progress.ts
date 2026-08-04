// Resolves a progress bar's model value for v0's `Progress.Root`, which clamps
// to its own min/max but passes a non-finite value straight through.
//
// `undefined` is v0's indeterminate signal, so a caller's `null`/`undefined`
// maps to it. Anything non-finite becomes `min` instead: a stalled feed sending
// `NaN` (or a `0 / 0` rate) would otherwise render `width: NaN%` and leave the
// fill stuck at its last painted size, which reads as real progress.
export function progressValue(
	value: number | null | undefined,
	min = 0,
): number | undefined {
	if (value == null) return undefined
	return Number.isFinite(value) ? value : min
}
