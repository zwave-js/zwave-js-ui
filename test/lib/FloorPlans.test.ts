import { describe, it, expect, vi } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import * as fsp from 'node:fs/promises'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { FloorPlans, imageSize, sniffImage } from '../../api/lib/FloorPlans.ts'

vi.mock('node:fs/promises', async (importOriginal) => {
	const real: typeof fsp = await importOriginal()
	return { ...real, rename: vi.fn(real.rename) }
})

// a real 1x1 PNG (header readable) and a header-only PNG (size unknown)
const PNG1 = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64',
)
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
const WEBP = Buffer.concat([
	Buffer.from('RIFF'),
	Buffer.alloc(4),
	Buffer.from('WEBP'),
])
const SVG = Buffer.from(
	'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
)

const fresh = async () =>
	new FloorPlans(await mkdtemp(path.join(tmpdir(), 'floorplans-')))
const K = (n: number) => `zwave:cdfbb3c7:${n}`
const images = (fp: FloorPlans) =>
	existsSync(fp.imagesDir) ? readdirSync(fp.imagesDir).sort() : []
const mapOf = async (fp: FloorPlans, id: string) =>
	(await fp.load()).maps.find((m) => m.id === id)

describe('#FloorPlans', () => {
	it('recognizes only PNG, JPEG and WebP (never SVG) and reads sizes from the header', () => {
		expect(sniffImage(PNG).ext).toBe('png')
		expect(sniffImage(JPEG).ext).toBe('jpg')
		expect(sniffImage(WEBP).ext).toBe('webp')
		expect(sniffImage(SVG)).toBeNull()
		expect(imageSize(PNG1)).toEqual({ w: 1, h: 1 })
		expect(imageSize(PNG)).toBeNull()
		// minimal JPEG: SOI, SOF0 with 40x30
		const jpg = Buffer.from([
			0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x1e, 0x00, 0x28,
			0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		])
		expect(imageSize(jpg)).toEqual({ w: 40, h: 30 })
	})

	it('starts empty, with the graph as the default view', async () => {
		const fp = await fresh()
		expect(await fp.load()).toEqual({
			version: 1,
			settings: { defaultMapId: null },
			maps: [],
		})
	})

	it('refuses a newer version without overwriting it', async () => {
		const fp = await fresh()
		await mkdir(fp.dir, { recursive: true })
		const other = JSON.stringify({ version: 99, maps: [] })
		await writeFile(fp.file, other)
		await expect(fp.load()).rejects.toThrow('version 99')
		await expect(fp.addMap({ name: 'X' })).rejects.toThrow('version 99')
		expect(await readFile(fp.file, 'utf8')).toBe(other)
	})

	it('names the file when it is not valid JSON', async () => {
		const fp = await fresh()
		await mkdir(fp.dir, { recursive: true })
		await writeFile(fp.file, '{ nope')
		await expect(fp.load()).rejects.toThrow(fp.file)
	})

	it('creates, renames, filters, saves the view of and deletes maps', async () => {
		const fp = await fresh()
		const m = await fp.addMap({ name: 'Workshop' })
		expect([m.widthPx, m.heightPx, m.background]).toEqual([
			3000,
			2000,
			null,
		])

		const r = await fp.updateMap(m.id, {
			name: 'Workshop sketch',
			nodes: { start: 'exclude', exceptions: [K(58), K(58)] },
			view: {
				center: [1, 2],
				zoom: -1,
				layers: { neighbors: false, bogus: true } as any,
			},
		})
		expect(r.name).toBe('Workshop sketch')
		// exceptions de-duplicated
		expect(r.nodes).toEqual({ start: 'exclude', exceptions: [K(58)] })
		expect(r.view).toEqual({
			center: [1, 2],
			zoom: -1,
			layers: {
				routes: true,
				backupRoutes: false,
				neighbors: false,
				nodes: true,
				health: true,
				battery: false,
				names: true,
			},
		})
		await expect(
			fp.updateMap(m.id, { nodes: { start: 'some' } as any }),
		).rejects.toThrow('nodes.start')
		await expect(fp.updateMap(m.id, { widthPx: 0 })).rejects.toThrow(
			'1-20000',
		)

		await fp.updateSettings({ defaultMapId: m.id })
		await expect(
			fp.updateSettings({ defaultMapId: 'nope' }),
		).rejects.toThrow('No such map')
		await fp.deleteMap(m.id)
		const data = await fp.load()
		expect(data.maps).toEqual([])
		// deleting the default falls back to the graph
		expect(data.settings.defaultMapId).toBeNull()
	})

	it('keeps positions per map', async () => {
		const fp = await fresh()
		const a = await fp.addMap({
			name: 'House',
			widthPx: 1000,
			heightPx: 1000,
		})
		const b = await fp.addMap({
			name: 'Shop',
			widthPx: 1000,
			heightPx: 1000,
		})
		await fp.setPlacement(a.id, { deviceKey: K(2), x: 10, y: 10 })
		const moved = await fp.setPlacement(a.id, {
			deviceKey: K(2),
			x: 5000,
			y: -5,
			evil: 'x',
		} as any)
		// clamped, one per node per map, unknown fields dropped
		expect(moved).toEqual({ deviceKey: K(2), x: 1000, y: 0 })
		await fp.setPlacement(b.id, { deviceKey: K(2), x: 90, y: 90 })
		await fp.removePlacement(b.id, K(2))
		expect((await mapOf(fp, a.id)).placements).toHaveLength(1)
		expect((await mapOf(fp, b.id)).placements).toHaveLength(0)
		await expect(
			fp.setPlacement(a.id, { deviceKey: '../etc', x: 1, y: 1 }),
		).rejects.toThrow('deviceKey')
		await expect(
			fp.setPlacement('nope', { deviceKey: K(2), x: 1, y: 1 }),
		).rejects.toThrow('No such map')
	})

	it('pulls nodes back onto the canvas when it shrinks', async () => {
		const fp = await fresh()
		const m = await fp.addMap({ name: 'p', widthPx: 1000, heightPx: 800 })
		await fp.setPlacements(m.id, [
			{ deviceKey: K(2), x: 900, y: 700 },
			{ deviceKey: K(3), x: 100, y: 100 },
		])
		const r = await fp.updateMap(m.id, { widthPx: 500, heightPx: 400 })
		expect(r.placements).toEqual([
			{ deviceKey: K(2), x: 500, y: 400 },
			{ deviceKey: K(3), x: 100, y: 100 },
		])
	})

	it('sizes, replaces and unsets backgrounds', async () => {
		const fp = await fresh()
		const a = await fp.addMap({ name: 'House' })
		const set = await fp.setMapImage(a.id, { bytes: PNG1 })
		// canvas takes the image size when nothing is placed yet
		expect([set.map.widthPx, set.map.heightPx]).toEqual([1, 1])
		expect(set.map.background.imageRect).toEqual({ x: 0, y: 0, w: 1, h: 1 })
		expect(set.stretched).toBe(false)
		const first = set.map.background.image
		expect(first.startsWith(`${a.id}-`)).toBe(true)

		await fp.updateMap(a.id, { widthPx: 3000, heightPx: 5100 })
		await fp.setPlacement(a.id, { deviceKey: K(2), x: 2000, y: 3000 })
		const dark = await fp.setMapImage(a.id, {
			bytes: PNG,
			imgWidthPx: 1,
			imgHeightPx: 1,
			dark: true,
		})
		expect(dark.map.background.image).toBe(first)
		expect(dark.map.background.darkImage.startsWith(`${a.id}-dark-`)).toBe(
			true,
		)

		const replaced = await fp.setMapImage(a.id, { bytes: PNG1 })
		expect(replaced.map.background.image).not.toBe(first)
		expect(existsSync(path.join(fp.imagesDir, first))).toBe(false)
		// the frame stays where it was
		expect(replaced.map.background.imageRect).toEqual({
			x: 0,
			y: 0,
			w: 1,
			h: 1,
		})
		expect(images(fp)).toHaveLength(2)

		await fp.removeMapImage(a.id, { dark: true })
		expect((await mapOf(fp, a.id)).background.darkImage).toBeNull()
		expect(images(fp)).toEqual([replaced.map.background.image])

		// the background goes with its last picture
		await fp.removeMapImage(a.id)
		const house = await mapOf(fp, a.id)
		expect(house.background).toBeNull()
		// placements survive unsetting the background
		expect(house.placements).toHaveLength(1)
		expect(images(fp)).toEqual([])

		await expect(
			fp.setMapImage(a.id, { bytes: SVG, imgWidthPx: 1, imgHeightPx: 1 }),
		).rejects.toThrow('PNG, JPEG or WebP')
		await expect(fp.setMapImage(a.id, { bytes: PNG })).rejects.toThrow(
			'size',
		)
	})

	it('starts a background from a dark theme picture alone', async () => {
		const fp = await fresh()
		const m = await fp.addMap({ name: 'House' })
		const set = await fp.setMapImage(m.id, { bytes: PNG1, dark: true })
		expect(set.map.background).toEqual({
			image: null,
			darkImage: expect.stringMatching(new RegExp(`^${m.id}-dark-`)),
			imageRect: { x: 0, y: 0, w: 1, h: 1 },
		})
		expect([set.map.widthPx, set.map.heightPx]).toEqual([1, 1])

		const both = await fp.setMapImage(m.id, { bytes: PNG1 })
		expect(both.map.background.image).toBeTruthy()
		// removing one picture keeps the other
		await fp.removeMapImage(m.id)
		const left = (await mapOf(fp, m.id)).background
		expect(left.image).toBeNull()
		expect(images(fp)).toEqual([left.darkImage])
		await fp.removeMapImage(m.id, { dark: true })
		expect((await mapOf(fp, m.id)).background).toBeNull()
		expect(images(fp)).toEqual([])
	})

	it('deletes a map with its pictures', async () => {
		const fp = await fresh()
		const a = await fp.addMap({ name: 'House' })
		const b = await fp.addMap({ name: 'Shop' })
		await fp.setMapImage(a.id, { bytes: PNG1 })
		await fp.setMapImage(a.id, { bytes: PNG1, dark: true })
		const kept = await fp.setMapImage(b.id, { bytes: PNG1 })
		await fp.deleteMap(a.id)
		expect(images(fp)).toEqual([kept.map.background.image])
	})

	it('keeps the old picture and drops the new one when maps.json cannot be written', async () => {
		const fp = await fresh()
		const m = await fp.addMap({ name: 'House' })
		const set = await fp.setMapImage(m.id, { bytes: PNG1 })
		const old = set.map.background.image

		// the image write renames first, then maps.json: fail the second
		const real = vi.mocked(fsp.rename).getMockImplementation()
		vi.mocked(fsp.rename).mockImplementation(async (from, to) => {
			if (String(to) === fp.file) throw Error('ENOSPC')
			return real(from, to)
		})
		try {
			await expect(fp.setMapImage(m.id, { bytes: PNG1 })).rejects.toThrow(
				'ENOSPC',
			)
		} finally {
			vi.mocked(fsp.rename).mockImplementation(real)
		}
		expect((await mapOf(fp, m.id)).background.image).toBe(old)
		expect(images(fp)).toEqual([old])
	})

	it('keeps all concurrent placements', async () => {
		const fp = await fresh()
		const m = await fp.addMap({ name: 'p', widthPx: 100, heightPx: 100 })
		await Promise.all(
			[2, 3, 4, 5, 6].map((id) =>
				fp.setPlacement(m.id, { deviceKey: K(id), x: id, y: id }),
			),
		)
		expect((await mapOf(fp, m.id)).placements).toHaveLength(5)
	})

	it('places several nodes in one write, moving existing ones', async () => {
		const fp = await fresh()
		const m = await fp.addMap({ name: 'p', widthPx: 100, heightPx: 100 })
		await fp.setPlacement(m.id, { deviceKey: K(2), x: 1, y: 1 })
		const out = await fp.setPlacements(m.id, [
			{ deviceKey: K(2), x: 5, y: 5 },
			{ deviceKey: K(3), x: 500, y: 6 },
		])
		expect(out).toEqual([
			{ deviceKey: K(2), x: 5, y: 5 },
			{ deviceKey: K(3), x: 100, y: 6 },
		])
		expect((await mapOf(fp, m.id)).placements).toHaveLength(2)
		// all or nothing
		await expect(
			fp.setPlacements(m.id, [
				{ deviceKey: K(4), x: 1, y: 1 },
				{ deviceKey: 'bogus', x: 1, y: 1 },
			]),
		).rejects.toThrow('deviceKey')
		expect((await mapOf(fp, m.id)).placements).toHaveLength(2)
	})
})
