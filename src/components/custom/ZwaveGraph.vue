<template>
	<div class="fill-height">
		<v-expansion-panels v-model="openPanel">
			<v-expansion-panel>
				<v-expansion-panel-title> Options </v-expansion-panel-title>
				<v-expansion-panel-text>
					<v-row>
						<v-col>
							<v-list-subheader>Legend</v-list-subheader>
							<v-list density="compact">
								<v-list-item
									v-for="(item, i) in legends"
									:key="i"
								>
									<template #prepend>
										<v-icon :color="item.color">{{
											item.icon || 'turned_in'
										}}</v-icon>
									</template>

									<v-list-item-title
										:style="{ color: item.textColor }"
									>
										{{ item.text }}</v-list-item-title
									>
								</v-list-item>
							</v-list>
						</v-col>
						<v-col>
							<v-list-subheader>Edges</v-list-subheader>
							<v-list density="compact">
								<v-list-item
									v-for="(item, i) in edgesLegend"
									:key="i"
								>
									<template #prepend>
										<v-icon :color="item.color">{{
											item.icon || 'turned_in'
										}}</v-icon>
									</template>

									<v-list-item-title
										:style="{ color: item.textColor }"
									>
										{{ item.text }}
									</v-list-item-title>
								</v-list-item>
							</v-list>
						</v-col>
						<v-col>
							<v-list-subheader>Filters</v-list-subheader>

							<v-autocomplete
								:items="locations"
								v-model="locationsFilter"
								multiple
								label="Locations filter"
								clearable
								chips
								closable-chips
								variant="solo"
							>
								<template #append>
									<v-btn
										v-tooltip:bottom="'Invert selection'"
										@click="
											invertLocationsFilter =
												!invertLocationsFilter
										"
										icon="loop"
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
									/>
								</template>
							</v-autocomplete>

							<v-autocomplete
								:items="allNodes"
								v-model="nodesFilter"
								multiple
								label="Nodes filter"
								clearable
								item-title="_name"
								item-value="id"
								chips
								closable-chips
								variant="solo"
							>
								<template #append>
									<v-btn
										v-tooltip:bottom="'Invert selection'"
										@click="
											invertNodesFilter =
												!invertNodesFilter
										"
										icon="loop"
										:color="
											invertNodesFilter ? 'primary' : ''
										"
										:class="
											invertNodesFilter
												? 'border-primary'
												: ''
										"
									/>
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

							<v-badge color="error" v-model="shouldReload">
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
							<v-list-subheader>Grouping</v-list-subheader>

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
				</v-expansion-panel-text>
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
				<VueFlow
					:nodes="vueFlowNodes"
					:edges="vueFlowEdges"
					:style="{
						height: containerHeight + 'px',
					}"
					:fitViewOnInit="true"
					:snapToGrid="false"
					:zoomOnDoubleClick="false"
					@nodesInitialized="onNodesInitialized"
					@nodeClick="handleNodeClick"
					@nodeMouseEnter="handleNodeMouseEnter"
					@nodeMouseLeave="handleNodeMouseLeave"
					@nodeDragStart="handleNodeDragStart"
					@nodeDragStop="handleNodeDragStop"
					@selectionChange="handleSelectionChange"
				>
					<Background />
					<Controls />
					<MiniMap />
				</VueFlow>
				<v-menu
					v-model="showMenu"
					:close-on-content-click="false"
					location="bottom left"
					:style="{
						position: 'fixed',
						left: menuX + 'px',
						top: menuY + 'px',
					}"
				>
					<v-card v-if="hoverNode">
						<v-list-subheader class="ml-2 font-weight-bold">{{
							hoverNode._name
						}}</v-list-subheader>

						<v-divider></v-divider>

						<v-list
							style="min-width: 300px; background: transparent"
							density="compact"
							class="pa-0 text-caption"
						>
							<v-list-item density="compact">
								ID
								<template #append>
									<span class="align-end font-weight-bold">{{
										hoverNode.id
									}}</span>
								</template>
							</v-list-item>
							<v-list-item density="compact">
								Product
								<template #append>
									<span class="align-end font-weight-bold">{{
										hoverNode.productLabel +
										(hoverNode.productDescription
											? ' (' +
												hoverNode.productDescription +
												')'
											: '')
									}}</span>
								</template>
							</v-list-item>
							<v-list-item density="compact">
								Power
								<template #append>
									<span class="align-end font-weight-bold">{{
										hoverNode.minBatteryLevel
											? hoverNode.minBatteryLevel + '%'
											: 'MAIN'
									}}</span>
								</template>
							</v-list-item>
							<v-list-item density="compact">
								Neighbors
								<template #append>
									<span class="align-end font-weight-bold">{{
										hoverNode.neighbors.join(', ') || 'None'
									}}</span>
								</template>
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
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { Background } from '@vue-flow/background'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
// when need to test this, just uncommented this line and find replace `this.nodes` with `testNodes`
// import fakeNodes from '@/assets/testNodes.json'
import {
	ProtocolDataRate,
	protocolDataRateToString,
	rssiToString,
	isRssiError,
	RouteKind,
} from '@zwave-js/core'
import { uuid, arraysEqual } from '../../lib/utils'
import useBaseStore from '../../stores/base.js'
import { mapState } from 'pinia'

