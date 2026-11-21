// Drop-in for Vuetify's `v-tooltip`, rendered through the native popover API.
// Vuetify mounts a component on `mounted` and remounts it on every `updated`.
// That gets expensive with many tooltips on screen.
//
// V0's Tooltip primitive is a component tree per host, so it carries the same
// per-row mount cost this replaces.
//
// Usage: `v-zw-tooltip:bottom="'text'"` or `{ text, disabled, location, delay }`

import type { Placement } from '@floating-ui/dom'
import type { Directive, DirectiveBinding } from 'vue'
import { trackAnchor, DEFAULT_OFFSET_PX } from '@/lib/popover-fallback.ts'

type Side = 'top' | 'bottom' | 'start' | 'end' | 'left' | 'right'

// `start`/`end` map without consulting text direction, so RTL reads them as LTR
const PLACEMENT: Record<Side, Placement> = {
	top: 'top',
	bottom: 'bottom',
	left: 'left',
	right: 'right',
	start: 'left',
	end: 'right',
}

const SHOW_DELAY_MS = 400
// Within `WARM_MS` of the last tip hiding, the next one opens with no delay, so
// sweeping across a row of icons doesn't wait once per icon
const WARM_MS = 300
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
	delay?: number
}

interface TooltipHost extends HTMLElement {
	_zwTip?: Tooltip
}

// `shared` holds one tip element for the whole app. A per-host element would
// leave a permanent `<body>` child behind every row ever pointed at
const shared: {
	tip?: HTMLElement
	host?: HTMLElement
	untrack?: () => void
	// `described` is the host that got `aria-describedby`, and `describedPrev`
	// is what it carried before, so only that one is restored
	described?: HTMLElement
	describedPrev?: string | null
	hiddenAt: number
} = { hiddenAt: 0 }

// Put the tip inside the host's dialog. `showModal()` hides everything outside
// that subtree from the accessibility tree
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

function describe(host: HTMLElement) {
	const prev = host.getAttribute('aria-describedby')
	// Append so a host that already points at its own description keeps it
	host.setAttribute('aria-describedby', prev ? `${prev} ${TIP_ID}` : TIP_ID)
	shared.described = host
	shared.describedPrev = prev
}

function undescribe() {
	const host = shared.described
	if (!host) return
	if (shared.describedPrev === null) host.removeAttribute('aria-describedby')
	else host.setAttribute('aria-describedby', shared.describedPrev)
	shared.described = undefined
	shared.describedPrev = undefined
}

