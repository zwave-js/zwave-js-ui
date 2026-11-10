// Floor-plan maps shown by the Network Graph's map mode.
//
// Stored in <store>/floorplans/: maps.json holds settings and the maps (each
// with its own background and node positions), images/ holds the background
// pictures. Positions are canvas pixels: x right, y down, origin at the
// canvas's top-left. Every image file belongs to exactly one map.

import { cp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { floorPlansDir } from '../config/app.ts'
import { module } from './logger.ts'
import { ensureDir, generateId } from './utils.ts'

const logger = module('FloorPlans')

export const VERSION = 1
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024
export const MAX_IMAGE_MB = MAX_IMAGE_BYTES / 1024 / 1024
export const MAX_DIMENSION = 20000
export const MAX_NAME_LENGTH = 100
/** Upper bound for node lists: filter exceptions and bulk placements */
export const MAX_NODE_LIST = 5000
/** How far (as a ratio) a picture's aspect may differ from its frame before it counts as stretched */
const STRETCH_TOLERANCE = 0.02
/** What a new background picture of another shape does to the map, see setMapImage */
export const IMAGE_FITS = ['stretch', 'scale', 'keep'] as const
export type ImageFit = (typeof IMAGE_FITS)[number]

export const DEVICE_KEY = /^zwave:[0-9a-f]+:\d+$/
/** Map ids and image file names end up in file paths: only the shapes the server writes */
const MAP_ID = /^[\w-]+$/
const IMAGE_NAME = /^[\w-]+\.(png|jpg|webp)$/

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

/**
 * A map's background: a picture for the light theme, one for the dark theme,
 * or both. Either one is used for both themes when it is the only one.
 */
export interface Background {
	/** Image file names in images/ */
	image: string | null
	darkImage: string | null
	/** Where the picture sits on the canvas, in canvas pixels */
	imageRect: Rect
}

export interface Placement {
	deviceKey: string
	x: number
	y: number
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
	background: Background | null
	nodes: NodeFilter
	view: MapView
	placements: Placement[]
}

export interface FloorPlansData {
	version: number
	settings: { defaultMapId: string | null }
	maps: FloorPlanMap[]
}

const empty = (): FloorPlansData => ({
	version: VERSION,
	settings: { defaultMapId: null },
	maps: [],
})

const DIM_RULE = `a whole number 1-${MAX_DIMENSION}`
const isDim = (n: unknown): n is number =>
	Number.isInteger(n) && (n as number) > 0 && (n as number) <= MAX_DIMENSION
const isCoord = (n: unknown): n is number =>
	typeof n === 'number' && Number.isFinite(n)
const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max)
const cleanName = (name: unknown, fallback: string) =>
	(typeof name === 'string' && name ? name : fallback).slice(
		0,
		MAX_NAME_LENGTH,
	)

function checkDeviceKey(key: unknown): asserts key is string {
	if (typeof key !== 'string' || !DEVICE_KEY.test(key)) {
		throw Error('deviceKey must look like zwave:<homeId>:<nodeId>')
	}
}

const imageField = (dark: boolean) => (dark ? 'darkImage' : 'image')

