<template>
	<v-container grid-list-md>
		<v-row class="mt-5" align="center">
			<v-subheader class="title">Device ID </v-subheader>
			<span class="subtitle font-weight-bold">{{
				`${node.deviceId} (${node.hexId})`
			}}</span>
			<v-icon @click="openLink(node.dbLink)" class="ml-2"
				>ios_share</v-icon
			>
		</v-row>

		<v-row>
			<v-col cols="8" style="max-width: 300px">
				<v-btn
					dark
					color="primary"
					@click.stop="apiRequest('pingNode', [node.id])"
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
			</v-col>
		</v-row>

		<v-row justify="start">
			<v-sheet outlined rounded>
				<statistics-card title="Statistics" :node="node" />
			</v-sheet>
		</v-row>

		<v-row>
			<v-col cols="12" sm="6" style="max-width: 300px">
				<v-text-field
					label="Name"
					append-outer-icon="send"
					:error="!!nameError"
					:error-messages="nameError"
					v-model.trim="newName"
					clearable
					clear-icon="refresh"
					@click:clear="resetName"
					@click:append-outer="updateName"
				></v-text-field>
			</v-col>

			<v-col cols="12" sm="6" style="max-width: 300px">
				<v-text-field
					label="Location"
					append-outer-icon="send"
					v-model.trim="newLoc"
					:error="!!locError"
					:error-messages="locError"
					clearable
					clear-icon="refresh"
					@click:clear="resetLocation"
					@click:append-outer="updateLoc"
				></v-text-field>
			</v-col>
		</v-row>

		<v-subheader class="title" style="padding: 0">Send Options</v-subheader>
		<v-row class="mt-0">
			<v-col cols="12" sm="6" style="max-width: 300px; padding-top: 0">
				<v-text-field
					label="Transition duration"
					hint="Ex: '10s' (10 seconds)"
					persistent-hint
					v-model.trim="options.transitionDuration"
				></v-text-field>
			</v-col>
			<v-col cols="12" sm="6" style="max-width: 300px; padding-top: 0">
				<v-text-field
					label="Volume"
					hint="The volume (for the Sound Switch CC)"
					persistent-hint
					v-model.trim="options.volume"
				></v-text-field>
			</v-col>
		</v-row>

		<!-- NODE VALUES -->

		<v-row>
			<v-subheader class="title">Values</v-subheader>

			<v-expansion-panels accordion multiple>
				<v-expansion-panel
					v-for="(group, className) in commandGroups"
					:key="className"
				>
					<v-expansion-panel-header>
						<v-row no-gutters>
							<v-col align-self="center">
								{{ className }}
							</v-col>
							<v-col class="text-right pr-5">
								<v-btn
									v-if="group[0]"
									@click.stop="
										apiRequest('refreshCCValues', [
											node.id,
											group[0].commandClass,
										])
									"
									x-small
								>
									Refresh
								</v-btn>
							</v-col>
						</v-row>
					</v-expansion-panel-header>
					<v-expansion-panel-content>
						<v-card flat>
							<v-card-text>
								<v-row>
									<v-col
										cols="12"
										v-for="(v, index) in group"
										:key="index"
										sm="6"
										md="4"
									>
										<ValueID
											@updateValue="updateValue"
											v-model="group[index]"
										></ValueID>
									</v-col>
								</v-row>
								<v-col
									v-if="className.startsWith('Configuration')"
									cols="12"
									sm="6"
									md="4"
									style="padding-left: 0"
								>
									<v-subheader class="valueid-label"
										>Custom Configuration
									</v-subheader>
									<v-row>
										<v-col cols="3">
											<v-text-field
												label="Parameter"
												v-model.number="
													configCC.parameter
												"
											/>
										</v-col>
										<v-col cols="3">
											<v-select
												label="Size"
												:items="[1, 2, 3, 4]"
												v-model.number="
													configCC.valueSize
												"
											/>
										</v-col>
										<v-col cols="3">
											<v-text-field
												label="Value"
												v-model.number="configCC.value"
											/>
										</v-col>
										<v-col cols="3">
											<v-btn
												width="60px"
												@click.stop="
													apiRequest('sendCommand', [
														{
															nodeId: node.id,
															commandClass: 112,
														},
														'get',
														[configCC.parameter],
													])
												"
												color="green"
												x-small
											>
												GET
											</v-btn>
											<v-btn
												width="60px"
												@click.stop="
													apiRequest('sendCommand', [
														{
															nodeId: node.id,
															commandClass: 112,
														},
														'set',
														[
															configCC.parameter,
															configCC.value,
															configCC.valueSize,
														],
													])
												"
												color="primary"
												x-small
											>
												SET
											</v-btn>
										</v-col>
									</v-row>
								</v-col>
							</v-card-text>
						</v-card>
					</v-expansion-panel-content>
					<v-divider></v-divider>
				</v-expansion-panel>
			</v-expansion-panels>
		</v-row>

		<DialogAdvanced
			v-model="advancedShowDialog"
			@close="advancedShowDialog = false"
			:actions="actions"
			@action="nodeAction"
		/>
	</v-container>
