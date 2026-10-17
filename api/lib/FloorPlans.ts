// Floor-plan maps shown by the Network Graph's map mode.
//
// Stored in <store>/floorplans/: maps.json holds settings, the background
// library and the maps (each with its own node positions), images/ holds the
// background pictures. Positions are canvas pixels: x right, y down, origin at
// the canvas's top-left. An image file belongs to exactly one background, so
// deleting a background can never break another.

import { randomBytes } from 'node:crypto'
import {
	copyFile,
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	stat,
	writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { floorPlansDir } from '../config/app.ts'
import type { ParsedImport } from './FloorPlanExchange.ts'
import { module } from './logger.ts'

const logger = module('FloorPlans')

export const VERSION = 1
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_DIMENSION = 20000
const MAX_EXCEPTIONS = 5000

export const DEVICE_KEY = /^zwave:[0-9a-f]+:\d+$/

export type Variant = 'light' | 'dark'
const VARIANTS: Record<Variant, 'image' | 'imageDark'> = {
	light: 'image',
	dark: 'imageDark',
}

export const DEFAULT_LAYERS = {
	routes: true,
	backupRoutes: false,
	neighbors: true,
	nodes: true,
	health: true,
	battery: false,
	names: true,
}
export type Layers = typeof DEFAULT_LAYERS

export interface Rect {
	x: number
	y: number
	w: number
	h: number
}

export interface Background {
	id: string
	name: string
	image: string | null
	imageDark?: string
	widthPx: number
	heightPx: number
}

/** Identity snapshot taken when a node is placed, used to repair links after a re-inclusion */
export interface Seen {
	name?: string
	deviceId?: string
	dsk?: string
}

export interface PlaceholderInfo {
	name?: string
	loc?: string
	deviceId?: string
	productLabel?: string
}

/** A placed node, or a placeholder (an imported position whose node wasn't matched) */
export interface Placement {
	deviceKey: string | null
	x: number
	y: number
	seen?: Seen
	id?: string
	placeholder?: PlaceholderInfo
}

export interface NodeFilter {
	start: 'include' | 'exclude'
	exceptions: string[]
}

export interface MapView {
	center: [number, number] | null
	zoom: number | null
	layers: Layers
}

export interface FloorPlanMap {
	id: string
	name: string
	widthPx: number
	heightPx: number
	metersPerPixel: number | null
	background: { id: string; imageRect: Rect } | null
	nodes: NodeFilter
	view: MapView
	placements: Placement[]
}

export interface FloorPlansData {
	version: number
	settings: { defaultMapId: string | null }
	backgrounds: Background[]
	maps: FloorPlanMap[]
}

export interface ImageFile {
	name: string
	size: number
}

const empty = (): FloorPlansData => ({
	version: VERSION,
	settings: { defaultMapId: null },
	backgrounds: [],
	maps: [],
})

const isDim = (n: unknown): n is number =>
	Number.isInteger(n) && (n as number) > 0 && (n as number) <= MAX_DIMENSION
const isCoord = (n: unknown): n is number =>
	typeof n === 'number' && Number.isFinite(n)
const newId = (bytes = 4) => randomBytes(bytes).toString('hex')
const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max)

function checkDeviceKey(key: unknown): asserts key is string {
	if (typeof key !== 'string' || !DEVICE_KEY.test(key)) {
		throw Error('deviceKey must look like zwave:<homeId>:<nodeId>')
	}
}

/**
 * Identify an image by its first bytes. Raster formats only: SVG is refused
 * because it can carry script and these images are served from our origin.
 */
export function sniffImage(buf: Buffer): { ext: string; type: string } | null {
	if (
		buf.length >= 8 &&
		buf
			.subarray(0, 8)
			.equals(
				Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
			)
	) {
		return { ext: 'png', type: 'image/png' }
	}
	if (
		buf.length >= 3 &&
		buf[0] === 0xff &&
		buf[1] === 0xd8 &&
		buf[2] === 0xff
	) {
		return { ext: 'jpg', type: 'image/jpeg' }
	}
	if (
		buf.length >= 12 &&
		buf.toString('ascii', 0, 4) === 'RIFF' &&
		buf.toString('ascii', 8, 12) === 'WEBP'
	) {
		return { ext: 'webp', type: 'image/webp' }
	}
	return null
}

