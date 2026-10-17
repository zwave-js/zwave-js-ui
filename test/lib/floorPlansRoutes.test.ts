import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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
const { default: floorPlans } = await import('../../api/lib/FloorPlans.ts')

// a real 1x1 PNG
const PNG1 = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64',
)
const K = (n: number) => `zwave:cdfbb3c7:${n}`

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

	const upload = (mapId: string, bytes: Buffer, variant?: string) => {
		const form = new FormData()
		form.append('upload', new Blob([bytes]), 'plan.png')
		if (variant) form.append('variant', variant)
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

	it('creates, changes and deletes maps and placements', async () => {
		expect(await api('GET', '')).toMatchObject({
			success: true,
			data: { maps: [], settings: { defaultMapId: null } },
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
		// no Z-Wave client running, so no identity snapshot
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
		const file = set.data.background.image
		expect(file).toMatch(/\.png$/)

		// served like a browser asks for images: */* must not hit the SPA
		const img = await fetch(`${url}/api/floorplans/images/${file}`, {
			headers: { Accept: 'image/avif,image/webp,*/*;q=0.8' },
		})
		expect(img.status).toBe(200)
		expect(img.headers.get('content-type')).toBe('image/png')
		expect(Buffer.from(await img.arrayBuffer())).toEqual(PNG1)

		// only files a background references are served
		await writeFile(join(floorPlans.imagesDir, 'stray.png'), PNG1)
		const stray = await fetch(`${url}/api/floorplans/images/stray.png`)
		expect(stray.status).toBe(404)

		// referenced but missing on disk: JSON 404, not the HTML error page
		const { data: other } = await api('POST', '/maps', { name: 'Shed' })
		const lost = (await upload(other.id, PNG1)).data.background.image
		await rm(join(floorPlans.imagesDir, lost))
		const missing = await fetch(`${url}/api/floorplans/images/${lost}`)
		expect(missing.status).toBe(404)
		expect(await missing.json()).toEqual({
			success: false,
			message: 'No such image',
		})
		await api('DELETE', `/maps/${other.id}`)

		const svg = await upload(map.id, Buffer.from('<svg/>'), 'dark')
		expect(svg).toMatchObject({ success: false })

		expect((await api('GET', '/orphans')).data).toEqual([
			{ name: 'stray.png', size: PNG1.length },
		])
		expect(
			(await api('DELETE', '/orphans', { names: ['stray.png', file] }))
				.data,
		).toEqual(['stray.png'])

		const removed = await api('DELETE', `/maps/${map.id}/image`)
		expect(removed.data.background).toBeNull()
		const gone = await fetch(`${url}/api/floorplans/images/${file}`)
		expect(gone.status).toBe(404)
	})

	it('requires login when auth is enabled', async () => {
		await setAuth(true)
		try {
			expect(await api('GET', '')).toMatchObject({
				success: false,
				code: 3,
			})
			const img = await fetch(`${url}/api/floorplans/images/x.png`, {
				headers: { Accept: 'application/json' },
			})
			expect(await img.json()).toMatchObject({ code: 3 })
		} finally {
			await setAuth(false)
		}
	})
})
