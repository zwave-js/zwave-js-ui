// Shared type contract for the dashboard: the `Device` shape plus the
// value and action types its components render and emit.

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

// Maps each discriminant to its concrete shape, enabling compile-time
// narrowing by primary-value type.
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

// Archetype kinds; the catalogue lives in `archetypes.ts`.
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
	// Lucide icon component, rendered via `<component :is>`.
	icon: Component
	power: PowerType
}

// ── Activity ──────────────────────────────────────────────────
//
// In-flight long-running operations on a device: OTA updates, route
// rebuilds, interviews.

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
// Components emit `action(device, { type, … })`; `device-actions.ts`
// maps each shape to its socket call.

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
