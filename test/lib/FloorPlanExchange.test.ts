import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DEFAULT_LAYERS, FloorPlans } from '../../api/lib/FloorPlans.ts'
import type { FileNode, LocalNode } from '../../api/lib/FloorPlanExchange.ts'
import {
	FORMAT,
	ImportHolds,
	buildExport,
	exportFileName,
	localNodes,
	matchScore,
	parseImport,
	proposeMatches,
} from '../../api/lib/FloorPlanExchange.ts'

// a real 1x1 PNG
const PNG1 = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64',
)
const fresh = async () =>
	new FloorPlans(await mkdtemp(path.join(tmpdir(), 'floorplans-exchange-')))
const K = (n: number) => `zwave:cdfbb3c7:${n}`

// this network, home cdfbb3c7
const node = (
	id: number,
	name: string,
	loc: string,
	deviceId: string,
	extra: Partial<LocalNode> = {},
): LocalNode => ({
	key: K(id),
	id,
	name,
	loc,
	deviceId,
	controller: false,
	...extra,
})
const LOCAL = [
	node(1, 'wopr3', 'Geek Cave', '134-1-90', { controller: true }),
	node(2, 'GeekCave_Lights', 'Geek Cave', '29-12341-17479'),
	node(14, 'Thermostat', 'Hallway', '57-1-17479'),
	node(60, 'Zwift Fan', 'Paincave', '99-1-1'),
	node(61, 'Zwift PC', 'Paincave', '99-1-1'),
]
const entry = (ref: string, fields: Partial<FileNode>): FileNode => ({
	ref,
	homeId: null,
	nodeId: null,
	name: null,
	loc: null,
	deviceId: null,
	productLabel: null,
	manufacturer: null,
	firmwareVersion: null,
	controller: false,
	...fields,
})
const json = (obj: unknown) => Buffer.from(JSON.stringify(obj))

