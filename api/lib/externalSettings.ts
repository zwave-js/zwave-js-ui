import { readFileSync, existsSync } from 'node:fs'
import type { PartialZWaveOptions } from 'zwave-js'
import { driverPresets } from 'zwave-js'
import { module } from './logger.ts'

const logger = module('ExternalSettings')

export interface ExternalZwaveSettings {
	// Logging (with UI configuration)
	logEnabled?: boolean
	logLevel?: string
	logToFile?: boolean
	maxFiles?: number

	// Logging (without UI configuration)
	logFilename?: string
	forceConsole?: boolean

	// RF settings
	rf?: {
		region?: number
		autoPowerlevels?: boolean
	}

	// Storage
	storage?: {
		cacheDir?: string
		throttle?: 'normal' | 'slow' | 'fast'
	}

	// Security keys
	securityKeys?: {
		S0_Legacy?: string
		S2_Unauthenticated?: string
		S2_Authenticated?: string
		S2_AccessControl?: string
	}
	securityKeysLongRange?: {
		S2_Authenticated?: string
		S2_AccessControl?: string
	}

	// Device config
	deviceConfigPriorityDir?: string

	// Features
	enableSoftReset?: boolean
	enableStatistics?: boolean

	// Z-Wave JS Server settings
	serverEnabled?: boolean
	serverPort?: number
	serverHost?: string
	serverServiceDiscoveryDisabled?: boolean

	// Presets
	presets?: string[]
}

let cachedSettings: ExternalZwaveSettings | null = null
let settingsLoaded = false
let cachedPresetNames: string[] | null = null

/** Test seam: drop everything cached from the settings file. */
export function resetExternalSettingsCache(): void {
	cachedSettings = null
	settingsLoaded = false
	cachedPresetNames = null
}

export function loadExternalSettings(): ExternalZwaveSettings | null {
	if (settingsLoaded) return cachedSettings
	settingsLoaded = true

	const filePath = process.env.ZWAVE_EXTERNAL_SETTINGS
	if (!filePath) return null

	if (!existsSync(filePath)) {
		logger.warn(`External settings file not found: ${filePath}`)
		return null
	}

	try {
		cachedSettings = JSON.parse(
			readFileSync(filePath, 'utf-8'),
		) as ExternalZwaveSettings
		logger.info(`Loaded external Z-Wave settings from: ${filePath}`)
		return cachedSettings
	} catch (error) {
		logger.error(
			`Failed to load external settings: ${(error as Error).message}`,
		)
		return null
	}
}

export function getExternallyManagedPaths(): string[] {
	const settings = loadExternalSettings()
	if (!settings) return []

	const paths: string[] = []

	// Logging (logFilename and forceConsole are driver-only, no UI mapping)
	if (settings.logEnabled !== undefined) paths.push('zwave.logEnabled')
	if (settings.logLevel !== undefined) paths.push('zwave.logLevel')
	if (settings.logToFile !== undefined) paths.push('zwave.logToFile')
	if (settings.maxFiles !== undefined) paths.push('zwave.maxFiles')

	// RF settings
	if (settings.rf?.region !== undefined) paths.push('zwave.rf.region')
	if (settings.rf?.autoPowerlevels !== undefined)
		paths.push('zwave.rf.autoPowerlevels')

	// Security keys (check each specific key)
	if (settings.securityKeys?.S0_Legacy !== undefined)
		paths.push('zwave.securityKeys.S0_Legacy')
	if (settings.securityKeys?.S2_Unauthenticated !== undefined)
		paths.push('zwave.securityKeys.S2_Unauthenticated')
	if (settings.securityKeys?.S2_Authenticated !== undefined)
		paths.push('zwave.securityKeys.S2_Authenticated')
	if (settings.securityKeys?.S2_AccessControl !== undefined)
		paths.push('zwave.securityKeys.S2_AccessControl')
	if (settings.securityKeysLongRange?.S2_Authenticated !== undefined)
		paths.push('zwave.securityKeysLongRange.S2_Authenticated')
	if (settings.securityKeysLongRange?.S2_AccessControl !== undefined)
		paths.push('zwave.securityKeysLongRange.S2_AccessControl')

	// Features
	if (settings.enableSoftReset !== undefined)
		paths.push('zwave.enableSoftReset')
	if (settings.enableStatistics !== undefined)
		paths.push('zwave.enableStatistics')

	// Device config
	if (settings.deviceConfigPriorityDir !== undefined)
		paths.push('zwave.deviceConfigPriorityDir')

	// Home Assistant / Z-Wave JS Server settings
	if (settings.serverEnabled !== undefined) paths.push('zwave.serverEnabled')
	if (settings.serverPort !== undefined) paths.push('zwave.serverPort')
	if (settings.serverHost !== undefined) paths.push('zwave.serverHost')
	if (settings.serverServiceDiscoveryDisabled !== undefined)
		paths.push('zwave.serverServiceDiscoveryDisabled')

	// Presets win over the settings they touch, so their UI fields are managed
	// externally for as long as the preset is active
	paths.push(...presetManagedPaths())

	return paths
}

export function applyExternalDriverSettings(
	zwaveOptions: PartialZWaveOptions,
): void {
	const settings = loadExternalSettings()
	if (!settings) return

	if (
		settings.logFilename !== undefined ||
		settings.forceConsole !== undefined
	) {
		zwaveOptions.logConfig = zwaveOptions.logConfig || {}
		if (settings.logFilename !== undefined)
			zwaveOptions.logConfig.filename = settings.logFilename
		if (settings.forceConsole !== undefined)
			zwaveOptions.logConfig.forceConsole = settings.forceConsole
	}

	if (settings.storage) {
		zwaveOptions.storage = zwaveOptions.storage || {}
		if (settings.storage.cacheDir !== undefined)
			zwaveOptions.storage.cacheDir = settings.storage.cacheDir
		if (settings.storage.throttle !== undefined)
			zwaveOptions.storage.throttle = settings.storage.throttle
	}
}

