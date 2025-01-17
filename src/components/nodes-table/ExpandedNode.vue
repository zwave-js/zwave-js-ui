<template>
	<div
		:style="`max-width: calc(100vw - ${
			$vuetify.breakpoint.lgAndUp ? 120 : 70
		}px)`"
		v-if="node"
	>
		<v-row class="mt-2" align="center">
			<v-col style="min-width: 200px" class="ml-4">
				<span class="title grey--text">Device </span>
				<br />
				<span class="subtitle font-weight-bold font-monospace">
					{{ node.hexId }}
				</span>

				<v-icon @click="openLink(node.dbLink)" class="ml-2">
					open_in_new
				</v-icon>
				<br />
				<span
					v-if="$vuetify.breakpoint.smAndDown"
					class="comment font-weight-bold primary--text"
				>
					{{
						`${node.manufacturer || ''}${
							node.productDescription
								? ' - ' + node.productDescription
								: ''
						}`
					}}
				</span>
			</v-col>
			<v-col
				:class="
					$vuetify.breakpoint.smAndDown ? 'text-center' : 'text-end'
				"
			>
				<v-item-group class="v-btn-toggle">
					<v-btn color="primary" outlined @click="toggleStatistics">
						<v-icon left>
							{{ statisticsOpeningIndicator }}
						</v-icon>
						Statistics
						<v-icon color="primary" right> multiline_chart </v-icon>
					</v-btn>
					<v-btn
						dark
						v-if="!node.isControllerNode"
						color="primary"
						@click.stop="pingNode(node)"
						depressed
					>
						Ping
					</v-btn>
					<v-btn
						dark
						color="success"
						depressed
						@click="advancedShowDialog = true"
					>
						Advanced
					</v-btn>
				</v-item-group>
			</v-col>
		</v-row>

		<v-row v-if="nodeComments.length > 0">
			<v-col>
				<v-alert
					v-for="c in nodeComments"
					:key="c.level"
					text
					style="white-space: break-spaces"
					:type="c.level"
				>
					<span v-html="linkify(c.text)"></span>
				</v-alert>
			</v-col>
		</v-row>

		<v-row no-gutters>
			<v-sheet v-if="showStatistics" class="my-4" outlined rounded>
				<statistics-card title="Statistics" :node="node" />
			</v-sheet>
		</v-row>

		<v-divider class="my-4" />

		<v-tabs
			v-model="currentTab"
			show-arrows
			class="transparent mb-4"
			:vertical="$vuetify.breakpoint.mdAndUp"
		>
			<v-tab class="justify-start" key="node">
				<v-icon small left>widgets</v-icon> Node
			</v-tab>
			<v-tab v-if="nodeMetadata" class="justify-start" key="manual">
				<v-icon small left>help</v-icon> Help
			</v-tab>
			<v-tab v-if="showHass" class="justify-start" key="homeassistant">
				<v-icon small left>home</v-icon> Home Assistant
			</v-tab>
			<v-tab key="groups" class="justify-start">
				<v-icon small left>device_hub</v-icon> Groups
			</v-tab>
			<v-tab v-if="node.schedule" key="users" class="justify-start">
				<v-icon small left>group</v-icon> Users
			</v-tab>
			<v-tab
				key="ota"
				v-if="!node.isControllerNode"
				class="justify-start"
			>
				<v-icon small left>auto_mode</v-icon> OTA Updates
			</v-tab>
			<v-tab key="events" class="justify-start">
				<v-icon small left>list_alt</v-icon> Events
			</v-tab>
			<v-tab
				v-if="$vuetify.breakpoint.mdAndUp"
				class="justify-start"
				key="debug"
			>
				<v-icon small left>bug_report</v-icon> Debug Info
			</v-tab>

			<!-- TABS -->
			<v-tabs-items
				style="background: transparent; padding-bottom: 10px"
				touchless
				v-model="currentTab"
			>
				<!-- TAB NODE -->
				<v-tab-item key="node" transition="slide-y-transition">
					<node-details
						ref="nodeDetails"
						:headers="headers"
						:node="node"
						@updateValue="updateValue"
					></node-details>
				</v-tab-item>

				<!-- TAB METADATA -->
				<v-tab-item
					v-if="nodeMetadata"
					key="manual"
					transition="slide-y-transition"
				>
					<section
						v-for="meta in metaKeys"
						:key="`tab-${meta}`"
						class="px-8 py-4"
					>
						<h1 class="text-uppercase">{{ meta }}</h1>
						<p class="caption">
							<v-btn
								v-if="meta === 'manual'"
								:href="nodeMetadata[meta]"
								color="primary"
							>
								DOWNLOAD
							</v-btn>
							<span v-else>
								{{ nodeMetadata[meta] }}
							</span>
						</p>
					</section>
				</v-tab-item>

				<!-- TAB HOMEASSISTANT -->
				<v-tab-item
					v-if="showHass"
					key="homeassistant"
					transition="slide-y-transition"
				>
					<home-assistant :node="node" :socket="socket" />
				</v-tab-item>

				<!-- TAB GROUPS -->
				<v-tab-item key="groups" transition="slide-y-transition">
					<association-groups :node="node" />
				</v-tab-item>

				<!-- TAB USERS -->
				<v-tab-item
					v-if="node.schedule"
					key="users"
					transition="slide-y-transition"
				>
					<user-code-table :node="node" @updateValue="updateValue" />
				</v-tab-item>

				<!-- TAB OTA UPDATES -->
				<v-tab-item
					v-if="!node.isControllerNode"
					key="ota"
					transition="slide-y-transition"
				>
					<OTAUpdates :node="node" :socket="socket" />
				</v-tab-item>

				<!-- TAB EVENTS -->
				<v-tab-item key="events" transition="slide-y-transition">
					<v-container grid-list-md>
						<v-text-field
							v-model="searchEvents"
							prepend-icon="search"
							label="Search"
							class="pa-3"
							single-line
							hide-details
							style="max-width: 300px"
							clearable
						>
							<template slot="append-outer">
								<v-tooltip v-if="!inverseSort" bottom>
									<template v-slot:activator="{ on, attrs }">
										<v-btn
											@click="toggleAutoScroll()"
											icon
											:color="autoScroll ? 'primary' : ''"
											:class="
												autoScroll
													? 'border-primary'
													: ''
											"
											v-bind="attrs"
											v-on="on"
										>
											<v-icon>autorenew</v-icon>
										</v-btn>
									</template>
									<span>Enable/Disable auto scroll</span>
								</v-tooltip>

								<v-tooltip bottom>
									<template v-slot:activator="{ on, attrs }">
										<v-btn
											@click="toggleSort()"
											icon
											:color="
												inverseSort ? 'primary' : ''
											"
											:class="
												inverseSort
													? 'border-primary'
													: ''
											"
											v-bind="attrs"
											v-on="on"
										>
											<v-icon>swap_vert</v-icon>
										</v-btn>
									</template>
									<span>Inverse Sort</span>
								</v-tooltip>
							</template>
						</v-text-field>

						<v-col ref="eventsList" class="pa-5 events-list">
							<div
								v-for="(event, index) in filteredNodeEvents"
								:key="'event_' + index + event.time"
								class="log-row font-monospace"
							>
								<span
									><i>{{
										getDateTimeString(event.time)
									}}</i></span
								>
								-
								<strong class="text-uppercase">{{
									event.event
								}}</strong>

								<span
									style="white-space: pre; font-size: 0.75rem"
									v-for="(arg, i) in event.args"
									:key="'arg_' + i"
									>{{ prettyPrintEventArg(arg, i) }}</span
								>
							</div>
						</v-col>
					</v-container>
				</v-tab-item>

				<!-- TAB DEBUG INFO -->
				<v-tab-item
					v-if="$vuetify.breakpoint.mdAndUp"
					key="debug"
					transition="slide-y-transition"
				>
					<v-container grid-list-md>
						<v-textarea
							class="debug-content font-monospace mx-2"
							append-icon="content_copy"
							v-model="nodeJson"
							readonly
							hide-details
							no-resize
							rows="37"
							ref="nodeJsonContent"
							@click:append="copyText"
						></v-textarea>
					</v-container>
				</v-tab-item>
			</v-tabs-items>
		</v-tabs>

		<DialogAdvanced
			v-model="advancedShowDialog"
			@close="advancedShowDialog = false"
			:actions="advancedActions"
			@action="nodeAction"
		/>
	</div>
</template>

<script>
import { jsonToList } from '@/lib/utils'
import { mapActions, mapState } from 'pinia'
import useBaseStore from '../../stores/base.js'
import { inboundEvents as socketActions } from '@server/lib/SocketEvents'
import InstancesMixin from '../../mixins/InstancesMixin.js'

import {
	SetValueStatus,
	setValueWasUnsupervisedOrSucceeded,
} from '@zwave-js/cc/safe'
import { Protocols } from '@zwave-js/core/safe'

export default {
	props: {
		actions: Array,
		headers: {
			type: Array,
			default: () => [],
		},
		isMobile: Boolean,
		node: Object,
		socket: Object,
	},
	mixins: [InstancesMixin],
	components: {
		AssociationGroups: () =>
			import('@/components/nodes-table/AssociationGroups.vue'),
		HomeAssistant: () =>
			import('@/components/nodes-table/HomeAssistant.vue'),
		NodeDetails: () => import('@/components/nodes-table/NodeDetails.vue'),
		DialogAdvanced: () => import('@/components/dialogs/DialogAdvanced.vue'),
		StatisticsCard: () => import('@/components/custom/StatisticsCard.vue'),
		OTAUpdates: () => import('./OTAUpdates.vue'),
		UserCodeTable: () => import('./UserCodeTable.vue'),
	},
	computed: {
		...mapState(useBaseStore, ['gateway', 'mqtt']),
		isLongRange() {
			if (!this.node) return false

			return this.node.protocol === Protocols.ZWaveLongRange
		},
		nodeMetadata() {
			return this.node.deviceConfig?.metadata
		},
		nodeComments() {
			const comments = this.nodeMetadata?.comments ?? []

			return Array.isArray(comments) ? comments : [comments]
		},
		metaKeys() {
			const helpKeys = [
				'manual',
				'inclusion',
				'exclusion',
				'reset',
				'wakeup',
			]
			const keys = this.nodeMetadata ? Object.keys(this.nodeMetadata) : []

			return keys.filter((key) => helpKeys.includes(key))
		},
		nodeJson() {
			return JSON.stringify(this.node, null, 2)
		},
		showHass() {
			return (
				!this.mqtt.disabled &&
				this.gateway.hassDiscovery &&
				this.node.hassDevices &&
				Object.keys(this.node.hassDevices).length > 0
			)
		},
		statisticsOpeningIndicator() {
			return this.showStatistics ? 'arrow_drop_up' : 'arrow_drop_down'
		},
		statsBorderColor() {
			return this.showStatistics ? 'border-primary' : ''
		},
		filteredNodeEvents() {
			return this.node.eventsQueue
				.filter((event) => {
					return (
						!this.searchEvents ||
						JSON.stringify(event)
							.toLowerCase()
							.includes(this.searchEvents.toLowerCase())
					)
				})
				.sort((a, b) => {
					a = new Date(a.time)
					b = new Date(b.time)
					return this.inverseSort ? b - a : a - b
				})
		},
		advancedActions() {
			const nodeActions = this.node.isControllerNode
				? [
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
					]
				: [
						{
							text: 'Firmware update',
							options: [
								{
									name: 'Begin',
									action: 'updateFirmware',
								},
								{
									name: 'Abort',
									action: 'abortFirmwareUpdate',
								},
							],
							icon: 'update',
							color: 'error',
							desc: 'Start/Stop a firmware update',
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
							text: 'Failed Nodes',
							options: [
								{ name: 'Remove', action: 'removeFailedNode' },
								{
									name: 'Replace',
									action: 'replaceFailedNode',
								},
							],
							color: 'error',
							icon: 'dangerous',
							desc: 'Manage nodes that are dead and/or marked as failed with the controller',
						},
					]

			if (this.node.protocol !== Protocols.ZWaveLongRange) {
				nodeActions.splice(1, 0, {
					text: 'Rebuild Routes',
					options: [
						{
							name: 'Rebuild',
							action: 'rebuildNodeRoutes',
							args: {
								confirm:
									'Rebuilding node routes causes a lot of traffic, can take minutes up to hours and you can expect degraded performance while it is going on',
							},
						},
					],
					icon: 'healing',
					color: 'warning',
					desc: 'Discover and assign new routes from node to the controller and other nodes.',
				})
			}

			const nodeAssociation = this.node.isControllerNode
				? []
				: [
						{
							name: 'Clear',
							action: 'removeAllAssociations',
							color: 'error',
							args: {
								confirm:
									"This action will remove all associations of this node. This will also clear lifeline association with controller node, the node won't report state changes until that is set up again",
							},
						},
					]

			const CCActions = []

			if (this.node.supportsTime) {
				CCActions.push({
					text: 'Set Date and Time',
					options: [
						{
							name: 'Sync',
							action: 'syncNodeDateAndTime',
						},
					],
					icon: 'schedule',
					desc: 'Set date and time of this node to current time',
				})
			}

			return [
				{
					text: 'Export json',
					options: [
						{ name: 'UI', action: 'exportNode' },
						{ name: 'Driver', action: 'dumpNode' },
					],
					icon: 'get_app',
					desc: 'Export this node in a json file',
				},
				{
					text: 'Clear Retained',
					options: [
						{
							name: 'Clear',
							action: 'removeNodeRetained',
							args: {
								mqtt: true,
								confirm:
									'Are you sure you want to remove all retained messages?',
							},
						},
					],
					icon: 'clear',
					desc: 'All retained messages of this node will be removed from broker',
				},
				{
					text: 'Update topics',
					options: [
						{
							name: 'Update',
							action: 'updateNodeTopics',
							args: {
								mqtt: true,
								confirm:
									'Are you sure you want to update all topics?',
							},
						},
					],
					icon: 'update',
					desc: 'Update all node topics. Useful when name/location has changed',
				},
				...nodeActions,
				{
					text: 'Associations',
					options: [
						...nodeAssociation,
						{
							name: 'Remove',
							action: 'removeNodeFromAllAssociations',
							args: {
								confirm:
									'All direct associations to this node will be removed. Battery-powered nodes need to be woken up to edit their associations.',
							},
						},
					],
					icon: 'link_off',
					color: 'error',
					desc: 'Clear all node associations / Remove node from all associations',
				},
				...CCActions,
			]
		},
	},
	watch: {
		'node.eventsQueue'() {
			this.scrollBottom()
		},
		currentTab() {
			this.scrollBottom()
		},
		inverseSort() {
			this.savePreferences()
		},
		autoScroll() {
			this.savePreferences()
		},
	},
	data() {
		return {
			currentTab: 0,
			autoScroll: true,
			inverseSort: true,
			searchEvents: '',
			advancedShowDialog: false,
			showStatistics: false,
		}
	},
	mounted() {
		const pref = useBaseStore().getPreference('eventsList', {
			inverseSort: true,
			autoScroll: true,
		})

		this.inverseSort = pref.inverseSort
		this.autoScroll = pref.autoScroll
	},
	methods: {
		...mapActions(useBaseStore, [
			'showSnackbar',
			'setValue',
			'getDateTimeString',
		]),
		savePreferences() {
			useBaseStore().savePreferences({
				eventsList: {
					inverseSort: this.inverseSort,
					autoScroll: this.autoScroll,
				},
			})
		},
		async updateValue(v, customValue) {
			if (v) {
				// in this way I can check when the value receives an update
				v.toUpdate = true

				if (v.type === 'number') {
					v.newValue = Number(v.newValue)
				}

				// it's a button
				if (v.type === 'boolean' && !v.readable) {
					v.newValue = true
				}

				if (customValue !== undefined) {
					v.newValue = customValue
				}

				// update the value in store
				this.setValue(v)

				const response = await this.app.apiRequest('writeValue', [
					{
						nodeId: v.nodeId,
						commandClass: v.commandClass,
						endpoint: v.endpoint,
						property: v.property,
						propertyKey: v.propertyKey,
					},
					v.newValue,
					this.options,
				])

				v.toUpdate = false

				if (response.success) {
					const result = response.result
					const success = setValueWasUnsupervisedOrSucceeded(result)
					if (success) {
						this.showSnackbar('Value updated', 'success')
					} else {
						let reason = result.message
						if (
							!reason &&
							result.status === SetValueStatus.NoDeviceSupport
						) {
							reason = 'No device support'
						}
						this.showSnackbar(
							'Value update failed' +
								(reason ? ': ' + reason : ''),
							'error',
						)
					}
				} else {
					this.showSnackbar(
						`Error updating value${
							response.message ? ': ' + response.message : ''
						}`,
						'error',
					)
				}
			}
		},
		prettyPrintEventArg(arg, index) {
			return `\nArg ${index}:\n` + jsonToList(arg, undefined, 1)
		},
		linkify(text) {
			var urlRegex =
				/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi
			return text.replace(urlRegex, function (url) {
				return '<a target="_blank" href="' + url + '">' + url + '</a>'
			})
		},
		copyText() {
			const textToCopy =
				this.$refs.nodeJsonContent.$el.querySelector('textarea')
			textToCopy.select()
			document.execCommand('copy')
		},
		nodeAction(action, args = {}) {
			if (action === 'exportNode') {
				this.exportNode()
			} else if (args.mqtt) {
				this.sendMqttAction(action, args.confirm)
			} else {
				this.sendAction(action, { ...args, nodeId: this.node.id })
			}
		},
		exportNode() {
			this.app.exportConfiguration(
				this.node,
				'node_' + this.node.id,
				'json',
			)
		},
		async sendMqttAction(action, confirmMessage) {
			if (this.node) {
				let ok = true

				if (confirmMessage) {
					ok = await this.app.confirm(
						'Info',
						confirmMessage,
						'info',
						{
							confirmText: 'Ok',
						},
					)
				}

				if (ok) {
					const args = [this.node.id]

					const data = {
						api: action,
						args: args,
					}
					this.socket.emit(socketActions.mqtt, data, (response) => {
						if (response.success) {
							this.showSnackbar(
								`Node ${this.node.id}: ${action} successfully sent `,
								'success',
							)
						} else {
							this.showSnackbar(
								`Error sending ${action} to node ${this.node.id}: ${response.message}`,
								'error',
							)
						}
					})
				}
			}
		},
		toggleStatistics() {
			this.showStatistics = !this.showStatistics
		},
		openLink(link) {
			window.open(link, '_blank')
		},
		toggleAutoScroll() {
			this.autoScroll = !this.autoScroll
		},
		toggleSort() {
			this.inverseSort = !this.inverseSort
		},
		async scrollBottom() {
			if (!this.autoScroll || this.inverseSort) {
				return
			}
			const el = this.$refs.eventsList
			if (el) {
				await this.$nextTick()
				el.scrollTop = el.scrollHeight
			}
		},
	},
}
</script>

<style>
.debug-content textarea {
	font-size: 0.75rem;
	line-height: 1.25 !important;
}
.font-monospace {
	font-family: 'Fira Code', monospace !important;
}

.events-list {
	max-height: 500px;
	height: 500px;
	overflow-y: scroll;
	border: 1px solid #ccc;
}

.log-row {
	cursor: default;
	padding: 0.5em 1em;
}

.log-row:nth-of-type(even) {
	background: var(--v-secondary-lighten5);
	color: #000;
}

.log-row:hover {
	outline: 1px solid var(--v-secondary-lighten4);
}
</style>
