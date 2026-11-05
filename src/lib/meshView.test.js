import { describe, it, expect } from 'vitest'
import {
	agoLabel,
	batteryLevelClass,
	gridPlacements,
	mapView,
	meshHealth,
	nodeColor,
	RATE_LEGEND,
	rateColor,
	routeSegments,
	rssiLabel,
	statusOf,
	toRssi,
} from './meshView.js'

// store node objects, values from a live 11.24.2 mesh (2026-10-09)
const route = (repeaters, rssi, repeaterRSSI, rate, routeFailedBetween) => ({
	repeaters,
	rssi,
	repeaterRSSI,
	protocolDataRate: rate,
	...(routeFailedBetween ? { routeFailedBetween } : {}),
})
const node = (id, { lwr, nlwr, ...extra } = {}) => ({
	id,
	name: `n${id}`,
	loc: '',
	available: true,
	failed: false,
	neighbors: [],
	statistics: { lwr, nlwr },
	...extra,
})

const NODES = [
	node(1, { isControllerNode: true }),
	node(2, { lwr: route([], -76, [], 3), neighbors: [1, 3] }),
	node(3, { lwr: route([2], -75, [127], 1), neighbors: [2] }),
	node(59, { lwr: route([2, 3], -75, [127, -74], 3) }),
	node(68, { nlwr: route([], 127, [], 3) }),
	node(75, { available: false }),
	node(78, { lwr: route([2], -94, [-95], 1, [2, 78]) }),
]

