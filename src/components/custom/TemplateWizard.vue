<template>
	<v-card elevation="1">
		<v-card-title class="d-flex align-center">
			<v-btn icon variant="text" @click="$emit('cancel')" class="mr-2">
				<v-icon>arrow_back</v-icon>
			</v-btn>
			{{ template ? 'Edit Template' : 'Create Template' }}
		</v-card-title>
		<v-stepper
			v-model="step"
			elevation="0"
			:items="stepLabels"
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
						<v-btn variant="text" @click="$emit('cancel')">
							Cancel
						</v-btn>
						<v-btn
							color="primary"
							:disabled="!selectedNodeId || loadingParams"
							@click="step = 2"
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
							Select which parameters to include and optionally
							modify their values.
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
							<template #[`item.property`]="{ item: param }">
								{{ param.property
								}}{{
									param.propertyKey != null
										? `[${param.propertyKey}]`
										: ''
								}}
							</template>
							<template #[`item.currentValue`]="{ item: param }">
								{{
									formatParamValue(param, param.currentValue)
								}}
							</template>
							<template #[`item.templateValue`]="{ item: param }">
								<v-select
									v-if="
										param.states && param.states.length > 0
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
						<v-btn variant="text" @click="$emit('cancel')">
							Cancel
						</v-btn>
						<v-btn
							v-if="!template"
							variant="text"
							@click="step = 1"
						>
							Back
						</v-btn>
						<v-btn
							color="primary"
							:disabled="selectedParams.length === 0"
							@click="step = 3"
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
									:rules="[(v) => !!v || 'Name is required']"
								></v-text-field>
							</v-col>
							<v-col cols="12" sm="6">
								<v-text-field
									v-model="templateFirmware"
									label="Min firmware version"
									variant="outlined"
									placeholder="e.g. 1.0"
									:rules="[firmwareRule]"
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
						<v-alert type="info" variant="tonal" class="mt-4">
							{{ selectedParams.length }} parameter(s) selected
							<template v-if="selectedNodeName">
								from
								<strong>{{ selectedNodeName }}</strong>
							</template>
						</v-alert>
					</v-card-text>
					<v-card-actions class="justify-end">
						<v-btn variant="text" @click="$emit('cancel')">
							Cancel
						</v-btn>
						<v-btn variant="text" @click="step = 2"> Back </v-btn>
						<v-btn
							color="primary"
							:disabled="!canSave"
							:loading="saving"
							@click="save"
						>
							{{ template ? 'Update' : 'Create' }}
						</v-btn>
					</v-card-actions>
				</v-card>
			</template>
		</v-stepper>
	</v-card>
</template>

<script>
import ConfigApis from '@/apis/ConfigApis'
import { mapActions, mapState } from 'pinia'
import useBaseStore from '../../stores/base.js'

const FIRMWARE_REGEX = /^\d+(\.\d+)+$/

export default {
	name: 'TemplateWizard',
	props: {
		template: {
			type: Object,
			default: null,
		},
	},
	emits: ['cancel', 'saved'],
	data() {
		return {
			step: 1,
			stepLabels: [
				'Select Device',
				'Select Parameters',
				'Name & Settings',
			],
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
				{
					title: 'Current Value',
					key: 'currentValue',
				},
				{
					title: 'Template Value',
					key: 'templateValue',
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
		canSave() {
			return (
				this.templateName &&
				this.selectedParams.length > 0 &&
				this.firmwareRule(this.templateFirmware) === true
			)
		},
	},
	watch: {
		template: {
			immediate: true,
			handler(item) {
				if (item) {
					this.initEdit(item)
				} else {
					this.initCreate()
				}
			},
		},
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		firmwareRule(v) {
			if (!v) return true
			return (
				FIRMWARE_REGEX.test(v) ||
				'Must be in format X.Y or X.Y.Z (e.g. 1.0)'
			)
		},
		initCreate() {
			this.selectedNodeId = null
			this.nodeParams = []
			this.selectedParams = []
			this.templateName = ''
			this.templateFirmware = ''
			this.templateAutoApply = false
			this.step = 1
		},
		initEdit(item) {
			this.selectedNodeId = null
			this.templateName = item.name
			this.templateFirmware = item.minFirmwareVersion || ''
			this.templateAutoApply = item.autoApply

			// Try to find a matching node to recover states/min/max metadata
			const matchingNode = this.nodes.find(
				(n) => n && n.ready && n.deviceId === item.deviceId && n.values,
			)

			// Build a lookup map of CC 112 values keyed by property-propertyKey-endpoint
			const configMap = new Map()
			if (matchingNode) {
				for (const id in matchingNode.values) {
					const nv = matchingNode.values[id]
					if (nv.commandClass === 112) {
						const key = `${nv.property}-${nv.propertyKey ?? 'null'}-${nv.endpoint || 0}`
						configMap.set(key, nv)
					}
				}
			}

			this.nodeParams = item.values.map((v, i) => {
				const key = `${v.property}-${v.propertyKey ?? 'null'}-${v.endpoint || 0}`
				const nv = configMap.get(key)

				return {
					id: i,
					property: v.property,
					propertyKey: v.propertyKey,
					endpoint: v.endpoint,
					label: v.label || `Parameter ${v.property}`,
					description: v.description || '',
					currentValue: v.value,
					templateValue: v.value,
					states: nv?.states || null,
					min: nv?.min,
					max: nv?.max,
				}
			})
			this.selectedParams = [...this.nodeParams]
			this.step = 2
		},
		formatParamValue(param, value) {
			if (param.states && param.states.length > 0) {
				const state = param.states.find((s) => s.value === value)
				if (state) return `${state.text} (${value})`
			}
			return value != null ? String(value) : ''
		},
		async onNodeSelected(nodeId) {
			if (!nodeId) {
				this.nodeParams = []
				this.selectedParams = []
				return
			}

			// Guard against concurrent selections
			const requestedId = nodeId
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

				// Discard results if user selected a different node while loading
				if (this.selectedNodeId !== requestedId) return

				if (params.length === 0) {
					this.showSnackbar(
						'This node has no writeable configuration parameters',
						'warning',
					)
				}

				this.nodeParams = params
				this.selectedParams = [...params]

				if (!this.templateName) {
					this.templateName =
						node.productLabel ||
						node.productDescription ||
						`Node ${node.id} template`
				}

				// Pre-populate firmware version from the node
				if (!this.templateFirmware) {
					this.templateFirmware = node.firmwareVersion || ''
				}
			} finally {
				this.loadingParams = false
			}
		},
		async save() {
			this.saving = true
			try {
				const values = this.selectedParams.map((p) => ({
					property: p.property,
					propertyKey: p.propertyKey,
					endpoint: p.endpoint,
					value:
						p.states && p.states.length > 0
							? p.templateValue
							: Number(p.templateValue) || 0,
					label: p.label,
					description: p.description,
				}))

				let response
				if (this.template) {
					response = await ConfigApis.updateConfigurationTemplate(
						this.template.id,
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
						minFirmwareVersion: this.templateFirmware || undefined,
						autoApply: this.templateAutoApply,
						values,
					})
				}

				this.showSnackbar(
					response.message,
					response.success ? 'success' : 'error',
				)

				if (response.success) {
					this.$emit('saved')
				}
			} catch (error) {
				this.showSnackbar(error.message, 'error')
			} finally {
				this.saving = false
			}
		},
	},
}
</script>
