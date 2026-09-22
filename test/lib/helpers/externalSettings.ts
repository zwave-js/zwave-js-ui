import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
	resetExternalSettingsCache,
	type ExternalZwaveSettings,
} from '../../../api/lib/externalSettings.ts'

/**
 * Point `loadExternalSettings()` at a throwaway settings file.
 *
 * The module reads one path from the environment and caches what it parsed,
 * so a test needs both halves; `cleanup()` also clears an ambient
 * `ZWAVE_EXTERNAL_SETTINGS` that would otherwise feed real settings to the
 * no-settings cases.
 */
export function externalSettingsFixture() {
	const dir = mkdtempSync(join(tmpdir(), 'zui-external-'))

	return {
		use(settings?: ExternalZwaveSettings) {
			if (settings) {
				const file = join(dir, 'zwave_config.json')
				writeFileSync(file, JSON.stringify(settings))
				process.env.ZWAVE_EXTERNAL_SETTINGS = file
			} else {
				delete process.env.ZWAVE_EXTERNAL_SETTINGS
			}

			resetExternalSettingsCache()
		},
		cleanup() {
			delete process.env.ZWAVE_EXTERNAL_SETTINGS
			resetExternalSettingsCache()
			rmSync(dir, { recursive: true, force: true })
		},
	}
}