/** Pixel size read from a PNG, JPEG or WebP header, or null if it can't be read */
export function imageSize(buf: Buffer): { w: number; h: number } | null {
	try {
		const kind = sniffImage(buf)?.ext
		if (kind === 'png' && buf.length >= 24) {
			return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
		}
		if (kind === 'jpg') {
			for (let i = 2; i + 9 < buf.length; ) {
				if (buf[i] !== 0xff) return null
				const marker = buf[i + 1]
				// SOFn markers carry the frame size (C4, C8 and CC are not SOF)
				if (
					marker >= 0xc0 &&
					marker <= 0xcf &&
					![0xc4, 0xc8, 0xcc].includes(marker)
				) {
					return {
						w: buf.readUInt16BE(i + 7),
						h: buf.readUInt16BE(i + 5),
					}
				}
				i += 2 + buf.readUInt16BE(i + 2)
			}
		}
		if (kind === 'webp' && buf.length >= 30) {
			const chunk = buf.toString('ascii', 12, 16)
			if (chunk === 'VP8 ') {
				return {
					w: buf.readUInt16LE(26) & 0x3fff,
					h: buf.readUInt16LE(28) & 0x3fff,
				}
			}
			if (chunk === 'VP8L') {
				const b = buf.readUInt32LE(21)
				return { w: (b & 0x3fff) + 1, h: ((b >>> 14) & 0x3fff) + 1 }
			}
			if (chunk === 'VP8X') {
				return {
					w: buf.readUIntLE(24, 3) + 1,
					h: buf.readUIntLE(27, 3) + 1,
				}
			}
		}
	} catch {
		// truncated or unusual header
	}
	return null
}

/** Keep only the identity fields a placement snapshot carries */
export function cleanSeen(seen: unknown): Seen {
	const out: Seen = {}
	for (const k of ['name', 'deviceId', 'dsk'] as const) {
		const v = (seen as Seen)?.[k]
		if (typeof v === 'string' && v) out[k] = v.slice(0, 200)
	}
	return out
}

export function checkNodes(nodes: unknown): NodeFilter {
	const n = nodes as NodeFilter
	if (!n || !['include', 'exclude'].includes(n.start)) {
		throw Error("nodes.start must be 'include' or 'exclude'")
	}
	const ex = n.exceptions ?? []
	if (
		!Array.isArray(ex) ||
		ex.length > MAX_EXCEPTIONS ||
		!ex.every((k) => typeof k === 'string' && DEVICE_KEY.test(k))
	) {
		throw Error('nodes.exceptions must be a list of device keys')
	}
	return { start: n.start, exceptions: [...new Set(ex)] }
}

/** Sanitize a saved view; unknown or invalid fields fall back to defaults */
export function checkView(view: unknown): MapView {
	const v = view as Partial<MapView>
	const out: MapView = {
		center: null,
		zoom: null,
		layers: { ...DEFAULT_LAYERS },
	}
	if (
		Array.isArray(v?.center) &&
		v.center.length === 2 &&
		v.center.every(isCoord)
	) {
		out.center = [v.center[0], v.center[1]]
	}
	if (isCoord(v?.zoom)) out.zoom = v.zoom
	for (const k of Object.keys(DEFAULT_LAYERS) as (keyof Layers)[]) {
		if (typeof v?.layers?.[k] === 'boolean') out.layers[k] = v.layers[k]
	}
	return out
}

/** Write a file atomically: temp file in the same dir, then rename over the target */
async function writeAtomic(file: string, data: string | Buffer) {
	await mkdir(path.dirname(file), { recursive: true })
	const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
	try {
		await writeFile(tmp, data)
		await rename(tmp, file)
	} catch (error) {
		await rm(tmp, { force: true })
		throw error
	}
}

export interface AddMapOptions {
	name?: string
	widthPx?: number
	heightPx?: number
	nodes?: NodeFilter
	/** Start on a library background */
	backgroundId?: string | null
	/** Copy canvas, framing and positions once from a map on the same background */
	copyPositionsFrom?: string | null
}

export interface MapChanges {
	name?: string
	nodes?: NodeFilter
	view?: MapView
	metersPerPixel?: number | null
	widthPx?: number
	heightPx?: number
}

