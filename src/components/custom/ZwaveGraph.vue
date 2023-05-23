<template>
	<div>
		<v-expansion-panels v-model="openPanel">
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
							<v-subheader>Filters</v-subheader>

							<v-select
								:items="locations"
								v-model="filterLocations"
								multiple
								label="Locations filter"
								clearable
								chips
								deletable-chips
								solo
							>
								<template slot="append-outer">
									<v-tooltip bottom>
										<template
											v-slot:activator="{ on, attrs }"
										>
											<v-btn
												v-bind="attrs"
												v-on="on"
												@click="
													filterLocationsInvert =
														!filterLocationsInvert
												"
												icon
												:color="
													filterLocationsInvert
														? 'primary'
														: ''
												"
												:class="
													filterLocationsInvert
														? 'border-primary'
														: ''
												"
											>
												<v-icon>loop</v-icon>
											</v-btn>
										</template>
										<span>Invert selection</span>
									</v-tooltip>
								</template>
							</v-select>

							<v-select
								:items="nodes"
								v-model="filterNodes"
								multiple
								label="Nodes filter"
								clearable
								item-text="_name"
								item-value="id"
								chips
								deletable-chips
								solo
							>
								<template slot="append-outer">
									<v-tooltip bottom>
										<template
											v-slot:activator="{ on, attrs }"
										>
											<v-btn
												v-bind="attrs"
												v-on="on"
												@click="
													filterNodesInvert =
														!filterNodesInvert
												"
												icon
												:color="
													filterNodesInvert
														? 'primary'
														: ''
												"
												:class="
													filterNodesInvert
														? 'border-primary'
														: ''
												"
											>
												<v-icon>loop</v-icon>
											</v-btn>
										</template>
										<span>Invert selection</span>
									</v-tooltip>
								</template>
							</v-select>

							<v-badge
								color="error"
								overlap
								v-model="shouldReload"
							>
								<v-btn color="primary" @click="debounceRefresh">
									Reload graph
								</v-btn>
							</v-badge>
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
			<v-col class="fill-height" :style="{ visible: !loading }" cols="12">
				<div class="fill-height" ref="content"></div>
				<v-menu
					v-model="menu"
					:close-on-content-click="false"
					:position-x="menuX"
					:position-y="menuY"
					:offset-y="true"
					:z-index="120"
				>
					<v-card v-if="hoverNode">
						<v-subheader>{{ hoverNode._name }}</v-subheader>

						<v-list
							style="min-width: 300px; background: transparent"
							dense
							class="pa-0 text-caption"
						>
							<v-list-item dense>
								<v-list-item-content>ID</v-list-item-content>
								<v-list-item-content class="align-end">{{
									hoverNode.id
								}}</v-list-item-content>
							</v-list-item>
							<v-list-item dense>
								<v-list-item-content
									>Product</v-list-item-content
								>
								<v-list-item-content class="align-end">{{
									hoverNode.productLabel
								}}</v-list-item-content>
							</v-list-item>
							<v-list-item dense>
								<v-list-item-content>Power</v-list-item-content>
								<v-list-item-content class="align-end">{{
									hoverNode.minBatteryLevel
										? hoverNode.minBatteryLevel + '%'
										: 'MAIN'
								}}</v-list-item-content>
							</v-list-item>
							<v-list-item dense>
								<v-list-item-content
									>Neighbors</v-list-item-content
								>
								<v-list-item-content class="align-end">{{
									hoverNode.neighbors.join(', ')
								}}</v-list-item-content>
							</v-list-item>
						</v-list>
					</v-card>
				</v-menu>
			</v-col>
		</v-row>
	</div>
</template>

<style></style>

