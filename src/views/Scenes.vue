<template>
	<v-container fluid class="pa-4">
		<DialogSceneValue
			@save="saveValue"
			@close="closeDialog"
			v-model="dialogValue"
			:title="dialogTitle"
			:editedValue="editedValue"
			:nodes="nodes"
		/>

		<v-data-table
			:headers="headers_scenes"
			:items="scene_values"
			class="elevation-1"
		>
			<template #top>
				<v-col class="pt-0">
					<v-row>
						<v-col cols="12" sm="6" class="d-flex align-center">
							<v-select
								v-model="selectedScene"
								:items="scenesWithId"
								item-title="label"
								item-value="sceneid"
								label="Scene"
								class="ma-2"
								hide-details
								variant="outlined"
								style="max-width: 300px; min-width: 250px"
								clearable
							></v-select>
							<v-btn
								variant="text"
								color="primary"
								@click="createScene"
							>
								<v-icon start>add</v-icon>
								New Scene
							</v-btn>
						</v-col>
						<v-col
							cols="12"
							sm="6"
							class="d-flex align-center justify-end"
						>
							<v-btn variant="text" @click="importScenes">
								Import
								<v-icon end color="primary">file_upload</v-icon>
							</v-btn>
							<v-btn variant="text" @click="exportScenes">
								Export
								<v-icon end color="primary"
									>file_download</v-icon
								>
							</v-btn>
						</v-col>
					</v-row>
					<v-row v-if="selectedScene">
						<v-col class="d-flex align-center">
							<v-btn
								color="error"
								variant="text"
								@click="removeScene"
							>
								<v-icon start>delete</v-icon>
								Delete
							</v-btn>
							<v-btn
								color="success"
								variant="text"
								@click="activateScene"
							>
								<v-icon start>play_arrow</v-icon>
								Activate
							</v-btn>
							<v-btn
								color="primary"
								variant="text"
								@click="dialogValue = true"
							>
								<v-icon start>add</v-icon>
								New Value
							</v-btn>
						</v-col>
					</v-row>
				</v-col>
			</template>

			<template #[`item.timeout`]="{ item }">
				{{ item.timeout ? 'After ' + item.timeout + 's' : 'No' }}
			</template>
			<template #[`item.actions`]="{ item }">
				<v-icon
					size="small"
					color="success"
					class="mr-2"
					@click="editItem(item)"
					v-tooltip:bottom="'Edit'"
					>edit</v-icon
				>
				<v-icon
					size="small"
					color="error"
					@click="deleteItem(item)"
					v-tooltip:bottom="'Delete'"
					>delete</v-icon
				>
			</template>
		</v-data-table>
	</v-container>
</template>
<script>
import { mapState, mapActions } from 'pinia'
import useBaseStore from '../stores/base.js'
import InstancesMixin from '../mixins/InstancesMixin.js'
import { defineAsyncComponent } from 'vue'

