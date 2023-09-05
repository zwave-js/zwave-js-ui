<template>
	<div>
		<v-container fluid class="pa-4">
			<v-row class="py-4 align-center" no-gutters>
				<v-col :class="compact ? 'text-center' : 'text-end'">
					<v-item-group class="v-btn-toggle">
						<v-btn
							color="primary"
							outlined
							@click="toggleControllerStatistics"
						>
							<v-icon left>
								{{ statisticsOpeningIndicator }}
							</v-icon>
							Controller statistics
							<v-icon color="primary" right>
								multiline_chart
							</v-icon>
						</v-btn>
						<v-btn
							color="primary"
							v-if="$vuetify.breakpoint.mdAndUp"
							:outlined="!compactMode"
							@click.stop="compactMode = !compactMode"
						>
							Compact
						</v-btn>
					</v-item-group>
				</v-col>
			</v-row>
			<v-expand-transition>
				<v-row v-show="showControllerStatistics">
					<v-col class="mb-8">
						<v-sheet outlined rounded>
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
				v-on="$listeners"
				@action="sendAction"
				@selected="selected = $event"
			/>
			<smart-view
				:socket="socket"
				v-on="$listeners"
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

		<v-speed-dial bottom fab right fixed v-model="fab">
			<template v-slot:activator>
				<v-btn
					:color="selected.length === 0 ? 'blue darken-2' : 'success'"
					dark
					fab
					hover
					v-model="fab"
				>
					<v-icon v-if="fab">close</v-icon>
					<v-icon v-else>menu</v-icon>
				</v-btn>
			</template>
			<v-tooltip left>
				<template v-slot:activator="{ on, attrs }">
					<v-btn
						fab
						v-if="selected.length === 0"
						dark
						small
						color="green"
						@click="showNodesManager()"
						v-bind="attrs"
						v-on="on"
					>
						<v-icon>all_inclusive</v-icon>
					</v-btn>
				</template>
				<span>Manage nodes</span>
			</v-tooltip>

			<v-tooltip left>
				<template v-slot:activator="{ on, attrs }">
					<v-btn
						fab
						dark
						small
						color="purple"
						@click="advancedShowDialog = true"
						v-bind="attrs"
						v-on="on"
					>
						<v-icon>auto_fix_high</v-icon>
					</v-btn>
				</template>
				<span>Advanced actions</span>
			</v-tooltip>
		</v-speed-dial>
	</div>
</template>

<script>
import ConfigApis from '@/apis/ConfigApis'
import { mapState, mapActions } from 'pinia'

import DialogAdvanced from '@/components/dialogs/DialogAdvanced.vue'
import NodesTable from '@/components/nodes-table/index.vue'
import { Settings } from '@/modules/Settings'
import { jsonToList } from '@/lib/utils'
import StatisticsCard from '@/components/custom/StatisticsCard.vue'
import useBaseStore from '../stores/base.js'
import SmartView from '@/components/nodes-table/SmartView.vue'
import InstancesMixin from '../mixins/InstancesMixin.js'
import logger from '../lib/logger'
import { FirmwareUpdateStatus } from 'zwave-js/safe'

const log = logger.get('ControlPanel')

