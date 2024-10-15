<template>
	<div class="fill-height">
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
										<v-icon :color="item.color">{{
											item.icon || 'turned_in'
										}}</v-icon>
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
							<v-subheader>Edges</v-subheader>
							<v-list dense>
								<v-list-item
									v-for="(item, i) in edgesLegend"
									:key="i"
								>
									<v-list-item-icon>
										<v-icon :color="item.color">{{
											item.icon || 'turned_in'
										}}</v-icon>
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

							<v-autocomplete
								:items="locations"
								v-model="locationsFilter"
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
													invertLocationsFilter =
														!invertLocationsFilter
												"
												icon
												:color="
													invertLocationsFilter
														? 'primary'
														: ''
												"
												:class="
													invertLocationsFilter
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
							</v-autocomplete>

							<v-autocomplete
								:items="allNodes"
								v-model="nodesFilter"
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
													invertNodesFilter =
														!invertNodesFilter
												"
												icon
												:color="
													invertNodesFilter
														? 'primary'
														: ''
												"
												:class="
													invertNodesFilter
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
							</v-autocomplete>

							<v-checkbox
								v-model="showReturnRoutes"
								label="Show return routes"
								:disabled="selectedNodes.length === 0"
							></v-checkbox>

							<v-checkbox
								v-model="showApplicationRoutes"
								label="Show priority routes"
								:disabled="selectedNodes.length === 0"
							></v-checkbox>

							<v-badge
								color="error"
								overlap
								v-model="shouldReload"
							>
								<v-btn color="primary" @click="paintGraph">
									Reload graph
								</v-btn>
							</v-badge>

							<v-btn
								class="ml-3"
								:color="liveUpdate ? 'error' : 'success'"
								@click="toggleLive()"
							>
								Live
								<v-icon>{{
									liveUpdate ? 'pause' : 'play_arrow'
								}}</v-icon>
							</v-btn>
						</v-col>

						<!-- <v-col>
							<v-subheader>Grouping</v-subheader>

							<v-radio-group v-model="grouping">
								<v-radio
									v-for="(item, i) in groupingLegend"
									:key="i"
									:label="item.text"
									:value="item.value"
								></v-radio>
							</v-radio-group>
						</v-col> -->
					</v-row>
				</v-expansion-panel-content>
			</v-expansion-panel>
		</v-expansion-panels>

		<div class="mt-5" style="height: calc(100% - 95px)">
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
			<v-col
				class="fill-height"
				:style="{ opacity: loading ? 0 : '' }"
				cols="12"
				ref="container"
				v-resize="onResize"
			>
				<div
					:style="{
						height: containerHeight + 'px',
					}"
					ref="content"
				></div>
				<v-menu
					v-model="menu"
					:close-on-content-click="false"
					:position-x="menuX"
					:position-y="menuY"
				>
					<v-card v-if="hoverNode">
						<v-subheader class="font-weight-bold">{{
							hoverNode._name
						}}</v-subheader>

						<v-divider></v-divider>

						<v-list
							style="min-width: 300px; background: transparent"
							dense
							class="pa-0 text-caption"
						>
							<v-list-item dense>
								<v-list-item-content>ID</v-list-item-content>
								<v-list-item-content
									class="align-end font-weight-bold"
									>{{ hoverNode.id }}</v-list-item-content
								>
							</v-list-item>
							<v-list-item dense>
								<v-list-item-content
									>Product</v-list-item-content
								>
								<v-list-item-content
									class="align-end font-weight-bold"
									>{{
										hoverNode.productLabel +
										(hoverNode.productDescription
											? ' (' +
												hoverNode.productDescription +
												')'
											: '')
									}}</v-list-item-content
								>
							</v-list-item>
							<v-list-item dense>
								<v-list-item-content>Power</v-list-item-content>
								<v-list-item-content
									class="align-end font-weight-bold"
									>{{
										hoverNode.minBatteryLevel
											? hoverNode.minBatteryLevel + '%'
											: 'MAIN'
									}}</v-list-item-content
								>
							</v-list-item>
							<v-list-item dense>
								<v-list-item-content
									>Neighbors</v-list-item-content
								>
								<v-list-item-content
									class="align-end font-weight-bold"
									>{{
										hoverNode.neighbors.join(', ') || 'None'
									}}</v-list-item-content
								>
							</v-list-item>
						</v-list>
					</v-card>
				</v-menu>
			</v-col>
		</div>
	</div>
