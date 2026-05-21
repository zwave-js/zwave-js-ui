// src/lib/archetypes.ts
//
// Plan 71 — archetype catalogue.
//
// Maps a Z-Wave node (`ZUINode`) to an `Archetype` — the device kind
// drives icon stamp, group-by-type bucket, and primary-value selection
// (plan 30 / 31 / 70).
//
// Inference is heuristic: deviceClass.generic → supportsCC → product
// regex → fallback. Order matters; first match wins.
//
// Command classes are referenced by the `CommandClasses` enum from
// `@zwave-js/cc`, never by hex literal (project convention; see
// auto-memory `feedback-command-classes`).

import { CommandClasses } from '@zwave-js/core'
import type { Component } from 'vue'
import type { ZUINode } from '../../api/lib/ZwaveClient'
import {
	BulbIcon,
	ContactIcon,
	ControllerIcon,
	LeakIcon,
	LockIcon,
	MotionIcon,
	PlugIcon,
	RemoteIcon,
	ShadeIcon,
	SignalIcon,
	SirenIcon,
	StatusIcon,
	SwitchIcon,
	ThermostatIcon,
	ZapIcon,
} from './icons.ts'
import type { Archetype, ArchetypeKind, PowerType } from './dashboard-types.ts'

interface ArchetypeDef {
	kind: ArchetypeKind
	label: string
	icon: Component
	power: PowerType
}

// Catalogue ordering mirrors plan 71's table.
export const ARCHETYPES: Record<ArchetypeKind, ArchetypeDef> = {
	controller: {
		kind: 'controller',
		label: 'Controller',
		icon: ControllerIcon,
		power: 'mains',
	},
	light: { kind: 'light', label: 'Light', icon: BulbIcon, power: 'mains' },
	switch: {
		kind: 'switch',
		label: 'Switch',
		icon: SwitchIcon,
		power: 'mains',
	},
	outlet: { kind: 'outlet', label: 'Outlet', icon: PlugIcon, power: 'mains' },
	shade: {
		kind: 'shade',
		label: 'Shade / Cover',
		icon: ShadeIcon,
		power: 'mains',
	},
	lock: { kind: 'lock', label: 'Lock', icon: LockIcon, power: 'battery' },
	motion: {
		kind: 'motion',
		label: 'Motion sensor',
		icon: MotionIcon,
		power: 'battery',
	},
	contact: {
		kind: 'contact',
		label: 'Contact sensor',
		icon: ContactIcon,
		power: 'battery',
	},
	smoke: {
		kind: 'smoke',
		label: 'Smoke detector',
		icon: SirenIcon,
		power: 'battery',
	},
	water: {
		kind: 'water',
		label: 'Water leak',
		icon: LeakIcon,
		power: 'battery',
	},
	climate: {
		kind: 'climate',
		label: 'Thermostat',
		icon: ThermostatIcon,
		power: 'battery',
	},
	sensor: {
		kind: 'sensor',
		label: 'Sensor',
		icon: SignalIcon,
		power: 'battery',
	},
	button: {
		kind: 'button',
		label: 'Button / Scene',
		icon: ZapIcon,
		power: 'battery',
	},
	remote: {
		kind: 'remote',
		label: 'Remote',
		icon: RemoteIcon,
		power: 'battery',
	},
	unknown: {
		kind: 'unknown',
		label: 'Device',
		icon: StatusIcon,
		power: 'mains',
	},
}

// `Notification` CC notification types (Z-Wave SDS13713). The backend
// surfaces these as numeric values inside the Notification CC value tree
// — we read them by stringified name where available, fall back to id.
const NOTIFICATION_TYPE = {
	smoke: 1,
	co: 2,
	heat: 4,
	water: 5,
	accessControl: 6,
	homeSecurity: 7, // covers motion (event 7/8)
} as const

function nodeCCs(node: ZUINode): Set<number> {
	const set = new Set<number>()
	if (!node.values) return set
	for (const v of Object.values(node.values)) {
		if (typeof v?.commandClass === 'number') set.add(v.commandClass)
	}
	return set
}

