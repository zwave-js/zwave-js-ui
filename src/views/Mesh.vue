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
			<template v-if="mode === 'map' && currentMap">
				<v-menu>
					<template #activator="{ props }">
						<v-btn
							v-bind="props"
							variant="outlined"
							append-icon="arrow_drop_down"
							>Map</v-btn
						>
					</template>
					<v-list density="compact">
						<v-list-item prepend-icon="add" @click="newMap">
							<v-list-item-title>New map</v-list-item-title>
						</v-list-item>
						<v-list-item
							prepend-icon="drive_file_rename_outline"
							@click="renameMap"
						>
							<v-list-item-title>Rename</v-list-item-title>
						</v-list-item>
						<v-list-item
							:prepend-icon="
								isDefaultMap ? 'star' : 'star_border'
							"
							@click="toggleDefaultMap"
						>
							<v-list-item-title>{{
								isDefaultMap
									? 'Stop opening this map by default'
									: 'Open this map by default'
							}}</v-list-item-title>
						</v-list-item>
						<v-list-item
							prepend-icon="delete"
							base-color="error"
							@click="deleteMap"
						>
							<v-list-item-title>Delete map</v-list-item-title>
						</v-list-item>
					</v-list>
				</v-menu>
				<v-menu>
					<template #activator="{ props }">
						<v-btn
							v-bind="props"
							variant="outlined"
							append-icon="arrow_drop_down"
							>Background</v-btn
						>
					</template>
					<v-list density="compact">
						<v-list-item
							prepend-icon="image"
							@click="uploadBackground('light')"
						>
							<v-list-item-title>{{
								currentBackground?.image
									? 'Replace picture'
									: 'Add picture'
							}}</v-list-item-title>
						</v-list-item>
						<v-list-item
							prepend-icon="dark_mode"
							:disabled="!currentBackground"
							@click="uploadBackground('dark')"
						>
							<v-list-item-title>{{
								currentBackground?.imageDark
									? 'Replace dark mode picture'
									: 'Add dark mode picture'
							}}</v-list-item-title>
						</v-list-item>
						<v-list-item
							v-if="currentBackground?.imageDark"
							prepend-icon="hide_image"
							@click="removeBackground('dark')"
						>
							<v-list-item-title
								>Remove dark mode picture</v-list-item-title
							>
						</v-list-item>
						<v-list-item
							v-if="currentBackground"
							prepend-icon="delete"
							base-color="error"
							@click="removeBackground('all')"
						>
							<v-list-item-title
								>Remove background</v-list-item-title
							>
						</v-list-item>
					</v-list>
				</v-menu>
				<v-btn
					:variant="editing ? 'flat' : 'outlined'"
					color="primary"
					:prepend-icon="editing ? 'done' : 'edit'"
					@click="editing = !editing"
					>{{ editing ? 'Done' : 'Edit' }}</v-btn
				>
			</template>
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
					:editing="editing"
					@node-click="nodeClick"
					@place="onPlace"
					@place-many="onPlaceMany"
					@unplace="onUnplace"
					@set-nodes="onSetNodes"
					@view-change="onViewChange"
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

