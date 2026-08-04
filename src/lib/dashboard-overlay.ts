import { onScopeDispose, watch } from 'vue'
import { useStack } from '@vuetify/v0'

// Dashboard overlays are native `<dialog>` elements via v0's Dialog primitive,
// so they sit in the browser top layer: above every z-index stacking context,
// with `::backdrop` as the scrim and the platform providing focus trap,
// return-focus and Esc.

const TOASTER = '[data-sonner-toaster]'

// Mount once, at the app root. Every concern here is global to the overlay
// stack rather than per-dialog, and v0's stack already tracks it — deriving
// from that avoids per-instance lock counting getting out of balance when a
// dialog is torn down mid-leave.
export function useOverlayLayer(): void {
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
	// stack changes, to stay above whatever opened last.
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

	watch(() => stack.topElement.value, applyToastLayer, {
		flush: 'post',
		immediate: true,
	})

	// Sonner creates its region with the first toast, so one raised while a
	// dialog is already open would otherwise never be promoted. The watch above
	// keeps it placed once it exists, so stop watching `<body>` then.
	const observer = new MutationObserver(() => {
		if (toaster) {
			observer.disconnect()
			return
		}
		applyToastLayer()
	})
	observer.observe(document.body, { childList: true })
	onScopeDispose(() => observer.disconnect())
}
