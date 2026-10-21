<template>
	<div class="floor-plan-view">
		<!-- the map tools sit next to the mode switch in the Mesh page's toolbar -->
		<Teleport defer to="#mesh-toolbar">
			<v-select
				v-if="floorPlans.maps.length"
				:model-value="currentMap?.id"
				@update:model-value="selectMap"
				:items="floorPlans.maps"
				item-title="name"
				item-value="id"
				label="Map"
				density="compact"
				variant="outlined"
				hide-details
				style="max-width: 300px"
			></v-select>
			<template v-if="currentMap">
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
							prepend-icon="light_mode"
							@click="uploadBackground(false)"
						>
							<v-list-item-title>{{
								background?.image
									? 'Replace light theme picture'
									: 'Add light theme picture'
							}}</v-list-item-title>
						</v-list-item>
						<v-list-item
							prepend-icon="dark_mode"
							@click="uploadBackground(true)"
						>
							<v-list-item-title>{{
								background?.darkImage
									? 'Replace dark theme picture'
									: 'Add dark theme picture'
							}}</v-list-item-title>
						</v-list-item>
						<v-list-item
							v-if="background?.image"
							prepend-icon="hide_image"
							@click="removeBackground(false)"
						>
							<v-list-item-title
								>Remove light theme picture</v-list-item-title
							>
						</v-list-item>
						<v-list-item
							v-if="background?.darkImage"
							prepend-icon="hide_image"
							@click="removeBackground(true)"
						>
							<v-list-item-title
								>Remove dark theme picture</v-list-item-title
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
		</Teleport>

		<floor-plan-map
			v-if="currentMap"
			:map="currentMap"
			:nodes="nodes"
			:home-hex="appInfo.homeHex"
			:dark="$vuetify.theme.current.dark"
			:editing="editing"
			@node-click="$emit('node-click', $event)"
			@place="onPlace"
			@place-many="onPlaceMany"
			@unplace="onUnplace"
			@set-nodes="onSetNodes"
			@view-change="onViewChange"
			@image-error="onImageError"
		/>
		<v-empty-state
			v-else-if="loaded"
			icon="map"
			headline="No floorplans yet"
			text="Make a map, give it a picture of your floorplan and place your nodes on it to see the mesh where it really is."
		>
			<template #actions>
				<v-btn color="primary" prepend-icon="add" @click="newMap"
					>New map</v-btn
				>
			</template>
		</v-empty-state>
	</div>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import { mapState } from 'pinia'
import useBaseStore from '../../stores/base.js'
import InstancesMixin from '../../mixins/InstancesMixin.js'
import ConfigApis from '../../apis/ConfigApis.js'
import { Settings } from '@/modules/Settings'
import { escapeHtml } from '@/lib/accessControl.ts'

const settings = new Settings(localStorage)

