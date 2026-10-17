import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
	FloorPlans,
	cleanSeen,
	imageSize,
	sniffImage,
} from '../../api/lib/FloorPlans.ts'

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
			backgrounds: [],
			maps: [],
		})
	})

	it('refuses an unknown version without overwriting it', async () => {
		const fp = await fresh()
		await mkdir(fp.dir, { recursive: true })
		const other = JSON.stringify({ version: 99, maps: [] })
		await writeFile(fp.file, other)
		await expect(fp.load()).rejects.toThrow('version 99')
		await expect(fp.addMap({ name: 'X' })).rejects.toThrow('version 99')
		expect(await readFile(fp.file, 'utf8')).toBe(other)
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
		await expect(fp.updateMap(m.id, { widthPx: 0 })).rejects.toThrow()

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
			seen: { name: 'Lights', deviceId: '29-1-2', evil: 'x' } as any,
		})
		// clamped, one per node per map
		expect(moved).toEqual({
			deviceKey: K(2),
			x: 1000,
			y: 0,
			seen: { name: 'Lights', deviceId: '29-1-2' },
		})
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
		expect(cleanSeen({ name: 5, dsk: 'abc' })).toEqual({ dsk: 'abc' })
	})

	it('sizes, replaces, forks and unsets backgrounds', async () => {
		const fp = await fresh()
		const a = await fp.addMap({ name: 'House' })
		const set = await fp.setMapImage(a.id, { bytes: PNG1 })
		// canvas takes the image size when nothing is placed yet
		expect([set.map.widthPx, set.map.heightPx]).toEqual([1, 1])
		expect(set.map.background.imageRect).toEqual({ x: 0, y: 0, w: 1, h: 1 })
		expect(set.stretched).toBe(false)
		const bgId = set.background.id

		await fp.updateMap(a.id, { widthPx: 3000, heightPx: 5100 })
		await fp.setPlacement(a.id, { deviceKey: K(2), x: 2000, y: 3000 })
		const dark = await fp.setMapImage(a.id, {
			bytes: PNG,
			imgWidthPx: 1,
			imgHeightPx: 1,
			variant: 'dark',
		})
		// an unshared background is updated in place
		expect(dark.background.id).toBe(bgId)
		expect(dark.background.imageDark).toBeTruthy()
		const replaced = await fp.setMapImage(a.id, { bytes: PNG1 })
		expect(replaced.background.image).not.toBe(set.background.image)
		expect(existsSync(path.join(fp.imagesDir, set.background.image))).toBe(
			false,
		)
		expect(replaced.map.background.imageRect).toEqual({
			x: 0,
			y: 0,
			w: 1,
			h: 1,
		})

		// a second map sharing the same background
		const b = await fp.addMap({
			name: 'House (battery)',
			backgroundId: bgId,
		})
		const forked = await fp.setMapImage(b.id, { bytes: PNG1 })
		expect(forked.background.id).not.toBe(bgId)
		const data = await fp.load()
		// the other map keeps its background
		expect(data.maps.find((m) => m.id === a.id).background.id).toBe(bgId)
		const forkBg = data.backgrounds.find(
			(x) => x.id === forked.background.id,
		)
		const origBg = data.backgrounds.find((x) => x.id === bgId)
		// dark image copied, never shared
		expect(forkBg.imageDark).toBeTruthy()
		expect(forkBg.imageDark).not.toBe(origBg.imageDark)

		await fp.removeMapImage(a.id, 'dark')
		expect(
			(await fp.load()).backgrounds.find((x) => x.id === bgId).imageDark,
		).toBeUndefined()
		const before = images(fp).length
		await fp.removeMapImage(a.id)
		const after = await fp.load()
		const house = after.maps.find((m) => m.id === a.id)
		expect(house.background).toBeNull()
		// placements survive unsetting the background
		expect(house.placements).toHaveLength(1)
		expect(after.backgrounds.some((x) => x.id === bgId)).toBe(false)
		expect(images(fp).length).toBeLessThan(before)

		await expect(
			fp.setMapImage(a.id, { bytes: SVG, imgWidthPx: 1, imgHeightPx: 1 }),
		).rejects.toThrow('PNG, JPEG or WebP')
		await expect(fp.setMapImage(a.id, { bytes: PNG })).rejects.toThrow(
			'size',
		)
		await fp.deleteMap(b.id)
		// deleting the last map using a background removes it
		expect((await fp.load()).backgrounds).toEqual([])
	})

	it('frames new maps from a library background and copies positions only on the same background', async () => {
		const fp = await fresh()
		const house = await fp.addMap({
			name: 'House',
			widthPx: 3000,
			heightPx: 5100,
		})
		await fp.setPlacement(house.id, {
			deviceKey: K(2),
			x: 100,
			y: 200,
			seen: { name: 'Lights' },
		})
		// something is placed, so the canvas keeps its size
		await fp.setMapImage(house.id, { bytes: PNG1 })
		await fp.updateMap(house.id, { metersPerPixel: 0.006 })
		const bgId = (await mapOf(fp, house.id)).background.id

		const battery = await fp.addMap({
			name: 'Battery',
			backgroundId: bgId,
			nodes: { start: 'exclude', exceptions: [K(5)] },
		})
		expect([
			battery.widthPx,
			battery.heightPx,
			battery.metersPerPixel,
		]).toEqual([3000, 5100, 0.006])
		expect(battery.background.id).toBe(bgId)
		expect(battery.placements).toEqual([])
		expect(battery.nodes).toEqual({ start: 'exclude', exceptions: [K(5)] })

		const copy = await fp.addMap({
			name: 'Copy',
			backgroundId: bgId,
			copyPositionsFrom: house.id,
		})
		expect(copy.placements).toEqual([
			{ deviceKey: K(2), x: 100, y: 200, seen: { name: 'Lights' } },
		])
		await fp.setPlacement(copy.id, { deviceKey: K(2), x: 5, y: 5 })
		// copies are independent
		expect((await mapOf(fp, house.id)).placements[0].x).toBe(100)
		expect((await fp.load()).backgrounds).toHaveLength(1)

		await expect(
			fp.addMap({ name: 'X', copyPositionsFrom: house.id }),
		).rejects.toThrow('different background')
		await expect(
			fp.addMap({ name: 'X', backgroundId: 'nope' }),
		).rejects.toThrow('No such background')
		const blank = await fp.addMap({
			name: 'Blank',
			widthPx: 800,
			heightPx: 600,
		})
		await fp.setPlacement(blank.id, { deviceKey: K(3), x: 1, y: 2 })
		const blank2 = await fp.addMap({
			name: 'Blank 2',
			copyPositionsFrom: blank.id,
		})
		expect([
			blank2.widthPx,
			blank2.heightPx,
			blank2.background,
			blank2.placements.length,
		]).toEqual([800, 600, null, 1])
	})

	it('links placeholders to a node (taking its spot) or deletes them', async () => {
		const fp = await fresh()
		const m = await fp.addMap({
			name: 'House',
			widthPx: 1000,
			heightPx: 1000,
		})
		await fp.setPlacement(m.id, { deviceKey: K(2), x: 1, y: 2 })
		const raw = await fp.load()
		raw.maps[0].placements.push(
			{
				id: 'ph1',
				deviceKey: null,
				x: 300,
				y: 400,
				placeholder: { name: 'Thermostat' },
			},
			{
				id: 'ph2',
				deviceKey: null,
				x: 5,
				y: 5,
				placeholder: { name: 'Gone' },
			},
		)
		await writeFile(fp.file, JSON.stringify(raw))

		const linked = await fp.linkPlaceholder(m.id, 'ph1', K(2), {
			name: 'Lights',
		})
		expect(linked).toEqual({
			deviceKey: K(2),
			x: 300,
			y: 400,
			seen: { name: 'Lights' },
		})
		let pls = (await mapOf(fp, m.id)).placements
		// the node's old spot is replaced
		expect(pls.filter((p) => p.deviceKey === K(2))).toHaveLength(1)
		await expect(fp.linkPlaceholder(m.id, 'ph1', K(2))).rejects.toThrow(
			'No such placeholder',
		)
		await fp.removePlaceholder(m.id, 'ph2')
		pls = (await mapOf(fp, m.id)).placements
		expect(pls).toHaveLength(1)
		await expect(fp.removePlaceholder(m.id, 'ph2')).rejects.toThrow(
			'No such placeholder',
		)
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
			{ deviceKey: K(3), x: 500, y: 6, seen: { name: 'Lamp' } },
		])
		expect(out).toEqual([
			{ deviceKey: K(2), x: 5, y: 5 },
			{ deviceKey: K(3), x: 100, y: 6, seen: { name: 'Lamp' } },
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

	it('lists unreferenced images and deletes only the named ones still unreferenced', async () => {
		const fp = await fresh()
		expect(await fp.findOrphans()).toEqual([])
		const m = await fp.addMap({ name: 'House' })
		const { background } = await fp.setMapImage(m.id, { bytes: PNG1 })
		// files a restore could leave behind, plus an in-flight write
		await writeFile(path.join(fp.imagesDir, 'old-a.png'), PNG1)
		await writeFile(path.join(fp.imagesDir, 'old-b.png'), 'xy')
		await writeFile(path.join(fp.imagesDir, 'x.png.1.2.tmp'), 'z')

		const found = await fp.findOrphans()
		expect(found).toEqual(
			expect.arrayContaining([
				{ name: 'old-a.png', size: PNG1.length },
				{ name: 'old-b.png', size: 2 },
			]),
		)
		expect(found).toHaveLength(2)

		// a referenced file is never deleted, even when named
		const deleted = await fp.deleteOrphans(['old-a.png', background.image])
		expect(deleted).toEqual(['old-a.png'])
		expect(images(fp)).toEqual(
			[background.image, 'old-b.png', 'x.png.1.2.tmp'].sort(),
		)
	})
})
