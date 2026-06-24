// Floating-UI-backed positioner for V0 Popover content.
//
// V0's docs explicitly recommend Floating UI for browsers without CSS
// Anchor Positioning support — and even in supporting browsers, V0 hard-
// codes `position-area: bottom` (with no way to override via Root props),
// which centers the popover under its anchor instead of letting us
// right-align it to a trigger button.
//
// `autoUpdate` keeps the popover in place while the user scrolls, resizes,
// or interacts with surrounding layout, replacing V0's anchor-positioning
// inline styles entirely. We disable V0's anchor styles by writing
// `position-area: none !important` once, then drive `top`/`left` ourselves
// via `computePosition`.
//
// Element lookup: neither `Popover.Activator` nor `Popover.Content` calls
// `defineExpose`, so Vue template refs on them yield nothing useful. We
// rely on the caller-supplied `contentId` (bound via `<Popover.Root :id>`
// so V0 wires both activator's `popovertarget` and content's `id` to that
// value), and find the elements at activation time via the DOM.
//
// Alignment rule:
//   - placement: 'bottom-end' (menu's right edge aligned with activator's
//     right edge, menu extends leftward) — matches typical dropdown UX.
//   - Middleware `flip` switches to bottom-start (left-aligned) etc. when
//     the preferred placement would clip.

import { onBeforeUnmount, watch, toValue } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import {
	computePosition,
	autoUpdate,
	flip,
	shift,
	offset,
} from '@floating-ui/dom'

interface FallbackPositionOptions {
	open: Ref<boolean>
	contentId: MaybeRefOrGetter<string>
}

export function usePopoverFallback({
	open,
	contentId,
}: FallbackPositionOptions): void {
	let cleanup: (() => void) | null = null

	function startTracking(): void {
		const id = toValue(contentId)
		const c = document.getElementById(id)
		const a = document.querySelector<HTMLElement>(`[popovertarget="${id}"]`)
		if (!a || !c) return

		// Override V0's `position-area: bottom` (which centers the popover
		// on its anchor) and its `position-anchor` so Floating UI's manual
		// top/left writes are not overridden by the CSS-anchor cascade.
		// The position-strategy + right/bottom anchors are also static —
		// set them once here, leaving only top/left to be rewritten on
		// each autoUpdate tick.
		c.style.setProperty('position-area', 'none', 'important')
		c.style.setProperty('position-anchor', 'none', 'important')
		c.style.setProperty('margin', '0', 'important')
		c.style.setProperty('position', 'fixed', 'important')
		c.style.setProperty('right', 'auto', 'important')
		c.style.setProperty('bottom', 'auto', 'important')

		cleanup = autoUpdate(a, c, () => {
			computePosition(a, c, {
				placement: 'bottom-end',
				strategy: 'fixed',
				middleware: [
					offset(6),
					flip({
						fallbackPlacements: [
							'bottom-start',
							'top-end',
							'top-start',
						],
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
		// Flush after the DOM patch: on open, V0 mounts Popover.Content in
		// the same tick, so a default 'pre' watcher would query the DOM
		// before the element exists and startTracking would bail on null.
		{ flush: 'post' },
	)

	onBeforeUnmount(stopTracking)
}