<script>
import { Network } from 'vis-network'
import 'vis-network/styles/vis-network.css'
// when need to test this, just uncomment this line and find replace `this.nodes` with `testNodes`
import fakeNodes from '@/assets/testNodes.json'
import {
	ProtocolDataRate,
	protocolDataRateToString,
	rssiToString,
} from 'zwave-js/safe'

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
		locations() {
			// get unique locations array from nodes
			return fakeNodes.reduce((acc, node) => {
				if (node.loc && acc.indexOf(node.loc) === -1) {
					acc.push(node.loc)
				}
				return acc
			}, [])
		},
		filteredNodes() {
			return fakeNodes.filter((n) => {
				if (n.isControllerNode) {
					return true
				}

				let toAdd = true

				// check if node is in selected locations
				if (this.filterLocations.length > 0) {
					if (this.filterLocationsInvert) {
						toAdd = this.filterLocations.indexOf(n.loc) === -1
					} else {
						toAdd = this.filterLocations.indexOf(n.loc) !== -1
					}
				}

				// if not in current locations, check if it's on selected nodes
				if (!toAdd && this.filterNodes.length > 0) {
					if (this.filterNodesInvert) {
						toAdd = this.filterNodes.indexOf(n.id) === -1
					} else {
						toAdd = this.filterNodes.indexOf(n.id) !== -1
					}
				}

				return toAdd
			})
		},
	},
	data() {
		return {
			openPanel: -1,
			menuX: 0,
			menuY: 0,
			menu: false,
			hoverNode: null,
			shouldReload: false,
			filterLocations: [],
			filterNodes: [],
			filterNodesInvert: false,
			filterLocationsInvert: false,
			edgesVisibility: 'relevant',
			grouping: 'ungrouped',
			refreshTimeout: null,
			loading: false,
			network: null,
			edgesCache: [],
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
		filteredNodes() {
			this.shouldReload = true
		},
		// nodes() {
		// 	this.debounceRefresh()
		// },
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
		this.paintGraph()
	},
	beforeDestroy() {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout)
		}

		if (this.network) {
			this.network.destroy()
			this.content.innerHTML = ''
		}
	},
	methods: {
		debounceRefresh() {
			if (this.refreshTimeout) {
				clearTimeout(this.refreshTimeout)
			}

			this.refreshTimeout = setTimeout(this.paintGraph.bind(this), 1000)
		},
		getDataRateColor(dataRate) {
			switch (dataRate) {
				case ProtocolDataRate.ZWave_9k6:
					return '#8b0000'
				case ProtocolDataRate.ZWave_40k:
					return '#F1C40F'
				case ProtocolDataRate.ZWave_100k:
					return '#2DCC70'
				case ProtocolDataRate.LongRange_100k:
					return '#3F51B5'
				default:
					return '#666666'
			}
		},
		async paintGraph() {
			this.shouldReload = false

			this.edgesCache = []

			const { edges, nodes } = this.listNodes()

			const container = this.content
			const data = {
				nodes,
				edges,
			}
			const options = {
				interaction: {
					// https://visjs.github.io/vis-network/docs/network/interaction.html#
					hover: true,
					navigationButtons: true,
					keyboard: true,
					multiselect: true,
					hideEdgesOnDrag: false,
					hideEdgesOnZoom: false,
					hideNodesOnDrag: false,
					hoverConnectedEdges: false,
					selectable: true,
					selectConnectedEdges: false,
					tooltipDelay: 300,
					zoomSpeed: 1,
					zoomView: true,
				},
				nodes: {
					borderWidth: 2,
					// shadow: true,
				},
				edges: {
					width: 2,
					// shadow: true,
				},
				physics: {
					enabled: true, // enabling physics reduces performance a lot
					stabilization: {
						enabled: true,
						iterations: 200,
						updateInterval: 100,
						onlyDynamicEdges: false,
						fit: true,
					},
				},
			}

			this.loading = true
			await this.$nextTick()
			this.network = new Network(container, data, options)

			// event handlers
			// https://visjs.github.io/vis-network/docs/network/#Events
			this.network.on('oncontext', this.handleClick.bind(this))
			this.network.on('doubleClick', this.handleClick.bind(this))

			this.network.on('hoverNode', this.handleHoverNode.bind(this))
			this.network.on('blurNode', this.handleBlurNode.bind(this))

			this.network.on('dragStart', this.handleDragStart.bind(this))
			this.network.on('dragEnd', this.handleDragEnd.bind(this))

			this.network.on('select', this.handleSelectNode.bind(this))

			// this.network.on('hoverEdge', function (e) {
			// 	this.body.data.edges.update({
			// 		id: e.edge,
			// 		font: {
			// 			size: 12,
			// 		},
			// 	})
			// })

			// this.network.on('blurEdge', function (e) {
			// 	this.body.data.edges.update({
			// 		id: e.edge,
			// 		font: {
			// 			size: 0,
			// 		},
			// 	})
			// })

			this.network.once('stabilizationIterationsDone', () => {
				this.loading = false
			})
		},
		handleSelectNode(params) {
			const { nodes: selectedNodes } = params

			const { edges, nodes } = this.network.body.data
			const repeaters = []

			const edgesToUpdate = []
			const nodesToUpdate = []

			// DataSet: https://visjs.github.io/vis-data/data/dataset.html
			edges.forEach((e) => {
				const shouldBeHidden =
					selectedNodes.length > 0 &&
					!selectedNodes.includes(e.repeaterOf)

				const fontSize = selectedNodes.length > 0 ? 12 : 0

				if (shouldBeHidden !== e.hidden || fontSize !== e.font.size) {
					edgesToUpdate.push({
						id: e.id,
						hidden: shouldBeHidden,
						font: {
							size: fontSize,
						},
					})
				}

				if (!shouldBeHidden) {
					repeaters.push(e.from)
					repeaters.push(e.to)
				}
			})

			edges.update(edgesToUpdate)

			nodes.forEach((n) => {
				const shouldBeHidden =
					selectedNodes.length > 0 &&
					!selectedNodes.includes(n.id) &&
					!repeaters.includes(n.id)

				if (shouldBeHidden !== n.hidden) {
					nodesToUpdate.push({
						id: n.id,
						hidden: shouldBeHidden,
						color: n.color,
					})
				}
			})

			nodes.update(nodesToUpdate)
		},
		handleDragStart() {
			this.dragging = true
		},
		handleDragEnd() {
			this.dragging = false
		},
		handleHoverNode(params) {
			// show menu
			if (this.dragging) return
			const { node, event } = params
			this.menuX = event.clientX + 15
			this.menuY = event.clientY + 15
			this.menu = true
			const item = this.filteredNodes.find((n) => n.id === node)

			if (item) {
				this.hoverNode = item
			}
		},
		handleBlurNode() {
			// hide menu
			this.menu = false
			this.hoverNode = null
		},
		handleClick(params) {
			params.event.preventDefault()
			// https://visjs.github.io/vis-network/docs/network/#events
			// Add interactivity
			const nodeId = params.nodes[0]
			if (nodeId) {
				const node = this.filteredNodes.find((n) => n.id === nodeId)
				this.$emit('node-click', node)
			}
		},
		parseRouteStats(edges, controllerId, node, route, nlwr = false) {
			if (!route) {
				if (!nlwr) {
					// unconnected
					node.color = this.legends[6].color
				}
				return
			}

			const { repeaters, repeaterRSSI, rssi, protocolDataRate } = route

			for (let i = 0; i <= repeaters.length; i++) {
				const repeater = repeaters[i]
				const prevRepeater = repeaters[i - 1] || controllerId

				const label = `${rssiToString(
					repeaterRSSI?.[i] || rssi
				)}\n${protocolDataRateToString(protocolDataRate)}`

				const from = prevRepeater
				const to = repeater || node.id

				// const edgeId = `${from}-${to}`

				// prevent drawing duplicated edges
				// if (
				// 	this.edgesCache.includes(edgeId) ||
				// 	this.edgesCache.includes(`${to}-${from}`)
				// ) {
				// 	continue
				// }

				// create the edge
				// https://visjs.github.io/vis-network/docs/network/edges.html
				const edge = {
					from,
					to,
					color: this.getDataRateColor(protocolDataRate),
					width: nlwr ? 1 : 4,
					rssi: rssiToString(repeaterRSSI?.[i] || rssi),
					protocolDataRate:
						protocolDataRateToString(protocolDataRate),
					layer: i + 1,
					label,
					font: { align: 'middle', multi: 'html', size: 0 },
					// arrows: 'to from',
					dashes: nlwr ? [5, 5] : false,
					hidden: false,
					repeaterOf: node.id,
				}

				if (!nlwr) {
					node.color = this.legends[repeaters.length + 1].color
				}

				edges.push(edge)
				// this.edgesCache.push(edgeId)
			}
		},
		listNodes() {
			const result = {
				edges: [],
				nodes: [],
			}

			let hubNode = this.filteredNodes.find((n) => n.isControllerNode)
			hubNode = hubNode ? hubNode.id : 1

			/** node id --> neghbors array */
			const neighbors = {}

			for (const node of this.filteredNodes) {
				const id = node.id

				neighbors[id] = node.neighbors

				let batlev = node.minBatteryLevel

				const nodeName = node.name || 'NodeID ' + node.id

				// create node
				// https://visjs.github.io/vis-network/docs/network/nodes.html
				const entity = {
					id: id,
					hidden: false,
					label: nodeName,
					neighbors: neighbors[id],
					battery_level: batlev,
					group: node.loc,
					failed: node.failed,
					forwards:
						node.isControllerNode ||
						(node.ready && !node.failed && node.isListening),
				}

				if (id === hubNode) {
					entity.shape = 'star'
					entity.color = '#7e57c2'
				} else if (node.isListening) {
					entity.shape = 'hexagon'
				} else {
					entity.shape = 'square'
					// entity.ctxRenderer = this.renderBattery
				}

				if (node.failed) {
					entity.label = 'FAILED: ' + entity.label
					entity.group = 'Failed'
					entity.failed = true
					entity.color = this.legends[5].color
					entity.class = 'Error'
				}

				if (hubNode === id) {
					entity.label = 'Controller'
					// entity.fixed = true
				} else {
					// parse node LWR (last working route) https://zwave-js.github.io/node-zwave-js/#/api/node?id=quotstatistics-updatedquot
					this.parseRouteStats(
						result.edges,
						hubNode,
						entity,
						node.statistics?.lwr,
						false
					)

					// parse node NLWR (next last working route)
					this.parseRouteStats(
						result.edges,
						hubNode,
						entity,
						node.statistics?.nlwr,
						true
					)
				}

				result.nodes.push(entity)
			}

			return result
		},
	},
}
</script>
