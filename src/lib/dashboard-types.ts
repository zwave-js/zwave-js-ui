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

// ── Power / status / archetype ─────────────────────────────────

export type PowerType = 'mains' | 'battery' | 'usb'

export interface PowerInfo {
	type: PowerType
	battery?: number | null
}

export type DeviceStatus = 'alive' | 'awake' | 'asleep' | 'dead'

export type ArchetypeKind =
	| 'switch'
	| 'dimmer'
	| 'plug'
	| 'thermostat'
	| 'lock'
	| 'motion'
	| 'contact'
	| 'leak'
	| 'tempsensor'
	| 'shade'
	| 'siren'
	| 'remote'
	| 'rgb'
	| 'controller'

export interface Archetype {
	kind: ArchetypeKind
	label: string
	// Aliased Lucide component (e.g. SwitchIcon from @/lib/icons).
	icon: unknown
	power: PowerType
}

// ── Activity ─────────────────────────────────────────────────

export type ActivityType = 'ota' | 'rebuild' | 'interview'

export interface Activity {
	type: ActivityType
	label: string
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
	interviewState: 'complete' | 'interview' | 'failed' | string
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
	| { type: 'replace' }
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
