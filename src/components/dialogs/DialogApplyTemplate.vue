<template>
	<v-dialog v-model="_value" max-width="800px" :persistent="running">
		<v-card>
			<v-card-title>
				<span class="text-h5"
					>Apply Template: {{ template?.name }}</span
				>
			</v-card-title>
			<v-card-text class="pa-0">
				<v-data-table
					v-model="selected"
					:headers="tableHeaders"
					:items="matchingNodes"
					show-select
					return-object
					item-value="id"
					items-per-page="-1"
					hide-default-footer
					density="comfortable"
				>
					<template
						#[`header.data-table-select`]="{
							allSelected,
							selectAll,
							someSelected,
						}"
					>
						<v-checkbox-btn
							:indeterminate="someSelected && !allSelected"
							:model-value="allSelected"
							:disabled="running"
							@update:model-value="selectAll(!allSelected)"
						/>
					</template>
					<template
						#[`item.data-table-select`]="{
							isSelected,
							toggleSelect,
							item,
						}"
					>
						<v-checkbox-btn
							:model-value="isSelected({ value: item })"
							:disabled="running"
							@update:model-value="toggleSelect({ value: item })"
						/>
					</template>
					<template #[`item.node`]="{ item }">
						{{ item._name }}
					</template>
					<template #[`item.device`]="{ item }">
						{{
							[item.manufacturer, item.productLabel]
								.filter(Boolean)
								.join(' - ')
						}}
					</template>
					<template #[`item.status`]="{ item }">
						<span
							v-if="
								!nodeResults[item.id] ||
								nodeResults[item.id].status === 'pending'
							"
							class="text-grey"
						>
							--
						</span>
						<v-progress-circular
							v-else-if="
								nodeResults[item.id].status === 'running'
							"
							indeterminate
							size="20"
							width="2"
						/>
						<v-icon
							v-else-if="
								nodeResults[item.id].status === 'success'
							"
							color="success"
						>
							check_circle
						</v-icon>
						<v-icon
							v-else-if="
								nodeResults[item.id].status === 'warning'
							"
							color="amber"
						>
							warning
						</v-icon>
						<v-icon
							v-else-if="nodeResults[item.id].status === 'error'"
							color="error"
						>
							error
						</v-icon>
					</template>
					<template #[`item.details`]="{ item }">
						<template
							v-if="nodeResults[item.id]?.status === 'success'"
						>
							<span class="text-success">
								{{ nodeResults[item.id].result.success }}
								parameter(s) set
							</span>
						</template>
						<template
							v-else-if="nodeResults[item.id]?.status === 'error'"
						>
							<span class="text-error">
								{{
									nodeResults[item.id].result.reason ||
									'Failed'
								}}
							</span>
						</template>
						<template
							v-else-if="
								nodeResults[item.id]?.status === 'warning'
							"
						>
							<span class="text-amber">
								{{ nodeResults[item.id].result.success }} OK,
								{{ nodeResults[item.id].result.failed }} failed
							</span>
							<v-expansion-panels
								v-if="
									nodeResults[item.id].result.errors?.length
								"
								variant="accordion"
								flat
								class="mt-1"
							>
								<v-expansion-panel>
									<v-expansion-panel-title
										class="pa-0 min-height-0 text-caption"
										style="min-height: 28px"
									>
										Show details
									</v-expansion-panel-title>
									<v-expansion-panel-text>
										<v-list density="compact" class="pa-0">
											<v-list-item
												v-for="(
													err, idx
												) in nodeResults[item.id].result
													.errors"
												:key="idx"
												class="px-0"
												min-height="24"
											>
												<template #prepend>
													<v-icon
														size="x-small"
														color="error"
														class="mr-1"
													>
														close
													</v-icon>
												</template>
												<v-list-item-title
													class="text-caption text-error text-wrap"
												>
													{{ err }}
												</v-list-item-title>
											</v-list-item>
										</v-list>
									</v-expansion-panel-text>
								</v-expansion-panel>
							</v-expansion-panels>
						</template>
					</template>
				</v-data-table>
			</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn
					v-if="!allDone"
					variant="text"
					:disabled="running"
					@click="_value = false"
				>
					Cancel
				</v-btn>
				<v-btn v-if="allDone" variant="text" @click="_value = false">
					Close
				</v-btn>
				<v-btn
					v-if="allDone && failedNodes.length > 0"
					color="warning"
					@click="retryFailed"
				>
					<v-icon start>refresh</v-icon>
					Retry Failed
				</v-btn>
				<v-btn
					v-if="!allDone"
					color="primary"
					:disabled="selected.length === 0 || running"
					:loading="running"
					@click="run"
				>
					<v-icon start>play_arrow</v-icon>
					Run
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script>
import ConfigApis from '@/apis/ConfigApis'
import { mapState } from 'pinia'
import useBaseStore from '../../stores/base.js'
import InstancesMixin from '../../mixins/InstancesMixin.js'
import logger from '../../lib/logger'

