<template>
	<v-container fluid>
		<!-- Hide Name and Location fields for broadcast nodes (255, 4095) -->
		<v-row v-if="!isBroadcastNode">
			<v-col cols="12" sm="6" style="max-width: 300px">
				<v-text-field
					label="Name"
					append-icon="send"
					:error="!!nameError"
					:error-messages="nameError"
					v-model.trim="newName"
					clearable
					clear-icon="refresh"
					@click:clear="resetName"
					@click:append="updateName"
				></v-text-field>
			</v-col>

			<v-col cols="12" sm="6" style="max-width: 300px">
				<v-text-field
					label="Location"
					append-icon="send"
					v-model.trim="newLoc"
					:error="!!locError"
					:error-messages="locError"
					clearable
					clear-icon="refresh"
					@click:clear="resetLocation"
					@click:append="updateLoc"
				></v-text-field>
			</v-col>
		</v-row>

		<template v-if="node.isControllerNode">
			<v-list-subheader class="text-h6" style="padding: 0"
				>Controller Options</v-list-subheader
			>

			<v-row>
				<v-col cols="12" style="max-width: 350px">
					<v-select
						label="RF Region"
						:items="node.rfRegions"
						v-model="selectedRFRegion"
						:disabled="node.RFRegion === undefined"
						:hint="
							node.RFRegion === undefined
								? 'Not supported by your controller'
								: ''
						"
						persistent-hint
					>
						<template #append>
							<div
								class="d-flex flex-row"
								style="
									margin-top: -8px;
									gap: 5px;
									margin-left: 5px;
								"
							>
								<v-btn
									color="primary"
									size="small"
									v-tooltip:bottom="`Refresh`"
									icon
									@click="
										updateControllerNodeProp('RFRegion')
									"
								>
									<v-icon>refresh</v-icon>
								</v-btn>
								<v-btn
									color="primary"
									size="small"
									v-tooltip:bottom="`Save`"
									icon
									@click="updateRFRegion"
								>
									<v-icon>send</v-icon>
								</v-btn>
							</div>
						</template>
					</v-select>
				</v-col>
			</v-row>
			<v-row>
				<v-col cols="12" sm="6" style="max-width: 350px">
					<v-text-field
						label="Normal Power Level"
						v-model.number="node.powerlevel"
						:min="-10"
						:max="20"
						:step="0.1"
						suffix="dBm"
						type="number"
						:disabled="isAutoPowerLevelEnabled"
						:hint="
							isAutoPowerLevelEnabled
								? 'Automatic mode enabled in settings'
								: ''
						"
						persistent-hint
					></v-text-field>
				</v-col>
				<v-col cols="12" sm="6" style="max-width: 350px">
					<v-text-field
						label="Measured output power at 0 dBm"
						hide-details
						append-icon="send"
						v-model.number="node.measured0dBm"
						:min="-10"
						:max="10"
						:step="0.1"
						suffix="dBm"
						type="number"
					>
						<template #append>
							<div
								class="d-flex flex-row"
								style="
									margin-top: -8px;
									gap: 5px;
									margin-left: 5px;
								"
							>
								<v-btn
									color="primary"
									size="small"
									v-tooltip:bottom="`Refresh`"
									icon
									@click="
										updateControllerNodeProp('powerlevel')
									"
								>
									<v-icon>refresh</v-icon>
								</v-btn>
								<v-btn
									color="primary"
									size="small"
									v-tooltip:bottom="`Save`"
									icon
									@click="updatePowerLevel"
								>
									<v-icon>send</v-icon>
								</v-btn>
							</div>
						</template>
					</v-text-field>
				</v-col>
			</v-row>
			<v-row v-if="node.supportsLongRange">
				<v-col cols="12" style="max-width: 350px">
					<v-select
						label="Maximum LR Power Level"
						:items="maxLRPowerLevels"
						v-model="node.maxLongRangePowerlevel"
						:disabled="isAutoPowerLevelEnabled"
						:hint="
							isAutoPowerLevelEnabled
								? 'Automatic mode enabled in settings'
								: ''
						"
						persistent-hint
					>
						<template v-if="!isAutoPowerLevelEnabled" #append>
							<div
								class="d-flex flex-row"
								style="
									margin-top: -8px;
									gap: 5px;
									margin-left: 5px;
								"
							>
								<v-btn
									color="primary"
									size="small"
									v-tooltip:bottom="`Refresh`"
									icon
									@click="
										updateControllerNodeProp(
											'maxLongRangePowerlevel',
										)
									"
								>
									<v-icon>refresh</v-icon>
								</v-btn>
								<v-btn
									color="primary"
									size="small"
									v-tooltip:bottom="`Save`"
									icon
									@click="updateMaxLRPowerLevel"
								>
									<v-icon>send</v-icon>
								</v-btn>
							</div>
						</template>
					</v-select>
				</v-col>
			</v-row>
			<v-col v-if="showPowerWarnings" style="max-width: 700px" dense>
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

		<div>
			<v-list-subheader
				class="text-h6"
				style="padding: 0"
				v-if="!node.isControllerNode"
				>Send Options</v-list-subheader
			>
			<v-row class="mt-0" v-if="!node.isControllerNode">
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
					>
						<template #append>
							<div
								class="d-flex flex-row"
								style="margin-top: -8px; gap: 5px"
							>
								<v-btn
									icon
									size="small"
									v-tooltip:bottom="`Clear`"
									@click="
										options.transitionDuration =
											node.defaultTransitionDuration || ''
									"
								>
									<v-icon>clear</v-icon>
								</v-btn>
								<v-btn
									icon
									size="small"
									v-tooltip:bottom="`Save`"
									@click="setDefaults('transitionDuration')"
								>
									<v-icon>save</v-icon>
								</v-btn>
							</div>
						</template>
					</v-text-field>
				</v-col>
				<v-col
					cols="12"
					sm="6"
					style="max-width: 300px; padding-top: 0"
				>
					<v-number-input
						label="Volume"
						hint="The volume (for the Sound Switch CC)"
						persistent-hint
						v-model.number="options.volume"
					>
						<template #append>
							<div
								class="d-flex flex-row"
								style="margin-top: -8px; gap: 5px"
							>
								<v-btn
									icon
									size="small"
									v-tooltip:bottom="`Clear`"
									@click="
										options.volume =
											node.defaultVolume || ''
									"
								>
									<v-icon>clear</v-icon>
								</v-btn>
								<v-btn
									icon
									size="small"
									v-tooltip:bottom="`Save`"
									@click="setDefaults('volume')"
								>
									<v-icon>save</v-icon>
								</v-btn>
							</div>
						</template>
					</v-number-input>
				</v-col>
			</v-row>

			<!-- NODE VALUES -->

			<v-row v-if="!node.isControllerNode || node.values.length">
				<v-list-subheader class="text-h6">Values</v-list-subheader>

				<v-expansion-panels
					class="expansion-panels-outlined"
					variant="accordion"
					multiple
					flat
				>
					<v-expansion-panel
						v-for="(group, className) in commandGroups"
						:key="className"
					>
						<v-expansion-panel-title>
							<v-row no-gutters>
								<v-col align-self="center">
									{{ className }}
								</v-col>
								<v-col class="text-right">
									<v-btn
										v-if="canResetConfig(group[0])"
										@click.stop="resetAllConfig()"
										color="error"
										class="mr-3"
										variant="outlined"
										size="x-small"
									>
										Reset
										<v-icon size="x-small" end
											>clear</v-icon
										>
									</v-btn>
									<v-btn
										v-if="group[0]"
										class="mr-1"
										@click.stop="
											refreshCCValues(
												group[0].commandClass,
											)
										"
										color="primary"
										variant="outlined"
										size="x-small"
									>
										Refresh
										<v-icon size="x-small" end
											>refresh</v-icon
										>
									</v-btn>
								</v-col>
							</v-row>
						</v-expansion-panel-title>
						<v-expansion-panel-text>
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
									v-if="
										className.startsWith('Configuration') &&
										!node.isControllerNode
									"
									cols="12"
									sm="6"
									md="4"
								>
									<v-list-subheader class="valueid-label"
										>Custom Configuration
									</v-list-subheader>

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
											:cols="$vuetify.display.xs ? 4 : 3"
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
												variant="flat"
												width="60px"
												@click.stop="configurationGet()"
												color="success"
												size="x-small"
											>
												GET
											</v-btn>
											<v-btn
												variant="flat"
												width="60px"
												@click.stop="configurationSet()"
												color="primary"
												size="x-small"
											>
												SET
											</v-btn>
											<v-btn
												variant="flat"
												v-if="canResetConfig(group[0])"
												width="60px"
												@click.stop="resetConfig"
												size="x-small"
												color="error"
												>Reset</v-btn
											>
										</v-col>
									</v-row>
								</v-col>
							</v-row>
						</v-expansion-panel-text>
						<v-divider></v-divider>
					</v-expansion-panel>
				</v-expansion-panels>
			</v-row>
		</div>
	</v-container>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import { mapState, mapActions } from 'pinia'
