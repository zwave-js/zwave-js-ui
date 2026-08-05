import { watch } from 'vue'
import { useStack } from '@vuetify/v0'

// Dashboard dialogs are native `<dialog>` elements, so they sit in the top
// layer, above every z-index stacking context

const TOASTER = '[data-sonner-toaster]'

let installed = false

// Mount once at the app root: every lock here is global to the overlay stack,
// which v0's stack already tracks
export function useOverlayLayer(): void {
	if (installed) {
		// Ignore a repeat call, which would capture `priorOverflow` from the
		// first lock and never restore it
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

	// Promote the toast region to the top layer so it clears an open modal,
	// re-showing it on each stack change to stay above the newest dialog
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
		// Paint order only: the region stays in the subtree `showModal()` inerts,
		// so a toast's close button is dead while a dialog is open
		toaster.showPopover()
	}

	// Sonner renders its region eagerly inside the app tree, so this post-flush
	// pass finds it
	watch(() => stack.topElement.value, applyToastLayer, {
		flush: 'post',
		immediate: true,
	})
}
