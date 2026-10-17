// Floorplan export/import.
//
// An export file holds one or more maps, the background images they use
// (base64) and a manifest describing each node they mention. Positions refer
// to the manifest by `ref`, never by node ID, so an import can remap them onto
// a different network. Import always goes through a review step: this module
// only parses files and proposes matches, `FloorPlans.importMaps` writes.

import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { FloorPlansData, MapView, NodeFilter, Rect } from './FloorPlans.ts'
import {
	MAX_IMAGE_BYTES,
	checkView,
	imageSize,
	sniffImage,
} from './FloorPlans.ts'

export const FORMAT = 'zwjsui-floorplan'
export const FORMAT_VERSION = 1
export const MAX_FILE_BYTES = 100 * 1024 * 1024
const MAX_MAPS = 50
const MAX_NODES = 2000
const MAX_DIMENSION = 20000
const IMPORT_TTL_MS = 10 * 60 * 1000
const MAX_HELD_IMPORTS = 3

const TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	webp: 'image/webp',
}

/** This network's nodes, in the shape matching and export need */
export interface LocalNode {
	key: string
	id: number
	name?: string
	loc?: string
	deviceId?: string
	productLabel?: string
	manufacturer?: string
	firmwareVersion?: string
	controller: boolean
}

/** A node described in an export file */
export interface FileNode {
	ref: string
	homeId: string | null
	nodeId: number | null
	name: string | null
	loc: string | null
	deviceId: string | null
	productLabel: string | null
	manufacturer: string | null
	firmwareVersion: string | null
	controller: boolean
}

interface FileImage {
	type: string
	data: string
}

export interface ExportFile {
	format: typeof FORMAT
	version: typeof FORMAT_VERSION
	exportedAt: string
	source: { homeId: string | null; appVersion: string | null }
	backgrounds: {
		ref: string
		name: string
		widthPx: number
		heightPx: number
		image: FileImage | null
		imageDark: FileImage | null
	}[]
	maps: {
		name: string
		widthPx: number
		heightPx: number
		metersPerPixel: number | null
		background: { ref: string; imageRect: Rect } | null
		nodes: { start: NodeFilter['start']; exceptions: string[] }
		view: MapView
		placements: { ref: string; x: number; y: number }[]
	}[]
	nodes: FileNode[]
}

/** A validated import file, images decoded */
export interface ParsedImport {
	source: { homeId: string | null; appVersion: string | null }
	exportedAt: string | null
	backgrounds: {
		ref: string
		name: string
		widthPx: number
		heightPx: number
		image: Buffer | null
		imageDark: Buffer | null
	}[]
	maps: {
		name: string
		widthPx: number
		heightPx: number
		metersPerPixel: number | null
		background: { ref: string; imageRect: Rect } | null
		nodes: { start: NodeFilter['start']; exceptionRefs: string[] }
		view: MapView
		placements: { ref: string; x: number; y: number }[]
	}[]
	nodes: FileNode[]
}

export type Confidence = 'certain' | 'likely' | 'possible' | 'none'

export interface Proposal {
	key: string | null
	confidence: Confidence
	/** how many local nodes tied for this entry's best match */
	tied?: number
}

/** Device key of a node: `zwave:<home ID in hex, no 0x>:<node ID>` */
export function deviceKey(homeHex: string, nodeId: number) {
	return `zwave:${homeHex.replace(/^0x/, '')}:${nodeId}`
}

/** This network's nodes, or [] while the driver isn't ready */
export function localNodes(
	zwave:
		| {
				homeHex?: string
				nodes: Map<
					number,
					{
						id: number
						name?: string
						loc?: string
						deviceId?: string
						productLabel?: string
						manufacturer?: string
						firmwareVersion?: string
						isControllerNode?: boolean
					}
				>
		  }
		| undefined,
): LocalNode[] {
	if (!zwave?.homeHex) return []
	return [...zwave.nodes.values()].map((n) => ({
		key: deviceKey(zwave.homeHex, n.id),
		id: n.id,
		name: n.name,
		loc: n.loc,
		deviceId: n.deviceId,
		productLabel: n.productLabel,
		manufacturer: n.manufacturer,
		firmwareVersion: n.firmwareVersion,
		controller: !!n.isControllerNode,
	}))
}

/**
 * Build the export file for the given maps (all maps when `mapIds` is null).
 * A node that's gone from the network is described from its placement's
 * identity snapshot. Placeholders aren't exported.
 */
