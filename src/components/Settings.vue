<template>
	<v-container fluid grid-list-md>
		<v-card>
			<v-card-text>
				<v-form
					id="form_settings"
					@submit.prevent="update"
					v-model="valid_zwave"
					ref="form_settings"
				>
					<v-expansion-panels accordion multiple>
						<v-expansion-panel key="general">
							<v-expansion-panel-header>
								<v-row no-gutters>
									<v-col align-self="center"> General </v-col>
									<v-col class="text-right pr-5">
										<v-btn
											@click.stop="openDocs('general')"
											x-small
										>
											Docs
										</v-btn>
									</v-col>
								</v-row>
							</v-expansion-panel-header>
							<v-expansion-panel-content>
								<v-card flat>
									<v-card-text>
										<v-row class="mb-5">
											<v-col cols="12" sm="6" md="4">
												<v-switch
													hint="Enable this to password protect your application. Default username is `admin`, password is `zwave`"
													persistent-hint
													label="Auth"
													v-model="
														newGateway.authEnabled
													"
												></v-switch>
											</v-col>
											<v-col cols="12" sm="6" md="4">
												<v-combobox
													hint="You can select a plugin from the list or write the path to your custom plugin and press enter"
													persistent-hint
													label="Plugins"
													:items="[
														'@varet/zj2m-prom-exporter',
													]"
													multiple
													chips
													deletable-chips
													v-model="newGateway.plugins"
												></v-combobox>
											</v-col>
											<v-col cols="12" sm="6" md="4">
												<v-switch
													hint="Enable logging"
													persistent-hint
													label="Log enabled"
													v-model="
														newGateway.logEnabled
													"
												></v-switch>
											</v-col>
											<v-col
												cols="12"
												sm="6"
												md="4"
												v-if="newGateway.logEnabled"
											>
												<v-select
													:items="logLevels"
													v-model="
														newGateway.logLevel
													"
													label="Log Level"
												></v-select>
											</v-col>
											<v-col
												cols="12"
												sm="6"
												md="4"
												v-if="newGateway.logEnabled"
											>
												<v-switch
													hint="Store logs in a file. Default: store/zwavejs2mqtt.log"
													persistent-hint
													label="Log to file"
													v-model="
														newGateway.logToFile
													"
												></v-switch>
											</v-col>
										</v-row>
										<v-subheader class="font-weight-bold"
											>Devices values
											configuration</v-subheader
										>
										<div class="mb-5 caption">
											Add here valueIds specific
											configurations for each device. This
											means that if you create an entry
											here this configuration will be
											applied to each valueId of each
											device of the same type in your
											Network.
										</div>
										<v-data-table
											:headers="visibleHeaders"
											:items="newGateway.values"
											:items-per-page-options="[
												10,
												20,
												{ text: 'All', value: -1 },
											]"
											class="elevation-1"
										>
											<template
												v-slot:[`item.device`]="{
													item,
												}"
											>
												{{ deviceName(item.device) }}
											</template>
											<template
												v-slot:[`item.value`]="{ item }"
											>
												{{
													item.value.label +
													' (' +
													item.value.id +
													')'
												}}
											</template>
											<template
												v-slot:[`item.topic`]="{ item }"
											>
												{{ item.topic }}
											</template>
											<template
												v-slot:[`item.postOperation`]="{
													item,
												}"
											>
												{{
													item.postOperation ||
													'No operation'
												}}
											</template>
											<template
												v-slot:[`item.enablePoll`]="{
													item,
												}"
											>
												{{
													item.enablePoll
														? 'Interval: ' +
														  item.pollInterval +
														  's'
														: 'No'
												}}
											</template>
											<template
												v-slot:[`item.actions`]="{
													item,
												}"
											>
												<v-icon
													small
													class="mr-2"
													color="green"
													@click="editItem(item)"
													>edit</v-icon
												>
												<v-icon
													small
													color="red"
													@click="deleteItem(item)"
													>delete</v-icon
												>
											</template>
										</v-data-table>
									</v-card-text>
									<v-card-actions>
										<v-btn
											color="blue darken-1"
											text
											@click="dialogValue = true"
											>New Value</v-btn
										>
									</v-card-actions>
								</v-card>
							</v-expansion-panel-content>
						</v-expansion-panel>

						<v-expansion-panel key="zwave">
							<v-expansion-panel-header>
								<v-row no-gutters>
									<v-col align-self="center"> Zwave </v-col>
									<v-col class="text-right pr-5">
										<v-btn
											@click.stop="openDocs('zwave')"
											x-small
										>
											Docs
										</v-btn>
									</v-col>
								</v-row>
							</v-expansion-panel-header>
							<v-expansion-panel-content>
								<v-card flat>
									<v-card-text>
										<v-row>
											<v-col cols="12" sm="6">
												<v-combobox
													v-model="newZwave.port"
													label="Serial Port"
													hint="Ex /dev/ttyUSB0"
													persistent-hint
													:rules="[rules.required]"
													required
													:items="serial_ports"
												></v-combobox>
											</v-col>
											<v-row v-if="newZwave.securityKeys">
												<v-col cols="12" sm="6">
													<v-text-field
														v-model="
															newZwave
																.securityKeys
																.S2_Unauthenticated
														"
														label="S2 Unauthenticated"
														prepend-icon="vpn_key"
														@paste="
															fixKey(
																$event,
																'S2_Unauthenticated'
															)
														"
														:rules="[
															rules.validKey,
															rules.validLength,
														]"
														persistent-hint
														append-outer-icon="wifi_protected_setup"
														@click:append-outer="
															randomKey(
																'S2_Unauthenticated'
															)
														"
													></v-text-field>
												</v-col>
												<v-col cols="12" sm="6">
													<v-text-field
														v-model="
															newZwave
																.securityKeys
																.S2_Authenticated
														"
														@paste="
															fixKey(
																$event,
																'S2_Authenticated'
															)
														"
														prepend-icon="vpn_key"
														label="S2 Authenticated"
														persistent-hint
														:rules="[
															rules.validKey,
															rules.validLength,
														]"
														append-outer-icon="wifi_protected_setup"
														@click:append-outer="
															randomKey(
																'S2_Authenticated'
															)
														"
													></v-text-field>
												</v-col>
												<v-col cols="12" sm="6">
													<v-text-field
														v-model="
															newZwave
																.securityKeys
																.S2_AccessControl
														"
														@paste="
															fixKey(
																$event,
																'S2_AccessControl'
															)
														"
														prepend-icon="vpn_key"
														label="S2 Access Control"
														:rules="[
															rules.validKey,
															rules.validLength,
														]"
														append-outer-icon="wifi_protected_setup"
														@click:append-outer="
															randomKey(
																'S2_AccessControl'
															)
														"
													></v-text-field>
												</v-col>
												<v-col cols="12" sm="6">
													<v-text-field
														v-model="
															newZwave
																.securityKeys
																.S0_Legacy
														"
														@paste="
															fixKey(
																$event,
																'S0_Legacy'
															)
														"
														prepend-icon="vpn_key"
														label="S0 Legacy"
														:rules="[
															rules.validKey,
															rules.validLength,
														]"
														append-outer-icon="wifi_protected_setup"
														@click:append-outer="
															randomKey(
																'S0_Legacy'
															)
														"
													></v-text-field>
												</v-col>
											</v-row>
											<v-col cols="12" sm="6">
												<v-switch
													hint="Usage statistics allows us to gain insight how `zwave-js` is used, which manufacturers and devices are most prevalent and where to best focus our efforts in order to improve `zwave-js` the most. We do not store any personal information. Details can be found under https://zwave-js.github.io/node-zwave-js/#/getting-started/telemetry.md#usage-statistics"
													persistent-hint
													label="Enable statistics"
													v-model="
														newZwave.enableStatistics
													"
												></v-switch>
											</v-col>
											<input
												type="hidden"
												:value="
													newZwave.disclaimerVersion
												"
											/>
											<v-col cols="12" sm="6" md="4">
												<v-autocomplete
													hint="Select preferred sensors scales. You can select a scale For more info check https://github.com/zwave-js/node-zwave-js/blob/master/packages/config/config/sensorTypes.json"
													persistent-hint
													label="Preferred scales"
													:items="filteredScales"
													multiple
													:item-text="scaleName"
													:rules="[
														rules.uniqueSensorType,
													]"
													chips
													return-object
													deletable-chips
													v-model="newZwave.scales"
												>
													<template
														v-slot:item="{
															item,
															attrs,
															on,
														}"
													>
														<v-list-item
															v-on="on"
															v-bind="attrs"
															two-line
														>
															<v-list-item-content>
																<v-list-item-title
																	>{{
																		scaleName(
																			item
																		)
																	}}</v-list-item-title
																>
																<v-list-item-subtitle
																	>{{
																		item.description ||
																		''
																	}}</v-list-item-subtitle
																>
															</v-list-item-content>
														</v-list-item>
													</template>
												</v-autocomplete>
											</v-col>
											<v-col cols="12" sm="6">
												<v-switch
													hint="Enable zwave-js logging"
													persistent-hint
													label="Log Enabled"
													v-model="
														newZwave.logEnabled
													"
												></v-switch>
											</v-col>
											<v-col
												v-if="newZwave.logEnabled"
												cols="12"
												sm="6"
											>
												<v-select
													:items="logLevels"
													v-model="newZwave.logLevel"
													label="Log Level"
												></v-select>
											</v-col>
											<v-col
												v-if="newZwave.logEnabled"
												cols="12"
												sm="6"
											>
												<v-switch
													hint="Store zwave logs in a file (stored in store folder)"
													persistent-hint
													label="Log to file"
													v-model="newZwave.logToFile"
												></v-switch>
											</v-col>
											<v-col
												v-if="newZwave.logEnabled"
												cols="12"
												sm="6"
											>
												<v-combobox
													hint="Choose which nodes to log. Leave this empty to log all nodes"
													persistent-hint
													label="Log nodes"
													:items="
														newZwave.nodeFilter ||
														[]
													"
													multiple
													:rules="[
														rules.validNodeLog,
													]"
													chips
													deletable-chips
													v-model="
														newZwave.nodeFilter
													"
												></v-combobox>
											</v-col>
											<v-col cols="6">
												<v-text-field
													v-model.number="
														newZwave.commandsTimeout
													"
													label="Commands timeout"
													:rules="[rules.required]"
													required
													suffix="seconds"
													hint="Seconds to wait before stop inclusion/exclusion mode"
													type="number"
												></v-text-field>
											</v-col>
											<input
												type="hidden"
												:value="newZwave.options"
											/>
										</v-row>
									</v-card-text>
								</v-card>
							</v-expansion-panel-content>
						</v-expansion-panel>

						<v-divider></v-divider>

						<v-container cols="12" sm="6" class="ml-1">
							<v-switch
								hint="Enable this to use zwavejs2mqtt only as Control Panel"
								persistent-hint
								label="Disable MQTT Gateway"
								v-model="newMqtt.disabled"
							></v-switch>
						</v-container>

						<v-expansion-panel key="mqtt" v-if="!newMqtt.disabled">
							<v-expansion-panel-header>
								<v-row no-gutters>
									<v-col align-self="center"> Mqtt </v-col>
									<v-col class="text-right pr-5">
										<v-btn
											@click.stop="openDocs('mqtt')"
											x-small
										>
											Docs
										</v-btn>
									</v-col>
								</v-row>
							</v-expansion-panel-header>
							<v-expansion-panel-content>
								<v-card flat>
									<v-card-text>
										<v-row>
											<v-col cols="12" sm="6" md="4">
												<v-text-field
													v-model.trim="newMqtt.name"
													label="Name"
													:rules="[
														rules.required,
														rules.validName,
													]"
													hint="Unique name that identify this gateway"
													required
												></v-text-field>
											</v-col>
											<v-col cols="12" sm="6" md="4">
												<v-text-field
													v-model.trim="newMqtt.host"
													label="Host url"
													:rules="[rules.required]"
													hint="The host url"
													required
												></v-text-field>
											</v-col>
											<v-col cols="12" sm="6" md="4">
												<v-text-field
													v-model.number="
														newMqtt.port
													"
													label="Port"
													:rules="[rules.required]"
													hint="Host Port"
													required
													type="number"
												></v-text-field>
											</v-col>
											<v-col cols="12" sm="6" md="4">
												<v-text-field
													v-model.number="
														newMqtt.reconnectPeriod
													"
													label="Reconnect period (ms)"
													hint="Reconnection period"
													:rules="[rules.required]"
													required
													type="number"
												></v-text-field>
											</v-col>
											<v-col cols="12" sm="6" md="4">
												<v-text-field
													v-model.trim="
														newMqtt.prefix
													"
													label="Prefix"
													:rules="[
														rules.required,
														rules.validPrefix,
													]"
													hint="The prefix to add to each topic"
													required
												></v-text-field>
											</v-col>
											<v-col cols="12" sm="6" md="4">
												<v-select
													v-model="newMqtt.qos"
													label="QoS"
													:rules="[rules.required]"
													required
													:items="[0, 1, 2]"
												></v-select>
											</v-col>
											<v-col cols="12" sm="6">
												<v-switch
													hint="Set retain flag to true for outgoing messages"
													persistent-hint
													label="Retain"
													v-model="newMqtt.retain"
												></v-switch>
											</v-col>
											<v-col cols="12" sm="6">
												<v-switch
													hint="If true the client does not have a persistent session and all information are lost when the client disconnects for any reason"
													persistent-hint
													label="Clean"
													v-model="newMqtt.clean"
												></v-switch>
											</v-col>
											<v-col cols="12" sm="6">
												<v-switch
													hint="Enable persistent storage of packets (QoS > 0) while client is offline. If disabled the in memory store will be used."
													persistent-hint
													label="Store"
													v-model="newMqtt.store"
												></v-switch>
											</v-col>
											<v-col
												cols="12"
												sm="6"
												v-if="secure"
											>
												<v-switch
													hint="Enable this when using self signed certificates"
													persistent-hint
													label="Allow self signed certs"
													v-model="
														newMqtt.allowSelfsigned
													"
												></v-switch>
											</v-col>
											<v-col
												cols="12"
												sm="6"
												md="4"
												v-if="secure"
											>
												<file-input
													label="Key.pem"
													keyProp="_key"
													v-model="newMqtt.key"
													@onFileSelect="onFileSelect"
												></file-input>
											</v-col>
											<v-col
												cols="12"
												sm="6"
												md="4"
												v-if="secure"
											>
												<file-input
													label="Cert.pem"
													keyProp="_cert"
													v-model="newMqtt.cert"
													@onFileSelect="onFileSelect"
												></file-input>
											</v-col>
											<v-col
												cols="12"
												sm="6"
												md="4"
												v-if="secure"
											>
												<file-input
													label="Ca.pem"
													keyProp="_ca"
													v-model="newMqtt.ca"
													@onFileSelect="onFileSelect"
												></file-input>
											</v-col>
											<v-col cols="12" sm="4">
												<v-switch
													hint="Does this client require auth?"
													persistent-hint
													label="Auth"
													v-model="newMqtt.auth"
												></v-switch>
											</v-col>
											<v-col
												v-if="newMqtt.auth"
												cols="12"
												sm="4"
											>
												<v-text-field
													v-model="newMqtt.username"
													label="Username"
													:rules="[requiredUser]"
													required
												></v-text-field>
											</v-col>
											<v-col
												v-if="newMqtt.auth"
												cols="12"
												sm="4"
											>
												<v-text-field
													v-model="newMqtt.password"
													label="Password"
													:rules="[requiredPassword]"
													required
													:append-icon="
														e1
															? 'visibility'
															: 'visibility_off'
													"
													@click:append="
														() => (e1 = !e1)
													"
													:type="
														e1 ? 'password' : 'text'
													"
												></v-text-field>
											</v-col>
										</v-row>
									</v-card-text>
								</v-card>
							</v-expansion-panel-content>
						</v-expansion-panel>

						<v-divider></v-divider>

						<v-expansion-panel
							key="gateway"
							v-if="!newMqtt.disabled"
						>
							<v-expansion-panel-header>
								<v-row no-gutters>
									<v-col align-self="center"> Gateway </v-col>
									<v-col class="text-right pr-5">
										<v-btn
											@click.stop="openDocs('gateway')"
											x-small
										>
											Docs
										</v-btn>
									</v-col>
								</v-row>
							</v-expansion-panel-header>
							<v-expansion-panel-content>
								<v-card flat>
									<v-card-text>
										<v-row>
											<v-col cols="12">
												<v-select
													v-model="newGateway.type"
													label="Topic type"
													:rules="[rules.required]"
													required
													:items="gw_types"
												></v-select>
											</v-col>
											<v-col cols="12">
												<v-select
													v-model="
														newGateway.payloadType
													"
													label="Payload type"
													required
													:rules="[validPayload]"
													:items="py_types"
												></v-select>
											</v-col>
											<v-col
												v-if="newGateway.type === 0"
												cols="6"
											>
												<v-switch
													label="Use nodes name instead of numeric nodeIDs"
													v-model="
														newGateway.nodeNames
													"
												></v-switch>
											</v-col>
											<v-col cols="6">
												<v-switch
													label="Ignore location"
													hint="Don't add nodes location to values topic"
													v-model="
														newGateway.ignoreLoc
													"
													persistent-hint
												></v-switch>
											</v-col>
											<v-col cols="6">
												<v-switch
													label="Send Zwave events"
													hint="Enable this to get all zwave events in MQTT on _EVENTS topic"
													v-model="
														newGateway.sendEvents
													"
													persistent-hint
												></v-switch>
											</v-col>
											<v-col cols="6">
												<v-switch
													label="Ignore status updates"
													hint="Prevent gateway to send updates when a node changes it's status (dead/sleep, alive)"
													v-model="
														newGateway.ignoreStatus
													"
													persistent-hint
												></v-switch>
											</v-col>
											<v-col
												v-if="
													newGateway.payloadType !== 2
												"
												cols="6"
											>
												<v-switch
													label="Include Node info"
													hint="Include Node's Name and Location on Payload"
													v-model="
														newGateway.includeNodeInfo
													"
													persistent-hint
												></v-switch>
											</v-col>
											<v-col cols="6">
												<v-switch
													label="Publish node details"
													hint="Details published under a topic, can help automations receive device info"
													v-model="
														newGateway.publishNodeDetails
													"
													persistent-hint
												></v-switch>
											</v-col>
										</v-row>
									</v-card-text>
								</v-card>
							</v-expansion-panel-content>
						</v-expansion-panel>

						<v-divider></v-divider>

						<v-expansion-panel key="Hass">
							<v-expansion-panel-header>
								<v-row no-gutters>
									<v-col align-self="center">
										Home Assistant
									</v-col>
									<v-col class="text-right pr-5">
										<v-btn
											@click.stop="
												openDocs('home-assistant')
											"
											x-small
										>
											Docs
										</v-btn>
									</v-col>
								</v-row>
							</v-expansion-panel-header>
							<v-expansion-panel-content>
								<v-card flat>
									<v-card-text>
										<v-row>
											<v-col cols="12" sm="6">
												<v-switch
													hint="Enable zwave-js websocket server. This can be used with HASS Zwave-js integration to discover entities"
													persistent-hint
													label="WS Server"
													v-model="
														newZwave.serverEnabled
													"
												></v-switch>
											</v-col>
											<v-col
												v-if="newZwave.serverEnabled"
												cols="12"
												sm="6"
											>
												<v-text-field
													v-model.number="
														newZwave.serverPort
													"
													label="Server Port"
													:rules="[rules.required]"
													required
													hint="The port to bind the Zwave Server. Default: 3000"
													type="number"
												></v-text-field>
											</v-col>
										</v-row>
										<v-row v-if="!newMqtt.disabled">
											<v-col cols="6">
												<v-switch
													label="MQTT Discovery"
													hint="Create devices in Hass using MQTT discovery. This is an alternative to Hass Zwave-js integration"
													v-model="
														newGateway.hassDiscovery
													"
													persistent-hint
												></v-switch>
											</v-col>
											<v-col
												cols="6"
												v-if="newGateway.hassDiscovery"
											>
												<v-text-field
													v-model="
														newGateway.discoveryPrefix
													"
													label="Discovery prefix"
													hint="The prefix to use for Hass MQTT discovery. Leave empty to use the mqtt prefix"
												></v-text-field>
											</v-col>
											<v-col
												cols="6"
												v-if="newGateway.hassDiscovery"
											>
												<v-switch
													label="Retained discovery"
													hint="Set retain flag to true in discovery messages"
													v-model="
														newGateway.retainedDiscovery
													"
													persistent-hint
												></v-switch>
											</v-col>
											<v-col
												cols="6"
												v-if="newGateway.hassDiscovery"
											>
												<v-switch
													label="Manual discovery"
													hint="Don't automatically send the discovery payloads when a device is discovered"
													v-model="
														newGateway.manualDiscovery
													"
													persistent-hint
												></v-switch>
											</v-col>
											<v-col
												cols="6"
												v-if="newGateway.hassDiscovery"
											>
												<v-text-field
													v-model="
														newGateway.entityTemplate
													"
													label="Entity name template"
													persistent-hint
													hint="Template which generates entity names"
												></v-text-field>
											</v-col>
											<v-col
												cols="6"
												v-if="newGateway.hassDiscovery"
											>
												<div>
													Default: <code>%ln_%o</code
													><br />
													-<code>%ln</code>: Node
													location with name
													(<code>&lt;location-?&gt;&lt;name&gt;</code>)<br />-
													<code>%nid</code>: Node ID
													<br />- <code>%n</code>:
													Node Name <br />-
													<code>%loc</code>: Node
													Location <br />-
													<code>%p</code>: valueId
													property (fallback to device
													type) <br />-
													<code>%pk</code>: valueId
													property key (fallback to
													device type) <br />-
													<code>%pn</code>: valueId
													property name (fallback to
													device type) <br />-
													<code>%o</code>: HASS
													object_id <br />-
													<code>%l</code>: valueId
													label (fallback to
													object_id)
												</div>
											</v-col>
										</v-row>
									</v-card-text>
								</v-card>
							</v-expansion-panel-content>
						</v-expansion-panel>
					</v-expansion-panels>

					<DialogGatewayValue
						@save="saveValue"
						@close="closeDialog"
						v-model="dialogValue"
						:gw_type="newGateway.type"
						:title="dialogTitle"
						:editedValue="editedValue"
						:devices="devices"
					/>
				</v-form>
			</v-card-text>
			<v-card-actions>
				<v-spacer></v-spacer>
				<v-btn color="red darken-1" text @click="resetConfig">
					Reset
					<v-icon right dark>clear</v-icon>
				</v-btn>
				<v-btn color="purple darken-1" text @click="importSettings">
					Import
					<v-icon right dark>file_upload</v-icon>
				</v-btn>
				<v-btn color="green darken-1" text @click="exportSettings">
					Export
					<v-icon right dark>file_download</v-icon>
				</v-btn>
				<v-btn
					color="blue darken-1"
					text
					type="submit"
					form="form_settings"
				>
					Save
					<v-icon right dark>save</v-icon>
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-container>
</template>

