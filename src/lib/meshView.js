// Pure view logic for the mesh: node colors, route segments, the lines a map
// draws and mesh-health flags. No DOM, Vue or Leaflet here, so it is shared by
// the graph and the floorplan map and tested in Node.
//
// Nodes are the store's node objects (ZUINode).

import {
	ProtocolDataRate,
	RssiError,
	isRssiError,
	protocolDataRateToString,
	rssiToString,
} from '@zwave-js/core'

export const CONTROLLER_COLOR = '#7e57c2'
export const DEAD_COLOR = '#8b0000'
export const UNKNOWN_COLOR = '#666666'
export const NEIGHBOR_COLOR = '#888888'

// index = hop count
const HOP_COLORS = [null, '#00BCD4', '#2DCC70', '#F1C40F', '#E77E23', '#4a148c']

const RATE_COLORS = {
	[ProtocolDataRate.ZWave_9k6]: '#8b0000',
	[ProtocolDataRate.ZWave_40k]: '#F1C40F',
	[ProtocolDataRate.ZWave_100k]: '#2DCC70',
	[ProtocolDataRate.LongRange_100k]: '#3F51B5',
}

/** Node color for a route of `hops` hops (1 = direct); 5 and more share one */
export function hopColor(hops) {
	return HOP_COLORS[Math.min(hops, 5)]
}

/** Route line color for a data rate */
export function rateColor(rate) {
	return RATE_COLORS[rate] ?? UNKNOWN_COLOR
}

/** [label, color] for each route data rate */
export const RATE_LEGEND = [
	ProtocolDataRate.ZWave_9k6,
	ProtocolDataRate.ZWave_40k,
	ProtocolDataRate.ZWave_100k,
	ProtocolDataRate.LongRange_100k,
].map((rate) => [protocolDataRateToString(rate), RATE_COLORS[rate]])

export const HOP_LEGEND = [
	['Controller', CONTROLLER_COLOR],
	['1 hop', HOP_COLORS[1]],
	['2 hops', HOP_COLORS[2]],
	['3 hops', HOP_COLORS[3]],
	['4 hops', HOP_COLORS[4]],
	['5+ hops', HOP_COLORS[5]],
	['Dead / failed', DEAD_COLOR],
	['Unknown', UNKNOWN_COLOR],
]

// Mesh-health thresholds, first guesses to be tuned on a real mesh
export const HEALTH = {
	// dBm: a route hop at or below this is weak
	weakRssi: -85,
	// dBm: at or below this (or no signal) it is very weak
	veryWeakRssi: -95,
	// a node with fewer neighbors than this has little to route through
	fewNeighbors: 2,
}
export const HEALTH_COLORS = { warn: '#ff9800', bad: '#e53935' }

// battery tags turn amber / red at or below these percentages
export const BATTERY_LOW = { warn: 30, bad: 15 }

/** An RSSI value as reported (dBm or an RssiError code), or null when not measured */
export function toRssi(value) {
	return value == null || value === RssiError.NotAvailable ? null : value
}

/** "-74 dBm", "No signal detected" etc., as the graph labels its edges */
export function rssiLabel(rssi) {
	return rssi == null ? '' : rssiToString(rssi)
}

/**
 * A node's name for labels, or "NodeID <id>" when it has none. A name of
 * nothing but spaces, control or format characters (e.g. a zero-width
 * space) counts as none, or the label would be invisible.
 */
export function nodeName(node) {
	const name = node.name ?? ''
	return /^[\s\p{C}]*$/u.test(name) ? `NodeID ${node.id}` : name
}

/** The key a floorplan stores a node under: zwave:<home ID in hex>:<node ID> */
export function deviceKey(homeHex, nodeId) {
	return `zwave:${(homeHex || '').replace(/^0x/, '')}:${nodeId}`
}

/** 'failed' takes precedence over 'dead', as in the graph */
export function statusOf(node) {
	if (node.failed) return 'failed'
	if (!node.available) return 'dead'
	return 'ok'
}

export function lwrOf(node) {
	return node.statistics?.lwr ?? null
}

export function nlwrOf(node) {
	return node.statistics?.nlwr ?? null
}

/**
 * The routes a node is drawn with, as [kind, route, backupOnly]: LWR, and
 * NLWR, which is the main route (backupOnly) when there is no LWR
 */
