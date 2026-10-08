import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import type { Server as HttpServer } from 'node:http'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Set before the app config module loads
const testStoreDir = await mkdtemp(join(tmpdir(), 'zui-store-zip-'))
process.env.STORE_DIR = testStoreDir

const { default: jsonStore } = await import('../../api/lib/jsonStore.ts')
const { default: storeConfig } = await import('../../api/config/store.ts')
const { storeBackupsDir } = await import('../../api/config/app.ts')
const { default: app } = await import('../../api/app.ts')

describe('store zip routes', () => {
	let server: HttpServer
	let baseUrl: string

	beforeAll(async () => {
		await jsonStore.init(storeConfig)
		await jsonStore.put(storeConfig.settings, {
			...jsonStore.get(storeConfig.settings),
		})
		server = createServer(app)
		await new Promise<void>((resolve) =>
			server.listen(0, '127.0.0.1', resolve),
		)
		baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
	})

	afterAll(async () => {
		await new Promise((resolve) => server.close(resolve))
		await rm(testStoreDir, { recursive: true, force: true })
	})

	it('streams the selected store files as a zip', async () => {
		const res = await fetch(`${baseUrl}/api/store-multi`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				files: [join(testStoreDir, 'settings.json')],
			}),
		})

		const body = Buffer.from(await res.arrayBuffer())
		expect(res.headers.get('content-type')).toBe('application/zip')
		expect(body.subarray(0, 2).toString()).toBe('PK')
		// entry names are stored uncompressed in the zip directory
		expect(body.includes('settings.json')).toBe(true)
	})

	it('streams the backup and keeps a copy in the backups dir', async () => {
		// the history API fallback rewrites GETs that accept */* to the index page
		const res = await fetch(`${baseUrl}/api/store/backup`, {
			headers: { Accept: 'application/json' },
		})

		const body = Buffer.from(await res.arrayBuffer())
		expect(res.headers.get('content-disposition')).toMatch(
			/^attachment; filename="store-backup_.+\.zip"$/,
		)
		expect(body.subarray(0, 2).toString()).toBe('PK')
		expect(body.includes('settings.json')).toBe(true)
		expect(await readdir(storeBackupsDir)).toHaveLength(1)
	})

	it('keeps a complete backup on disk when the client drops the download', async () => {
		await rm(storeBackupsDir, { recursive: true, force: true })
		// big enough that the download is still running when the client drops it
		await writeFile(
			join(testStoreDir, 'big.jsonl'),
			randomBytes(8 * 1024 * 1024).toString('base64'),
		)
		const abort = new AbortController()

		const res = await fetch(`${baseUrl}/api/store/backup`, {
			headers: { Accept: 'application/json' },
			signal: abort.signal,
		})
		abort.abort()
		await res.arrayBuffer().catch(() => {})

		const [backup] = await readdir(storeBackupsDir)
		const zip = await readFile(join(storeBackupsDir, backup))
		// a complete zip ends with its end-of-central-directory record
		expect(zip.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06]))).toBe(true)
	})
})
