<template>
	<v-container fluid class="fill pa-0">
		<!-- <v-text-field
			v-model="search"
			v-if="!loading"
			prepend-icon="search"
			label="Search"
			class="mx-auto my-2"
			hide-details
			single-line
			style="max-width: 250px"
			clearable
		></v-text-field> -->
		<v-data-iterator
			:loading="loading"
			:items="nodes"
			:search="search"
			v-model="selected"
			item-key="id"
			:sort-by="sortingRules"
			hide-default-footer
			:itemsPerPage="-1"
		>
			<template v-slot:header>
				<div
					class="my-2 d-flex justify-center"
					style="column-gap: 10px; flex-wrap: wrap"
				>
					<div>
						<v-text-field
							v-model="search"
							clearable
							flat
							variant="solo-inverted"
							hide-details
							single-line
							class="mx-auto my-1"
							style="max-width: 250px; min-width: 250px"
							prepend-inner-icon="search"
							label="Search"
						></v-text-field>
					</div>
					<div>
						<v-select
							v-model="sortBy"
							flat
							variant="solo-inverted"
							single-line
							hide-details
							class="mx-auto my-1"
							style="max-width: 150px"
							:items="keys"
							prepend-inner-icon="sort"
							label="Sort by"
						></v-select>
					</div>
					<div>
						<v-btn-toggle
							class="mx-auto my-2"
							v-model="sortDesc"
							mandatory
						>
							<v-btn variant="flat" :modelValue="false">
								<v-icon>arrow_upward</v-icon>
							</v-btn>
							<v-btn variant="flat" :modelValue="true">
								<v-icon>arrow_downward</v-icon>
							</v-btn>
						</v-btn-toggle>
					</div>
				</div>
			</template>
			<template v-slot:no-data>
				<v-container>
					<v-row class="pa-0">
						<v-col cols="12" class="text-center">
							<v-icon class="text-h1">search</v-icon>
							<h3 class="font-weight-light">No nodes Found</h3>
						</v-col>
					</v-row>
				</v-container>
			</template>

			<template v-slot:no-results>
				<v-container>
					<v-row class="pa-0">
						<v-col cols="12" class="text-center">
							<v-icon class="text-h1">search</v-icon>
							<h3 class="font-weight-light">No nodes Found</h3>
						</v-col>
					</v-row>
				</v-container>
			</template>

			<template v-slot:loading>
				<v-container>
					<v-row class="pa-0">
						<v-col cols="12" class="text-center">
							<h3 class="font-weight-light">Loading Nodes...</h3>
							<v-progress-circular
								indeterminate
							></v-progress-circular>
						</v-col>
					</v-row>
				</v-container>
			</template>

			<template v-slot:default="{ items, isSelected, select }">
				<v-container style="min-height: 600px">
					<v-row justify="center" class="pa-0">
						<v-col
							v-for="item in items"
							:key="item.raw.id"
							width="170px"
							style="max-width: 170px"
						>
							<v-card
								@click.stop="showNodeDialog(item.raw)"
								hover
								border
								height="150"
								width="150"
								:color="
									isSelected(item)
										? $vuetify.theme.current.colors.primary
										: $vuetify.theme.current.colors.surface
								"
							>
								<v-card-text
									class="text-center pa-1 d-flex flex-column"
								>
									<v-row
										class="pa-0 ma-0"
										justify="space-between"
									>
										<strong
											@click.stop="
												select(
													[item],
													!isSelected(item),
												)
											"
											title="Click to select"
											style="
												font-size: 14px;
												line-height: 1.3;
												padding: 2px;
												border: 1px solid #ccc;
												border-radius: 4px;
											"
										>
											{{ padId(item.raw.id) }}
										</strong>

										<rich-value
											:value="powerRichValue(item.raw)"
										/>

										<rich-value
											:value="
												rebuildRoutesRichValue(item.raw)
											"
										/>

										<rich-value
											:value="securityRichValue(item.raw)"
										/>

										<rich-value
											:value="readyRichValue(item.raw)"
										/>
									</v-row>

									<span
										class="text-caption pb-0 font-weight-bold text-primary text-truncate text-capitalize"
										>{{ item.raw._name || '---' }}
									</span>
									<span
										class="text-caption pb-0 font-weight-bold text-truncate text-capitalize"
										>{{ item.raw.loc || '&#8205;' }}
									</span>

									<v-badge
										v-if="
											item.raw.interviewStage ===
											'Complete'
										"
										class="align-self-center"
										bordered
										offset-y="2"
										:content="
											'v' + item.raw.firmwareVersion
										"
										:model-value="
											!!item.raw.firmwareVersion
										"
									>
										<div>
											<v-tooltip location="bottom">
												<template
													v-slot:activator="{ props }"
												>
													<div
														v-bind="props"
														class="text-h4"
													>
														<rich-value
															:value="
																statusRichValue(
																	item.raw,
																)
															"
														/>
													</div>
												</template>
												<span
													style="
														white-space: pre-wrap;
													"
													v-text="nodeInfo(item.raw)"
												>
												</span>
											</v-tooltip>

											<reinterview-badge
												:node="item.raw"
												:b-style="{
													position: 'absolute',
													top: '0',
													left: '31px',
												}"
											></reinterview-badge>
										</div>
									</v-badge>

									<div v-else @click.stop class="text-center">
										<v-tooltip location="bottom">
											<template
												v-slot:activator="{ props }"
											>
												<v-progress-circular
													indeterminate
													class="ma-1"
													size="32"
													v-bind="props"
													color="primary"
												></v-progress-circular>
											</template>
											<span
												>Interview stage:
												{{
													item.raw.interviewStage
												}}</span
											>
										</v-tooltip>
									</div>

									<div
										v-if="
											item.raw.firmwareUpdate &&
											!item.raw.isControllerNode
										"
										class="mt-2"
									>
										<v-progress-linear
											:model-value="
												item.raw.firmwareUpdate.progress
											"
											height="5"
											class="mt-1"
											color="primary"
										>
										</v-progress-linear>
										<p
											class="text-caption font-weight-bold mb-0 mt-1"
										>
											{{
												item.raw.firmwareUpdate
													.currentFile
											}}/{{
												item.raw.firmwareUpdate
													.totalFiles
											}}: {{ getProgress(item.raw) }}%
										</p>
									</div>

									<statistics-arrows
										v-else
										:node="item.raw"
									></statistics-arrows>
								</v-card-text>

								<!-- <v-checkbox
                  hide-details
                  dense
                  :active="isSelected(item.raw)"
                  @change="(v) => select(item.raw, v)"
                  @click.stop
                  style="position: absolute; right: 0px; top: 0px"
                ></v-checkbox> -->
							</v-card>
						</v-col>
					</v-row>
				</v-container>
			</template>
		</v-data-iterator>

		<v-dialog
			:fullscreen="$vuetify.display.xs"
			max-width="1200px"
			v-model="expandedNodeDialog"
			persistent
			@keydown.exit="closeDialog()"
		>
			<v-card min-height="90vh">
				<v-fab
					style="position: absolute; right: 5px; top: 5px"
					size="small"
					variant="text"
					@click="closeDialog()"
					icon="close"
				/>
				<v-card-text class="pt-5">
					<expanded-node :node="expandedNode" :socket="socket" />
				</v-card-text>
			</v-card>
		</v-dialog>
	</v-container>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import colors from 'vuetify/util/colors'