export class FloorPlans {
	readonly dir: string
	readonly file: string
	readonly imagesDir: string
	private queue: Promise<unknown> = Promise.resolve()

	constructor(dir: string) {
		this.dir = dir
		this.file = path.join(dir, 'maps.json')
		this.imagesDir = path.join(dir, 'images')
	}

	/**
	 * Read the data from disk on every call (no cache), so a store restore
	 * takes effect at once. An empty store has no maps.
	 */
	async load(): Promise<FloorPlansData> {
		let raw: FloorPlansData
		try {
			raw = JSON.parse(await readFile(this.file, 'utf8'))
		} catch (error) {
			if (error.code === 'ENOENT') return empty()
			throw error
		}
		if (raw.version !== VERSION) {
			throw Error(
				`maps.json is version ${raw.version}, expected ${VERSION}`,
			)
		}
		return raw
	}

	/** Run read-modify-write steps one at a time so concurrent requests can't lose updates */
	private update<T>(fn: (data: FloorPlansData) => T | Promise<T>) {
		const run = this.queue.then(async () => {
			const data = await this.load()
			const result = await fn(data)
			await writeAtomic(this.file, JSON.stringify(data, null, 2))
			return result
		})
		this.queue = run.catch(() => {})
		return run
	}

	/** Path of a background's image file, or null if it has no such variant */
	imagePath(bg: Background, variant: Variant = 'light'): string | null {
		const file = bg[VARIANTS[variant]]
		return file ? path.join(this.imagesDir, file) : null
	}

	private getMap(data: FloorPlansData, id: string) {
		const map = data.maps.find((m) => m.id === id)
		if (!map) throw Error('No such map')
		return map
	}

	/** Delete backgrounds no map uses, with their image files */
	private async collect(data: FloorPlansData) {
		const used = new Set(
			data.maps.map((m) => m.background?.id).filter(Boolean),
		)
		for (const bg of data.backgrounds.filter((b) => !used.has(b.id))) {
			for (const field of Object.values(VARIANTS)) {
				if (bg[field]) {
					await rm(path.join(this.imagesDir, bg[field]), {
						force: true,
					})
				}
			}
		}
		data.backgrounds = data.backgrounds.filter((b) => used.has(b.id))
	}

	private async writeImage(prefix: string, bytes: Buffer) {
		const kind = sniffImage(bytes)
		if (!kind) throw Error('Only PNG, JPEG or WebP images are accepted')
		if (bytes.length > MAX_IMAGE_BYTES) {
			throw Error('Image is larger than 25 MB')
		}
		// a new name each time busts browser caches
		const name = `${prefix}-${newId(3)}.${kind.ext}`
		await writeAtomic(path.join(this.imagesDir, name), bytes)
		return name
	}

	/**
	 * Give `map` its own copy of a background other maps also use, so a
	 * change to it doesn't reach them. Image files are copied, never shared,
	 * except `skipField`, which the caller is about to replace or drop.
	 */
	private async fork(
		data: FloorPlansData,
		map: FloorPlanMap,
		bg: Background,
		skipField: 'image' | 'imageDark',
	) {
		const copy: Background = { ...bg, id: `bg-${newId()}` }
		for (const field of Object.values(VARIANTS)) {
			if (!bg[field]) continue
			if (field === skipField) {
				if (field === 'image') copy.image = null
				else delete copy.imageDark
				continue
			}
			const suffix = field === 'imageDark' ? '-dark' : ''
			const name = `${copy.id}${suffix}-${newId(3)}${path.extname(bg[field])}`
			await copyFile(
				path.join(this.imagesDir, bg[field]),
				path.join(this.imagesDir, name),
			)
			copy[field] = name
		}
		data.backgrounds.push(copy)
		map.background = { ...map.background, id: copy.id }
		return copy
	}

	// ------------------------------------------------------------- maps