// confirm messages are HTML
const esc = (s) => {
	const el = document.createElement('span')
	el.textContent = s
	return el.innerHTML
}

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
		currentBackground() {
			const id = this.currentMap?.background?.id
			return (
				(id && this.floorPlans.backgrounds.find((b) => b.id === id)) ||
				null
			)
		},
		isDefaultMap() {
			return (
				!!this.currentMap &&
				this.floorPlans.settings.defaultMapId === this.currentMap.id
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
			editing: false,
		}
	},
	async mounted() {
		// a browser that never picked a mode opens the default map, if any
		const picked = localStorage.getItem('meshMode')
		if (this.mode === 'map' || !picked) await this.loadFloorPlans()
		if (!picked && this.floorPlans.settings.defaultMapId) {
			this.autoMode = true
			this.mode = 'map'
		}
	},
	watch: {
		mode(v) {
			if (!this.autoMode) settings.store('meshMode', v)
			this.autoMode = false
			this.editing = false
			this.nodeClick(null)
			if (v === 'map') this.loadFloorPlans()
		},
		mapId(v) {
			settings.store('meshFloorPlanMap', v)
			this.editing = false
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
		/** run a floorplan API call, then reload the floorplans */
		async floorPlanCall(what, call, { reload = true } = {}) {
			try {
				const res = await call()
				if (!res.success) throw Error(res.message)
				if (reload) await this.loadFloorPlans()
				return res.data
			} catch (error) {
				this.showSnackbar(`Couldn't ${what}: ${error.message}`, 'error')
				// show the stored state again, e.g. a dragged node snaps back
				if (reload) await this.loadFloorPlans()
				return undefined
			}
		},
		onPlace(placement) {
			return this.floorPlanCall('place the node', () =>
				ConfigApis.setFloorPlanPlacement(this.currentMap.id, placement),
			)
		},
		onPlaceMany(placements) {
			return this.floorPlanCall('place the nodes', () =>
				ConfigApis.setFloorPlanPlacements(
					this.currentMap.id,
					placements,
				),
			)
		},
		onUnplace(deviceKey) {
			return this.floorPlanCall('remove the node', () =>
				ConfigApis.removeFloorPlanPlacement(
					this.currentMap.id,
					deviceKey,
				),
			)
		},
		onSetNodes(nodes) {
			return this.floorPlanCall('change the node list', () =>
				ConfigApis.updateFloorPlanMap(this.currentMap.id, { nodes }),
			)
		},
		/** the view is saved while editing; the map already shows it */
		onViewChange(view) {
			const map = this.currentMap
			return this.floorPlanCall(
				"save the map's view",
				async () => {
					const res = await ConfigApis.updateFloorPlanMap(map.id, {
						view,
					})
					if (res.success) map.view = res.data.view
					return res
				},
				{ reload: false },
			)
		},
		async renameMap() {
			const map = this.currentMap
			const { name } = await this.app.confirm('Rename map', '', 'info', {
				confirmText: 'Rename',
				width: 400,
				inputs: [
					{
						type: 'text',
						label: 'Name',
						key: 'name',
						required: true,
						default: map.name,
					},
				],
			})
			if (!name || name === map.name) return
			await this.floorPlanCall('rename the map', () =>
				ConfigApis.updateFloorPlanMap(map.id, { name }),
			)
		},
		toggleDefaultMap() {
			const defaultMapId = this.isDefaultMap ? null : this.currentMap.id
			return this.floorPlanCall('change the default map', () =>
				ConfigApis.updateFloorPlanSettings({ defaultMapId }),
			)
		},
		async deleteMap() {
			const map = this.currentMap
			const ok = await this.app.confirm(
				'Delete map',
				`Delete <b>${esc(map.name)}</b> with its node positions? Its background picture is deleted too unless another map uses it.`,
				'alert',
				{ confirmText: 'Delete', width: 450 },
			)
			if (!ok) return
			await this.floorPlanCall('delete the map', () =>
				ConfigApis.deleteFloorPlanMap(map.id),
			)
			this.editing = false
		},
		async uploadBackground(variant) {
			const map = this.currentMap
			const dark = variant === 'dark'
			const { file } = await this.app.confirm(
				dark ? 'Dark mode picture' : 'Background picture',
				dark
					? 'Shown instead of the picture while the UI is in dark mode. Use the same framing as the normal picture.'
					: 'A PNG, JPEG or WebP image of your floorplan, up to 25 MB. Node positions are kept when you replace it.',
				'info',
				{
					confirmText: 'Upload',
					width: 500,
					inputs: [
						{
							type: 'file',
							label: 'Image',
							key: 'file',
							required: true,
							accept: 'image/png,image/jpeg,image/webp',
						},
					],
				},
			)
			if (!file) return
			// the server reads the size from the header; this is the fallback
			let size = null
			try {
				const bitmap = await createImageBitmap(file)
				size = { width: bitmap.width, height: bitmap.height }
				bitmap.close()
			} catch {
				// not decodable here, the server decides
			}
			const res = await this.floorPlanCall('upload the picture', () =>
				ConfigApis.setFloorPlanImage(map.id, file, variant, size),
			)
			if (res?.stretched) {
				this.showSnackbar(
					"The picture's shape differs from the map's frame, so it's stretched to fit",
					'warning',
				)
			}
		},
		async removeBackground(variant) {
			const map = this.currentMap
			if (variant === 'all') {
				const ok = await this.app.confirm(
					'Remove background',
					'Remove the picture from this map? Node positions are kept.',
					'alert',
					{ confirmText: 'Remove', width: 450 },
				)
				if (!ok) return
			}
			await this.floorPlanCall('remove the picture', () =>
				ConfigApis.removeFloorPlanImage(map.id, variant),
			)
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
