// Drop-in for Vuetify's `v-tooltip` directive, on the native popover API.
//
// Vuetify teleports its tooltip into `.v-overlay-container` under `<body>`,
// which a top-layer `<dialog>` paints over — so tooltips inside a dashboard
// dialog were invisible. A popover is itself promoted to the top layer and
// stacks in open order, so it shows above the dialog that opened it.
//
// Positioning goes through Floating UI rather than CSS anchor positioning,
// which Firefox does not implement; see lib/popover-fallback.ts.
//
// Usage matches Vuetify: `v-zw-tooltip:bottom="'text'"`, or the object form
// `v-zw-tooltip="{ text, disabled, location }"`. The directive arg defaults to
// 'top' and an object `location` overrides it.

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

// One tip element and one visible tooltip for the whole app: a node grid holds
// hundreds of hosts, and a per-host element would leave a permanent `<body>`
// child behind every row ever pointed at
const shared: {
	tip?: HTMLElement
	host?: HTMLElement
	untrack?: () => void
} = {}

function tipElement(): HTMLElement {
	if (!shared.tip) {
		const el = document.createElement('div')
		el.className = 'zw-tip'
		el.setAttribute('popover', 'manual')
		el.setAttribute('role', 'tooltip')
		document.body.append(el)
		shared.tip = el
	}
	return shared.tip
}

function hideTip() {
	shared.untrack?.()
	shared.untrack = undefined
	shared.host = undefined
	document.removeEventListener('pointermove', onDocumentMove)
	if (shared.tip?.matches(':popover-open')) shared.tip.hidePopover()
}

// A host that goes `pointer-events: none` while hovered — a button disabling
// itself on click — never fires pointerleave
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
		this.placement = PLACEMENT[side]

		if (shared.host !== this.host || !shared.tip) return
		const label = this.label()
		// autoUpdate re-runs on the tip's own resize, so new text re-places
		if (label) shared.tip.textContent = label
		else hideTip()
	}

	handleEvent(e: Event) {
		if (e.type === 'pointerenter' || e.type === 'focusin') this.show()
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

	private show() {
		if (this.timer !== null || !this.label()) return
		this.timer = window.setTimeout(() => {
			this.timer = null
			this.open()
		}, SHOW_DELAY_MS)
	}

	private open() {
		// The anchor can be detached between hover and timeout
		if (!this.host.isConnected) return
		// Focus then hover reaches here twice
		if (shared.host === this.host) return
		const label = this.label()
		if (!label) return
		hideTip()
		const el = tipElement()
		el.textContent = label
		el.showPopover()
		shared.host = this.host
		shared.untrack = trackAnchor(this.host, el, {
			placement: this.placement,
			offsetPx: GAP_PX,
		})
		document.addEventListener('pointermove', onDocumentMove)
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