	async addMap({
		name,
		widthPx = 3000,
		heightPx = 2000,
		nodes = { start: 'include', exceptions: [] },
		backgroundId = null,
		copyPositionsFrom = null,
	}: AddMapOptions = {}) {
		if (!isDim(widthPx) || !isDim(heightPx)) {
			throw Error('widthPx/heightPx must be whole numbers 1-20000')
		}
		const checked = checkNodes(nodes)
		return this.update((data) => {
			const map: FloorPlanMap = {
				id: newId(),
				name: String(name || 'Map').slice(0, 100),
				widthPx,
				heightPx,
				metersPerPixel: null,
				background: null,
				nodes: checked,
				view: checkView(null),
				placements: [],
			}
			const bg =
				backgroundId == null
					? null
					: data.backgrounds.find((b) => b.id === backgroundId)
			if (backgroundId != null && !bg) throw Error('No such background')

			let from: FloorPlanMap | null = null
			if (copyPositionsFrom != null) {
				from = this.getMap(data, copyPositionsFrom)
				if ((from.background?.id ?? null) !== (bg?.id ?? null)) {
					throw Error(
						`${from.name} uses a different background, positions can only be copied between maps on the same background`,
					)
				}
			}

			// framing: the map we copy from, else another map on this
			// background, else the picture's own size
			const frame =
				from ??
				(bg && data.maps.find((m) => m.background?.id === bg.id))
			if (frame) {
				map.widthPx = frame.widthPx
				map.heightPx = frame.heightPx
				map.metersPerPixel = frame.metersPerPixel ?? null
				if (bg) {
					map.background = {
						id: bg.id,
						imageRect: { ...frame.background.imageRect },
					}
				}
			} else if (bg) {
				map.widthPx = bg.widthPx
				map.heightPx = bg.heightPx
				map.background = {
					id: bg.id,
					imageRect: { x: 0, y: 0, w: bg.widthPx, h: bg.heightPx },
				}
			}
			if (from) {
				map.placements = from.placements
					.filter((p) => p.deviceKey)
					.map((p) => structuredClone(p))
			}
			data.maps.push(map)
			return map
		})
	}

	/**
	 * Change a map. Growing the canvas keeps positions (they are measured
	 * from the top-left) and the background's frame.
	 */
	async updateMap(id: string, changes: MapChanges = {}) {
		const c = changes
		if (c.widthPx !== undefined && !isDim(c.widthPx)) {
			throw Error('widthPx must be a whole number 1-20000')
		}
		if (c.heightPx !== undefined && !isDim(c.heightPx)) {
			throw Error('heightPx must be a whole number 1-20000')
		}
		if (
			c.metersPerPixel !== undefined &&
			c.metersPerPixel !== null &&
			!(
				typeof c.metersPerPixel === 'number' &&
				c.metersPerPixel > 0 &&
				c.metersPerPixel < 100
			)
		) {
			throw Error('metersPerPixel must be a positive number or null')
		}
		const nodes = c.nodes !== undefined ? checkNodes(c.nodes) : undefined
		const view = c.view !== undefined ? checkView(c.view) : undefined
		return this.update((data) => {
			const map = this.getMap(data, id)
			if (c.name !== undefined) {
				map.name = String(c.name || map.name).slice(0, 100)
			}
			if (nodes) map.nodes = nodes
			if (view) map.view = view
			if (c.widthPx !== undefined) map.widthPx = c.widthPx
			if (c.heightPx !== undefined) map.heightPx = c.heightPx
			if (c.metersPerPixel !== undefined) {
				map.metersPerPixel = c.metersPerPixel
			}
			return map
		})
	}

	async deleteMap(id: string) {
		return this.update(async (data) => {
			const map = this.getMap(data, id)
			data.maps = data.maps.filter((m) => m.id !== id)
			if (data.settings.defaultMapId === id) {
				data.settings.defaultMapId = null
			}
			await this.collect(data)
			return map
		})
	}

	/** `defaultMapId` null means the graph opens by default */
	async updateSettings({ defaultMapId }: { defaultMapId?: string | null }) {
		return this.update((data) => {
			if (defaultMapId !== undefined) {
				if (defaultMapId !== null) this.getMap(data, defaultMapId)
				data.settings.defaultMapId = defaultMapId
			}
			return data.settings
		})
	}

	// ------------------------------------------------------------- backgrounds

