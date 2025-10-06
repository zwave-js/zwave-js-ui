import { manager, instances } from '../lib/instanceManager'
import { socketEvents } from '@server/lib/SocketEvents.js'
import ConfigApis from '@/apis/ConfigApis'
import useBaseStore from '../stores/base.js'
import logger from '../lib/logger'
import { mapState } from 'pinia'

const log = logger.get('InstancesMixin')

export default {
	data() {
		return {
			bindedSocketEvents: {},
		}
	},
	computed: {
		...mapState(useBaseStore, ['nodes', 'controllerNode']),
		app() {
			return manager.getInstance(instances.APP)
		},
	},
	methods: {
		bindEvent(eventName, handler) {
			this.socket.on(socketEvents[eventName], handler)
			this.bindedSocketEvents[eventName] = handler
		},
		unbindEvents() {
			for (const event in this.bindedSocketEvents) {
				this.socket.off(
					socketEvents[event],
					this.bindedSocketEvents[event],
				)
			}

			this.bindedSocketEvents = {}
		},
		async pingNode(node) {
			const response = await this.app.apiRequest('pingNode', [node.id], {
				infoSnack: true,
				errorSnack: false,
			})

			if (response.success && response.result) {
				this.showSnackbar(
					`Ping of node ${node.id} successful`,
					'success',
				)
			} else {
				this.showSnackbar(
					`Error pinging node ${node.id}: ${
						!response.success
							? response.message
							: 'no response to ping'
					}`,
					'error',
				)
			}
		},
		async rebuildNodeRoutes(node) {
			const shouldWarn =
				node.applicationRoute ||
				node.customSUCReturnRoutes?.length > 0 ||
				node.prioritySUCReturnRoute

			if (shouldWarn) {
				const confirmed = await this.app.confirm(
					'Priority/Custom return routes configured',
					`The node has priority/custom return routes configured, healing it will reset them. Are you sure you want to continue?`,
					'warning',
					{
						width: 600,
					},
				)

				if (!confirmed) {
					return
				}
			}
			const response = await this.app.apiRequest(
				'rebuildNodeRoutes',
				[node.id],
				{
					infoSnack: true,
					errorSnack: false,
				},
			)

			if (response.success && response.result) {
				this.showSnackbar(
					`Routes of node ${node.id} has been rebuilt successfully`,
					'success',
				)
			} else {
				this.showSnackbar(
					`Error while rebuilding node ${node.id} routes: ${
						!response.success
							? response.message
							: 'failed to rebuild node routes'
					}`,
					'error',
				)
			}
		},
		async sendAction(
			action,
			{ nodeId, broadcast, confirm, confirmLevel, nodes },
		) {
			if (action) {
				if (confirm) {
					const ok = await this.app.confirm(
						'Info',
						confirm,
						confirmLevel || 'info',
						{
							cancelText: 'cancel',
							confirmText: 'ok',
							width: 900,
						},
					)

					if (!ok) {
						return
					}
				}

				if (nodes?.length > 0) {
					const requests = nodes.map((node) =>
						this.app.apiRequest(action, [node.id]),
					)

					await Promise.allSettled(requests)
					this.showSnackbar(
						`Action ${action} sent to all nodes`,
						'success',
					)
					return
				}

				let args = []
				if (nodeId !== undefined) {
					if (!broadcast) {
						if (isNaN(nodeId)) {
							this.showSnackbar(
								'Node ID must be an integer value',
								'error',
							)
							return
						}
						args.push(parseInt(nodeId))
					}
				}

				if (action === 'startInclusion') {
					const secure = await this.app.confirm(
						'Node inclusion',
						'Start inclusion in secure mode?',
						'info',
						{
							cancelText: 'No',
						},
					)
					args.push(secure)
				} else if (action === 'hardReset') {
					const { confirm } = await this.app.confirm(
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
						},
					)
					if (!confirm || confirm !== 'yes') {
						return
					}
				} else if (action === 'beginRebuildingRoutes') {
					const { includeSleeping, deletePriorityReturnRoutes } =
						await this.app.confirm(
							'Info',
							'Rebuilding routes causes a lot of traffic, can take minutes up to hours and users have to expect degraded performance while it is going on',
							'info',
							{
								confirmText: 'Rebuild',
								inputs: [
									{
										type: 'checkbox',
										label: 'Include sleeping nodes',
										key: 'includeSleeping',
										default: false,
									},
									{
										type: 'checkbox',
										label: 'Delete priority return routes',
										key: 'deletePriorityReturnRoutes',
										default: false,
									},
								],
							},
						)
					if (includeSleeping === undefined) {
						return
					}
					args.push({ includeSleeping, deletePriorityReturnRoutes })
				} else if (action === 'firmwareUpdateOTW') {
					const result = await this.app.confirm(
						'Firmware update OTW',
						`<h3 class="text-error">We don't take any responsibility if devices upgraded using Z-Wave JS don't work after an update. Always double-check that the correct update is about to be installed.</h3>
						<h3 class="mt-2 text-error">A failure during this process may leave your controller in recovery mode, rendering it unusable until a correct firmware image is uploaded. In case of 500 series controllers a failure on this process is likely unrecoverable.</h3>
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
						},
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
							true,
						)
					} catch (error) {
						this.showSnackbar(
							'Error reading file: ' + error.message,
							'error',
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
							accept: '.bin,.exe,.ex_,.hex,.gbl,.otz,.ota,.hec,.zip',
						}

						const targetInput = {
							type: 'list',
							cols: 4,
							allowManualEntry: true,
							label: 'Target',
							hint: 'Target to update',
							key: 'target',
							items: targets.map((t) => ({
								title: 'Target ' + t,
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

						const result = await this.app.confirm(
							'Firmware update',
							`
								<b>ID:</b> ${node.id}<br>
								<b>Name:</b> ${node._name}<br>
								<b>Manufacturer:</b> ${node.manufacturer}<br>
								<b>Product:</b> ${node.productDescription} (${node.productLabel})<br>
								<b>Current Firmware:</b> ${node.firmwareVersion}<br>
								<b>Current SDK:</b> ${node.sdkVersion || '---'}<br>
							`,
							'info',
							{
								confirmText: 'Ok',
								width: 500,
								inputs,
							},
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
					await this.app.confirm('Driver function', '', 'info', {
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
									const response = await this.app.apiRequest(
										action,
										[values.code],
									)

									if (response.success) {
										this.showSnackbar(
											'Function executed successfully, check console for result',
											'success',
										)
									}

									log.info(
										'Driver function result:',
										response.result,
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
					})

					return
				} else if (action === 'backupNVMRaw') {
					const confirm = await this.app.confirm(
						'NVM Backup',
						'While doing the backup the Z-Wave radio will be turned on/off',
						'alert',
						{
							confirmText: 'Ok',
						},
					)
					if (!confirm) {
						return
					}
				} else if (action === 'restoreNVM') {
					const result = await this.app.confirm(
						'NVM Restore',
						'While doing the restore the Z-Wave radio will be turned on/off.\n<strong>A failure during this process may brick your controller. Use at your own risk!</strong>',
						'alert',
						{
							confirmText: 'Ok',
							width: 500,
							inputs: [
								{
									type: 'file',
									label: 'File',
									hint: 'NVM file',
									key: 'file',
								},
								{
									type: 'checkbox',
									label: 'Skip compatibility check',
									hint: 'This needs to be checked in order to allow restoring NVM backups on older controllers, with the risk of restoring an incompatible backup',
									key: 'useRaw',
								},
							],
						},
					)
					if (!result?.file) {
						return
					}

					try {
						const data = await result.file.arrayBuffer()
						args.push(data, result.useRaw)
					} catch (error) {
						return
					}
				} else if (action === 'refreshInfo') {
					const options = await this.app.confirm(
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
						},
					)

					if (!options || Object.keys(options).length === 0) {
						return
					}

					args.push(options)
				} else if (action === 'replaceFailedNode') {
					// open nodes manager dialog
					this.app.showNodesManager({
						action: { action: 1 },
						replaceFailed: { replaceId: nodeId },
						replaceInclusionMode: { inclusionMode: 0 },
					})
					return
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
											'success',
										)
									} else {
										this.showSnackbar(
											`Node ${nodeid} error: ${response.error}`,
											'error',
										)
									}
								}),
						)
					}

					await Promise.allSettled(requests)
				} else {
					const response = await this.app.apiRequest(action, args)

					if (response.success) {
						switch (response.api) {
							case 'getDriverStatistics':
								this.app.confirm(
									'Driver statistics',
									this.jsonToList(response.result),
								)
								break
							case 'getNodeStatistics':
								this.app.confirm(
									'Node statistics',
									this.jsonToList(response.result),
								)
								break
							case 'backupNVMRaw':
								{
									this.showSnackbar(
										'NVM Backup DONE. You can find your file NVM_<date>.bin in store directory',
										'success',
									)
									const { result } = response
									this.app.exportConfiguration(
										result.data,
										result.fileName,
										'bin',
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
							case 'updateFirmware':
								this.app.handleFwUpdateResponse(response)
								break

							case 'dumpNode':
								this.app.exportConfiguration(
									response.result,
									'node_' + response.result.id + '_dump',
									'json',
								)
								break

							default:
								this.showSnackbar(
									`API ${response.api} ended successfully`,
									'success',
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
									true,
								)
							}
						}
					}
				}
			}
		},
	},
}
