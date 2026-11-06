import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import type { Server as HttpServer } from 'node:http'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Set before the app config module loads
const testStoreDir = await mkdtemp(join(tmpdir(), 'zui-floorplans-'))
process.env.STORE_DIR = testStoreDir

const { default: jsonStore } = await import('../../api/lib/jsonStore.ts')
const { default: storeConfig } = await import('../../api/config/store.ts')
const { default: app } = await import('../../api/app.ts')
const { default: floorPlans, MAX_IMAGE_BYTES } = await import(
	'../../api/lib/FloorPlans.ts'
)

// a real 1x1 PNG
const PNG1 = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64',
)
const K = (n: number) => `zwave:cdfbb3c7:${n}`

/** Compression method of each entry in a zip, from its local headers (0 = stored) */
function zipMethods(zip: Buffer) {
	const out: Record<string, number> = {}
	for (let i = zip.indexOf('PK\x03\x04'); i >= 0; ) {
		const nameLen = zip.readUInt16LE(i + 26)
		const name = zip.toString('utf8', i + 30, i + 30 + nameLen)
		out[name] = zip.readUInt16LE(i + 8)
		i = zip.indexOf('PK\x03\x04', i + 30 + nameLen)
	}
	return out
}

describe('floorplans API', () => {
	let server: HttpServer
	let url: string

	// The history API fallback rewrites GETs that accept */* to the index
	// page, so ask for JSON explicitly like the UI does
	const api = async (method: string, path: string, body?: unknown) => {
		const res = await fetch(`${url}/api/floorplans${path}`, {
			method,
			headers: {
				Accept: 'application/json',
				...(body !== undefined
					? { 'Content-Type': 'application/json' }
					: {}),
			},
			body: body !== undefined ? JSON.stringify(body) : undefined,
		})
		return res.json()
	}

	const upload = (
		mapId: string,
		bytes: Buffer | null,
		{ dark = false, field = 'upload', fit = '' } = {},
	) => {
		const form = new FormData()
		if (bytes) form.append(field, new Blob([bytes]), 'plan.png')
		if (dark) form.append('dark', 'true')
		if (fit) form.append('fit', fit)
		return fetch(`${url}/api/floorplans/maps/${mapId}/image`, {
			method: 'PUT',
			headers: { Accept: 'application/json' },
			body: form,
		}).then((res) => res.json())
	}

	const setAuth = async (authEnabled: boolean) => {
		const settings = jsonStore.get(storeConfig.settings) ?? {}
		await jsonStore.put(storeConfig.settings, {
			...settings,
			gateway: { ...settings.gateway, authEnabled },
		})
	}

	beforeAll(async () => {
		await jsonStore.init(storeConfig)
		await setAuth(false)
		server = createServer(app)
		await new Promise<void>((resolve) =>
			server.listen(0, '127.0.0.1', resolve),
		)
		url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
	})

	afterAll(async () => {
		await new Promise((resolve) => server?.close(resolve))
		await rm(testStoreDir, { recursive: true, force: true })
	})

	// the history fallback takes requests without application/json, like the UI's axios
	const backup = async (query = '') => {
		const res = await fetch(`${url}/api/store/backup${query}`, {
			headers: { Accept: 'application/json, text/plain, */*' },
		})
		expect(res.status).toBe(200)
		return Buffer.from(await res.arrayBuffer())
	}

	const restore = async (zip: Buffer) => {
		const form = new FormData()
		form.append('restore', 'true')
		form.append('upload', new Blob([zip]), 'backup.zip')
		return fetch(`${url}/api/store/upload`, {
			method: 'POST',
			headers: { Accept: 'application/json' },
			body: form,
		}).then((res) => res.json())
	}

	it('backs up a store that has no floorplans yet', async () => {
		expect(existsSync(floorPlans.dir)).toBe(false)
		const names = Object.keys(zipMethods(await backup()))
		expect(names).toContain('settings.json')
		expect(names.some((n) => n.startsWith('floorplans/'))).toBe(false)
	})

	it('creates, changes and deletes maps and placements', async () => {
		expect(await api('GET', '')).toMatchObject({
			success: true,
			data: {
				maps: [],
				settings: { defaultMapId: null },
				limits: { maxImageBytes: 25 * 1024 * 1024 },
			},
		})

		const created = await api('POST', '/maps', { name: 'House' })
		expect(created.success).toBe(true)
		const id = created.data.id

		const renamed = await api('PATCH', `/maps/${id}`, { name: 'Home' })
		expect(renamed.data.name).toBe('Home')
		expect(
			(await api('PATCH', '/settings', { defaultMapId: id })).data,
		).toEqual({ defaultMapId: id })

		const placed = await api('PUT', `/maps/${id}/placements`, {
			deviceKey: K(2),
			x: 10,
			y: 20,
		})
		expect(placed.data).toEqual({ deviceKey: K(2), x: 10, y: 20 })
		expect(
			await api('PUT', `/maps/${id}/placements`, {
				deviceKey: 'bogus',
				x: 1,
				y: 1,
			}),
		).toMatchObject({ success: false, message: expect.any(String) })

		await api('DELETE', `/maps/${id}/placements/${K(2)}`)
		expect((await api('GET', '')).data.maps[0].placements).toEqual([])

		// several in one request
		const many = await api('PUT', `/maps/${id}/placements`, {
			placements: [
				{ deviceKey: K(3), x: 1, y: 2 },
				{ deviceKey: K(4), x: 3, y: 4 },
			],
		})
		expect(many.data).toHaveLength(2)
		expect(
			await api('PUT', `/maps/${id}/placements`, { placements: 'no' }),
		).toMatchObject({
			success: false,
			message: expect.stringMatching(/^placements must be a list/),
		})
		await api('DELETE', `/maps/${id}/placements/${K(3)}`)
		await api('DELETE', `/maps/${id}/placements/${K(4)}`)

		expect((await api('DELETE', `/maps/${id}`)).success).toBe(true)
		expect(await api('DELETE', `/maps/${id}`)).toEqual({
			success: false,
			message: 'No such map',
		})
	})

	it('uploads, serves and removes background images', async () => {
		const { data: map } = await api('POST', '/maps', { name: 'Shop' })
		const set = await upload(map.id, PNG1)
		expect(set.success).toBe(true)
		const file = set.data.map.background.image
		expect(file).toMatch(/\.png$/)

		// served like a browser asks for images: */* must not hit the SPA
		const img = await fetch(`${url}/api/floorplans/images/${file}`, {
			headers: { Accept: 'image/avif,image/webp,*/*;q=0.8' },
		})
		expect(img.status).toBe(200)
		expect(img.headers.get('content-type')).toBe('image/png')
		expect(Buffer.from(await img.arrayBuffer())).toEqual(PNG1)

		// only files a map references are served
		await writeFile(join(floorPlans.imagesDir, 'stray.png'), PNG1)
		const stray = await fetch(`${url}/api/floorplans/images/stray.png`)
		expect(stray.status).toBe(404)
		const escape = await fetch(
			`${url}/api/floorplans/images/..%2Fmaps.json`,
			{ headers: { Accept: 'application/json' } },
		)
		expect(escape.status).toBe(404)

		// referenced but missing on disk: JSON 404, not the HTML error page
		const { data: other } = await api('POST', '/maps', { name: 'Shed' })
		const lost = (await upload(other.id, PNG1)).data.map.background.image
		await rm(join(floorPlans.imagesDir, lost))
		const missing = await fetch(`${url}/api/floorplans/images/${lost}`)
		expect(missing.status).toBe(404)
		expect(await missing.json()).toEqual({
			success: false,
			message: 'No such image',
		})
		await api('DELETE', `/maps/${other.id}`)

		const dark = await upload(map.id, PNG1, { dark: true })
		expect(dark.data.map.background.darkImage).toMatch(/-dark-.*\.png$/)
		const noDark = await api('DELETE', `/maps/${map.id}/image?dark=true`)
		expect(noDark.data.background).toMatchObject({
			image: file,
			darkImage: null,
		})

		const removed = await api('DELETE', `/maps/${map.id}/image`)
		expect(removed.data.background).toBeNull()
		const gone = await fetch(`${url}/api/floorplans/images/${file}`)
		expect(gone.status).toBe(404)
	})

	it('passes the fit of a new picture through', async () => {
		const { data: map } = await api('POST', '/maps', { name: 'Fit' })
		await api('PUT', `/maps/${map.id}/placements`, {
			deviceKey: 'zwave:cdfbb3c7:2',
			x: 1500,
			y: 1000,
		})
		const set = await upload(map.id, PNG1, { fit: 'scale' })
		expect(set.data.map).toMatchObject({
			widthPx: 1,
			heightPx: 1,
			placements: [{ x: 1, y: 1 }],
		})
	})

	it('refuses bad uploads without hanging', async () => {
		const { data: map } = await api('POST', '/maps', { name: 'Uploads' })
		expect(await upload(map.id, Buffer.from('<svg/>'))).toEqual({
			success: false,
			message: 'Only PNG, JPEG or WebP images are accepted',
		})
		expect(await upload(map.id, null)).toEqual({
			success: false,
			message: 'No file uploaded',
		})
		expect(await upload(map.id, PNG1, { field: 'picture' })).toMatchObject({
			success: false,
		})
		expect(await upload(map.id, PNG1, { fit: 'squash' })).toEqual({
			success: false,
			message: 'fit must be one of stretch, scale, keep',
		})
		const big = Buffer.concat([PNG1, Buffer.alloc(MAX_IMAGE_BYTES)])
		expect(await upload(map.id, big)).toEqual({
			success: false,
			message: 'Image is larger than 25 MB',
		})
		expect(
			(await api('GET', '')).data.maps.find((m) => m.id === map.id)
				.background,
		).toBeNull()
	})

	it('backs up floorplans unless asked not to, and restores them', async () => {
		const { data: map } = await api('POST', '/maps', { name: 'Backed up' })
		const file = (await upload(map.id, PNG1)).data.map.background.image
		await writeFile(join(floorPlans.imagesDir, 'stray.png'), PNG1)

		const zip = await backup()
		const methods = zipMethods(zip)
		expect(methods['floorplans/maps.json']).toBe(8)
		// pictures are stored as they are, unused ones left out
		expect(methods[`floorplans/images/${file}`]).toBe(0)
		expect(methods['floorplans/images/stray.png']).toBeUndefined()

		const without = zipMethods(await backup('?floorPlans=false'))
		expect(Object.keys(without)).toContain('settings.json')
		expect(
			Object.keys(without).some((n) => n.startsWith('floorplans/')),
		).toBe(false)

		// lose everything, then restore: the folder is replaced, not merged
		await api('DELETE', `/maps/${map.id}`)
		await api('POST', '/maps', { name: 'After the backup' })
		expect(await restore(zip)).toEqual({ success: true })
		const { data } = await api('GET', '')
		expect(data.maps.map((m) => m.name)).toContain('Backed up')
		expect(data.maps.map((m) => m.name)).not.toContain('After the backup')
		expect(existsSync(join(floorPlans.imagesDir, 'stray.png'))).toBe(false)
		const img = await fetch(`${url}/api/floorplans/images/${file}`)
		expect(img.status).toBe(200)
		expect(Buffer.from(await img.arrayBuffer())).toEqual(
			await readFile(join(floorPlans.imagesDir, file)),
		)
	})

	it('requires login on every route when auth is enabled', async () => {
		const routes: [string, string][] = [
			['GET', ''],
			['PATCH', '/settings'],
			['POST', '/maps'],
			['PATCH', '/maps/x'],
			['DELETE', '/maps/x'],
			['PUT', '/maps/x/image'],
			['DELETE', '/maps/x/image'],
			['PUT', '/maps/x/placements'],
			['DELETE', `/maps/x/placements/${K(2)}`],
			['GET', '/images/x.png'],
		]
		await setAuth(true)
		try {
			for (const [method, path] of routes) {
				expect(
					await api(method, path),
					`${method} ${path}`,
				).toMatchObject({ success: false, code: 3 })
			}
		} finally {
			await setAuth(false)
		}
	})
})
