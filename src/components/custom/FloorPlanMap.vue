<template>
	<div class="floor-plan" ref="container" :style="cssVars">
		<div
			class="floor-plan-map"
			ref="map"
			@dragover.prevent
			@drop.prevent="onDrop"
		></div>
		<v-card v-if="editing" class="floor-plan-tray" density="compact">
			<v-card-subtitle class="pt-2"> Nodes on this map </v-card-subtitle>
			<v-card-text class="pa-1 text-caption">
				Drag a node with
				<v-icon size="x-small">open_with</v-icon> onto the map. Drag
				placed nodes to move them, right-click to remove one.
			</v-card-text>
			<div v-if="unplacedCount" class="px-2 pb-2">
				<v-btn
					size="small"
					variant="tonal"
					prepend-icon="grid_view"
					block
					v-tooltip="
						'In a grid along the bottom, the controller in the middle'
					"
					@click="placeAll"
					>Place all {{ unplacedCount }}</v-btn
				>
			</div>
			<v-list density="compact" class="py-0">
				<v-list-item
					v-for="e in entries"
					:key="e.node.id"
					:draggable="e.shown && !e.placed"
					@dragstart="onDragStart($event, e.node)"
					:class="{ 'floor-plan-draggable': e.shown && !e.placed }"
				>
					<template #prepend>
						<v-checkbox-btn
							:model-value="e.shown"
							density="compact"
							@update:model-value="setShown(e.node, $event)"
						></v-checkbox-btn>
					</template>
					<v-list-item-title class="text-body-2">
						{{ labelOf(e.node) }}
					</v-list-item-title>
					<template #append>
						<v-icon
							v-if="e.shown && !e.placed"
							size="small"
							v-tooltip="'Drag onto the map'"
							>open_with</v-icon
						>
						<v-icon
							v-else-if="e.placed"
							size="small"
							color="success"
							v-tooltip="'Placed on this map'"
							>place</v-icon
						>
					</template>
				</v-list-item>
			</v-list>
		</v-card>
		<div class="floor-plan-bottom-left">
			<mesh-legend />
			<v-chip
				v-if="unplacedCount && !editing"
				size="small"
				prepend-icon="info"
			>
				{{ plural(unplacedCount, 'shown node') }} not placed on this map
				yet, use Edit to place them
			</v-chip>
		</div>
	</div>
</template>

