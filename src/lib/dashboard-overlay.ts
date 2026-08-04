import { onScopeDispose, watch } from 'vue'
import { useStack } from '@vuetify/v0'

// Dashboard overlays are native `<dialog>` elements via v0's Dialog primitive,
// so they sit in the browser top layer: above every z-index stacking context,
// with `::backdrop` as the scrim and the platform providing focus trap,
// return-focus and Esc.

const TOASTER = '[data-sonner-toaster]'
const VUETIFY_CONTAINER = '.v-overlay-container'

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

	// Vuetify teleports its overlays (`v-select` menus, `v-menu`, `v-tooltip`,
	// legacy `v-dialog`) into a single container under `<body>`. A modal dialog
	// both paints over that container and inerts it, so an overlay raised from
	// inside a dashboard dialog was invisible and dead to clicks. Moving the
	// container into the topmost modal shares that element's top-layer context
	// and its non-inert subtree; the container is `display: contents`, so the
	// move changes no layout, and its children position against the viewport
	// either way.
	let container = document.querySelector<HTMLElement>(VUETIFY_CONTAINER)
	function applyVuetifyContainer() {
		container ??= document.querySelector<HTMLElement>(VUETIFY_CONTAINER)
		if (!container) return
		// A closing dialog takes the container down with it, so resolve the host
		// even when the container is already detached
		const host = stack.topElement.value ?? document.body
		if (container.parentElement !== host) host.append(container)
	}

	watch(
		() => stack.topElement.value,
		() => {
			applyToastLayer()
			applyVuetifyContainer()
		},
		{ flush: 'post', immediate: true },
	)

	// Both containers are created lazily — sonner's with the first toast,
	// Vuetify's with the first overlay — so one raised while a dialog is already
	// open would otherwise never be relocated. Once both exist the watch above
	// keeps them placed, so stop watching `<body>`: everything else appended
	// there would otherwise re-run both selector scans.
	const observer = new MutationObserver(() => {
		if (!toaster) applyToastLayer()
		if (!container) applyVuetifyContainer()
		if (toaster && container) observer.disconnect()
	})
	observer.observe(document.body, { childList: true })
	onScopeDispose(() => observer.disconnect())
}