type PresetName = keyof typeof driverPresets

/** Resolve the requested preset names once, reporting the unusable ones. */
function resolvePresetNames(): PresetName[] {
	if (cachedPresetNames) return cachedPresetNames as PresetName[]

	const settings = loadExternalSettings()
	if (settings?.presets == null) return []

	if (!Array.isArray(settings.presets)) {
		logger.warn('Ignoring `presets`: expected an array of preset names')
		cachedPresetNames = []
		return []
	}

	const names: string[] = []

	for (const presetName of settings.presets) {
		// own-key check: `toString` & co. resolve on the prototype and would
		// be forwarded as silent no-op presets
		if (!Object.hasOwn(driverPresets, presetName)) {
			logger.warn(
				`Unknown driver preset: ${presetName}. Known presets: ${Object.keys(driverPresets).join(', ')}`,
			)
			continue
		}
		names.push(presetName)
	}

	if (names.length > 0) {
		logger.info(`Using driver presets: ${names.join(', ')}`)
	}

	cachedPresetNames = names
	return names as PresetName[]
}

/**
 * Resolve the driver presets requested by external settings.
 *
 * They are returned instead of merged into the driver options because presets
 * carry nested objects (`features`, `timeouts`, ...) that would overwrite the
 * ones built from the settings. `Driver` deep merges every preset it is given.
 *
 * Each call returns fresh copies: `Driver` adopts preset sub-objects by
 * reference and fills them with its own defaults.
 */
export function getExternalDriverPresets(): PartialZWaveOptions[] {
	return resolvePresetNames().map((name) =>
		structuredClone(driverPresets[name]),
	)
}

/**
 * Driver options a preset can set that also have a UI setting. While the
 * preset is active the driver ignores the UI value, so the field is managed
 * externally like any other external setting.
 */
const SETTING_BY_PRESET_OPTION: Record<string, string> = {
	'features.softReset': 'zwave.enableSoftReset',
	'features.unresponsiveControllerRecovery':
		'zwave.disableControllerRecovery',
	'features.watchdog': 'zwave.disableWatchdog',
	'timeouts.response': 'zwave.responseTimeout',
	'timeouts.report': 'zwave.higherReportsTimeout',
	'timeouts.sendToSleep': 'zwave.sendToSleepTimeout',
}

function presetManagedPaths(): string[] {
	const paths: string[] = []

	for (const name of resolvePresetNames()) {
		for (const [group, values] of Object.entries(driverPresets[name])) {
			for (const key of Object.keys(values)) {
				const path = SETTING_BY_PRESET_OPTION[`${group}.${key}`]
				if (path) paths.push(path)
			}
		}
	}

	return paths
}

/**
 * Merge external settings into ZwaveConfig.
 * This should be called once in app.ts before passing settings to ZwaveClient.
 */
export function mergeExternalSettings(
	zwaveConfig: Record<string, unknown>,
): void {
	const settings = loadExternalSettings()
	if (!settings) return

	// Server settings
	if (settings.serverEnabled !== undefined)
		zwaveConfig.serverEnabled = settings.serverEnabled
	if (settings.serverPort !== undefined)
		zwaveConfig.serverPort = settings.serverPort
	if (settings.serverHost !== undefined)
		zwaveConfig.serverHost = settings.serverHost
	if (settings.serverServiceDiscoveryDisabled !== undefined)
		zwaveConfig.serverServiceDiscoveryDisabled =
			settings.serverServiceDiscoveryDisabled

	// Logging settings
	if (settings.logEnabled !== undefined)
		zwaveConfig.logEnabled = settings.logEnabled
	if (settings.logLevel !== undefined)
		zwaveConfig.logLevel = settings.logLevel
	if (settings.logToFile !== undefined)
		zwaveConfig.logToFile = settings.logToFile
	if (settings.maxFiles !== undefined)
		zwaveConfig.maxFiles = settings.maxFiles

	// RF settings
	if (settings.rf) {
		zwaveConfig.rf = zwaveConfig.rf || {}
		const rf = zwaveConfig.rf as Record<string, unknown>
		if (settings.rf.region !== undefined) rf.region = settings.rf.region
		if (settings.rf.autoPowerlevels !== undefined)
			rf.autoPowerlevels = settings.rf.autoPowerlevels
	}

	// Security keys (stored as hex strings, converted to Buffers later by ZwaveClient)
	if (settings.securityKeys) {
		zwaveConfig.securityKeys = zwaveConfig.securityKeys || {}
		const keys = zwaveConfig.securityKeys as Record<string, string>
		for (const [key, value] of Object.entries(settings.securityKeys)) {
			if (value) keys[key] = value
		}
	}
	if (settings.securityKeysLongRange) {
		zwaveConfig.securityKeysLongRange =
			zwaveConfig.securityKeysLongRange || {}
		const keys = zwaveConfig.securityKeysLongRange as Record<string, string>
		for (const [key, value] of Object.entries(
			settings.securityKeysLongRange,
		)) {
			if (value) keys[key] = value
		}
	}

	// Features
	if (settings.enableSoftReset !== undefined)
		zwaveConfig.enableSoftReset = settings.enableSoftReset
	if (settings.enableStatistics !== undefined)
		zwaveConfig.enableStatistics = settings.enableStatistics

	// Device config
	if (settings.deviceConfigPriorityDir !== undefined)
		zwaveConfig.deviceConfigPriorityDir = settings.deviceConfigPriorityDir
}
