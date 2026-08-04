// Floating-UI-backed positioner for V0 Popover content.
// V0 hard-codes `position-area: bottom` with no override, so we disable its
// anchor styles and drive top/left ourselves via computePosition + autoUpdate.

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

interface FallbackPositionOptions {
	open: Ref<boolean>
	contentId: MaybeRefOrGetter<string>
	// Default: 'bottom-end'. Pass 'bottom-start' for left-anchored menus.
	placement?: Placement
	// Gap between activator and panel in pixels. Default: 6.
	offsetPx?: number
}

export function usePopoverFallback({
	open,
	contentId,
	placement = 'bottom-end',
	offsetPx = 6,
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

		cleanup = autoUpdate(a, c, () => {
			computePosition(a, c, {
				placement,
				strategy: 'fixed',
				middleware: [
					offset(offsetPx),
					flip({
						fallbackPlacements:
							FALLBACK_PLACEMENTS[placement] ??
							FALLBACK_PLACEMENTS['bottom-end'],
					}),
					shift({ padding: 8 }),
				],
			})
				.then(({ x, y }) => {
					c.style.setProperty('top', `${y}px`, 'important')
					c.style.setProperty('left', `${x}px`, 'important')
				})
				.catch((err: unknown) => {
					console.error(
						'[popover-fallback] computePosition failed',
						err,
					)
				})
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