	/**
	 * Set or replace a map's background image, keeping its placements and
	 * scale. A map with no background gets a new library background covering
	 * its canvas, and if nothing is placed yet the canvas takes the image's
	 * size so it isn't stretched. A background other maps also use is forked
	 * first, so they keep theirs. `imgWidthPx`/`imgHeightPx` (decoded by the
	 * browser) are used only when the header can't be read. `stretched` is
	 * set when the image's aspect differs from its frame by more than 2%.
	 */
	async setMapImage(
		id: string,
		{
			bytes,
			imgWidthPx,
			imgHeightPx,
			variant = 'light',
		}: {
			bytes: Buffer
			imgWidthPx?: number
			imgHeightPx?: number
			variant?: Variant
		},
	) {
		if (!VARIANTS[variant]) throw Error("variant must be 'light' or 'dark'")
		if (!sniffImage(bytes)) {
			throw Error('Only PNG, JPEG or WebP images are accepted')
		}
		const size =
			imageSize(bytes) ??
			(isDim(imgWidthPx) && isDim(imgHeightPx)
				? { w: imgWidthPx, h: imgHeightPx }
				: null)
		if (!size || !isDim(size.w) || !isDim(size.h)) {
			throw Error("Couldn't tell the image's size")
		}
		const field = VARIANTS[variant]
		return this.update(async (data) => {
			const map = this.getMap(data, id)
			let bg =
				map.background &&
				data.backgrounds.find((b) => b.id === map.background.id)
			if (!bg) {
				if (!map.placements.length) {
					map.widthPx = size.w
					map.heightPx = size.h
				}
				bg = {
					id: `bg-${newId()}`,
					name: map.name,
					image: null,
					widthPx: size.w,
					heightPx: size.h,
				}
				data.backgrounds.push(bg)
				map.background = {
					id: bg.id,
					imageRect: { x: 0, y: 0, w: map.widthPx, h: map.heightPx },
				}
			} else if (
				data.maps.some((m) => m !== map && m.background?.id === bg.id)
			) {
				bg = await this.fork(data, map, bg, field)
			}
			const old = bg[field]
			const suffix = variant === 'dark' ? '-dark' : ''
			bg[field] = await this.writeImage(`${bg.id}${suffix}`, bytes)
			if (variant === 'light') {
				bg.widthPx = size.w
				bg.heightPx = size.h
			}
			if (old) await rm(path.join(this.imagesDir, old), { force: true })
			const r = map.background.imageRect
			const stretched = Math.abs(size.w / size.h / (r.w / r.h) - 1) > 0.02
			return { map, background: bg, stretched }
		})
	}

	/**
	 * Unset a map's background: just the dark version ('dark') or the whole
	 * background ('all'). Placements stay. Library backgrounds no map uses
	 * any more are deleted with their files.
	 */
	async removeMapImage(id: string, variant: 'all' | 'dark' = 'all') {
		if (!['all', 'dark'].includes(variant)) {
			throw Error("variant must be 'dark' or 'all'")
		}
		return this.update(async (data) => {
			const map = this.getMap(data, id)
			if (!map.background) return map
			if (variant === 'all') {
				map.background = null
			} else {
				const bg = data.backgrounds.find(
					(b) => b.id === map.background.id,
				)
				if (bg?.imageDark) {
					if (
						data.maps.some(
							(m) => m !== map && m.background?.id === bg.id,
						)
					) {
						await this.fork(data, map, bg, 'imageDark')
					} else {
						await rm(path.join(this.imagesDir, bg.imageDark), {
							force: true,
						})
						delete bg.imageDark
					}
				}
			}
			await this.collect(data)
			return map
		})
	}

	// ------------------------------------------------------------- placements

	/** Place or move a node on a map; one placement per node per map */
	async setPlacement(
		mapId: string,
		{
			deviceKey,
			x,
			y,
			seen,
		}: { deviceKey: string; x: number; y: number; seen?: Seen },
	) {
		checkDeviceKey(deviceKey)
		if (!isCoord(x) || !isCoord(y)) throw Error('x and y must be numbers')
		return this.update((data) => {
			const map = this.getMap(data, mapId)
			const placement: Placement = {
				deviceKey,
				x: clamp(x, map.widthPx),
				y: clamp(y, map.heightPx),
			}
			const s = cleanSeen(seen)
			if (Object.keys(s).length) placement.seen = s
			const existing = map.placements.find(
				(p) => p.deviceKey === deviceKey,
			)
			if (existing) return Object.assign(existing, placement)
			map.placements.push(placement)
			return placement
		})
	}

