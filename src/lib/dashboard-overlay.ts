import { inject, onScopeDispose, provide, watch, type InjectionKey } from 'vue'
import { useStack } from '@vuetify/v0'

// Dashboard overlays are native `<dialog>` elements via v0's Dialog primitive,
// so they sit in the browser top layer: above every z-index stacking context,
// with `::backdrop` as the scrim and the platform providing focus trap,
// return-focus and Esc.

// Vuetify overlays (`v-select`, `v-menu`, `v-tooltip`, …) teleport into
// `.v-overlay-container` under `<body>`, which the top layer paints over — so
// inside a dialog they must be re-targeted into the dialog's own subtree. A
// dialog publishes an `attach` selector for the Vuetify controls still in its
// body to consume; see `useOverlayAttach` and OverlayAttachMixin.
export const ATTACH_KEY = Symbol('zw-overlay-attach') as InjectionKey<string>

export function provideOverlayAttach(selector: string): void {
	provide(ATTACH_KEY, selector)
}

// Returns a selector for Vuetify's `attach` prop, or undefined outside a
// dialog, where the default body teleport is already correct.
export function useOverlayAttach(): string | undefined {
	return inject(ATTACH_KEY, undefined)
}

const TOASTER = '[data-sonner-toaster]'

// Mount once, at the app root. Both concerns here are global to the overlay
// stack rather than per-dialog, and v0's stack already tracks it — deriving
// from that avoids per-instance lock counting getting out of balance when a
// dialog is torn down mid-leave.
export function useOverlayLayer(): void {
	const stack = useStack()

	// `showModal()` inerts the page but leaves it scrollable
	watch(
		() => stack.isActive.value,
		(active) => {
			document.documentElement.style.overflow = active ? 'hidden' : ''
		},
		{ flush: 'post' },
	)

	// The toast region renders in normal DOM flow, which a top-layer `<dialog>`
	// paints over. Promoting it to a popover puts it in the top layer too, and
	// paint order there follows open order — so it is re-shown whenever the
	// stack changes, to stay above whatever opened last.
	function applyToastLayer() {
		const el = document.querySelector<HTMLElement>(TOASTER)
		if (!el) return
		const wanted = !!stack.topElement.value
		if (el.matches(':popover-open')) el.hidePopover()
		if (!wanted) {
			el.removeAttribute('popover')
			return
		}
		el.setAttribute('popover', 'manual')
		el.showPopover()
	}

	watch(() => stack.topElement.value, applyToastLayer, {
		flush: 'post',
		immediate: true,
	})

	// Sonner only creates its container with the first toast, so a toast raised
	// while a dialog is already open would otherwise never be promoted
	const observer = new MutationObserver(applyToastLayer)
	observer.observe(document.body, { childList: true })
	onScopeDispose(() => observer.disconnect())
}
