// Shared type contract for the dashboard: the `Device` shape plus the
// value and action types its components render and emit.

import type { Component } from 'vue'
import type { ValueID } from '@zwave-js/core'

// ── Primary value ──────────────────────────────────────────────

export type PrimaryValueType =
	| 'toggle'
	| 'dim'
	| 'lock'
	| 'reading'
	| 'state'
	| 'thermostat'

// On/off device — switch, outlet, or binary light.
export interface PrimaryValueToggle {
	type: 'toggle'
	label?: string
	on: boolean
	watts?: number | null
	target: ValueID
}

// Variable level (0–100%) — dimmable light or shade position.
export interface PrimaryValueDim {
	type: 'dim'
	label?: string
	level: number
	target: ValueID
}

// Door lock secured/unsecured state.
export interface PrimaryValueLock {
	type: 'lock'
	label?: string
	locked: boolean
	target: ValueID
}

// Read-only sensor measurement (value + unit), e.g. temperature.
export interface PrimaryValueReading {
	type: 'reading'
	value: number | string
	unit: string
}

// Discrete sensor state with display labels/colours, e.g. motion clear/detected.
export interface PrimaryValueState {
	type: 'state'
	value: string
	stateIdx: number
	states: string[]
	colors: string[]
}

// Thermostat — current temperature, setpoint, and mode.
export interface PrimaryValueThermostat {
	type: 'thermostat'
	value: number
	unit: string
	setpoint: number
	mode: string
	setpointTarget?: ValueID
	modeTarget?: ValueID
}

export type PrimaryValue =
	| PrimaryValueToggle
	| PrimaryValueDim
	| PrimaryValueLock
	| PrimaryValueReading
	| PrimaryValueState
	| PrimaryValueThermostat

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

export type ActivityType = 'ota' | 'rebuild' | 'interview'

export interface Activity {
	type: ActivityType
	label: string
	/** 0–100 integer percentage. Optional for indeterminate operations. */
	progress?: number
}

// ── Security ──────────────────────────────────────────────────

// Canonical zwave-js `SecurityClass` member names (see @zwave-js/core).
export type SecurityKey =
	| 'S0_Legacy'
	| 'S2_Unauthenticated'
	| 'S2_Authenticated'
	| 'S2_AccessControl'

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

// ── Firmware updates ─────────────────────────────────────────

export interface FirmwareUpdateInfo {
	version: string
	channel?: 'stable' | 'prerelease'
	changelog: string[]
	date?: string
	downgrade: boolean
	latest?: boolean
}

// ── Device ────────────────────────────────────────────────────

export interface Device {
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
	interviewState: 'complete' | 'interview'
	security?: SecurityKey | 'none'
	securityKeys: SecurityKey[]
	firmware?: { node?: string; sdk?: string }
	protocol?: string
	lastSeen: string
	// Raw last-active epoch (ms) backing the `lastSeen` label, kept for sorting.
	lastSeenTs?: number
	primaryValue: PrimaryValue | null
	activity: Activity[]
	health?: 'ok' | 'weak' | 'unknown'
	hasUpdate?: boolean
	availableFirmwareUpdates?: FirmwareUpdateInfo[]
	txPower?: number
	commStats?: CommStats
}

// ── Action contract ───────────────────────────────────────────

export type DeviceAction =
	| { type: 'toggle'; on: boolean; valueId: ValueID }
	| { type: 'dim'; level: number; valueId: ValueID }
	| { type: 'lock'; locked: boolean; valueId: ValueID }
	| { type: 'thermostat-setpoint'; setpoint: number; valueId: ValueID }
	| { type: 'thermostat-mode'; mode: string; valueId: ValueID }
	// Generic value-pane interactions: write any value, re-read a single
	// value, or re-read every value of a command class.
	| { type: 'set-value'; valueId: ValueID; value: unknown }
	| { type: 'poll-value'; valueId: ValueID }
	| { type: 'refresh-cc'; commandClass: number }
	| { type: 'ping' }
	| { type: 'interview' }
	| { type: 'refresh' }
	| { type: 'rebuild' }
	| { type: 'remove' }
	| { type: 'export' }
	| { type: 'export-ui' }
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
	| { type: 'clear-associations' }
	| { type: 'remove-all-associations' }
	| { type: 'check-firmware-updates' }
	| { type: 'firmware-install'; update: FirmwareUpdateInfo }
	| { type: 'firmware-upload'; file: File }
