<template>
	<div>
		<v-container fluid class="pa-4">
			<v-row class="py-4 align-center" no-gutters>
				<v-col :class="compact ? 'text-center' : 'text-end'">
					<v-btn-group multiple>
						<v-btn
							:active="showControllerStatistics"
							color="primary"
							variant="outlined"
							@click="toggleControllerStatistics"
						>
							<v-icon start>
								{{ statisticsOpeningIndicator }}
							</v-icon>
							Controller statistics
							<v-icon color="primary" end>
								multiline_chart
							</v-icon>
						</v-btn>
						<v-btn
							color="primary"
							v-if="$vuetify.display.mdAndUp"
							variant="flat"
							:active="compactMode"
							@click.stop="compactMode = !compactMode"
						>
							Compact
						</v-btn>
					</v-btn-group>
				</v-col>
			</v-row>
			<v-expand-transition>
				<v-row v-show="showControllerStatistics">
					<v-col class="mb-8">
						<v-sheet border rounded>
							<StatisticsCard
								v-if="!!controllerNode"
								title="Controller Statistics"
								:node="this.controllerNode"
							/>
						</v-sheet>
					</v-col>
				</v-row>
			</v-expand-transition>
			<nodes-table
				v-if="!compact"
				class="pb-8"
				:socket="socket"
				@action="sendAction"
				@selected="selected = $event"
			/>
			<smart-view
				:socket="socket"
				@selected="selected = $event"
				@action="sendAction"
				v-else
			>
			</smart-view>
		</v-container>

		<DialogAdvanced
			v-model="advancedShowDialog"
			@close="advancedShowDialog = false"
			:actions="actions"
			@action="onAction"
			:title="advancedDialogTitle"
		/>

		<DialogDebugCapture
			v-model="debugCaptureDialog"
			@captureStarted="onDebugCaptureStarted"
			@captureStopped="onDebugCaptureStopped"
		/>

		<base-fab
			v-model="fab"
			location="bottom end"
			:color="selected.length === 0 ? 'primary' : 'success'"
			icon-open="menu"
			icon-close="close"
			:items="fabItems"
		/>
	</div>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import ConfigApis from '@/apis/ConfigApis'
import { mapState, mapActions } from 'pinia'

import { Settings } from '@/modules/Settings'
import { jsonToList } from '@/lib/utils'
import useBaseStore from '../stores/base.js'
import InstancesMixin from '../mixins/InstancesMixin.js'
import logger from '../lib/logger'

const log = logger.get('ControlPanel')