export async function buildExport({
	data,
	mapIds = null,
	nodes,
	imagesDir,
	homeId = null,
	appVersion = null,
}: {
	data: FloorPlansData
	mapIds?: string[] | null
	nodes: LocalNode[]
	imagesDir: string
	homeId?: string | null
	appVersion?: string | null
}): Promise<ExportFile> {
	const maps = mapIds
		? mapIds.map((id) => {
				const m = data.maps.find((x) => x.id === id)
				if (!m) throw Error('No such map')
				return m
			})
		: data.maps
	if (!maps.length) throw Error('There are no maps to export')

	const byKey = new Map(nodes.map((n) => [n.key, n]))
	const entries: FileNode[] = []
	const refOf = new Map<string, string>()
	const describe = (
		key: string,
		seen?: { name?: string; deviceId?: string },
	) => {
		if (refOf.has(key)) return refOf.get(key)
		const ref = `n${entries.length + 1}`
		const [, home, id] = key.split(':')
		const n = byKey.get(key)
		entries.push({
			ref,
			homeId: home,
			nodeId: Number(id),
			name: n?.name || seen?.name || null,
			loc: n?.loc || null,
			deviceId: n?.deviceId || seen?.deviceId || null,
			productLabel: n?.productLabel || null,
			manufacturer: n?.manufacturer || null,
			firmwareVersion: n?.firmwareVersion || null,
			controller: !!n?.controller,
		})
		refOf.set(key, ref)
		return ref
	}

	const backgrounds: ExportFile['backgrounds'] = []
	const bgRef = new Map<string, string>()
	const addBackground = async (id: string) => {
		if (bgRef.has(id)) return bgRef.get(id)
		const bg = data.backgrounds.find((b) => b.id === id)
		if (!bg) return null
		const ref = `b${backgrounds.length + 1}`
		const read = async (file?: string | null) => {
			if (!file) return null
			const ext = path.extname(file).slice(1).toLowerCase()
			const bytes = await readFile(path.join(imagesDir, file))
			return {
				type: TYPES[ext] ?? 'application/octet-stream',
				data: bytes.toString('base64'),
			}
		}
		backgrounds.push({
			ref,
			name: bg.name,
			widthPx: bg.widthPx,
			heightPx: bg.heightPx,
			image: await read(bg.image),
			imageDark: await read(bg.imageDark),
		})
		bgRef.set(id, ref)
		return ref
	}

	const outMaps: ExportFile['maps'] = []
	for (const m of maps) {
		const ref = m.background ? await addBackground(m.background.id) : null
		const placements = m.placements
			.filter((p) => p.deviceKey)
			.map((p) => ({
				ref: describe(p.deviceKey, p.seen),
				x: p.x,
				y: p.y,
			}))
		outMaps.push({
			name: m.name,
			widthPx: m.widthPx,
			heightPx: m.heightPx,
			metersPerPixel: m.metersPerPixel ?? null,
			background: ref
				? { ref, imageRect: { ...m.background.imageRect } }
				: null,
			nodes: {
				start: m.nodes.start,
				exceptions: m.nodes.exceptions.map((k) => describe(k)),
			},
			view: m.view,
			placements,
		})
	}

	return {
		format: FORMAT,
		version: FORMAT_VERSION,
		exportedAt: new Date().toISOString(),
		source: { homeId, appVersion },
		backgrounds,
		maps: outMaps,
		nodes: entries,
	}
}

/** Default download name: zwjsui_floorplan_YYYYMMDD.json (local date) */
export function exportFileName(date = new Date()) {
	const pad = (n: number) => String(n).padStart(2, '0')
	return `zwjsui_floorplan_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.json`
}

const isDim = (n: unknown): n is number =>
	Number.isInteger(n) && (n as number) > 0 && (n as number) <= MAX_DIMENSION
const isNum = (n: unknown): n is number =>
	typeof n === 'number' && Number.isFinite(n)
const str = (v: unknown, max = 200) =>
	typeof v === 'string' && v ? v.slice(0, max) : null