function routesOf(node) {
	const lwr = lwrOf(node)
	const nlwr = nlwrOf(node)
	const out = []
	if (lwr) out.push(['lwr', lwr, false])
	if (nlwr) out.push([lwr ? 'nlwr' : 'lwr', nlwr, !lwr])
	return out
}

export function hopsOf(node) {
	const route = lwrOf(node) ?? nlwrOf(node)
	return route ? (route.repeaters?.length ?? 0) + 1 : null
}

export function nodeColor(node) {
	if (node.isControllerNode) return CONTROLLER_COLOR
	if (statusOf(node) !== 'ok') return DEAD_COLOR
	const hops = hopsOf(node)
	return hops ? hopColor(hops) : UNKNOWN_COLOR
}

export function batteryLevelClass(level) {
	if (level == null) return null
	if (level <= BATTERY_LOW.bad) return 'bad'
	return level <= BATTERY_LOW.warn ? 'warn' : 'ok'
}

/** "3 h ago" style age of a ms-since-epoch time */
export function agoLabel(ms, now = Date.now()) {
	if (!ms) return 'never'
	const s = Math.max(0, Math.round((now - ms) / 1000))
	if (s < 90) return 'just now'
	if (s < 5400) return `${Math.round(s / 60)} min ago`
	if (s < 129600) return `${Math.round(s / 3600)} h ago`
	return `${Math.round(s / 86400)} days ago`
}

function controllerIdOf(nodes) {
	return nodes.find((n) => n.isControllerNode)?.id ?? 1
}

/**
 * A route's hops as the graph draws them: controller → repeaters → node.
 * Hop i carries `rssi` (i = 0) or `repeaterRSSI[i - 1]`.
 */
export function routeSegments(node, route, controllerId) {
	const segs = []
	const reps = route.repeaters ?? []
	const rate = route.routeSpeed ?? route.protocolDataRate ?? null
	for (let i = 0; i <= reps.length; i++) {
		segs.push({
			from: i === 0 ? controllerId : reps[i - 1],
			to: i < reps.length ? reps[i] : node.id,
			rssi: toRssi(i === 0 ? route.rssi : route.repeaterRSSI?.[i - 1]),
			rate,
		})
	}
	return segs
}

const linkKey = (kind, a, b) => `${kind}:${Math.min(a, b)}-${Math.max(a, b)}`

/**
 * What a floorplan map draws, given which nodes are shown and where nodes
 * sit on it.
 *  - routes of shown nodes placed on this map, plus their failed hops
 *  - neighbor lines only between shown, positioned nodes
 *  - ghosts: nodes on a shown node's route that aren't drawn as nodes
 *    (hidden repeaters, or shown ones not placed yet). A ghost sits at its
 *    position on this map when it has one, else midway between its nearest
 *    positioned neighbors on the route (`approx`). Its kind is 'lwr' if any
 *    LWR-kind route uses it, else 'nlwr', so the backup routes layer hides it.
 *    `routes` lists the { id, kind } routes it repeats for.
 * `shown`: Set of node ids. `positioned`: Map id → [y, x] of every node with
 * a position on this map. Returns { links, ghosts, pos }, links being
 * { kind: 'lwr'|'nlwr'|'failed'|'neighbor', a, b, rssi, rate, routes,
 * backupOnly }, `backupOnly` listing the routes that are a backup route
 * drawn as the main one because their node has no main route.
 */