</template>

<script>
import ValueID from '@/components/ValueId'
import DialogAdvanced from '@/components/dialogs/DialogAdvanced'

import { inboundEvents as socketActions } from '@/plugins/socket'
import { mapMutations, mapGetters } from 'vuex'
import { validTopic } from '@/lib/utils'
import StatisticsCard from '@/components/custom/StatisticsCard.vue'

export default {
	props: {
		headers: Array,
		node: Object,
		socket: Object,
	},
	components: {
		ValueID,
		DialogAdvanced,
		StatisticsCard,
	},
	data() {
		return {
			locError: null,
			nameError: null,
			options: {},
			newName: this.node.name,
			newLoc: this.node.loc,
			advancedShowDialog: false,
			configCC: {
				value: 0,
				valueSize: 1,
				parameter: 1,
			},
			actions: [
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
	computed: {
		...mapGetters(['mqtt']),
		commandGroups() {
			if (this.node) {
				const groups = {}
				let addConfiguration = true

				for (const v of this.node.values) {
					const className =
						v.commandClassName + ' v' + v.commandClassVersion
					if (!groups[className]) {
						if (v.commandClassName === 'Configuration') {
							addConfiguration = false
						}
						groups[className] = []
					}
					groups[className].push(v)
				}

				// add empty confgiguration CC group
				if (addConfiguration) {
					groups.Configuration = []
				}

				return groups
			} else {
				return {}
			}
		},
	},
	watch: {
		node() {
			this.newName = this.node.name
			this.newLoc = this.node.loc
		},
		newLoc(val) {
			this.locError = this.validateTopic(val)
		},
		newName(val) {
			this.nameError = this.validateTopic(val)
		},
	},
	methods: {
		...mapMutations(['showSnackbar']),
		nodeAction(action, args = {}) {
			if (action === 'exportNode') {
				this.exportNode()
			} else if (args.mqtt) {
				this.sendMqttAction(action, args.confirm)
			} else {
				this.$emit('action', action, { ...args, nodeId: this.node.id })
			}
		},
		openLink(link) {
			window.open(link, '_blank')
		},
		apiRequest(apiName, args) {
			if (this.socket.connected) {
				const data = {
					api: apiName,
					args: args,
				}
				this.socket.emit(socketActions.zwave, data)
			} else {
				this.showSnackbar('Socket disconnected')
			}
		},
		exportNode() {
			this.$listeners.export(this.node, 'node_' + this.node.id, 'json')
		},
		getValue(v) {
			if (this.node && this.node.values) {
				return this.node.values.find((i) => i.id === v.id)
			} else {
				return null
			}
		},
		resetLocation() {
			setTimeout(() => {
				this.newLoc = this.node.loc
			}, 10)
		},
		resetName() {
			setTimeout(() => {
				this.newName = this.node.name
			}, 10)
		},
		async sendMqttAction(action, confirmMessage) {
			if (this.node) {
				let ok = true

				if (confirmMessage) {
					ok = await this.$listeners.showConfirm(
						'Info',
						confirmMessage,
						'info',
						{
							confirmText: 'Ok',
						}
					)
				}

				if (ok) {
					const args = [this.node.id]

					const data = {
						api: action,
						args: args,
					}
					this.socket.emit(socketActions.mqtt, data)
				}
			}
		},
		updateLoc() {
			if (this.node && !this.locError) {
				this.apiRequest('setNodeLocation', [this.node.id, this.newLoc])
			}
		},
		updateName() {
			if (this.node && !this.nameError) {
				this.apiRequest('setNodeName', [this.node.id, this.newName])
			}
		},
		updateValue(v, customValue) {
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
				this.$store.dispatch('setValue', v)

				this.apiRequest('writeValue', [
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
			}
		},
		validateTopic(name) {
			const error = this.mqtt.disabled ? '' : validTopic(name)

			return typeof error === 'string' ? error : ''
		},
	},
}
</script>

<style></style>
