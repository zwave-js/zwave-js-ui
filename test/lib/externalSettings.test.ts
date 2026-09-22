import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PartialZWaveOptions } from 'zwave-js'
import type { ExternalZwaveSettings } from '../../api/lib/externalSettings.ts'

// The module caches the parsed file, so every case writes its own settings
// file and re-imports the module.
async function loadModule(settings?: ExternalZwaveSettings) {
	if (settings) {
		const file = join(tmpDir, 'zwave_config.json')
		writeFileSync(file, JSON.stringify(settings))
		process.env.ZWAVE_EXTERNAL_SETTINGS = file
	} else {
		delete process.env.ZWAVE_EXTERNAL_SETTINGS
	}

	vi.resetModules()
	return import('../../api/lib/externalSettings.ts')
}

let tmpDir: string

describe('#externalSettings', () => {
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), 'zwave-external-'))
	})

	afterEach(() => {
		delete process.env.ZWAVE_EXTERNAL_SETTINGS
		rmSync(tmpDir, { recursive: true, force: true })
	})

	describe('#getExternalDriverPresets()', () => {
		it('returns nothing when no external settings are configured', async () => {
			const { getExternalDriverPresets } = await loadModule()
			expect(getExternalDriverPresets()).to.deep.equal([])
		})

		it('returns one entry per known preset, in order', async () => {
			const { getExternalDriverPresets } = await loadModule({
				presets: ['NO_CONTROLLER_RECOVERY', 'NO_WATCHDOG'],
			})

			expect(getExternalDriverPresets()).to.deep.equal([
				{ features: { unresponsiveControllerRecovery: false } },
				{ features: { watchdog: false } },
			])
		})

		it('skips unknown presets', async () => {
			const { getExternalDriverPresets } = await loadModule({
				presets: ['NOPE', 'NO_WATCHDOG'],
			})

			expect(getExternalDriverPresets()).to.deep.equal([
				{ features: { watchdog: false } },
			])
		})
	})

	describe('#applyExternalDriverSettings()', () => {
		// Presets are handed to the Driver, which deep merges them. Merging
		// them here would drop sibling keys like `features.softReset` (#4829).
		it('leaves driver options untouched by presets', async () => {
			const { applyExternalDriverSettings } = await loadModule({
				presets: ['NO_WATCHDOG'],
			})

			const options: PartialZWaveOptions = {
				features: { softReset: false, watchdog: true },
			}
			applyExternalDriverSettings(options)

			expect(options.features).to.deep.equal({
				softReset: false,
				watchdog: true,
			})
		})

		it('applies storage and log settings', async () => {
			const { applyExternalDriverSettings } = await loadModule({
				storage: { throttle: 'slow' },
				forceConsole: true,
			})

			const options: PartialZWaveOptions = {
				storage: { cacheDir: '/cache' },
			}
			applyExternalDriverSettings(options)

			expect(options.storage).to.deep.equal({
				cacheDir: '/cache',
				throttle: 'slow',
			})
			expect(options.logConfig).to.deep.equal({ forceConsole: true })
		})
	})
})
