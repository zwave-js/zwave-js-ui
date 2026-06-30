import type { Device } from './dashboard-types.ts'

export interface SignalDisplay {
	level: 0 | 1 | 2 | 3 | 4
	label: string
}

export function signalDisplay(health: Device['health']): SignalDisplay {
	if (health === 'weak') return { level: 1, label: 'Weak signal' }
	if (health === 'ok') return { level: 4, label: 'Strong signal' }
	return { level: 0, label: 'Unknown signal' }
}
