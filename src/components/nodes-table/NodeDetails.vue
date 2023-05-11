<template>
	<v-container fluid>
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

		<template v-if="node.isControllerNode">
			<v-subheader class="title" style="padding: 0"
				>Controller Options</v-subheader
			>

			<v-row>
				<v-col cols="12" sm="6" style="max-width: 300px">
					<v-text-field
						label="Normal Power Level"
						v-model.number="node.powerlevel"
						:min="-12.8"
						:max="12.7"
						:step="0.1"
						suffix="dBm"
						type="number"
					></v-text-field>
				</v-col>
				<v-col cols="12" sm="6" style="max-width: 300px">
					<v-text-field
						label="Measured output power at 0 dBm"
						append-outer-icon="send"
						v-model.number="node.measured0dBm"
						:min="-12.8"
						:max="12.7"
						:step="0.1"
						suffix="dBm"
						type="number"
					>
						<template v-slot:append-outer>
							<v-btn
								color="primary"
								small
								icon
								@click="updateControllerNodeProp('powerlevel')"
							>
								<v-icon>refresh</v-icon>
							</v-btn>
							<v-btn
								color="primary"
								small
								icon
								@click="updatePowerLevel"
							>
								<v-icon>send</v-icon>
							</v-btn>
						</template>
					</v-text-field>
				</v-col>
				<v-col
					v-if="node.RFRegion !== undefined"
					cols="12"
					style="max-width: 300px"
				>
					<v-select
						label="RF Region"
						:items="rfRegions"
						v-model="node.RFRegion"
					>
						<template v-slot:append-outer>
							<v-btn
								color="primary"
								small
								icon
								@click="updateControllerNodeProp('RFRegion')"
							>
								<v-icon>refresh</v-icon>
							</v-btn>
							<v-btn
								color="primary"
								small
								icon
								@click="updateRFRegion"
							>
								<v-icon>send</v-icon>
							</v-btn>
						</template>
					</v-select>
				</v-col>
			</v-row>
			<v-col style="max-width: 700px" dense>
				<v-alert text type="warning">
					<strong
						>DO NOT CHANGE THIS VALUES UNLESS YOU KNOW WHAT YOU ARE
						DOING</strong
					>
					<small
						>Increasing the TX power (normal power level) may be
						<b>illegal</b>, depending on where you are
						located</small
					>

					<small
						>Increasing the TX power will only make the nodes "hear"
						the controller better, but not vice versa</small
					>
				</v-alert>

				<v-alert
					class="pb-0"
					text
					style="white-space: break-spaces"
					type="info"
				>
					<small
						>{{
							`Please consult the manufacturer for the default values, as these can vary between different sticks. The defaults for most 700 series sticks are:\n- TX Power: 0.0 dBm\n- Measured output power at 0 dBm: +3.3 dBm`
						}}
					</small>
				</v-alert>
			</v-col>
		</template>

		<div v-if="!node.isControllerNode">
			<v-subheader class="title" style="padding: 0"
				>Send Options</v-subheader
			>
			<v-row class="mt-0">
				<v-col
					cols="12"
					sm="6"
					style="max-width: 300px; padding-top: 0"
				>
					<v-text-field
						label="Transition duration"
						hint="Ex: '10s' (10 seconds)"
						persistent-hint
						v-model.trim="options.transitionDuration"
					></v-text-field>
				</v-col>
				<v-col
					cols="12"
					sm="6"
					style="max-width: 300px; padding-top: 0"
				>
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
											refreshCCValues(
												group[0].commandClass
											)
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
										:node="node"
									></ValueID>
								</v-col>
							</v-row>
							<v-row>
								<v-col
									v-if="className.startsWith('Configuration')"
									cols="12"
									sm="6"
									md="4"
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
										<v-col
											:cols="
												$vuetify.breakpoint.xsOnly
													? 4
													: 3
											"
										>
											<v-select
												label="Format"
												:items="configCCValueFormats"
												v-model="configCC.valueFormat"
											/>
										</v-col>
										<v-col cols="3">
											<v-btn
												width="60px"
												@click.stop="configurationGet()"
												color="green"
												x-small
											>
												GET
											</v-btn>
											<v-btn
												width="60px"
												@click.stop="configurationSet()"
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
		</div>
	</v-container>
