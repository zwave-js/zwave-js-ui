<template>
	<v-dialog v-model="value" max-width="500px" persistent>
		<v-card>
			<v-card-title>
				<span class="headline">{{ title }}</span>
			</v-card-title>

			<v-card-text>
				<v-container grid-list-md>
					<v-form v-model="valid" ref="form" lazy-validation>
						<v-row>
							<v-col cols="12">
								<v-select
									v-model="editedValue.device"
									label="Device"
									required
									:rules="[required]"
									item-text="name"
									:items="devices"
								></v-select>
							</v-col>
							<v-col cols="12">
								<v-select
									v-model="editedValue.value"
									label="Value"
									:hint="
										editedValue.value
											? editedValue.value.description
											: ''
									"
									required
									return-object
									:rules="[required]"
									item-text="label"
									item-value="id"
									:items="deviceValues"
								>
									<template v-slot:selection="{ item }">
										{{
											(item.label || item.id) +
											(item.endpoint > 1
												? ' - Endpoint ' + item.endpoint
												: '')
										}}
									</template>
									<template v-slot:item="{ item }">
										<v-list-item-content>
											<v-list-item-title>{{
												(item.label || item.id) +
												(item.endpoint > 0
													? ' - Endpoint ' +
														item.endpoint
													: '')
											}}</v-list-item-title>
											<v-list-item-subtitle
												style="max-width: 500px"
												class="text-truncate text-no-wrap"
												>{{
													item.description
												}}</v-list-item-subtitle
											>
										</v-list-item-content>
									</template>
								</v-select>
							</v-col>
							<v-col
								v-if="
									!this.mqtt.disabled &&
									this.gateway.hassDiscovery
								"
								cols="12"
							>
								<v-select
									v-model="editedValue.device_class"
									label="Device Class"
									hint="Specify a device class for Home assistant"
									item-text="name"
									:items="deviceClasses"
								></v-select>
							</v-col>
							<v-col v-if="isSensor(editedValue.value)" cols="12">
								<v-text-field
									v-model.number="editedValue.icon"
									hint="Specify a device icon for Home assistant, format is <prefix>:<icons-alias> (Eg: 'mdi:water'). Check http://materialdesignicons.com/"
									label="Device Icon"
								></v-text-field>
							</v-col>
							<v-col v-if="!this.mqtt.disabled" cols="12">
								<v-text-field
									v-model.trim="editedValue.topic"
									label="Topic"
									:rules="[requiredTopic]"
									required
								></v-text-field>
							</v-col>
							<v-col v-if="!this.mqtt.disabled" cols="6">
								<v-select
									v-model="editedValue.qos"
									label="QoS"
									hint="If specified, overrides the default QoS in MQTT settings"
									:items="[
										{ text: '', value: undefined },
										{ text: '0: At most once', value: 0 },
										{ text: '1: At least once', value: 1 },
										{ text: '2: Exactly once', value: 2 },
									]"
									persistent-hint
									required
									type="number"
								></v-select>
							</v-col>
							<v-col v-if="!this.mqtt.disabled" cols="6">
								<v-select
									v-model="editedValue.retain"
									label="Retain"
									persistent-hint
									hint="If specified, overrides the default retain in MQTT settings"
									:items="[
										{ text: '', value: undefined },
										{ text: 'True', value: true },
										{ text: 'False', value: false },
									]"
									required
									type="number"
								></v-select>
							</v-col>
							<v-col cols="12">
								<v-text-field
									v-model="editedValue.postOperation"
									label="Post operation"
									hint="Example: '/10' '*100' '+20'"
									required
								></v-text-field>
							</v-col>
							<v-col cols="6">
								<v-switch
									label="Poll"
									hint="Enable poll of this value. ATTENTION: This could create lot traffic in your network and kill the life of battery powered devices. Use at your own risk"
									persistent-hint
									v-model="editedValue.enablePoll"
								></v-switch>
							</v-col>
							<v-col v-if="editedValue.enablePoll" cols="6">
								<v-text-field
									v-model.number="editedValue.pollInterval"
									label="Poll interval"
									hint="Seconds between to wait between poll requests. The timer starts when the request ends"
									:rules="[requiredIntensity]"
									suffix="seconds"
									required
									type="number"
								></v-text-field>
							</v-col>
							<!--
              <v-col cols="6">
                <v-switch
                  label="Verify changes"
                  hint="Verify changes of this value"
                  persistent-hint
                  v-model="editedValue.verifyChanges"
                ></v-switch>
              </v-col>

              -->

							<v-col cols="6">
								<v-switch
									label="Parse send"
									hint="Create a function that parse the value sent via MQTT"
									persistent-hint
									v-model="editedValue.parseSend"
								></v-switch>
							</v-col>

							<v-container v-if="editedValue.parseSend">
								<p>
									Write the function here. Args are:
									<code>value</code>, <code>valueId</code>,
									<code>node</code>, <code>logger</code>. The
									function is sync and must return the parsed
									<code>value</code>.
								</p>
								<prism-editor
									lineNumbers
									v-model="editedValue.sendFunction"
									language="js"
									:highlight="highlighter"
								></prism-editor>
							</v-container>

							<v-col cols="6">
								<v-switch
									label="Parse receive"
									hint="Create a function that parse the received value from MQTT"
									persistent-hint
									v-model="editedValue.parseReceive"
								></v-switch>
							</v-col>

							<v-container v-if="editedValue.parseReceive">
								<p>
									Write the function here. Args are:
									<code>value</code>, <code>valueId</code>,
									<code>node</code>, <code>logger</code>. The
									function is sync and must return the parsed
									<code>value</code>.
								</p>
								<prism-editor
									lineNumbers
									v-model="editedValue.receiveFunction"
									language="js"
									:highlight="highlighter"
								></prism-editor>
							</v-container>
						</v-row>
					</v-form>
				</v-container>
			</v-card-text>

			<v-card-actions>
				<v-spacer></v-spacer>
				<v-btn color="blue darken-1" text @click="$emit('close')"
					>Cancel</v-btn
				>
				<v-btn
					color="blue darken-1"
					text
					@click="$refs.form.validate() && $emit('save')"
					>{{ isNew ? 'Add' : 'Update' }}</v-btn
				>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script>
