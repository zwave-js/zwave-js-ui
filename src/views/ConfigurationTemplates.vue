<template>
	<v-container fluid class="pa-4">
		<!-- WIZARD MODE -->
		<TemplateWizard
			v-if="wizardActive"
			:template="editingTemplate"
			@cancel="cancelWizard"
			@saved="onWizardSaved"
		/>

		<!-- TABLE MODE -->
		<v-data-table
			v-else
			:headers="headers"
			:items="templates"
			:search="search"
			class="elevation-1"
		>
			<template #top>
				<v-col class="pt-0">
					<v-row>
						<v-col cols="12" sm="6">
							<v-text-field
								v-model="search"
								clearable
								flat
								variant="outlined"
								hide-details
								single-line
								class="ma-2"
								style="max-width: 300px; min-width: 250px"
								prepend-inner-icon="search"
								label="Search"
								append-icon="refresh"
								@click:append="refreshTemplates"
							></v-text-field>
						</v-col>
						<v-col
							cols="12"
							sm="6"
							class="d-flex align-center justify-end"
						>
							<v-btn color="primary" @click="startCreateWizard">
								<v-icon start>add</v-icon>
								Create Template
							</v-btn>
							<v-btn variant="text" @click="importTemplates">
								Import
								<v-icon end color="primary">file_upload</v-icon>
							</v-btn>
							<v-btn variant="text" @click="exportTemplates">
								Export
								<v-icon end color="primary"
									>file_download</v-icon
								>
							</v-btn>
						</v-col>
					</v-row>
				</v-col>
			</template>

			<template #[`item.device`]="{ item }">
				{{
					[item.manufacturer, item.productLabel]
						.filter(Boolean)
						.join(' - ') || item.deviceId
				}}
			</template>

			<template #[`item.firmwareRange`]="{ item }">
				{{ formatFirmwareRange(item.firmwareRange) }}
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

			<template #[`item.devices`]="{ item }">
				{{ getMatchingNodes(item).length }}
			</template>

			<template #[`item.createdAt`]="{ item }">
				{{ formatDate(item.createdAt) }}
			</template>

			<template #[`item.actions`]="{ item }">
				<v-icon
					size="small"
					color="primary"
					class="mr-2"
					:disabled="applyingTemplate"
					@click="applyTemplate(item)"
					v-tooltip:bottom="'Apply to a node'"
				>
					play_arrow
				</v-icon>
				<v-icon
					size="small"
					color="success"
					class="mr-2"
					@click="startEditWizard(item)"
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
import { defineAsyncComponent } from 'vue'
import ConfigApis from '@/apis/ConfigApis'
import { mapState } from 'pinia'
import useBaseStore from '../stores/base.js'
import InstancesMixin from '../mixins/InstancesMixin.js'
import logger from '../lib/logger'

