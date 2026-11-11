import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Driver, driverPresets } from 'zwave-js'

describe('#externalSettings', () => {
	describe('#getExternalDriverPresets()', () => {
		let dir: string

		beforeEach(() => {
			dir = mkdtempSync(join(tmpdir(), 'zui-external-'))
			// the module caches the parsed file, so each test needs a fresh copy
			vi.resetModules()
		})

		afterEach(() => {
			delete process.env.ZWAVE_EXTERNAL_SETTINGS
			rmSync(dir, { recursive: true, force: true })
		})

		it('presets override options without wiping their siblings', async () => {
			const file = join(dir, 'zwave_config.json')
			writeFileSync(
				file,
				JSON.stringify({ presets: ['NO_WATCHDOG', 'SAFE_MODE'] }),
			)
			process.env.ZWAVE_EXTERNAL_SETTINGS = file
			const safeModeBefore = JSON.stringify(driverPresets.SAFE_MODE)

			const { getExternalDriverPresets } = await import(
				'../../api/lib/externalSettings.ts'
			)
			const driver = new Driver(
				'/dev/null',
				{
					features: { softReset: false, watchdog: true },
					timeouts: { sendToSleep: 777, response: 1000 },
				},
				...getExternalDriverPresets(),
			)

			expect(driver.options.features.watchdog).toBe(false)
			expect(driver.options.features.softReset).toBe(false)
			expect(driver.options.timeouts.response).toBe(60000)
			expect(driver.options.timeouts.sendToSleep).toBe(777)
			expect(JSON.stringify(driverPresets.SAFE_MODE)).toBe(safeModeBefore)
		})
	})
})