import { validTopic } from '../../lib/utils'
import { maxLRPowerLevels } from '../../lib/items'
import useBaseStore from '../../stores/base.js'
import InstancesMixin from '../../mixins/InstancesMixin.js'
import { isUnsupervisedOrSucceeded, ConfigValueFormat } from '@zwave-js/core'
import { regionSupportsAutoPowerlevel } from '@server/lib/shared'

export default {
	props: {
		headers: Array,
		node: Object,
	},
	components: {
		ValueID: defineAsyncComponent(() => import('../ValueId.vue')),
	},
	mixins: [InstancesMixin],
	data() {
		return {
			locError: null,
			nameError: null,
			options: {},
			maxLRPowerLevels,
			newName: this.node.name,
			newLoc: this.node.loc,
			selectedRFRegion: this.node.RFRegion,
			configCCValueFormats: [
				{
					title: 'Signed',
					value: ConfigValueFormat.SignedInteger,
				},
				{
					title: 'Unsigned',
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
		...mapState(useBaseStore, ['mqtt', 'zwave']),
		isBroadcastNode() {
			// Broadcast nodes are node IDs 255 and 4095
			return this.node && (this.node.id === 255 || this.node.id === 4095)
		},
		regionSupportsAutoPowerlevel() {
			return regionSupportsAutoPowerlevel(this.node?.RFRegion)
		},
		isAutoPowerLevelEnabled() {
			return (
				this.zwave.rf.autoPowerlevels &&
				this.regionSupportsAutoPowerlevel
			)
		},
		showPowerWarnings() {
			// Hide warnings when auto mode is enabled for supported regions
			return !this.isAutoPowerLevelEnabled
		},
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
				const args = [this.selectedRFRegion]
				const response = await this.app.apiRequest('setRFRegion', args)

				if (response.success) {
					this.showSnackbar('RF Region updated', 'success')
				}
			}
		},
		async updateMaxLRPowerLevel() {
			if (this.node) {
				const args = [this.node.maxLongRangePowerlevel]
				const response = await this.app.apiRequest(
					'setMaxLRPowerLevel',
					args,
				)

				if (response.success) {
					this.showSnackbar(
						'Maximum LR power level updated',
						'success',
					)
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
