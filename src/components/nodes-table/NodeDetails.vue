<template>
	<v-container fluid>
		<v-row no-gutters>
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

			<v-expansion-panels
				class="expansion-panels-outlined"
				accordion
				multiple
				flat
			>
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
									color="primary"
									outlined
									x-small
								>
									Refresh
									<v-icon x-small right>refresh</v-icon>
								</v-btn>
							</v-col>
						</v-row>
					</v-expansion-panel-header>
					<v-expansion-panel-content>
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
						<v-row>
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
											v-model.number="configCC.parameter"
										/>
									</v-col>
									<v-col cols="3">
										<v-select
											label="Size"
											:items="[1, 2, 3, 4]"
											v-model.number="configCC.valueSize"
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
						</v-row>
					</v-expansion-panel-content>
					<v-divider></v-divider>
				</v-expansion-panel>
			</v-expansion-panels>
		</v-row>
	</v-container>
</template>

<script>
import ValueID from '@/components/ValueId'

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
		StatisticsCard,
	},
	data() {
		return {
			locError: null,
			nameError: null,
			options: {},
			newName: this.node.name,
			newLoc: this.node.loc,
			configCC: {
				value: 0,
				valueSize: 1,
				parameter: 1,
			},
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

<style>
.expansion-panels-outlined {
	border: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
