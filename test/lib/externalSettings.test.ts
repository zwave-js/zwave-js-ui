import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { Driver, driverPresets } from 'zwave-js'
import type { PartialZWaveOptions } from 'zwave-js'
import {
	applyExternalDriverSettings,
	getExternalDriverPresets,
	getExternallyManagedPaths,
} from '../../api/lib/externalSettings.ts'

const log = vi.hoisted(() => ({
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
}))
vi.mock('../../api/lib/logger.ts', () => ({ module: () => log }))

// imported after the logger mock so the module under test picks it up
const { externalSettingsFixture } = await import(
	'./helpers/externalSettings.ts'
)

let fixture: ReturnType<typeof externalSettingsFixture>
const useSettings = (...args: Parameters<typeof fixture.use>) =>
	fixture.use(...args)

describe('#externalSettings', () => {
	beforeEach(() => {
		fixture = externalSettingsFixture()
		log.info.mockClear()
		log.warn.mockClear()
	})

	afterEach(() => {
		fixture.cleanup()
	})

	describe('#getExternalDriverPresets()', () => {
		it('returns nothing when no external settings are configured', () => {
			useSettings()
			expect(getExternalDriverPresets()).to.deep.equal([])
		})

		it('returns nothing for an empty preset list', () => {
			useSettings({
				presets: [],
			})
			expect(getExternalDriverPresets()).to.deep.equal([])
			expect(log.warn).not.toHaveBeenCalled()
		})

		it('returns one entry per known preset, in order', () => {
			useSettings({
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
		it('returns copies, not the shared preset objects', () => {
			useSettings({
				presets: ['SAFE_MODE'],
			})

			const original = driverPresets.SAFE_MODE.attempts.sendData
			const [preset] = getExternalDriverPresets()

			expect(preset).not.toBe(driverPresets.SAFE_MODE)
			expect(preset.attempts).not.toBe(driverPresets.SAFE_MODE.attempts)

			preset.attempts.sendData = original + 1
			expect(driverPresets.SAFE_MODE.attempts.sendData).to.equal(original)
		})

		it('skips unknown presets and says so', () => {
			useSettings({
				presets: ['NOPE', 'NO_WATCHDOG'],
			})

			expect(getExternalDriverPresets()).to.deep.equal([
				driverPresets.NO_WATCHDOG,
			])
			expect(log.warn).toHaveBeenCalledWith(
				expect.stringContaining('Unknown driver preset: NOPE'),
			)
		})

		it('skips inherited keys instead of forwarding them as presets', () => {
			useSettings({
				presets: ['toString'],
			})

			expect(getExternalDriverPresets()).to.deep.equal([])
			expect(log.warn).toHaveBeenCalledWith(
				expect.stringContaining('Unknown driver preset: toString'),
			)
		})

		it('rejects a presets field that is not an array', () => {
			useSettings({
				presets: 'SAFE_MODE' as unknown as string[],
			})

			expect(getExternalDriverPresets()).to.deep.equal([])
			expect(log.warn).toHaveBeenCalledWith(
				'Ignoring `presets`: expected an array of preset names, got string',
			)
		})
	})

	// The regression behind #4829: a preset carrying `features` used to replace
	// the whole object and take `softReset` with it.
	describe('preset merge semantics', () => {
		it('keeps the options a preset does not mention', () => {
			useSettings({
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

			// the assertions below only discriminate while the preset differs
			// from what the driver would have used anyway
			const defaults = new Driver('/dev/null', {}).options
			expect(preset.timeouts.response).not.to.equal(
				defaults.timeouts.response,
			)
			expect(preset.attempts.sendData).not.to.equal(
				defaults.attempts.sendData,
			)

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

	describe('#getExternallyManagedPaths()', () => {
		// a preset overrides these settings, so the UI must stop offering them
		it('reports the UI settings the requested presets override', () => {
			useSettings({ presets: ['SAFE_MODE', 'NO_WATCHDOG'] })

			expect(getExternallyManagedPaths()).to.have.members([
				'zwave.responseTimeout',
				'zwave.higherReportsTimeout',
				'zwave.disableWatchdog',
			])
		})

		// an upstream preset gaining an option with a UI counterpart must be
		// added to the map, or the UI keeps offering a control the driver wins.
		// Counted through the public result so the map stays module-private.
		it('maps every preset option that has a UI setting', () => {
			const noUiCounterpart = [
				'timeouts.nonce',
				'timeouts.sendDataAbort',
				'timeouts.sendDataCallback',
				'attempts.sendData',
				'attempts.sendDataJammed',
				'attempts.nodeInterview',
			]

			for (const [name, preset] of Object.entries(driverPresets)) {
				const keys = Object.entries(preset).flatMap(
					([group, options]) =>
						Object.keys(options).map((key) => `${group}.${key}`),
				)
				const expected = keys.filter(
					(path) => !noUiCounterpart.includes(path),
				)

				useSettings({ presets: [name] })

				expect(
					getExternallyManagedPaths(),
					`unmapped option in ${name}`,
				).to.have.lengthOf(expected.length)
			}
		})

		it('reports nothing for presets with no UI counterpart', () => {
			useSettings({ presets: ['BATTERY_SAVE'] })

			expect(getExternallyManagedPaths()).to.deep.equal([
				'zwave.sendToSleepTimeout',
			])
		})
	})

	describe('#applyExternalDriverSettings()', () => {
		// Presets are handed to the Driver instead, which deep merges them.
		// Merging them here would drop sibling keys like `features.softReset`.
		it('leaves driver options untouched by presets', () => {
			useSettings({
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

		it('applies storage and log settings', () => {
			useSettings({
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
