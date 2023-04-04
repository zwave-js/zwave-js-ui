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
							><statistics-arrows
								inactive-color="black"
								:node="selectedNode"
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
				<v-row v-else class="mt-1" justify="center">
					<!-- Full screen button -->
					<v-btn
						color="primary"
						rounded
						@click="showFullscreen = true"
						>Full Screen
						<v-icon>fullscreen</v-icon>
					</v-btn>

					<v-btn
						class="ml-2"
						color="warning"
						rounded
						@click="newWindow()"
						>Open
						<v-icon>open_in_new</v-icon>
					</v-btn>

					<bg-rssi-chart :node="selectedNode" />
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

		<!-- <v-overlay
			:style="{
				color: $vuetify.theme.dark ? 'white' : 'black',
				backgroundColor: $vuetify.theme.dark ? 'black' : 'white',
			}"
			opacity="0"
			z-index="9999"
			v-if="showFullscreen"
		>
			<v-btn
				style="position: absolute; top: 10px; right: 10px"
				icon
				large
				:color="$vuetify.theme.dark ? 'white' : 'black'"
				@click="showFullscreen = false"
			>
				<v-icon>close</v-icon>
			</v-btn>
			<bg-rssi-chart :node="selectedNode" fill-size />
		</v-overlay> -->

		<v-dialog
			fullscreen
			persistent
			@keydown.esc="showFullscreen = false"
			z-index="9999"
			v-model="showFullscreen"
		>
			<v-card v-if="selectedNode && selectedNode.isControllerNode">
				<v-card-text class="pt-4">
					<v-btn
						style="position: absolute; top: 10px; right: 10px"
						icon
						@click="showFullscreen = false"
					>
						<v-icon>close</v-icon>
					</v-btn>
					<bg-rssi-chart :node="selectedNode" fill-size />
				</v-card-text>
			</v-card>
		</v-dialog>
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
import { mapActions, mapState } from 'pinia'

import StatisticsArrows from '@/components/custom/StatisticsArrows.vue'
import DialogHealthCheck from '@/components/dialogs/DialogHealthCheck.vue'

import { protocolDataRateToString, rssiToString } from 'zwave-js/safe'
import useBaseStore from '../stores/base.js'
import InstancesMixin from '../mixins/InstancesMixin.js'
import BgRssiChart from '../components/custom/BgRssiChart.vue'
import { Routes } from '../router/index.js'

export default {
	name: 'Mesh',
	mixins: [InstancesMixin],
	props: {
		socket: Object,
	},
	components: {
		ZwaveGraph,
		StatisticsArrows,
		DialogHealthCheck,
		BgRssiChart,
	},
	computed: {
		...mapState(useBaseStore, ['nodes']),
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
			showFullscreen: false,
		}
	},
	methods: {
		...mapActions(useBaseStore, ['setNeighbors', 'showSnackbar']),
		newWindow() {
			const newwindow = window.open(
				Routes.controllerChart + '#no-topbar',
				'BG-RSSI-Chart',
				'height=800,width=1200,status=no,toolbar:no,scrollbars:no,menubar:no' // check https://www.w3schools.com/jsref/met_win_open.asp for all available specs
			)
			if (window.focus) {
				newwindow.focus()
			}
		},
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
										repRSSI[i]
											? ` (${rssiToString(repRSSI[i])})`
											: ''
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
					text: stats.rssi ? rssiToString(stats.rssi) : 'N/A',
				},
				{
					title: 'Protocol Data Rate',
					text:
						protocolDataRateToString(stats.protocolDataRate) ||
						'N/A',
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
		async refresh() {
			const response = await this.app.apiRequest('refreshNeighbors', [], {
				infoSnack: false,
				errorSnack: true,
			})

			if (response.success) {
				this.showSnackbar('Nodes Neighbors updated', 'success')
				this.setNeighbors(response.result)
				// refresh graph
				// this.$refs.mesh.debounceRefresh()
			}
		},
	},
	mounted() {
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
				// disable dragging if user clicks on graph
				if (e.target.classList.contains('u-over')) return

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
	},
}
</script>
