<template>
	<v-container class="fill" fluid>
		<div class="d-flex align-center flex-wrap ga-3 mb-2">
			<v-btn-toggle
				v-model="mode"
				mandatory
				density="compact"
				variant="outlined"
				divided
			>
				<v-btn value="graph" prepend-icon="hub">Graph</v-btn>
				<v-btn value="map" prepend-icon="map">Floorplan</v-btn>
			</v-btn-toggle>
			<v-select
				v-if="mode === 'map' && floorPlans.maps.length"
				v-model="mapId"
				:items="floorPlans.maps"
				item-title="name"
				item-value="id"
				label="Map"
				density="compact"
				variant="outlined"
				hide-details
				style="max-width: 300px"
			></v-select>
		</div>

		<div class="mesh-body">
			<zwave-graph
				v-if="mode === 'graph'"
				ref="mesh"
				id="mesh"
				:nodes="nodes"
				@node-click="nodeClick"
				@node-added="fetchNodeRoutes"
				@node-removed="onNodeRemoved"
			/>
			<template v-else>
				<floor-plan-map
					v-if="currentMap"
					:map="currentMap"
					:backgrounds="floorPlans.backgrounds"
					:nodes="nodes"
					:home-hex="appInfo.homeHex"
					:dark="$vuetify.theme.current.dark"
					@node-click="nodeClick"
				/>
				<v-empty-state
					v-else-if="floorPlansLoaded"
					icon="map"
					headline="No floorplans yet"
					text="Make a map, give it a picture of your floorplan and place your nodes on it to see the mesh where it really is."
				>
					<template #actions>
						<v-btn
							color="primary"
							prepend-icon="add"
							@click="newMap"
							>New map</v-btn
						>
					</template>
				</v-empty-state>
			</template>
		</div>
		<node-panel
			v-if="$vuetify.display.mdAndUp"
			:node="selectedNode"
			:socket="socket"
			v-model="showProperties"
			id="properties"
			draggable
			class="details"
		/>

		<v-bottom-sheet scrollable v-else v-model="showProperties">
			<v-card scrollable class="text-center">
				<v-card-text>
					<node-panel
						:node="selectedNode"
						:socket="socket"
						v-model="showProperties"
					/>
				</v-card-text>
			</v-card>
		</v-bottom-sheet>
	</v-container>
</template>

<style scoped>
.mesh-body {
	height: calc(100% - 56px);
}

.details {
	position: absolute;
	top: 150px;
	left: 30px;
	background: v-bind('$vuetify.theme.current.colors.surface');
	border: 2px solid black;
	border-radius: 20px;
	max-width: 500px;
	z-index: 1;
	max-height: 80vh;
	overflow-y: scroll;
	overflow-x: hidden;
	cursor: move;
}

.details::-webkit-scrollbar {
	display: none;
}
</style>

<script>
import { defineAsyncComponent, nextTick } from 'vue'
import { mapActions, mapState } from 'pinia'
import useBaseStore from '../stores/base.js'
import InstancesMixin from '../mixins/InstancesMixin.js'
import ConfigApis from '../apis/ConfigApis.js'
import { Settings } from '@/modules/Settings'

const settings = new Settings(localStorage)