export default {
	name: 'FloorPlanView',
	mixins: [InstancesMixin],
	components: {
		FloorPlanMap: defineAsyncComponent(
			() => import('@/components/custom/FloorPlanMap.vue'),
		),
	},
	emits: ['node-click'],
	data() {
		return {
			mapId: settings.load('meshFloorPlanMap', ''),
			floorPlans: { settings: {}, maps: [] },
			loaded: false,
			editing: false,
		}
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
		background() {
			return this.currentMap?.background ?? null
		},
		isDefaultMap() {
			return (
				!!this.currentMap &&
				this.floorPlans.settings.defaultMapId === this.currentMap.id
			)
		},
	},
	watch: {
		'currentMap.id'() {
			this.editing = false
		},
	},
	created() {
		// only the newest load may update the page, see loadFloorPlans
		this.loadCount = 0
		// pictures already reported as missing
		this.brokenImages = new Set()
	},
	mounted() {
		this.loadFloorPlans()
	},
	methods: {
		selectMap(id) {
			this.mapId = id
			settings.store('meshFloorPlanMap', id)
		},
		/**
		 * Reload the floorplans. Writes reload when they finish, so a slow
		 * reply can arrive after a newer one: only the newest is used.
		 */
		async loadFloorPlans() {
			const count = ++this.loadCount
			try {
				const res = await ConfigApis.getFloorPlans()
				if (count !== this.loadCount) return
				if (!res.success) throw Error(res.message)
				this.floorPlans = res.data
				this.loaded = true
			} catch (error) {
				if (count !== this.loadCount) return
				this.showSnackbar(
					`Couldn't load the floorplans: ${error.message}`,
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
			const map = await this.floorPlanCall('create the map', () =>
				ConfigApis.addFloorPlanMap({ name }),
			)
			if (map) this.selectMap(map.id)
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
				`Delete <b>${escapeHtml(map.name)}</b> with its node positions and background pictures?`,
				'alert',
				{ confirmText: 'Delete', width: 450 },
			)
			if (!ok) return
			await this.floorPlanCall('delete the map', () =>
				ConfigApis.deleteFloorPlanMap(map.id),
			)
		},
		async uploadBackground(dark) {
			const map = this.currentMap
			const { file } = await this.app.confirm(
				dark ? 'Dark theme picture' : 'Light theme picture',
				`A PNG, JPEG or WebP image of your floorplan, shown while the UI is in ${dark ? 'dark' : 'light'} theme, and in the other theme too when the map has no picture for it. If its shape differs from the map's, you choose how it fits.`,
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
			const maxBytes = this.floorPlans.limits?.maxImageBytes
			if (maxBytes && file.size > maxBytes) {
				this.showSnackbar(
					`Image is larger than ${maxBytes / 1024 / 1024} MB`,
					'error',
				)
				return
			}
			// the server reads the size from the header; this is the fallback
			let size = null
			try {
				const bitmap = await createImageBitmap(file)
				size = { width: bitmap.width, height: bitmap.height }
				bitmap.close()
			} catch {
				// not decodable here, the server decides
			}
			const fit = size
				? await this.askImageFit(map, size, dark)
				: 'stretch'
			if (!fit) return
			const res = await this.floorPlanCall('upload the picture', () =>
				ConfigApis.setFloorPlanImage(map.id, file, { dark, size, fit }),
			)
			// with a known size, stretching was asked for in askImageFit
			if (res?.stretched && !size) {
				this.showSnackbar(
					"The picture's shape differs from the map's frame, so it's stretched to fit",
					'warning',
				)
			}
		},
		/**
		 * How a new picture of `size` fits `map`: 'stretch', 'scale' or 'keep'
		 * (see the server's setMapImage), or null when cancelled. Only asked
		 * when its shape differs from the map's frame and something on the map
		 * (placed nodes, the other theme's picture) depends on that frame.
		 */
		async askImageFit(map, size, dark) {
			const bg = map.background
			const frame = bg?.imageRect ?? { w: map.widthPx, h: map.heightPx }
			const aspect = size.width / size.height / (frame.w / frame.h)
			// the server's STRETCH_TOLERANCE
			if (Math.abs(aspect - 1) <= 0.02) return 'stretch'
			const other = dark ? bg?.image : bg?.darkImage
			if (!map.placements.length && !other) return 'scale'
			const { fit } = await this.app.confirm(
				'The picture has a different shape',
				`It's ${size.width} × ${size.height} px, the map is ${Math.round(frame.w)} × ${Math.round(frame.h)}.` +
					(other
						? ` Using it as is also stretches the ${dark ? 'light' : 'dark'} theme picture to its shape.`
						: ''),
				'info',
				{
					confirmText: 'Upload',
					width: 500,
					inputs: [
						{
							type: 'list',
							label: 'Fit',
							key: 'fit',
							default: 'stretch',
							items: [
								{
									title: "Stretch it to the map's shape",
									value: 'stretch',
								},
								{
									title: 'Use as is, nodes keep their relative spots',
									value: 'scale',
								},
								{
									title: 'Use as is, nodes keep their exact positions',
									value: 'keep',
								},
							],
						},
					],
				},
			)
			return fit ?? null
		},
		async removeBackground(dark) {
			const map = this.currentMap
			const ok = await this.app.confirm(
				'Remove picture',
				`Remove the ${dark ? 'dark' : 'light'} theme picture from this map? Node positions are kept.`,
				'alert',
				{ confirmText: 'Remove', width: 450 },
			)
			if (!ok) return
			await this.floorPlanCall('remove the picture', () =>
				ConfigApis.removeFloorPlanImage(map.id, { dark }),
			)
		},
		onImageError(file) {
			if (this.brokenImages.has(file)) return
			this.brokenImages.add(file)
			this.showSnackbar(
				"This map's background picture couldn't be loaded. Upload it again from the Background menu.",
				'error',
			)
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
	},
}
</script>

<style scoped>
.floor-plan-view {
	height: 100%;
}
</style>
