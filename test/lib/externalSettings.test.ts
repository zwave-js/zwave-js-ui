import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Driver } from 'zwave-js'

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

		it('NO_WATCHDOG keeps features.softReset: false', async () => {
			const file = join(dir, 'zwave_config.json')
			writeFileSync(file, JSON.stringify({ presets: ['NO_WATCHDOG'] }))
			process.env.ZWAVE_EXTERNAL_SETTINGS = file

			const { getExternalDriverPresets } = await import(
				'../../api/lib/externalSettings.ts'
			)
			const driver = new Driver(
				'/dev/null',
				{ features: { softReset: false } },
				...getExternalDriverPresets(),
			)

			expect(driver.options.features.softReset).toBe(false)
			expect(driver.options.features.watchdog).toBe(false)
		})
	})
})
