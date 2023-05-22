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
			openPanel: 0,
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

			this.loading = true

			this.refreshTimeout = setTimeout(this.paintGraph.bind(this), 1000)
		},
		paintGraph() {
			this.shouldReload = false

			const { edges, nodes } = this.listNodes()

			const container = this.content
			const data = {
				nodes,
				edges,
			}
			const options = {
				interaction: {
					hover: true,
					navigationButtons: true,
					keyboard: true,
				},
				nodes: {
					borderWidth: 2,
					shadow: true,
				},
				edges: {
					width: 2,
					shadow: true,
				},
			}
			this.network = new Network(container, data, options)

			// append handlers
			this.network.on('click', this.handleClick.bind(this))
			this.network.on('hoverNode', this.handleHoverNode.bind(this))
			this.network.on('blurNode', this.handleBlurNode.bind(this))

			this.loading = false
		},
		handleHoverNode(params) {
			// show menu
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
				const entity = {
					id: id,
					label: nodeName,
					neighbors: neighbors[id],
					battery_level: batlev,
					mains: batlev,
					group: node.loc,
					failed: node.failed,
					forwards:
						node.isControllerNode ||
						(node.ready && !node.failed && node.isListening),
				}

				if (id === hubNode) {
					entity.shape = 'star'
				} else {
					entity.shape = node.isListening ? 'hexagon' : 'database'
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
					entity.fixed = true
				}

				result.nodes.push(entity)
			}

			if (hubNode > 0) {
				let layer = 0
				let previousRow = [hubNode]
				const mappedNodes = [hubNode]
				const layers = []

				const resultMap = result.nodes.reduce((map, obj) => {
					map[obj.id] = obj
					return map
				}, {})

				// create layers
				while (previousRow.length > 0) {
					layer = layer + 1
					const nextRow = []
					const layerMembers = []
					layers[layer] = layerMembers

					// foreach node in previous layer
					for (const target of previousRow) {
						// assign node to layer
						const targetNode = resultMap[target]

						targetNode.class = 'layer-' + layer
						targetNode.layer = layer
						targetNode.color =
							targetNode.id === hubNode
								? '#7e57c2'
								: this.legends[layer - 1]?.color
						if (targetNode.failed) {
							targetNode.color = this.legends[5].color
							targetNode.class = targetNode.class + ' Error'
						}

						// if the node forwards check it's neighbors
						if (targetNode.forwards) {
							const row = neighbors[target]
							// foreach neighbor of target node
							for (const node of row) {
								// if node has neighbors and is not already mapped
								if (neighbors[node] !== undefined) {
									if (!mappedNodes.includes(node)) {
										layerMembers.push(node)
										result.edges.push({
											from: node,
											to: target,
											color: this.legends[layer]?.color,
											class:
												'layer-' +
												(layer + 1) +
												' node-' +
												node +
												' node-' +
												target,
											layer: layer,
										})
										nextRow.push(node)
										mappedNodes.push(node)
									} else {
										// uncomment to show edges regardless of rows - mess!
										if (this.edgesVisibility === 'all') {
											result.edges.push({
												from: node,
												to: target,
												style: 'stroke-dasharray: 5, 5; fill:transparent; ', // "stroke: #ddd; stroke-width: 1px; fill:transparent; stroke-dasharray: 5, 5;",
												class:
													'layer-' +
													(layer + 1) +
													' node-' +
													node +
													' node-' +
													target,
											})
										}
									}
								}
							}
						}
					}
					previousRow = nextRow
				}
			}
			return result
		},
		handleClick(params) {
			// https://visjs.github.io/vis-network/docs/network/#events
			// Add interactivity
			const nodeId = params.nodes[0]
			if (nodeId) {
				const node = this.filteredNodes.find((n) => n.id === nodeId)
				this.$emit('node-click', node)
			}
		},
	},
}
</script>
