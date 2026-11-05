import { mkdtemp, readdir, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Writable } from 'node:stream'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { streamZip, type ZipEntry } from '../../api/lib/zip.ts'

describe('streamZip', () => {
	let dir: string
	const FILES = 20

	beforeAll(async () => {
		dir = await mkdtemp(join(tmpdir(), 'zui-zip-'))
		for (let i = 0; i < FILES; i++) {
			await writeFile(join(dir, `file-${i}.txt`), 'x'.repeat(64 * 1024))
		}
	})

	afterAll(async () => {
		await rm(dir, { recursive: true, force: true })
	})

	const fileEntries = (): ZipEntry[] =>
		Array.from({ length: FILES }, (_, i) => ({
			path: join(dir, `file-${i}.txt`),
			name: `file-${i}.txt`,
		}))

	const openFdsInDir = async () => {
		const fds = await readdir('/proc/self/fd')
		const targets = await Promise.all(
			fds.map((fd) => readlink(`/proc/self/fd/${fd}`).catch(() => '')),
		)
		return targets.filter((target) => target.startsWith(dir)).length
	}

	// fds are only listable through /proc: the check is Linux only (CI runs there)
	it.skipIf(process.platform !== 'linux')(
		'holds at most one file open at a time',
		async () => {
			let maxOpen = 0
			const output = new Writable({
				write(_chunk, _enc, cb) {
					void openFdsInDir()
						.then((open) => {
							maxOpen = Math.max(maxOpen, open)
						})
						.finally(() => cb())
				},
			})

			await streamZip(output, fileEntries())

			expect(maxOpen).toBe(1)
			expect(await openFdsInDir()).toBe(0)
		},
	)

	it('resolves with the number of bytes written', async () => {
		let bytesWritten = 0
		const output = new Writable({
			write(chunk, _enc, cb) {
				bytesWritten += chunk.length
				cb()
			},
		})

		const size = await streamZip(output, [
			...fileEntries(),
			{ data: 'hello', name: 'hello.txt' },
		])

		expect(size).toBe(bytesWritten)
	})

	it('rejects when a file cannot be read', async () => {
		const output = new Writable({
			write(_chunk, _enc, cb) {
				cb()
			},
		})

		await expect(
			streamZip(output, [{ path: join(dir, 'missing.txt'), name: 'x' }]),
		).rejects.toThrow(/ENOENT/)
	})
})
