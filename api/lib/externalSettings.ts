import { readFileSync, existsSync } from 'node:fs'
import type { PartialZWaveOptions } from 'zwave-js'
import { driverPresets } from 'zwave-js'
import { module } from './logger.ts'

const logger = module('ExternalSettings')

// Uses Z-Wave JS UI key names for consistency
export interface ExternalZwaveSettings {
	// Z-Wave driver logging options
	logEnabled?: boolean
	logLevel?: string
	logToFile?: boolean
	maxFiles?: number
	logFilename?: string
	forceConsole?: boolean

	// RF settings (only region and autoPowerlevels - Z-Wave JS UI handles power levels)
	rf?: {
		region?: number
		autoPowerlevels?: boolean
	}

	// Storage (passed directly to driver)
	storage?: {
		cacheDir?: string
		throttle?: 'normal' | 'slow' | 'fast'
	}

	// Security keys with specific key names
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

	// Features
	enableSoftReset?: boolean

	// Presets (array of preset names from driverPresets, e.g. ["BATTERY_SAVE"])
	presets?: string[]
}

let cachedSettings: ExternalZwaveSettings | null = null
let settingsLoaded = false

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

	// Presets (driver-only, no UI mapping)

	return paths
}

export function applyExternalSettings(zwaveOptions: PartialZWaveOptions): void {
	const settings = loadExternalSettings()
	if (!settings) return

	// Apply logging settings (convert to driver logConfig format)
	if (
		settings.logEnabled !== undefined ||
		settings.logLevel !== undefined ||
		settings.logToFile !== undefined ||
		settings.maxFiles !== undefined ||
		settings.logFilename !== undefined ||
		settings.forceConsole !== undefined
	) {
		zwaveOptions.logConfig = zwaveOptions.logConfig || {}
		if (settings.logEnabled !== undefined)
			zwaveOptions.logConfig.enabled = settings.logEnabled
		if (settings.logLevel !== undefined)
			zwaveOptions.logConfig.level = settings.logLevel as any
		if (settings.logToFile !== undefined)
			zwaveOptions.logConfig.logToFile = settings.logToFile
		if (settings.maxFiles !== undefined)
			zwaveOptions.logConfig.maxFiles = settings.maxFiles
		if (settings.logFilename !== undefined)
			zwaveOptions.logConfig.filename = settings.logFilename
		if (settings.forceConsole !== undefined)
			zwaveOptions.logConfig.forceConsole = settings.forceConsole
	}

	// Apply RF settings (only region and autoPowerlevels)
	if (settings.rf) {
		zwaveOptions.rf = zwaveOptions.rf || {}
		if (settings.rf.region !== undefined)
			zwaveOptions.rf.region = settings.rf.region
		// Note: autoPowerlevels is handled by Z-Wave JS UI to set appropriate power levels
	}

	// Apply storage
	if (settings.storage) {
		zwaveOptions.storage = zwaveOptions.storage || {}
		if (settings.storage.cacheDir !== undefined)
			zwaveOptions.storage.cacheDir = settings.storage.cacheDir
		if (settings.storage.throttle !== undefined)
			zwaveOptions.storage.throttle = settings.storage.throttle
	}

	// Apply security keys (convert hex strings to Buffers)
	if (settings.securityKeys) {
		zwaveOptions.securityKeys = zwaveOptions.securityKeys || {}
		for (const [key, value] of Object.entries(settings.securityKeys)) {
			if (value?.length === 32) {
				;(zwaveOptions.securityKeys as Record<string, Buffer>)[key] =
					Buffer.from(value, 'hex')
			}
		}
	}
	if (settings.securityKeysLongRange) {
		zwaveOptions.securityKeysLongRange =
			zwaveOptions.securityKeysLongRange || {}
		for (const [key, value] of Object.entries(
			settings.securityKeysLongRange,
		)) {
			if (value?.length === 32) {
				;(zwaveOptions.securityKeysLongRange as Record<string, Buffer>)[
					key
				] = Buffer.from(value, 'hex')
			}
		}
	}

	// Apply features
	if (settings.enableSoftReset !== undefined) {
		zwaveOptions.features = zwaveOptions.features || {}
		zwaveOptions.features.softReset = settings.enableSoftReset
	}

	// Apply presets (load from driverPresets and merge)
	if (settings.presets && settings.presets.length > 0) {
		for (const presetName of settings.presets) {
			const preset =
				driverPresets[presetName as keyof typeof driverPresets]
			if (preset) {
				// Merge preset options into zwaveOptions (preset values take precedence)
				Object.assign(zwaveOptions, preset)
				logger.info(`Applied driver preset: ${presetName}`)
			} else {
				logger.warn(`Unknown driver preset: ${presetName}`)
			}
		}
	}

	logger.debug('Applied external settings to driver options')
}
