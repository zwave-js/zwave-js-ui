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
						<v-btn
							v-if="template && matchingNodes.length > 0"
							color="primary"
							variant="outlined"
							size="small"
							class="mb-4"
							:loading="loadingDeviceParams"
							@click="showAddParamsDialog = true"
						>
							<v-icon start>add</v-icon>
							Add Parameters from Device
						</v-btn>
						<v-alert
							v-if="template && matchingNodes.length === 0"
							type="info"
							variant="tonal"
							density="compact"
							class="mb-4"
						>
							No matching devices found to add parameters from.
							Connect a device with the same model to add
							additional parameters.
						</v-alert>
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
							<template #[`item.newValue`]="{ item: param }">
								<ValueId
									:model-value="param"
									:disable_send="true"
									hide-label
									compact
								/>
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
							<v-col cols="12" sm="3">
								<v-text-field
									v-model="templateFirmwareMin"
									label="Min firmware"
									variant="outlined"
									placeholder="e.g. 1.0"
									hint="Optional"
									persistent-hint
									:rules="[firmwareRule]"
								></v-text-field>
							</v-col>
							<v-col cols="12" sm="3">
								<v-text-field
									v-model="templateFirmwareMax"
									label="Max firmware"
									variant="outlined"
									placeholder="e.g. 3.0"
									hint="Optional"
									persistent-hint
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

		<!-- Add Parameters Dialog -->
		<v-dialog v-model="showAddParamsDialog" max-width="800" scrollable>
			<v-card>
				<v-toolbar color="primary" density="compact" flat>
					<v-toolbar-title class="text-white"
						>Add Parameters from Device</v-toolbar-title
					>
					<v-btn
						icon
						variant="text"
						@click="showAddParamsDialog = false"
					>
						<v-icon color="white">close</v-icon>
					</v-btn>
				</v-toolbar>
				<v-card-text class="pa-4">
					<v-autocomplete
						v-model="addParamsNodeId"
						:items="matchingNodes"
						item-title="text"
						item-value="value"
						label="Select a device"
						variant="outlined"
						density="comfortable"
						:loading="loadingDeviceParams"
						@update:model-value="onAddParamsNodeSelected"
					></v-autocomplete>

					<v-alert
						v-if="
							addParamsNodeId &&
							!loadingDeviceParams &&
							additionalParams.length === 0
						"
						type="info"
						variant="tonal"
						class="mt-2"
					>
						All parameters from this device are already in the
						template.
					</v-alert>

					<v-data-table
						v-if="additionalParams.length > 0"
						v-model="selectedAdditionalParams"
						:headers="paramHeaders"
						:items="additionalParams"
						show-select
						item-value="id"
						return-object
						density="compact"
						class="elevation-0 mt-2"
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
						<template #[`item.newValue`]="{ item: param }">
							<ValueId
								:model-value="param"
								:disable_send="true"
								hide-label
								compact
							/>
						</template>
					</v-data-table>
				</v-card-text>
				<v-card-actions class="px-4 pb-4">
					<v-spacer></v-spacer>
					<v-btn variant="text" @click="showAddParamsDialog = false">
						Cancel
					</v-btn>
					<v-btn
						color="primary"
						:disabled="selectedAdditionalParams.length === 0"
						@click="addSelectedParams"
					>
						Add {{ selectedAdditionalParams.length }} Parameter(s)
					</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</v-card>
</template>

<script>
import ConfigApis from '@/apis/ConfigApis'
import { defineAsyncComponent } from 'vue'
import { mapState } from 'pinia'
import useBaseStore from '../../stores/base.js'
import InstancesMixin from '../../mixins/InstancesMixin.js'

const FIRMWARE_REGEX = /^\d+(\.\d+)+$/