const log = logger.get('DialogApplyTemplate')

export default {
	name: 'DialogApplyTemplate',
	mixins: [InstancesMixin],
	props: {
		modelValue: { type: Boolean, default: false },
		template: { type: Object, default: null },
	},
	emits: ['update:modelValue'],
	data() {
		return {
			selected: [],
			running: false,
			nodeResults: {},
		}
	},
	computed: {
		...mapState(useBaseStore, ['nodes']),
		_value: {
			get() {
				return this.modelValue
			},
			set(val) {
				this.$emit('update:modelValue', val)
			},
		},
		matchingNodes() {
			if (!this.template) return []
			return this.nodes.filter(
				(n) => n && n.ready && n.deviceId === this.template.deviceId,
			)
		},
		tableHeaders() {
			return [
				{ title: 'Node', key: 'node', sortable: false },
				{ title: 'Product', key: 'device', sortable: false },
				{ title: 'Status', key: 'status', sortable: false },
				{ title: 'Details', key: 'details', sortable: false },
			]
		},
		allDone() {
			if (!this.selected.length) return false
			return (
				!this.running &&
				this.selected.every(
					(n) =>
						this.nodeResults[n.id] &&
						this.nodeResults[n.id].status !== 'pending' &&
						this.nodeResults[n.id].status !== 'running',
				)
			)
		},
		failedNodes() {
			return this.matchingNodes.filter((n) => {
				const r = this.nodeResults[n.id]
				return r && (r.status === 'error' || r.status === 'warning')
			})
		},
	},
	watch: {
		modelValue(v) {
			if (v) {
				this.init()
			} else {
				this.reset()
			}
		},
	},
	methods: {
		init() {
			this.selected = [...this.matchingNodes]
			this.nodeResults = {}
			this.running = false
		},
		reset() {
			this.selected = []
			this.nodeResults = {}
			this.running = false
		},
		retryFailed() {
			const nodesToRetry = [...this.failedNodes]
			// Clear results for failed nodes
			const results = { ...this.nodeResults }
			for (const n of nodesToRetry) {
				delete results[n.id]
			}
			this.nodeResults = results
			// Select only the failed nodes
			this.selected = nodesToRetry
		},
		async run() {
			this.running = true

			for (const node of this.selected) {
				this.nodeResults = {
					...this.nodeResults,
					[node.id]: { status: 'running', result: null },
				}

				try {
					const response =
						await ConfigApis.applyConfigurationTemplate(
							this.template.id,
							node.id,
						)
					const data = response.data

					let status
					if (data.reason) {
						status = 'error'
					} else if (data.failed > 0) {
						status = 'warning'
					} else {
						status = 'success'
					}

					this.nodeResults = {
						...this.nodeResults,
						[node.id]: { status, result: data },
					}
				} catch (error) {
					this.nodeResults = {
						...this.nodeResults,
						[node.id]: {
							status: 'error',
							result: { reason: error.message },
						},
					}
					log.error('Failed to apply configuration template', {
						templateId: this.template.id,
						nodeId: node.id,
						error,
					})
				}
			}

			this.running = false
		},
	},
}
</script>
