<template>
	<v-container fluid>
		<zwave-graph
			ref="mesh"
			id="mesh"
			:nodes="nodes"
			@node-click="nodeClick"
		/>

		<v-container
			id="properties"
			draggable
			v-show="showProperties"
			class="details"
		>
			<v-icon
				@click="showProperties = false"
				style="
					cursor: pointer;
					position: absolute;
					right: 10px;
					top: 10px;
				"
				>clear</v-icon
			>
			<v-icon
				@click="showProperties = false"
				style="
					cursor: pointer;
					position: absolute;
					right: 10px;
					top: 10px;
				"
				>clear</v-icon
			>
			<v-col v-if="selectedNode">
				<v-subheader>Node properties</v-subheader>
				<v-list dense style="min-width: 300px; background: transparent">
					<v-list-item dense>
						<v-list-item-content>ID</v-list-item-content>
						<v-list-item-content class="align-end">{{
							selectedNode.id
						}}</v-list-item-content>
					</v-list-item>
					<v-list-item dense>
						<v-list-item-content>Status</v-list-item-content>
						<v-list-item-content class="align-end">{{
							selectedNode.status
						}}</v-list-item-content>
					</v-list-item>
					<v-list-item dense>
						<v-list-item-content>Code</v-list-item-content>
						<v-list-item-content class="align-end">{{
							selectedNode.productLabel
						}}</v-list-item-content>
					</v-list-item>
					<v-list-item dense>
						<v-list-item-content>Product</v-list-item-content>
						<v-list-item-content class="align-end">{{
							selectedNode.productDescription
						}}</v-list-item-content>
					</v-list-item>
					<v-list-item dense>
						<v-list-item-content>Manufacturer</v-list-item-content>
						<v-list-item-content class="align-end">{{
							selectedNode.manufacturer
						}}</v-list-item-content>
					</v-list-item>
					<v-list-item v-if="selectedNode.name">
						<v-list-item-content>Name</v-list-item-content>
						<v-list-item-content class="align-end">{{
							selectedNode.name
						}}</v-list-item-content>
					</v-list-item>
					<v-list-item v-if="selectedNode.loc">
						<v-list-item-content>Location</v-list-item-content>
						<v-list-item-content class="align-end">{{
							selectedNode.loc
						}}</v-list-item-content>
					</v-list-item>
					<v-list-item dense>
						<v-list-item-content>Statistics</v-list-item-content>
						<v-list-item-content class="align-end"
							><statistics-arrows :node="selectedNode"
						/></v-list-item-content>
					</v-list-item>
					<div v-if="lwr">
						<v-subheader>Last working route</v-subheader>
						<v-list-item dense v-for="(s, i) in lwr" :key="i">
							<v-list-item-content>{{
								s.title
							}}</v-list-item-content>
							<v-list-item-content class="align-end">{{
								s.text
							}}</v-list-item-content>
						</v-list-item>
					</div>

					<div v-if="nlwr">
						<v-subheader>Next Last working route</v-subheader>
						<v-list-item dense v-for="(s, i) in nlwr" :key="i">
							<v-list-item-content>{{
								s.title
							}}</v-list-item-content>
							<v-list-item-content class="align-end">{{
								s.text
							}}</v-list-item-content>
						</v-list-item>
					</div>
				</v-list>
				<v-row
					v-if="!selectedNode.isControllerNode"
					class="mt-1"
					justify="center"
				>
					<v-btn color="primary" rounded @click="dialogHealth = true"
						>Check Health</v-btn
					>
				</v-row>
			</v-col>
		</v-container>
		<v-speed-dial style="left: 100px" bottom fab left fixed v-model="fab">
			<template v-slot:activator>
				<v-btn color="blue darken-2" dark fab hover v-model="fab">
					<v-icon v-if="fab">close</v-icon>
					<v-icon v-else>add</v-icon>
				</v-btn>
			</template>
			<v-btn fab dark small color="green" @click="debounceRefresh">
				<v-icon>refresh</v-icon>
			</v-btn>
		</v-speed-dial>
		<dialog-health-check
			v-model="dialogHealth"
			@close="dialogHealth = false"
			:node="selectedNode"
			:socket="socket"
			:nodes="nodes"
			v-on="$listeners"
		/>
	</v-container>
</template>

<style scoped>
.details {
	position: absolute;
	top: 150px;
	left: 30px;
	background: #ccccccaa;
	border: 2px solid black;
	border-radius: 20px;
	max-width: 400px;
	z-index: 1;
}
</style>

<script>
import ZwaveGraph from '@/components/custom/ZwaveGraph.vue'
import { mapMutations, mapGetters } from 'vuex'

