// Drop-in for Vuetify's `v-tooltip` directive, on the native popover API.
//
// Vuetify teleports its tooltip into `.v-overlay-container` under `<body>`,
// which a top-layer `<dialog>` paints over — so tooltips inside a dashboard
// dialog were invisible. A popover is itself promoted to the top layer and
// stacks in open order, so it shows above the dialog that opened it.
//
// Positioning goes through Floating UI rather than CSS anchor positioning,
// which Firefox does not implement; see also lib/popover-fallback.ts.
//
// Usage matches Vuetify: `v-zw-tooltip:bottom="'text'"`, arg defaults to 'top'.

import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import type { Placement } from '@floating-ui/dom'
import type { Directive, DirectiveBinding } from 'vue'

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

interface TooltipHost extends HTMLElement {
	_zwTip?: {
		el: HTMLElement
		timer: number | null
		listeners: Array<[string, EventListener]>
	}
}

function text(binding: DirectiveBinding): string {
	const v = binding.value
	return v == null || v === false ? '' : String(v)
}

function side(binding: DirectiveBinding): Side {
	const arg = binding.arg as Side | undefined
	return arg && arg in PLACEMENT ? arg : 'top'
}

function place(host: HTMLElement, el: HTMLElement, placement: Placement): void {
	computePosition(host, el, {
		placement,
		strategy: 'fixed',
		middleware: [offset(GAP_PX), flip(), shift({ padding: 8 })],
	})
		.then(({ x, y }) => {
			el.style.left = `${x}px`
			el.style.top = `${y}px`
		})
		.catch((err: unknown) => {
			console.error('[zwTooltip] computePosition failed', err)
		})
}

function mount(host: TooltipHost, binding: DirectiveBinding): void {
	const el = document.createElement('div')
	el.className = 'zw-tip'
	el.setAttribute('popover', 'manual')
	el.setAttribute('role', 'tooltip')
	el.textContent = text(binding)
	document.body.append(el)

	const state: NonNullable<TooltipHost['_zwTip']> = {
		el,
		timer: null,
		listeners: [],
	}
	host._zwTip = state

	const show = () => {
		if (state.timer !== null || !el.textContent) return
		state.timer = window.setTimeout(() => {
			state.timer = null
			// The anchor can be detached between hover and timeout
			if (!host.isConnected) return
			el.showPopover()
			place(host, el, PLACEMENT[side(binding)])
		}, SHOW_DELAY_MS)
	}
	const hide = () => {
		if (state.timer !== null) {
			clearTimeout(state.timer)
			state.timer = null
		}
		if (el.matches(':popover-open')) el.hidePopover()
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
}

export const zwTooltip: Directive<TooltipHost> = {
	mounted(host, binding) {
		mount(host, binding)
	},
	updated(host, binding) {
		const state = host._zwTip
		if (!state) return
		state.el.textContent = text(binding)
		if (!state.el.textContent && state.el.matches(':popover-open')) {
			state.el.hidePopover()
		}
	},
	unmounted(host) {
		const state = host._zwTip
		if (!state) return
		if (state.timer !== null) clearTimeout(state.timer)
		for (const [name, fn] of state.listeners) {
			host.removeEventListener(name, fn)
		}
		state.el.remove()
		delete host._zwTip
	},
}

export default zwTooltip