export function mapView(nodes, shown, positioned) {
	const cid = controllerIdOf(nodes)
	const ids = new Set(nodes.map((n) => n.id))
	const pos = new Map()
	for (const [id, p] of positioned) if (shown.has(id)) pos.set(id, p)
	const ghosts = new Map()

	const paths = []
	for (const n of nodes) {
		// a route is drawn once its node has a spot here, not before
		if (!pos.has(n.id)) continue
		for (const [kind, route, backupOnly] of routesOf(n)) {
			const path = [cid, ...(route.repeaters ?? []), n.id].filter((id) =>
				ids.has(id),
			)
			paths.push({ kind, n, route, path, backupOnly })
		}
	}
	// LWR first, so a node on both kinds of route is an 'lwr' ghost
	paths.sort(
		(a, b) => (a.kind === 'lwr' ? 0 : 1) - (b.kind === 'lwr' ? 0 : 1),
	)
	for (const { kind, path } of paths) {
		// exact ghosts: hidden nodes on the route with a position here
		for (const id of path) {
			if (pos.has(id) || shown.has(id) || !positioned.has(id)) continue
			pos.set(id, positioned.get(id))
			ghosts.set(id, {
				id,
				kind,
				pos: positioned.get(id),
				approx: false,
				shown: false,
				routes: [],
			})
		}
		// then anything still without a position: interpolate along the route
		for (let i = 0; i < path.length; i++) {
			const id = path[i]
			if (pos.has(id)) continue
			let j = i - 1
			while (j >= 0 && !pos.has(path[j])) j--
			let k = i + 1
			while (k < path.length && !pos.has(path[k])) k++
			if (j < 0 || k >= path.length) continue
			const [a, b] = [pos.get(path[j]), pos.get(path[k])]
			const t = (i - j) / (k - j)
			const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
			pos.set(id, p)
			ghosts.set(id, {
				id,
				kind,
				pos: p,
				approx: true,
				shown: shown.has(id),
				routes: [],
			})
		}
	}

	// whose routes each ghost repeats for
	for (const { kind, n, path } of paths) {
		for (const id of path) {
			const g = ghosts.get(id)
			if (g && !g.routes.some((r) => r.id === n.id && r.kind === kind)) {
				g.routes.push({ id: n.id, kind })
			}
		}
	}

	const links = new Map()
	const add = (kind, a, b, extra = {}) => {
		if (!pos.has(a) || !pos.has(b) || a === b) return
		const key = linkKey(kind, a, b)
		const l = links.get(key) ?? {
			kind,
			a,
			b,
			rssi: null,
			rate: null,
			routes: [],
			backupOnly: [],
		}
		if (l.rssi === null && extra.rssi !== undefined) l.rssi = extra.rssi
		if (l.rate === null && extra.rate !== undefined) l.rate = extra.rate
		if (extra.route !== undefined && !l.routes.includes(extra.route)) {
			l.routes.push(extra.route)
			if (extra.backupOnly) l.backupOnly.push(extra.route)
		}
		links.set(key, l)
	}
	for (const { kind, n, route, backupOnly } of paths) {
		for (const s of routeSegments(n, route, cid)) {
			add(kind, s.from, s.to, {
				rssi: s.rssi,
				rate: s.rate,
				route: n.id,
				backupOnly,
			})
		}
		if (route.routeFailedBetween) {
			const [a, b] = route.routeFailedBetween
			add('failed', a, b, { route: n.id })
		}
	}
	for (const n of nodes) {
		if (!shown.has(n.id) || ghosts.has(n.id)) continue
		for (const nb of n.neighbors ?? []) {
			if (shown.has(nb) && !ghosts.has(nb)) add('neighbor', n.id, nb)
		}
	}
	return { links: [...links.values()], ghosts: [...ghosts.values()], pos }
}

function hopLevel(rssi) {
	if (rssi == null || rssi === RssiError.ReceiverSaturated) return null
	if (rssi === RssiError.NoSignalDetected || rssi <= HEALTH.veryWeakRssi) {
		return 'bad'
	}
	return !isRssiError(rssi) && rssi <= HEALTH.weakRssi ? 'warn' : null
}

/**
 * Mesh-health flags:
 *  nodes: Map id → { level: 'warn'|'bad', reasons: [text] }
 *    bad:  no neighbors at all; a failed hop on its last working route
 *    warn: fewer than HEALTH.fewNeighbors neighbors; no route statistics;
 *          a weak hop on its main route; running on its backup route only
 *    Neighbor counts are judged only once neighbor tables are known for most
 *    of the mesh (they are a cache, empty until refreshed). Dead and failed
 *    are already shown by the node color, so they aren't repeated.
 *  hops: [{ a, b, kind, level, rssi }] weak route hops
 *  oneWay: [{ from, to }] `from` lists `to` as a neighbor but not the other
 *    way round (both tables known)
 */
