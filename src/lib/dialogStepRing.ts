// Geometry for the segmented step-progress ring in ZwDialogStepProgress.
// Kept free of component state so the boundary cases stay unit-testable.

// Gap angle must exceed what `round` linecaps consume at each end
export const RING_GAP_DEG = 22

export interface RingDash {
	dasharray: string
	dashoffset: number
}

export interface StepRing {
	rotationDeg: number
	bgDash: string
	done: RingDash
	active: RingDash
}

// Half a slot, so a segment stays visible once the step count makes 22° too wide
function gapFor(segments: number, hasGaps: boolean) {
	return hasGaps ? Math.min(RING_GAP_DEG, 360 / segments / 2) : 0
}

export function stepRing(
	total: number,
	current: number,
	circumference: number,
): StepRing {
	const steps = Math.max(0, Math.floor(total))
	// Empty steps would divide by zero; treat it as one full segment
	const segments = Math.max(1, steps)
	const gap = gapFor(segments, steps > 1)
	const segArc = Math.max(0, ((360 / segments - gap) / 360) * circumference)
	const gapArc = (gap / 360) * circumference
	const at = Math.min(Math.max(0, Math.floor(current)), steps)

	// Last gap absorbs leftover circumference so the pattern sums to exactly C
	const dashFor = (start: number, count: number): RingDash => {
		if (count <= 0) return { dasharray: '0', dashoffset: 0 }
		const arr: number[] = []
		for (let i = 0; i < count; i++) arr.push(segArc, gapArc)
		arr[arr.length - 1] = Math.max(
			0,
			gapArc + circumference - count * (segArc + gapArc),
		)
		return {
			dasharray: arr.join(' '),
			dashoffset: -(start * (segArc + gapArc)),
		}
	}

	return {
		rotationDeg: gap / 2 - 90,
		bgDash: steps > 1 ? `${segArc} ${gapArc}` : `${circumference}`,
		done: dashFor(0, at),
		active: dashFor(at, at < steps ? 1 : 0),
	}
}