</template>

<script>
import ValueID from '../ValueId'
import { mapState, mapActions } from 'pinia'
import { validTopic } from '../../lib/utils'
import { ConfigValueFormat } from '@zwave-js/core/safe'
import { RFRegion } from 'zwave-js/safe'
import useBaseStore from '../../stores/base.js'
import InstancesMixin from '../../mixins/InstancesMixin.js'

export default {
	props: {
		headers: Array,
		node: Object,
	},
	components: {
		ValueID,
	},
	mixins: [InstancesMixin],
	data() {
		return {
			locError: null,
			nameError: null,
			options: {},
			newName: this.node.name,
			newLoc: this.node.loc,
			configCCValueFormats: [
				{
					text: 'Signed',
					value: ConfigValueFormat.SignedInteger,
				},
				{
					text: 'Unsigned',
					value: ConfigValueFormat.UnsignedInteger,
				},
			],
			configCC: {
				value: 0,
				valueSize: 1,
				parameter: 1,
				valueFormat: ConfigValueFormat.UnsignedInteger,
			},
			rfRegions: Object.keys(RFRegion)
				.filter((k) => isNaN(k))
				.map((key) => ({
					text: key,
					value: RFRegion[key],
				})),
		}
	},
	computed: {
		...mapState(useBaseStore, ['mqtt', 'setValue']),
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
		...mapActions(useBaseStore, ['showSnackbar']),
		async updateControllerNodeProp(prop) {
			const response = await this.app.apiRequest(
				'updateControllerNodeProps',
				[null, [prop]]
			)

			if (response.success) {
				this.showSnackbar('Powerlevel updated', 'success')
			}
		},
		async refreshCCValues(cc) {
			const response = await this.app.apiRequest('refreshCCValues', [
				this.node.id,
				cc,
			])

			if (response.success) {
				this.showSnackbar(`Values of CC ${cc} refreshed`, 'success')
			}
		},
		async configurationGet() {
			const response = await this.app.apiRequest('sendCommand', [
				{
					nodeId: this.node.id,
					commandClass: 112,
				},
				'get',
				[this.configCC.parameter],
			])

			if (response.success) {
				this.showSnackbar(
					`Parameter ${this.configCC.parameter}: ${response.result}`,
					'success'
				)
			}
		},
		async configurationSet() {
			const response = await this.app.apiRequest('sendCommand', [
				{
					nodeId: this.node.id,
					commandClass: 112,
				},
				'set',
				[
					{
						parameter: this.configCC.parameter,
						value: this.configCC.value,
						valueSize: this.configCC.valueSize,
						valueFormat: this.configCC.valueFormat,
					},
				],
			])

			if (response.success) {
				this.showSnackbar(
					'Configuration parameter set successfully',
					'success'
				)
			}
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
		async updatePowerLevel() {
			if (this.node) {
				const args = [this.node.powerlevel, this.node.measured0dBm]
				const response = await this.app.apiRequest(
					'setPowerlevel',
					args
				)

				if (response.success) {
					this.showSnackbar('Powerlevel updated', 'success')
				}
			}
		},
		async updateRFRegion() {
			if (this.node) {
				const args = [this.node.RFRegion]
				const response = await this.app.apiRequest('setRFRegion', args)

				if (response.success) {
					this.showSnackbar('RF Region updated', 'success')
				}
			}
		},
		async updateLoc() {
			if (this.node && !this.locError) {
				const response = await this.app.apiRequest('setNodeLocation', [
					this.node.id,
					this.newLoc,
				])

				if (response.success) {
					this.showSnackbar('Node location updated', 'success')
				}
			}
		},
		async updateName() {
			if (this.node && !this.nameError) {
				const response = await this.app.apiRequest('setNodeName', [
					this.node.id,
					this.newName,
				])

				if (response.success) {
					this.showSnackbar('Node name updated', 'success')
				}
			}
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
					if (response.result) {
						this.showSnackbar('Value updated', 'success')
					} else {
						this.showSnackbar('Value update failed', 'error')
					}
				} else {
					this.showSnackbar(
						`Error updating value${
							response.message ? ': ' + response.message : ''
						}`,
						'error'
					)
				}
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
