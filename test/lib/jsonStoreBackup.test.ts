import * as fs from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Writable } from 'node:stream'
import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
	const real: typeof fs = await importOriginal()
	return { ...real, createWriteStream: vi.fn(real.createWriteStream) }
})

// Set before the app config module loads
const testStoreDir = await mkdtemp(join(tmpdir(), 'zui-store-backup-'))
process.env.STORE_DIR = testStoreDir

const { default: jsonStore } = await import('../../api/lib/jsonStore.ts')
const { default: floorPlans } = await import('../../api/lib/FloorPlans.ts')

describe('#jsonStore backup', () => {
	afterAll(async () => {
		await rm(testStoreDir, { recursive: true, force: true })
	})

	it('fails on a disk error and frees the floorplans for writes', async () => {
		await floorPlans.addMap({ name: 'Before' })
		vi.mocked(fs.createWriteStream).mockImplementationOnce(
			() =>
				new Writable({
					write(chunk, encoding, done) {
						done(
							Object.assign(Error('ENOSPC: no space left'), {
								code: 'ENOSPC',
							}),
						)
					},
				}) as fs.WriteStream,
		)
		await expect(
			jsonStore.backup({ includeFloorPlans: true }),
		).rejects.toThrow('ENOSPC')
		// the write queue moves on instead of waiting forever
		await expect(
			floorPlans.addMap({ name: 'After' }),
		).resolves.toMatchObject({
			name: 'After',
		})
	})
})
