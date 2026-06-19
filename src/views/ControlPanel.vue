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
import { MAX_NODES_LR } from '@zwave-js/core'

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
			'appInfo',
		]),
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
	data() {
		return {
			fab: false,
			selected: [],
			settings: new Settings(localStorage),
			advancedShowDialog: false,
			generalActions: [
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
								confirm:
									'This action will remove all failed nodes. ATTENTION: this will skip sleeping nodes to prevent unwanted behaviours',
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
					desc: 'Write a custom JS function using the ZwaveJS Driver',
				},
				{
					text: 'NVM Management',
					options: [
						{ name: 'Backup', action: 'backupNVMRaw' },
						{ name: 'Restore', action: 'restoreNVM' },
					],
					icon: 'update',
					color: 'warning',
					desc: "Backup/Restore controller's NVM (Non Volatile Memory)",
				},
				{
					text: 'Firmware update OTW',
					options: [
						{
							name: 'Update',
							action: 'firmwareUpdateOTW',
						},
					],
					icon: 'update',
					color: 'error',
					desc: 'Perform a firmware update OTW (Over The Wire)',
				},
				{
					text: 'Shutdown Zwave API',
					options: [
						{
							name: 'Shutdown',
							action: 'shutdownZwaveAPI',
							args: {
								confirm:
									'Are you sure you want to shutdown the Zwave API? You will have to unplug and replug the Zwave stick manually to restart it.',
								confirmLevel: 'warning',
							},
						},
					],
					icon: 'power_off',
					color: 'warning',
					desc: 'Allows to shutdown the Zwave API to safely unplug the Zwave stick.',
				},
				{
					text: 'Learn mode',
					options: [
						{
							name: 'Start',
							action: 'startLearnMode',
							args: {
								confirm:
									'Initiate learn mode on primary controller first and then click OK here.',
							},
						},
						{
							name: 'Stop',
							action: 'stopLearnMode',
						},
					],
					icon: 'join_inner',
					desc: 'Instruct controller to run learning mode (can join pre-existing network)',
				},
			],
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
		...mapActions(useBaseStore, ['setRebuildRoutesProgress']),
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

					const payload = await this.resolveImportSelection(data)
					// User dismissed the network picker
					if (!payload) return

					const response = await ConfigApis.importConfig(payload)
					this.showSnackbar(
						response.message,
						response.success ? 'success' : 'error',
					)
				} catch (error) {
					log.error(error)
				}
			}
		},
		/**
		 * Inspect an imported nodes.json payload and, when it bundles multiple
		 * Z-Wave networks (home-id wrapped), ask the user which one to apply to
		 * the current controller. Returns the `/importConfig` request body, or
		 * null if the picker was dismissed.
		 */
		async resolveImportSelection(data) {
			const homeIds = this.getImportHomeIds(data)

			// Flat/array payload, or a single network: nothing to choose.
			if (homeIds.length <= 1) {
				return { data }
			}

			const MERGE_ALL = '__merge_all__'
			const current = this.appInfo?.homeHex

			const items = homeIds.map(({ homeId, nodeCount }) => ({
				title:
					`${homeId}${homeId === current ? ' (current)' : ''} — ` +
					`${nodeCount} node${nodeCount === 1 ? '' : 's'}`,
				value: homeId,
			}))
			items.push({ title: 'All networks (merge)', value: MERGE_ALL })

			const selection = await this.app.confirm(
				'Multiple networks found',
				'This backup contains nodes for more than one Z-Wave ' +
					'network. Choose which network to import into the ' +
					'current controller.',
				'warning',
				{
					confirmText: 'Import',
					width: 450,
					inputs: [
						{
							type: 'list',
							key: 'homeId',
							label: 'Network',
							required: true,
							items,
							default: homeIds.some((h) => h.homeId === current)
								? current
								: homeIds[0].homeId,
						},
					],
				},
			)

			if (!selection || !selection.homeId) return null

			return selection.homeId === MERGE_ALL
				? { data, mergeAll: true }
				: { data, homeId: selection.homeId }
		},
		/**
		 * Detect the home ids in a home-id-wrapped nodes.json payload, with the
		 * node count of each. Returns [] for flat/array/legacy payloads.
		 */
		getImportHomeIds(data) {
			if (!data || typeof data !== 'object' || Array.isArray(data)) {
				return []
			}

			// A node id is a positive integer within the addressable range
			// (Long Range tops out at 4000); home ids are far larger, so this
			// keeps a home-id key from being mistaken for a node-id key.
			const isNodeId = (key) =>
				/^\d+$/.test(key) &&
				Number(key) > 0 &&
				Number(key) <= MAX_NODES_LR
			const entries = Object.entries(data)

			// Node-id top-level keys mean a direct node map, not wrapped.
			if (entries.some(([key]) => isNodeId(key))) {
				return []
			}

			return entries
				.filter(
					([, value]) =>
						value &&
						typeof value === 'object' &&
						!Array.isArray(value),
				)
				.map(([homeId, value]) => ({
					homeId,
					nodeCount: Object.keys(value).filter(isNodeId).length,
				}))
				.filter(({ nodeCount }) => nodeCount > 0)
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
	},
	mounted() {
		this.subscribeChannels(['rebuild'])
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