<script>
import { mapGetters, mapMutations } from 'vuex'
import ConfigApis from '@/apis/ConfigApis'
import fileInput from '@/components/custom/file-input.vue'
import { parse } from 'native-url'

import DialogGatewayValue from '@/components/dialogs/DialogGatewayValue'

function copy(o) {
	return JSON.parse(JSON.stringify(o))
}

export default {
	name: 'Settings',
	components: {
		DialogGatewayValue,
		fileInput,
	},
	computed: {
		filteredScales() {
			if (this.newZwave.scales && this.newZwave.scales.length > 0) {
				return this.scales.filter(
					(a) =>
						!this.newZwave.scales.find(
							(b) => b.key === a.key && a.label !== b.label
						)
				)
			} else {
				return this.scales
			}
		},
		visibleHeaders() {
			if (!this.newMqtt.disabled) return this.headers
			else {
				const headersCopy = [...this.headers]

				headersCopy.splice(2, 1) // remove topic header
				return headersCopy
			}
		},
		secure() {
			if (!this.newMqtt.host) return false
			const parsed = parse(this.newMqtt.host)

			const secure = ['mqtts:', 'tls:'].indexOf(parsed.protocol) >= 0

			if (!secure) {
				this.newMqtt.key =
					this.newMqtt._key =
					this.newMqtt.cert =
					this.newMqtt._cert =
					this.newMqtt.ca =
					this.newMqtt._ca =
						''
			}

			return secure
		},
		dialogTitle() {
			return this.editedIndex === -1 ? 'New Item' : 'Edit Item'
		},
		requiredUser() {
			return (
				(this.newMqtt.auth && !!this.newMqtt.username) ||
				'This field is required.'
			)
		},
		validPayload() {
			return (
				!this.newGateway.hassDiscovery ||
				this.newGateway.payloadType !== 2 ||
				"Hass discovery doesn't work with this payload type"
			)
		},
		requiredPassword() {
			return (
				(this.newMqtt.auth && !!this.newMqtt.password) ||
				'This field is required.'
			)
		},
		...mapGetters([
			'zwave',
			'mqtt',
			'gateway',
			'devices',
			'serial_ports',
			'scales',
		]),
	},
	watch: {
		dialogValue(val) {
			val || this.closeDialog()
		},
	},
	data() {
		return {
			valid_zwave: true,
			dialogValue: false,
			newGateway: {},
			newMqtt: {},
			newZwave: {},
			editedValue: {},
			editedIndex: -1,
			defaultValue: {},
			logLevels: [
				{ text: 'Error', value: 'error' },
				{ text: 'Warn', value: 'warn' },
				{ text: 'Info', value: 'info' },
				{ text: 'Verbose', value: 'verbose' },
				{ text: 'Debug', value: 'debug' },
				{ text: 'Silly', value: 'silly' },
			],
			headers: [
				{ text: 'Device', value: 'device' },
				{ text: 'Value', value: 'value', sortable: false },
				{ text: 'Topic', value: 'topic' },
				{ text: 'Post Operation', value: 'postOperation' },
				{ text: 'Poll', value: 'enablePoll' },
				// { text: 'Changes', value: 'verifyChanges' },
				{ text: 'Actions', value: 'actions', sortable: false },
			],
			e1: true,
			gw_types: [
				{
					text: 'ValueID topics',
					value: 0,
				},
				{
					text: 'Named topics',
					value: 1,
				},
				{
					text: 'Configured Manually',
					value: 2,
				},
			],
			py_types: [
				{
					text: 'JSON Time-Value',
					value: 0,
				},
				{
					text: 'Entire Z-Wave value Object',
					value: 1,
				},
				{
					text: 'Just value',
					value: 2,
				},
			],
			rules: {
				required: (value) => {
					let valid = false

					if (value instanceof Array) valid = value.length > 0
					else valid = !!value || value === 0

					return valid || 'This field is required.'
				},
				uniqueSensorType(values) {
					if (!values || values.length < 2) {
						return true
					} else {
						return (
							!values.some(
								(a, index) =>
									values.findIndex(
										(b, index2) =>
											index2 > index && a.key === b.key
									) >= 0
							) || 'Duplicated sensor type scale'
						)
					}
				},
				validNodeLog: (values) => {
					return (
						!values ||
						values.every((v) => v > 0 && v < 233) ||
						'Nodes must be between 1-232'
					)
				},
				validName: (value) => {
					return (
						!/[!@#$%^&*)(+=:,;"'\\|?{}£°§<>[\]/.\s]/g.test(value) ||
						'Name is not valid, only "a-z" "A-Z" "0-9" chars and "_" are allowed'
					)
				},
				validPrefix: (value) => {
					return (
						!/[!@#$%^&*)(+=:,;"'\\|?{}£°§<>[\].\s]/g.test(value) ||
						'Prefix is not valid, only "a-z" "A-Z" "0-9", "_", "/" chars are allowed'
					)
				},
				validLength: (value) => {
					return (
						!value ||
						value.length === 32 ||
						'Key must be 32 charaters length'
					)
				},
				validKey: (value) => {
					return (
						!value ||
						!/[^A-F0-9]+/gi.test(value) ||
						'Key not valid. Must contain only hex chars'
					)
				},
			},
		}
	},
	methods: {
		...mapMutations(['showSnackbar']),
		fixKey(event, key) {
			let data = event.clipboardData?.getData('Text')

			if (data) {
				data = data.replace(/0x|,|\s/gi, '')
				this.$set(this.newZwave.securityKeys, key, data)
				event.preventDefault()
			}
		},
		openDocs(id) {
			window.open(
				`https://zwave-js.github.io/zwavejs2mqtt/#/usage/setup?id=${id}`,
				'_blank'
			)
		},
		scaleName(item) {
			if (typeof item === 'object' && item) {
				return `${item.sensor}: ${
					item.label ? ' ' + item.label + ' ' : ''
				}${
					item.unit && item.unit !== item.label
						? `(${item.unit})`
						: ''
				}`
			} else {
				return item
			}
		},
		randomKey(k) {
			let key = ''

			while (key.length < 32) {
				const x = Math.round(Math.random() * 255)
					.toString(16)
					.toUpperCase()
				key += x.length === 2 ? x : '0' + x
			}

			this.$set(this.newZwave.securityKeys, k, key)
		},
		readFile(file, callback) {
			const reader = new FileReader()

			reader.onload = (e) => callback(e.target.result)
			reader.readAsText(file)
		},
		onFileSelect(data) {
			const file = data.files[0]
			if (file) {
				this.readFile(file, (text) => (this.newMqtt[data.key] = text))
			} else {
				this.newMqtt[data.key] = ''
			}
		},
		async importSettings() {
			try {
				const { data } = await this.$listeners.import('json')
				if (data.zwave && data.mqtt && data.gateway) {
					this.$store.dispatch('import', data)
					this.showSnackbar('Configuration imported successfully')
				} else {
					this.showSnackbar('Imported settings not valid')
				}
				// eslint-disable-next-line no-empty
			} catch (error) {}
		},
		exportSettings() {
			const settings = this.getSettingsJSON()
			this.$listeners.export(settings, 'settings')
		},
		getSettingsJSON() {
			return {
				mqtt: this.newMqtt,
				gateway: this.newGateway,
				zwave: this.newZwave,
			}
		},
		editItem(item) {
			this.editedIndex = this.newGateway.values.indexOf(item)
			this.editedValue = Object.assign({}, item)
			this.dialogValue = true
		},
		async deleteItem(item) {
			const index = this.newGateway.values.indexOf(item)
			;(await this.$listeners.showConfirm(
				'Attention',
				'Are you sure you want to delete this item?',
				'alert'
			)) && this.newGateway.values.splice(index, 1)
		},
		closeDialog() {
			this.dialogValue = false
			setTimeout(() => {
				this.editedValue = Object.assign({}, this.defaultValue)
				this.editedIndex = -1
			}, 300)
		},
		deviceName(deviceID) {
			const device = this.devices.find((d) => d.value === deviceID)
			return device ? device.name : deviceID
		},
		saveValue() {
			if (this.editedIndex > -1) {
				this.$set(
					this.newGateway.values,
					this.editedIndex,
					this.editedValue
				)
			} else {
				this.newGateway.values.push(this.editedValue)
			}
			this.closeDialog()
		},
		async update() {
			if (this.$refs.form_settings.validate()) {
				try {
					const data = await ConfigApis.updateConfig(
						this.getSettingsJSON()
					)
					this.showSnackbar(data.message)
					this.$store.dispatch('init', data.data)
				} catch (error) {
					console.log(error)
				}
			} else {
				this.showSnackbar('Your configuration contains errors, fix it')
			}
		},
		resetConfig() {
			this.newGateway = copy(this.gateway)
			this.newZwave = copy(this.zwave)
			this.newMqtt = copy(this.mqtt)
		},
		async getConfig() {
			try {
				const data = await ConfigApis.getConfig()
				if (!data.success) {
					this.showSnackbar(
						'Error while retriving configuration, check console'
					)
					console.log(data)
				} else {
					this.$store.dispatch('init', data)
					this.resetConfig()
				}
			} catch (error) {
				this.showSnackbar(error.message)
				console.log(error)
			}
		},
	},
	mounted() {
		// hide socket status indicator from toolbar
		this.$emit('updateStatus')
		this.getConfig()
	},
}
</script>