/** A placement for `map`, with its position clamped to the canvas */
function toPlacement(
	map: FloorPlanMap,
	{ deviceKey, x, y }: Placement,
): Placement {
	return {
		deviceKey,
		x: clamp(x, map.widthPx),
		y: clamp(y, map.heightPx),
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

export function checkNodes(nodes: unknown): NodeFilter {
	const n = nodes as NodeFilter
	if (!n || !['include', 'exclude'].includes(n.start)) {
		throw Error("nodes.start must be 'include' or 'exclude'")
	}
	const ex = n.exceptions ?? []
	if (
		!Array.isArray(ex) ||
		ex.length > MAX_NODE_LIST ||
		!ex.every((k) => typeof k === 'string' && DEVICE_KEY.test(k))
	) {
		throw Error(
			`nodes.exceptions must be a list of at most ${MAX_NODE_LIST} device keys`,
		)
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

/**
 * Check data read from a maps.json (`source` names it in messages). Map ids
 * and image names must have the shape the server writes, since they are
 * used in file paths. With `strict` the first problem throws; otherwise a
 * map with a bad id is dropped and a bad image name cleared, both logged.
 */
export function checkData(
	raw: any,
	source: string,
	{ strict = false } = {},
): FloorPlansData {
	if (
		!Number.isInteger(raw?.version) ||
		raw.version < 1 ||
		raw.version > VERSION
	) {
		throw Error(
			`${source} is version ${raw?.version}, this release reads up to ${VERSION}`,
		)
	}
	if (!Array.isArray(raw.maps)) throw Error(`${source} has no maps list`)
	const problem = (msg: string) => {
		if (strict) throw Error(`${source}: ${msg}`)
		logger.warn(`${source}: ${msg}`)
	}
	raw.maps = raw.maps.filter((map: any) => {
		if (typeof map?.id === 'string' && MAP_ID.test(map.id)) return true
		problem(`map ${JSON.stringify(map?.id)} has an invalid id, dropped`)
		return false
	})
	for (const map of raw.maps as FloorPlanMap[]) {
		const bg = map.background
		if (!bg) continue
		for (const field of ['image', 'darkImage'] as const) {
			const name = bg[field]
			if (
				name === null ||
				(typeof name === 'string' && IMAGE_NAME.test(name))
			)
				continue
			problem(
				`map ${map.id} has an invalid ${field} ${JSON.stringify(name)}, cleared`,
			)
			bg[field] = null
		}
		if (!bg.image && !bg.darkImage) map.background = null
	}
	raw.settings ??= { defaultMapId: null }
	const ids = new Set(raw.maps.map((m: FloorPlanMap) => m.id))
	if (!ids.has(raw.settings.defaultMapId)) raw.settings.defaultMapId = null
	return raw as FloorPlansData
}

/** Write a file atomically: temp file in the same dir, then rename over the target */
async function writeAtomic(file: string, data: string | Buffer) {
	await ensureDir(path.dirname(file))
	const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
	try {
		await writeFile(tmp, data)
		await rename(tmp, file)
	} catch (error) {
		await rm(tmp, { force: true })
		throw error
	}
}

/**
 * Image files an update writes and replaces. Files in `added` are deleted if
 * maps.json can't be written, files in `removed` only once it has been, so
 * maps.json never points at a missing file.
 */
interface FileChanges {
	added: string[]
	removed: string[]
}

/** A file for the store backup, see withBackupFiles */
export interface BackupFile {
	/** Path inside the floorplans folder, e.g. images/<name> */
	name: string
	file: string
}

export interface AddMapOptions {
	name?: string
	widthPx?: number
	heightPx?: number
	nodes?: NodeFilter
}

export interface MapChanges {
	name?: string
	nodes?: NodeFilter
	view?: MapView
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
		let raw: unknown
		try {
			raw = JSON.parse(await readFile(this.file, 'utf8'))
		} catch (error) {
			if (error.code === 'ENOENT') return empty()
			throw Error(`Can't read ${this.file}: ${error.message}`)
		}
		return checkData(raw, this.file)
	}

	/** Run `fn` after every queued step, before any later one */
	private enqueue<T>(fn: () => Promise<T>) {
		const run = this.queue.then(fn)
		this.queue = run.catch(() => {})
		return run
	}

	/** Run read-modify-write steps one at a time so concurrent requests can't lose updates */
	private update<T>(
		fn: (data: FloorPlansData, files: FileChanges) => T | Promise<T>,
	) {
		return this.enqueue(async () => {
			const files: FileChanges = { added: [], removed: [] }
			let result: T
			try {
				const data = await this.load()
				result = await fn(data, files)
				await writeAtomic(this.file, JSON.stringify(data, null, 2))
			} catch (error) {
				await this.removeFiles(files.added)
				throw error
			}
			await this.removeFiles(files.removed)
			return result
		})
	}

	/**
	 * Run `fn` with the files a store backup needs: maps.json and every
	 * image a map uses, as `name` (relative to the floorplans folder) and
	 * `file` (full path), for `fn` to stream into the zip. The write queue
	 * waits until `fn` is done, so the images match maps.json and none is
	 * deleted halfway. Unused and in-flight files are left out. A missing
	 * image is logged and skipped, and an unreadable maps.json is still
	 * backed up as it is. If even listing them fails, that is logged and
	 * `fn` gets none, so the rest of the backup still happens.
	 */
	withBackupFiles<T>(fn: (files: BackupFile[]) => Promise<T>): Promise<T> {
		return this.enqueue(async () => {
			let files: BackupFile[] = []
			try {
				files = await this.listBackupFiles()
			} catch (error) {
				logger.error(
					`Floorplans left out of the backup: ${error.message}`,
				)
			}
			return fn(files)
		})
	}

	private async listBackupFiles(): Promise<BackupFile[]> {
		if (!existsSync(this.file)) return []
		const out = [{ name: 'maps.json', file: this.file }]
		let maps: FloorPlanMap[] = []
		try {
			maps = (await this.load()).maps
		} catch (error) {
			logger.error(
				`Backing up floorplans without images: ${error.message}`,
			)
		}
		for (const m of maps) {
			for (const name of [m.background?.image, m.background?.darkImage]) {
				if (!name) continue
				const file = path.join(this.imagesDir, name)
				if (existsSync(file)) out.push({ name: `images/${name}`, file })
				else
					logger.warn(
						`Floorplan image ${name} is missing, left out of the backup`,
					)
			}
		}
		return out
	}

	/**
	 * Replace the floorplans folder with a restored one. Replacing instead
	 * of merging keeps pictures the backup doesn't use from piling up.
	 * The restored maps.json is checked first: one this release can't use
	 * is refused and the current floorplans stay. A picture it names that
	 * isn't in the backup is only logged, the map shows without it.
	 */
	restoreFrom(dir: string) {
		return this.enqueue(async () => {
			const file = path.join(dir, 'maps.json')
			let raw: unknown
			try {
				raw = JSON.parse(await readFile(file, 'utf8'))
			} catch (error) {
				throw Error(
					`The backup's floorplans/maps.json can't be read: ${error.message}`,
				)
			}
			const data = checkData(raw, "The backup's floorplans/maps.json", {
				strict: true,
			})
			for (const name of data.maps.flatMap((m) => [
				m.background?.image,
				m.background?.darkImage,
			])) {
				if (name && !existsSync(path.join(dir, 'images', name))) {
					logger.warn(
						`Restored floorplans are missing picture ${name}`,
					)
				}
			}
			const id = generateId()
			const incoming = `${this.dir}.restore-${id}`
			const old = `${this.dir}.old-${id}`
			let moved = false
			try {
				await cp(dir, incoming, {
					recursive: true,
					verbatimSymlinks: true,
				})
				try {
					await rename(this.dir, old)
					moved = true
				} catch (error) {
					if (error.code !== 'ENOENT') throw error
				}
				await rename(incoming, this.dir)
			} catch (error) {
				// put the current floorplans back
				if (moved) await rename(old, this.dir)
				await rm(incoming, { recursive: true, force: true })
				throw error
			}
			logger.info('Floorplans restored from backup')
			// the swap is done: a leftover old folder is only clutter
			try {
				await rm(old, { recursive: true, force: true })
			} catch (error) {
				logger.warn(
					`Restored, but can't remove the old floorplans in ${old}: ${error.message}`,
				)
			}
		})
	}

	/**
	 * Warn about folders an interrupted restore left next to the floorplans
	 * folder: `.old-*` holds the floorplans from before the restore, and if
	 * the floorplans folder itself is missing, they are the user's maps.
	 */
	async warnLeftovers() {
		const base = path.basename(this.dir)
		let names: string[]
		try {
			names = await readdir(path.dirname(this.dir))
		} catch {
			return
		}
		for (const name of names) {
			if (
				name.startsWith(`${base}.old-`) ||
				name.startsWith(`${base}.restore-`)
			) {
				logger.warn(
					`${path.join(path.dirname(this.dir), name)} was left by an interrupted floorplans restore. If your maps are missing, rename it to ${base}; otherwise it can be deleted.`,
				)
			}
		}
	}

	/** Delete image files; a failure is logged, never thrown, since maps.json no longer uses them */
	private async removeFiles(names: string[]) {
		for (const name of names) {
			try {
				await rm(path.join(this.imagesDir, name), { force: true })
			} catch (error) {
				logger.error(`Can't delete floorplan image ${name}`, error)
			}
		}
	}

	/** Path of a map's image file, or null if it has none */
	imagePath(map: FloorPlanMap, { dark = false } = {}): string | null {
		const file = map.background?.[imageField(dark)]
		return file ? path.join(this.imagesDir, file) : null
	}

	private getMap(data: FloorPlansData, id: string) {
		const map = data.maps.find((m) => m.id === id)
		if (!map) throw Error('No such map')
		return map
	}

	private async writeImage(
		map: FloorPlanMap,
		dark: boolean,
		bytes: Buffer,
		files: FileChanges,
	) {
		const kind = sniffImage(bytes)
		if (!kind) throw Error('Only PNG, JPEG or WebP images are accepted')
		if (bytes.length > MAX_IMAGE_BYTES) {
			throw Error(`Image is larger than ${MAX_IMAGE_MB} MB`)
		}
		// a new name each time busts browser caches
		const suffix = dark ? '-dark' : ''
		const name = `${map.id}${suffix}-${generateId()}.${kind.ext}`
		await writeAtomic(path.join(this.imagesDir, name), bytes)
		files.added.push(name)
		return name
	}

	// ------------------------------------------------------------- maps

	async addMap({
		name,
		widthPx = 3000,
		heightPx = 2000,
		nodes = { start: 'include', exceptions: [] },
	}: AddMapOptions = {}) {
		if (!isDim(widthPx) || !isDim(heightPx)) {
			throw Error(`widthPx and heightPx must each be ${DIM_RULE}`)
		}
		const checked = checkNodes(nodes)
		return this.update((data) => {
			const map: FloorPlanMap = {
				id: generateId(),
				name: cleanName(name, 'Map'),
				widthPx,
				heightPx,
				background: null,
				nodes: checked,
				view: checkView(null),
				placements: [],
			}
			data.maps.push(map)
			return map
		})
	}

	/**
	 * Change a map. Positions are measured from the top-left, so growing the
	 * canvas keeps them and the background's frame; shrinking it pulls nodes
	 * that would fall outside back onto the edge.
	 */
	async updateMap(id: string, changes: MapChanges = {}) {
		const c = changes
		if (c.widthPx !== undefined && !isDim(c.widthPx)) {
			throw Error(`widthPx must be ${DIM_RULE}`)
		}
		if (c.heightPx !== undefined && !isDim(c.heightPx)) {
			throw Error(`heightPx must be ${DIM_RULE}`)
		}
		const nodes = c.nodes !== undefined ? checkNodes(c.nodes) : undefined
		const view = c.view !== undefined ? checkView(c.view) : undefined
		return this.update((data) => {
			const map = this.getMap(data, id)
			if (c.name !== undefined) map.name = cleanName(c.name, map.name)
			if (nodes) map.nodes = nodes
			if (view) map.view = view
			if (c.widthPx !== undefined) map.widthPx = c.widthPx
			if (c.heightPx !== undefined) map.heightPx = c.heightPx
			map.placements = map.placements.map((p) => toPlacement(map, p))
			return map
		})
	}

	async deleteMap(id: string) {
		return this.update((data, files) => {
			const map = this.getMap(data, id)
			data.maps = data.maps.filter((m) => m.id !== id)
			if (data.settings.defaultMapId === id) {
				data.settings.defaultMapId = null
			}
			const bg = map.background
			if (bg)
				files.removed.push(...[bg.image, bg.darkImage].filter(Boolean))
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
	 * Set or replace a map's light theme picture, or with `dark` its dark
	 * theme one, keeping its placements. The first picture of either kind
	 * covers the whole canvas, and if nothing is placed yet the canvas takes
	 * its size so it isn't stretched.
	 * `fit` says what a picture of another shape does to the map: 'stretch'
	 * it over the current frame, or use it as is, the canvas taking its size
	 * and nodes keeping their spots relative to the old frame ('scale') or
	 * their distance from its top-left corner ('keep'). Using it as is resets
	 * the saved zoom and center, and stretches the other theme's picture.
	 * `imgWidthPx`/`imgHeightPx` (decoded by the browser) are used only when
	 * the header can't be read. `stretched` is set when the picture's aspect
	 * differs from its frame by more than STRETCH_TOLERANCE.
	 */
	async setMapImage(
		id: string,
		{
			bytes,
			imgWidthPx,
			imgHeightPx,
			dark = false,
			fit = 'stretch',
		}: {
			bytes: Buffer
			imgWidthPx?: number
			imgHeightPx?: number
			dark?: boolean
			fit?: ImageFit
		},
	) {
		if (!IMAGE_FITS.includes(fit)) {
			throw Error(`fit must be one of ${IMAGE_FITS.join(', ')}`)
		}
		if (!sniffImage(bytes)) {
			throw Error('Only PNG, JPEG or WebP images are accepted')
		}
		const size =
			imageSize(bytes) ??
			(isDim(imgWidthPx) && isDim(imgHeightPx)
				? { w: imgWidthPx, h: imgHeightPx }
				: null)
		if (!size) throw Error("Couldn't tell the image's size")
		if (!isDim(size.w) || !isDim(size.h)) {
			throw Error(
				`The image is ${size.w} x ${size.h} pixels, each side must be ${DIM_RULE}`,
			)
		}
		return this.update(async (data, files) => {
			const map = this.getMap(data, id)
			const name = await this.writeImage(map, dark, bytes, files)
			if (fit !== 'stretch') {
				const r = map.background?.imageRect ?? {
					x: 0,
					y: 0,
					w: map.widthPx,
					h: map.heightPx,
				}
				const [sx, sy] =
					fit === 'scale' ? [size.w / r.w, size.h / r.h] : [1, 1]
				map.widthPx = size.w
				map.heightPx = size.h
				map.placements = map.placements.map((p) =>
					toPlacement(map, {
						deviceKey: p.deviceKey,
						x: Math.round((p.x - r.x) * sx),
						y: Math.round((p.y - r.y) * sy),
					}),
				)
				if (map.background) {
					map.background.imageRect = {
						x: 0,
						y: 0,
						w: size.w,
						h: size.h,
					}
				}
				map.view = { ...map.view, center: null, zoom: null }
			}
			if (map.background) {
				const field = imageField(dark)
				const old = map.background[field]
				if (old) files.removed.push(old)
				map.background[field] = name
			} else {
				if (!map.placements.length) {
					map.widthPx = size.w
					map.heightPx = size.h
				}
				map.background = {
					image: dark ? null : name,
					darkImage: dark ? name : null,
					imageRect: { x: 0, y: 0, w: map.widthPx, h: map.heightPx },
				}
			}
			const r = map.background.imageRect
			const stretched =
				Math.abs(size.w / size.h / (r.w / r.h) - 1) > STRETCH_TOLERANCE
			return { map, stretched }
		})
	}

	/**
	 * Remove a map's light theme picture, or with `dark` its dark theme one.
	 * The background goes once it has neither. Placements stay.
	 */
	async removeMapImage(id: string, { dark = false } = {}) {
		return this.update((data, files) => {
			const map = this.getMap(data, id)
			const bg = map.background
			if (!bg) return map
			const field = imageField(dark)
			if (bg[field]) files.removed.push(bg[field])
			bg[field] = null
			if (!bg.image && !bg.darkImage) map.background = null
			return map
		})
	}

	// ------------------------------------------------------------- placements

	/** Place or move a node on a map; one placement per node per map */
	async setPlacement(mapId: string, placement: Placement) {
		const [result] = await this.setPlacements(mapId, [placement])
		return result
	}

	/** Place or move several nodes in one write, e.g. "Place all" */
	async setPlacements(mapId: string, items: Placement[]) {
		if (!Array.isArray(items) || items.length > MAX_NODE_LIST) {
			throw Error(`placements must be a list of at most ${MAX_NODE_LIST}`)
		}
		for (const { deviceKey, x, y } of items) {
			checkDeviceKey(deviceKey)
			if (!isCoord(x) || !isCoord(y)) {
				throw Error('x and y must be numbers')
			}
		}
		return this.update((data) => {
			const map = this.getMap(data, mapId)
			const byKey = new Map(map.placements.map((p) => [p.deviceKey, p]))
			return items.map((item) => {
				const placement = toPlacement(map, item)
				const existing = byKey.get(placement.deviceKey)
				if (existing) return Object.assign(existing, placement)
				map.placements.push(placement)
				byKey.set(placement.deviceKey, placement)
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
}

export default new FloorPlans(floorPlansDir)