describe('meshView', () => {
	it('colors nodes by hop count, 5+ hops dark purple', () => {
		expect(nodeColor(NODES[0])).toBe('#7e57c2')
		expect(nodeColor(NODES[1])).toBe('#00BCD4')
		expect(nodeColor(NODES[3])).toBe('#F1C40F')
		const far = (n) =>
			node(9, { lwr: route([...Array(n).keys()], -75, [], 3) })
		expect(nodeColor(far(4))).toBe('#4a148c')
		expect(nodeColor(far(6))).toBe('#4a148c')
		// NLWR is used when there is no LWR
		expect(nodeColor(NODES[4])).toBe('#00BCD4')
		expect(nodeColor(NODES[5])).toBe('#8b0000')
		expect(nodeColor(node(9))).toBe('#666666')
		expect(statusOf(node(9, { failed: true, available: false }))).toBe(
			'failed',
		)
	})

	it('maps RSSI error codes and labels hops controller → repeaters → node', () => {
		expect([127, 126, 125, -60, undefined].map(toRssi)).toEqual([
			null,
			'saturated',
			'no-signal',
			-60,
			null,
		])
		const segs = routeSegments(NODES[3], NODES[3].statistics.lwr, 1)
		expect(segs.map((s) => [s.from, s.to, s.rssi])).toEqual([
			[1, 2, -75],
			[2, 3, null],
			[3, 59, -74],
		])
		expect([1, 2, 3, 4, undefined].map(rateColor)).toEqual([
			'#8b0000',
			'#F1C40F',
			'#2DCC70',
			'#3F51B5',
			'#666666',
		])
		// the legend uses the same colors as the lines
		expect(RATE_LEGEND.map(([, c]) => c)).toEqual(
			[1, 2, 3, 4].map(rateColor),
		)
		expect(rssiLabel(-74)).toBe('-74 dBm')
		expect(rssiLabel(null)).toBe('')
		expect(rssiLabel('no-signal')).toBe('no signal')
	})

	it('map view: hidden repeaters on shown routes become ghosts', () => {
		// 59 routes 1 → 2 → 3 → 59; only 59 and the controller are shown,
		// 2 is placed on this map, 3 isn't
		const v = mapView(
			NODES,
			new Set([1, 59]),
			new Map([
				[1, [0, 0]],
				[2, [0, 100]],
				[59, [0, 400]],
				[75, [9, 9]],
			]),
		)
		const g = Object.fromEntries(v.ghosts.map((x) => [x.id, x]))
		// only route repeaters, not other hidden nodes
		expect(Object.keys(g).map(Number)).toEqual([2, 3])
		expect([g[2].approx, g[2].pos]).toEqual([false, [0, 100]])
		// unplaced: midway between its route neighbors
		expect([g[3].approx, g[3].pos, g[3].kind]).toEqual([
			true,
			[0, 250],
			'lwr',
		])
		expect(v.links.map((l) => `${l.kind}:${l.a}-${l.b}`).sort()).toEqual([
			'lwr:1-2',
			'lwr:2-3',
			'lwr:3-59',
		])
		expect(v.pos.has(75)).toBe(false)

		// shown but not placed, and on a route: an approximate ghost
		const v2 = mapView(
			NODES,
			new Set([1, 2, 3, 59]),
			new Map([
				[1, [0, 0]],
				[2, [0, 100]],
				[59, [0, 400]],
			]),
		)
		const g3 = v2.ghosts.find((x) => x.id === 3)
		expect([g3.approx, g3.shown]).toEqual([true, true])
		expect(
			v2.links.some(
				(l) => l.kind === 'neighbor' && l.a === 2 && l.b === 1,
			),
		).toBe(true)
		// no neighbor lines to a node that is only a ghost
		expect(
			v2.links.some(
				(l) => l.kind === 'neighbor' && (l.a === 3 || l.b === 3),
			),
		).toBe(false)

		// NLWR-only repeaters are 'nlwr' ghosts
		const extra = [
			...NODES,
			node(80, {
				lwr: route([], -60, [], 3),
				nlwr: route([68], -70, [-71], 3),
			}),
		]
		const v3 = mapView(
			extra,
			new Set([1, 80]),
			new Map([
				[1, [0, 0]],
				[80, [0, 200]],
			]),
		)
		expect(v3.ghosts.map((x) => [x.id, x.kind, x.pos])).toEqual([
			[68, 'nlwr', [0, 100]],
		])

		// no positioned anchor on one side: nothing is drawn
		const v4 = mapView(NODES, new Set([59]), new Map([[59, [0, 400]]]))
		expect([v4.ghosts.length, v4.links.length]).toEqual([0, 0])

		// failed hops are drawn
		const v5 = mapView(
			NODES,
			new Set([1, 2, 78]),
			new Map([
				[1, [0, 0]],
				[2, [0, 100]],
				[78, [0, 200]],
			]),
		)
		expect(v5.links.some((l) => l.kind === 'failed')).toBe(true)
	})

	it('flags isolated, few neighbors, weak hops, backup-only, failed hops, one-way links', () => {
		const h = meshHealth(NODES)
		const f = (id) => h.nodes.get(id)
		// tables known for 2 of 7 nodes: too few to judge neighbor counts
		expect(f(59)?.reasons.some((r) => /neighbor/i.test(r))).toBeFalsy()
		expect(f(78)).toEqual({
			level: 'bad',
			reasons: ['Failed hop 2 → 78', 'Weak signal on its route'],
		})
		expect(f(68).reasons[0]).toBe(
			'Running on its backup route (no last working route)',
		)
		// dead is shown by the color already
		expect(f(75)).toBeUndefined()
		expect(h.hops.map((x) => [x.a, x.b, x.level])).toEqual([
			[1, 2, 'warn'],
			[2, 78, 'bad'],
		])
		// node 2 lists 1, but 1 has no table to compare
		expect(h.oneWay).toEqual([])

		const mesh = [
			node(1, { isControllerNode: true, neighbors: [2, 3] }),
			node(2, { lwr: route([], -60, [], 3), neighbors: [1, 3] }),
			// 2 lists 3, 3 doesn't list 2
			node(3, { lwr: route([], -60, [], 3), neighbors: [1] }),
			node(4, { lwr: route([], -60, [], 3), neighbors: [] }),
			node(5),
		]
		const h2 = meshHealth(mesh)
		expect(h2.nodes.get(4)).toEqual({
			level: 'bad',
			reasons: ['Isolated, no neighbors'],
		})
		expect(h2.nodes.get(3)).toEqual({
			level: 'warn',
			reasons: ['Only 1 neighbor'],
		})
		expect(h2.nodes.get(5).reasons).toContain('No route statistics yet')
		expect(h2.oneWay).toEqual([{ from: 2, to: 3 }])
		// no signal is a very weak hop
		const h3 = meshHealth([
			node(1, { isControllerNode: true }),
			node(2, { lwr: route([], 125, [], 3) }),
		])
		expect(h3.nodes.get(2).level).toBe('bad')
	})

	it('battery tag levels and report ages', () => {
		expect([90, 30, 16, 15, 0, null].map(batteryLevelClass)).toEqual([
			'ok',
			'warn',
			'warn',
			'bad',
			'bad',
			null,
		])
		const now = 1760000000000
		expect(
			[
				now - 30e3,
				now - 20 * 60e3,
				now - 3 * 3600e3,
				now - 3 * 86400e3,
				null,
			].map((t) => agoLabel(t, now)),
		).toEqual(['just now', '20 min ago', '3 h ago', '3 days ago', 'never'])
	})

	it('lays unplaced nodes out in a grid along the bottom, around placed ones', () => {
		const nodes = [
			{ id: 9, name: 'b', loc: 'Den' },
			{ id: 5, name: 'a', loc: 'Den' },
			{ id: 7, name: 'z', loc: 'Attic' },
		]
		// 1600 px wide: 16 cells of 100 px, bottom row at y = 950
		const out = gridPlacements(nodes, [], 1600, 1000)
		expect(out).toEqual([
			{ id: 7, x: 50, y: 950 },
			{ id: 5, x: 150, y: 950 },
			{ id: 9, x: 250, y: 950 },
		])
		// a placed node in the first cell pushes the grid along
		const around = gridPlacements(nodes, [[60, 940]], 1600, 1000)
		expect(around.map((p) => p.x)).toEqual([150, 250, 350])
		// more nodes than cells: the grid gets finer, still on the canvas
		const many = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }))
		const fit = gridPlacements(many, [], 400, 100)
		expect(new Set(fit.map((p) => `${p.x},${p.y}`)).size).toBe(100)
		expect(
			fit.every((p) => p.x >= 0 && p.x <= 400 && p.y >= 0 && p.y <= 100),
		).toBe(true)
	})
})
