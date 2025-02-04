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
						:min="-10"
						:max="20"
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
						:min="-10"
						:max="10"
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
				<v-col cols="12" style="max-width: 300px">
					<v-select
						label="RF Region"
						:items="node.rfRegions"
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
						>DO NOT CHANGE THESE VALUES UNLESS YOU KNOW WHAT YOU ARE
						DOING
					</strong>
					<small
						>Increasing the TX power (normal power level) may be
						<b>illegal</b>, depending on where you are located.
					</small>

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
							`Please consult the manufacturer for the default values, as these can vary between different sticks.`
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
						append-icon="clear"
						@click:append="
							options.transitionDuration =
								node.defaultTransitionDuration || ''
						"
						append-outer-icon="save"
						@click:append-outer="setDefaults('transitionDuration')"
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
						append-icon="clear"
						@click:append="
							options.volume = node.defaultVolume || ''
						"
						append-outer-icon="save"
						@click:append-outer="setDefaults('volume')"
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
								<v-col class="text-right">
									<v-btn
										v-if="canResetConfig(group[0])"
										@click.stop="resetAllConfig()"
										color="error"
										class="mb-1 mr-3"
										outlined
										x-small
									>
										Reset
										<v-icon x-small right>clear</v-icon>
									</v-btn>
									<v-btn
										v-if="group[0]"
										class="mb-1"
										@click.stop="
											refreshCCValues(
												group[0].commandClass,
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
												hide-details
												v-model.number="
													configCC.parameter
												"
											/>
										</v-col>
										<v-col cols="3">
											<v-select
												label="Size"
												hide-details
												:items="[1, 2, 3, 4]"
												v-model.number="
													configCC.valueSize
												"
											/>
										</v-col>
										<v-col cols="3">
											<v-text-field
												label="Value"
												hide-details
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
												hide-details
												:items="configCCValueFormats"
												v-model="configCC.valueFormat"
											/>
										</v-col>
										<v-col class="d-flex" style="gap: 10px">
											<v-btn
												width="60px"
												@click.stop="configurationGet()"
												color="success"
												x-small
												dark
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
											<v-btn
												v-if="canResetConfig(group[0])"
												width="60px"
												@click.stop="resetConfig"
												x-small
												color="error"
												>Reset</v-btn
											>
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
import { mapState, mapActions } from 'pinia'
import { validTopic } from '../../lib/utils'
import { ConfigValueFormat } from '@zwave-js/core/safe'
import useBaseStore from '../../stores/base.js'
import InstancesMixin from '../../mixins/InstancesMixin.js'
import { isUnsupervisedOrSucceeded } from '@zwave-js/core/safe'

export default {
	props: {
		headers: Array,
		node: Object,
	},
	components: {
		ValueID: () => import('../ValueId.vue'),
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
		}
	},
	computed: {
		...mapState(useBaseStore, ['mqtt']),
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
	mounted() {
		this.options = {
			transitionDuration: this.node.defaultTransitionDuration,
			volume: this.node.defaultVolume,
		}
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		async setDefaults(prop) {
			let defaultProp = ''

			switch (prop) {
				case 'transitionDuration':
					defaultProp = 'defaultTransitionDuration'
					break
				case 'volume':
					defaultProp = 'defaultVolume'
					break
			}

			if (!defaultProp) {
				return
			}

			const response = await this.app.apiRequest(
				'setNodeDefaultSetValueOptions',
				[this.node.id, { [defaultProp]: this.options[prop] }],
			)

			if (response.success) {
				this.showSnackbar(
					`Default node ${prop} updated successffully`,
					'success',
				)
			}
		},
		async updateControllerNodeProp(prop) {
			const response = await this.app.apiRequest(
				'updateControllerNodeProps',
				[null, [prop]],
			)

			if (response.success) {
				this.showSnackbar('Powerlevel updated', 'success')
			}
		},
		canResetConfig(value) {
			return (
				value &&
				value.commandClass === 112 &&
				value.commandClassVersion > 3
			)
		},
		async resetAllConfig() {
			if (
				await this.app.confirm(
					'Attention',
					'Are you sure you want to reset all configurations to default?',
					'alert',
				)
			) {
				const response = await this.app.apiRequest('sendCommand', [
					{
						nodeId: this.node.id,
						commandClass: 112,
					},
					'resetAll',
					[],
				])

				if (response.success) {
					this.showSnackbar('All config values resetted', 'success')
				}
			}
		},
		async resetConfig() {
			const response = await this.app.apiRequest('sendCommand', [
				{
					nodeId: this.node.id,
					commandClass: 112,
				},
				'reset',
				[this.configCC.parameter],
			])

			if (response.success) {
				this.showSnackbar(
					`Parameter ${this.configCC.parameter}: resetted`,
					'success',
				)
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
					'success',
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
				if (isUnsupervisedOrSucceeded(response.result)) {
					this.showSnackbar(
						`Parameter ${this.configCC.parameter} set successfully`,
						'success',
					)
				} else {
					this.showSnackbar(
						`Parameter ${this.configCC.parameter} set failed`,
						'error',
					)
				}
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
					args,
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
		updateValue(v, customValue) {
			this.$emit('updateValue', v, customValue)
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
