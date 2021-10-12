<template>
	<div>
		<v-expansion-panels>
			<v-expansion-panel>
				<v-expansion-panel-header> Options </v-expansion-panel-header>
				<v-expansion-panel-content>
					<v-row>
						<v-col>
							<v-subheader>Legend</v-subheader>
							<v-list dense>
								<v-list-item
									v-for="(item, i) in legends"
									:key="i"
								>
									<v-list-item-icon>
										<v-icon :color="item.color"
											>turned_in</v-icon
										>
									</v-list-item-icon>
									<v-list-item-content>
										<v-list-item-title
											:style="{ color: item.textColor }"
											v-text="item.text"
										></v-list-item-title>
									</v-list-item-content>
								</v-list-item>
							</v-list>
						</v-col>
						<v-col>
							<v-subheader>Layout</v-subheader>

							<v-radio-group v-model="ranker">
								<v-radio
									v-for="(item, i) in layouts"
									:key="i"
									:label="item.text"
									:value="item.value"
								></v-radio>
							</v-radio-group>
						</v-col>
						<v-col>
							<v-subheader>Edges</v-subheader>

							<v-radio-group v-model="edgesVisibility">
								<v-radio
									v-for="(item, i) in edgesLegend"
									:key="i"
									:label="item.text"
									:value="item.value"
								></v-radio>
							</v-radio-group>
						</v-col>
						<v-col>
							<v-subheader>Grouping</v-subheader>

							<v-radio-group v-model="grouping">
								<v-radio
									v-for="(item, i) in groupingLegend"
									:key="i"
									:label="item.text"
									:value="item.value"
								></v-radio>
							</v-radio-group>
						</v-col>
					</v-row>
				</v-expansion-panel-content>
			</v-expansion-panel>
		</v-expansion-panels>
		<v-row class="mt-5" style="height: 776px">
			<v-col
				align-self="center"
				class="text-center"
				v-show="loading"
				cols="12"
			>
				<v-progress-circular
					:size="50"
					color="primary"
					indeterminate
				></v-progress-circular>
			</v-col>
			<v-col class="fill-height" :style="{ visible: !loading }" ref="content" cols="12">
			</v-col>
		</v-row>
	</div>
</template>

<style>
.thumb {
	border: 1px solid #ddd;
	position: absolute;
	bottom: 5px;
	right: 5px;
	margin: 1px;
	padding: 1px;
	overflow: hidden;
}

#miniSvg {
	z-index: 110;
	background: white;
}

#scopeContainer {
	z-index: 120;
}

svg > .output {
	fill: #3598db;
	stroke: #2470a2;
}

.node > rect {
	stroke: black;
}

.node.layer-1 > rect,
.edgePath.layer-1 > path {
	fill: #3f51b5;
	stroke: #1a237e;
}

.node.layer-1 > polygon,
.node.layer-1 > rect,
.edgePath.layer-1 > path {
	fill: #3f51b5;
	stroke: #1a237e;
}

.node.layer-1 text {
	fill: #ffffff;
}

.node.layer-2 > polygon,
.node.layer-2 > rect,
.edgePath.layer-2 > path {
	stroke: #009688;
}

.node.layer-2 > rect,
.edgePath.layer-2 > path {
	fill: #00bcd4;
}

.node.layer-2 text {
	fill: #006064;
}

.node.layer-3 > polygon,
.node.layer-3 > rect,
.edgePath.layer-3 > path {
	stroke: #1d8548;
}

.node.layer-3 > rect,
.edgePath.layer-3 > path {
	fill: #2dcc70;
}

.node.layer-3 text {
	fill: #1d8548;
}

.node.layer-4 > polygon,
.node.layer-4 > rect,
.edgePath.layer-4 > path {
	stroke: #d25400;
}

.node.layer-4 > rect,
.edgePath.layer-4 > path {
	fill: #f1c40f;
}

.node.layer-5 > polygon,
.node.layer-4 text {
	fill: #d25400;
}

.node.layer-5 > polygon,
.node.layer-5 > rect,
.edgePath.layer-5 > path {
	stroke: #d25400;
}

.node.layer-5 > rect,
.edgePath.layer-5 > path {
	fill: #e77e23;
}

.node.layer-5 text {
	fill: #d25400;
}

.node.Error > polygon,
.node.Error > rect {
	fill: #ff7676;
	stroke: #8b0000;
}