export default {
	name: 'ControlPanel',
	props: {
		socket: Object,
	},
	mixins: [InstancesMixin],
	components: {
		NodesTable,
		DialogAdvanced,
		StatisticsCard,
		SmartView,
	},
	computed: {
		...mapState(useBaseStore, ['nodes', 'zwave', 'controllerNode']),
		timeoutMs() {
			return this.zwave.commandsTimeout * 1000 + 800 // add small buffer
		},
		statisticsOpeningIndicator() {
			return this.showControllerStatistics
				? 'arrow_drop_up'
				: 'arrow_drop_down'
		},
		compact() {
			return this.$vuetify.breakpoint.smAndDown || this.compactMode
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
	watch: {},
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
					text: 'Heal Network',
					options: [
						{
							name: 'Begin',
							action: 'beginHealingNetwork',
						},
						{ name: 'Stop', action: 'stopHealingNetwork' },
					],
					icon: 'healing',
					color: 'warning',
					desc: 'Force nodes to establish better connections to the controller',
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
					text: 'Hard Reset',
					options: [
						{
							name: 'Factory Reset',
							action: 'hardReset',
						},
					],
					icon: 'warning',
					color: 'red',
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
					color: 'red',
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
			],
			rules: {
				required: (value) => {
					let valid = false

					if (value instanceof Array) valid = value.length > 0
					else valid = !isNaN(value) || !!value // isNaN is for 0 as valid value

					return valid || 'This field is required.'
				},
			},
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
					text: 'Heal Node',
					options: [
						{
							name: 'Heal',
							action: 'healNode',
							args: {
								confirm:
									'Healing a node causes a lot of traffic, can take minutes up to hours and you can expect degraded performance while it is going on',
							},
						},
					],
					icon: 'healing',
					desc: 'Force nodes to establish better connections to the controller',
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
			],
			showControllerStatistics: false,
		}
	},
	methods: {
		...mapActions(useBaseStore, ['setHealProgress', 'showSnackbar']),
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
				await this.$listeners.showConfirm(
					'Attention',
					'This will override all existing nodes names and locations',
					'alert'
				)
			) {
				try {
					const { data } = await this.$listeners.import('json')
					const response = await ConfigApis.importConfig({
						data: data,
					})
					this.showSnackbar(
						response.message,
						response.success ? 'success' : 'error'
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
					data.success ? 'success' : 'error'
				)
				if (data.success) {
					this.$listeners.export(data.data, 'nodes', 'json')
				}
			} catch (error) {
				log.error(error)
			}
		},
		exportDump() {
			this.$listeners.export(this.nodes, 'nodes_dump', 'json')
		},
		async sendAction(
			action,
			{ nodeId, broadcast, confirm, confirmLevel, nodes }
		) {
			if (action) {
				if (confirm) {
					const ok = await this.$listeners.showConfirm(
						'Info',
						confirm,
						confirmLevel || 'info',
						{
							cancelText: 'cancel',
							confirmText: 'ok',
							width: 900,
						}
					)

					if (!ok) {
						return
					}
				}

				if (nodes?.length > 0) {
					const requests = nodes.map((node) =>
						this.app.apiRequest(action, [node.id])
					)

					await Promise.allSettled(requests)
					this.showSnackbar(
						`Action ${action} sent to all nodes`,
						'success'
					)
					return
				}

				let args = []
				if (nodeId !== undefined) {
					if (!broadcast) {
						if (isNaN(nodeId)) {
							this.showSnackbar(
								'Node ID must be an integer value',
								'error'
							)
							return
						}
						args.push(parseInt(nodeId))
					}
				}

				if (action === 'startInclusion') {
					const secure = await this.$listeners.showConfirm(
						'Node inclusion',
						'Start inclusion in secure mode?',
						'info',
						{
							cancelText: 'No',
						}
					)
					args.push(secure)
				} else if (action === 'hardReset') {
					const { confirm } = await this.$listeners.showConfirm(
						'Hard Reset',
						'Your controller will be reset to factory and all paired devices will be removed',
						'alert',
						{
							confirmText: 'Ok',
							inputs: [
								{
									type: 'text',
									label: 'Confirm',
									required: true,
									key: 'confirm',
									hint: 'Type "yes" and press OK to confirm',
								},
							],
						}
					)
					if (!confirm || confirm !== 'yes') {
						return
					}
				} else if (action === 'beginHealingNetwork') {
					const { includeSleeping } =
						await this.$listeners.showConfirm(
							'Info',
							'Healing network causes a lot of traffic, can take minutes up to hours and users have to expect degraded performance while it is going on',
							'info',
							{
								confirmText: 'Heal',
								inputs: [
									{
										type: 'checkbox',
										label: 'Include sleeping nodes',
										key: 'includeSleeping',
										default: false,
									},
								],
							}
						)
					if (includeSleeping === undefined) {
						return
					}
					args.push({ includeSleeping })
				} else if (action === 'firmwareUpdateOTW') {
					const result = await this.$listeners.showConfirm(
						'Firmware update OTW',
						`<h3 class="red--text">We don't take any responsibility if devices upgraded using Z-Wave JS don't work after an update. Always double-check that the correct update is about to be installed.</h3>
						<h3 class="mt-2 red--text">A failure during this process may leave your controller in recovery mode, rendering it unusable until a correct firmware image is uploaded. In case of 500 series controllers a failure on this process is likely unrecoverable.</h3>
						`,
						'alert',
						{
							confirmText: 'Update',
							width: 500,
							inputs: [
								{
									type: 'file',
									label: 'File',
									hint: 'Firmware file',
									key: 'file',
									accept: '.hex,.gbl,.otz,.ota',
								},
							],
						}
					)

					const file = result?.file

					if (!file) {
						return
					}

					try {
						const buffer = await file.arrayBuffer()
						args = [
							{
								name: file.name,
								data: buffer,
							},
						]
						const store = useBaseStore()

						const controllerNode = this.controllerNode || {
							id: 1,
							name: 'Controller',
							_name: 'Controller',
							isControllerNode: true,
							loc: '',
							ready: true,
							values: [],
						}

						if (!this.controllerNode) {
							// bootloader only mode, add a fake node to the store
							store.updateNode(controllerNode)
						}

						// start the progress bar
						store.updateNode(
							{
								id: controllerNode.id,
								firmwareUpdate: {
									progress: 0,
								},
							},
							true
						)
					} catch (error) {
						this.showSnackbar(
							'Error reading file: ' + error.message,
							'error'
						)
						return
					}
				} else if (action === 'updateFirmware') {
					try {
						const node = this.nodes.find((n) => n.id === nodeId)
						const targets = node.firmwareCapabilities
							.firmwareTargets || [0]

						const fileInput = {
							cols: 8,
							type: 'file',
							label: 'File',
							hint: 'Firmware file',
							key: 'file',
							accept: '.bin,.exe,.ex_,.hex,.gbl,.otz,.ota,.hec',
						}

						const targetInput = {
							type: 'list',
							cols: 4,
							allowManualEntry: true,
							label: 'Target',
							hint: 'Target to update',
							key: 'target',
							items: targets.map((t) => ({
								text: 'Target ' + t,
								value: t,
							})),
						}

						const inputs = []

						for (const t of targets) {
							inputs.push({
								...fileInput,
								key: 'file_' + t,
							})

							inputs.push({
								...targetInput,
								key: 'target_' + t,
								default: t,
							})
						}

						const result = await this.$listeners.showConfirm(
							'Firmware update',
							'',
							'info',
							{
								confirmText: 'Ok',
								width: 500,
								inputs,
							}
						)

						if (!result) {
							return
						}

						const fwData = []
						for (const t of targets) {
							if (result['file_' + t]) {
								const f = result['file_' + t]
								const fwEntry = {
									name: f.name,
									data: await f.arrayBuffer(),
									target: parseInt(result['target_' + t]),
								}

								if (isNaN(fwEntry.target)) {
									delete fwEntry.target
								}

								fwData.push(fwEntry)
							}
						}

						if (fwData.length === 0) {
							return
						}

						args.push(fwData)
					} catch (error) {
						return
					}
				} else if (action === 'driverFunction') {
					const { data: snippets } = await ConfigApis.getSnippets()
					await this.$listeners.showConfirm(
						'Driver function',
						'',
						'info',
						{
							width: 900,
							confirmText: 'Close',
							cancelText: '',
							inputs: [
								{
									type: 'list',
									key: 'snippet',
									label: 'Snippets',
									default: '',
									items: snippets,
									itemText: 'name',
									itemValue: 'name',
									hint: 'Select a snippet from library',
									onChange: (values, v) => {
										const content = v
											? snippets.find((s) => s.name === v)
													?.content
											: ''

										if (v) {
											values.code = content
										}
									},
								},
								{
									type: 'button',
									label: 'Run',
									icon: 'play_circle_outline',
									color: 'primary',
									onChange: async (values) => {
										const response =
											await this.app.apiRequest(action, [
												values.code,
											])

										if (response.success) {
											this.showSnackbar(
												'Function executed successfully, check console for result',
												'success'
											)
										}

										log.info(
											'Driver function result:',
											response.result
										)
									},
								},
								{
									type: 'code',
									key: 'code',
									default:
										'// Example:\n// const { logger, zwaveClient, require } = this\n// const node = driver.controller.nodes.get(35);\n// await node.refreshInfo();\n// logger.info(`Node ${node.id} is ready: ${node.ready}`);',
									hint: `Write the function here. The only arg is:
                    <code>driver</code>. The function is <code>async</code>.`,
								},
							],
						}
					)

					return
				} else if (action === 'backupNVMRaw') {
					const confirm = await this.$listeners.showConfirm(
						'NVM Backup',
						'While doing the backup the Z-Wave radio will be turned on/off',
						'alert',
						{
							confirmText: 'Ok',
						}
					)
					if (!confirm) {
						return
					}
				} else if (action === 'restoreNVM') {
					const confirm = await this.$listeners.showConfirm(
						'NVM Restore',
						'While doing the restore the Z-Wave radio will be turned on/off.\n<strong>A failure during this process may brick your controller. Use at your own risk!</strong>',
						'alert',
						{
							confirmText: 'Ok',
						}
					)
					if (!confirm) {
						return
					}

					try {
						const { data } = await this.$listeners.import('buffer')
						args.push(data)
					} catch (error) {
						return
					}
				} else if (action === 'refreshInfo') {
					const options = await this.$listeners.showConfirm(
						'Refresh info',
						`Are you sure you want to re-interview ${
							broadcast ? 'all nodes' : 'node ' + nodeId
						}? All known information about your nodes will be discarded. Battery powered nodes need to be woken up, interaction with the nodes won't be reliable until the interview is done.`,
						'info',
						{
							width: 900,
							confirmText: 'Ok',
							inputs: [
								{
									type: 'checkbox',
									key: 'resetSecurityClasses',
									default: false,
									label: 'Reset security classes',
								},
							],
						}
					)

					if (!options || Object.keys(options).length === 0) {
						return
					}

					args.push(options)
				}

				if (broadcast) {
					let nodes = this.nodes

					// ignore sleeping nodes in broadcast request. Fixes #983
					if (action === 'removeFailedNode') {
						nodes = nodes.filter((n) => n.status !== 'Asleep')
					}

					const requests = []

					for (let i = 0; i < nodes.length; i++) {
						const nodeid = nodes[i].id
						requests.push(
							this.app
								.apiRequest(action, [nodeid], {
									infoSnack: false,
									errorSnack: false,
								})
								.then((response) => {
									if (response.success) {
										this.showSnackbar(
											`Node ${nodeid} api request success`,
											'success'
										)
									} else {
										this.showSnackbar(
											`Node ${nodeid} error: ${response.error}`,
											'error'
										)
									}
								})
						)
					}

					await Promise.allSettled(requests)
				} else {
					const response = await this.app.apiRequest(action, args)

					if (response.success) {
						switch (response.api) {
							case 'getDriverStatistics':
								this.$listeners.showConfirm(
									'Driver statistics',
									this.jsonToList(response.result)
								)
								break
							case 'getNodeStatistics':
								this.$listeners.showConfirm(
									'Node statistics',
									this.jsonToList(response.result)
								)
								break
							case 'backupNVMRaw':
								{
									this.showSnackbar(
										'NVM Backup DONE. You can find your file NVM_<date>.bin in store directory',
										'success'
									)
									const { result } = response
									this.$listeners.export(
										result.data,
										result.fileName,
										'bin'
									)
								}
								break
							case 'restoreNVM':
								this.showSnackbar('NVM restore DONE', 'success')
								break
							case 'firmwareUpdateOTW': {
								// handled in App.vue
								break
							}
							case 'updateFirmware': {
								const result = response.result

								const title = `Firmware update ${
									result.success ? 'success' : 'failed'
								}`

								let message = ''

								if (result.success) {
									if (
										result.status ===
										FirmwareUpdateStatus.OK_WaitingForActivation
									) {
										message =
											'<p>The firmware must be activated <b>manually</b>, likely by pushing a button on the device.</p>'
									} else if (
										result.status ===
										FirmwareUpdateStatus.OK_RestartPending
									) {
										message = `<p>The device will now restart.${
											result.waitTime
												? ` This will take approximately <b>${result.waitTime}</b> seconds.`
												: ''
										}</p>`
									} else if (
										// status is OK_NoRestart
										result.waitTime &&
										!result.reInterview
									) {
										message = `<p>Please wait <b>${result.waitTime}</b> seconds before interacting with the device again.<p>`
									}

									if (result.reInterview) {
										if (result.waitTime) {
											message +=
												'<p>Afterwards the device will be <b>re-interviewed</b>.<p>'
										} else {
											message +=
												'<p>The device will now be <b>re-interviewed</b>.<p>'
										}

										message +=
											'<p>Wait until the interview is done before interacting with the device again.<p/>'
									}
								} else {
									switch (result.status) {
										case FirmwareUpdateStatus.Error_Timeout:
											message =
												'There was a timeout during the firmware update.'
											break
										case FirmwareUpdateStatus.Error_Checksum:
											message = 'Invalid checksum'
											break
										case FirmwareUpdateStatus.Error_TransmissionFailed:
											message =
												'The transmission failed or was aborted'
											break
										case FirmwareUpdateStatus.Error_InvalidManufacturerID:
											message =
												'The manufacturer ID is invalid'
											break
										case FirmwareUpdateStatus.Error_InvalidFirmwareID:
											message =
												'The firmware ID is invalid'
											break
										case FirmwareUpdateStatus.Error_InvalidFirmwareTarget:
											message =
												'The firmware target is invalid'
											break
										case FirmwareUpdateStatus.Error_InvalidHeaderInformation:
										case FirmwareUpdateStatus.Error_InvalidHeaderFormat:
											message =
												'The firmware header is invalid'
											break
										case FirmwareUpdateStatus.Error_InsufficientMemory:
											message =
												'The device does not have enough memory to perform the firmware update'
											break
										case FirmwareUpdateStatus.Error_InvalidHardwareVersion:
											message =
												'The hardware version is invalid'
											break
									}
								}

								this.app.confirm(title, message, 'info', {
									confirmText: 'Ok',
									noCancel: true,
									color: result.success ? 'success' : 'error',
								})

								break
							}
							default:
								this.showSnackbar(
									`API ${response.api} ended successfully`,
									'success'
								)
						}
					} else {
						if (response.api === 'firmwareUpdateOTW') {
							// this could happen when the update fails before start
							// used to close the firmware update dialog
							if (this.controllerNode?.firmwareUpdate) {
								useBaseStore().updateNode(
									{
										id: this.controllerNode.id,
										firmwareUpdate: false,
										firmwareUpdateResult: {
											success: false,
											status: response.message,
										},
									},
									true
								)
							}
						}
					}
				}
			}
		},
		toggleControllerStatistics() {
			this.showControllerStatistics = !this.showControllerStatistics
		},
	},
	mounted() {
		this.bindEvent('healProgress', this.setHealProgress.bind(this))
	},
	beforeDestroy() {
		if (this.socket) {
			this.unbindEvents()
		}
	},
}
</script>