export default {
	name: 'ControlPanel',
	props: {
		socket: Object,
	},
	mixins: [InstancesMixin],
	components: {
		NodesTable: defineAsyncComponent(
			() => import('@/components/nodes-table/index.vue'),
		),
		DialogAdvanced: defineAsyncComponent(
			() => import('@/components/dialogs/DialogAdvanced.vue'),
		),
		DialogDebugCapture: defineAsyncComponent(
			() => import('@/components/dialogs/DialogDebugCapture.vue'),
		),
		StatisticsCard: defineAsyncComponent(
			() => import('@/components/custom/StatisticsCard.vue'),
		),
		SmartView: defineAsyncComponent(
			() => import('@/components/nodes-table/SmartView.vue'),
		),
		BaseFab: defineAsyncComponent(
			() => import('@/components/custom/BaseFab.vue'),
		),
	},
	computed: {
		...mapState(useBaseStore, [
			'nodes',
			'zwave',
			'controllerNode',
			'debugCaptureFinishTrigger',
			'debugCaptureActive',
		]),
		generalActions() {
			// Base actions array
			const actions = [
				{
					text: 'Backup',
					options: [
						{ name: 'Import', action: 'import' },
						{ name: 'Export', action: 'export' },
					],
					icon: 'save',
					desc: 'Save or load `nodes.json` file with names and locations',
				},
				{
					text: 'Dump',
					options: [{ name: 'Export', action: 'exportDump' }],
					icon: 'bug_report',
					desc: 'Export all nodes in a json file. Useful for debugging purposes',
				},
			]

			// Debug Capture - change button based on active state
			if (this.debugCaptureActive) {
				actions.push({
					text: 'Debug Capture',
					options: [{ name: 'Stop', action: 'stopDebugCapture' }],
					icon: 'troubleshoot',
					color: 'error',
					desc: 'Stop capturing debug logs and download the debug package',
				})
			} else {
				actions.push({
					text: 'Debug Capture',
					options: [{ name: 'Start', action: 'startDebugCapture' }],
					icon: 'troubleshoot',
					color: 'info',
					desc: 'Start capturing debug logs. Perform the action you want to debug, then stop to download a complete debug package',
				})
			}

			// Rest of the actions
			actions.push(
				{
					text: 'Re-interview Nodes',
					options: [
						{
							name: 'Start',
							action: 'refreshInfo',
							args: {
								broadcast: true,
							},
						},
					],
					icon: 'history',
					color: 'warning',
					desc: 'Clear all info about all nodes and make a new full interview. Use when nodes has wrong or missing capabilities',
				},
				{
					text: 'Rebuild Routes',
					options: [
						{
							name: 'Begin',
							action: 'beginRebuildingRoutes',
						},
						{ name: 'Stop', action: 'stopRebuildingRoutes' },
					],
					icon: 'healing',
					color: 'warning',
					desc: 'Force nodes to establish new connections to the controller',
				},
				{
					text: 'Hard Reset',
					options: [
						{
							name: 'Factory Reset',
							action: 'hardReset',
						},
					],
					icon: 'warning',
					color: 'error',
					desc: 'Reset controller to factory defaults (all paired devices will be removed)',
				},
				{
					text: 'Soft Reset',
					options: [
						{
							name: 'Soft Reset',
							action: 'softReset',
							args: {
								confirm: `<p>Are you sure you want to soft-reset your controller?</p>
									<p>USB modules will reconnect, meaning that they might get a new address. Make sure to configure your device address in a way that prevents it from changing, e.g. by using <code>/dev/serial/by-id/...</code> on Linux.</p>
									<p><strong>This method may cause problems in Docker containers with certain Z-Wave stick.</strong> If that happens, you may need to restart your host OS and docker container.</p>`,
							},
						},
					],
					icon: 'refresh',
					color: 'warning',
					desc: 'Instruct the controller to soft-reset (restart)',
				},
				{
					text: 'Failed Nodes',
					options: [
						{
							name: 'Remove all',
							action: 'removeFailedNode',
							args: {
								broadcast: true,
							},
						},
					],
					icon: 'dangerous',
					color: 'error',
					desc: 'Manage nodes that are dead and/or marked as failed with the controller',
				},
				{
					text: 'Driver function',
					options: [
						{
							name: 'Write',
							action: 'driverFunction',
						},
					],
					icon: 'code',
					color: 'info',
					desc: 'Write a custom JS function using the ZwaveJS Driver',
				},
				{
					text: 'NVM Management',
					options: [
						{
							name: 'Backup',
							action: 'backupNVMRaw',
						},
						{
							name: 'Restore',
							action: 'restoreNVM',
						},
					],
					icon: 'update',
					color: 'info',
					desc: "Backup/Restore controller's NVM (Non Volatile Memory)",
				},
				{
					text: 'Firmware update OTW',
					options: [
						{
							name: 'Update',
							action: 'updateFirmware',
						},
					],
					icon: 'update',
					color: 'info',
					desc: 'Perform a firmware update OTW (Over The Wire)',
				},
				{
					text: 'Shutdown Zwave API',
					options: [
						{
							name: 'Shutdown',
							action: 'shutdownZwaveAPI',
						},
					],
					icon: 'power_off',
					color: 'error',
					desc: 'Allows to shutdown the Zwave API to safely unplug the Zwave stick.',
				},
				{
					text: 'Learn mode',
					options: [
						{
							name: 'Start',
							action: 'startLearnMode',
						},
						{
							name: 'Stop',
							action: 'stopLearnMode',
						},
					],
					icon: 'join_inner',
					color: 'warning',
					desc: 'Instruct controller to run learning mode (can join pre-existing network)',
				},
			)

			return actions
		},
		fabItems() {
			const items = []

			// Show "Manage nodes" button only when no nodes are selected
			if (this.selected.length === 0) {
				items.push({
					icon: 'all_inclusive',
					color: 'success',
					tooltip: 'Manage nodes',
					action: () => this.showNodesManager(),
				})
			}

			// Always show "Advanced actions" button
			items.push({
				icon: 'auto_fix_high',
				color: 'purple',
				tooltip: 'Advanced actions',
				action: () => {
					this.advancedShowDialog = true
				},
			})

			return items
		},
		timeoutMs() {
			return this.zwave.commandsTimeout * 1000 + 800 // add small buffer
		},
		statisticsOpeningIndicator() {
			return this.showControllerStatistics
				? 'arrow_drop_up'
				: 'arrow_drop_down'
		},
		compact() {
			return this.$vuetify.display.smAndDown || this.compactMode
		},
		compactMode: {
			get() {
				return useBaseStore().ui.compactMode
			},
			set(value) {
				useBaseStore().setCompactMode(value)
			},
		},
		actions() {
			if (this.selected.length === 0) return this.generalActions

			return this.selectedActions
		},
		advancedDialogTitle() {
			if (this.selected.length === 0) return 'General actions'

			return `Actions for ${this.selected.length} selected node${
				this.selected.length > 1 ? 's' : ''
			}`
		},
	},
	watch: {
		debugCaptureFinishTrigger(val) {
			if (val) {
				this.openDebugCaptureFinish()
			}
		},
	},
	data() {
		return {
			fab: false,
			selected: [],
			settings: new Settings(localStorage),
			advancedShowDialog: false,
			debugCaptureDialog: null, // null, 'start', or 'finish'
			rules: {
				required: (value) => {
					let valid = false

					if (value instanceof Array) valid = value.length > 0
					else valid = !isNaN(value) || !!value // isNaN is for 0 as valid value

					return valid || 'This field is required.'
				},
			},
			/** Actions to show when there is one or more selected nodes in table */
			selectedActions: [
				{
					text: 'Re-interview Node',
					options: [
						{
							name: 'Interview',
							action: 'refreshInfo',
						},
					],
					icon: 'history',
					desc: 'Clear all info about this node and make a new full interview. Use when the node has wrong or missing capabilities',
				},
				{
					text: 'Refresh Values',
					options: [
						{
							name: 'Refresh',
							action: 'refreshValues',
							args: {
								confirm:
									'Are you sure you want to refresh values of this node? This action increases network traffic',
							},
						},
					],
					icon: 'cached',
					desc: 'Update all CC values and metadata. Use only when many values seems stale',
				},
				{
					text: 'Rebuild Node Routes',
					options: [
						{
							name: 'Rebuild',
							action: 'rebuildNodeRoutes',
							args: {
								confirm:
									'Rebuilding routes of a specific node. This action causes a lot of traffic, can take minutes up to hours and you can expect degraded performance while it is going on',
							},
						},
					],
					icon: 'healing',
					color: 'warning',
					desc: 'Discover and assign new routes between a specific node to the controller and his neighbors',
				},
				{
					text: 'Ping',
					options: [
						{
							name: 'Ping',
							action: 'pingNode',
						},
					],
					icon: 'swap_horiz',
					desc: 'Ping node to check if it is alive',
				},
				{
					text: 'Failed Nodes',
					options: [
						{
							name: 'Remove',
							action: 'removeFailedNode',
						},
					],
					color: 'error',
					icon: 'dangerous',
					desc: 'Manage nodes that are dead and/or marked as failed with the controller',
				},
			],
			showControllerStatistics: false,
		}
	},
	methods: {
		...mapActions(useBaseStore, [
			'setRebuildRoutesProgress',
			'showSnackbar',
		]),
		jsonToList,
		showNodesManager() {
			this.app.showNodesManager()
		},
		async onAction(action, args = {}) {
			if (action === 'import') {
				this.importConfiguration()
			} else if (action === 'export') {
				this.exportConfiguration()
			} else if (action === 'exportDump') {
				this.exportDump()
			} else if (action === 'startDebugCapture') {
				this.debugCaptureDialog = 'start'
			} else if (action === 'stopDebugCapture') {
				this.openDebugCaptureFinish()
			} else {
				this.sendAction(action, { ...args, nodes: this.selected })
			}
		},
		async importConfiguration() {
			if (
				await this.app.confirm(
					'Attention',
					'This will override all existing nodes names and locations',
					'alert',
				)
			) {
				try {
					const { data } = await this.app.importFile('json')
					const response = await ConfigApis.importConfig({
						data: data,
					})
					this.showSnackbar(
						response.message,
						response.success ? 'success' : 'error',
					)
				} catch (error) {
					log.error(error)
				}
			}
		},
		async exportConfiguration() {
			try {
				const data = await ConfigApis.exportConfig()
				this.showSnackbar(
					data.message,
					data.success ? 'success' : 'error',
				)
				if (data.success) {
					this.app.exportConfiguration(data.data, 'nodes', 'json')
				}
			} catch (error) {
				log.error(error)
			}
		},
		exportDump() {
			this.app.exportConfiguration(this.nodes, 'nodes_dump', 'json')
		},
		toggleControllerStatistics() {
			this.showControllerStatistics = !this.showControllerStatistics
		},
		onDebugCaptureStarted() {
			const store = useBaseStore()
			store.debugCaptureActive = true
		},
		onDebugCaptureStopped() {
			const store = useBaseStore()
			store.debugCaptureActive = false
		},
		openDebugCaptureFinish() {
			this.debugCaptureDialog = 'finish'
		},
	},
	mounted() {
		this.bindEvent(
			'rebuildRoutesProgress',
			this.setRebuildRoutesProgress.bind(this),
		)
	},
	beforeUnmount() {
		if (this.socket) {
			this.unbindEvents()
		}
	},
}
</script>