.node.Error text {
	fill: #8b0000;
}

.node.unset > rect {
	stroke: #666;
}

.node.unset > polygon,
.node.unset > rect {
	stroke: #666;
	fill: lightgray;
}

.cluster > rect {
	stroke: lightgray;
	fill: transparent;
	stroke-width: 1px;
	stroke-linecap: round;
}

.cluster > .label {
	/* stroke: gray; */
	fill: lightgray;
}

.node.unset text {
	fill: #666;
}

.node text {
	font-size: 12px;
}

.edgePath.layer-1 > path {
	fill: transparent;
}

.edgePath path {
	stroke: #333;
	fill: #333;
}

.node > polygon {
	opacity: 0.7;
}

.node > rect {
	stroke-width: 1px;
	stroke-linecap: round;
}
</style>

<script>
// Code ported from https://github.com/AdamNaj/ZWaveGraphHA/blob/master/zwavegraph3.js

import * as d3 from 'd3'
import * as dagreD3 from 'dagre-d3'
import * as svgPanZoom from 'svg-pan-zoom'
import * as Hammer from 'hammerjs'

// when need to test this, just uncomment this line and find replace `this.nodes` with `testNodes`
// import testNodes from '@/assets/testNodes.json'

export default {
	props: {
		nodes: {
			type: [Array],
		},
	},
	computed: {
		content() {
			return this.$refs.content
		},
		isDark() {
			return this.$vuetify.theme.dark
		},
	},
	data() {
		return {
			edgesVisibility: 'relevant',
			grouping: 'ungrouped',
			refreshTimeout: null,
			ranker: 'network-simplex',
			loading: false,
			htmlTemplate: `
      <svg id="svg" width="100%" height="100%"></svg>
    <svg id="scopeContainer" class="thumb">
      <g>
        <rect
          id="scope"
          fill="red"
          fill-opacity="0.03"
          stroke="red"
          stroke-width="1px"
          stroke-opacity="0.3"
          x="0"
          y="0"
          width="0"
          height="0"
        />
        <!-- <line ref="line1" stroke="red" stroke-width="1px" x1="0" y1="0" x2="0" y2="0" />
              <line ref="line2" stroke="red" stroke-width="1px" x1="0" y1="0" x2="0" y2="0" /> -->
      </g>
    </svg>
    <svg id="miniSvg" class="thumb"></svg>
      `,
			legends: [
				{
					color: '#3F51B5',
					textColor: '#2470A2',
					text: 'Controller',
				},
				{
					color: '#00BCD4',
					textColor: '#006064',
					text: '1 hop',
				},
				{
					color: '#2DCC70',
					textColor: '#1D8548',
					text: '2 hops',
				},
				{
					color: '#F1C40F',
					textColor: '#D25400',
					text: '3 hops',
				},
				{
					color: '#E77E23',
					textColor: '#D25400',
					text: '4 hops',
				},
				{
					color: '#8b0000',
					textColor: '#8b0000',
					text: 'Failed Node',
				},
				{
					color: '#666666',
					textColor: '#666666',
					text: 'Unconnected',
				},
			],
			layouts: [
				{
					text: 'Network Simplex',
					value: 'network-simplex',
				},
				{
					text: 'Tight Tree',
					value: 'tight-tree',
				},
				{
					text: 'Longest Path',
					value: 'longest-path',
				},
			],
			edgesLegend: [
				{
					text: 'Relevant Neighbors',
					value: 'relevant',
				},
				{
					text: 'All Neighbors',
					value: 'all',
				},
			],
			groupingLegend: [
				{
					text: 'Z-Wave Locations',
					value: 'z-wave',
				},
				{
					text: 'Ungrouped',
					value: 'ungrouped',
				},
			],
		}
	},
	watch: {
		nodes() {
			this.debounceRefresh()
		},
		ranker() {
			this.debounceRefresh()
		},
		edgesVisibility() {
			this.debounceRefresh()
		},
		grouping() {
			this.debounceRefresh()
		},
		isDark() {
			this.updateLabelsColor()
		},
	},
	mounted() {
		this.debounceRefresh()
	},
	beforeDestroy() {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout)
		}
	},
	methods: {
		updateLabelsColor() {
			d3.select('#svg')
				.selectAll('g.cluster text')
				.style('fill', this.isDark ? 'lightgrey' : 'black')
		},
		debounceRefresh() {
			if (this.refreshTimeout) {
				clearTimeout(this.refreshTimeout)
			}

			this.loading = true

			this.content.innerHTML = this.htmlTemplate

			this.refreshTimeout = setTimeout(this.paintGraph.bind(this), 1000)
		},
		get(selector) {
			return this.content.querySelector(selector)
		},
		paintGraph() {
			this.get('#svg').innerHTML = ''
			this.get('#miniSvg').innerHTML = ''

			// https://github.com/dagrejs/dagre/wiki#using-dagre
			const g = new dagreD3.graphlib.Graph({
				compound: true,
			}).setGraph({})
			g.graph().rankDir = 'BT'
			g.graph().nodesep = 10
			g.graph().ranker = this.ranker

			// Create the renderer
			// eslint-disable-next-line new-cap
			const render = new dagreD3.render()

			const svg = d3.select('#svg')
			const inner = svg
				.append('g')
				.attr('transform', 'translate(20,200)scale(1)')

			g.graph().minlen = 0

			// Add our custom shape (a house): https://dagrejs.github.io/project/dagre-d3/latest/demo/user-defined.html
			render.shapes().house = this.renderHouse
			render.shapes().battery = this.renderBattery

			const { edges, nodes } = this.listNodes()
			// Set the parents to define which nodes belong to which cluster

			// add nodes  to graph
			for (let i = 0; i < nodes.length; i++) {
				const node = nodes[i]
				g.setNode(node.id, node)
				if (
					this.grouping !== 'ungrouped' &&
					node.loc !== '' &&
					node.loc !== undefined
				) {
					g.setNode(node.loc, {
						label: node.loc,
						clusterLabelPos: 'bottom',
						class: 'group',
					})
					g.setParent(node.id, node.loc)
				}
			}

			// add edges to graph
			for (let i = 0; i < edges.length; i++) {
				g.setEdge(edges[i].from, edges[i].to, {
					label: '',
					arrowhead: 'undirected',
					style: edges[i].style,
					class: edges[i].class,
					curve: d3.curveBundle.beta(0.2),
					// curve: d3.curveBasis
				})
			}

			// Run the renderer. This is what draws the final graph.
			render(inner, g)

			this.updateLabelsColor()

			// create battery state gradients
			for (let layer = 0; layer < this.legends.length; layer++) {
				for (let percent = 0; percent <= 100; percent += 10) {
					const grad = svg
						.append('defs')
						.append('linearGradient')
						.attr('id', 'fill-' + (layer + 1) + '-' + percent)
						.attr('x1', '0%')
						.attr('x2', '0%')
						.attr('y1', '0%')
						.attr('y2', '100%')
					grad.append('stop')
						.attr('offset', 100 - percent - 10 + '%')
						.style('stop-color', 'white')
					grad.append('stop')
						.attr('offset', 100 - percent + '%')
						.style('stop-color', this.legends[layer].color)
				}
			}

			// Add the title element to be used for a tooltip (SVG functionality)
			inner
				.selectAll('g.node')
				.append('title')
				.html(function (d) {
					return g.node(d).title
				})

			inner
				.selectAll('g.node')
				.attr('layer', function (d) {
					return g.node(d).layer
				})
				.attr('fill', function (d) {
					if (g.node(d).battery_level === 100) {
						return 'url(#fill-' + g.node(d).layer + '-100)'
					}
					if (g.node(d).battery_level !== undefined) {
						return (
							'url(#fill-' +
							g.node(d).layer +
							'-' +
							Math.floor((g.node(d).battery_level / 10) % 10) +
							'0)'
						)
					}
				})

			inner.selectAll('g.edgePath').attr('layer', function (d) {
				return g.edges(d).layer
			})

			const selection = svg.selectAll('.node')

			const nodeList = selection.nodes()

			// append handlers
			selection
				.on('mouseover', this.handleMouseOver.bind(this, nodeList))
				.on('mouseout', this.handleMouseOut.bind(this, nodeList))
				.on('click tap', this.handleClick.bind(this, nodeList))

			setTimeout(this.bindThumbnail.bind(this), 500)
		},
		bindThumbnail() {
			this.get('#miniSvg').innerHTML = this.get('#svg').innerHTML
			// https://github.com/ariutta/svg-pan-zoom
			const main = svgPanZoom('#svg', {
				zoomEnabled: true,
				controlIconsEnabled: true,
				fit: true,
				center: true,
				customEventsHandler: {
					haltEventListeners: [
						'touchstart',
						'touchend',
						'touchmove',
						'touchleave',
						'touchcancel',
					],
					init: function (options) {
						const instance = options.instance
						let initialScale = 1
						let pannedX = 0
						let pannedY = 0

						// Init Hammer
						// Listen only for pointer and touch events
						this.hammer = Hammer(options.svgElement, {
							inputClass: Hammer.SUPPORT_POINTER_EVENTS
								? Hammer.PointerEventInput
								: Hammer.TouchInput,
						})

						// Enable pinch
						this.hammer.get('pinch').set({
							enable: true,
						})

						// Handle double tap
						this.hammer.on('doubletap', function () {
							instance.zoomIn()
						})

						// Handle pan
						this.hammer.on('panstart panmove', function (ev) {
							// On pan start reset panned variables
							if (ev.type === 'panstart') {
								pannedX = 0
								pannedY = 0
							}

							// Pan only the difference
							instance.panBy({
								x: ev.deltaX - pannedX,
								y: ev.deltaY - pannedY,
							})
							pannedX = ev.deltaX
							pannedY = ev.deltaY
						})

						// Handle pinch
						this.hammer.on('pinchstart pinchmove', function (ev) {
							// On pinch start remember initial zoom
							if (ev.type === 'pinchstart') {
								initialScale = instance.getZoom()
								instance.zoomAtPoint(initialScale * ev.scale, {
									x: ev.center.x,
									y: ev.center.y,
								})
							}

							instance.zoomAtPoint(initialScale * ev.scale, {
								x: ev.center.x,
								y: ev.center.y,
							})
						})

						// Prevent moving the page on some devices when panning over SVG
						options.svgElement.addEventListener(
							'touchmove',
							function (e) {
								e.preventDefault()
							}
						)
					},
					destroy() {
						this.hammer.destroy()
					},
				},
			})

			const thumb = svgPanZoom('#miniSvg', {
				zoomEnabled: false,
				panEnabled: false,
				controlIconsEnabled: false,
				dblClickZoomEnabled: false,
				preventMouseEventsDefault: true,
			})

			let resizeTimer
			const interval = 300 // msec
			window.addEventListener('resize', function () {
				if (resizeTimer !== false) {
					clearTimeout(resizeTimer)
				}
				resizeTimer = setTimeout(function () {
					main.resize()
					thumb.resize()
				}, interval)
			})

			main.setOnZoom(function () {
				thumb.updateThumbScope()
			})

			main.setOnPan(function () {
				thumb.updateThumbScope()
			})

			const self = this

			thumb.updateThumbScope = function () {
				const scope = self.get('#scope')
				const mainPanX = main.getPan().x
				const mainPanY = main.getPan().y
				const mainWidth = main.getSizes().width
				const mainHeight = main.getSizes().height
				const mainZoom = main.getSizes().realZoom
				const thumbPanX = thumb.getPan().x
				const thumbPanY = thumb.getPan().y
				const thumbZoom = thumb.getSizes().realZoom

				if (mainZoom === 0) {
					return
				}

				const thumByMainZoomRatio = thumbZoom / mainZoom

				const scopeX = thumbPanX - mainPanX * thumByMainZoomRatio
				const scopeY = thumbPanY - mainPanY * thumByMainZoomRatio
				const scopeWidth = mainWidth * thumByMainZoomRatio
				const scopeHeight = mainHeight * thumByMainZoomRatio

				scope.setAttribute('x', scopeX + 1)
				scope.setAttribute('y', scopeY + 1)
				scope.setAttribute('width', scopeWidth - 2)
				scope.setAttribute('height', scopeHeight - 2)
			}
			thumb.updateThumbScope()

			const _updateMainViewPan = function (
				clientX,
				clientY,
				scopeContainer,
				main,
				thumb
			) {
				const dim = scopeContainer.getBoundingClientRect()
				// const mainWidth = main.getSizes().width
				// const mainHeight = main.getSizes().height
				const mainZoom = main.getSizes().realZoom
				const thumbWidth = thumb.getSizes().width
				const thumbHeight = thumb.getSizes().height
				const thumbZoom = thumb.getSizes().realZoom

				const thumbPanX = clientX - dim.left - thumbWidth / 2
				const thumbPanY = clientY - dim.top - thumbHeight / 2
				const mainPanX = (-thumbPanX * mainZoom) / thumbZoom
				const mainPanY = (-thumbPanY * mainZoom) / thumbZoom
				main.pan({
					x: mainPanX,
					y: mainPanY,
				})
			}

			const updateMainViewPan = function (evt) {
				if (evt.which === 0 && evt.button === 0) {
					return false
				}
				_updateMainViewPan(
					evt.clientX,
					evt.clientY,
					scopeContainer,
					main,
					thumb
				)
			}

			const scopeContainer = this.get('#scopeContainer')
			scopeContainer.addEventListener('click', function (evt) {
				updateMainViewPan(evt)
			})

			scopeContainer.addEventListener('mousemove', function (evt) {
				updateMainViewPan(evt)
			})

			this.loading = false
		},
		listNodes() {
			const result = {
				edges: [],
				nodes: [],
			}

			let hubNode = this.nodes.find((n) => n.isControllerNode)
			hubNode = hubNode ? hubNode.id : 1

			const neighbors = {}

			for (const node of this.nodes) {
				const id = node.id

				neighbors[id] = node.neighbors

				let batlev = node.batteryLevel

				const nodeName = node.name || 'NodeID ' + node.id

				// create node
				const entity = {
					id: id,
					label: nodeName,
					class: 'unset layer-7',
					layer: 7,
					rx: '6',
					ry: '6',
					neighbors: neighbors[id],
					battery_level: batlev,
					mains: batlev,
					loc: node.loc,
					failed: node.failed,
					title:
						'<b>' +
						nodeName +
						'</b>' +
						'\n Node: ' +
						id +
						'\n Product Name: ' +
						node.productLabel +
						'\n Power source: ' +
						(batlev !== undefined
							? 'battery (' + batlev + '%)'
							: 'mains') +
						'\n Neighbors: ' +
						node.neighbors,
					forwards:
						node.isControllerNode ||
						(node.ready && !node.failed && node.isListening),
				}

				if (id === hubNode) {
					entity.shape = 'house'
				} else {
					entity.shape = batlev === undefined ? 'rect' : 'battery'
				}

				if (node.failed) {
					entity.label = 'FAILED: ' + entity.label
					entity['font.multi'] = true
					entity.title = '<b>FAILED: </b>' + entity.title
					entity.group = 'Failed'
					entity.failed = true
					entity.class = 'Error'
				}

				if (hubNode === id) {
					entity.label = 'Controller'
					entity.borderWidth = 2
					entity.fixed = true
				}

				result.nodes.push(entity)
			}

			if (hubNode > 0) {
				let layer = 0
				let previousRow = [hubNode]
				const mappedNodes = [hubNode]
				const layers = []

				while (previousRow.length > 0) {
					layer = layer + 1
					const nextRow = []
					const layerMembers = []
					layers[layer] = layerMembers

					for (const target in previousRow) {
						// assign node to layer
						result.nodes
							.filter((n) => {
								return (
									n.id === previousRow[target] &&
									(n.group = 'unset')
								)
							})
							.forEach((d) => {
								d.class = 'layer-' + layer
								d.layer = layer
								if (d.failed) {
									d.class = d.class + ' Error'
								}

								if (d.neighbors !== undefined) {
									d.neighbors.forEach((n) => {
										d.class = d.class + ' neighbor-' + n
									})
								}
							})

						if (
							result.nodes.filter((n) => {
								return (
									n.id === previousRow[target] && n.forwards
								)
							}).length > 0
						) {
							const row = neighbors[previousRow[target]]
							for (const node in row) {
								if (neighbors[row[node]] !== undefined) {
									if (!mappedNodes.includes(row[node])) {
										layerMembers.push(row[node])
										result.edges.push({
											from: row[node],
											to: previousRow[target],
											style: '',
											class:
												'layer-' +
												(layer + 1) +
												' node-' +
												row[node] +
												' node-' +
												previousRow[target],
											layer: layer,
										})
										nextRow.push(row[node])
									} else {
										// uncomment to show edges regardless of rows - mess!
										if (this.edgesVisibility === 'all') {
											result.edges.push({
												from: row[node],
												to: previousRow[target],
												style: 'stroke-dasharray: 5, 5; fill:transparent; ', // "stroke: #ddd; stroke-width: 1px; fill:transparent; stroke-dasharray: 5, 5;",
												class:
													'layer-' +
													(layer + 1) +
													' node-' +
													row[node] +
													' node-' +
													previousRow[target],
											})
										}
									}
								}
							}
						}
					}

					for (const idx in nextRow) {
						mappedNodes.push(nextRow[idx])
					}
					previousRow = nextRow
				}
			}
			return result
		},
		// Add our custom shape (a house)
		renderHouse(parent, bbox, node) {
			const w = bbox.width
			const h = bbox.height
			const points = [
				{
					x: 0,
					y: 0,
				},
				{
					x: w,
					y: 0,
				},
				{
					x: w,
					y: -h,
				},
				{
					x: w / 2,
					y: (-h * 3) / 2,
				},
				{
					x: 0,
					y: -h,
				},
			]
			const shapeSvg = parent
				.insert('polygon', ':first-child')
				.attr(
					'points',
					points
						.map(function (d) {
							return d.x + ',' + d.y
						})
						.join(' ')
				)
				.attr(
					'transform',
					'translate(' + -w / 2 + ',' + (h * 3) / 4 + ')'
				)

			node.intersect = function (point) {
				return dagreD3.intersect.polygon(node, points, point)
			}

			return shapeSvg
		},
		renderBattery(parent, bbox, node) {
			const w = bbox.width
			const h = bbox.height
			const points = [
				{
					x: 0,
					y: 0,
				}, // bottom left
				{
					x: w,
					y: 0,
				}, // bottom line
				{
					x: w,
					y: -h,
				}, // right line
				{
					x: (w * 7) / 10,
					y: -h,
				}, // top right
				{
					x: (w * 7) / 10,
					y: (-h * 20) / 17,
				}, // battery tip - right
				{
					x: (w * 3) / 10,
					y: (-h * 20) / 17,
				}, // battery tip
				{
					x: (w * 3) / 10,
					y: -h,
				}, // battery tip - left
				{
					x: 0,
					y: -h,
				}, // top left
				{
					x: 0,
					y: -h,
				}, // left line
			]

			const shapeSvg = parent
				.insert('polygon', ':first-child')
				.attr(
					'points',
					points
						.map(function (d) {
							return d.x + ',' + d.y
						})
						.join(' ')
				)
				.attr(
					'transform',
					'translate(' + -w / 2 + ',' + (h * 2) / 4 + ')'
				)

			node.intersect = function (point) {
				return dagreD3.intersect.polygon(node, points, point)
			}

			return shapeSvg
		},
		// eslint-disable-next-line no-unused-vars
		handleClick(nodeList, event, index) {
			// Add interactivity
			// const nodeId = nodeList[index].id
			// const node = this.nodes.find(n => n.id === nodeId)
		},
		handleMouseOver(nodeList, event, index) {
			// Add interactivity
			let svg
			for (const nodeNum in nodeList) {
				const node = nodeList[nodeNum]
				if (node.style !== undefined && node.id !== index) {
					node.style.opacity = 0.1
					svg = node.ownerSVGElement
				}
			}

			// Use D3 to select element, change color and size
			svg.querySelectorAll('.edgePath').forEach(function (node) {
				node.style.opacity = '0.3'
			})

			const edges = svg.querySelectorAll('.edgePath.node-' + index)
			for (let i = 0; i < edges.length; i++) {
				edges[i].style.opacity = '1'
				edges[i].style['stroke-width'] = '2'
			}

			const neighbors = svg.querySelectorAll('.node.neighbor-' + index)
			for (let i = 0; i < neighbors.length; i++) {
				neighbors[i].style.opacity = '0.7'
			}
		},

		handleMouseOut(nodeList, event, index) {
			// Add interactivity
			let svg
			for (const nodeNum in nodeList) {
				const node = nodeList[nodeNum]
				if (node.style !== undefined && node.id !== index) {
					node.style.opacity = 1
					svg = node.ownerSVGElement
				}
			}

			// Use D3 to select element, change color and size
			svg.querySelectorAll('.edgePath').forEach(function (node) {
				node.style.opacity = '1'
				node.style['stroke-width'] = '1'
			})
		},
	},
}
</script>
