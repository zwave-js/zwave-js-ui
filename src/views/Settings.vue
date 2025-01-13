<template>
	<v-container fluid grid-list-md class="pt-8 px-0">
		<v-form
			id="form_settings"
			@submit.prevent="update"
			v-model="valid_zwave"
			ref="form_settings"
			class="pb-6 mx-2"
		>
			<v-expansion-panels
				accordion
				multiple
				flat
				class="expansion-panels-outlined"
			>
				<v-expansion-panel key="UI">
					<v-expansion-panel-header>
						<v-row no-gutters>
							<v-col align-self="center"> UI </v-col>
							<v-col class="text-right pr-5">
								<v-btn
									@click.stop="openDocs('general')"
									color="primary"
									outlined
									x-small
								>
									Docs
									<v-icon x-small right>launch</v-icon>
								</v-btn>
							</v-col>
						</v-row>
					</v-expansion-panel-header>
					<v-expansion-panel-content>
						<v-row class="mb-5">
							<v-col cols="12" sm="6">
								<v-input
									label="Dark mode"
									hint="Eanble System Defined, Dark, or Light modes"
									persistent-hint
								>
									<v-btn-toggle
										v-model="btnGrpDarkMode"
										divided
										manditory
									>
										<v-btn value="auto">
											<v-icon>laptop</v-icon>
										</v-btn>

										<v-btn value="true">
											<v-icon>dark_mode</v-icon>
										</v-btn>

										<v-btn value="false">
											<v-icon>light_mode</v-icon>
										</v-btn>
									</v-btn-toggle>
								</v-input>
							</v-col>
							<v-col cols="12" sm="6">
								<v-switch
									hint="Enable this to use Tabs in the top bar instead of a left menu for navigation (useful when integrated in Home Assistant)"
									persistent-hint
									label="Use tabs for navigation"
									v-model="internalNavTabs"
								></v-switch>
							</v-col>
							<v-col cols="12" sm="6">
								<v-switch
									hint="Enable this to hide sensitive informations from the UI"
									persistent-hint
									label="Streamer mode"
									v-model="internalStreamerMode"
								></v-switch>
							</v-col>
						</v-row>
					</v-expansion-panel-content>
					<v-divider />
				</v-expansion-panel>
				<v-expansion-panel key="General">
					<v-expansion-panel-header>
						<v-row no-gutters>
							<v-col align-self="center"> General </v-col>
							<v-col class="text-right pr-5">
								<v-btn
									@click.stop="openDocs('general')"
									color="primary"
									outlined
									x-small
								>
									Docs
									<v-icon x-small right>launch</v-icon>
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
											v-model="newGateway.authEnabled"
										></v-switch>
									</v-col>
									<v-col
										v-if="!sslDisabled"
										cols="12"
										sm="6"
										md="4"
									>
										<v-switch
											hint="Enable this to serve page using HTTPS. REQUIRES APP RELOAD"
											persistent-hint
											label="HTTPS"
											v-model="newGateway.https"
										></v-switch>
									</v-col>
									<v-col cols="12" sm="6" md="4">
										<v-combobox
											hint="You can select a plugin from the list or write the path to your custom plugin and press enter"
											persistent-hint
											label="Plugins"
											:items="[
												'@varet/zj2m-prom-exporter',
												'@kvaster/zwavejs-prom',
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
											v-model="newGateway.logEnabled"
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
											v-model="newGateway.logLevel"
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
											hint="Store logs in a file. Default: store/zwave-js-ui_%DATE%.log"
											persistent-hint
											label="Log to file"
											v-model="newGateway.logToFile"
										></v-switch>
									</v-col>

									<v-col cols="12" sm="6" md="4">
										<v-checkbox
											persistent-hint
											label="Disable changelogs"
											hint="Check this to disable changelogs dialogs on new versions"
											v-model="
												newGateway.disableChangelog
											"
										></v-checkbox>
									</v-col>
									<v-col cols="12" sm="6" md="4">
										<v-checkbox
											persistent-hint
											label="Notify new versions"
											hint="Check this to show a notification when a new version is available"
											v-model="
												newGateway.notifyNewVersions
											"
										></v-checkbox>
									</v-col>
								</v-row>
								<v-subheader class="font-weight-bold">
									Devices values configuration
								</v-subheader>
								<div class="mb-5 caption">
									Add here valueIds specific configurations
									for each device. This means that if you
									create an entry here this configuration will
									be applied to each valueId of each device of
									the same type in your Network.
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
									<template v-slot:top>
										<v-btn
											color="blue darken-1"
											text
											@click="dialogValue = true"
										>
											<v-icon>add</v-icon>

											New Value
										</v-btn>
									</template>
									<template v-slot:[`item.device`]="{ item }">
										{{ deviceName(item.device) }}
									</template>
									<template v-slot:[`item.value`]="{ item }">
										{{
											item.value.label +
											' (' +
											item.value.id +
											')'
										}}
									</template>
									<template v-slot:[`item.topic`]="{ item }">
										{{ item.topic }}
									</template>
									<template
										v-slot:[`item.postOperation`]="{ item }"
									>
										{{
											item.postOperation || 'No operation'
										}}
									</template>
									<template
										v-slot:[`item.enablePoll`]="{ item }"
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
										v-slot:[`item.actions`]="{ item }"
									>
										<v-icon
											small
											class="mr-2"
											color="green"
											@click="editItem(item)"
										>
											edit
										</v-icon>
										<v-icon
											small
											color="red"
											@click="deleteItem(item)"
										>
											delete
										</v-icon>
									</template>
								</v-data-table>

								<v-subheader class="font-weight-bold">
									Scheduled Jobs
								</v-subheader>
								<div class="mb-5 caption">
									Add here a list of scheduled jobs that will
									run specified driver function based on a
									cron expression.
								</div>
								<v-data-table
									:headers="headersJobs"
									:items="newGateway.jobs"
									:items-per-page-options="[
										10,
										20,
										{ text: 'All', value: -1 },
									]"
									class="elevation-1"
								>
									<template v-slot:top>
										<v-btn
											color="blue darken-1"
											text
											@click="editJob()"
										>
											<v-icon>add</v-icon>

											New Value
										</v-btn>
									</template>
									<template v-slot:[`item.code`]="{ item }">
										<code>{{
											item.code.substring(0, 30)
										}}</code>
									</template>
									<template
										v-slot:[`item.enabled`]="{ item }"
									>
										<v-icon
											:color="
												item.enabled ? 'green' : 'red'
											"
										>
											{{
												item.enabled
													? 'check_circle'
													: 'cancel'
											}}
										</v-icon>
									</template>
									<template
										v-slot:[`item.runOnInit`]="{ item }"
									>
										<v-icon
											:color="
												item.runOnInit ? 'green' : 'red'
											"
										>
											{{
												item.runOnInit
													? 'check_circle'
													: 'cancel'
											}}
										</v-icon>
									</template>
									<template
										v-slot:[`item.actions`]="{ item }"
									>
										<v-icon
											small
											class="mr-2"
											color="green"
											@click="editJob(item)"
										>
											edit
										</v-icon>
										<v-icon
											small
											color="red"
											@click="deleteJob(item)"
										>
											delete
										</v-icon>
									</template>
								</v-data-table>
							</v-card-text>
						</v-card>
					</v-expansion-panel-content>
					<v-divider />
				</v-expansion-panel>

				<v-expansion-panel key="Backup">
					<v-expansion-panel-header>
						<v-row no-gutters>
							<v-col align-self="center"> Backup </v-col>
							<v-col class="text-right pr-5">
								<v-btn
									@click.stop="openDocs('backup')"
									color="primary"
									outlined
									x-small
								>
									Docs
									<v-icon x-small right>launch</v-icon>
								</v-btn>
							</v-col>
						</v-row>
					</v-expansion-panel-header>
					<v-expansion-panel-content>
						<v-subheader><strong>STORE</strong></v-subheader>

						<v-row class="mb-5">
							<v-col cols="12" sm="6">
								<v-switch
									hint="Enable/Disable backup"
									persistent-hint
									label="Backup"
									v-model="newBackup.storeBackup"
								></v-switch>
							</v-col>

							<v-col
								v-if="newBackup.storeBackup"
								cols="12"
								sm="6"
							>
								<v-text-field
									hint="Cron string. Default is '0 0 * * *' that means every day at midnight. Press on help button for cron helper editor"
									persistent-hint
									append-icon="help"
									@click:append="
										openUrl(
											'https://crontab.guru/#' +
												newBackup.storeCron
													.split(' ')
													.join('_'),
										)
									"
									label="Cron"
									:rules="[rules.required, rules.validCron]"
									v-model="newBackup.storeCron"
								></v-text-field>
								<strong>{{
									parseCron(newBackup.storeCron) || ''
								}}</strong>
							</v-col>
							<v-col
								v-if="newBackup.storeBackup"
								cols="12"
								sm="6"
							>
								<v-text-field
									hint="How many backups to keep"
									persistent-hint
									:rules="[rules.required, rules.positive]"
									label="Max backup files"
									v-model.number="newBackup.storeKeep"
								></v-text-field>
							</v-col>
						</v-row>

						<v-divider />
						<v-subheader
							><strong
								>Controller (NVM) Backup</strong
							></v-subheader
						>

						<v-alert dense text type="warning">
							Some 700 series controllers may stop functioning
							properly after an NVM backup. Z-Wave JS will try to
							restart (soft reset) the controller afterwards to
							restore normal operation. If that does not work, the
							controller will have to be re-plugged manually.
						</v-alert>

						<v-row class="mb-5">
							<v-col cols="12" sm="6">
								<v-switch
									hint="Enable/Disable backup before node add/remove/replace operations."
									persistent-hint
									label="Backup on event"
									v-model="newBackup.nvmBackupOnEvent"
								></v-switch>
							</v-col>

							<v-col cols="12" sm="6">
								<v-switch
									hint="Enable/Disable backup"
									persistent-hint
									label="Backup"
									v-model="newBackup.nvmBackup"
								></v-switch>
							</v-col>

							<v-col v-if="newBackup.nvmBackup" cols="12" sm="6">
								<v-text-field
									hint="Cron string. Default is '0 0 * * *' that means every day at midnight. Press on help button for cron helper editor"
									persistent-hint
									append-icon="help"
									@click:append="
										openUrl(
											'https://crontab.guru/#' +
												newBackup.nvmCron
													.split(' ')
													.join('_'),
										)
									"
									label="Cron"
									:rules="[rules.required, rules.validCron]"
									v-model="newBackup.nvmCron"
								></v-text-field>
								<strong>{{
									parseCron(newBackup.nvmCron) || ''
								}}</strong>
							</v-col>
							<v-col v-if="newBackup.nvmBackup" cols="12" sm="6">
								<v-text-field
									hint="How many backups to keep"
									persistent-hint
									:rules="[rules.required, rules.positive]"
									label="Max backup files"
									v-model.number="newBackup.nvmKeep"
								></v-text-field>
							</v-col>
						</v-row>
					</v-expansion-panel-content>
					<v-divider />
				</v-expansion-panel>

				<v-expansion-panel key="Zwave">
					<v-expansion-panel-header>
						<v-row no-gutters>
							<v-col align-self="center">
								<v-row align-self="center">
									<span class="my-auto ml-3"> Z-Wave </span>
									<v-checkbox
										class="mt-0 ml-2"
										hide-details
										@click.stop
										label="Enabled"
										v-model="newZwave.enabled"
									></v-checkbox>
								</v-row>
							</v-col>

							<v-col class="text-right pr-5">
								<v-btn
									@click.stop="openDocs('zwave')"
									color="primary"
									outlined
									x-small
								>
									Docs
									<v-icon x-small right>launch</v-icon>
								</v-btn>
							</v-col>
						</v-row>
					</v-expansion-panel-header>
					<v-expansion-panel-content v-if="newZwave.enabled">
						<v-card flat>
							<v-card-text>
								<v-row>
									<v-col cols="12" sm="6">
										<v-combobox
											v-model="newZwave.port"
											label="Serial Port"
											hint="Ex /dev/ttyUSB0. If your port is not listed here just write the port path here"
											persistent-hint
											:rules="[
												rules.required,
												differentPorts,
											]"
											required
											:items="serial_ports"
										></v-combobox>
									</v-col>
									<v-col cols="12" sm="6">
										<v-text-field
											v-model.trim="
												newZwave.deviceConfigPriorityDir
											"
											label="Config priority directory"
											hint="Directory from where device configuration files can be loaded with higher priority than the included ones. This directory does not get indexed and should be used sparingly, e.g. when custom files are absolutely necessary or for testing"
											required
										></v-text-field>
									</v-col>

									<!-- SECURITY KEYS -->
									<v-row
										class="mt-0"
										v-if="newZwave.securityKeys"
									>
										<v-col cols="12">
											<v-subheader
												class="font-weight-bold primary--text"
											>
												Security Keys
											</v-subheader>
										</v-col>
										<v-col cols="12" sm="6">
											<v-text-field
												v-model="
													newZwave.securityKeys
														.S2_Unauthenticated
												"
												label="S2 Unauthenticated"
												prepend-icon="vpn_key"
												@paste="
													fixKey(
														$event,
														'S2_Unauthenticated',
														newZwave.securityKeys,
													)
												"
												:rules="[
													rules.validKey,
													rules.validLength,
													differentKeys(
														newZwave.securityKeys,
													),
												]"
												persistent-hint
												append-outer-icon="wifi_protected_setup"
												:type="
													streamerMode
														? 'password'
														: 'text'
												"
												@click:append-outer="
													randomKey(
														'S2_Unauthenticated',
														newZwave.securityKeys,
													)
												"
											></v-text-field>
										</v-col>
										<v-col cols="12" sm="6">
											<v-text-field
												v-model="
													newZwave.securityKeys
														.S2_Authenticated
												"
												@paste="
													fixKey(
														$event,
														'S2_Authenticated',
														newZwave.securityKeys,
													)
												"
												prepend-icon="vpn_key"
												label="S2 Authenticated"
												persistent-hint
												:rules="[
													rules.validKey,
													rules.validLength,
													differentKeys(
														newZwave.securityKeys,
													),
												]"
												append-outer-icon="wifi_protected_setup"
												:type="
													streamerMode
														? 'password'
														: 'text'
												"
												@click:append-outer="
													randomKey(
														'S2_Authenticated',
														newZwave.securityKeys,
													)
												"
											></v-text-field>
										</v-col>
										<v-col cols="12" sm="6">
											<v-text-field
												v-model="
													newZwave.securityKeys
														.S2_AccessControl
												"
												@paste="
													fixKey(
														$event,
														'S2_AccessControl',
														newZwave.securityKeys,
													)
												"
												prepend-icon="vpn_key"
												label="S2 Access Control"
												:rules="[
													rules.validKey,
													rules.validLength,
													differentKeys(
														newZwave.securityKeys,
													),
												]"
												append-outer-icon="wifi_protected_setup"
												:type="
													streamerMode
														? 'password'
														: 'text'
												"
												@click:append-outer="
													randomKey(
														'S2_AccessControl',
														newZwave.securityKeys,
													)
												"
											></v-text-field>
										</v-col>
										<v-col cols="12" sm="6">
											<v-text-field
												v-model="
													newZwave.securityKeys
														.S0_Legacy
												"
												@paste="
													fixKey($event, 'S0_Legacy')
												"
												prepend-icon="vpn_key"
												label="S0 Legacy"
												:rules="[
													rules.validKey,
													rules.validLength,
													differentKeys(
														newZwave.securityKeys,
													),
												]"
												append-outer-icon="wifi_protected_setup"
												:type="
													streamerMode
														? 'password'
														: 'text'
												"
												@click:append-outer="
													randomKey(
														'S0_Legacy',
														newZwave.securityKeys,
													)
												"
											></v-text-field>
										</v-col>
									</v-row>
									<v-row
										class="mt-0"
										v-if="newZwave.securityKeysLongRange"
									>
										<v-col cols="12">
											<v-subheader
												class="font-weight-bold primary--text"
											>
												Security Keys (Long Range)
											</v-subheader>
										</v-col>
										<v-col cols="12" sm="6">
											<v-text-field
												v-model="
													newZwave
														.securityKeysLongRange
														.S2_Authenticated
												"
												@paste="
													fixKey(
														$event,
														'S2_Authenticated',
														newZwave.securityKeysLongRange,
													)
												"
												prepend-icon="vpn_key"
												label="S2 Authenticated"
												persistent-hint
												:rules="[
													rules.validKey,
													rules.validLength,
													differentKeys(
														newZwave.securityKeysLongRange,
													),
												]"
												append-outer-icon="wifi_protected_setup"
												:type="
													streamerMode
														? 'password'
														: 'text'
												"
												@click:append-outer="
													randomKey(
														'S2_Authenticated',
														newZwave.securityKeysLongRange,
													)
												"
											></v-text-field>
										</v-col>
										<v-col cols="12" sm="6">
											<v-text-field
												v-model="
													newZwave
														.securityKeysLongRange
														.S2_AccessControl
												"
												@paste="
													fixKey(
														$event,
														'S2_AccessControl',
														newZwave.securityKeysLongRange,
													)
												"
												prepend-icon="vpn_key"
												label="S2 Access Control"
												:rules="[
													rules.validKey,
													rules.validLength,
													differentKeys(
														newZwave.securityKeysLongRange,
													),
												]"
												append-outer-icon="wifi_protected_setup"
												:type="
													streamerMode
														? 'password'
														: 'text'
												"
												@click:append-outer="
													randomKey(
														'S2_AccessControl',
														newZwave.securityKeysLongRange,
													)
												"
											></v-text-field>
										</v-col>
									</v-row>
									<!-- END: SECURITY KEYS -->

									<!-- RADIO CONFIGURATION -->
									<v-row class="mt-0">
										<v-col cols="12" class="mb-n8">
											<v-subheader
												class="font-weight-bold primary--text mb-0"
											>
												Default Radio configuration
											</v-subheader>
										</v-col>
										<v-col cols="6">
											<v-select
												label="RF Region"
												persistent-hint
												hint="Will be applied on every startup if the current region of your Z-Wave controller differs. Leave this empty to use the default region of your stick. Not all controllers support changing the region."
												:items="rfRegions"
												clearable
												v-model="newZwave.rf.region"
											>
											</v-select>
										</v-col>
									</v-row>
									<v-row class="mt-0">
										<v-col cols="12" sm="6">
											<v-text-field
												label="Normal Power Level"
												v-model.number="
													newZwave.rf.txPower
														.powerlevel
												"
												persistent-hint
												:min="-10"
												:max="20"
												:step="0.1"
												hint="Power level in dBm. Min -10, Max +14 or +20, depending on the Z-Wave chip. Will be applied on every startup if the current setting of your Z-Wave controller differs. Not all controllers support changing the powerlevel."
												suffix="dBm"
												type="number"
												:rules="[validTxPower]"
											></v-text-field>
										</v-col>
										<v-col cols="12" sm="6">
											<v-text-field
												label="Measured output power at 0 dBm"
												persistent-hint
												v-model.number="
													newZwave.rf.txPower
														.measured0dBm
												"
												:min="-10"
												:max="10"
												:step="0.1"
												hint="Measured output power at 0 dBm in dBm. Min -10, Max +10. Will be applied on every startup if the current setting of your Z-Wave controller differs. Not all controllers support changing the powerlevel."
												suffix="dBm"
												type="number"
												:rules="[validTxPower]"
											></v-text-field>
										</v-col>
									</v-row>
									<!-- END: RADIO CONFIGURATION -->

									<!-- DRIVER LOGS -->
									<v-row class="mt-0">
										<v-col cols="12" class="mb-n8">
											<v-subheader
												class="font-weight-bold primary--text mb-0"
											>
												Driver logs
											</v-subheader>
										</v-col>

										<v-col cols="12" sm="6">
											<v-switch
												hint="Required for debugging issue reports"
												persistent-hint
												label="Enable driver logs"
												v-model="newZwave.logEnabled"
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
											cols="12"
											sm="6"
											v-if="newZwave.logEnabled"
										>
											<v-text-field
												v-model.number="
													newZwave.maxFiles
												"
												label="Max files"
												:rules="[rules.required]"
												required
												persistent-hint
												hint="Maximum number of log files to keep"
												type="number"
											></v-text-field>
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
													newZwave.nodeFilter || []
												"
												multiple
												:rules="[rules.validNodeLog]"
												chips
												deletable-chips
												v-model="newZwave.nodeFilter"
											></v-combobox>
										</v-col>
									</v-row>
									<!-- END: DRIVER LOGS -->

									<!-- STARTUP AND RECOVERY BEHAVIOR -->
									<v-row class="mt-0">
										<v-col cols="12" class="mb-n8">
											<v-subheader
												class="font-weight-bold primary--text mb-0"
											>
												Startup and recovery behavior
											</v-subheader>
										</v-col>

										<v-col cols="12" sm="6">
											<v-switch
												label="Soft Reset"
												hint="Soft Reset is required after some commands like changing the RF region or restoring an NVM backup. Because it may cause problems in Docker containers with certain Z-Wave sticks, this functionality may be disabled. NB: Disabling this functionality only affects 500 series and older controllers"
												persistent-hint
												v-model="
													newZwave.enableSoftReset
												"
											></v-switch>
										</v-col>

										<v-col cols="12" sm="6">
											<v-switch
												hint="Enable this to start driver in bootloader only mode, useful to recover sticks when an FW upgrade fails. When this is enabled stick will NOT be able to communicate with the network."
												persistent-hint
												label="Bootloader only"
												v-model="
													newZwave.allowBootloaderOnly
												"
											></v-switch>
										</v-col>

										<v-col cols="12" sm="6">
											<inverted-checkbox
												hint="When disabled, commands will simply fail when the controller is unresponsive and nodes may get randomly marked as dead until the controller recovers on its own."
												persistent-hint
												label="Controller recovery"
												v-model="
													newZwave.disableControllerRecovery
												"
											></inverted-checkbox>
										</v-col>
										<v-col cols="12" sm="6">
											<inverted-checkbox
												persistent-hint
												label="Watchdog"
												hint="Controllers of the 700 series and newer have a hardware watchdog that can be enabled to automatically reset the chip in case it becomes unresponsive. This option controls whether the watchdog should be enabled"
												v-model="
													newZwave.disableWatchdog
												"
											></inverted-checkbox>
										</v-col>
										<v-col cols="12" sm="6">
											<v-text-field
												v-model.number="
													newZwave.responseTimeout
												"
												label="Response timeout"
												required
												persistent-hint
												suffix="ms"
												hint="How long to wait for a controller response. Leave blank to use default (10000ms)"
												type="number"
											></v-text-field>
										</v-col>

										<v-col cols="12" sm="6">
											<v-checkbox
												hint="This can help with the inclusion or interview of some devices, but can also slow down communication a lot."
												persistent-hint
												label="Increase node report timeout"
												v-model="
													newZwave.higherReportsTimeout
												"
											></v-checkbox>
										</v-col>
									</v-row>
									<!-- END: STARTUP AND RECOVERY BEHAVIOR -->

									<!-- MISC -->
									<v-row class="mt-0">
										<v-col cols="12" class="mb-n8">
											<v-subheader
												class="font-weight-bold primary--text mb-0"
											>
												Misc settings
											</v-subheader>
										</v-col>
										<v-col cols="12" sm="6">
											<v-switch
												hint="Usage statistics allows us to gain insight how `zwave-js` is used, which manufacturers and devices are most prevalent and where to best focus our efforts in order to improve `zwave-js` the most. We do not store any personal information. Details can be found under https://zwave-js.github.io/node-zwave-js/#/data-collection/data-collection?id=usage-statistics"
												persistent-hint
												label="Enable statistics"
												v-model="
													newZwave.enableStatistics
												"
											></v-switch>
										</v-col>

										<input
											type="hidden"
											:value="newZwave.disclaimerVersion"
										/>
										<v-col cols="12" sm="6">
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
																		item,
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
											<v-text-field
												v-model.number="
													newZwave.commandsTimeout
												"
												label="Inclusion/Exclusion timeout"
												:rules="[rules.required]"
												required
												suffix="seconds"
												hint="Seconds to wait before to stop inclusion/exclusion mode"
												type="number"
											></v-text-field>
										</v-col>
										<v-col cols="12" sm="6">
											<v-text-field
												v-model.number="
													newZwave.sendToSleepTimeout
												"
												label="Send to sleep timeout"
												required
												persistent-hint
												suffix="ms"
												hint="How long to wait without pending commands before sending a node back to sleep. Leave blank to use default (250ms)"
												type="number"
											></v-text-field>
										</v-col>
										<v-col cols="12" sm="6">
											<v-text-field
												v-model.number="
													newZwave.maxNodeEventsQueueSize
												"
												label="Node events queue size"
												:rules="[rules.required]"
												required
												hint="Each node stores a queue of events. This is the maximum size of the queue"
												type="number"
											></v-text-field>
										</v-col>
									</v-row>
									<!-- END: MISC -->

									<input
										type="hidden"
										:value="newZwave.options"
									/>
								</v-row>
							</v-card-text>
						</v-card>
					</v-expansion-panel-content>
					<v-divider />
				</v-expansion-panel>

				<v-expansion-panel key="Zniffer">
					<v-expansion-panel-header>
						<v-row no-gutters>
							<v-col align-self="center">
								<v-row align-self="center">
									<span class="my-auto ml-3"> Zniffer </span>
									<v-checkbox
										class="mt-0 ml-2"
										hide-details
										label="Enabled"
										@click.stop
										v-model="newZniffer.enabled"
									></v-checkbox>
								</v-row>
							</v-col>
							<v-col class="text-right pr-5">
								<v-btn
									@click.stop="openDocs('zniffer')"
									color="primary"
									outlined
									x-small
								>
									Docs
									<v-icon x-small right>launch</v-icon>
								</v-btn>
							</v-col>
						</v-row>
					</v-expansion-panel-header>
					<v-expansion-panel-content v-if="newZniffer.enabled">
						<v-card flat>
							<v-card-text>
								<v-row>
									<v-col cols="12" sm="6">
										<v-combobox
											v-model="newZniffer.port"
											label="Serial Port"
											hint="Ex /dev/ttyUSB0. If your port is not listed here just write the port path here"
											persistent-hint
											:rules="[
												rules.required,
												differentPorts,
											]"
											required
											:items="serial_ports"
										></v-combobox>
									</v-col>
									<v-row
										class="mt-0"
										v-if="newZniffer.securityKeys"
									>
										<v-col cols="12">
											<v-subheader
												class="font-weight-bold primary--text"
											>
												Security Keys

												<v-btn
													class="ml-2"
													small
													outlined
													color="warning"
													@click="copyKeysZniffer()"
												>
													Copy from Driver
												</v-btn>
											</v-subheader>
										</v-col>
										<v-col cols="12" sm="6">
											<v-text-field
												v-model="
													newZniffer.securityKeys
														.S2_Unauthenticated
												"
												label="S2 Unauthenticated"
												prepend-icon="vpn_key"
												@paste="
													fixKey(
														$event,
														'S2_Unauthenticated',
														newZniffer.securityKeys,
													)
												"
												:rules="[
													rules.validKey,
													rules.validLength,
													differentKeys(
														newZniffer.securityKeys,
													),
												]"
												persistent-hint
												append-outer-icon="wifi_protected_setup"
												:type="
													streamerMode
														? 'password'
														: 'text'
												"
												@click:append-outer="
													randomKey(
														'S2_Unauthenticated',
														newZniffer.securityKeys,
													)
												"
											></v-text-field>
										</v-col>
										<v-col cols="12" sm="6">
											<v-text-field
												v-model="
													newZniffer.securityKeys
														.S2_Authenticated
												"
												@paste="
													fixKey(
														$event,
														'S2_Authenticated',
														newZniffer.securityKeys,
													)
												"
												prepend-icon="vpn_key"
												label="S2 Authenticated"
												persistent-hint
												:rules="[
													rules.validKey,
													rules.validLength,
													differentKeys(
														newZniffer.securityKeys,
													),
												]"
												append-outer-icon="wifi_protected_setup"
												:type="
													streamerMode
														? 'password'
														: 'text'
												"
												@click:append-outer="
													randomKey(
														'S2_Authenticated',
														newZniffer.securityKeys,
													)
												"
											></v-text-field>
										</v-col>
										<v-col cols="12" sm="6">
											<v-text-field
												v-model="
													newZniffer.securityKeys
														.S2_AccessControl
												"
												@paste="
													fixKey(
														$event,
														'S2_AccessControl',
														newZniffer.securityKeys,
													)
												"
												prepend-icon="vpn_key"
												label="S2 Access Control"
												:rules="[
													rules.validKey,
													rules.validLength,
													differentKeys(
														newZniffer.securityKeys,
													),
												]"
												append-outer-icon="wifi_protected_setup"
												:type="
													streamerMode
														? 'password'
														: 'text'
												"
												@click:append-outer="
													randomKey(
														'S2_AccessControl',
														newZniffer.securityKeys,
													)
												"
											></v-text-field>
										</v-col>
										<v-col cols="12" sm="6">
											<v-text-field
												v-model="
													newZniffer.securityKeys
														.S0_Legacy
												"
												@paste="
													fixKey($event, 'S0_Legacy')
												"
												prepend-icon="vpn_key"
												label="S0 Legacy"
												:rules="[
													rules.validKey,
													rules.validLength,
													differentKeys(
														newZniffer.securityKeys,
													),
												]"
												append-outer-icon="wifi_protected_setup"
												:type="
													streamerMode
														? 'password'
														: 'text'
												"
												@click:append-outer="
													randomKey(
														'S0_Legacy',
														newZniffer.securityKeys,
													)
												"
											></v-text-field>
										</v-col>
									</v-row>
									<v-row
										class="mt-0"
										v-if="newZniffer.securityKeysLongRange"
									>
										<v-col cols="12">
											<v-subheader
												class="font-weight-bold primary--text"
											>
												Security Keys (Long Range)
											</v-subheader>
										</v-col>
										<v-col cols="12" sm="6">
											<v-text-field
												v-model="
													newZniffer
														.securityKeysLongRange
														.S2_Authenticated
												"
												@paste="
													fixKey(
														$event,
														'S2_Authenticated',
														newZniffer.securityKeysLongRange,
													)
												"
												prepend-icon="vpn_key"
												label="S2 Authenticated"
												persistent-hint
												:rules="[
													rules.validKey,
													rules.validLength,
													differentKeys(
														newZniffer.securityKeysLongRange,
													),
												]"
												append-outer-icon="wifi_protected_setup"
												:type="
													streamerMode
														? 'password'
														: 'text'
												"
												@click:append-outer="
													randomKey(
														'S2_Authenticated',
														newZniffer.securityKeysLongRange,
													)
												"
											></v-text-field>
										</v-col>
										<v-col cols="12" sm="6">
											<v-text-field
												v-model="
													newZniffer
														.securityKeysLongRange
														.S2_AccessControl
												"
												@paste="
													fixKey(
														$event,
														'S2_AccessControl',
														newZniffer.securityKeysLongRange,
													)
												"
												prepend-icon="vpn_key"
												label="S2 Access Control"
												:rules="[
													rules.validKey,
													rules.validLength,
													differentKeys(
														newZniffer.securityKeysLongRange,
													),
												]"
												append-outer-icon="wifi_protected_setup"
												:type="
													streamerMode
														? 'password'
														: 'text'
												"
												@click:append-outer="
													randomKey(
														'S2_AccessControl',
														newZniffer.securityKeysLongRange,
													)
												"
											></v-text-field>
										</v-col>
									</v-row>
									<v-col cols="12" sm="6">
										<v-switch
											hint="The RSSI values reported by the Zniffer are not actual RSSI values. They can be converted to dBm, but the conversion is chip dependent and not documented for 700/800 series Zniffers. Set this option to `true` enable the conversion. Otherwise the raw values from the Zniffer will be used."
											persistent-hint
											label="Convert RSSI"
											v-model="newZniffer.convertRSSI"
										></v-switch>
									</v-col>

									<v-col cols="12" sm="6">
										<v-select
											label="Default frequency"
											persistent-hint
											hint="The frequency to initialize the Zniffer with. If not specified, the current setting will be kept."
											:items="znifferRegions"
											clearable
											v-model="
												newZniffer.defaultFrequency
											"
										>
										</v-select>
									</v-col>
									<v-col cols="12"> </v-col>

									<v-col cols="12" sm="6">
										<v-switch
											hint="Enable zniffer logging"
											persistent-hint
											label="Log Enabled"
											v-model="newZniffer.logEnabled"
										></v-switch>
									</v-col>
									<v-col
										v-if="newZniffer.logEnabled"
										cols="12"
										sm="6"
									>
										<v-select
											:items="logLevels"
											v-model="newZniffer.logLevel"
											label="Log Level"
										></v-select>
									</v-col>
									<v-col
										v-if="newZniffer.logEnabled"
										cols="12"
										sm="6"
									>
										<v-switch
											hint="Store zniffer logs in a file (stored in store folder)"
											persistent-hint
											label="Log to file"
											v-model="newZniffer.logToFile"
										></v-switch>
									</v-col>
									<v-col
										cols="12"
										sm="6"
										v-if="newZniffer.logEnabled"
									>
										<v-text-field
											v-model.number="newZniffer.maxFiles"
											label="Max files"
											:rules="[rules.required]"
											required
											persistent-hint
											hint="Maximum number of log files to keep"
											type="number"
										></v-text-field>
									</v-col>
									<v-col
										v-if="newZniffer.logEnabled"
										cols="12"
										sm="6"
									>
										<v-combobox
											hint="Choose which nodes to log. Leave this empty to log all nodes"
											persistent-hint
											label="Log nodes"
											:items="newZniffer.nodeFilter || []"
											multiple
											:rules="[rules.validNodeLog]"
											chips
											deletable-chips
											v-model="newZniffer.nodeFilter"
										></v-combobox>
									</v-col>
								</v-row>
							</v-card-text>
						</v-card>
					</v-expansion-panel-content>
				</v-expansion-panel>
			</v-expansion-panels>

			<v-col cols="12" sm="6" class="ml-1">
				<inverted-checkbox
					persistent-hint
					label="MQTT Gateway"
					hint="Enable MQTT gateway"
					v-model="newMqtt.disabled"
				></inverted-checkbox>
			</v-col>

			<v-expansion-panels
				accordion
				multiple
				flat
				class="expansion-panels-outlined"
			>
				<v-expansion-panel key="mqtt" v-if="!newMqtt.disabled">
					<v-expansion-panel-header>
						<v-row no-gutters>
							<v-col align-self="center"> MQTT </v-col>
							<v-col class="text-right pr-5">
								<v-btn
									@click.stop="openDocs('mqtt')"
									color="primary"
									outlined
									x-small
								>
									Docs
									<v-icon x-small right>launch</v-icon>
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
											v-model.number="newMqtt.port"
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
											v-model.trim="newMqtt.prefix"
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
									<v-col cols="12" sm="6" v-if="secure">
										<v-switch
											hint="Enable this when using self signed certificates"
											persistent-hint
											label="Allow self signed certs"
											v-model="newMqtt.allowSelfsigned"
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
									<v-col v-if="newMqtt.auth" cols="12" sm="4">
										<v-text-field
											v-model="newMqtt.username"
											label="Username"
											:rules="[requiredUser]"
											required
										></v-text-field>
									</v-col>
									<v-col v-if="newMqtt.auth" cols="12" sm="4">
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
											@click:append="() => (e1 = !e1)"
											:type="e1 ? 'password' : 'text'"
										></v-text-field>
									</v-col>
								</v-row>
							</v-card-text>
						</v-card>
					</v-expansion-panel-content>
					<v-divider />
				</v-expansion-panel>

				<v-expansion-panel key="gateway" v-if="!newMqtt.disabled">
					<v-expansion-panel-header>
						<v-row no-gutters>
							<v-col align-self="center"> Gateway </v-col>
							<v-col class="text-right pr-5">
								<v-btn
									@click.stop="openDocs('gateway')"
									color="primary"
									outlined
									x-small
								>
									Docs
									<v-icon x-small right>launch</v-icon>
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
											v-model="newGateway.payloadType"
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
											v-model="newGateway.nodeNames"
										></v-switch>
									</v-col>
									<v-col cols="6">
										<v-switch
											label="Ignore location"
											hint="Don't add nodes location to values topic"
											v-model="newGateway.ignoreLoc"
											persistent-hint
										></v-switch>
									</v-col>
									<v-col cols="6">
										<v-switch
											label="Send Z-Wave events"
											hint="Enable this to get all zwave events in MQTT on _EVENTS topic"
											v-model="newGateway.sendEvents"
											persistent-hint
										></v-switch>
									</v-col>
									<v-col cols="6">
										<v-switch
											label="Ignore status updates"
											hint="Prevent gateway to send updates when a node changes its status (dead/sleep, alive)"
											v-model="newGateway.ignoreStatus"
											persistent-hint
										></v-switch>
									</v-col>
									<v-col
										v-if="newGateway.payloadType !== 2"
										cols="6"
									>
										<v-switch
											label="Include Node info"
											hint="Include Node's Name and Location on Payload"
											v-model="newGateway.includeNodeInfo"
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
					<v-divider />
				</v-expansion-panel>

				<v-expansion-panel key="Hass">
					<v-expansion-panel-header>
						<v-row no-gutters>
							<v-col align-self="center"> Home Assistant </v-col>
							<v-col class="text-right pr-5">
								<v-btn
									@click.stop="openDocs('home-assistant')"
									color="primary"
									outlined
									x-small
								>
									Docs
									<v-icon x-small right>launch</v-icon>
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
											hint="Enable Z-Wave JS websocket server. This can be used with Home Assistant Z-Wave JS integration to discover entities"
											persistent-hint
											label="WS Server"
											v-model="newZwave.serverEnabled"
										></v-switch>
									</v-col>
									<v-col
										v-if="newZwave.serverEnabled"
										cols="6"
									>
										<v-text-field
											v-model.number="newZwave.serverPort"
											label="Server Port"
											:rules="[rules.required]"
											required
											hint="The port to bind the Z-Wave Server. Default: 3000"
											type="number"
										></v-text-field>
										<input
											type="hidden"
											:value="
												newZwave.serverServiceDiscoveryDisabled
											"
										/>
									</v-col>
									<v-col
										v-if="newZwave.serverEnabled"
										cols="6"
									>
										<v-text-field
											v-model="newZwave.serverHost"
											label="Server Host"
											hint="(Optional) The host to bind the Z-Wave Server"
										></v-text-field>
									</v-col>
									<v-col
										v-if="newZwave.serverEnabled"
										cols="6"
									>
										<inverted-checkbox
											hint="Allows applications like Home Assistant to automatically detect and connect to your Z-Wave JS UI instance"
											persistent-hint
											label="DNS Discovery"
											v-model="
												newZwave.serverServiceDiscoveryDisabled
											"
										></inverted-checkbox>
									</v-col>
								</v-row>
								<v-row v-if="!newMqtt.disabled">
									<v-col cols="6">
										<v-switch
											label="MQTT Discovery"
											hint="Create devices in Home Assistant using MQTT discovery. This is an alternative to Home Assistant Z-Wave JS integration"
											v-model="newGateway.hassDiscovery"
											persistent-hint
										></v-switch>
									</v-col>
									<v-col
										cols="6"
										v-if="newGateway.hassDiscovery"
									>
										<v-text-field
											v-model="newGateway.discoveryPrefix"
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
											v-model="newGateway.manualDiscovery"
											persistent-hint
										></v-switch>
									</v-col>
									<v-col
										cols="6"
										v-if="newGateway.hassDiscovery"
									>
										<v-text-field
											v-model="newGateway.entityTemplate"
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
											Default: <code>%ln_%o</code><br />
											-<code>%ln</code>: Node location
											with name
											(<code>&lt;location-?&gt;&lt;name&gt;</code>)<br />-
											<code>%nid</code>: Node ID <br />-
											<code>%n</code>: Node Name <br />-
											<code>%loc</code>: Node Location
											<br />- <code>%p</code>: valueId
											property (fallback to device type)
											<br />- <code>%pk</code>: valueId
											property key (fallback to device
											type) <br />- <code>%pn</code>:
											valueId property name (fallback to
											device type) <br />-
											<code>%o</code>: HASS object_id
											<br />- <code>%l</code>: valueId
											label (fallback to object_id)
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
		<v-row
			:justify="$vuetify.breakpoint.xsOnly ? 'center' : 'end'"
			space-be
			class="sticky-buttons py-3 px-4"
			:style="{
				backgroundColor: internalDarkMode ? '#272727' : '#f5f5f5',
			}"
		>
			<v-btn class="mr-2" small color="red darken-1" @click="resetConfig">
				Reset
				<v-icon right dark>clear</v-icon>
			</v-btn>
			<v-btn
				class="mr-2"
				small
				color="purple darken-1"
				@click="importSettings"
			>
				Import
				<v-icon right dark>file_upload</v-icon>
			</v-btn>
			<v-btn
				class="mr-2"
				small
				color="green darken-1"
				@click="exportSettings"
			>
				Export
				<v-icon right dark>file_download</v-icon>
			</v-btn>
			<v-btn
				class="mr-5"
				small
				color="blue darken-1"
				type="submit"
				:loading="saving"
				:disabled="saving || !settingsChanged"
				form="form_settings"
			>
				Save
				<v-icon right dark>save</v-icon>
			</v-btn>
		</v-row>
	</v-container>
