<template>
	<div class="floor-plan" ref="container" v-resize="onResize">
		<div class="floor-plan-map" ref="map"></div>
		<v-chip
			v-if="unplacedCount"
			class="floor-plan-notice"
			size="small"
			prepend-icon="info"
		>
			{{ unplacedCount }} shown node{{ unplacedCount === 1 ? '' : 's' }}
			not placed on this map yet
		</v-chip>
	</div>
</template>

<script>
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { protocolDataRateToString } from '@zwave-js/core'
import ConfigApis from '@/apis/ConfigApis.js'
import {
	HEALTH_COLORS,
	agoLabel,
	batteryLevelClass,
	hopsOf,
	lwrOf,
	mapView,
	meshHealth,
	nlwrOf,
	nodeColor,
	rateColor,
	rssiLabel,
	statusOf,
} from '@/lib/meshView.js'

// map view layers saved with each map, with their labels
const LAYERS = [
	['routes', 'Routes (last working)'],
	['backupRoutes', 'Backup routes (next-to-last)'],
	['neighbors', 'Neighbors (when known)'],
	['nodes', 'Nodes'],
	['names', 'Node names'],
	['health', 'Mesh health'],
	['battery', 'Battery level'],
]

const esc = (s) =>
	String(s ?? '').replace(
		/[&<>"']/g,
		(c) =>
			({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;',
			})[c],
	)

const nameOf = (n) => n.name || `NodeID ${n.id}`

function labelOf(n) {
	const status = statusOf(n)
	if (status === 'failed') return `FAILED: ${nameOf(n)}`
	if (status === 'dead') return `DEAD: ${nameOf(n)}`
	return nameOf(n)
}

function polygon(cx, cy, r, count, inner = null) {
	const pts = []
	const steps = inner ? count * 2 : count
	for (let i = 0; i < steps; i++) {
		const radius = inner && i % 2 ? inner : r
		const a = (Math.PI * 2 * i) / steps - Math.PI / 2
		pts.push(
			`${(cx + radius * Math.cos(a)).toFixed(1)},${(cy + radius * Math.sin(a)).toFixed(1)}`,
		)
	}
	return pts.join(' ')
}

export default {
	name: 'FloorPlanMap',
	props: {
		/** the floorplan map to show */
		map: { type: Object, required: true },
		backgrounds: { type: Array, default: () => [] },
		/** store nodes */
		nodes: { type: Array, default: () => [] },
		homeHex: { type: String, default: '' },
		dark: Boolean,
	},
	emits: ['node-click'],
	data() {
		return { unplacedCount: 0 }
	},
	computed: {
		/** broadcast and multicast nodes aren't part of the mesh, as in the graph */
		physicalNodes() {
			return this.nodes.filter((n) => !n.virtual)
		},
		homeKey() {
			return (this.homeHex || '').replace(/^0x/, '')
		},
		/** what drawing depends on, so value updates don't redraw the map */
		drawKey() {
			return JSON.stringify([
				this.map,
				this.backgrounds,
				this.homeKey,
				this.dark,
				this.physicalNodes.map((n) => [
					n.id,
					n.name,
					n.loc,
					n.failed,
					n.available,
					n.isControllerNode,
					n.isListening,
					n.isFrequentListening,
					n.neighbors,
					n.minBatteryLevel,
					n.lastActive,
					n.statistics?.lwr,
					n.statistics?.nlwr,
				]),
			])
		},
	},
	watch: {
		drawKey() {
			this.drawSoon()
		},
		'map.id'() {
			this.fitted = false
		},
	},
	mounted() {
		const lmap = L.map(this.$refs.map, {
			crs: L.CRS.Simple,
			minZoom: -5,
			maxZoom: 3,
			zoomSnap: 0.25,
			attributionControl: false,
		})
		// backgrounds get their own pane, always under the route lines
		lmap.createPane('floorplan-background').style.zIndex = 300
		this.groups = Object.fromEntries(
			[...LAYERS.map(([k]) => k), 'background'].map((k) => [
				k,
				L.layerGroup(),
			]),
		)
		this.groups.background.addTo(lmap)
		const overlays = Object.fromEntries(
			LAYERS.map(([k, label]) => [label, this.groups[k]]),
		)
		L.control.layers(null, overlays, { position: 'topright' }).addTo(lmap)
		// the names layer draws nothing itself, it shows the node labels
		lmap.on('overlayadd overlayremove', (e) => {
			if (e.layer === this.groups.names) {
				lmap.getContainer().classList.toggle(
					'show-names',
					e.type === 'overlayadd',
				)
			}
		})
		lmap.on('click', () => this.$emit('node-click', null))
		this.lmap = lmap
		this.fitted = false
		this.draw()
	},
	beforeUnmount() {
		cancelAnimationFrame(this.frame)
		this.lmap?.remove()
		this.lmap = null
	},
	methods: {
		onResize() {
			this.lmap?.invalidateSize()
		},
		drawSoon() {
			cancelAnimationFrame(this.frame)
			this.frame = requestAnimationFrame(() => this.draw())
		},
		keyOf(node) {
			return `zwave:${this.homeKey}:${node.id}`
		},
		isShown(node) {
			const { start, exceptions } = this.map.nodes
			const flipped = exceptions.includes(this.keyOf(node))
			return start === 'include' ? !flipped : flipped
		},
		/** canvas px (y down) → Leaflet [lat, lng] (y up) */
		toLatLng(x, y) {
			return [this.map.heightPx - y, x]
		},
		draw() {
			const lmap = this.lmap
			if (!lmap) return
			for (const g of Object.values(this.groups)) g.clearLayers()
			const { widthPx: w, heightPx: h } = this.map
			const bounds = [
				[0, 0],
				[h, w],
			]

			this.drawBackground()
			if (!this.fitted) this.applyView(bounds)

			const byKey = new Map(
				this.physicalNodes.map((n) => [this.keyOf(n), n]),
			)
			const shown = new Set(
				this.physicalNodes
					.filter((n) => this.isShown(n))
					.map((n) => n.id),
			)
			const positioned = new Map()
			for (const p of this.map.placements) {
				const n = p.deviceKey && byKey.get(p.deviceKey)
				if (n) positioned.set(n.id, this.toLatLng(p.x, p.y))
			}
			this.unplacedCount = [...shown].filter(
				(id) => !positioned.has(id),
			).length

			const view = mapView(this.physicalNodes, shown, positioned)
			const ghostIds = new Set(view.ghosts.map((g) => g.id))
			const nodePos = new Map(
				[...view.pos].filter(([id]) => !ghostIds.has(id)),
			)
			this.drawLinks(view.links, view.pos)
			this.drawGhosts(view.ghosts)
			this.drawNodes(nodePos)
			this.drawHealth(nodePos, view.pos)
			this.drawBattery(nodePos)
			this.drawPlaceholders()
		},
		drawBackground() {
			const { widthPx: w, heightPx: h, background } = this.map
			const bg =
				background &&
				this.backgrounds.find((b) => b.id === background.id)
			const file = bg && ((this.dark && bg.imageDark) || bg.image)
			if (file) {
				// imageRect: where the picture sits on the canvas, in canvas px
				const r = background.imageRect
				L.imageOverlay(
					ConfigApis.floorPlanImageUrl(file),
					[
						this.toLatLng(r.x, r.y + r.h),
						this.toLatLng(r.x + r.w, r.y),
					],
					{ pane: 'floorplan-background' },
				).addTo(this.groups.background)
			} else {
				L.rectangle(
					[
						[0, 0],
						[h, w],
					],
					{
						color: '#888888',
						weight: 1,
						dashArray: '4 4',
						fill: false,
						interactive: false,
						pane: 'floorplan-background',
					},
				).addTo(this.groups.background)
			}
		},
		/** a newly opened map: its saved view (zoom, center, layers), else fit it */
		applyView(bounds) {
			const v = this.map.view ?? {}
			if (Array.isArray(v.center) && typeof v.zoom === 'number') {
				this.lmap.setView(v.center, v.zoom, { animate: false })
			} else {
				this.lmap.fitBounds(bounds, {
					padding: [20, 20],
					animate: false,
				})
			}
			for (const [k] of LAYERS) {
				if (v.layers?.[k] ?? true) this.groups[k].addTo(this.lmap)
				else this.lmap.removeLayer(this.groups[k])
			}
			this.lmap
				.getContainer()
				.classList.toggle(
					'show-names',
					this.lmap.hasLayer(this.groups.names),
				)
			this.fitted = true
		},
		nameById() {
			const byId = new Map(this.physicalNodes.map((n) => [n.id, n]))
			return (id) =>
				esc(byId.has(id) ? nameOf(byId.get(id)) : `NodeID ${id}`)
		},
		drawLinks(links, pos) {
			const name = this.nameById()
			for (const l of links) {
				const a = pos.get(l.a)
				const b = pos.get(l.b)
				const tip = `${name(l.a)} ↔ ${name(l.b)}`
				if (l.kind === 'neighbor') {
					L.polyline([a, b], {
						color: '#888888',
						weight: 1,
						opacity: 0.45,
						interactive: false,
					}).addTo(this.groups.neighbors)
				} else if (l.kind === 'failed') {
					L.polyline([a, b], {
						color: '#8b0000',
						weight: 1.5,
						dashArray: '2 4',
					})
						.bindTooltip(`${tip}<br>Failed ❌`, { sticky: true })
						.addTo(this.groups.routes)
				} else {
					const lwr = l.kind === 'lwr'
					const detail = [
						rssiLabel(l.rssi),
						l.rate ? protocolDataRateToString(l.rate) : '',
					]
						.filter(Boolean)
						.join(' · ')
					L.polyline([a, b], {
						color: rateColor(l.rate),
						weight: lwr ? 4 : 1.5,
						dashArray: lwr ? null : '5 5',
						opacity: 0.85,
					})
						.bindTooltip(
							`${tip}<br>${detail}<br><span class="muted">route of ${l.routes.map(name).join(', ')}</span>`,
							{ sticky: true },
						)
						.addTo(
							lwr ? this.groups.routes : this.groups.backupRoutes,
						)
				}
			}
		},
		nodeIcon(n) {
			const color = nodeColor(n)
			const stroke = statusOf(n) === 'ok' ? '#222' : '#fff'
			let shape
			if (n.isControllerNode) {
				shape = `<polygon points="${polygon(12, 12, 12, 5, 5)}" fill="${color}" stroke="${stroke}" stroke-width="1.5"/>`
			} else if (n.isListening) {
				shape = `<polygon points="${polygon(12, 12, 10, 6)}" fill="${color}" stroke="${stroke}" stroke-width="1.5"/>`
			} else {
				shape = `<rect x="3" y="3" width="18" height="18" rx="2" fill="${color}" stroke="${stroke}" stroke-width="1.5"/>`
			}
			return L.divIcon({
				className: 'floorplan-node',
				iconSize: [24, 24],
				iconAnchor: [12, 12],
				html: `<svg width="24" height="24" viewBox="0 0 24 24">${shape}</svg><span class="lbl">${esc(labelOf(n))}</span>`,
			})
		},
		nodeTooltip(n) {
			const lines = [`<b>${esc(labelOf(n))}</b> (node ${n.id})`]
			if (n.loc) lines.push(esc(n.loc))
			const route = lwrOf(n) ?? nlwrOf(n)
			if (route) {
				const hops = hopsOf(n)
				const via = route.repeaters?.length
					? ` via ${route.repeaters.join(' → ')}`
					: ' (direct)'
				lines.push(
					`${hops} hop${hops > 1 ? 's' : ''}${via}${lwrOf(n) ? '' : ', backup route only'}`,
				)
			} else if (!n.isControllerNode) {
				lines.push('No route statistics')
			}
			if (n.minBatteryLevel != null) {
				lines.push(
					`Battery ${n.minBatteryLevel}% · last heard from ${agoLabel(n.lastActive)}`,
				)
			}
			if (n.neighbors?.length) {
				lines.push(`Neighbors: ${n.neighbors.join(', ')}`)
			}
			return lines.join('<br>')
		},
		drawNodes(pos) {
			for (const n of this.physicalNodes) {
				const p = pos.get(n.id)
				if (!p) continue
				L.marker(p, { icon: this.nodeIcon(n), keyboard: false })
					.bindTooltip(this.nodeTooltip(n), {
						direction: 'top',
						offset: [0, -14],
					})
					.on('click', (e) => {
						L.DomEvent.stopPropagation(e)
						this.$emit('node-click', n)
					})
					.addTo(this.groups.nodes)
			}
		},
		/**
		 * Nodes on a shown node's route that aren't drawn as nodes here:
		 * small grey dots, dashed when the spot is approximate
		 */
		drawGhosts(ghosts) {
			const byId = new Map(this.physicalNodes.map((n) => [n.id, n]))
			for (const g of ghosts) {
				const n = byId.get(g.id)
				const label = n ? labelOf(n) : `NodeID ${g.id}`
				const why = g.shown
					? 'Not placed on this map yet'
					: 'Hidden on this map'
				const where = g.approx
					? 'drawn midway between its route neighbors'
					: 'shown at its spot on this map'
				L.marker(g.pos, {
					keyboard: false,
					icon: L.divIcon({
						className: `floorplan-node floorplan-ghost${g.approx ? ' approx' : ''}`,
						iconSize: [12, 12],
						iconAnchor: [6, 6],
						html: `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5"/></svg><span class="lbl">${esc(label)}</span>`,
					}),
				})
					.bindTooltip(
						`<b>${esc(label)}</b> (node ${g.id})<br>${why}. It repeats for a shown node's ${g.kind === 'lwr' ? 'route' : 'backup route'}, so it's ${where}.`,
						{ direction: 'top', offset: [0, -8] },
					)
					.addTo(
						g.kind === 'lwr'
							? this.groups.routes
							: this.groups.backupRoutes,
					)
			}
		},
		/** a ring around flagged nodes, "!" on weak hops, dotted one-way neighbor lines */
		drawHealth(nodePos, allPos) {
			const h = meshHealth(this.physicalNodes)
			const name = this.nameById()
			for (const [id, f] of h.nodes) {
				const p = nodePos.get(id)
				if (!p) continue
				L.circleMarker(p, {
					radius: 17,
					color: HEALTH_COLORS[f.level],
					weight: 3,
					fill: false,
				})
					.bindTooltip(f.reasons.map(esc).join('<br>'), {
						direction: 'top',
						offset: [0, -14],
					})
					.addTo(this.groups.health)
			}
			for (const hop of h.hops) {
				if (hop.kind !== 'lwr') continue
				const a = allPos.get(hop.a)
				const b = allPos.get(hop.b)
				if (!a || !b) continue
				L.marker([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], {
					keyboard: false,
					icon: L.divIcon({
						className: `floorplan-hopwarn ${hop.level}`,
						iconSize: [16, 16],
						iconAnchor: [8, 8],
						html: '!',
					}),
				})
					.bindTooltip(
						`${hop.level === 'bad' ? 'Very weak' : 'Weak'} hop ${name(hop.a)} ↔ ${name(hop.b)}: ${esc(rssiLabel(hop.rssi))}`,
						{ direction: 'top' },
					)
					.addTo(this.groups.health)
			}
			for (const w of h.oneWay) {
				const a = nodePos.get(w.from)
				const b = nodePos.get(w.to)
				if (!a || !b) continue
				L.polyline([a, b], {
					color: HEALTH_COLORS.warn,
					weight: 2,
					dashArray: '1 6',
					lineCap: 'round',
				})
					.bindTooltip(
						`One-way: ${name(w.from)} lists ${name(w.to)} as a neighbor, but not the other way round`,
						{ sticky: true },
					)
					.addTo(this.groups.health)
			}
		},
		drawBattery(nodePos) {
			for (const n of this.physicalNodes) {
				const p = nodePos.get(n.id)
				const level = n.minBatteryLevel
				if (!p || level == null) continue
				L.marker(p, {
					keyboard: false,
					icon: L.divIcon({
						className: `floorplan-batt ${batteryLevelClass(level)}`,
						iconSize: null,
						iconAnchor: [-14, 8],
						html: `${level}%`,
					}),
				})
					.bindTooltip(
						`${esc(nameOf(n))}: battery ${level}%, last heard from ${agoLabel(n.lastActive)}`,
						{ direction: 'top' },
					)
					.addTo(this.groups.battery)
			}
		},
		/** imported positions not linked to a node yet */
		drawPlaceholders() {
			for (const p of this.map.placements) {
				if (!p.placeholder) continue
				const label = p.placeholder.name || 'Unknown device'
				const detail = [p.placeholder.loc, p.placeholder.productLabel]
					.filter(Boolean)
					.map(esc)
					.join(' · ')
				L.marker(this.toLatLng(p.x, p.y), {
					keyboard: false,
					icon: L.divIcon({
						className: 'floorplan-node floorplan-placeholder',
						iconSize: [20, 20],
						iconAnchor: [10, 10],
						html: `<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/></svg><span class="lbl">${esc(label)}</span>`,
					}),
				})
					.bindTooltip(
						`<b>${esc(label)}</b>${detail ? `<br>${detail}` : ''}<br>Imported position, not linked to a node yet`,
						{ direction: 'top', offset: [0, -10] },
					)
					.addTo(this.groups.nodes)
			}
		},
	},
}
</script>

<style>
.floor-plan {
	position: relative;
	height: 100%;
	min-height: 300px;
}

.floor-plan-map {
	height: 100%;
	background: rgb(var(--v-theme-surface));
}

.floor-plan-notice {
	position: absolute;
	left: 12px;
	bottom: 12px;
	z-index: 500;
}

.floorplan-node {
	overflow: visible;
}

.floorplan-node .lbl {
	display: none;
	position: absolute;
	top: 100%;
	left: 50%;
	transform: translateX(-50%);
	white-space: nowrap;
	font-size: 11px;
	padding: 0 3px;
	border-radius: 3px;
	color: rgb(var(--v-theme-on-surface));
	background: rgba(var(--v-theme-surface), 0.75);
	pointer-events: none;
}

.show-names .floorplan-node .lbl {
	display: block;
}

.floorplan-ghost circle {
	fill: #9e9e9e;
	stroke: #616161;
	stroke-width: 1;
}

.floorplan-ghost.approx circle {
	fill: none;
	stroke-dasharray: 2 2;
}

.floorplan-placeholder circle {
	fill: none;
	stroke: #9e9e9e;
	stroke-width: 2;
	stroke-dasharray: 3 3;
}

.floorplan-hopwarn {
	border-radius: 50%;
	color: #fff;
	font-weight: bold;
	font-size: 12px;
	line-height: 16px;
	text-align: center;
}

.floorplan-hopwarn.warn {
	background: #ff9800;
}

.floorplan-hopwarn.bad {
	background: #e53935;
}

.floorplan-batt {
	white-space: nowrap;
	font-size: 10px;
	padding: 0 3px;
	border-radius: 3px;
	color: #fff;
	background: #616161;
}

.floorplan-batt.warn {
	background: #ff9800;
}

.floorplan-batt.bad {
	background: #e53935;
}

.leaflet-tooltip .muted {
	opacity: 0.7;
}
</style>