const ReturnRouteKind = {
	PRIORITY: 20,
	CUSTOM: 21,
}

export default {
	name: 'ZwaveGraph',
	components: {
		VueFlow,
		Controls,
		MiniMap,
		Background,
	},
	setup() {
		const { fitView, getSelectedNodes, getSelectedEdges } = useVueFlow()
		return {
			fitView,
			getSelectedNodes,
			getSelectedEdges,
		}
	},
	props: {
		nodes: {
			type: [Array],
		},
	},
	computed: {
		...mapState(useBaseStore, ['controllerNode']),
		fontColor() {
			return this.isDark ? '#ddd' : '#333'
		},
		isDark() {
			return this.$vuetify.theme.current.dark
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
		vueFlowNodes() {
			const { nodes } = this.parseNodes()
			return nodes.map((node) => ({
				id: String(node.id),
				type: this.getNodeType(node),
				position: node.position || {
					x: Math.random() * 500,
					y: Math.random() * 500,
				},
				data: {
					label: node.label,
					...node,
				},
				style: this.getNodeStyle(node),
				draggable: true,
				selectable: true,
				hidden: node.hidden || false,
			}))
		},
		vueFlowEdges() {
			const { edges } = this.parseNodes()
			return edges.map((edge) => ({
				id: String(edge.id),
				source: String(edge.from),
				target: String(edge.to),
				type: 'default',
				animated: false,
				style: this.getEdgeStyle(edge),
				label: edge.label || '',
				labelStyle: this.getEdgeLabelStyle(edge),
				data: {
					...edge,
				},
				hidden: edge.hidden || false,
			}))
		},
	},
	// Remove vis-network instance reference as it's no longer needed
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
			showMenu: false,
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
		showReturnRoutes() {
			// Vue Flow will handle this via the computed vueFlowEdges property
			// Just trigger a re-render by calling handleSelectNode
			if (!this.loading && this.selectedNodes.length > 0) {
				this.handleSelectNode({ nodes: this.selectedNodes })
			}
		},
		showApplicationRoutes() {
			// Vue Flow will handle this via the computed vueFlowEdges property
			// Just trigger a re-render by calling handleSelectNode
			if (!this.loading && this.selectedNodes.length > 0) {
				this.handleSelectNode({ nodes: this.selectedNodes })
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
	beforeUnmount() {
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
		getNodeType(node) {
			// Vue Flow uses default node type, we'll style with CSS
			// Could be extended to return different types based on node properties
			return node.shape === 'star' ? 'default' : 'default'
		},
		getNodeStyle(node) {
			const styles = {
				borderWidth: '2px',
				borderStyle: 'solid',
				borderColor: node.color || '#ccc',
				backgroundColor: node.color || '#f0f0f0',
				color: node.font?.color || this.fontColor,
				borderRadius: '8px',
				padding: '8px',
				fontSize: '12px',
				textAlign: 'center',
				minWidth: '80px',
				maxWidth: '180px',
			}

			// Different shapes based on node type
			if (node.shape === 'star') {
				styles.borderRadius = '50%'
				styles.clipPath =
					'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
			} else if (node.shape === 'hexagon') {
				styles.clipPath =
					'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'
			} else if (node.shape === 'square') {
				styles.borderRadius = '4px'
			}

			return styles
		},
		getEdgeStyle(edge) {
			return {
				stroke: edge.color || '#666',
				strokeWidth: edge.width || 2,
				strokeDasharray: edge.dashes ? edge.dashes.join(',') : 'none',
			}
		},
		getEdgeLabelStyle(edge) {
			return {
				fontSize: edge.font?.size || 0,
				fill: edge.font?.color || this.fontColor,
			}
		},
		onResize() {
			// when container resizes get its height and set content to that
			// so that the graph can be resized
			this.containerHeight = this.$refs.container.$el.offsetHeight
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
			// Vue Flow doesn't need explicit destruction
			// Just reset loading state
			this.loading = false
		},
		debounceRefresh() {
			if (this.refreshTimeout) {
				clearTimeout(this.refreshTimeout)
			}

			this.loading = true

			this.refreshTimeout = setTimeout(this.paintGraph.bind(this), 1000)
		},
		// eslint-disable-next-line no-unused-vars
		onNodeUpdate(node) {
			if (this.updateTimeout) {
				clearTimeout(this.updateTimeout)
			}

			if (!this.loading) {
				// Vue Flow will handle the update via computed properties reactivity
				// The computed vueFlowNodes and vueFlowEdges will automatically update
				// when the underlying data changes

				// Update priority edges tracking
				const { edges } = this.parseNodes()
				const allEdges = {} // edgeId => [edge, edge, ...]
				const removedIds = [] // removed edgeIds

				edges.forEach((e) => {
					const edgeId = this.getEdgeId(e)

					if (e.routeOf === node.id) {
						if (this.priorityEdges[edgeId]?.id === e.id) {
							delete this.priorityEdges[edgeId]
							removedIds.push(edgeId)
						}
					} else if (allEdges[edgeId]) {
						allEdges[edgeId].push(e)
					} else {
						allEdges[edgeId] = [e]
					}
				})

				// update the edge with highest protocolDataRate to prevent
				// having unconnected nodes
				for (const edgeId of removedIds) {
					const edges = allEdges[edgeId]
					if (edges) {
						// set the edge with highest protocolDataRate
						this.priorityEdges[edgeId] = edges.reduce(
							(prev, curr) =>
								prev.protocolDataRate > curr.protocolDataRate
									? prev
									: curr,
						)
					}
				}

				const params = {
					nodes: this.selectedNodes,
				}

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
			if (!this.loading) {
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

				this.handleSelectNode(params)
			}
		},
		paintGraph() {
			this.shouldReload = false
			this.priorityEdges = {}
			this.loading = true

			// Vue Flow will handle the rendering via computed properties
			// Just need to trigger reactivity and fit view
			this.$nextTick(() => {
				this.loading = false
				this.setSelection()
				this.fitView()
			})
		},
		onNodesInitialized() {
			this.loading = false
			this.setSelection()
		},
		handleNodeClick(event) {
			const nodeId = event.node.id
			if (nodeId) {
				const node = this.allNodes.find(
					(n) => n.id === parseInt(nodeId),
				)
				this.$emit('node-click', node)
			} else {
				this.$emit('node-click', null)
			}
		},
		handleNodeMouseEnter(event) {
			if (this.dragging) return
			const nodeId = event.node.id
			const item = this.allNodes.find((n) => n.id === parseInt(nodeId))

			if (item) {
				this.hoverNodeTimeout = setTimeout(() => {
					this.hoverNode = item
					// Get mouse position from the event
					this.menuX = event.event?.clientX || 100
					this.menuY = event.event?.clientY || 100
					this.showMenu = true
					this.hoverNodeTimeout = null
				}, 1000)
			}
		},
		handleNodeMouseLeave() {
			if (this.hoverNodeTimeout) {
				clearTimeout(this.hoverNodeTimeout)
				this.hoverNodeTimeout = null
			} else {
				this.showMenu = false
				this.hoverNode = null
			}
		},
		handleNodeDragStart() {
			this.dragging = true
		},
		handleNodeDragStop() {
			this.dragging = false
		},
		handleSelectionChange(selection) {
			const nodeIds = selection.nodes.map((node) => parseInt(node.id))
			this.selectedNodes = nodeIds
			this.handleSelectNode({ nodes: nodeIds })
		},
		handleSelectNode(params) {
			let { nodes: selectedNodes } = params

			// For Vue Flow, we need to work with the computed data instead of network data
			const edges = this.vueFlowEdges
			const nodes = this.vueFlowNodes
			const repeaters = []

			// click on controller
			if (
				selectedNodes.length === 1 &&
				nodes.find((n) => parseInt(n.id) === selectedNodes[0])?.data
					?.isControllerNode
			) {
				selectedNodes = []
			}

			this.selectedNodes = selectedNodes

			const showAll = selectedNodes.length === 0

			// Update edge visibility based on selection
			edges.forEach((e) => {
				const edgeId = this.getEdgeId({ from: e.source, to: e.target })
				const shouldBeHidden =
					(showAll && this.priorityEdges[edgeId]?.id !== e.id) ||
					(selectedNodes.length > 0 &&
						!selectedNodes.includes(e.data?.routeOf))

				let checkboxHide = false

				if (!showAll) {
					if (
						e.data?.routeKind === RouteKind.Application &&
						!this.showApplicationRoutes
					) {
						checkboxHide = true
					} else if (
						e.data?.routeKind >= ReturnRouteKind.PRIORITY &&
						!this.showReturnRoutes
					) {
						checkboxHide = true
					}
				}

				e.hidden = shouldBeHidden || checkboxHide

				if (!shouldBeHidden) {
					repeaters.push(parseInt(e.source))
					repeaters.push(parseInt(e.target))
				}
			})

			// Update node visibility based on selection
			nodes.forEach((n) => {
				const nodeId = parseInt(n.id)
				const shouldBeHidden =
					selectedNodes.length > 0 &&
					!selectedNodes.includes(nodeId) &&
					!repeaters.includes(nodeId)

				n.hidden = shouldBeHidden
			})

			// Fit view after selection changes
			this.$nextTick(() => {
				this.fitView()
			})
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
