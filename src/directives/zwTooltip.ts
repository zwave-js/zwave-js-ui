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

interface TooltipOptions {
	text?: unknown
	disabled?: boolean
	location?: Side
}

interface TooltipState {
	el?: HTMLElement
	timer: number | null
	untrack: (() => void) | null
	binding: DirectiveBinding
	listeners: Array<[string, EventListener]>
	onDocumentMove: ((e: PointerEvent) => void) | null
	hide: () => void
}

interface TooltipHost extends HTMLElement {
	_zwTip?: TooltipState
}

function asOptions(binding: DirectiveBinding): TooltipOptions | null {
	const v: unknown = binding.value
	return v !== null && typeof v === 'object' ? (v as TooltipOptions) : null
}

function stringify(v: unknown): string {
	if (typeof v === 'string') return v
	if (typeof v === 'number' || typeof v === 'bigint') return String(v)
	// Anything else — including an object from a malformed binding — has no
	// sensible label, and Vuetify treats false/null as "no tooltip"
	return ''
}

function text(binding: DirectiveBinding): string {
	const opts = asOptions(binding)
	if (!opts) return stringify(binding.value)
	return opts.disabled ? '' : stringify(opts.text)
}

function side(binding: DirectiveBinding): Side {
	const loc = asOptions(binding)?.location
	if (loc && loc in PLACEMENT) return loc
	const arg = binding.arg as Side | undefined
	return arg && arg in PLACEMENT ? arg : 'top'
}

function create(): HTMLElement {
	const el = document.createElement('div')
	el.className = 'zw-tip'
	el.setAttribute('popover', 'manual')
	el.setAttribute('role', 'tooltip')
	document.body.append(el)
	return el
}

export const zwTooltip: Directive<TooltipHost> = {
	mounted(host, binding) {
		const state: TooltipState = {
			el: undefined,
			timer: null,
			untrack: null,
			binding,
			listeners: [],
			onDocumentMove: null,
			hide: () => {},
		}
		host._zwTip = state

		const hide = () => {
			if (state.timer !== null) {
				clearTimeout(state.timer)
				state.timer = null
			}
			state.untrack?.()
			state.untrack = null
			if (state.onDocumentMove) {
				document.removeEventListener(
					'pointermove',
					state.onDocumentMove,
				)
				state.onDocumentMove = null
			}
			if (state.el?.matches(':popover-open')) state.el.hidePopover()
		}
		state.hide = hide

		const show = () => {
			if (state.timer !== null || !text(state.binding)) return
			state.timer = window.setTimeout(() => {
				state.timer = null
				// The anchor can be detached between hover and timeout
				if (!host.isConnected) return
				// Focus then hover reaches here twice, and showPopover on an
				// already-open popover throws
				if (state.el?.matches(':popover-open')) return
				// Created on first show rather than at mount: a node grid holds
				// hundreds of tooltip hosts and almost none are ever pointed at
				state.el ??= create()
				state.el.textContent = text(state.binding)
				state.el.showPopover()
				state.untrack = trackAnchor(host, state.el, {
					placement: PLACEMENT[side(state.binding)],
					offsetPx: GAP_PX,
				})
				// A host that goes `pointer-events: none` while hovered — a
				// button disabling itself on click — never fires pointerleave
				state.onDocumentMove = (e: PointerEvent) => {
					const target = e.target
					if (target instanceof Node && host.contains(target)) return
					hide()
				}
				document.addEventListener('pointermove', state.onDocumentMove)
			}, SHOW_DELAY_MS)
		}

		const pairs: Array<[string, EventListener]> = [
			['pointerenter', show],
			['pointerleave', hide],
			['focusin', show],
			['focusout', hide],
			['click', hide],
		]
		for (const [name, fn] of pairs) {
			host.addEventListener(name, fn)
			state.listeners.push([name, fn])
		}
	},

	updated(host, binding) {
		const state = host._zwTip
		if (!state) return
		state.binding = binding
		const next = text(binding)
		if (!state.el || state.el.textContent === next) return
		state.el.textContent = next
		// autoUpdate re-runs on the tip's own resize, so new text re-places
		if (!next) state.hide()
	},

	unmounted(host) {
		const state = host._zwTip
		if (!state) return
		if (state.timer !== null) clearTimeout(state.timer)
		state.untrack?.()
		if (state.onDocumentMove) {
			document.removeEventListener('pointermove', state.onDocumentMove)
		}
		for (const [name, fn] of state.listeners) {
			host.removeEventListener(name, fn)
		}
		state.el?.remove()
		delete host._zwTip
	},
}

export default zwTooltip
