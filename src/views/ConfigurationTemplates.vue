<template>
	<v-container grid-list-md>
		<v-data-table
			:headers="headers"
			:items="templates"
			:search="search"
			class="elevation-1"
		>
			<template #top>
				<v-toolbar flat>
					<v-text-field
						v-model="search"
						append-icon="search"
						label="Search"
						class="ml-2"
						single-line
						hide-details
						density="compact"
						variant="outlined"
						style="max-width: 300px"
						clearable
					></v-text-field>
					<v-spacer></v-spacer>
					<v-btn variant="text" @click="importTemplates">
						Import
						<v-icon end color="primary">file_upload</v-icon>
					</v-btn>
					<v-btn variant="text" @click="exportTemplates">
						Export
						<v-icon end color="primary">file_download</v-icon>
					</v-btn>
				</v-toolbar>
			</template>

			<template #[`item.autoApply`]="{ item }">
				<v-switch
					:model-value="item.autoApply"
					@update:model-value="toggleAutoApply(item)"
					density="compact"
					hide-details
					color="primary"
				></v-switch>
			</template>

			<template #[`item.values`]="{ item }">
				{{ item.values.length }} parameter(s)
			</template>

			<template #[`item.createdAt`]="{ item }">
				{{ formatDate(item.createdAt) }}
			</template>

			<template #[`item.actions`]="{ item }">
				<v-icon
					size="small"
					color="success"
					class="mr-2"
					@click="editItem(item)"
					v-tooltip:bottom="'Edit'"
				>
					edit
				</v-icon>
				<v-icon
					size="small"
					color="error"
					@click="deleteItem(item)"
					v-tooltip:bottom="'Delete'"
				>
					delete
				</v-icon>
			</template>
		</v-data-table>
	</v-container>
</template>

<script>
import ConfigApis from '@/apis/ConfigApis'
import { mapActions } from 'pinia'
import useBaseStore from '../stores/base.js'
import InstancesMixin from '../mixins/InstancesMixin.js'

export default {
	name: 'ConfigurationTemplates',
	mixins: [InstancesMixin],
	data() {
		return {
			templates: [],
			search: '',
			headers: [
				{ title: 'Name', key: 'name' },
				{ title: 'Device ID', key: 'deviceId' },
				{ title: 'Manufacturer', key: 'manufacturer' },
				{ title: 'Product', key: 'productLabel' },
				{ title: 'Min Firmware', key: 'minFirmwareVersion' },
				{ title: 'Values', key: 'values', sortable: false },
				{ title: 'Auto-Apply', key: 'autoApply' },
				{ title: 'Created', key: 'createdAt' },
				{
					title: 'Actions',
					key: 'actions',
					sortable: false,
				},
			],
		}
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		formatDate(dateStr) {
			if (!dateStr) return ''
			return new Date(dateStr).toLocaleDateString()
		},
		async refreshTemplates() {
			try {
				const response = await ConfigApis.getConfigurationTemplates()
				if (response.success) {
					this.templates = response.data || []
				}
			} catch (error) {
				this.showSnackbar(error.message, 'error')
			}
		},
		async toggleAutoApply(item) {
			try {
				const response = await ConfigApis.updateConfigurationTemplate(
					item.id,
					{ autoApply: !item.autoApply },
				)
				if (response.success) {
					item.autoApply = !item.autoApply
				}
				this.showSnackbar(
					response.message,
					response.success ? 'success' : 'error',
				)
			} catch (error) {
				this.showSnackbar(error.message, 'error')
			}
		},
		async editItem(item) {
			const result = await this.app.confirm('Edit Template', '', 'info', {
				confirmText: 'Save',
				inputs: [
					{
						type: 'text',
						label: 'Name',
						key: 'name',
						required: true,
						default: item.name,
					},
					{
						type: 'text',
						label: 'Min Firmware Version',
						key: 'minFirmwareVersion',
						default: item.minFirmwareVersion || '',
					},
				],
			})

			if (!result || !result.name) return

			try {
				const response = await ConfigApis.updateConfigurationTemplate(
					item.id,
					{
						name: result.name,
						minFirmwareVersion: result.minFirmwareVersion,
					},
				)
				if (response.success) {
					this.refreshTemplates()
				}
				this.showSnackbar(
					response.message,
					response.success ? 'success' : 'error',
				)
			} catch (error) {
				this.showSnackbar(error.message, 'error')
			}
		},
		async deleteItem(item) {
			if (
				await this.app.confirm(
					'Attention',
					`Are you sure you want to delete template "${item.name}"?`,
					'alert',
				)
			) {
				try {
					const response =
						await ConfigApis.deleteConfigurationTemplate(item.id)
					if (response.success) {
						this.refreshTemplates()
					}
					this.showSnackbar(
						response.message,
						response.success ? 'success' : 'error',
					)
				} catch (error) {
					this.showSnackbar(error.message, 'error')
				}
			}
		},
		async importTemplates() {
			const mode = await this.app.confirm(
				'Import Templates',
				'How should imported templates be handled?',
				'info',
				{
					confirmText: 'Import',
					inputs: [
						{
							type: 'list',
							label: 'Import mode',
							key: 'mode',
							items: [
								{
									title: 'Extend (add to existing)',
									value: 'extend',
								},
								{
									title: 'Replace (overwrite all)',
									value: 'replace',
								},
							],
							default: 'extend',
						},
					],
				},
			)

			if (!mode || !mode.mode) return

			try {
				const { data } = await this.app.importFile('json')
				if (!Array.isArray(data)) {
					this.showSnackbar('Imported file is not valid', 'error')
					return
				}
				const response = await ConfigApis.importConfigurationTemplates(
					data,
					mode.mode,
				)
				if (response.success) {
					this.refreshTemplates()
				}
				this.showSnackbar(
					response.message,
					response.success ? 'success' : 'error',
				)
			} catch (error) {
				// noop - user cancelled file picker
			}
		},
		async exportTemplates() {
			try {
				const response = await ConfigApis.exportConfigurationTemplates()
				if (response.success) {
					this.app.exportConfiguration(
						response.data,
						'configuration_templates',
						'json',
					)
				}
				this.showSnackbar(
					response.message,
					response.success ? 'success' : 'error',
				)
			} catch (error) {
				this.showSnackbar(error.message, 'error')
			}
		},
	},
	mounted() {
		this.refreshTemplates()
	},
}
</script>
