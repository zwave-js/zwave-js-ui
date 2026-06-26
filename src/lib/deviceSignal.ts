import type { Component } from 'vue'
import { SignalHighIcon, SignalLowIcon } from './icons.ts'
import type { Device } from './dashboard-types.ts'

export interface SignalDisplay {
	icon: Component // Lucide, rendered via `<component :is>`
	color: string
	label: string
}

// Device link health → signal glyph/color/label, shared by the table row and
// the details rail. Only `weak` reads as degraded today.
export function signalDisplay(health: Device['health']): SignalDisplay {
	const weak = health === 'weak'
	return {
		icon: weak ? SignalLowIcon : SignalHighIcon,
		color: weak ? 'var(--zw-warning)' : 'var(--zw-fg-soft)',
		label: weak ? 'Weak' : 'Strong',
	}
}