</template>

<script>
import { mapActions, mapState } from 'pinia'
import ConfigApis from '@/apis/ConfigApis'
import { parse } from 'native-url'
import { wait, copy, isUndef, deepEqual } from '../lib/utils'
import { rfRegions, znifferRegions } from '../lib/items'
import cronstrue from 'cronstrue'
import useBaseStore from '../stores/base'

import logger from '../lib/logger'
import InstancesMixin from '../mixins/InstancesMixin'

const log = logger.get('Settings')

export default {
	name: 'Settings',
	mixins: [InstancesMixin],
	components: {
		DialogGatewayValue: () =>
			import('@/components/dialogs/DialogGatewayValue.vue'),
		fileInput: () => import('@/components/custom/file-input.vue'),
		invertedCheckbox: () =>
			import('@/components/custom/InvertedCheckbox.vue'),
	},
	props: {
		socket: {
			type: Object,
			required: true,
		},
	},
	computed: {
		btnGrpDarkMode: {
			get() {
				if (this.darkMode === null) return 'auto'
				if (this.darkMode === true) return 'true'
				return 'false'
			},
			set(value) {
				if (value === 'auto') this.setDarkMode(null)
				else if (value === 'true') this.setDarkMode(true)
				else this.setDarkMode(false)
			},
		},
		internalNavTabs: {
			get() {
				return this.navTabs
			},
			set(value) {
				this.setNavTabs(value)
			},
		},
		internalStreamerMode: {
			get() {
				return this.streamerMode
			},
			set(value) {
				this.setStreamerMode(value)
			},
		},
		settingsChanged() {
			if (!deepEqual(this.newMqtt, this.mqtt)) return true
			if (!deepEqual(this.newGateway, this.gateway)) return true
			if (!deepEqual(this.newZwave, this.zwave)) return true
			if (!deepEqual(this.newBackup, this.backup)) return true
			if (!deepEqual(this.newZniffer, this.zniffer)) return true
			if (!deepEqual(this.ui, this.prevUi)) return true

			return false
		},
		filteredScales() {
			if (this.newZwave.scales && this.newZwave.scales.length > 0) {
				return this.scales.filter(
					(a) =>
						!this.newZwave.scales.find(
							(b) => b.key === a.key && a.label !== b.label,
						),
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
		differentPorts() {
			return (
				!this.newZwave.enabled ||
				!this.newZniffer.enabled ||
				this.newZwave.port !== this.newZniffer.port ||
				'Zniffer and Z-Wave ports must be different.'
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
		...mapState(useBaseStore, [
			'zwave',
			'zniffer',
			'mqtt',
			'gateway',
			'backup',
			'devices',
			'serial_ports',
			'scales',
			'ui',
		]),
		...mapState(useBaseStore, {
			darkMode: (store) => store.ui.darkMode,
			navTabs: (store) => store.ui.navTabs,
			streamerMode: (store) => store.ui.streamerMode,
		}),
	},
	watch: {
		dialogValue(val) {
			val || this.closeDialog()
		},
	},
	data() {
		return {
			rfRegions,
			znifferRegions,
			valid_zwave: true,
			dialogValue: false,
			sslDisabled: false,
			saving: false,
			prevUi: null,
			newGateway: {},
			newMqtt: {},
			newZwave: {
				rf: {
					txPower: {},
				},
			},
			newZniffer: {},
			newBackup: {},
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
			headersJobs: [
				{ text: 'Name', value: 'name' },
				{ text: 'Enabled', value: 'enabled' },
				{ text: 'On Init', value: 'runOnInit' },
				{ text: 'Code', value: 'code' },
				{ text: 'Cron', value: 'cron' },
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
				positive: (value) => {
					return value > 0 || 'Value must be positive.'
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
											index2 > index && a.key === b.key,
									) >= 0,
							) || 'Duplicated sensor type scale'
						)
					}
				},
				validNodeLog: (values) => {
					return (
						!values ||
						values.every((v) => v > 0 && v < 4000) ||
						'Nodes must be between 1-4000'
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
						'Key must be 32 characters length'
					)
				},
				validKey: (value) => {
					return (
						!value ||
						!/[^A-F0-9]+/gi.test(value) ||
						'Key not valid. Must contain only hex chars'
					)
				},
				validCron: (v) => {
					return (
						!v || !!this.parseCron(v) || 'Not a valid cron string'
					)
				},
			},
		}
	},
	methods: {
		...mapActions(useBaseStore, [
			'setDarkMode',
			'setNavTabs',
			'setStreamerMode',
			'initSettings',
			'init',
			'showSnackbar',
		]),
		copyKeysZniffer() {
			this.newZniffer.securityKeys = copy(this.newZwave.securityKeys)
			this.newZniffer.securityKeysLongRange = copy(
				this.newZwave.securityKeysLongRange,
			)
		},
		validTxPower() {
			const { powerlevel, measured0dBm } = this.newZwave.rf?.txPower ?? {}

			const validPower = !isUndef(powerlevel)
			const validMeasured = !isUndef(measured0dBm)

			if (validPower && (powerlevel < -10 || powerlevel > 20)) {
				return 'Power level must be between -10 and 20'
			}

			if (validMeasured && (measured0dBm < -10 || measured0dBm > 10)) {
				return 'Measured 0dBm must be between -10 and 10'
			}

			return (
				(validPower && validMeasured) ||
				(!validPower && !validMeasured) ||
				'Both powerlevel and measured 0 dBm must be set when using custom tx power'
			)
		},
		parseCron(cron) {
			let res
			try {
				res = cronstrue.toString(cron, {
					use24HourTimeFormat: true,
				})
			} catch (err) {
				//ignore
			}

			return res
		},
		differentKeys(obj) {
			return () => {
				const values = Object.values(obj)

				// ensure there are no duplicates
				return (
					values.length === new Set(values).size ||
					'Keys must be different'
				)
			}
		},
		fixKey(event, key, obj) {
			let data = event.clipboardData?.getData('Text')

			if (data) {
				data = data.replace(/0x|,|\s/gi, '')
				this.$set(obj, key, data)
				event.preventDefault()
			}
		},
		openDocs(id) {
			this.openUrl(
				`https://zwave-js.github.io/zwave-js-ui/#/usage/setup?id=${id}`,
			)
		},
		openUrl(url) {
			window.open(url, '_blank')
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
		randomKey(k, obj) {
			let key = ''

			while (key.length < 32) {
				const x = Math.round(Math.random() * 255)
					.toString(16)
					.toUpperCase()
				key += x.length === 2 ? x : '0' + x
			}

			this.$set(obj, k, key)
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
				const { data } = await this.app.importFile('json')
				if (data.zwave && data.mqtt && data.gateway) {
					this.initSettings(data)
					this.showSnackbar(
						'Configuration imported successfully',
						'success',
					)
				} else {
					this.showSnackbar('Imported settings not valid', 'error')
				}
			} catch (error) {
				// noop
			}
		},
		exportSettings() {
			const settings = this.getSettingsJSON()
			this.app.exportConfiguration(settings, 'settings')
		},
		getSettingsJSON() {
			return {
				mqtt: this.newMqtt,
				gateway: this.newGateway,
				zwave: this.newZwave,
				backup: this.newBackup,
				zniffer: this.newZniffer,
				ui: this.ui,
			}
		},
		async editJob(item) {
			const { data: snippets } = await ConfigApis.getSnippets()

			const res = await this.app.confirm(
				item ? 'Edit job' : 'New Job',
				'',
				'info',
				{
					width: 900,
					inputs: [
						{
							type: 'text',
							key: 'name',
							label: 'Name',
							default: item ? item.name : '',
							rules: [this.rules.required],
						},
						{
							type: 'boolean',
							key: 'enabled',
							label: 'Enabled',
							default: item ? item.enabled : true,
						},
						{
							type: 'boolean',
							key: 'runOnInit',
							label: 'Run on init',
							hint: 'Run the job on gateway init',
							default: item ? item.runOnInit : false,
						},
						{
							type: 'text',
							key: 'cron',
							label: 'Cron string',
							default: item ? item.cron : '0 0 * * *',
							hint: "Cron string. Default is '0 0 * * *' that means every day at midnight.",
							rules: [this.rules.validCron],
						},
						{
							type: 'list',
							key: 'snippet',
							label: 'Snippets',
							default: '',
							items: snippets,
							itemText: 'name',
							itemValue: 'name',
							hint: 'Select a snippet from library',
							onChange(values, v) {
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
							type: 'code',
							key: 'code',
							label: 'Code',
							default: item
								? item.code
								: '// Example:\n// const { logger, zwaveClient, require } = this\n// const node = driver.controller.nodes.get(35);\n// await node.refreshInfo();\n// logger.info(`Node ${node.id} is ready: ${node.ready}`);',
							rules: [this.rules.required],
							hint: `Write the function here. The only arg is:
                    <code>driver</code>. The function is <code>async</code>.`,
						},
					],
					confirmText: item ? 'Edit' : 'Add',
				},
			)

			if (res.code) {
				delete res.snippet
				if (item) {
					Object.assign(item, res)
				} else {
					this.newGateway.jobs.push(res)
				}
			}
		},
		async deleteJob(item) {
			const index = this.newGateway.jobs.indexOf(item)

			if (
				index >= 0 &&
				(await this.app.confirm(
					'Attention',
					'Are you sure you want to delete this item?',
					'alert',
				))
			) {
				this.newGateway.jobs.splice(index, 1)
			}
		},
		editItem(item) {
			this.editedIndex = this.newGateway.values.indexOf(item)
			this.editedValue = Object.assign({}, item)
			this.dialogValue = true
		},
		async deleteItem(item) {
			const index = this.newGateway.values.indexOf(item)
			;(await this.app.confirm(
				'Attention',
				'Are you sure you want to delete this item?',
				'alert',
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
				this.newGateway.values.splice(
					this.editedIndex,
					1,
					this.editedValue,
				)
			} else {
				this.newGateway.values.push(this.editedValue)
			}
			this.closeDialog()
		},
		async update() {
			// let inputs to unfocus and trigger any change event, nextTick is not working here
			await wait(200)
			if (this.$refs.form_settings.validate()) {
				try {
					this.saving = true
					useBaseStore().resetNodes()
					const data = await ConfigApis.updateConfig(
						this.getSettingsJSON(),
					)
					this.saving = false
					this.showSnackbar(
						data.message,
						data.success ? 'success' : 'error',
					)
					this.initSettings(data.data)
				} catch (error) {
					log.error(error)
				}
			} else {
				this.showSnackbar(
					'Your configuration contains errors, fix it',
					'error',
				)
			}
		},
		resetConfig() {
			this.newGateway = copy(this.gateway)
			this.newZwave = copy(this.zwave)
			this.newZniffer = copy(this.zniffer)
			this.newMqtt = copy(this.mqtt)
			this.newBackup = copy(this.backup)

			if (this.prevUi) {
				this.internalDarkMode = this.prevUi.darkMode
				this.internalNavTabs = this.prevUi.navTabs
				this.internalStreamerMode = this.prevUi.streamerMode
			} else {
				this.prevUi = copy(this.ui)
			}
		},
		async getConfig() {
			try {
				const data = await ConfigApis.getConfig()
				if (!data.success) {
					this.showSnackbar(
						'Error while retrieving configuration, check console',
						'error',
					)
					log.error(data)
				} else {
					this.init(data)
					this.sslDisabled = data.sslDisabled
					this.resetConfig()
				}
			} catch (error) {
				this.showSnackbar(error.message, 'error')
				log.error(error)
			}
		},
	},
	beforeRouteLeave(to, from, next) {
		if (this.settingsChanged) {
			this.app
				.confirm(
					'Attention',
					'You have unsaved changes. Do you really want to leave?',
					'alert',
				)
				.then((res) => {
					if (res) {
						next()
					}
				})
		} else {
			next()
		}
	},
	mounted() {
		// hide socket status indicator from toolbar
		this.$emit('updateStatus')
		this.getConfig()
	},
}
</script>

<style scoped>
.expansion-panels-outlined {
	border: 1px solid rgba(0, 0, 0, 0.12);
}

.sticky-buttons {
	position: sticky;
	z-index: 3; /* to be above tables */
	bottom: 30px;
}
</style>