	/** Place or move several nodes in one write, e.g. "Place all" */
	async setPlacements(
		mapId: string,
		items: { deviceKey: string; x: number; y: number; seen?: Seen }[],
	) {
		if (!Array.isArray(items) || items.length > MAX_EXCEPTIONS) {
			throw Error('placements must be a list')
		}
		for (const { deviceKey, x, y } of items) {
			checkDeviceKey(deviceKey)
			if (!isCoord(x) || !isCoord(y)) {
				throw Error('x and y must be numbers')
			}
		}
		return this.update((data) => {
			const map = this.getMap(data, mapId)
			const byKey = new Map(
				map.placements
					.filter((p) => p.deviceKey)
					.map((p) => [p.deviceKey, p]),
			)
			return items.map(({ deviceKey, x, y, seen }) => {
				const placement: Placement = {
					deviceKey,
					x: clamp(x, map.widthPx),
					y: clamp(y, map.heightPx),
				}
				const s = cleanSeen(seen)
				if (Object.keys(s).length) placement.seen = s
				const existing = byKey.get(deviceKey)
				if (existing) return Object.assign(existing, placement)
				map.placements.push(placement)
				byKey.set(deviceKey, placement)
				return placement
			})
		})
	}

	/** Remove a node's placement on one map; its spots on other maps stay */
	removePlacement(mapId: string, deviceKey: string) {
		return this.update((data) => {
			const map = this.getMap(data, mapId)
			map.placements = map.placements.filter(
				(p) => p.deviceKey !== deviceKey,
			)
		})
	}

	/**
	 * Link a placeholder to a node: the node takes the placeholder's spot,
	 * replacing any position it already had on that map.
	 */
	linkPlaceholder(
		mapId: string,
		placeholderId: string,
		deviceKey: string,
		seen?: Seen,
	) {
		checkDeviceKey(deviceKey)
		return this.update((data) => {
			const map = this.getMap(data, mapId)
			const ph = map.placements.find(
				(p) => p.id === placeholderId && p.placeholder,
			)
			if (!ph) throw Error('No such placeholder')
			const linked: Placement = { deviceKey, x: ph.x, y: ph.y }
			const s = cleanSeen(seen)
			if (Object.keys(s).length) linked.seen = s
			map.placements = map.placements
				.filter((p) => p.deviceKey !== deviceKey)
				.map((p) => (p === ph ? linked : p))
			return linked
		})
	}

	removePlaceholder(mapId: string, placeholderId: string) {
		return this.update((data) => {
			const map = this.getMap(data, mapId)
			const before = map.placements.length
			map.placements = map.placements.filter(
				(p) => !(p.id === placeholderId && p.placeholder),
			)
			if (map.placements.length === before) {
				throw Error('No such placeholder')
			}
		})
	}

	// ------------------------------------------------------------- import

