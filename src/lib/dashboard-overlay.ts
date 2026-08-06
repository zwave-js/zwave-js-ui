// Dashboard dialogs are native `<dialog>` elements, so they sit in the top
// layer, above every z-index stacking context

import { watch } from 'vue'
import { useStack } from '@vuetify/v0'

const TOASTER = '[data-sonner-toaster]'

let installed = false

/** Call once, from the app root. The scroll lock and the toast promotion are module-wide. */
export function useOverlayLayer(): void {
	if (installed) {
		if (import.meta.env.DEV) {
			console.warn(
				'[dashboard-overlay] useOverlayLayer() is app-global — ignoring a second call',
			)
		}
		return
	}
	installed = true

	const stack = useStack()

	// `showModal()` blocks clicks outside the dialog but leaves the page
	// scrollable
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

	// Promote the toast region to the top layer so it clears an open modal
	let toaster = document.querySelector<HTMLElement>(TOASTER)
	let warnedMissingToaster = false
	function applyToastLayer() {
		toaster ??= document.querySelector<HTMLElement>(TOASTER)
		const wanted = !!stack.topElement.value
		if (!toaster) {
			// `TOASTER` matches vuetify-sonner's internal DOM, so an upgrade
			// may rename it
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
		// `showPopover()` changes paint order only. The region stays outside the
		// dialog, where `showModal()` blocks clicks, so a toast's close button
		// is dead while a dialog is open
		toaster.showPopover()
	}

	// Re-show the toast region on each stack change, so it stays above the
	// newest dialog
	watch(() => stack.topElement.value, applyToastLayer, {
		flush: 'post',
		immediate: true,
	})
}
