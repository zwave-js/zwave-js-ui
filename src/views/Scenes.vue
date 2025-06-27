<template>
	<v-container grid-list-md>
		<v-row>
			<v-col cols="12">
				<v-btn text @click="importScenes">
					Import
					<v-icon right dark color="primary">file_upload</v-icon>
				</v-btn>
				<v-btn text @click="exportScenes">
					Export
					<v-icon right dark color="primary">file_download</v-icon>
				</v-btn>
			</v-col>

			<v-col cols="12" sm="6">
				<v-select
					label="Scene"
					v-model="selectedScene"
					:items="scenesWithId"
					item-text="label"
					item-value="sceneid"
				></v-select>
			</v-col>

			<v-col cols="12" sm="6">
				<v-text-field
					label="New Scene"
					append-outer-icon="send"
					@click:append-outer="createScene"
					v-model.trim="newScene"
				></v-text-field>
			</v-col>
		</v-row>

		<DialogSceneValue
			@save="saveValue"
			@close="closeDialog"
			v-model="dialogValue"
			:title="dialogTitle"
			:editedValue="editedValue"
			:nodes="nodes"
		/>

		<v-data-table
			v-if="selectedScene"
			:headers="headers_scenes"
			:items="scene_values"
			class="elevation-1"
		>
			<template v-slot:top>
				<v-btn color="error" text @click="removeScene">Delete</v-btn>
				<v-btn color="success" text @click="activateScene"
					>Activate</v-btn
				>
				<v-btn color="primary" text @click="dialogValue = true"
					>New Value</v-btn
				>
			</template>

			<template v-slot:item="{ item }">
				<tr>
					<td class="text-xs">{{ item.id }}</td>
					<td class="text-xs">{{ item.nodeId }}</td>
					<td class="text-xs">{{ item.label }}</td>
					<td class="text-xs">{{ item.value }}</td>
					<td class="text-xs">
						{{
							item.timeout ? 'After ' + item.timeout + 's' : 'No'
						}}
					</td>
					<td>
						<v-icon
							small
							color="success"
							class="mr-2"
							@click="editItem(item)"
							>edit</v-icon
						>
						<v-icon small color="error" @click="deleteItem(item)"
							>delete</v-icon
						>
					</td>
				</tr>
			</template>
		</v-data-table>
	</v-container>
</template>
<script>
import { mapState, mapActions } from 'pinia'
import useBaseStore from '../stores/base.js'
import InstancesMixin from '../mixins/InstancesMixin.js'

export default {
	name: 'Scenes',
	mixins: [InstancesMixin],
	components: {
		DialogSceneValue: () =>
			import('@/components/dialogs/DialogSceneValue.vue'),
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
				s.label = `[${s.sceneid}] ${s.label}`
				return s
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
			newScene: '',
			scene_values: [],
			editedValue: {},
			editedIndex: -1,
			headers_scenes: [
				{ text: 'Value ID', value: 'id' },
				{ text: 'Node', value: 'nodeId' },
				{ text: 'Label', value: 'label' },
				{ text: 'Value', value: 'value' },
				{ text: 'Timeout', value: 'timeout' },
				{ text: 'Actions', sortable: false },
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
			}
		},
		async createScene() {
			if (this.newScene) {
				const response = await this.app.apiRequest('_createScene', [
					this.newScene,
				])

				if (response.success) {
					this.showSnackbar('Scene created', 'success')
					this.newScene = ''
					this.refreshScenes()
				}
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