const log = logger.get('ConfigurationTemplates')
export default {
	name: 'ConfigurationTemplates',
	components: {
		TemplateWizard: defineAsyncComponent(
			() => import('../components/custom/TemplateWizard.vue'),
		),
	},
	mixins: [InstancesMixin],
	data() {
		return {
			templates: [],
			search: '',
			headers: [
				{ title: 'Name', key: 'name' },
				{ title: 'Device', key: 'device', sortable: false },
				{
					title: 'Firmware Range',
					key: 'firmwareRange',
					sortable: false,
				},
				{ title: 'Values', key: 'values', sortable: false },
				{ title: 'Auto-Apply', key: 'autoApply' },
				{
					title: 'Devices',
					key: 'devices',
					sortable: false,
				},
				{ title: 'Created', key: 'createdAt' },
				{
					title: 'Actions',
					key: 'actions',
					sortable: false,
				},
			],
			wizardActive: false,
			editingTemplate: null,
			applyingTemplate: false,
		}
	},
	computed: {
		...mapState(useBaseStore, ['nodes']),
	},
	methods: {
		formatDate(dateStr) {
			if (!dateStr) return ''
			return new Date(dateStr).toLocaleDateString()
		},
		formatFirmwareRange(range) {
			if (!range) return '\u2014'
			const { min, max } = range
			if (min && max) return `${min} \u2013 ${max}`
			if (min) return `\u2265 ${min}`
			if (max) return `\u2264 ${max}`
			return '\u2014'
		},
		getMatchingNodes(template) {
			return this.nodes.filter(
				(n) => n && n.ready && n.deviceId === template.deviceId,
			)
		},
		// ---- TABLE ACTIONS ----
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
		async applyTemplate(item) {
			const targetNodes = this.getMatchingNodes(item).map((n) => ({
				title: `Node ${n.id} - ${[n.manufacturer, n.productLabel].filter(Boolean).join(' ') || n._name || 'Unknown'}`,
				value: n.id,
			}))

			if (targetNodes.length === 0) {
				this.showSnackbar('No matching devices found', 'warning')
				return
			}

			const result = await this.app.confirm(
				'Apply Template',
				`Apply "${item.name}" to one or more nodes`,
				'info',
				{
					confirmText: 'Apply',
					width: 500,
					inputs: [
						{
							type: 'list',
							label: 'Target nodes',
							key: 'nodeIds',
							items: targetNodes,
							multiple: true,
							required: true,
							autocomplete: true,
						},
					],
				},
			)

			if (!result || !result.nodeIds || result.nodeIds.length === 0)
				return

			this.applyingTemplate = true
			const total = result.nodeIds.length
			const toastId = 'apply-template'

			const nodeResults = []
			for (const [i, nodeId] of result.nodeIds.entries()) {
				this.showSnackbar(
					`Applying template to node ${nodeId} (${i + 1}/${total})...`,
					'info',
					{
						timeout: Number.POSITIVE_INFINITY,
						loading: true,
						id: toastId,
					},
				)
				try {
					const response =
						await ConfigApis.applyConfigurationTemplate(
							item.id,
							nodeId,
						)
					nodeResults.push({ nodeId, ...response.data })
				} catch (error) {
					nodeResults.push({
						nodeId,
						success: 0,
						failed: 1,
						errors: [error.message],
					})
					log.error('Failed to apply configuration template', {
						templateId: item.id,
						nodeId,
						error,
					})
				}
			}

			this.applyingTemplate = false

			this.dismissSnackbar(toastId)

			const hasFailed = nodeResults.some((r) => r.failed > 0)

			if (!hasFailed) {
				const totalSuccess = nodeResults.reduce(
					(sum, r) => sum + r.success,
					0,
				)
				this.showSnackbar(
					`Template applied successfully (${totalSuccess} value(s) across ${nodeResults.length} node(s))`,
					'success',
				)
			} else {
				let html = ''
				for (const r of nodeResults) {
					const icon = r.failed === 0 ? '✅' : '⚠️'
					html += `<p>${icon} <strong>Node ${r.nodeId}:</strong> ${r.success} OK, ${r.failed} failed</p>`
					if (r.errors?.length > 0) {
						html += '<ul>'
						for (const e of r.errors) {
							html += `<li>${e}</li>`
						}
						html += '</ul>'
					}
				}

				this.app.confirm('Apply Template Results', html, 'warning', {
					confirmText: 'Close',
					noCancel: true,
					width: 500,
					color: 'warning',
				})
			}
		},
		async importTemplates() {
			try {
				const { data } = await this.app.importFile('json')
				if (!Array.isArray(data)) {
					this.showSnackbar('Imported file is not valid', 'error')
					return
				}
				const response =
					await ConfigApis.importConfigurationTemplates(data)
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
		// ---- WIZARD ----
		startCreateWizard() {
			this.editingTemplate = null
			this.wizardActive = true
		},
		startEditWizard(item) {
			this.editingTemplate = item
			this.wizardActive = true
		},
		cancelWizard() {
			this.wizardActive = false
			this.editingTemplate = null
		},
		onWizardSaved() {
			this.wizardActive = false
			this.editingTemplate = null
			this.refreshTemplates()
		},
	},
	mounted() {
		this.refreshTemplates()
	},
}
</script>