/** Parse and validate an uploaded export file. Throws with a plain reason. */
export function parseImport(bytes: Buffer): ParsedImport {
	if (bytes.length > MAX_FILE_BYTES) {
		throw Error('File is larger than 100 MB')
	}
	let file: any
	try {
		file = JSON.parse(bytes.toString('utf8'))
	} catch {
		throw Error("That isn't a floorplan file (not JSON)")
	}
	const bad = (why: string) => Error(`Not a usable floorplan file: ${why}`)
	if (file?.format !== FORMAT) throw bad('wrong format')
	if (file.version !== FORMAT_VERSION) {
		throw bad(
			`version ${file.version} isn't supported (expected ${FORMAT_VERSION})`,
		)
	}

	if (!Array.isArray(file.nodes) || file.nodes.length > MAX_NODES) {
		throw bad('node list is invalid')
	}
	const refs = new Set<string>()
	const nodes: FileNode[] = file.nodes.map((n: any) => {
		if (typeof n?.ref !== 'string' || !n.ref || refs.has(n.ref)) {
			throw bad('node refs must be unique strings')
		}
		refs.add(n.ref)
		return {
			ref: n.ref,
			homeId: str(n.homeId),
			nodeId: Number.isInteger(n.nodeId) ? n.nodeId : null,
			name: str(n.name),
			loc: str(n.loc),
			deviceId: str(n.deviceId),
			productLabel: str(n.productLabel),
			manufacturer: str(n.manufacturer),
			firmwareVersion: str(n.firmwareVersion),
			controller: n.controller === true,
		}
	})

	if (!Array.isArray(file.backgrounds)) throw bad('backgrounds are invalid')
	const bgRefs = new Set<string>()
	const decode = (img: any, what: string) => {
		if (img == null) return null
		if (typeof img.data !== 'string') throw bad(`${what} has no data`)
		const buf = Buffer.from(img.data, 'base64')
		if (buf.length > MAX_IMAGE_BYTES) {
			throw Error(`${what} is larger than 25 MB`)
		}
		if (!sniffImage(buf)) {
			throw Error(`${what} isn't a PNG, JPEG or WebP image`)
		}
		return buf
	}
	const backgrounds = file.backgrounds.map((b: any) => {
		if (typeof b?.ref !== 'string' || !b.ref || bgRefs.has(b.ref)) {
			throw bad('background refs must be unique strings')
		}
		bgRefs.add(b.ref)
		const image = decode(b.image, 'background image')
		const imageDark = decode(b.imageDark, 'dark background image')
		const size = imageSize(image ?? imageDark ?? Buffer.alloc(0))
		const widthPx = size?.w ?? b.widthPx
		const heightPx = size?.h ?? b.heightPx
		if (!isDim(widthPx) || !isDim(heightPx)) {
			throw bad('background size is invalid')
		}
		return {
			ref: b.ref,
			name: str(b.name, 100) ?? 'Background',
			widthPx,
			heightPx,
			image,
			imageDark,
		}
	})

	if (
		!Array.isArray(file.maps) ||
		!file.maps.length ||
		file.maps.length > MAX_MAPS
	) {
		throw bad('map list is invalid')
	}
	const maps = file.maps.map((m: any) => {
		if (typeof m?.name !== 'string') throw bad('a map has no name')
		if (!isDim(m.widthPx) || !isDim(m.heightPx)) {
			throw bad('map size is invalid')
		}
		let background: ParsedImport['maps'][number]['background'] = null
		if (m.background != null) {
			const r = m.background.imageRect
			if (!bgRefs.has(m.background.ref)) {
				throw bad('a map refers to an unknown background')
			}
			if (
				![r?.x, r?.y, r?.w, r?.h].every(isNum) ||
				!(r.w > 0 && r.h > 0)
			) {
				throw bad('imageRect is invalid')
			}
			background = {
				ref: m.background.ref,
				imageRect: { x: r.x, y: r.y, w: r.w, h: r.h },
			}
		}
		if (!Array.isArray(m.placements)) throw bad('placements are invalid')
		const placements = m.placements.map((p: any) => {
			if (!refs.has(p?.ref)) {
				throw bad('a placement refers to an unknown node')
			}
			if (!isNum(p.x) || !isNum(p.y)) {
				throw bad('a placement has invalid coordinates')
			}
			return { ref: p.ref, x: p.x, y: p.y }
		})
		const exceptions = m.nodes?.exceptions
		return {
			name: m.name.slice(0, 100) || 'Imported map',
			widthPx: m.widthPx,
			heightPx: m.heightPx,
			metersPerPixel:
				isNum(m.metersPerPixel) &&
				m.metersPerPixel > 0 &&
				m.metersPerPixel < 100
					? m.metersPerPixel
					: null,
			background,
			nodes: {
				start: m.nodes?.start === 'exclude' ? 'exclude' : 'include',
				exceptionRefs: Array.isArray(exceptions)
					? exceptions.filter((ref: unknown) =>
							refs.has(ref as string),
						)
					: [],
			},
			view: checkView(m.view),
			placements,
		}
	})

	// only backgrounds a map uses are kept
	const usedBgs = new Set(maps.map((m) => m.background?.ref).filter(Boolean))

	return {
		source: {
			homeId: str(file.source?.homeId),
			appVersion: str(file.source?.appVersion),
		},
		exportedAt: str(file.exportedAt),
		backgrounds: backgrounds.filter((b) => usedBgs.has(b.ref)),
		maps,
		nodes,
	}
}

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase()
const generic = (name?: string | null) =>
	!name || /^nodeid \d+$/.test(norm(name))