export default {
	name: 'TemplateWizard',
	mixins: [InstancesMixin],
	components: {
		ValueId: defineAsyncComponent(() => import('../ValueId.vue')),
	},
	props: {
		template: {
			type: Object,
			default: null,
		},
	},
	emits: ['cancel', 'saved'],
	data() {
		return {
			step: this.template ? 2 : 1,
			stepLabels: [
				'Select Device',
				'Select Parameters',
				'Name & Settings',
			],
			selectedNodeId: null,
			nodeParams: [],
			selectedParams: [],
			templateName: '',
			templateFirmwareMin: '',
			templateFirmwareMax: '',
			templateAutoApply: false,
			loadingParams: false,
			saving: false,
			paramHeaders: [
				{ title: 'Parameter', key: 'property', width: '100px' },
				{ title: 'Label', key: 'label' },
				{
					title: 'Template Value',
					key: 'newValue',
					sortable: false,
				},
			],
			// Add parameters dialog state
			showAddParamsDialog: false,
			addParamsNodeId: null,
			loadingDeviceParams: false,
			additionalParams: [],
			selectedAdditionalParams: [],
		}
	},
	computed: {
		...mapState(useBaseStore, ['nodes']),
		availableNodes() {
			return this.nodes
				.filter((n) => n && !n.isControllerNode && n.ready)
				.map((n) => ({
					text: n._name,
					value: n.id,
					props: {
						subtitle: [n.manufacturer, n.productLabel]
							.filter(Boolean)
							.join(' - '),
					},
				}))
		},
		matchingNodes() {
			if (!this.template?.deviceId) return []
			return this.nodes
				.filter(
					(n) =>
						n &&
						n.ready &&
						n.deviceId === this.template.deviceId &&
						n.values,
				)
				.map((n) => ({
					text: n._name,
					value: n.id,
					props: {
						subtitle: [n.manufacturer, n.productLabel]
							.filter(Boolean)
							.join(' - '),
					},
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
				this.firmwareRule(this.templateFirmwareMin) === true &&
				this.firmwareRule(this.templateFirmwareMax) === true
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
		firmwareRule(v) {
			if (!v) return true
			return (
				FIRMWARE_REGEX.test(v) ||
				'Must be in format X.Y or X.Y.Z (e.g. 1.0)'
			)
		},
		buildValueIdParam(v, currentValue) {
			return {
				id: `0-112-0-${v.property}${v.propertyKey != null ? '-' + v.propertyKey : ''}`,
				commandClass: 112,
				property: v.property,
				propertyKey: v.propertyKey != null ? v.propertyKey : null,
				endpoint: v.endpoint || 0,
				type: 'number',
				readable: true,
				writeable: true,
				label: v.label || `Parameter ${v.property}`,
				description: v.description || '',
				currentValue,
				min: v.min,
				max: v.max,
				default: v.default,
				list: !!(v.states && v.states.length > 0),
				allowManualEntry:
					v.allowManualEntry != null ? v.allowManualEntry : true,
				states: v.states || null,
				newValue: currentValue,
			}
		},
		enrichWithConfigDb(params, configDbParams) {
			if (!configDbParams || !configDbParams.length) return

			const dbMap = new Map()
			for (const cp of configDbParams) {
				const key = `${cp.endpoint || 0}-${cp.property}${cp.propertyKey != null ? '-' + cp.propertyKey : ''}`
				dbMap.set(key, cp)
			}

			for (const p of params) {
				const key = `${p.endpoint || 0}-${p.property}${p.propertyKey != null ? '-' + p.propertyKey : ''}`
				const db = dbMap.get(key)
				if (!db) continue

				if (!p.states && db.states && db.states.length > 0) {
					p.states = db.states
					p.list = true
				}
				if (p.min == null && db.min != null) p.min = db.min
				if (p.max == null && db.max != null) p.max = db.max
				if (p.default == null && db.default != null)
					p.default = db.default
				if (p.allowManualEntry == null && db.allowManualEntry != null)
					p.allowManualEntry = db.allowManualEntry
			}
		},
		initCreate() {
			this.selectedNodeId = null
			this.nodeParams = []
			this.selectedParams = []
			this.templateName = ''
			this.templateFirmwareMin = ''
			this.templateFirmwareMax = ''
			this.templateAutoApply = false
			this.step = 1
		},
		async initEdit(item) {
			this.selectedNodeId = null
			this.templateName = item.name
			this.templateFirmwareMin = item.firmwareRange?.min || ''
			this.templateFirmwareMax = item.firmwareRange?.max || ''
			this.templateAutoApply = item.autoApply

			// Fetch config DB params for metadata (works without a live node)
			let configDbParams = []
			if (item.deviceId) {
				try {
					const res = await ConfigApis.getDeviceConfigurationParams(
						item.deviceId,
					)
					if (res.success) {
						configDbParams = res.data
					}
				} catch {
					// Config DB not available, fall back to live node
				}
			}

			// Also try matching live node for current values
			const matchingNode = this.nodes.find(
				(n) => n && n.ready && n.deviceId === item.deviceId && n.values,
			)

			const configMap = new Map()
			if (matchingNode) {
				const prefix = `${matchingNode.id}-112-`
				for (const id in matchingNode.values) {
					if (id.startsWith(prefix)) {
						configMap.set(
							id.substring(prefix.length),
							matchingNode.values[id],
						)
					}
				}
			}

			this.nodeParams = item.values.map((v) => {
				const key = `${v.endpoint || 0}-${v.property}${v.propertyKey != null ? '-' + v.propertyKey : ''}`
				const nv = configMap.get(key)

				return this.buildValueIdParam(
					{
						property: v.property,
						propertyKey: v.propertyKey,
						endpoint: v.endpoint,
						label: v.label || nv?.label,
						description: v.description || nv?.description,
						states: nv?.states || null,
						min: nv?.min,
						max: nv?.max,
						default: nv?.default,
						allowManualEntry: nv?.allowManualEntry,
					},
					v.value,
				)
			})

			// Enrich with config DB metadata
			this.enrichWithConfigDb(this.nodeParams, configDbParams)

			this.selectedParams = [...this.nodeParams]
			this.step = 2
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
				for (const id in node.values) {
					const v = node.values[id]
					if (v.commandClass === 112 && v.writeable) {
						params.push(this.buildValueIdParam(v, v.value))
					}
				}

				// Enrich with config DB metadata
				if (node.deviceId) {
					try {
						const res =
							await ConfigApis.getDeviceConfigurationParams(
								node.deviceId,
							)
						if (res.success) {
							this.enrichWithConfigDb(params, res.data)
						}
					} catch {
						// Config DB not available, node values are sufficient
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
			} finally {
				this.loadingParams = false
			}
		},
		async onAddParamsNodeSelected(nodeId) {
			if (!nodeId) {
				this.additionalParams = []
				this.selectedAdditionalParams = []
				return
			}

			this.loadingDeviceParams = true
			try {
				const node = this.nodes.find((n) => n && n.id === nodeId)
				if (!node || !node.values) {
					this.showSnackbar(
						'Node not found or has no values',
						'error',
					)
					return
				}

				// Build a set of existing parameter IDs in the template
				const existingIds = new Set(this.nodeParams.map((p) => p.id))

				const params = []
				for (const id in node.values) {
					const v = node.values[id]
					if (v.commandClass === 112 && v.writeable) {
						const param = this.buildValueIdParam(v, v.value)
						// Only include parameters not already in the template
						if (!existingIds.has(param.id)) {
							params.push(param)
						}
					}
				}

				// Enrich with config DB metadata
				if (node.deviceId) {
					try {
						const res =
							await ConfigApis.getDeviceConfigurationParams(
								node.deviceId,
							)
						if (res.success) {
							this.enrichWithConfigDb(params, res.data)
						}
					} catch {
						// Config DB not available, node values are sufficient
					}
				}

				this.additionalParams = params
				this.selectedAdditionalParams = [...params]
			} finally {
				this.loadingDeviceParams = false
			}
		},
		addSelectedParams() {
			// Store the count before resetting
			const addedCount = this.selectedAdditionalParams.length

			// Add the selected additional params to nodeParams and selectedParams
			for (const param of this.selectedAdditionalParams) {
				this.nodeParams.push(param)
				this.selectedParams.push(param)
			}

			// Reset dialog state and close
			this.showAddParamsDialog = false
			this.addParamsNodeId = null
			this.additionalParams = []
			this.selectedAdditionalParams = []

			this.showSnackbar(
				`Added ${addedCount} parameter(s) to template`,
				'success',
			)
		},
		async save() {
			this.saving = true
			try {
				const values = this.selectedParams.map((p) => ({
					property: p.property,
					propertyKey: p.propertyKey,
					endpoint: p.endpoint,
					value:
						p.list && p.states && p.states.length > 0
							? p.newValue
							: p.newValue !== '' && p.newValue != null
								? Number(p.newValue)
								: 0,
					label: p.label,
					description: p.description,
				}))

				let response
				const firmwareRange =
					this.templateFirmwareMin || this.templateFirmwareMax
						? {
								min: this.templateFirmwareMin || undefined,
								max: this.templateFirmwareMax || undefined,
							}
						: undefined

				if (this.template) {
					response = await ConfigApis.updateConfigurationTemplate(
						this.template.id,
						{
							name: this.templateName,
							firmwareRange,
							autoApply: this.templateAutoApply,
							values,
						},
					)
				} else {
					response = await ConfigApis.createConfigurationTemplate({
						nodeId: this.selectedNodeId,
						name: this.templateName,
						firmwareRange,
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
