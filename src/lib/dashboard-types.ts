// src/lib/dashboard-types.ts
//
// Type contract that the new dashboard components consume. The
// authoritative shape and the runtime projection (Z-Wave node → UI
// Device) ship with plan 70 (`fn · device projection`); these stubs
// stand in for the contract so the visual components compile and stay
// statically checked while plan 70 is in review.
//
// When plan 70 lands, move these declarations to `src/lib/device-projection.ts`
// (and `src/lib/device-actions.ts`) and re-export from this module for
// backwards compatibility — components import from `@/lib/dashboard-types`
// today.

import type { Component } from 'vue'

// ── Primary value ──────────────────────────────────────────────

export type PrimaryValueType =
	| 'toggle'
	| 'dim'
	| 'lock'
	| 'reading'
	| 'state'
	| 'thermostat'

export interface PrimaryValueToggle {
	type: 'toggle'
	label?: string
	on: boolean
	watts?: number | null
}

export interface PrimaryValueDim {
	type: 'dim'
	label?: string
	level: number
}

export interface PrimaryValueLock {
	type: 'lock'
	label?: string
	locked: boolean
}

export interface PrimaryValueReading {
	type: 'reading'
	value: number | string
	unit: string
}

export interface PrimaryValueState {
	type: 'state'
	value: string
	stateIdx: number
	states: string[]
	colors: string[]
}

export interface PrimaryValueThermostat {
	type: 'thermostat'
	value: number
	unit: string
	setpoint: number
	mode: string
}

export type PrimaryValue =
	| PrimaryValueToggle
	| PrimaryValueDim
	| PrimaryValueLock
	| PrimaryValueReading
	| PrimaryValueState
	| PrimaryValueThermostat

// Maps each discriminant to its concrete shape. A renderer declares the
// one variant it handles (`usePrimaryValue(device, 'state')`) and gets
// back exactly `PrimaryValueState | null`, so the registry stays
// type-checked end-to-end instead of relying on scattered `as` casts.
export interface PrimaryValueByType {
	toggle: PrimaryValueToggle
	dim: PrimaryValueDim
	lock: PrimaryValueLock
	reading: PrimaryValueReading
	state: PrimaryValueState
	thermostat: PrimaryValueThermostat
}

// ── Power / status / archetype ─────────────────────────────────

export type PowerType = 'mains' | 'battery' | 'usb'

export interface PowerInfo {
	type: PowerType
	battery?: number | null
}

export type DeviceStatus = 'alive' | 'awake' | 'asleep' | 'dead'

// Plan 71 archetype set. The catalogue lives in `src/lib/archetypes.ts`.
export type ArchetypeKind =
	| 'controller'
	| 'light'
	| 'switch'
	| 'outlet'
	| 'shade'
	| 'lock'
	| 'motion'
	| 'contact'
	| 'smoke'
	| 'water'
	| 'climate'
	| 'sensor'
	| 'button'
	| 'remote'
	| 'unknown'

export interface Archetype {
	kind: ArchetypeKind
	label: string
	// Aliased Lucide component (e.g. SwitchIcon from @/lib/icons), rendered
	// via `<component :is="archetype.icon">`. Typed as Vue's `Component` —
	// the same contract `primary-display/registry.ts` uses for its renderers.
	icon: Component
	power: PowerType
}

// ── Activity ──────────────────────────────────────────────────
//
// In-flight long-running operations against a device: OTA firmware
// updates, route rebuilds, interviews. Earlier scaffolding called
// these "transient"; the dashboard rework standardises on "activity"
// (plan 72).

export type ActivityType = 'ota' | 'rebuild' | 'interview'

export interface Activity {
	type: ActivityType
	label: string
	/** 0–100 integer percentage. Optional for indeterminate operations. */
	progress?: number
}

// ── Security ──────────────────────────────────────────────────

export type SecurityKey = 'S0' | 'S2_UA' | 'S2_A' | 'S2_AC'

// ── Comm stats (controller) ───────────────────────────────────

export interface CommStats {
	can: number
	nak: number
	timeoutACK: number
	timeoutResponse: number
	timeoutCallback: number
	messagesTX: number
	messagesRX: number
	messagesDroppedTX: number
	messagesDroppedRX: number
}

// ── Device ────────────────────────────────────────────────────

export interface Device {
	id: number | string
	nodeId: number
	isController: boolean
	name: string
	location: string
	manufacturer?: string
	product?: string
	productCode?: string
	archetype: Archetype
	power: PowerInfo
	status: DeviceStatus
	interviewState: 'complete' | 'interview' | 'failed'
	security?: SecurityKey | 'none'
	securityKeys: SecurityKey[]
	firmware?: { node?: string; sdk?: string }
	protocol?: string
	lastSeen: string
	primaryValue: PrimaryValue | null
	activity: Activity[]
	health?: 'ok' | 'weak' | 'unknown'
	hasUpdate?: boolean
	txPower?: number
	commStats?: CommStats
}

// ── Action contract ───────────────────────────────────────────
//
// Components emit `action(device, { type, ... })` rather than
// verb-specific events. Plan 70 owns the dispatcher that routes each
// action shape to the matching socket call.

export type DeviceAction =
	| { type: 'toggle'; on: boolean }
	| { type: 'dim'; level: number }
	| { type: 'lock'; locked: boolean }
	| { type: 'thermostat-setpoint'; setpoint: number }
	| { type: 'thermostat-mode'; mode: string }
	| { type: 'ping' }
	| { type: 'interview' }
	| { type: 'refresh' }
	| { type: 'rebuild' }
	| { type: 'remove' }
	| { type: 'export' }
	| { type: 'clear' }
	| { type: 'heal' }
	| { type: 'backup-nvm' }
	| { type: 'restore-nvm' }
	| { type: 'reset-stats' }
	| { type: 'export-json' }
	| { type: 'update-topics' }
	| { type: 'hard-reset' }
	| { type: 'restart-driver' }
	| { type: 'include' }
	| { type: 'replace-failed' }
	| { type: 'exclude' }