function hasCC(ccs: Set<number>, cc: CommandClasses): boolean {
	return ccs.has(cc as number)
}

function hasNotificationType(node: ZUINode, type: number): boolean {
	if (!node.values) return false
	for (const v of Object.values(node.values)) {
		if (v?.commandClass !== (CommandClasses.Notification as number))
			continue
		// zwave-js stores notification type as the property group on the value id
		// (e.g. propertyName 'Smoke Alarm'). Match by id substring as a
		// pragmatic v1 — refine when finer-grained mapping is needed.
		const probe =
			`${v.property ?? ''} ${v.propertyName ?? ''}`.toLowerCase()
		if (type === NOTIFICATION_TYPE.smoke && probe.includes('smoke'))
			return true
		if (type === NOTIFICATION_TYPE.water && probe.includes('water'))
			return true
		if (type === NOTIFICATION_TYPE.homeSecurity && probe.includes('motion'))
			return true
		if (
			type === NOTIFICATION_TYPE.accessControl &&
			probe.includes('access')
		)
			return true
	}
	return false
}

export function productMatches(node: ZUINode, regex: RegExp): boolean {
	const hay = `${node.productLabel ?? ''} ${node.productDescription ?? ''}`
	return regex.test(hay)
}

/**
 * Infer the archetype for a node from device class, supported CCs, and
 * product hints. Pure, side-effect-free.
 *
 * Rules are evaluated highest-priority first; first match wins. When a
 * node legitimately fits two buckets (e.g. a smart plug that supports
 * Binary Switch + Meter), the most specific rule wins.
 */
export function inferArchetype(node: ZUINode): Archetype {
	const def = inferArchetypeDef(node)
	return {
		kind: def.kind,
		label: def.label,
		icon: def.icon,
		power: def.power,
	}
}

function inferArchetypeDef(node: ZUINode): ArchetypeDef {
	if (node.isControllerNode) return ARCHETYPES.controller

	const generic = node.deviceClass?.generic
	const genericName =
		typeof generic === 'string'
			? generic
			: (generic as { label?: string })?.label
	if (genericName === 'Entry Control') return ARCHETYPES.lock

	const ccs = nodeCCs(node)

	if (hasCC(ccs, CommandClasses['Door Lock'])) return ARCHETYPES.lock

	if (hasCC(ccs, CommandClasses['Multilevel Switch'])) {
		if (productMatches(node, /shade|blind|cover|shutter/i))
			return ARCHETYPES.shade
		return ARCHETYPES.light
	}

	if (hasCC(ccs, CommandClasses['Binary Switch'])) {
		if (hasCC(ccs, CommandClasses.Meter)) return ARCHETYPES.outlet
		if (productMatches(node, /bulb|light/i)) return ARCHETYPES.light
		return ARCHETYPES.switch
	}

	if (hasCC(ccs, CommandClasses['Thermostat Setpoint']))
		return ARCHETYPES.climate

	if (hasCC(ccs, CommandClasses.Notification)) {
		if (hasNotificationType(node, NOTIFICATION_TYPE.smoke))
			return ARCHETYPES.smoke
		if (hasNotificationType(node, NOTIFICATION_TYPE.water))
			return ARCHETYPES.water
		if (hasNotificationType(node, NOTIFICATION_TYPE.homeSecurity))
			return ARCHETYPES.motion
		if (hasNotificationType(node, NOTIFICATION_TYPE.accessControl))
			return ARCHETYPES.contact
	}

	if (hasCC(ccs, CommandClasses['Binary Sensor'])) {
		if (productMatches(node, /motion|pir/i)) return ARCHETYPES.motion
		if (productMatches(node, /door|window|contact/i))
			return ARCHETYPES.contact
	}

	if (hasCC(ccs, CommandClasses['Multilevel Sensor']))
		return ARCHETYPES.sensor

	if (hasCC(ccs, CommandClasses['Central Scene'])) {
		if (hasCC(ccs, CommandClasses.Battery)) return ARCHETYPES.remote
		return ARCHETYPES.button
	}

	return ARCHETYPES.unknown
}