const LEVELS: Record<number, Confidence> = {
	3: 'certain',
	2: 'likely',
	1: 'possible',
}

/**
 * How strongly a file entry matches a local node:
 *  3 certain  - both are the controller; or same home ID and node ID with
 *               the same deviceId and name
 *  2 likely   - same name and same deviceId
 *  1 possible - same deviceId and same location; or same name only
 *  0          - no evidence, or only one of them is a controller
 * Generic names ("NodeID 12") don't count as a name match.
 */
export function matchScore(
	entry: FileNode,
	node: LocalNode,
	localHome: string | null,
) {
	if (entry.controller || node.controller) {
		return entry.controller && node.controller ? 3 : 0
	}
	const sameName =
		!generic(entry.name) && norm(entry.name) === norm(node.name)
	const sameDevice = !!entry.deviceId && entry.deviceId === node.deviceId
	const sameLoc = !!norm(entry.loc) && norm(entry.loc) === norm(node.loc)
	if (
		entry.homeId &&
		entry.homeId === localHome &&
		entry.nodeId === node.id &&
		sameDevice &&
		sameName
	) {
		return 3
	}
	if (sameName && sameDevice) return 2
	if ((sameDevice && sameLoc) || sameName) return 1
	return 0
}

/**
 * Propose one local node per file entry, strongest evidence first. Each local
 * node is proposed at most once. When an entry's best evidence points at more
 * than one node, or a node is the single best for more than one entry, those
 * are left for the user to decide.
 */
export function proposeMatches(
	entries: FileNode[],
	nodes: LocalNode[],
	localHome: string | null,
): Record<string, Proposal> {
	const result: Record<string, Proposal> = Object.fromEntries(
		entries.map((e) => [e.ref, { key: null, confidence: 'none' }]),
	)
	const takenNodes = new Set<string>()
	const doneEntries = new Set<string>()
	for (const level of [3, 2, 1]) {
		const best = new Map<string, string[]>() // ref -> node keys at this level
		for (const e of entries) {
			if (doneEntries.has(e.ref)) continue
			const scored = nodes
				.filter((n) => !takenNodes.has(n.key))
				.map((n) => [n.key, matchScore(e, n, localHome)] as const)
			const top = Math.max(0, ...scored.map(([, s]) => s))
			if (top !== level) continue
			best.set(
				e.ref,
				scored.filter(([, s]) => s === level).map(([k]) => k),
			)
		}
		const claims = new Map<string, string[]>() // node key -> refs naming it as their single best
		for (const [ref, keys] of best) {
			if (keys.length !== 1) continue
			claims.set(keys[0], [...(claims.get(keys[0]) ?? []), ref])
		}
		for (const [key, refs] of claims) {
			if (refs.length !== 1) continue
			result[refs[0]] = { key, confidence: LEVELS[level] }
			takenNodes.add(key)
		}
		// entries with ties at this level stay unproposed, with a hint
		for (const [ref, keys] of best) {
			doneEntries.add(ref)
			if (result[ref].key === null) result[ref].tied = keys.length
		}
	}
	return result
}

/**
 * Parsed files waiting between the preview and the commit step, held in
 * memory for 10 minutes. Only the newest few are kept, as files can be large.
 */
export class ImportHolds {
	private held = new Map<string, { file: ParsedImport; expires: number }>()

	hold(file: ParsedImport, now = Date.now()) {
		this.sweep(now)
		while (this.held.size >= MAX_HELD_IMPORTS) {
			this.held.delete(this.held.keys().next().value)
		}
		const token = randomBytes(12).toString('hex')
		this.held.set(token, { file, expires: now + IMPORT_TTL_MS })
		return token
	}

	get(token: unknown, now = Date.now()) {
		this.sweep(now)
		const held = typeof token === 'string' && this.held.get(token)
		if (!held) throw Error('That import has expired, choose the file again')
		return held.file
	}

	release(token: string) {
		this.held.delete(token)
	}

	private sweep(now: number) {
		for (const [token, held] of this.held) {
			if (held.expires < now) this.held.delete(token)
		}
	}
}
