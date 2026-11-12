import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises'
import express from 'express'
import { randomBytes } from 'node:crypto'
import type { Server as HttpServer } from 'node:http'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// Set before the app config module loads
const testStoreDir = await mkdtemp(join(tmpdir(), 'zui-store-zip-'))
process.env.STORE_DIR = testStoreDir

const { default: jsonStore } = await import('../../api/lib/jsonStore.ts')
const { default: storeConfig } = await import('../../api/config/store.ts')
const { storeBackupsDir } = await import('../../api/config/app.ts')
const { default: app } = await import('../../api/app.ts')
const { logContainer } = await import('../../api/lib/logger.ts')

describe('store zip routes', () => {
	let server: HttpServer
	let baseUrl: string

	beforeAll(async () => {
		await jsonStore.init(storeConfig)
		// writes settings.json to disk, so there is a store file to zip
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
		expect(zip.includes('big.jsonl')).toBe(true)
		await rm(join(testStoreDir, 'big.jsonl'))
	})

	it('leaves only complete backups when two run in the same second', async () => {
		await rm(storeBackupsDir, { recursive: true, force: true })

		// fileDate() has second resolution, so both target the same file name
		await Promise.all([jsonStore.backup(), jsonStore.backup()])

		const files = await readdir(storeBackupsDir)
		// no temp files left behind, and every backup is one complete zip
		expect(files.every((f) => f.startsWith('store-backup_'))).toBe(true)
		const eocd = Buffer.from([0x50, 0x4b, 0x05, 0x06])
		for (const file of files) {
			const zip = await readFile(join(storeBackupsDir, file))
			expect(zip.indexOf(eocd)).toBeGreaterThan(0)
			expect(zip.indexOf(eocd)).toBe(zip.lastIndexOf(eocd))
		}
	})

	it('answers with an error and keeps no partial backup when the backup fails', async () => {
		await rm(storeBackupsDir, { recursive: true, force: true })
		// a directory matching the backup glob fails to read with EISDIR
		const unreadable = join(testStoreDir, 'broken.jsonl')
		await mkdir(unreadable)
		try {
			const res = await fetch(`${baseUrl}/api/store/backup`, {
				headers: { Accept: 'application/json' },
			})

			expect(res.status).toBe(500)
			expect(res.headers.get('content-disposition')).toBeNull()
			expect(await res.json()).toMatchObject({
				error: expect.stringContaining('EISDIR'),
			})
			expect(await readdir(storeBackupsDir)).toEqual([])
		} finally {
			await rm(unreadable, { recursive: true })
		}
	})

	it('appends no error once the store zip has started streaming', async () => {
		const appLogger = logContainer.loggers.get('App')
		const warn = vi.spyOn(appLogger, 'warn')
		const send = vi.spyOn(express.response, 'send')
		// a link to a directory passes the store checks but fails to read with EISDIR
		await mkdir(join(testStoreDir, 'somedir'))
		await symlink(
			join(testStoreDir, 'somedir'),
			join(testStoreDir, 'dirlink'),
		)
		try {
			const res = fetch(`${baseUrl}/api/store-multi`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					files: [join(testStoreDir, 'dirlink')],
				}),
			})

			// the server destroyed the socket, so the client sees a network error
			await expect(res.then((r) => r.arrayBuffer())).rejects.toThrow(
				/fetch failed|terminated/,
			)
			await vi.waitFor(() =>
				expect(warn).toHaveBeenCalledWith(
					'Store download not delivered:',
					expect.objectContaining({ code: 'EISDIR' }),
				),
			)
			expect(send).not.toHaveBeenCalled()
		} finally {
			vi.restoreAllMocks()
			await rm(join(testStoreDir, 'dirlink'))
			await rm(join(testStoreDir, 'somedir'), { recursive: true })
		}
	})
})
