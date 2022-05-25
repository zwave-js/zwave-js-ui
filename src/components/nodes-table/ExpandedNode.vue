<template>
	<td :colspan="isMobile ? 1 : headers.length">
		<v-row class="d-flex mt-2" align="center">
			<v-col class="flex-grow-1 flex-shrink-0 ml-4">
				<span class="title grey--text">Device ID </span>
				<br />
				<span class="subtitle font-weight-bold font-monospace">
					{{ `${node.deviceId} (${node.hexId})` }}
				</span>
				<v-icon @click="openLink(node.dbLink)" class="ml-2" small>
					ios_share
				</v-icon>
			</v-col>
			<v-col class="text-end flex-shrink-1">
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
						color="primary"
						@click.stop="forwardApiRequest('pingNode', [node.id])"
						depressed
					>
						Ping
					</v-btn>
					<v-btn
						dark
						color="green"
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
						:actions="actions"
						:socket="socket"
						v-on="$listeners"
					></node-details>
				</v-tab-item>

				<!-- TAB NODE -->
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
						<h1 class="capitalize">{{ meta }}</h1>
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
					<home-assistant
						:node="node"
						:socket="socket"
						v-on="$listeners"
					/>
				</v-tab-item>

				<!-- TAB GROUPS -->
				<v-tab-item key="groups" transition="slide-y-transition">
					<association-groups :node="node" :socket="socket" />
				</v-tab-item>

				<!-- TAB EVENTS -->
				<v-tab-item key="events" transition="slide-y-transition">
					<v-container grid-list-md>
						<v-text-field
							v-model="searchEvents"
							prepend-icon="search"
							label="Filter"
							class="pa-3"
							single-line
							hide-details
							style="max-width: 300px"
							clearable
						/>

						<v-col
							class="pa-5"
							style="
								max-height: 500px;
								height: 500px;
								overflow-y: scroll;
								border: 1px solid #ccc;
							"
						>
							<div
								v-for="(event, index) in filteredNodeEvents"
								:key="'event_' + index + event.time"
							>
								<span
									><i>{{
										new Date(event.time).toLocaleString()
									}}</i></span
								>
								<strong class="text-uppercase">{{
									event.event
								}}</strong>
								<span
									class="text-caption"
									style="white-space: pre"
									v-for="(arg, i) in event.args"
									:key="'arg_' + i"
									>{{ jsonToList(arg) }}</span
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
					<v-textarea
						class="debug-content font-monospace mx-2"
						rows="15"
						append-icon="content_copy"
						v-model="nodeJson"
						readonly
						ref="nodeJsonContent"
						@click:append="copyText"
					></v-textarea>
				</v-tab-item>
			</v-tabs-items>
		</v-tabs>

		<DialogAdvanced
			v-model="advancedShowDialog"
			@close="advancedShowDialog = false"
			:actions="advancedActions"
			@action="nodeAction"
		/>
	</td>
</template>

<script>
import AssociationGroups from '@/components/nodes-table/AssociationGroups'
import HomeAssistant from '@/components/nodes-table/HomeAssistant'
import NodeDetails from '@/components/nodes-table/NodeDetails'
import DialogAdvanced from '@/components/dialogs/DialogAdvanced'
import StatisticsCard from '@/components/custom/StatisticsCard.vue'
import { jsonToList } from '@/lib/utils'

import { mapGetters } from 'vuex'

export default {
	props: {
		actions: Array,
		headers: Array,
		isMobile: Boolean,
		node: Object,
		socket: Object,
	},
	components: {
		AssociationGroups,
		HomeAssistant,
		NodeDetails,
		DialogAdvanced,
		StatisticsCard,
	},
	computed: {
		...mapGetters(['gateway', 'mqtt']),
		nodeMetadata() {
			return this.node.deviceConfig?.metadata
		},
		nodeComments() {
			const comments = this.nodeMetadata?.comments ?? []

			return Array.isArray(comments) ? comments : [comments]
		},
		metaKeys() {
			const helpKeys = ['manual', 'inclusion', 'exclusion', 'reset']
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
			return this.node.eventsQueue.filter((event) => {
				return (
					!this.searchEvents ||
					JSON.stringify(event)
						.toLowerCase()
						.includes(this.searchEvents.toLowerCase())
				)
			})
		},
	},
	data() {
		return {
			currentTab: 0,
			searchEvents: '',
			advancedShowDialog: false,
			showStatistics: false,
			advancedActions: [
				{
					text: 'Export json',
					options: [{ name: 'Export', action: 'exportNode' }],
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
				{
					text: 'Firmware update',
					options: [
						{ name: 'Begin', action: 'beginFirmwareUpdate' },
						{ name: 'Abort', action: 'abortFirmwareUpdate' },
					],
					icon: 'update',
					desc: 'Start/Stop a firmware update',
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
						{ name: 'Check', action: 'isFailedNode' },
						{ name: 'Remove', action: 'removeFailedNode' },
					],
					icon: 'dangerous',
					desc: 'Manage nodes that are dead and/or marked as failed with the controller',
				},
				{
					text: 'Associations',
					options: [
						{
							name: 'Clear',
							action: 'removeAllAssociations',
							args: {
								confirm:
									"This action will remove all associations of this node. This will also clear lifeline association with controller node, the node won't report state changes until that is set up again",
							},
						},
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
					desc: 'Clear all node associations / Remove node from all associations',
				},
			],
		}
	},
	methods: {
		jsonToList,
		linkify(text) {
			var urlRegex =
				/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi
			return text.replace(urlRegex, function (url) {
				return '<a href="' + url + '">' + url + '</a>'
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
				this.$emit('action', action, { ...args, nodeId: this.node.id })
			}
		},
		toggleStatistics() {
			this.showStatistics = !this.showStatistics
		},
		openLink(link) {
			window.open(link, '_blank')
		},
		forwardApiRequest(apiName, args) {
			this.$refs.nodeDetails.apiRequest(apiName, args)
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
	font-family: 'Fira Code', monospace;
}

.capitalize {
	text-transform: capitalize;
}
</style>
