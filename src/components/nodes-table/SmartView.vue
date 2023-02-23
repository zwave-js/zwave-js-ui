<template>
	<v-container fluid class="fill">
		<v-text-field
			v-model="search"
			v-if="!loading"
			prepend-icon="mdi-magnify"
			label="Search"
			single-line
			style="max-width: 250px; margin: auto"
			clearable
		></v-text-field>
		<v-data-iterator
			:loading="loading"
			:items="nodes"
			:search="search"
			item-key="id"
			hide-default-footer
			:itemsPerPage="-1"
		>
			<template v-slot:no-data>
				<v-container>
					<v-row class="pa-0">
						<v-col cols="12" class="text-center">
							<v-icon class="display-4">mdi-image-search</v-icon>
							<h3 class="font-weight-light">No nodes Found</h3>
						</v-col>
					</v-row>
				</v-container>
			</template>

			<template v-slot:no-results>
				<v-container>
					<v-row class="pa-0">
						<v-col cols="12" class="text-center">
							<v-icon class="display-4">mdi-nodes-search</v-icon>
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

			<template v-slot:default="{ items }">
				<v-container style="min-height: 600px">
					<v-row justify="center" class="pa-0">
						<v-col
							v-for="item in items"
							:key="item.id"
							width="170px"
							style="max-width: 170px"
						>
							<v-card
								@click.stop="showNodeDialog(item)"
								hover
								outlined
								height="150"
								width="150"
							>
								<v-card-text
									class="text-center pa-1 d-flex flex-column"
								>
									<v-row
										class="pa-0 ma-0"
										justify="space-between"
									>
										<strong
											style="
												font-size: 14px;
												line-height: 1.3;
												padding: 2px;
												border: 1px solid #ccc;
												border-radius: 4px;
											"
										>
											{{ padId(item.id) }}
										</strong>

										<rich-value
											:value="powerRichValue(item)"
										/>

										<rich-value
											:value="healRichValue(item)"
										/>

										<rich-value
											:value="securityRichValue(item)"
										/>

										<rich-value
											:value="readyRichValue(item)"
										/>
									</v-row>

									<span
										class="caption pb-0 font-weight-bold primary--text text-truncate text-capitalize"
										>{{ item.name }}
									</span>
									<span
										class="caption pb-0 font-weight-bold text-truncate text-capitalize"
										>{{ item.loc }}
									</span>

									<v-badge
										bordered
										:content="'v' + item.firmwareVersion"
										offset-x="50"
										offset-y="20"
										overlap
									>
										<div
											v-if="
												item.interviewStage ===
												'Complete'
											"
										>
											<v-tooltip bottom>
												<template
													v-slot:activator="{
														on: tooltip,
													}"
												>
													<div
														v-on="{ ...tooltip }"
														class="display-1"
													>
														<rich-value
															:value="
																statusRichValue(
																	item
																)
															"
														/>
													</div>
												</template>
												<span
													style="
														white-space: pre-wrap;
													"
													v-text="nodeInfo(item)"
												>
												</span>
											</v-tooltip>
										</div>
										<div
											v-else
											@click.stop
											class="text-center"
										>
											<v-tooltip bottom>
												<template
													v-slot:activator="{
														on: tooltip,
													}"
												>
													<v-progress-circular
														indeterminate
														class="ma-1"
														size="32"
														v-on="{ ...tooltip }"
														color="primary"
													></v-progress-circular>
												</template>
												<span
													>Interview stage:
													{{
														item.interviewStage
													}}</span
												>
											</v-tooltip>
										</div>
									</v-badge>

									<div
										v-if="
											item.firmwareUpdate &&
											!item.isControllerNode
										"
										class="mt-2"
									>
										<v-progress-linear
											:value="
												item.firmwareUpdate.progress
											"
											height="5"
											class="mt-1"
											color="primary"
										>
										</v-progress-linear>
										<p
											class="caption font-weight-bold mb-0 mt-1"
										>
											{{
												item.firmwareUpdate.currentFile
											}}/{{
												item.firmwareUpdate.totalFiles
											}}: {{ getProgress(item) }}%
										</p>
									</div>

									<statistics-arrows
										v-else
										:node="item"
									></statistics-arrows>
								</v-card-text>

								<!-- <v-checkbox
                  hide-details
                  dense
                  :input-value="isSelected(item)"
                  @change="(v) => select(item, v)"
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
			:fullscreen="$vuetify.breakpoint.xs"
			max-width="1200px"
			v-model="expandedNodeDialog"
			@keydown.exit="closeDialog()"
		>
			<v-card min-height="90vh">
				<v-btn
					style="position: absolute; right: 5px; top: 5px"
					x-small
					@click="closeDialog()"
					icon
					fab
				>
					<v-icon>close</v-icon>
				</v-btn>
				<v-card-text class="pt-3">
					<expanded-node
						:node="expandedNode"
						:socket="socket"
						v-on="$listeners"
					/>
				</v-card-text>
			</v-card>
		</v-dialog>
	</v-container>
</template>

<script>
import StatisticsArrows from '@/components/custom/StatisticsArrows.vue'
import ExpandedNode from '@/components/nodes-table/ExpandedNode.vue'
import RichValue from '@/components/nodes-table/RichValue.vue'
import colors from 'vuetify/lib/util/colors'

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
import { jsonToList } from '../../lib/utils.js'

export default {
	props: {
		socket: Object,
	},
	components: {
		ExpandedNode,
		RichValue,
		StatisticsArrows,
	},
	watch: {},
	computed: {
		...mapState(useBaseStore, ['nodes']),
	},
	data() {
		return {
			search: '',
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
		getHealIcon(status) {
			switch (status) {
				case 'done':
					return { icon: 'done', color: 'green' }
				case 'failed':
					return { icon: 'error', color: 'red' }
				case 'skipped':
					return { icon: 'next_plan', color: 'blue' }
			}

			return undefined
		},
		getProgress(node) {
			return node.firmwareUpdate
				? Math.round(
						(node.firmwareUpdate.sentFragments /
							node.firmwareUpdate.totalFragments) *
							100
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
		healRichValue(node) {
			const progress = node.healProgress || 'done'

			let v = {
				align: 'center',
				icon: '',
				iconStyle: `color: ${colors.grey.base}`,
				description: 'Heal ' + progress,
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
				description = 'mains-powered'
			} else {
				description = Array.isArray(node.batteryLevels)
					? 'All battery levels: ' +
					  node.batteryLevels.map((v) => `${v}%`).join(',')
					: 'Unknown battery level'
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