export default {
	name: 'Scenes',
	mixins: [InstancesMixin],
	components: {
		DialogSceneValue: defineAsyncComponent(
			() => import('@/components/dialogs/DialogSceneValue.vue'),
		),
	},
	watch: {
		selectedScene() {
			this.refreshValues()
		},
		dialogValue(val) {
			val || this.closeDialog()
		},
	},
	computed: {
		...mapState(useBaseStore, ['nodes']),
		scenesWithId() {
			return this.scenes.map((s) => {
				return {
					...s,
					label: `[${s.sceneid}] ${s.label}`,
				}
			})
		},
		dialogTitle() {
			return this.editedIndex === -1 ? 'New Value' : 'Edit Value'
		},
	},
	data() {
		return {
			dialogValue: false,
			scenes: [],
			selectedScene: null,
			scene_values: [],
			editedValue: {},
			editedIndex: -1,
			headers_scenes: [
				{ title: 'Value ID', key: 'id' },
				{ title: 'Node', key: 'nodeId' },
				{ title: 'Label', key: 'label' },
				{ title: 'Value', key: 'value' },
				{ title: 'Timeout', key: 'timeout' },
				{ title: 'Actions', key: 'actions', sortable: false },
			],
		}
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		async importScenes() {
			if (
				await this.app.confirm(
					'Attention',
					'This operation will override all current scenes and cannot be undone',
					'alert',
				)
			) {
				try {
					const { data } = await this.app.importFile('json')
					if (data instanceof Array) {
						const response = await this.app.apiRequest(
							'_setScenes',
							[data],
						)
						if (response.success) {
							this.showSnackbar(
								'Successfully updated scenes',
								'success',
							)
							this.scenes = response.result
						}
					} else {
						this.showSnackbar('Imported file not valid', 'error')
					}
				} catch (error) {
					// noop
				}
			}
		},
		exportScenes() {
			this.app.exportConfiguration(this.scenes, 'scenes')
		},
		async refreshScenes() {
			const response = await this.app.apiRequest('_getScenes', [], {
				infoSnack: false,
				errorSnack: true,
			})

			if (response.success) {
				this.scenes = response.result
				if (!this.selectedScene) {
					this.selectedScene = this.scenes.length
						? this.scenes[0].sceneid
						: null
				}
			}
		},
		async createScene() {
			const result = await this.app.confirm('New Scene', '', 'info', {
				confirmText: 'Create',
				inputs: [
					{
						type: 'text',
						label: 'Scene name',
						key: 'name',
						required: true,
					},
				],
			})

			if (!result || !result.name) return

			const response = await this.app.apiRequest('_createScene', [
				result.name,
			])

			if (response.success) {
				this.showSnackbar('Scene created', 'success')
				this.refreshScenes()
			}
		},
		async removeScene() {
			if (
				this.selectedScene &&
				(await this.app.confirm(
					'Attention',
					'Are you sure you want to delete this scene?',
					'alert',
				))
			) {
				const response = await this.app.apiRequest('_removeScene', [
					this.selectedScene,
				])

				if (response.success) {
					this.selectedScene = null
					this.showSnackbar('Scene removed', 'success')
					this.refreshScenes()
				}
			}
		},
		async activateScene() {
			if (this.selectedScene) {
				const response = await this.app.apiRequest('_activateScene', [
					this.selectedScene,
				])

				if (response.success) {
					this.showSnackbar('Scene activated', 'success')
				}
			}
		},
		editItem(item) {
			this.editedIndex = this.scene_values.indexOf(item)
			const node = this.nodes.find((n) => n.id === item.nodeId) || {
				id: item.nodeId,
				name: '',
				loc: '',
				values: [],
			}

			let value = node.values.find((v) => v.id === item.id)

			value = value ? Object.assign({}, value) : Object.assign({}, item)
			value.newValue = item.value

			this.editedValue = {
				node: node,
				value: value,
				timeout: item.timeout,
			}

			this.dialogValue = true
		},
		async deleteItem(value) {
			if (
				await this.app.confirm(
					'Attention',
					'Are you sure you want to delete this item?',
					'alert',
				)
			) {
				const response = await this.app.apiRequest(
					'_removeSceneValue',
					[this.selectedScene, value],
				)

				if (response.success) {
					this.showSnackbar('Value removed', 'success')
					this.refreshValues()
				}
			}
		},
		closeDialog() {
			this.dialogValue = false
			setTimeout(() => {
				this.editedValue = {}
				this.editedIndex = -1
			}, 300)
		},
		async saveValue() {
			const value = this.editedValue.value
			value.value = value.newValue

			// if value already exists it will be updated
			const response = await this.app.apiRequest('_addSceneValue', [
				this.selectedScene,
				value,
				value.value,
				this.editedValue.timeout,
			])

			if (response.success) {
				this.showSnackbar('Value saved', 'success')
				this.refreshValues()
				this.closeDialog()
			}
		},
		async refreshValues() {
			if (this.selectedScene) {
				const response = await this.app.apiRequest(
					'_sceneGetValues',
					[this.selectedScene],
					{ infoSnack: false, errorSnack: true },
				)

				if (response.success) {
					this.scene_values = response.result
				}
			}
		},
	},
	mounted() {
		this.refreshScenes()
	},
}
</script>