	/**
	 * Add the maps of a parsed export file (FloorPlanExchange.parseImport),
	 * given the user's decision for every node entry: a device key, or null
	 * to keep the position as a placeholder. Never overwrites: a taken name
	 * gets " (imported)", then " (imported 2)" and so on. `nodes` (this
	 * network's) supply the identity snapshots of linked placements.
	 */
	async importMaps(
		file: ParsedImport,
		matches: Record<string, string | null>,
		nodes: { key: string; name?: string; deviceId?: string }[] = [],
	) {
		if (!matches || typeof matches !== 'object') {
			throw Error(
				'matches must map each node ref to a device key or null',
			)
		}
		const used = new Set<string>()
		for (const e of file.nodes) {
			const label = e.name ?? e.ref
			if (!Object.hasOwn(matches, e.ref)) {
				throw Error(`No decision for "${label}"`)
			}
			const key = matches[e.ref]
			if (key === null) continue
			if (typeof key !== 'string' || !DEVICE_KEY.test(key)) {
				throw Error(`Bad device for "${label}"`)
			}
			if (used.has(key)) {
				throw Error('The same device is chosen for two entries')
			}
			used.add(key)
		}
		const byKey = new Map(nodes.map((n) => [n.key, n]))
		const byRef = new Map(file.nodes.map((e) => [e.ref, e]))

		return this.update(async (data) => {
			const taken = new Set(data.maps.map((m) => m.name))
			const freeName = (wanted: string) => {
				let name = wanted
				if (taken.has(name)) {
					const base = `${wanted} (imported`
					name = `${base})`
					for (let i = 2; taken.has(name); i++) name = `${base} ${i})`
				}
				taken.add(name)
				return name
			}

			// one library background per file background
			const bgIds = new Map<string, string>()
			for (const b of file.backgrounds) {
				const bg: Background = {
					id: `bg-${newId()}`,
					name: b.name,
					image: null,
					widthPx: b.widthPx,
					heightPx: b.heightPx,
				}
				if (b.image) bg.image = await this.writeImage(bg.id, b.image)
				if (b.imageDark) {
					bg.imageDark = await this.writeImage(
						`${bg.id}-dark`,
						b.imageDark,
					)
				}
				data.backgrounds.push(bg)
				bgIds.set(b.ref, bg.id)
			}

			const added: FloorPlanMap[] = []
			let linked = 0
			let placeholders = 0
			for (const m of file.maps) {
				const map: FloorPlanMap = {
					id: newId(),
					name: freeName(m.name),
					widthPx: m.widthPx,
					heightPx: m.heightPx,
					metersPerPixel: m.metersPerPixel,
					background: m.background
						? {
								id: bgIds.get(m.background.ref),
								imageRect: { ...m.background.imageRect },
							}
						: null,
					nodes: {
						start: m.nodes.start,
						exceptions: [
							...new Set(
								m.nodes.exceptionRefs
									.map((ref) => matches[ref])
									.filter(Boolean),
							),
						],
					},
					view: checkView(m.view),
					placements: [],
				}
				for (const pl of m.placements) {
					const key = matches[pl.ref]
					const x = clamp(pl.x, map.widthPx)
					const y = clamp(pl.y, map.heightPx)
					if (key) {
						const n = byKey.get(key)
						const placement: Placement = { deviceKey: key, x, y }
						const seen = cleanSeen({
							name: n?.name,
							deviceId: n?.deviceId,
						})
						if (Object.keys(seen).length) placement.seen = seen
						map.placements.push(placement)
						linked++
					} else {
						const e = byRef.get(pl.ref)
						const info: PlaceholderInfo = {}
						for (const k of [
							'name',
							'loc',
							'deviceId',
							'productLabel',
						] as const) {
							if (e[k]) info[k] = e[k]
						}
						map.placements.push({
							id: `ph-${newId()}`,
							deviceKey: null,
							x,
							y,
							placeholder: info,
						})
						placeholders++
					}
				}
				data.maps.push(map)
				added.push(map)
			}
			return { maps: added, linked, placeholders }
		})
	}

	// ------------------------------------------------------------- orphans

	/** Image files no background references, e.g. left behind by a store restore */
	private async orphans(data: FloorPlansData): Promise<ImageFile[]> {
		let names: string[]
		try {
			names = await readdir(this.imagesDir)
		} catch (error) {
			if (error.code === 'ENOENT') return []
			throw error
		}
		const used = new Set(
			data.backgrounds.flatMap((b) => [b.image, b.imageDark]),
		)
		const out: ImageFile[] = []
		for (const name of names) {
			// skip referenced files and in-flight atomic writes
			if (used.has(name) || name.endsWith('.tmp')) continue
			const s = await stat(path.join(this.imagesDir, name))
			if (s.isFile()) out.push({ name, size: s.size })
		}
		return out
	}

	/** List orphaned image files. Never deletes anything */
	async findOrphans() {
		const found = await this.orphans(await this.load())
		if (found.length) {
			logger.info(
				`Found ${found.length} unreferenced floorplan image(s): ${found.map((f) => f.name).join(', ')}`,
			)
		}
		return found
	}

	/** Delete the named files, but only those still unreferenced right now */
	deleteOrphans(names: string[]) {
		return this.update(async (data) => {
			const wanted = new Set(names)
			const deleted: string[] = []
			for (const f of await this.orphans(data)) {
				if (!wanted.has(f.name)) continue
				await rm(path.join(this.imagesDir, f.name), { force: true })
				deleted.push(f.name)
			}
			if (deleted.length) {
				logger.info(
					`Deleted unreferenced floorplan image(s): ${deleted.join(', ')}`,
				)
			}
			return deleted
		})
	}
}

export default new FloorPlans(floorPlansDir)
