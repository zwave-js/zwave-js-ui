import { watch } from 'vue'
import { useStack } from '@vuetify/v0'

// Dashboard overlays are native `<dialog>` elements via v0's Dialog primitive,
// so they sit in the browser top layer: above every z-index stacking context,
// with `::backdrop` as the scrim and the platform providing focus trap,
// return-focus and Esc.

const TOASTER = '[data-sonner-toaster]'

let installed = false

// Mount once, at the app root. Every concern here is global to the overlay
// stack rather than per-dialog, and v0's stack already tracks it — deriving
// from that avoids per-instance lock counting getting out of balance when a
// dialog is torn down mid-leave.
export function useOverlayLayer(): void {
	if (installed) {
		// A second caller would capture `priorOverflow` from the first lock and
		// leave `<html>` unscrollable once the last dialog closes
		if (import.meta.env.DEV) {
			console.warn(
				'[dashboard-overlay] useOverlayLayer() is app-global — ignoring a second call',
			)
		}
		return
	}
	installed = true

	const stack = useStack()

	// `showModal()` inerts the page but leaves it scrollable
	let priorOverflow: string | null = null
	watch(
		() => stack.isActive.value,
		(active) => {
			const style = document.documentElement.style
			if (active) {
				priorOverflow ??= style.overflow
				style.overflow = 'hidden'
				return
			}
			style.overflow = priorOverflow ?? ''
			priorOverflow = null
		},
		{ flush: 'post' },
	)

	// The toast region renders in normal DOM flow, which a top-layer `<dialog>`
	// paints over. Promoting it to a popover puts it in the top layer too, and
	// paint order there follows open order — so it is re-shown whenever the
	// stack changes, to stay above whatever opened last. Promotion fixes paint
	// order only: the region stays in the app tree, which `showModal()` inerts,
	// so a toast's own close button is unclickable while a dialog is open.
	let toaster = document.querySelector<HTMLElement>(TOASTER)
	let warnedMissingToaster = false
	function applyToastLayer() {
		toaster ??= document.querySelector<HTMLElement>(TOASTER)
		const wanted = !!stack.topElement.value
		if (!toaster) {
			// The selector is vuetify-sonner's internal DOM: if a bump renames
			// it, toasts silently vanish behind every modal
			if (wanted && !warnedMissingToaster && import.meta.env.DEV) {
				warnedMissingToaster = true
				console.warn(
					`[dashboard-overlay] no ${TOASTER} to promote — toasts will render behind dialogs`,
				)
			}
			return
		}
		if (toaster.matches(':popover-open')) toaster.hidePopover()
		if (!wanted) {
			toaster.removeAttribute('popover')
			return
		}
		toaster.setAttribute('popover', 'manual')
		toaster.showPopover()
	}

	// Sonner renders its region eagerly, inside the app tree, so the post-flush
	// pass below already finds it; the `??=` re-query covers a caller that runs
	// before `<VSonner>` has mounted.
	watch(() => stack.topElement.value, applyToastLayer, {
		flush: 'post',
		immediate: true,
	})
}