<script>
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { protocolDataRateToString } from '@zwave-js/core'
import ConfigApis from '@/apis/ConfigApis.js'
import MeshLegend from '@/components/custom/MeshLegend.vue'
import { escapeHtml } from '@/lib/accessControl.ts'
import { plural } from '@/lib/utils.js'
import {
	DEAD_COLOR,
	HEALTH_COLORS,
	NEIGHBOR_COLOR,
	agoLabel,
	batteryLevelClass,
	deviceKey,
	drawnShapeKey,
	gridPlacements,
	hopsOf,
	linkRssi,
	lwrOf,
	mapView,
	meshHealth,
	nlwrOf,
	nodeColor,
	nodeName,
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

const esc = (s) => escapeHtml(String(s ?? ''))

function labelOf(n) {
	const status = statusOf(n)
	if (status === 'failed') return `FAILED: ${nodeName(n)}`
	if (status === 'dead') return `DEAD: ${nodeName(n)}`
	return nodeName(n)
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
	components: { MeshLegend },
	props: {
		/** the floorplan map to show */
		map: { type: Object, required: true },
		/** store nodes */
		nodes: { type: Array, default: () => [] },
		homeHex: { type: String, default: '' },
		dark: Boolean,
		/** edit mode: node list, placing and moving nodes, saving the view */
		editing: Boolean,
	},
	emits: [
		'node-click',
		// { deviceKey, x, y } in canvas px
		'place',
		// [{ deviceKey, x, y }]
		'place-many',
		// deviceKey
		'unplace',
		// { start, exceptions }
		'set-nodes',
		// { center, zoom, layers }
		'view-change',
		// a background picture that couldn't be loaded: its file name
		'image-error',
	],
	computed: {
		/** colors the CSS uses, from meshView.js */
		cssVars() {
			return {
				'--floorplan-warn': HEALTH_COLORS.warn,
				'--floorplan-bad': HEALTH_COLORS.bad,
			}
		},
		/** broadcast and multicast nodes aren't part of the mesh, as in the graph */
		physicalNodes() {
			return this.nodes.filter((n) => !n.virtual)
		},
		placedKeys() {
			return new Set(this.map.placements.map((p) => p.deviceKey))
		},
		/** device keys whose shown state is the opposite of the map's rule */
		exceptionKeys() {
			return new Set(this.map.nodes.exceptions)
		},
		/** every node with whether it's shown and placed on this map */
		entries() {
			return this.physicalNodes.map((node) => ({
				node,
				shown: this.isShown(node),
				placed: this.placedKeys.has(this.keyOf(node)),
			}))
		},
		health() {
			return meshHealth(this.physicalNodes)
		},
		unplacedCount() {
			return this.entries.filter((e) => e.shown && !e.placed).length
		},
		/**
		 * What the nodes' drawing depends on, so value updates don't redraw
		 * the map. RSSI and times like lastActive are left out: tooltips read
		 * them when shown, and the health layer redraws on its own.
		 */
		nodesKey() {
			return this.physicalNodes.map(drawnShapeKey).join('\n')
		},
		/** what the health layer shows, without RSSI values (read by tooltips) */
		healthKey() {
			const h = this.health
			return JSON.stringify([
				[...h.nodes],
				h.hops.map(({ a, b, kind, level }) => [a, b, kind, level]),
				h.oneWay,
			])
		},
	},
	watch: {
		// the map itself is replaced, not changed in place, when it changes
		map() {
			this.drawSoon()
		},
		nodesKey() {
			this.drawSoon()
		},
		homeHex() {
			this.drawSoon()
		},
		dark() {
			this.drawSoon()
		},
		healthKey() {
			this.drawHealth()
		},
		// a pending view save belongs to the map it was made on
		'map.id'() {
			clearTimeout(this.viewTimer)
			this.viewTimer = null
			this.fitted = false
		},
		// a picture that resizes the canvas resets the saved view on the
		// server, so frame the new canvas
		'map.widthPx'() {
			this.fitted = false
		},
		'map.heightPx'() {
			this.fitted = false
		},
		// Done saves a view change still waiting to be saved
		editing(now) {
			if (!now && this.viewTimer) {
				clearTimeout(this.viewTimer)
				this.saveView()
			}
			this.drawSoon()
		},
	},
	created() {
		// pictures that failed to load, drawn as the outline instead
		this.brokenImages = new Set()
		// a marker is being dragged, and a draw() waits for it to end
		this.dragging = false
		this.drawPending = false
	},
	mounted() {
		const lmap = L.map(this.$refs.map, {
			crs: L.CRS.Simple,
			minZoom: -5,
			maxZoom: 3,
			// finer than Leaflet's defaults: a floorplan needs small steps
			zoomSnap: 0.1,
			zoomDelta: 0.5,
			wheelPxPerZoomLevel: 120,
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
		// while editing, pans, zooms and layer changes are saved as the map's view
		lmap.on('moveend overlayadd overlayremove', () => this.saveViewSoon())
		this.lmap = lmap
		this.fitted = false
		// the container also changes size without a window resize, e.g. when
		// the nav drawer opens
		this.resizer = new ResizeObserver(() => this.lmap?.invalidateSize())
		this.resizer.observe(this.$refs.container)
		this.draw()
	},
	beforeUnmount() {
		this.resizer?.disconnect()
		cancelAnimationFrame(this.frame)
		clearTimeout(this.viewTimer)
		this.lmap?.remove()
		this.lmap = null
	},
	methods: {
		labelOf,
		plural,
		onDragStart(event, node) {
			event.dataTransfer.setData('text/plain', String(node.id))
			event.dataTransfer.effectAllowed = 'move'
		},
		/** a node dropped from the tray onto the map */
		onDrop(event) {
			if (!this.editing || !this.lmap) return
			const id = Number(event.dataTransfer.getData('text/plain'))
			const node = this.physicalNodes.find((n) => n.id === id)
			if (!node) return
			const { lat, lng } = this.lmap.mouseEventToLatLng(event)
			this.place(node, lng, this.map.heightPx - lat)
		},
		/** every shown node not placed yet, in a grid along the bottom */
		placeAll() {
			const todo = this.entries
				.filter((e) => e.shown && !e.placed)
				.map((e) => e.node)
			const occupied = this.map.placements.map((p) => [p.x, p.y])
			const byId = new Map(todo.map((n) => [n.id, n]))
			const spots = gridPlacements(
				todo,
				occupied,
				this.map.widthPx,
				this.map.heightPx,
			)
			this.$emit(
				'place-many',
				spots.map(({ id, x, y }) => ({
					deviceKey: this.keyOf(byId.get(id)),
					x,
					y,
				})),
			)
		},
		place(node, x, y) {
			this.$emit('place', {
				deviceKey: this.keyOf(node),
				x: Math.round(x),
				y: Math.round(y),
			})
		},
		setShown(node, shown) {
			const key = this.keyOf(node)
			const { start, exceptions } = this.map.nodes
			// an exception flips the map's starting rule for that node
			const flip = start === 'include' ? !shown : shown
			const rest = exceptions.filter((k) => k !== key)
			this.$emit('set-nodes', {
				start,
				exceptions: flip ? [...rest, key] : rest,
			})
		},
		saveViewSoon() {
			if (!this.editing || this.applyingView) return
			clearTimeout(this.viewTimer)
			this.viewTimer = setTimeout(() => this.saveView(), 800)
		},
		saveView() {
			this.viewTimer = null
			if (!this.lmap) return
			const c = this.lmap.getCenter()
			const layers = Object.fromEntries(
				LAYERS.map(([k]) => [k, this.lmap.hasLayer(this.groups[k])]),
			)
			this.$emit('view-change', {
				center: [c.lat, c.lng],
				zoom: this.lmap.getZoom(),
				layers,
			})
		},
		/** the whole canvas: the picture, or the outline without one */
		canvasBounds() {
			return [
				[0, 0],
				[this.map.heightPx, this.map.widthPx],
			]
		},
		/** show the whole map; while editing, that becomes its saved view */
		fitToMap() {
			// no animation: moveend, and with it the view save, comes at once,
			// so a Done right after doesn't miss it
			this.lmap?.fitBounds(this.canvasBounds(), {
				padding: [20, 20],
				animate: false,
			})
		},
		/** a node's right-click menu; nothing changes until it is used */
		openNodeMenu(node, marker) {
			const box = document.createElement('div')
			const title = document.createElement('div')
			title.className = 'text-subtitle-2 mb-1'
			title.textContent = labelOf(node)
			const btn = document.createElement('button')
			btn.className = 'floorplan-menu-btn'
			btn.textContent = 'Remove from this map'
			btn.onclick = () => {
				this.lmap.closePopup()
				this.$emit('unplace', this.keyOf(node))
			}
			box.append(title, btn)
			L.popup({ offset: [0, -10] })
				.setLatLng(marker.getLatLng())
				.setContent(box)
				.openOn(this.lmap)
		},
		drawSoon() {
			cancelAnimationFrame(this.frame)
			this.frame = requestAnimationFrame(() => this.draw())
		},
		keyOf(node) {
			return deviceKey(this.homeHex, node.id)
		},
		isShown(node) {
			const flipped = this.exceptionKeys.has(this.keyOf(node))
			return this.map.nodes.start === 'include' ? !flipped : flipped
		},
		/** canvas px (y down) → Leaflet [lat, lng] (y up) */
		toLatLng(x, y) {
			return [this.map.heightPx - y, x]
		},
		draw() {
			const lmap = this.lmap
			if (!lmap) return
			// a redraw would destroy the marker being dragged and lose the
			// move: it waits for the drop
			if (this.dragging) {
				this.drawPending = true
				return
			}
			for (const g of Object.values(this.groups)) g.clearLayers()
			this.drawBackground()
			if (!this.fitted) this.applyView()

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
				const n = byKey.get(p.deviceKey)
				if (n) positioned.set(n.id, this.toLatLng(p.x, p.y))
			}

			const view = mapView(this.physicalNodes, shown, positioned)
			const ghostIds = new Set(view.ghosts.map((g) => g.id))
			const nodePos = new Map(
				[...view.pos].filter(([id]) => !ghostIds.has(id)),
			)
			this.drawLinks(view.links, view.pos)
			this.drawGhosts(view.ghosts)
			this.drawNodes(nodePos)
			// kept for the health layer, which also redraws on its own
			this.drawn = {
				nodePos,
				allPos: view.pos,
				// route lines drawn, as 'a-b' with a < b
				routeLinks: new Set(
					view.links
						.filter((l) => l.kind === 'lwr')
						.map(
							(l) =>
								`${Math.min(l.a, l.b)}-${Math.max(l.a, l.b)}`,
						),
				),
			}
			this.drawHealth()
			this.drawBattery(nodePos)
		},
		drawBackground() {
			const { widthPx: w, heightPx: h, background: bg } = this.map
			// the theme's picture, else the other one
			const file = this.dark
				? (bg?.darkImage ?? bg?.image)
				: (bg?.image ?? bg?.darkImage)
			// a picture that failed to load isn't asked for again until reload
			if (file && !this.brokenImages.has(file)) {
				// imageRect: where the picture sits on the canvas, in canvas px
				const r = bg.imageRect
				L.imageOverlay(
					ConfigApis.floorPlanImageUrl(file),
					[
						this.toLatLng(r.x, r.y + r.h),
						this.toLatLng(r.x + r.w, r.y),
					],
					{ pane: 'floorplan-background' },
				)
					.on('error', () => {
						this.brokenImages.add(file)
						this.$emit('image-error', file)
						this.drawSoon()
					})
					.addTo(this.groups.background)
			} else {
				L.rectangle(
					[
						[0, 0],
						[h, w],
					],
					{
						color: NEIGHBOR_COLOR,
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
		applyView() {
			this.applyingView = true
			const v = this.map.view ?? {}
			if (Array.isArray(v.center) && typeof v.zoom === 'number') {
				this.lmap.setView(v.center, v.zoom, { animate: false })
			} else {
				this.fitToMap()
			}
			for (const [k] of LAYERS) {
				if (v.layers?.[k] ?? true) {
					this.groups[k].addTo(this.lmap)
				} else this.lmap.removeLayer(this.groups[k])
			}
			this.lmap
				.getContainer()
				.classList.toggle(
					'show-names',
					this.lmap.hasLayer(this.groups.names),
				)
			this.fitted = true
			// moveend fires after this returns, so let it pass first
			setTimeout(() => {
				this.applyingView = false
			}, 0)
		},
		nameById() {
			const byId = new Map(this.physicalNodes.map((n) => [n.id, n]))
			return (id) => esc(nodeName(byId.get(id) ?? { id }))
		},
		drawLinks(links, pos) {
			const name = this.nameById()
			for (const l of links) {
				const a = pos.get(l.a)
				const b = pos.get(l.b)
				const tip = `${name(l.a)} ↔ ${name(l.b)}`
				if (l.kind === 'neighbor') {
					L.polyline([a, b], {
						color: NEIGHBOR_COLOR,
						weight: 1,
						opacity: 0.45,
						interactive: false,
					}).addTo(this.groups.neighbors)
				} else if (l.kind === 'failed') {
					L.polyline([a, b], {
						color: DEAD_COLOR,
						weight: 1.5,
						dashArray: '2 4',
					})
						.bindTooltip(`${tip}<br>Failed ❌`, { sticky: true })
						.addTo(this.groups.routes)
				} else {
					const lwr = l.kind === 'lwr'
					// a backup route standing in for a missing main route:
					// as thick as a route, dashed like a backup route
					const backupOnly =
						lwr && l.backupOnly.length === l.routes.length
					// RSSI read when shown, so signal changes don't redraw
					const detail = () =>
						[
							rssiLabel(linkRssi(this.physicalNodes, l)),
							l.rate ? protocolDataRateToString(l.rate) : '',
						]
							.filter(Boolean)
							.join(' · ')
					const owners = l.routes
						.map((id) =>
							l.backupOnly.includes(id)
								? `${name(id)} (backup route, no main route known)`
								: name(id),
						)
						.join(', ')
					L.polyline([a, b], {
						color: rateColor(l.rate),
						weight: lwr ? 4 : 1.5,
						dashArray: backupOnly ? '10 8' : lwr ? null : '5 5',
						opacity: 0.85,
					})
						.bindTooltip(
							() =>
								`${tip}<br>${detail()}<br><span class="muted">route of ${owners}</span>`,
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
					`${plural(hops, 'hop')}${via}${lwrOf(n) ? '' : ', backup route only'}`,
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
				const marker = L.marker(p, {
					icon: this.nodeIcon(n),
					keyboard: false,
					draggable: this.editing,
				})
					// a function, so times are current when it opens
					.bindTooltip(() => this.nodeTooltip(n), {
						direction: 'top',
						offset: [0, -14],
					})
					.on('click', (e) => {
						L.DomEvent.stopPropagation(e)
						this.$emit('node-click', n)
					})
					.addTo(this.groups.nodes)
				if (this.editing) {
					marker.on('dragstart', () => {
						this.dragging = true
					})
					marker.on('dragend', () => {
						this.dragging = false
						const { lat, lng } = marker.getLatLng()
						this.place(n, lng, this.map.heightPx - lat)
						if (this.drawPending) {
							this.drawPending = false
							this.drawSoon()
						}
					})
					marker.on('contextmenu', (e) => {
						L.DomEvent.preventDefault(e.originalEvent)
						this.openNodeMenu(n, marker)
					})
				}
			}
		},
		/**
		 * Nodes on a shown node's route that aren't drawn as nodes here:
		 * small grey dots, dashed when the spot is approximate
		 */
		drawGhosts(ghosts) {
			const byId = new Map(this.physicalNodes.map((n) => [n.id, n]))
			const name = this.nameById()
			for (const g of ghosts) {
				const n = byId.get(g.id)
				const label = n ? labelOf(n) : nodeName({ id: g.id })
				const why = g.shown
					? 'Not placed on this map yet'
					: 'Hidden on this map'
				const where = g.approx
					? 'drawn midway between its route neighbors'
					: 'shown at its spot on this map'
				const owners = g.routes
					.map(
						(r) =>
							`${name(r.id)}'s ${r.kind === 'lwr' ? 'route' : 'backup route'}`,
					)
					.join(', ')
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
						`<b>${esc(label)}</b> (node ${g.id})<br>${why}. It repeats for ${owners}, so it's ${where}.`,
						{ direction: 'top', offset: [0, -8] },
					)
					.addTo(
						g.kind === 'lwr'
							? this.groups.routes
							: this.groups.backupRoutes,
					)
			}
		},
		/**
		 * A ring around flagged nodes, "!" on weak hops, dotted one-way
		 * neighbor lines, at the spots of the last draw()
		 */
		drawHealth() {
			if (!this.drawn) return
			const { nodePos, allPos, routeLinks } = this.drawn
			this.groups.health.clearLayers()
			const h = this.health
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
				// only on a drawn route line: a hidden node's weak hop between
				// two shown nodes has none
				const link = `${Math.min(hop.a, hop.b)}-${Math.max(hop.a, hop.b)}`
				if (hop.kind !== 'lwr' || !routeLinks.has(link)) continue
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
					// the current reading, not the one when this was drawn
					.bindTooltip(
						() => {
							const now = this.health.hops.find(
								(x) =>
									x.a === hop.a &&
									x.b === hop.b &&
									x.kind === hop.kind,
							)
							return `${hop.level === 'bad' ? 'Very weak' : 'Weak'} hop ${name(hop.a)} ↔ ${name(hop.b)}: ${esc(rssiLabel((now ?? hop).rssi))}`
						},
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
						() =>
							`${esc(nodeName(n))}: battery ${level}%, last heard from ${agoLabel(n.lastActive)}`,
						{ direction: 'top' },
					)
					.addTo(this.groups.battery)
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
	/* keep Leaflet's pane z-indexes (400-1000) inside the map, so the node
	   panel and dialogs above it aren't covered */
	isolation: isolate;
}

.floor-plan-map {
	height: 100%;
	background: rgb(var(--v-theme-surface));
}

.floor-plan-bottom-left {
	position: absolute;
	left: 12px;
	bottom: 12px;
	z-index: 500;
	display: flex;
	align-items: flex-end;
	gap: 8px;
}

.floor-plan-tray {
	position: absolute;
	top: 12px;
	left: 56px;
	bottom: 12px;
	width: 260px;
	overflow-y: auto;
	z-index: 500;
}

.floor-plan-draggable {
	cursor: grab;
}

.floorplan-menu-btn {
	display: block;
	width: 100%;
	padding: 4px 8px;
	border-radius: 4px;
	text-align: left;
}

.floorplan-menu-btn:hover {
	background: rgba(128, 128, 128, 0.2);
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

.floorplan-hopwarn {
	border-radius: 50%;
	color: #fff;
	font-weight: bold;
	font-size: 12px;
	line-height: 16px;
	text-align: center;
}

.floorplan-hopwarn.warn {
	background: var(--floorplan-warn);
}

.floorplan-hopwarn.bad {
	background: var(--floorplan-bad);
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
	background: var(--floorplan-warn);
}

.floorplan-batt.bad {
	background: var(--floorplan-bad);
}

.leaflet-tooltip .muted {
	opacity: 0.7;
}
</style>