export function meshHealth(nodes) {
	const cid = controllerIdOf(nodes)
	const byId = new Map(nodes.map((n) => [n.id, n]))
	const known = nodes.filter((n) => n.neighbors?.length).length
	const tablesKnown = nodes.length > 1 && known >= (nodes.length - 1) / 2
	const flags = new Map()
	const flag = (id, level, reason) => {
		const f = flags.get(id) ?? { level, reasons: [] }
		if (level === 'bad') f.level = 'bad'
		f.reasons.push(reason)
		flags.set(id, f)
	}
	const hops = new Map()
	for (const n of nodes) {
		if (n.isControllerNode) continue
		const ok = statusOf(n) === 'ok'
		if (tablesKnown && ok) {
			const count = n.neighbors?.length ?? 0
			if (count === 0) flag(n.id, 'bad', 'Isolated, no neighbors')
			else if (count < HEALTH.fewNeighbors) {
				flag(
					n.id,
					'warn',
					`Only ${count} neighbor${count === 1 ? '' : 's'}`,
				)
			}
		}
		if (!lwrOf(n) && !nlwrOf(n)) {
			if (ok) flag(n.id, 'warn', 'No route statistics yet')
		} else if (!lwrOf(n)) {
			flag(
				n.id,
				'warn',
				'Running on its backup route (no last working route)',
			)
		}
		for (const [kind, route] of routesOf(n)) {
			if (route.routeFailedBetween && kind === 'lwr') {
				flag(
					n.id,
					'bad',
					`Failed hop ${route.routeFailedBetween.join(' → ')}`,
				)
			}
			let worst = null
			for (const s of routeSegments(n, route, cid)) {
				const level = hopLevel(s.rssi)
				if (!level) continue
				const key = linkKey(kind, s.from, s.to)
				if (!hops.has(key) || level === 'bad') {
					hops.set(key, {
						a: s.from,
						b: s.to,
						kind,
						level,
						rssi: s.rssi,
					})
				}
				if (worst !== 'bad') worst = level
			}
			if (worst && kind === 'lwr') {
				flag(n.id, worst, 'Weak signal on its route')
			}
		}
	}
	const oneWay = []
	for (const n of nodes) {
		for (const nb of n.neighbors ?? []) {
			const other = byId.get(nb)
			if (other?.neighbors?.length && !other.neighbors.includes(n.id)) {
				oneWay.push({ from: n.id, to: nb })
			}
		}
	}
	return { nodes: flags, hops: [...hops.values()], oneWay }
}

/**
 * Starting spots for nodes not placed yet: a grid along the bottom of the
 * canvas, filled bottom row first, sorted by location, name and ID. Grid
 * cells near an already placed node (`occupied`, [x, y] canvas px) are
 * skipped, and the grid gets finer until every node fits. The controller
 * goes in the middle instead, so it stands out.
 * Returns [{ id, x, y }] in canvas px (y down).
 */
export function gridPlacements(nodes, occupied, widthPx, heightPx) {
	const controller = nodes.find((n) => n.isControllerNode)
	if (controller) {
		const center = [Math.round(widthPx / 2), Math.round(heightPx / 2)]
		const rest = gridPlacements(
			nodes.filter((n) => n !== controller),
			[...occupied, center],
			widthPx,
			heightPx,
		)
		return [{ id: controller.id, x: center[0], y: center[1] }, ...rest]
	}
	const sorted = [...nodes].sort(
		(a, b) =>
			(a.loc ?? '').localeCompare(b.loc ?? '') ||
			(a.name ?? '').localeCompare(b.name ?? '') ||
			a.id - b.id,
	)
	for (let perRow = 16; ; perRow = Math.ceil(perRow * 1.5)) {
		const step = widthPx / perRow
		const rows = Math.max(1, Math.floor(heightPx / step))
		const cells = []
		for (let row = 0; row < rows && cells.length < sorted.length; row++) {
			const y = heightPx - step * (row + 0.5)
			for (
				let col = 0;
				col < perRow && cells.length < sorted.length;
				col++
			) {
				const x = step * (col + 0.5)
				const near = occupied.some(
					([ox, oy]) => Math.hypot(ox - x, oy - y) < step * 0.6,
				)
				if (!near) cells.push([x, y])
			}
		}
		// past one cell per pixel nothing finer helps: stack what's left
		if (cells.length === sorted.length || step < 1) {
			return sorted.map((n, i) => {
				const [x, y] = cells[i] ??
					cells[cells.length - 1] ?? [0, heightPx]
				return { id: n.id, x: Math.round(x), y: Math.round(y) }
			})
		}
	}
}
