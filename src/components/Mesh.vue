<template>
	<v-container fluid>
		<v-card class="pa-5">
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
				<v-subheader>Node properties</v-subheader>

				<v-col v-if="selectedNode">
					<v-list
						dense
						style="min-width: 300px; background: transparent"
					>
						<v-list-item>
							<v-list-item-content>ID</v-list-item-content>
							<v-list-item-content class="align-end">{{
								selectedNode.id
							}}</v-list-item-content>
						</v-list-item>
						<v-list-item>
							<v-list-item-content>Status</v-list-item-content>
							<v-list-item-content class="align-end">{{
								selectedNode.status
							}}</v-list-item-content>
						</v-list-item>
						<v-list-item>
							<v-list-item-content>Code</v-list-item-content>
							<v-list-item-content class="align-end">{{
								selectedNode.productLabel
							}}</v-list-item-content>
						</v-list-item>
						<v-list-item>
							<v-list-item-content>Product</v-list-item-content>
							<v-list-item-content class="align-end">{{
								selectedNode.productDescription
							}}</v-list-item-content>
						</v-list-item>
						<v-list-item>
							<v-list-item-content
								>Manufacturer</v-list-item-content
							>
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
						<v-list-item>
							<v-list-item-content
								>Statistics</v-list-item-content
							>
							<v-list-item-content class="align-end"
								><statistics-arrows :node="selectedNode"
							/></v-list-item-content>
						</v-list-item>
					</v-list>
					<v-row
						v-if="!selectedNode.isControllerNode"
						class="mt-1"
						justify="center"
					>
						<v-btn
							color="primary"
							rounded
							@click="dialogHealth = true"
							>Check Health</v-btn
						>
					</v-row>
				</v-col>
			</v-container>
		</v-card>
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
}
</style>

<script>
import ZwaveGraph from '@/components/custom/ZwaveGraph.vue'
import { mapMutations, mapGetters } from 'vuex'

import { socketEvents, inboundEvents as socketActions } from '@/plugins/socket'
import StatisticsArrows from '@/components/custom/StatisticsArrows.vue'
import DialogHealthCheck from './dialogs/DialogHealthCheck.vue'

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
	watch: {
		nodes() {
			this.debounceRefresh()
		},
	},
	computed: {
		...mapGetters(['nodes']),
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
						this.$refs.mesh.debounceRefresh()
						break
					}
				}
			} else {
				this.showSnackbar(
					'Error while calling api ' + data.api + ': ' + data.message
				)
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