</template>

<style></style>

<script>
import { Network } from 'vis-network'
import 'vis-network/styles/vis-network.css'
// when need to test this, just uncomment this line and find replace `this.nodes` with `testNodes`
// import fakeNodes from '@/assets/testNodes.json'
import {
	ProtocolDataRate,
	protocolDataRateToString,
	rssiToString,
	isRssiError,
} from 'zwave-js/safe'
import { RouteKind } from '@zwave-js/core/safe'
import { uuid, arraysEqual } from '../../lib/utils'
import useBaseStore from '../../stores/base.js'
import { mapState } from 'pinia'

const ReturnRouteKind = {
	PRIORITY: 20,
	CUSTOM: 21,
}

export default {
	props: {
		nodes: {
			type: [Array],
		},
	},
	computed: {
		...mapState(useBaseStore, ['controllerNode']),
		content() {
			return this.$refs.content
		},
		fontColor() {
			return this.isDark ? '#ddd' : '#333'
		},
		isDark() {
			return this.$vuetify.theme.dark
		},
		locations() {
			// get unique locations array from nodes
			return this.allNodes.reduce((acc, node) => {
				if (node.loc && acc.indexOf(node.loc) === -1) {
					acc.push(node.loc)
				}
				return acc
			}, [])
		},
		filteredNodes() {
			return this.allNodes.filter((n) => {
				if (n.isControllerNode) {
					return true
				}

				let toAdd = false

				// check if node is in selected locations
				if (this.locationsFilter.length > 0) {
					if (this.invertLocationsFilter) {
						toAdd = !this.locationsFilter.includes(n.loc)
					} else {
						toAdd = this.locationsFilter.includes(n.loc)
					}
				}

				// if not in current locations, check if it's on selected nodes
				if (!toAdd && this.nodesFilter.length > 0) {
					if (this.invertNodesFilter) {
						toAdd = !this.nodesFilter.includes(n.id)
					} else {
						toAdd = this.nodesFilter.includes(n.id)
					}
				}

				return toAdd
			})
		},
		allNodes() {
			return this.nodes // replace this with `fakeNodes` when testing
		},
	},
	network: null, // do not make this reactive, see https://github.com/visjs/vis-network/issues/173#issuecomment-541435420
	unsubscribeUpdate: null, // pinia update action unsubscribe function
	data() {
		return {
			openPanel: -1,
			hoverNodeTimeout: null,
			containerHeight: 400,
			selectedNodes: [],
			showReturnRoutes: true,
			showApplicationRoutes: true,
			menuX: 0,
			menuY: 0,
			menu: false,
			hoverNode: null,
			liveUpdate: false,
			shouldReload: false,
			locationsFilter: [],
			invertLocationsFilter: false,
			nodesFilter: [],
			invertNodesFilter: false,
			// grouping: 'ungrouped',
			refreshTimeout: null,
			updateTimeout: null,
			loading: false,
			priorityEdges: {}, // keeps track of the edges that should be shown in overview
			legends: [
				{
					color: '#7e57c2',
					textColor: '#7e57c2',
					text: 'Controller',
				},
				{
					color: '#00BCD4',
					textColor: '#00BCD4',
					text: '1 hop',
				},
				{
					color: '#2DCC70',
					textColor: '#2DCC70',
					text: '2 hops',
				},
				{
					color: '#F1C40F',
					textColor: '#F1C40F',
					text: '3 hops',
				},
				{
					color: '#E77E23',
					textColor: '#E77E23',
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
					text: 'Unknown',
				},
			],
			edgesLegend: [
				{
					icon: 'star',
					textColor: '',
					color: '#F1C40F',
					text: 'Priority route',
				},
				{
					icon: 'minimize',
					textColor: '',
					text: 'Last working route',
				},
				{
					icon: 'more_horiz',
					textColor: '',
					text: 'Next to last working route',
				},
				{
					color: '#8b0000',
					textColor: '#8b0000',
					text: protocolDataRateToString(ProtocolDataRate.ZWave_9k6),
				},
				{
					color: '#F1C40F',
					textColor: '#F1C40F',
					text: protocolDataRateToString(ProtocolDataRate.ZWave_40k),
				},
				{
					color: '#2DCC70',
					textColor: '#2DCC70',
					text: protocolDataRateToString(ProtocolDataRate.ZWave_100k),
				},
				{
					color: '#3F51B5',
					textColor: '#3F51B5',
					text: protocolDataRateToString(
						ProtocolDataRate.LongRange_100k,
					),
				},
				{
					color: '#666666',
					textColor: '#666666',
					text: 'Unknown',
				},
			],
			// groupingLegend: [
			// 	{
			// 		text: 'Z-Wave Locations',
			// 		value: 'z-wave',
			// 	},
			// 	{
			// 		text: 'Ungrouped',
			// 		value: 'ungrouped',
			// 	},
			// ],
		}
	},
	watch: {
		grouping() {
			this.debounceRefresh()
		},
		filteredNodes(val, oldVal) {
			if (!arraysEqual(val, oldVal)) {
				this.selectedNodes = val.map((n) => n.id)
				this.setSelection()
			}
		},
		showReturnRoutes(v) {
			// hide/show all edges with returnRoute = true
			if (
				this.network &&
				!this.loading &&
				this.selectedNodes.length > 0
			) {
				const { edges } = this.network.body.data

				const edgesToUpdate = []

				edges.forEach((e) => {
					if (e.routeKind >= ReturnRouteKind.PRIORITY) {
						edgesToUpdate.push({
							id: e.id,
							hidden: !v,
						})
					}
				})

				edges.update(edgesToUpdate)
			}
		},
		showApplicationRoutes(v) {
			// hide/show all edges with returnRoute = false
			if (
				this.network &&
				!this.loading &&
				this.selectedNodes.length > 0
			) {
				const { edges } = this.network.body.data

				const edgesToUpdate = []

				edges.forEach((e) => {
					if (e.routeKind === RouteKind.Application) {
						edgesToUpdate.push({
							id: e.id,
							hidden: !v,
						})
					}
				})

				edges.update(edgesToUpdate)
			}
		},
	},
	mounted() {
		this.paintGraph()

		this.unsubscribeUpdate = useBaseStore().$onAction(({ name, args }) => {
			if (name === 'updateMeshGraph') {
				if (this.liveUpdate) {
					if (this.updateTimeout) {
						clearTimeout(this.updateTimeout)
					}

					this.updateTimeout = setTimeout(
						this.onNodeUpdate.bind(this, args[0]),
						1000,
					)
				} else {
					this.shouldReload = true
				}
			} else if (name === 'initNodes') {
				// trick to prevent empty network when refreshing page
				this.debounceRefresh()
			}
		})
	},
	beforeDestroy() {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout)
		}

		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout)
		}

		if (this.hoverNodeTimeout) {
			clearTimeout(this.hoverNodeTimeout)
		}

		this.destroyNetwork()

		this.unsubscribeUpdate()
	},
	methods: {
		onResize() {
			// when container resizes get its height and set content to that
			// so that the graph can be resized
			this.containerHeight = this.$refs.container.offsetHeight
			const maxHeight = window.innerHeight - 180
			// prevent to grow bigger then window height
			if (this.containerHeight > maxHeight) {
				this.containerHeight = maxHeight
			}
		},
		toggleLive() {
			this.liveUpdate = !this.liveUpdate

			// if should reload is true it means we have some
			// updates that were not applied, so we need to firstly
			// reload the graph and then start the live update
			if (this.liveUpdate && this.shouldReload) {
				this.paintGraph()
			}
		},
		destroyNetwork() {
			if (this.network) {
				this.network.destroy()
				this.network = null
				this.content.innerHTML = ''
			}
		},
		debounceRefresh() {
			if (this.refreshTimeout) {
				clearTimeout(this.refreshTimeout)
			}

			this.loading = true

			this.refreshTimeout = setTimeout(this.paintGraph.bind(this), 1000)
		},
		onNodeUpdate(node) {
			if (this.updateTimeout) {
				clearTimeout(this.updateTimeout)
			}

			if (this.network && !this.loading) {
				const { nodes, edges } = this.network.body.data

				const edgesToRemove = []
				const allEdges = {} // edgeId => [edge, edge, ...]
				const removedIds = [] // removed edgeIds

				edges.forEach((e) => {
					const edgeId = this.getEdgeId(e)

					if (e.routeOf === node.id) {
						edgesToRemove.push(e.id)
						if (this.priorityEdges[edgeId]?.id === e.id) {
							delete this.priorityEdges[edgeId]
							// we deleted the edge with the higher protocolDataRate
							// keep track of it so we can update this later
							removedIds.push(edgeId)
						}
					} else if (allEdges[edgeId]) {
						allEdges[edgeId].push(e)
					} else {
						allEdges[edgeId] = [e]
					}
				})

				// update the edge with hight protocolDataRate to prevent
				// having unconneted nodes
				for (const edgeId of removedIds) {
					const edges = allEdges[edgeId]
					if (edges) {
						// set the edge with hight protocolDataRate
						this.priorityEdges[edgeId] = edges.reduce(
							(prev, curr) =>
								prev.protocolDataRate > curr.protocolDataRate
									? prev
									: curr,
						)
					}
				}

				nodes.remove(node.id)
				edges.remove(edgesToRemove)
				const result = this.parseNode(node)
				nodes.add(result.node)
				edges.add(result.edges)

				const params = {
					nodes: this.selectedNodes,
				}

				this.network.setSelection(params)
				this.handleSelectNode(params)
			}
		},
		getEdgeId(edge) {
			return `${edge.from}-${edge.to}`
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
		setSelection() {
			if (this.network && !this.loading) {
				const emptyFilters =
					this.nodesFilter.length === 0 &&
					this.locationsFilter.length === 0 &&
					!this.invertNodesFilter &&
					!this.invertLocationsFilter

				// check if all nodes are selected
				const all =
					this.filteredNodes.length === this.allNodes.length &&
					emptyFilters

				const params = {
					nodes: all ? [] : this.selectedNodes,
				}
				this.network.setSelection(params)
				this.handleSelectNode(params)
			}
		},
		paintGraph() {
			this.shouldReload = false

			this.destroyNetwork()

			this.priorityEdges = {}

			this.loading = true

			const { edges, nodes } = this.parseNodes()

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
					tooltipDelay: 1000,
					zoomSpeed: 1,
					zoomView: true,
				},
				nodes: {
					borderWidth: 2,
					widthConstraint: {
						maximum: 180,
					},
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
						iterations: 50,
						updateInterval: 50,
						onlyDynamicEdges: false,
						fit: true,
					},
					barnesHut: {
						theta: 0.99,
						damping: 0.9,
						avoidOverlap: 0.15,
					},
				},
			}

			this.network = new Network(container, data, options)

			// event handlers
			// https://visjs.github.io/vis-network/docs/network/#Events
			this.network.once('stabilizationIterationsDone', () => {
				this.loading = false
				this.setSelection()
			})

			this.network.on('click', this.handleClick.bind(this))

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
		},
		handleSelectNode(params) {
			let { nodes: selectedNodes } = params

			const { edges, nodes } = this.network.body.data
			const repeaters = []

			const edgesToUpdate = []
			const nodesToUpdate = []

			// click on controller
			if (
				selectedNodes.length === 1 &&
				nodes.get(selectedNodes[0]).isControllerNode
			) {
				selectedNodes = []
			}

			this.selectedNodes = selectedNodes

			const showAll = selectedNodes.length === 0

			// DataSet: https://visjs.github.io/vis-data/data/dataset.html
			edges.forEach((e) => {
				const edgeId = this.getEdgeId(e)
				const shouldBeHidden =
					(showAll && this.priorityEdges[edgeId]?.id !== e.id) ||
					(selectedNodes.length > 0 &&
						!selectedNodes.includes(e.routeOf))

				let checkboxHide = false

				if (!showAll) {
					if (
						e.routeKind === RouteKind.Application &&
						!this.showApplicationRoutes
					) {
						checkboxHide = true
					} else if (
						e.routeKind >= ReturnRouteKind.PRIORITY &&
						!this.showReturnRoutes
					) {
						checkboxHide = true
					}
				}

				const fontSize = showAll ? 0 : 12

				if (shouldBeHidden !== e.hidden || fontSize !== e.font.size) {
					edgesToUpdate.push({
						id: e.id,
						hidden: shouldBeHidden || checkboxHide,
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

			this.network.fit()
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

			const item = this.allNodes.find((n) => n.id === node)

			if (item) {
				this.hoverNodeTimeout = setTimeout(() => {
					this.hoverNode = item
					this.menuX = event.clientX + 5
					this.menuY = event.clientY + 5
					this.menu = true
					this.hoverNodeTimeout = null
				}, 1000)
			}
		},
		handleBlurNode() {
			if (this.hoverNodeTimeout) {
				clearTimeout(this.hoverNodeTimeout)
				this.hoverNodeTimeout = null
			} else {
				// hide menu
				this.menu = false
				this.hoverNode = null
			}
		},
		handleClick(params) {
			if (params.event) {
				params.event.preventDefault()
				// https://visjs.github.io/vis-network/docs/network/#events
				// Add interactivity
				const nodeId = params.nodes[0]
				if (nodeId) {
					const node = this.allNodes.find((n) => n.id === nodeId)
					this.$emit('node-click', node)
				} else {
					this.$emit('node-click', null)
				}
			}
		},
		parseRouteStats(
			edges,
			controllerId,
			node,
			route,
			routeKind,
			forceShow = false,
		) {
			if (!route) {
				if (routeKind !== RouteKind.NLWR) {
					// unknown route
					node.color = this.legends[6].color
				}
				return
			}

			const isReturn = routeKind >= 20

			// tells if this route should be shown in overview
			const showInOverview =
				forceShow || (routeKind !== RouteKind.NLWR && !isReturn)

			const { repeaters, repeaterRSSI, rssi, routeFailedBetween } = route

			let { protocolDataRate } = route

			if (route.routeSpeed) {
				protocolDataRate = route.routeSpeed
			}

			if (routeFailedBetween) {
				const edge = {
					id: uuid(),
					from: routeFailedBetween[0],
					to: routeFailedBetween[1],
					color: this.getDataRateColor(ProtocolDataRate.ZWave_9k6),
					width: 1,
					label: 'Failed ❌',
					font: { align: 'top', size: 0 },
					dashes: [2, 2],
					hidden: true,
					routeOf: node.id, // used to know this edge needs to be shown when highlighting a node
					physics: true,
				}

				edges.push(edge)
			}

			const sourceNodeId = isReturn ? node.id : controllerId
			const destinationNodeId = isReturn ? controllerId : node.id

			for (let i = 0; i <= repeaters.length; i++) {
				const repeater = repeaters[i]
				const prevRepeater = repeaters[i - 1] || sourceNodeId

				const from = prevRepeater
				const to = repeater || destinationNodeId

				const edgeRssi = i === 0 ? rssi : repeaterRSSI?.[i - 1]

				let label = ''

				if (edgeRssi && !isRssiError(edgeRssi)) {
					label = rssiToString(edgeRssi)
				}

				const edgeId = this.getEdgeId({ from, to })

				const starArrow = {
					enabled: true,
					type: 'image',
					// don't use path here, seems vis-network doens't respect X-External-Path header causing 404 on HA Addon (issue https://github.com/zwave-js/zwave-js-ui/issues/3492)
					src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNyIgaGVpZ2h0PSIxNSIgdmlld0JveD0iLTEgLTEgMTcgMTYiPgogIDxwYXRoIGQ9Im03LjUgMCAyLjI0IDQuNiA1IC43NS0zLjYyIDMuNTkuODYgNS4wNi00LjQ4LTIuNEwzLjAyIDE0bC44Ni01LjA2TC4yNiA1LjM1bDUtLjc0Wm0wIDAiIHN0eWxlPSJzdHJva2U6IzAwMDtmaWxsLXJ1bGU6bm9uemVybztmaWxsOiNmZmM5MDE7ZmlsbC1vcGFjaXR5OjEiLz4KPC9zdmc+',
					scaleFactor: 1,
				}

				let width, dashes, arrows

				switch (routeKind) {
					case RouteKind.NLWR:
						width = 1
						dashes = [5, 5]
						break
					case RouteKind.LWR:
						width = 4
						dashes = false
						break
					case RouteKind.Application:
						width = 4
						dashes = false
						arrows = {
							middle: starArrow,
						}
						break
					case ReturnRouteKind.PRIORITY:
						width = 2
						dashes = [5, 10]
						arrows = {
							to: {
								enabled: true,
								scaleFactor: 1,
							},
							middle: starArrow,
						}
						break
					case ReturnRouteKind.CUSTOM:
						width = 1
						dashes = [5, 10]
						arrows = {
							to: {
								enabled: true,
								scaleFactor: 1,
							},
						}
						break
					default:
						width = 1
						dashes = [5, 5]
				}

				// create the edge
				// https://visjs.github.io/vis-network/docs/network/edges.html
				const edge = {
					id: uuid(),
					from,
					to,
					color: this.getDataRateColor(protocolDataRate),
					width,
					layer: i + 1,
					label,
					font: {
						align: 'top',
						size: 0,
						vadjust: routeKind === RouteKind.Application ? -5 : 0,
					}, //  multi: 'html'
					// arrows: 'to from',
					dashes,
					arrows,
					hidden: !showInOverview,
					routeOf: node.id, // used to know this edge needs to be shown when highlighting a node
					physics: true,
					routeKind,
					protocolDataRate,
				}

				edges.push(edge)

				if (showInOverview) {
					if (!node.failed && node.available) {
						node.color = this.legends[repeaters.length + 1].color
					}

					// only draw the edge with higher data rate
					if (this.priorityEdges[edgeId]) {
						if (
							this.priorityEdges[edgeId].protocolDataRate >=
							protocolDataRate
						) {
							edge.hidden = true
						} else {
							this.priorityEdges[edgeId].hidden = true
							this.priorityEdges[edgeId] = edge
						}
					} else {
						this.priorityEdges[edgeId] = edge
					}
				}
			}
		},
		parseNodes() {
			const result = {
				edges: [],
				nodes: [],
			}

			for (const node of this.allNodes) {
				const { node: entity } = this.parseNode(node, result.edges)
				result.nodes.push(entity)
			}

			return result
		},
		parseNode(node, edges = []) {
			const hubNode = this.controllerNode?.id ?? 1

			const id = node.id

			let batlev = node.minBatteryLevel

			const nodeName = node.name || 'NodeID ' + node.id

			// create node
			// https://visjs.github.io/vis-network/docs/network/nodes.html
			const entity = {
				id: id,
				hidden: false,
				label: nodeName,
				neighbors: node.neighbors,
				battery_level: batlev,
				group: node.loc,
				failed: node.failed,
				available: node.available,
				font: { color: this.fontColor },
				forwards:
					node.isControllerNode ||
					(node.ready && !node.failed && node.isListening),
			}

			if (id === hubNode) {
				entity.shape = 'star'
				entity.isControllerNode = true
				entity.color = this.legends[0].color
			} else if (node.isListening) {
				entity.shape = 'hexagon'
			} else {
				entity.shape = 'square'
				// entity.ctxRenderer = this.renderBattery
			}

			if (node.failed) {
				entity.label = 'FAILED: ' + entity.label
				entity.group = 'Failed'
				entity.color = this.legends[5].color
			}

			if (!node.available) {
				entity.label = 'DEAD: ' + entity.label
				entity.group = 'Dead'
				entity.color = this.legends[5].color
			}

			if (hubNode === id) {
				entity.label = 'Controller'
				// entity.fixed = true
			} else {
				// parse application route
				this.parseRouteStats(
					edges,
					hubNode,
					entity,
					node.applicationRoute,
					RouteKind.Application,
				)

				// parse node LWR (last working route) https://zwave-js.github.io/node-zwave-js/#/api/node?id=quotstatistics-updatedquot
				this.parseRouteStats(
					edges,
					hubNode,
					entity,
					node.statistics?.lwr,
					RouteKind.LWR,
				)

				// parse node NLWR (next to last working route)
				this.parseRouteStats(
					edges,
					hubNode,
					entity,
					node.statistics?.nlwr,
					RouteKind.NLWR,
					!node.statistics?.lwr,
				)

				if (node.customSUCReturnRoutes) {
					for (const r of node.customSUCReturnRoutes) {
						this.parseRouteStats(
							edges,
							hubNode,
							entity,
							r,
							ReturnRouteKind.CUSTOM,
						)
					}
				}

				if (node.prioritySUCReturnRoute) {
					this.parseRouteStats(
						edges,
						hubNode,
						entity,
						node.prioritySUCReturnRoute,
						ReturnRouteKind.PRIORITY,
					)
				}
			}

			return { node: entity, edges }
		},
	},
}
</script>
