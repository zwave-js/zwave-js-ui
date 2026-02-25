<template>
	<v-container fluid class="pa-4">
		<!-- WIZARD MODE -->
		<template v-if="wizardActive">
			<v-card elevation="1">
				<v-card-title class="d-flex align-center">
					<v-btn
						icon
						variant="text"
						@click="cancelWizard"
						class="mr-2"
					>
						<v-icon>arrow_back</v-icon>
					</v-btn>
					{{ editingTemplate ? 'Edit Template' : 'Create Template' }}
				</v-card-title>
				<v-stepper
					v-model="wizardStep"
					elevation="0"
					:items="wizardSteps"
					hide-actions
				>
					<template #[`item.1`]>
						<v-card flat>
							<v-card-text>
								<p class="text-body-1 mb-4">
									Select a node to create a template from its
									configuration parameters.
								</p>
								<v-autocomplete
									v-model="selectedNodeId"
									:items="availableNodes"
									item-title="text"
									item-value="value"
									label="Select a node"
									variant="outlined"
									density="comfortable"
									clearable
									:loading="loadingParams"
									@update:model-value="onNodeSelected"
								></v-autocomplete>
							</v-card-text>
							<v-card-actions class="justify-end">
								<v-btn variant="text" @click="cancelWizard">
									Cancel
								</v-btn>
								<v-btn
									color="primary"
									:disabled="!selectedNodeId || loadingParams"
									@click="wizardStep = 2"
								>
									Next
								</v-btn>
							</v-card-actions>
						</v-card>
					</template>

					<template #[`item.2`]>
						<v-card flat>
							<v-card-text>
								<p class="text-body-1 mb-4">
									Select which parameters to include and
									optionally modify their values.
								</p>
								<v-data-table
									v-model="selectedParams"
									:headers="paramHeaders"
									:items="nodeParams"
									show-select
									item-value="id"
									return-object
									density="compact"
									class="elevation-0"
									items-per-page="-1"
								>
									<template
										#[`item.property`]="{ item: param }"
									>
										{{ param.property
										}}{{
											param.propertyKey != null
												? `[${param.propertyKey}]`
												: ''
										}}
									</template>
									<template
										#[`item.currentValue`]="{ item: param }"
									>
										{{
											formatParamValue(
												param,
												param.currentValue,
											)
										}}
									</template>
									<template
										#[`item.templateValue`]="{
											item: param,
										}"
									>
										<v-select
											v-if="
												param.states &&
												param.states.length > 0
											"
											v-model="param.templateValue"
											:items="param.states"
											item-title="text"
											item-value="value"
											density="compact"
											variant="outlined"
											hide-details
											style="min-width: 150px"
										></v-select>
										<v-text-field
											v-else
											v-model="param.templateValue"
											type="number"
											density="compact"
											variant="outlined"
											hide-details
											:min="param.min"
											:max="param.max"
											style="min-width: 100px"
										></v-text-field>
									</template>
								</v-data-table>
							</v-card-text>
							<v-card-actions class="justify-end">
								<v-btn variant="text" @click="cancelWizard">
									Cancel
								</v-btn>
								<v-btn
									v-if="!editingTemplate"
									variant="text"
									@click="wizardStep = 1"
								>
									Back
								</v-btn>
								<v-btn
									color="primary"
									:disabled="selectedParams.length === 0"
									@click="wizardStep = 3"
								>
									Next
								</v-btn>
							</v-card-actions>
						</v-card>
					</template>

					<template #[`item.3`]>
						<v-card flat>
							<v-card-text>
								<v-row>
									<v-col cols="12" sm="6">
										<v-text-field
											v-model="templateName"
											label="Template name"
											variant="outlined"
											:rules="[
												(v) =>
													!!v || 'Name is required',
											]"
										></v-text-field>
									</v-col>
									<v-col cols="12" sm="6">
										<v-text-field
											v-model="templateFirmware"
											label="Min firmware version"
											variant="outlined"
											hint="Optional"
											persistent-hint
										></v-text-field>
									</v-col>
									<v-col cols="12" sm="6">
										<v-switch
											v-model="templateAutoApply"
											label="Auto-apply to new matching devices"
											color="primary"
											hide-details
										></v-switch>
									</v-col>
								</v-row>
								<v-alert
									type="info"
									variant="tonal"
									class="mt-4"
								>
									{{ selectedParams.length }} parameter(s)
									selected
									<template v-if="selectedNodeName">
										from
										<strong>{{ selectedNodeName }}</strong>
									</template>
								</v-alert>
							</v-card-text>
							<v-card-actions class="justify-end">
								<v-btn variant="text" @click="cancelWizard">
									Cancel
								</v-btn>
								<v-btn variant="text" @click="wizardStep = 2">
									Back
								</v-btn>
								<v-btn
									color="primary"
									:disabled="
										!templateName ||
										selectedParams.length === 0
									"
									:loading="saving"
									@click="saveTemplate"
								>
									{{ editingTemplate ? 'Update' : 'Create' }}
								</v-btn>
							</v-card-actions>
						</v-card>
					</template>
				</v-stepper>
			</v-card>
		</template>

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
					color="primary"
					class="mr-2"
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
import ConfigApis from '@/apis/ConfigApis'
import { mapActions, mapState } from 'pinia'
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
				{ title: 'Device', key: 'device', sortable: false },
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
			// Wizard state
			wizardActive: false,
			wizardStep: 1,
			wizardSteps: [
				'Select Device',
				'Select Parameters',
				'Name & Settings',
			],
			editingTemplate: null,
			selectedNodeId: null,
			nodeParams: [],
			selectedParams: [],
			templateName: '',
			templateFirmware: '',
			templateAutoApply: false,
			loadingParams: false,
			saving: false,
			paramHeaders: [
				{ title: 'Parameter', key: 'property', width: '100px' },
				{ title: 'Label', key: 'label' },
				{ title: 'Current Value', key: 'currentValue', width: '150px' },
				{
					title: 'Template Value',
					key: 'templateValue',
					width: '200px',
					sortable: false,
				},
			],
		}
	},
	computed: {
		...mapState(useBaseStore, ['nodes']),
		availableNodes() {
			return this.nodes
				.filter((n) => n && !n.isControllerNode && n.ready)
				.map((n) => ({
					text: `Node ${n.id} - ${[n.manufacturer, n.productLabel].filter(Boolean).join(' ') || n._name || 'Unknown'}`,
					value: n.id,
				}))
		},
		selectedNodeName() {
			if (!this.selectedNodeId) return ''
			const item = this.availableNodes.find(
				(n) => n.value === this.selectedNodeId,
			)
			return item ? item.text : ''
		},
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		formatDate(dateStr) {
			if (!dateStr) return ''
			return new Date(dateStr).toLocaleDateString()
		},
		formatParamValue(param, value) {
			if (param.states && param.states.length > 0) {
				const state = param.states.find((s) => s.value === value)
				if (state) return `${state.text} (${value})`
			}
			return value != null ? String(value) : ''
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
			const targetNodes = this.nodes
				.filter((n) => n && !n.isControllerNode && n.ready)
				.map((n) => ({
					title: `Node ${n.id} - ${[n.manufacturer, n.productLabel].filter(Boolean).join(' ') || n._name || 'Unknown'}${n.deviceId === item.deviceId ? ' (matching device)' : ''}`,
					value: n.id,
				}))

			if (targetNodes.length === 0) {
				this.showSnackbar('No ready nodes available', 'warning')
				return
			}

			const result = await this.app.confirm(
				'Apply Template',
				`Apply "${item.name}" to one or more nodes`,
				'info',
				{
					confirmText: 'Apply',
					inputs: [
						{
							type: 'list',
							label: 'Target nodes',
							key: 'nodeIds',
							items: targetNodes,
							multiple: true,
							required: true,
						},
					],
				},
			)

			if (!result || !result.nodeIds || result.nodeIds.length === 0)
				return

			let success = 0
			let failed = 0
			for (const nodeId of result.nodeIds) {
				try {
					const response =
						await ConfigApis.applyConfigurationTemplate(
							item.id,
							nodeId,
						)
					if (response.success) {
						success++
					} else {
						failed++
					}
				} catch {
					failed++
				}
			}

			this.showSnackbar(
				`Template applied: ${success} succeeded, ${failed} failed`,
				failed > 0 ? 'warning' : 'success',
			)
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
		// ---- WIZARD ----
		startCreateWizard() {
			this.editingTemplate = null
			this.selectedNodeId = null
			this.nodeParams = []
			this.selectedParams = []
			this.templateName = ''
			this.templateFirmware = ''
			this.templateAutoApply = false
			this.wizardStep = 1
			this.wizardActive = true
		},
		startEditWizard(item) {
			this.editingTemplate = item
			this.selectedNodeId = null
			this.templateName = item.name
			this.templateFirmware = item.minFirmwareVersion || ''
			this.templateAutoApply = item.autoApply

			// Populate params from existing template values
			this.nodeParams = item.values.map((v, i) => ({
				id: i,
				property: v.property,
				propertyKey: v.propertyKey,
				endpoint: v.endpoint,
				label: v.label || `Parameter ${v.property}`,
				description: v.description || '',
				currentValue: v.value,
				templateValue: v.value,
				states: null,
				min: undefined,
				max: undefined,
			}))
			this.selectedParams = [...this.nodeParams]
			this.wizardStep = 2
			this.wizardActive = true
		},
		cancelWizard() {
			this.wizardActive = false
			this.editingTemplate = null
		},
		async onNodeSelected(nodeId) {
			if (!nodeId) {
				this.nodeParams = []
				this.selectedParams = []
				return
			}

			this.loadingParams = true
			try {
				const node = this.nodes.find((n) => n && n.id === nodeId)
				if (!node || !node.values) {
					this.showSnackbar(
						'Node not found or has no values',
						'error',
					)
					return
				}

				const params = []
				let idx = 0
				for (const id in node.values) {
					const v = node.values[id]
					if (v.commandClass === 112 && v.writeable) {
						params.push({
							id: idx++,
							property: v.property,
							propertyKey:
								v.propertyKey != null ? v.propertyKey : null,
							endpoint: v.endpoint || 0,
							label: v.label || `Parameter ${v.property}`,
							description: v.description || '',
							currentValue: v.value,
							templateValue: v.value,
							states: v.states || null,
							min: v.min,
							max: v.max,
						})
					}
				}

				if (params.length === 0) {
					this.showSnackbar(
						'This node has no writeable configuration parameters',
						'warning',
					)
				}

				this.nodeParams = params
				this.selectedParams = [...params]

				// Auto-fill template name from node info
				if (!this.templateName) {
					this.templateName =
						node.productLabel ||
						node.productDescription ||
						`Node ${node.id} template`
				}
			} finally {
				this.loadingParams = false
			}
		},
		async saveTemplate() {
			this.saving = true
			try {
				const values = this.selectedParams.map((p) => ({
					property: p.property,
					propertyKey: p.propertyKey,
					endpoint: p.endpoint,
					value:
						p.states && p.states.length > 0
							? p.templateValue
							: Number(p.templateValue),
					label: p.label,
					description: p.description,
				}))

				let response
				if (this.editingTemplate) {
					response = await ConfigApis.updateConfigurationTemplate(
						this.editingTemplate.id,
						{
							name: this.templateName,
							minFirmwareVersion:
								this.templateFirmware || undefined,
							autoApply: this.templateAutoApply,
							values,
						},
					)
				} else {
					response = await ConfigApis.createConfigurationTemplate({
						nodeId: this.selectedNodeId,
						name: this.templateName,
						autoApply: this.templateAutoApply,
						values,
					})
				}

				this.showSnackbar(
					response.message,
					response.success ? 'success' : 'error',
				)

				if (response.success) {
					this.wizardActive = false
					this.editingTemplate = null
					this.refreshTemplates()
				}
			} catch (error) {
				this.showSnackbar(error.message, 'error')
			} finally {
				this.saving = false
			}
		},
	},
	mounted() {
		this.refreshTemplates()
	},
}
</script>