import { socketEvents, inboundEvents as socketActions } from '@/plugins/socket'
import StatisticsArrows from '@/components/custom/StatisticsArrows.vue'
import DialogHealthCheck from './dialogs/DialogHealthCheck.vue'

const ProtocolDataRate = {
	1: 'ZWave_9k6',
	2: 'ZWave_40k',
	3: 'ZWave_100k',
	4: 'LongRange_100k',
}

export default {
	name: 'Mesh',
	props: {
		socket: Object,
	},
	components: {
		ZwaveGraph,
		StatisticsArrows,
		DialogHealthCheck,
	},
	computed: {
		...mapGetters(['nodes']),
		lwr() {
			if (!this.selectedNode) return null

			const stats = this.selectedNode.statistics

			if (!stats || !stats.lwr) return null

			const routeStats = this.parseRouteStats(stats.lwr)

			return routeStats
		},
		nlwr() {
			if (!this.selectedNode) return null

			const stats = this.selectedNode.statistics

			if (!stats || !stats.nlwr) return null

			const routeStats = this.parseRouteStats(stats.nlwr)

			return routeStats
		},
	},
	data() {
		return {
			dialogHealth: false,
			nodeSize: 20,
			fontSize: 10,
			force: 2000,
			fab: false,
			selectedNode: null,
			showProperties: false,
			showLocation: false,
			refreshTimeout: null,
		}
	},
	methods: {
		...mapMutations(['showSnackbar', 'setNeighbors']),
		nodeClick(node) {
			this.selectedNode = this.selectedNode === node ? null : node
			this.showProperties = !!this.selectedNode
		},
		parseRouteStats(stats) {
			const repRSSI = stats.repeaterRSSI || []
			const repeaters =
				stats.repeaters?.length > 0
					? stats.repeaters
							.map(
								(r, i) =>
									`${r}${
										repRSSI[i] ? ` (${repRSSI[i]})` : ''
									}`
							)
							.join(', ')
					: 'None, direct connection'
			const routeFiled = stats.routeFailedBetween
				? stats.routeFailedBetween
						.map((r) => `${r[0]} --> ${r[1]}`)
						.join(', ')
				: 'N/A'

			return [
				{
					title: 'RSSI',
					text: stats.rssi ? stats.rssi + ' ms' : 'N/A',
				},
				{
					title: 'Protocol Data Rate',
					text: ProtocolDataRate[stats.protocolDataRate] || 'N/A',
				},
				{
					title: 'Repeaters',
					text: repeaters,
				},
				{
					title: 'Route failed between',
					text: routeFiled,
				},
			]
		},
		debounceRefresh() {
			if (this.refreshTimeout) {
				clearTimeout(this.refreshTimeout)
			}

			this.refreshTimeout = setTimeout(this.refresh.bind(this), 500)
		},
		refresh() {
			this.socket.emit(socketActions.zwave, {
				api: 'refreshNeighbors',
				args: [],
			})
		},
		checkHealth(type) {
			this.socket.emit(socketActions.zwave, {
				api: `check${type}Health`,
				args: [this.selectedNode.id],
			})
		},
	},
	mounted() {
		this.socket.on(socketEvents.api, (data) => {
			if (data.success) {
				switch (data.api) {
					case 'refreshNeighbors': {
						this.showSnackbar('Nodes Neighbors updated')
						this.setNeighbors(data.result)
						// refresh graph
						// this.$refs.mesh.debounceRefresh()
						break
					}
				}
			}
		})

		// make properties window draggable
		const propertiesDiv = document.getElementById('properties')
		const mesh = document.getElementById('mesh')
		let isDown = false
		let offset = [0, 0]

		// TODO: Update dimensions on screen resize
		const dimensions = [mesh.clientWidth, mesh.clientHeight]

		propertiesDiv.addEventListener(
			'mousedown',
			function (e) {
				isDown = true
				offset = [
					propertiesDiv.offsetLeft - e.clientX,
					propertiesDiv.offsetTop - e.clientY,
				]
			},
			true
		)

		document.addEventListener(
			'mouseup',
			function () {
				isDown = false
			},
			true
		)

		document.addEventListener(
			'mousemove',
			function (e) {
				e.preventDefault()
				if (isDown) {
					const l = e.clientX
					const r = e.clientY

					if (l > 0 && l < dimensions[0]) {
						propertiesDiv.style.left = l + offset[0] + 'px'
					}
					if (r > 0 && r < dimensions[1]) {
						propertiesDiv.style.top = r + offset[1] + 'px'
					}
				}
			},
			true
		)

		this.debounceRefresh()
	},
	beforeDestroy() {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout)
		}
		if (this.socket) {
			// unbind events
			this.socket.off(socketEvents.api)
		}
	},
}
</script>
