import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Driver, driverPresets } from 'zwave-js'
import type { PartialZWaveOptions } from 'zwave-js'
import type { ExternalZwaveSettings } from '../../api/lib/externalSettings.ts'

const log = vi.hoisted(() => ({
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
}))
vi.mock('../../api/lib/logger.ts', () => ({ module: () => log }))

let tmpDir: string

// The module caches the parsed file, so every case writes its own settings
// file and re-imports the module.
async function loadWithSettings(settings?: ExternalZwaveSettings) {
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

describe('#externalSettings', () => {
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), 'zui-external-'))
		log.info.mockClear()
		log.warn.mockClear()
	})

	afterEach(() => {
		delete process.env.ZWAVE_EXTERNAL_SETTINGS
		rmSync(tmpDir, { recursive: true, force: true })
	})

	describe('#getExternalDriverPresets()', () => {
		it('returns nothing when no external settings are configured', async () => {
			const { getExternalDriverPresets } = await loadWithSettings()
			expect(getExternalDriverPresets()).to.deep.equal([])
		})

		it('returns nothing for an empty preset list', async () => {
			const { getExternalDriverPresets } = await loadWithSettings({
				presets: [],
			})
			expect(getExternalDriverPresets()).to.deep.equal([])
			expect(log.warn).not.toHaveBeenCalled()
		})

		it('returns one entry per known preset, in order', async () => {
			const { getExternalDriverPresets } = await loadWithSettings({
				presets: ['NO_CONTROLLER_RECOVERY', 'NO_WATCHDOG'],
			})

			expect(getExternalDriverPresets()).to.deep.equal([
				driverPresets.NO_CONTROLLER_RECOVERY,
				driverPresets.NO_WATCHDOG,
			])
			expect(log.info).toHaveBeenCalledWith(
				'Using driver presets: NO_CONTROLLER_RECOVERY, NO_WATCHDOG',
			)
		})

		// `Driver` adopts preset sub-objects by reference and fills them with
		// its defaults, so handing out the library's own objects pollutes them
		// for every later driver instance in the process.
		it('returns copies, not the shared preset objects', async () => {
			const { getExternalDriverPresets } = await loadWithSettings({
				presets: ['SAFE_MODE'],
			})

			const original = driverPresets.SAFE_MODE.attempts.sendData
			const [preset] = getExternalDriverPresets()

			expect(preset).not.toBe(driverPresets.SAFE_MODE)
			expect(preset.attempts).not.toBe(driverPresets.SAFE_MODE.attempts)

			preset.attempts.sendData = original + 1
			expect(driverPresets.SAFE_MODE.attempts.sendData).to.equal(original)
		})

		it('skips unknown presets and says so', async () => {
			const { getExternalDriverPresets } = await loadWithSettings({
				presets: ['NOPE', 'NO_WATCHDOG'],
			})

			expect(getExternalDriverPresets()).to.deep.equal([
				driverPresets.NO_WATCHDOG,
			])
			expect(log.warn).toHaveBeenCalledWith(
				expect.stringContaining('Unknown driver preset: NOPE'),
			)
		})

		it('skips inherited keys instead of forwarding them as presets', async () => {
			const { getExternalDriverPresets } = await loadWithSettings({
				presets: ['toString'],
			})

			expect(getExternalDriverPresets()).to.deep.equal([])
			expect(log.warn).toHaveBeenCalledWith(
				expect.stringContaining('Unknown driver preset: toString'),
			)
		})

		it('rejects a presets field that is not an array', async () => {
			const { getExternalDriverPresets } = await loadWithSettings({
				presets: 'SAFE_MODE' as unknown as string[],
			})

			expect(getExternalDriverPresets()).to.deep.equal([])
			expect(log.warn).toHaveBeenCalledWith(
				'Ignoring `presets`: expected an array of preset names',
			)
		})
	})

	// The regression behind #4829: a preset carrying `features` used to replace
	// the whole object and take `softReset` with it.
	describe('preset merge semantics', () => {
		it('keeps the options a preset does not mention', async () => {
			const { getExternalDriverPresets } = await loadWithSettings({
				presets: ['SAFE_MODE'],
			})
			const preset = driverPresets.SAFE_MODE

			const driver = new Driver(
				'/dev/null',
				{
					features: { softReset: false },
					timeouts: { sendToSleep: 777 },
				},
				...getExternalDriverPresets(),
			)

			// every SAFE_MODE value differs from the driver defaults, so these
			// fail if the presets never reach the constructor
			expect(driver.options.timeouts.response).to.equal(
				preset.timeouts.response,
			)
			expect(driver.options.attempts.sendData).to.equal(
				preset.attempts.sendData,
			)

			// and the siblings the preset doesn't mention survive
			expect(driver.options.timeouts.sendToSleep).to.equal(777)
			expect(driver.options.features.softReset).to.equal(false)
		})
	})

	describe('#applyExternalDriverSettings()', () => {
		// Presets are handed to the Driver instead, which deep merges them.
		// Merging them here would drop sibling keys like `features.softReset`.
		it('leaves driver options untouched by presets', async () => {
			const { applyExternalDriverSettings } = await loadWithSettings({
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
			const { applyExternalDriverSettings } = await loadWithSettings({
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
