// Drop-in for Vuetify's `v-tooltip` that renders via the native popover
// API instead of mounting a component. Vuetify mounts one on `mounted`
// and remounts it on every `updated`, which gets expensive when many
// tooltips are on screen at once.
//
// Usage: `v-zw-tooltip:bottom="'text'"` or `{ text, disabled, location }`

import type { Placement } from '@floating-ui/dom'
import type { Directive, DirectiveBinding } from 'vue'
import { trackAnchor } from '@/lib/popover-fallback.ts'

type Side = 'top' | 'bottom' | 'start' | 'end' | 'left' | 'right'

const PLACEMENT: Record<Side, Placement> = {
	top: 'top',
	bottom: 'bottom',
	left: 'left',
	right: 'right',
	start: 'left',
	end: 'right',
}

const SHOW_DELAY_MS = 400
const GAP_PX = 6
const TIP_ID = 'zw-tip'

const HOST_EVENTS = [
	'pointerenter',
	'pointerleave',
	'focusin',
	'focusout',
	'click',
]

interface TooltipOptions {
	text?: unknown
	disabled?: boolean
	location?: Side
}

interface TooltipHost extends HTMLElement {
	_zwTip?: Tooltip
}

// One shared tip element for the whole app: a per-host one would leave a
// permanent `<body>` child behind every row ever pointed at
const shared: {
	tip?: HTMLElement
	host?: HTMLElement
	untrack?: () => void
	// The host we put `aria-describedby` on, so only that one is cleaned up
	described?: HTMLElement
} = {}

// Parented under the host's dialog: `showModal()` inerts everything outside
// that subtree, and an inert tip is out of the a11y tree
function tipElement(host: HTMLElement): HTMLElement {
	if (!shared.tip) {
		const el = document.createElement('div')
		el.className = 'zw-tip'
		el.id = TIP_ID
		el.setAttribute('popover', 'manual')
		el.setAttribute('role', 'tooltip')
		shared.tip = el
	}
	const parent = host.closest('dialog[open]') ?? document.body
	if (shared.tip.parentElement !== parent) parent.append(shared.tip)
	return shared.tip
}

function hideTip() {
	shared.untrack?.()
	shared.untrack = undefined
	shared.host = undefined
	shared.described?.removeAttribute('aria-describedby')
	shared.described = undefined
	document.removeEventListener('pointermove', onDocumentMove)
	if (shared.tip?.matches(':popover-open')) shared.tip.hidePopover()
}

// Hide from a document-level pointermove as well, because a host that goes
// `pointer-events: none` while hovered never fires pointerleave
function onDocumentMove(e: PointerEvent) {
	const host = shared.host
	if (!host) return
	if (e.target instanceof Node && host.contains(e.target)) return
	hideTip()
}

function stringify(v: unknown): string {
	if (typeof v === 'string') return v
	if (typeof v === 'number' || typeof v === 'bigint') return String(v)
	// Anything else — including an object from a malformed binding — has no
	// sensible label, and Vuetify treats false/null as "no tooltip"
	return ''
}

class Tooltip implements EventListenerObject {
	private source: unknown
	private disabled = false
	private placement: Placement = 'top'
	private timer: number | null = null
	// Detaches every host listener in one call, so no listener bookkeeping
	private readonly abort = new AbortController()

	constructor(
		private readonly host: HTMLElement,
		binding: DirectiveBinding,
	) {
		this.update(binding)
		for (const name of HOST_EVENTS) {
			host.addEventListener(name, this, { signal: this.abort.signal })
		}
	}

	// Only the derived fields are kept: holding the binding would retain its
	// `instance`, i.e. the whole host component, for the host's lifetime
	update(binding: DirectiveBinding) {
		const value: unknown = binding.value
		const opts =
			value !== null && typeof value === 'object'
				? (value as TooltipOptions)
				: null
		this.source = opts ? opts.text : value
		this.disabled = !!opts?.disabled
		const loc = opts?.location
		const arg = binding.arg as Side | undefined
		const side =
			loc && loc in PLACEMENT
				? loc
				: arg && arg in PLACEMENT
					? arg
					: 'top'
		const previous = this.placement
		this.placement = PLACEMENT[side]

		if (shared.host !== this.host || !shared.tip) return
		const label = this.label()
		if (!label) {
			hideTip()
			return
		}
		// autoUpdate re-runs on the tip's own resize, so new text re-places
		shared.tip.textContent = label
		// Re-track on a placement change: autoUpdate follows scroll and resize
		if (this.placement !== previous) this.track(shared.tip)
	}

	handleEvent(e: Event) {
		if (e.type === 'pointerenter') this.show(true)
		else if (e.type === 'focusin') this.show(false)
		else this.hide()
	}

	hide() {
		if (this.timer !== null) {
			clearTimeout(this.timer)
			this.timer = null
		}
		if (shared.host === this.host) hideTip()
	}

	destroy() {
		this.abort.abort()
		this.hide()
	}

	private label(): string {
		return this.disabled ? '' : stringify(this.source)
	}

	private show(pointer: boolean) {
		if (this.timer !== null || !this.label()) return
		this.timer = window.setTimeout(() => {
			this.timer = null
			this.open(pointer)
		}, SHOW_DELAY_MS)
	}

	private open(pointer: boolean) {
		// The anchor can be detached between hover and timeout
		if (!this.host.isConnected) return
		// Focus then hover reaches here twice
		if (shared.host === this.host) return
		const label = this.label()
		if (!label) return
		hideTip()
		const el = tipElement(this.host)
		el.textContent = label
		el.showPopover()
		shared.host = this.host
		// An `aria-describedby` the host already has is its own, so leave it
		if (!this.host.hasAttribute('aria-describedby')) {
			this.host.setAttribute('aria-describedby', TIP_ID)
			shared.described = this.host
		}
		this.track(el)
		// Only for a pointer-shown tip: a keyboard user reading one would
		// otherwise lose it to any stray mouse movement on the page
		if (pointer) document.addEventListener('pointermove', onDocumentMove)
	}

	private track(el: HTMLElement) {
		shared.untrack?.()
		shared.untrack = trackAnchor(this.host, el, {
			placement: this.placement,
			offsetPx: GAP_PX,
		})
	}
}

export const zwTooltip: Directive<TooltipHost> = {
	mounted(host, binding) {
		host._zwTip = new Tooltip(host, binding)
	},

	updated(host, binding) {
		host._zwTip?.update(binding)
	},

	unmounted(host) {
		host._zwTip?.destroy()
		delete host._zwTip
	},
}

export default zwTooltip
