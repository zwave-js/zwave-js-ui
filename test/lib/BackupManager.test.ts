import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'

// Set before the app config module loads
const testStoreDir = await mkdtemp(join(tmpdir(), 'zui-backup-'))
process.env.STORE_DIR = testStoreDir

const { default: jsonStore } = await import('../../api/lib/jsonStore.ts')
const { default: backupManager } = await import(
	'../../api/lib/BackupManager.ts'
)

describe('#BackupManager', () => {
	afterAll(async () => {
		vi.restoreAllMocks()
		await rm(testStoreDir, { recursive: true, force: true })
	})

	it.each([true, false])(
		'passes storeFloorPlans=%s to the store backup',
		async (storeFloorPlans) => {
			const backup = vi
				.spyOn(jsonStore, 'backup')
				.mockResolvedValue('store-backup_test.zip')
			// the settings init() would read from the store
			;(backupManager as any).config = {
				...backupManager.default,
				storeFloorPlans,
			}
			await backupManager.backupStore()
			expect(backup).toHaveBeenCalledWith({ floorPlans: storeFloorPlans })
		},
	)

	it('includes floorplans by default', () => {
		expect(backupManager.default.storeFloorPlans).toBe(true)
	})
})
