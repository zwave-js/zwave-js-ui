// Floating-UI-backed positioner for top-layer content. It drives top/left
// through computePosition + autoUpdate.
// V0 hard-codes `position-area: bottom` with no override, and Firefox does not
// implement CSS anchor positioning at all.

import { onBeforeUnmount, watch, toValue } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import {
	computePosition,
	autoUpdate,
	flip,
	shift,
	offset,
} from '@floating-ui/dom'
import type { Placement } from '@floating-ui/dom'

// Flip fallbacks per primary placement.
const FALLBACK_PLACEMENTS: Partial<Record<Placement, Placement[]>> = {
	'bottom-end': ['bottom-start', 'top-end', 'top-start'],
	'bottom-start': ['top-start', 'bottom-end', 'top-end'],
}

// `VIEWPORT_PADDING_PX` keeps a flipped or shifted panel clear of the viewport
// edge
const VIEWPORT_PADDING_PX = 8

// Shared gap between an anchor and the surface pinned to it
export const DEFAULT_OFFSET_PX = 6

interface TrackOptions {
	placement: Placement
	offsetPx: number
	fallbackPlacements?: Placement[]
	// Write through `!important` where V0 sets its own anchor styles
	important?: boolean
}

/**
 * Pins `floating` to `anchor` and keeps it there across scroll, resize and
 * element-size changes. Returns the autoUpdate teardown.
 */
export function trackAnchor(
	anchor: HTMLElement,
	floating: HTMLElement,
	{ placement, offsetPx, fallbackPlacements, important }: TrackOptions,
): () => void {
	const priority = important ? 'important' : ''
	let stopped = false
	const stop = autoUpdate(anchor, floating, () => {
		computePosition(anchor, floating, {
			placement,
			strategy: 'fixed',
			middleware: [
				offset(offsetPx),
				flip(fallbackPlacements ? { fallbackPlacements } : {}),
				shift({ padding: VIEWPORT_PADDING_PX }),
			],
		})
			.then(({ x, y }) => {
				// autoUpdate's teardown can't cancel a promise already in
				// flight, and callers that share one floating element would
				// otherwise get it parked at the previous anchor
				if (stopped) return
				floating.style.setProperty('top', `${y}px`, priority)
				floating.style.setProperty('left', `${x}px`, priority)
			})
			.catch((err: unknown) => {
				console.error('[popover-fallback] computePosition failed', err)
			})
	})
	return () => {
		stopped = true
		stop()
	}
}

interface FallbackPositionOptions {
	open: Ref<boolean>
	contentId: MaybeRefOrGetter<string>
	// Default: 'bottom-end'. Pass 'bottom-start' for left-anchored menus.
	placement?: Placement
	// Gap between activator and panel in pixels.
	offsetPx?: number
}

export function usePopoverFallback({
	open,
	contentId,
	placement = 'bottom-end',
	offsetPx = DEFAULT_OFFSET_PX,
}: FallbackPositionOptions): void {
	let cleanup: (() => void) | null = null

	function startTracking(): void {
		const id = toValue(contentId)
		const c = document.getElementById(id)
		const a = document.querySelector<HTMLElement>(`[popovertarget="${id}"]`)
		if (!a || !c) return

		// Override V0's anchor-positioning styles so Floating UI controls placement.
		c.style.setProperty('position-area', 'none', 'important')
		c.style.setProperty('position-anchor', 'none', 'important')
		c.style.setProperty('margin', '0', 'important')
		c.style.setProperty('position', 'fixed', 'important')
		c.style.setProperty('right', 'auto', 'important')
		c.style.setProperty('bottom', 'auto', 'important')

		cleanup = trackAnchor(a, c, {
			placement,
			offsetPx,
			fallbackPlacements:
				FALLBACK_PLACEMENTS[placement] ??
				FALLBACK_PLACEMENTS['bottom-end'],
			important: true,
		})
	}

	function stopTracking(): void {
		cleanup?.()
		cleanup = null
	}

	watch(
		() => open.value,
		(isOpen) => {
			stopTracking()
			if (isOpen) startTracking()
		},
		// post: the popover element must exist in the DOM before we position it.
		{ flush: 'post' },
	)

	onBeforeUnmount(stopTracking)
}