describe('#FloorPlanExchange', () => {
	it('builds device keys from the running network only', () => {
		const nodes = new Map([
			[1, { id: 1, name: 'ctrl', isControllerNode: true }],
			[5, { id: 5, name: 'Lamp', loc: 'Den' }],
		])
		expect(localNodes({ homeHex: '0xcdfbb3c7', nodes })).toMatchObject([
			{ key: K(1), controller: true },
			{ key: K(5), name: 'Lamp', loc: 'Den', controller: false },
		])
		expect(localNodes({ homeHex: undefined, nodes })).toEqual([])
		expect(localNodes(undefined)).toEqual([])
	})

	it('ignores the device ID of nodes interviewed without their IDs', () => {
		const BAD = 'undefined-undefined-undefined'
		const nodes = new Map([
			[5, { id: 5, name: 'Lamp', deviceId: BAD }],
			[6, { id: 6, name: 'Lamp', deviceId: BAD }],
		])
		const local = localNodes({ homeHex: '0xcdfbb3c7', nodes })
		expect(local.map((n) => n.deviceId)).toEqual([undefined, undefined])
		const file = parseImport(
			json({
				format: FORMAT,
				version: 1,
				backgrounds: [],
				maps: [{ name: 'M', widthPx: 1, heightPx: 1, placements: [] }],
				nodes: [{ ref: 'a', name: 'Lamp', deviceId: BAD }],
			}),
		)
		expect(file.nodes[0].deviceId).toBeNull()
		// same name only: possible, not likely, and two candidates tie
		expect(matchScore(file.nodes[0], local[0], 'cdfbb3c7')).toBe(1)
		expect(proposeMatches(file.nodes, local, 'cdfbb3c7').a).toEqual({
			key: null,
			confidence: 'none',
			tied: 2,
		})
	})

	it('names exports zwjsui_floorplan_YYYYMMDD.json', () => {
		expect(exportFileName(new Date(2026, 9, 7))).toBe(
			'zwjsui_floorplan_20261007.json',
		)
	})

	it('scores matches: certain, likely, possible, none', () => {
		const thermo = LOCAL[2]
		const score = (
			fields: Partial<FileNode>,
			n = thermo,
			home = 'cdfbb3c7',
		) => matchScore(entry('a', fields), n, home)
		const same = { name: 'Thermostat', deviceId: '57-1-17479' }
		// same network, same node
		expect(score({ homeId: 'cdfbb3c7', nodeId: 14, ...same })).toBe(3)
		// the controller only ever matches the controller
		expect(score({ controller: true, name: 'old' }, LOCAL[0])).toBe(3)
		expect(score({ controller: true, ...same })).toBe(0)
		expect(score({ name: 'wopr3' }, LOCAL[0])).toBe(0)
		// same network and node, never named: certain on the model alone
		const unnamed = { ...thermo, name: 'NodeID 14' }
		const ids = { homeId: 'cdfbb3c7', nodeId: 14, deviceId: '57-1-17479' }
		expect(score({ ...ids, name: 'NodeID 14' }, unnamed)).toBe(3)
		expect(score({ ...ids, name: null })).toBe(3)
		// ...but a real name that differs is worth a look
		expect(score({ ...ids, name: 'Old thermostat' })).toBe(0)
		// and a generic name on another network proves nothing
		expect(score({ ...ids, homeId: 'aaaa', name: 'NodeID 14' })).toBe(0)
		// other network, same name and model
		expect(
			score({ homeId: 'aaaa', nodeId: 27, ...same, name: 'thermostat ' }),
		).toBe(2)
		// same model and location, or same name only
		expect(score({ deviceId: '57-1-17479', loc: 'hallway' })).toBe(1)
		expect(score({ name: 'Thermostat' })).toBe(1)
		// generic names never match, a model alone is no evidence
		expect(
			score(
				{ name: 'NodeID 14', deviceId: '1-1-1' },
				{ ...thermo, name: 'NodeID 14' },
				'x',
			),
		).toBe(0)
		expect(score({ deviceId: '57-1-17479' })).toBe(0)
	})

	it('proposes one local node per entry and leaves ties to the user', () => {
		const m = proposeMatches(
			[
				entry('t', {
					homeId: 'cdfbb3c7',
					nodeId: 14,
					name: 'Thermostat',
					deviceId: '57-1-17479',
				}),
				entry('l', {
					homeId: 'ffff',
					nodeId: 9,
					name: 'GeekCave_Lights',
					deviceId: '29-12341-17479',
				}),
				// two Paincave 99-1-1 nodes: a tie
				entry('f', { deviceId: '99-1-1', loc: 'Paincave' }),
				entry('c', { controller: true, name: 'old controller' }),
				entry('x', { name: 'Garage Door' }),
			],
			LOCAL,
			'cdfbb3c7',
		)
		expect(m.t).toEqual({ key: K(14), confidence: 'certain' })
		expect(m.l).toEqual({ key: K(2), confidence: 'likely' })
		expect(m.f).toEqual({ key: null, confidence: 'none', tied: 2 })
		expect(m.c).toEqual({ key: K(1), confidence: 'certain' })
		expect(m.x).toEqual({ key: null, confidence: 'none' })

		// two entries naming the same node as their only best: neither gets it
		const twice = proposeMatches(
			[
				entry('a', { name: 'Thermostat' }),
				entry('b', { name: 'Thermostat' }),
			],
			LOCAL,
			'cdfbb3c7',
		)
		expect([twice.a.key, twice.b.key]).toEqual([null, null])

		// a node taken at a stronger level isn't offered again lower down
		const once = proposeMatches(
			[
				entry('a', {
					homeId: 'cdfbb3c7',
					nodeId: 14,
					name: 'Thermostat',
					deviceId: '57-1-17479',
				}),
				entry('b', { name: 'Thermostat' }),
			],
			LOCAL,
			'cdfbb3c7',
		)
		expect([once.a.key, once.b.key]).toEqual([K(14), null])
	})

	it('round trips several maps, sharing a background image once', async () => {
		const src = await fresh()
		const house = await src.addMap({ name: 'House' })
		await src.setMapImage(house.id, { bytes: PNG1 })
		await src.setMapImage(house.id, { bytes: PNG1, variant: 'dark' })
		const [bgId] = (await src.load()).backgrounds.map((b) => b.id)
		// a second map on the same background
		const upstairs = await src.addMap({
			name: 'Upstairs',
			backgroundId: bgId,
		})
		const yard = await src.addMap({
			name: 'Yard',
			widthPx: 400,
			heightPx: 300,
		})
		await src.updateMap(house.id, {
			widthPx: 3000,
			heightPx: 5100,
			nodes: { start: 'include', exceptions: [K(60)] },
			view: { center: [5, 6], zoom: 1, layers: { ...DEFAULT_LAYERS } },
		})
		await src.setPlacement(house.id, {
			deviceKey: K(14),
			x: 100,
			y: 200,
			seen: { name: 'Thermostat', deviceId: '57-1-17479' },
		})
		await src.setPlacement(house.id, { deviceKey: K(2), x: 300, y: 400 })
		await src.setPlacement(house.id, { deviceKey: K(1), x: 1, y: 1 })
		await src.setPlacement(upstairs.id, { deviceKey: K(14), x: 0, y: 0 })
		await src.setPlacement(yard.id, { deviceKey: K(99), x: 9, y: 9 })

		const out = await buildExport({
			data: await src.load(),
			nodes: LOCAL,
			imagesDir: src.imagesDir,
			homeId: 'cdfbb3c7',
			appVersion: '11.24.3',
		})
		expect(out.format).toBe(FORMAT)
		expect(out.maps.map((m) => m.name)).toEqual([
			'House',
			'Upstairs',
			'Yard',
		])
		expect(out.backgrounds).toHaveLength(1)
		expect(out.backgrounds[0].image.data).toBeTruthy()
		expect(out.backgrounds[0].imageDark.data).toBeTruthy()
		expect(out.maps[1].background.ref).toBe(out.maps[0].background.ref)
		expect(out.maps[2].background).toBeNull()
		// the manifest covers every placed node and node list exception once;
		// a node gone from the network is described from its snapshot
		expect(out.nodes.map((n) => n.name)).toEqual([
			'Thermostat',
			'GeekCave_Lights',
			'wopr3',
			'Zwift Fan',
			null,
		])
		expect(out.nodes[2].controller).toBe(true)
		expect(out.maps[0].nodes).toEqual({
			start: 'include',
			exceptions: ['n4'],
		})
		expect(JSON.stringify(out.maps)).not.toContain('zwave:')

		// only the chosen maps
		const one = await buildExport({
			data: await src.load(),
			mapIds: [yard.id],
			nodes: LOCAL,
			imagesDir: src.imagesDir,
		})
		expect(one.maps.map((m) => m.name)).toEqual(['Yard'])
		expect(one.backgrounds).toEqual([])
		await expect(
			buildExport({
				data: await src.load(),
				mapIds: ['nope'],
				nodes: [],
				imagesDir: src.imagesDir,
			}),
		).rejects.toThrow('No such map')

		// import onto another network that already has a "House"
		const parsed = parseImport(json(out))
		const dst = await fresh()
		await dst.addMap({ name: 'House' })
		const ref = (i: number) => out.nodes[i].ref
		const decisions = {
			[ref(0)]: 'zwave:aaaa:27',
			[ref(1)]: null,
			[ref(2)]: 'zwave:aaaa:1',
			[ref(3)]: 'zwave:aaaa:61',
			[ref(4)]: null,
		}
		const res = await dst.importMaps(parsed, decisions, [
			{ key: 'zwave:aaaa:27', name: 'Thermo', deviceId: '57-1-17479' },
		])
		expect(res.maps.map((m) => m.name)).toEqual([
			'House (imported)',
			'Upstairs',
			'Yard',
		])
		expect([res.linked, res.placeholders]).toEqual([3, 2])

		const data = await dst.load()
		const [h, u, y] = res.maps.map((m) =>
			data.maps.find((x) => x.id === m.id),
		)
		expect([h.widthPx, h.heightPx]).toEqual([3000, 5100])
		expect(h.nodes).toEqual({
			start: 'include',
			exceptions: ['zwave:aaaa:61'],
		})
		expect(h.view.center).toEqual([5, 6])
		// both maps use one new background, with both images on disk
		expect(u.background.id).toBe(h.background.id)
		const bg = data.backgrounds.find((b) => b.id === h.background.id)
		expect(existsSync(dst.imagePath(bg))).toBe(true)
		expect(existsSync(dst.imagePath(bg, 'dark'))).toBe(true)
		expect(
			h.placements.find((p) => p.deviceKey === 'zwave:aaaa:27'),
		).toEqual({
			deviceKey: 'zwave:aaaa:27',
			x: 100,
			y: 200,
			seen: { name: 'Thermo', deviceId: '57-1-17479' },
		})
		const ph = h.placements.find((p) => p.placeholder)
		expect(ph.placeholder.name).toBe('GeekCave_Lights')
		expect([ph.x, ph.y]).toEqual([300, 400])
		expect(y.placements[0]).toMatchObject({ deviceKey: null, x: 9, y: 9 })

		// never overwrites
		const none = Object.fromEntries(out.nodes.map((n) => [n.ref, null]))
		const again = await dst.importMaps(parsed, none)
		expect(again.maps[0].name).toBe('House (imported 2)')
		// every entry needs a decision, and one device per entry
		await expect(
			dst.importMaps(parsed, { [ref(0)]: 'zwave:aaaa:27' }),
		).rejects.toThrow('No decision')
		await expect(
			dst.importMaps(
				parsed,
				Object.fromEntries(
					out.nodes.map((n) => [n.ref, 'zwave:aaaa:27']),
				),
			),
		).rejects.toThrow('same device')
		await expect(
			dst.importMaps(parsed, { ...none, [ref(0)]: 'bogus' }),
		).rejects.toThrow('Bad device')
	})

	it('refuses bad files with a clear reason', () => {
		const ok = {
			format: FORMAT,
			version: 1,
			backgrounds: [],
			maps: [{ name: 'M', widthPx: 10, heightPx: 10, placements: [] }],
			nodes: [],
		}
		expect(parseImport(json(ok)).maps[0].name).toBe('M')
		const bad = (obj: unknown, msg: string) =>
			expect(() =>
				parseImport(
					typeof obj === 'string' ? Buffer.from(obj) : json(obj),
				),
			).toThrow(msg)
		bad('not json', 'not JSON')
		bad({ ...ok, format: 'toposite-map' }, 'wrong format')
		bad({ ...ok, version: 2 }, "version 2 isn't supported")
		bad({ ...ok, maps: [] }, 'map list')
		bad({ ...ok, maps: [{ ...ok.maps[0], widthPx: 0 }] }, 'map size')
		bad(
			{
				...ok,
				backgrounds: [
					{
						ref: 'b1',
						image: {
							data: Buffer.from('<svg/>').toString('base64'),
						},
					},
				],
			},
			"isn't a PNG, JPEG or WebP",
		)
		bad(
			{
				...ok,
				maps: [
					{ ...ok.maps[0], background: { ref: 'b9', imageRect: {} } },
				],
			},
			'unknown background',
		)
		bad({ ...ok, nodes: [{ ref: 'a' }, { ref: 'a' }] }, 'unique')
		bad(
			{
				...ok,
				maps: [
					{ ...ok.maps[0], placements: [{ ref: 'x', x: 1, y: 1 }] },
				],
			},
			'unknown node',
		)
		bad(
			{
				...ok,
				nodes: [{ ref: 'a' }],
				maps: [
					{
						...ok.maps[0],
						placements: [{ ref: 'a', x: 'one', y: 1 }],
					},
				],
			},
			'invalid coordinates',
		)
	})

	it('holds previewed imports for 10 minutes, newest few only', () => {
		const holds = new ImportHolds()
		const file = parseImport(
			json({
				format: FORMAT,
				version: 1,
				backgrounds: [],
				maps: [{ name: 'M', widthPx: 1, heightPx: 1, placements: [] }],
				nodes: [],
			}),
		)
		const t0 = 1_000_000
		const token = holds.hold(file, t0)
		expect(holds.get(token, t0 + 9 * 60_000)).toBe(file)
		expect(() => holds.get(token, t0 + 11 * 60_000)).toThrow('expired')
		expect(() => holds.get(undefined)).toThrow('expired')

		const first = holds.hold(file, t0)
		holds.hold(file, t0)
		holds.hold(file, t0)
		holds.hold(file, t0)
		expect(() => holds.get(first, t0)).toThrow('expired')
	})
})