function hideTip() {
	shared.untrack?.()
	shared.untrack = undefined
	shared.host = undefined
	shared.hiddenAt = Date.now()
	undescribe()
	document.removeEventListener('pointermove', onDocumentMove)
	document.removeEventListener('pointerdown', onDocumentDown)
	document.removeEventListener('keydown', onDocumentKey)
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

// A touch-shown tip has no pointerleave to end it, so the next tap anywhere
// outside the host dismisses it
function onDocumentDown(e: PointerEvent) {
	const host = shared.host
	if (!host) return
	if (e.target instanceof Node && host.contains(e.target)) return
	hideTip()
}

// WCAG 1.4.13 requires dismissing a tooltip without moving focus, and
// `popover: manual` opts out of the UA's own light dismiss
function onDocumentKey(e: KeyboardEvent) {
	if (e.key === 'Escape') hideTip()
}

export function stringify(v: unknown): string {
	if (typeof v === 'string') return v
	if (typeof v === 'number' || typeof v === 'bigint') return String(v)
	// Anything else has no sensible label, and Vuetify treats false and null as
	// "no tooltip"
	return ''
}

export function resolvePlacement(location: unknown, arg: unknown): Placement {
	for (const candidate of [location, arg]) {
		if (candidate === undefined || candidate === null) continue
		// Own keys only, so `'toString'` can't resolve to a function
		if (
			typeof candidate === 'string' &&
			Object.hasOwn(PLACEMENT, candidate)
		) {
			return PLACEMENT[candidate as Side]
		}
		if (import.meta.env?.DEV) {
			console.warn(
				`[v-zw-tooltip] unknown location ${JSON.stringify(candidate)}, falling back to "top"`,
			)
		}
	}
	return 'top'
}

// Walk the host chain so a nested host resolves deterministically instead of
// racing on timer order
function ancestorHosts(host: HTMLElement): Tooltip[] {
	const found: Tooltip[] = []
	let el = host.parentElement
	while (el) {
		const tip = (el as TooltipHost)._zwTip
		if (tip) found.push(tip)
		el = el.parentElement
	}
	return found
}

class Tooltip implements EventListenerObject {
	private source: unknown
	private disabled = false
	private delay = SHOW_DELAY_MS
	private placement: Placement = 'top'
	private timer: number | null = null
	private listening = false
	// A tap fires pointerenter and then click; `touching` keeps that click from
	// closing the tip it just opened
	private touching = false
	// `abort` detaches every host listener in one call
	private readonly abort = new AbortController()

	constructor(
		private readonly host: HTMLElement,
		binding: DirectiveBinding,
	) {
		this.update(binding)
	}

	// Keep only the derived fields. The binding holds an `instance` reference to
	// the whole host component
	update(binding: DirectiveBinding) {
		const value: unknown = binding.value
		const opts =
			value !== null && typeof value === 'object'
				? (value as TooltipOptions)
				: null
		this.source = opts ? opts.text : value
		this.disabled = !!opts?.disabled
		this.delay =
			typeof opts?.delay === 'number' ? opts.delay : SHOW_DELAY_MS
		const previous = this.placement
		this.placement = resolvePlacement(opts?.location, binding.arg)

		const label = this.label()
		// Most cells in the node table never get a label, so they hold no
		// listeners at all
		this.setListening(!!label)

		if (shared.host !== this.host || !shared.tip) return
		if (!label) {
			hideTip()
			return
		}
		// autoUpdate re-runs on the tip's own resize, so new text repositions it
		shared.tip.textContent = label
		// autoUpdate follows scroll and resize only, so re-track on a placement
		// change
		if (this.placement !== previous) this.track(shared.tip)
	}

	handleEvent(e: Event) {
		if (e.type === 'pointerenter') {
			this.touching = (e as PointerEvent).pointerType === 'touch'
			this.show(true)
		} else if (e.type === 'focusin') {
			this.show(false)
		} else if (e.type === 'click') {
			// The click that ends the opening tap must not close the tip
			if (this.touching) this.touching = false
			else this.hide()
		} else if (e.type === 'focusout') {
			// focusout bubbles, so moving between children of one host would
			// otherwise hide and restart the timer
			const next = (e as FocusEvent).relatedTarget
			if (next instanceof Node && this.host.contains(next)) return
			this.hide()
		} else {
			this.hide()
		}
	}

	hide() {
		this.clearTimer()
		if (shared.host === this.host) hideTip()
	}

	destroy() {
		this.abort.abort()
		this.listening = false
		this.hide()
	}

	private setListening(on: boolean) {
		if (on === this.listening) return
		this.listening = on
		for (const name of HOST_EVENTS) {
			if (on) {
				this.host.addEventListener(name, this, {
					signal: this.abort.signal,
				})
			} else {
				this.host.removeEventListener(name, this)
			}
		}
		if (!on) this.hide()
	}

	private clearTimer() {
		if (this.timer === null) return
		clearTimeout(this.timer)
		this.timer = null
	}

	private label(): string {
		return this.disabled ? '' : stringify(this.source)
	}

	private show(pointer: boolean) {
		if (this.timer !== null || !this.label()) return
		// A tap has no hover to sustain, and a warm tip already proved intent
		const wait =
			this.touching || Date.now() - shared.hiddenAt < WARM_MS
				? 0
				: this.delay
		this.timer = window.setTimeout(() => {
			this.timer = null
			this.open(pointer)
		}, wait)
	}

	private open(pointer: boolean) {
		// The anchor can be detached between hover and timeout
		if (!this.host.isConnected) return
		// Focus then hover reaches here twice
		if (shared.host === this.host) return
		// A nested host is the more specific label, so an ancestor never
		// replaces one that is already up
		if (shared.host && this.host.contains(shared.host)) return
		const label = this.label()
		if (!label) return
		// Enter events fire outermost-first, so an ancestor's timer is still
		// pending here and would replace this tip a moment later
		for (const outer of ancestorHosts(this.host)) outer.clearTimer()
		hideTip()
		const el = tipElement(this.host)
		el.textContent = label
		el.showPopover()
		shared.host = this.host
		describe(this.host)
		this.track(el)
		document.addEventListener('keydown', onDocumentKey)
		// Listen only for a pointer-shown tip. A keyboard-shown tip must survive
		// stray mouse movement on the page
		if (pointer && !this.touching) {
			document.addEventListener('pointermove', onDocumentMove)
		}
		if (this.touching)
			document.addEventListener('pointerdown', onDocumentDown)
	}

	private track(el: HTMLElement) {
		shared.untrack?.()
		shared.untrack = trackAnchor(this.host, el, {
			placement: this.placement,
			offsetPx: DEFAULT_OFFSET_PX,
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