export default {
	name: 'Mesh',
	mixins: [InstancesMixin],
	props: {
		socket: Object,
	},
	components: {
		ZwaveGraph: defineAsyncComponent(
			() => import('@/components/custom/ZwaveGraph.vue'),
		),
		NodePanel: defineAsyncComponent(
			() => import('@/components/custom/NodePanel.vue'),
		),
		FloorPlanMap: defineAsyncComponent(
			() => import('@/components/custom/FloorPlanMap.vue'),
		),
	},
	computed: {
		...mapState(useBaseStore, ['nodes', 'appInfo']),
		/** the map picked in this browser, else the default map, else the first */
		currentMap() {
			const { maps, settings: s } = this.floorPlans
			return (
				maps.find((m) => m.id === this.mapId) ??
				maps.find((m) => m.id === s.defaultMapId) ??
				maps[0] ??
				null
			)
		},
	},
	documentListeners: {},
	data() {
		return {
			selectedNode: null,
			showProperties: false,
			mode: settings.load('meshMode', 'graph'),
			mapId: settings.load('meshFloorPlanMap', ''),
			floorPlans: { settings: {}, backgrounds: [], maps: [] },
			floorPlansLoaded: false,
		}
	},
	mounted() {
		if (this.mode === 'map') this.loadFloorPlans()
	},
	watch: {
		mode(v) {
			settings.store('meshMode', v)
			this.nodeClick(null)
			if (v === 'map') this.loadFloorPlans()
		},
		mapId(v) {
			settings.store('meshFloorPlanMap', v)
		},
		showProperties(v) {
			// Return to overview map when closing the node properties dialog
			// using the X in the top right corner
			if (!v && this.selectedNode) {
				this.selectedNode = null
				this.$refs.mesh?.clearSelection()
			}
		},
	},
	methods: {
		...mapActions(useBaseStore, ['setNeighbors']),
		async loadFloorPlans() {
			try {
				const res = await ConfigApis.getFloorPlans()
				if (!res.success) throw Error(res.message)
				this.floorPlans = res.data
				this.floorPlansLoaded = true
			} catch (error) {
				this.showSnackbar(
					`Couldn't load the floorplans: ${error.message}`,
					'error',
				)
			}
		},
		async newMap() {
			const { name } = await this.app.confirm('New map', '', 'info', {
				confirmText: 'Create',
				width: 400,
				inputs: [
					{
						type: 'text',
						label: 'Name',
						key: 'name',
						required: true,
						default: 'Ground floor',
					},
				],
			})
			if (!name) return
			try {
				const res = await ConfigApis.addFloorPlanMap({ name })
				if (!res.success) throw Error(res.message)
				await this.loadFloorPlans()
				this.mapId = res.data.id
			} catch (error) {
				this.showSnackbar(
					`Couldn't create the map: ${error.message}`,
					'error',
				)
			}
		},
		setInitialPosition(element) {
			const windowHeight = window.innerHeight
			const windowWidth = window.innerWidth

			const popupHeight = element.offsetHeight
			const popupWidth = element.offsetWidth

			// Set initial position (e.g., center of the window)
			let initialTop = (windowHeight - popupHeight) / 2 - 50
			let initialLeft = (windowWidth - popupWidth) / 10

			if (initialTop < 0) initialTop = 10
			if (initialLeft < 0) initialLeft = 10

			element.style.top = initialTop + 'px'
			element.style.left = initialLeft + 'px'
		},
		makeDivDraggable() {
			const elmnt = document.getElementById('properties')

			if (!elmnt) {
				return
			}

			// prevent to make it draggable multiple times
			if (elmnt.hasAttribute('data-draggable')) {
				return
			}

			elmnt.setAttribute('data-draggable', true)

			setTimeout(() => {
				this.setInitialPosition(elmnt)
			}, 100)

			let startX = 0
			let startY = 0

			elmnt.onmousedown = dragMouseDown

			function dragMouseDown(e) {
				e = e || window.event

				// return routes drag
				if (e.target.classList.contains('handle')) {
					return
				}

				e.preventDefault()

				// prevent drag when clicking on chart
				if (e.target.classList.contains('u-over')) {
					return
				}
				// get the mouse cursor position at startup:
				startX = e.clientX
				startY = e.clientY
				document.onmouseup = closeDragElement
				// call a function whenever the cursor moves:
				document.onmousemove = elementDrag
			}

			function elementDrag(e) {
				e = e || window.event
				e.preventDefault()
				// calculate the new cursor position:
				const x = startX - e.clientX
				const y = startY - e.clientY
				startX = e.clientX
				startY = e.clientY

				// set the element's new position:
				elmnt.style.top = elmnt.offsetTop - y + 'px'
				elmnt.style.left = elmnt.offsetLeft - x + 'px'
			}

			function closeDragElement() {
				/* stop moving when mouse button is released:*/
				document.onmouseup = null
				document.onmousemove = null
			}
		},
		onNodeRemoved(node) {
			if (this.selectedNode && this.selectedNode.id === node.id) {
				this.nodeClick(null)
			}
		},
		async fetchNodeRoutes(node) {
			if (!node || node.isControllerNode) return

			await Promise.allSettled([
				this.app.apiRequest('getPriorityRoute', [node.id]),
				this.app.apiRequest('getCustomSUCReturnRoute', [node.id]),
				this.app.apiRequest('getPrioritySUCReturnRoute', [node.id]),
			])
		},
		async nodeClick(node) {
			if (!node) {
				// clicked empty space — return to overview
				this.selectedNode = null
				this.showProperties = false
				return
			}

			this.selectedNode = node
			this.showProperties = true
			if (this.$vuetify.display.mdAndUp) {
				await nextTick()
				this.makeDivDraggable()
			}
		},
	},
}
</script>