// import Prism Editor
import 'vue-prism-editor/dist/prismeditor.min.css' // import the styles somewhere

// import highlighting library (you can use any library you want just return html string)
import { highlight, languages } from 'prismjs/components/prism-core'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism-tomorrow.css' // import syntax highlighting styles

import { mapState } from 'pinia'
import useBaseStore from '../../stores/base.js'

export default {
	components: {
		PrismEditor: () =>
			import('vue-prism-editor').then((m) => m.PrismEditor),
	},
	props: {
		value: Boolean,
		gw_type: Number,
		title: String,
		editedValue: Object,
		devices: Array,
	},
	watch: {
		// eslint-disable-next-line no-unused-vars
		value(val) {
			this.$refs.form && this.$refs.form.resetValidation()
			if (val) {
				this.isNew = !this.editedValue.device
			}
		},
	},
	computed: {
		...mapState(useBaseStore, ['gateway', 'mqtt']),
		deviceValues() {
			const device = this.devices.find(
				(d) => d.value == this.editedValue.device,
			) // eslint-disable-line eqeqeq
			return device ? device.values : []
		},
		deviceClasses() {
			const v = this.editedValue.value

			// sensor binary
			if (!v) {
				return []
			} else if (v.commandClass === 0x30) {
				// eslint-disable-line eqeqeq
				return [
					// sensor binary: https://www.home-assistant.io/integrations/binary_sensor/
					'battery',
					'cold',
					'connectivity',
					'door',
					'garage_door',
					'gas',
					'heat',
					'light',
					'lock',
					'moisture',
					'motion',
					'moving',
					'occupancy',
					'opening',
					'plug',
					'power',
					'presence',
					'problem',
					'safety',
					'smoke',
					'sound',
					'vibration',
					'window',
				]
			} else if (this.isSensor(v)) {
				// sensor multilevel and meters: https://www.home-assistant.io/integrations/sensor/
				return [
					'battery',
					'humidity',
					'illuminance',
					'signal_strength',
					'temperature',
					'power',
					'power_factor',
					'pressure',
					'timestamp',
					'current',
					'energy',
					'voltage',
				]
			} else if (v.commandClass === 38) {
				// multilevel switch: home-assistant.io/integrations/cover/
				return [
					'awning',
					'blind',
					'curtain',
					'damper',
					'door',
					'garage',
					'gate',
					'shade',
					'shutter',
					'window',
				]
			} else {
				return []
			}
		},
		requiredIntensity() {
			return (
				!this.editedValue.enablePoll ||
				(this.editedValue.enablePoll &&
					this.editedValue.pollInterval >= 10) ||
				'Minimun interval is 10 seconds'
			)
		},
		requiredTopic() {
			return (
				this.gw_type !== 2 ||
				!!this.editedValue.topic ||
				'Topic required'
			)
		},
	},
	data() {
		return {
			isNew: null,
			valid: true,
			required: (v) => !!v || 'This field is required',
		}
	},
	methods: {
		highlighter(code) {
			return highlight(code, languages.js) // returns html
		},
		isSensor(v) {
			return v && (v.commandClass === 0x31 || v.commandClass === 0x32)
		},
	},
}
</script>

<style scoped>
/* optional class for removing the outline */
.prism-editor__textarea:focus {
	outline: none;
}
</style>
