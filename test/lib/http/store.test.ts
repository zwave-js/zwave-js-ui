import { describe, it, expect } from 'vitest'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { useHttpHarness, bufferResponse } from './harness.ts'
import { getTestStoreDir } from './env.ts'
import { createFakeGateway } from './fakes.ts'

const BUNDLED_SNIPPETS_DIR = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'snippets',
)

const EXPECTED_BUNDLED_SNIPPET_NAMES = [
	'access-store-dir',
	'clone-config',
	'pingNodes',
	'reinterview-nodes',
]

describe('HTTP contract: store, upload, snippets', () => {
	const getHarness = useHttpHarness()

	describe('GET /api/store', () => {
		it('returns the root store tree with an isRoot entry when no path is given', async () => {
			const harness = await getHarness()
			const res = await harness.request.get('/api/store')

			expect(res.status).toBe(200)
			expect(res.body.success).toBe(true)
			expect(res.body.data).toEqual([
				expect.objectContaining({
					name: 'store',
					isRoot: true,
					children: expect.any(Array),
				}),
			])
		})

		it('returns file contents verbatim for an existing file path', async () => {
			const harness = await getHarness()
			writeFileSync(
				path.join(getTestStoreDir(), 'note.txt'),
				'hello store',
			)

			const res = await harness.request
				.get('/api/store')
				.query({ path: 'note.txt' })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({ success: true, data: 'hello store' })
		})

		it('rejects a path that escapes the store dir, without reading anything', async () => {
			const harness = await getHarness()
			const res = await harness.request
				.get('/api/store')
				.query({ path: '../../etc/passwd' })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'Path not allowed',
			})
		})
	})

	describe('PUT /api/store', () => {
		it('writes file content at the given path', async () => {
			const harness = await getHarness()
			const res = await harness.request
				.put('/api/store')
				.query({ path: 'written.txt', isNew: 'true' })
				.send({ content: 'new content' })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({ success: true })
			expect(
				readFileSync(
					path.join(getTestStoreDir(), 'written.txt'),
					'utf8',
				),
			).toBe('new content')
		})

		it('creates a directory when isDirectory=true', async () => {
			const harness = await getHarness()
			const res = await harness.request.put('/api/store').query({
				path: 'new-folder',
				isNew: 'true',
				isDirectory: 'true',
			})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({ success: true })
			expect(existsSync(path.join(getTestStoreDir(), 'new-folder'))).toBe(
				true,
			)
		})

		it('rejects writing to a path outside the store, without creating anything', async () => {
			const harness = await getHarness()
			const res = await harness.request
				.put('/api/store')
				.query({ path: '../escape.txt', isNew: 'true' })
				.send({ content: 'nope' })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'Path not allowed',
			})
		})

		it('rejects overwriting an existing directory as a file (isNew omitted)', async () => {
			const harness = await getHarness()
			mkdirSync(path.join(getTestStoreDir(), 'a-real-dir'), {
				recursive: true,
			})

			const res = await harness.request
				.put('/api/store')
				.query({ path: 'a-real-dir' })
				.send({ content: 'nope' })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'Path is not a file',
			})
		})
	})

	describe('DELETE /api/store', () => {
		it('removes the file/directory at the given path', async () => {
			const harness = await getHarness()
			writeFileSync(path.join(getTestStoreDir(), 'to-delete.txt'), 'bye')

			const res = await harness.request
				.delete('/api/store')
				.query({ path: 'to-delete.txt' })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({ success: true })
			expect(
				existsSync(path.join(getTestStoreDir(), 'to-delete.txt')),
			).toBe(false)
		})

		it('rejects a path outside the store', async () => {
			const harness = await getHarness()
			const res = await harness.request
				.delete('/api/store')
				.query({ path: '../outside.txt' })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'Path not allowed',
			})
		})
	})

	describe('PUT /api/store-multi', () => {
		it('removes every listed file', async () => {
			const harness = await getHarness()
			writeFileSync(path.join(getTestStoreDir(), 'multi-a.txt'), 'a')
			writeFileSync(path.join(getTestStoreDir(), 'multi-b.txt'), 'b')

			const res = await harness.request
				.put('/api/store-multi')
				.send({ files: ['multi-a.txt', 'multi-b.txt'] })

			expect(res.status).toBe(200)
			expect(res.body).toEqual({ success: true })
			expect(
				existsSync(path.join(getTestStoreDir(), 'multi-a.txt')),
			).toBe(false)
			expect(
				existsSync(path.join(getTestStoreDir(), 'multi-b.txt')),
			).toBe(false)
		})

		it('defaults to an empty file list and still succeeds', async () => {
			const harness = await getHarness()
			const res = await harness.request.put('/api/store-multi').send({})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({ success: true })
		})
	})

	describe('POST /api/store-multi', () => {
		it('streams a ZIP archive of the requested files with the ZIP content type/attachment header', async () => {
			const harness = await getHarness()
			writeFileSync(
				path.join(getTestStoreDir(), 'zippable.txt'),
				'contents',
			)

			const res = await bufferResponse(
				harness.request
					.post('/api/store-multi')
					.send({ files: ['zippable.txt'] }),
			)

			expect(res.status).toBe(200)
			expect(res.headers['content-type']).toBe('application/zip')
			expect(res.headers['content-disposition']).toMatch(
				/attachment; filename="zwave-js-ui-store\.zip"/,
			)
			// PK\x03\x04 is the ZIP local-file-header signature, proving the body is a real archive
			expect((res.body as Buffer).subarray(0, 4).toString('hex')).toBe(
				'504b0304',
			)
		})

		it('silently skips files that resolve outside the store, producing a valid (possibly empty) archive', async () => {
			const harness = await getHarness()
			const res = await bufferResponse(
				harness.request
					.post('/api/store-multi')
					.send({ files: ['../outside.txt'] }),
			)

			expect(res.status).toBe(200)
			expect(res.headers['content-type']).toBe('application/zip')
		})
	})

	describe('GET /api/store/backup', () => {
		it(
			'streams a ZIP archive body while advertising Content-Type: application/json ' +
				'(preserved quirk: jsonStore.backup() never overrides the default JSON content type)',
			async () => {
				const harness = await getHarness()
				// Persist one file because backups only include files already on disk
				await harness.jsonStore.put(harness.store.settings, {
					zwave: {},
				})

				const res = await bufferResponse(
					harness.request.get('/api/store/backup'),
				)

				expect(res.status).toBe(200)
				expect(res.headers['content-type']).toMatch(/application\/json/)
				// PK\x03\x04 is the ZIP local-file-header signature, proving the body is a real archive
				expect(
					(res.body as Buffer).subarray(0, 4).toString('hex'),
				).toBe('504b0304')
			},
		)
	})

	describe('POST /api/store/upload', () => {
		it('rejects with "No file uploaded" for a request with no multipart body at all', async () => {
			const harness = await getHarness()
			const res = await harness.request.post('/api/store/upload')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'No file uploaded',
			})
		})

		it('rejects with "No file uploaded" for a real multipart request with no file field', async () => {
			const harness = await getHarness()
			const res = await harness.request
				.post('/api/store/upload')
				.field('folder', 'uploads')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'No file uploaded',
			})
		})

		it('saves a simple (non-restore) upload under the given folder', async () => {
			const harness = await getHarness()
			mkdirSync(path.join(getTestStoreDir(), 'uploads'), {
				recursive: true,
			})

			const res = await harness.request
				.post('/api/store/upload')
				.field('folder', 'uploads')
				.attach('upload', Buffer.from('uploaded content'), {
					filename: 'my-file.txt',
					contentType: 'text/plain',
				})

			expect(res.status).toBe(200)
			expect(res.body).toEqual({ success: true })
			expect(
				readFileSync(
					path.join(getTestStoreDir(), 'uploads', 'my-file.txt'),
					'utf8',
				),
			).toBe('uploaded content')
		})

		it('rejects an upload whose destination escapes the store', async () => {
			const harness = await getHarness()
			const res = await harness.request
				.post('/api/store/upload')
				.field('folder', '../../etc')
				.attach('upload', Buffer.from('x'), 'evil.txt')

			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				success: false,
				message: 'Path not allowed',
			})
		})
	})

	describe('GET /api/snippet', () => {
		it('includes every real bundled snippet (loaded via the production loadSnippets() seam), verbatim', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request.get('/api/snippet')

			expect(res.status).toBe(200)
			expect(res.body.success).toBe(true)
			const names = (res.body.data as Array<{ name: string }>).map(
				(s) => s.name,
			)
			expect(names).toEqual(
				expect.arrayContaining(EXPECTED_BUNDLED_SNIPPET_NAMES),
			)
			for (const name of EXPECTED_BUNDLED_SNIPPET_NAMES) {
				const content = readFileSync(
					path.join(BUNDLED_SNIPPETS_DIR, `${name}.js`),
					'utf8',
				)
				expect(res.body.data).toEqual(
					expect.arrayContaining([{ name, content }]),
				)
			}
		})

		it('includes a real snippet written to the isolated on-disk snippets dir', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })

			writeFileSync(
				path.join(getTestStoreDir(), 'snippets', 'my-on-disk.js'),
				'// a real isolated on-disk snippet\n',
			)

			const res = await harness.request.get('/api/snippet')

			expect(res.status).toBe(200)
			expect(res.body.data).toEqual(
				expect.arrayContaining([
					{
						name: 'my-on-disk',
						content: '// a real isolated on-disk snippet\n',
					},
				]),
			)
		})

		it('returns the cached snippets plus bundled and on-disk snippets when a gateway is attached', async () => {
			const gw = createFakeGateway()
			gw.zwave.cacheSnippets = [{ name: 'cached', content: '//x' }]
			const harness = await getHarness({ gateway: gw })

			const res = await harness.request.get('/api/snippet')

			expect(res.status).toBe(200)
			expect(res.body.success).toBe(true)
			expect(res.body.data).toEqual(
				expect.arrayContaining([{ name: 'cached', content: '//x' }]),
			)
		})

		it('returns bundled and on-disk snippets (but no cached ones) when no gateway is attached', async () => {
			const harness = await getHarness()
			const res = await harness.request.get('/api/snippet')

			expect(res.status).toBe(200)
			expect(res.body.success).toBe(true)
			const names = (res.body.data as Array<{ name: string }>).map(
				(s) => s.name,
			)
			expect(names).toEqual(
				expect.arrayContaining(EXPECTED_BUNDLED_SNIPPET_NAMES),
			)
		})

		it('does not duplicate bundled snippets when loadSnippets() runs more than once', async () => {
			const gw = createFakeGateway()
			const harness = await getHarness({ gateway: gw })

			await harness.loadSnippets()
			await harness.loadSnippets()

			const res = await harness.request.get('/api/snippet')
			expect(res.status).toBe(200)

			const names = (res.body.data as Array<{ name: string }>).map(
				(s) => s.name,
			)
			const counts = new Map<string, number>()
			for (const name of names) {
				counts.set(name, (counts.get(name) ?? 0) + 1)
			}
			const duplicated = [...counts.entries()].filter(
				([, count]) => count > 1,
			)
			expect(duplicated).toEqual([])
		})
	})
})