import {
	mdiAlertCircle,
	mdiBattery,
	mdiBattery20,
	mdiBattery50,
	mdiBattery80,
	mdiBatteryAlertVariantOutline,
	mdiBatteryUnknown,
	mdiCheckAll,
	mdiCheckCircle,
	mdiEmoticon,
	mdiEmoticonDead,
	mdiHelpCircle,
	mdiLock,
	mdiLockOff,
	mdiMinusCircle,
	mdiNumeric1Circle,
	mdiNumeric2Circle,
	mdiPlusCircle,
	mdiPowerPlug,
	mdiSkipNext,
	mdiSleep,
} from '@mdi/js'
import { mapState } from 'pinia'
import useBaseStore from '../../stores/base.js'
import { getBatteryDescription, jsonToList } from '../../lib/utils.js'

export default {
	props: {
		socket: Object,
	},
	components: {
		ExpandedNode: defineAsyncComponent(
			() => import('@/components/nodes-table/ExpandedNode.vue'),
		),
		RichValue: defineAsyncComponent(
			() => import('@/components/nodes-table/RichValue.vue'),
		),
		StatisticsArrows: defineAsyncComponent(
			() => import('@/components/custom/StatisticsArrows.vue'),
		),
		ReinterviewBadge: defineAsyncComponent(
			() => import('@/components/custom/ReinterviewBadge.vue'),
		),
	},
	watch: {
		selected() {
			this.$emit('selected', this.selected)
		},
	},
	computed: {
		...mapState(useBaseStore, ['nodes']),
		sortingRules() {
			return {
				key: this.sortBy.toLowerCase(),
				order: this.sortDesc ? 'desc' : 'asc',
			}
		},
	},
	data() {
		return {
			search: '',
			sortBy: 'id',
			keys: [
				{
					title: 'ID',
					value: 'id',
				},
				{
					title: 'Name',
					value: 'name',
				},
				{
					title: 'Location',
					value: 'loc',
				},
				{
					title: 'Status',
					value: 'status',
				},
				{
					title: 'Ready',
					value: 'ready',
				},
			],
			sortDesc: false,
			selected: [],
			loading: false,
			expandedNode: null,
			expandedNodeDialog: false,
		}
	},
	methods: {
		padId(id) {
			return id.toString().padStart(3, '0')
		},
		nodeInfo(node) {
			return jsonToList({
				Manufacturer: node.manufacturer,
				'Product Description': node.productDescription,
				'Product Label': node.productLabel,
				'Zwave+ Version': node.zwavePlusVersion || 'N/A',
			})
		},
		showNodeDialog(node) {
			this.expandedNode = node
			this.expandedNodeDialog = true
		},
		closeDialog() {
			this.expandedNode = null
			this.expandedNodeDialog = false
		},
		getProgress(node) {
			return node.firmwareUpdate
				? Math.round(
						(node.firmwareUpdate.sentFragments /
							node.firmwareUpdate.totalFragments) *
							100,
					)
				: null
		},
		readyRichValue(node) {
			const ready = node.ready || false

			let v = {
				align: 'center',
				icon: '',
				iconStyle: `color: ${colors.grey.base}`,
				description: ready ? 'Ready' : 'Not ready',
				size: 18,
			}

			if (ready) {
				v.icon = mdiCheckCircle
				v.iconStyle = `color: ${colors.green.base}`
			} else {
				v.icon = mdiAlertCircle
				v.iconStyle = `color: ${colors.red.base}`
			}

			return v
		},
		rebuildRoutesRichValue(node) {
			const progress = node.rebuildRoutesProgress || 'done'

			let v = {
				align: 'center',
				icon: '',
				iconStyle: `color: ${colors.grey.base}`,
				description: 'Rebuild routes ' + progress,
				size: 18,
			}

			switch (progress) {
				case 'done':
					v.icon = mdiCheckAll
					v.iconStyle = `color: ${colors.green.base}`
					break
				case 'failed':
					v.icon = mdiAlertCircle
					v.iconStyle = `color: ${colors.red.base}`
					break
				case 'skipped':
					v.icon = mdiSkipNext
					v.iconStyle = `color: ${colors.blue.base}`
					break
				case 'pending':
					v.loading = true
			}

			return v
		},
		statusRichValue(node) {
			let v = {
				align: 'center',
				icon: mdiHelpCircle,
				iconStyle: `color: ${colors.grey.base}`,
				description: node.status,
				size: 40,
			}

			switch (node.status) {
				case 'Asleep':
					v.icon = mdiSleep
					v.iconStyle = `color: ${colors.orange.base}`
					break
				case 'Awake':
					v.icon = mdiEmoticon
					v.iconStyle = `color: ${colors.green.base}`
					break
				case 'Dead':
					v.icon = mdiEmoticonDead
					v.iconStyle = `color: ${colors.red.base}`
					break
				case 'Alive':
					v.icon = mdiCheckCircle
					v.iconStyle = `color: ${colors.green.base}`
					break
			}

			return v
		},
		securityRichValue(node) {
			let v = {
				align: 'center',
				icon: mdiHelpCircle,
				iconStyle: `color: ${colors.grey.base}`,
				description: 'Unknown security status',
				size: 18,
			}
			if (node.isSecure === true) {
				v.icon = mdiLock
				v.iconStyle =
					node.security === 'S0_Legacy'
						? `color: ${colors.orange.base}`
						: `color: ${colors.green.base}`
				v.description = node.security
			} else if (node.isSecure === false) {
				v.icon = mdiLockOff
				v.iconStyle = `color: ${colors.red.base}`
				v.description = 'No security'
			}
			return v
		},
		zwavePlusRichValue(node) {
			let v = {
				align: 'center',
				icon: node.ready ? mdiMinusCircle : mdiHelpCircle,
				iconStyle: node.ready
					? `color: ${colors.red.base}`
					: 'color: grey',
				description: node.ready ? 'No' : 'Unknown ZWave+ version',
				size: 18,
			}
			if (node.zwavePlusVersion === undefined) return v
			v.description = `ZWave+ version: ${node.zwavePlusVersion}`
			v.iconStyle = `color: ${colors.green.base}`
			if (node.zwavePlusVersion === 1) {
				v.icon = mdiNumeric1Circle
			} else if (node.zwavePlusVersion === 2) {
				v.icon = mdiNumeric2Circle
			} else {
				v.icon = mdiPlusCircle
				v.displayValue = `${node.zwavePlusVersion}`
			}
			return v
		},
		powerRichValue(node) {
			let level = node.minBatteryLevel
			let iconStyle = `color: ${colors.green.base};`
			let icon = ''
			let description = ''
			if (node.isListening) {
				icon = mdiPowerPlug
				description = 'Main power source'
			} else {
				description = getBatteryDescription(node)
				if (level <= 10) {
					icon = mdiBatteryAlertVariantOutline
					iconStyle = `color: ${colors.red.base}`
				} else if (level <= 30) {
					icon = mdiBattery20
					iconStyle = `color: ${colors.orange.base}`
				} else if (level <= 70) {
					icon = mdiBattery50
				} else if (level <= 90) {
					icon = mdiBattery80
				} else if (level > 90) {
					icon = mdiBattery
				} else {
					icon = mdiBatteryUnknown
					description = 'Battery level: unknown'
					iconStyle = `color: ${colors.grey.base}`
				}
			}
			return {
				align: 'center',
				icon: icon,
				size: 18,
				iconStyle: iconStyle,
				displayStyle: '',
				description: description,
				rawValue: level,
			}
		},
	},
}
</script>

<style></style>
