<template>
	<v-dialog
		v-model="isOpen"
		@keydown.esc="close()"
		max-width="1000px"
		persistent
	>
		<v-card :loading="loading">
			<v-card-title>
				<v-row class="pa-2" align="center">
					<span class="text-h5">Nodes Manager</span>
					<v-spacer></v-spacer>
					<v-btn icon="clear" @click="close()" />
				</v-row>
			</v-card-title>

			<v-divider />

			<v-card-text v-if="isOpen" class="pa-0">
				<v-stepper
					v-model="currentStep"
					@update:model-value="changeStep"
					elevation="0"
				>
					<v-stepper-header>
						<template v-for="s in steps" :key="`${s.key}-step`">
							<v-stepper-item
								:complete="currentStep > s.index"
								:value="s.index"
								:color="
									currentStep > s.index
										? 'success'
										: 'primary'
								"
								:editable="
									!['s2Classes', 's2Pin'].includes(s.key) &&
									!loading
								"
							>
								{{ s.title }}
							</v-stepper-item>

							<v-divider
								v-if="s.index !== steps.length"
								:key="s.index"
							></v-divider>
						</template>
					</v-stepper-header>

					<v-stepper-window>
						<v-stepper-window-item
							v-for="s in steps"
							:key="`${s.key}-content`"
							:value="s.index"
						>
							<v-card ref="content" elevation="0">
								<v-card-text v-if="s.key == 'action'">
									<v-radio-group
										v-model="s.values.action"
										mandatory
									>
										<v-radio
											:disabled="state === 'start'"
											:value="0"
										>
											<template #label>
												<div class="option">
													<v-icon
														color="success"
														size="small"
														>add_circle</v-icon
													>
													<strong>Inclusion</strong>
													<small
														>Add a new device to the
														network</small
													>
												</div>
											</template>
										</v-radio>
										<v-radio
											:disabled="state === 'start'"
											:value="1"
										>
											<template #label>
												<div class="option">
													<v-icon
														color="amber-accent-4"
														size="small"
														>autorenew</v-icon
													>
													<strong>Replace</strong>
													<small
														>Replace a failed
														device</small
													>
												</div>
											</template>
										</v-radio>
										<v-radio
											:disabled="state === 'start'"
											:value="2"
										>
											<template #label>
												<div class="option">
													<v-icon
														color="error"
														size="small"
														>remove_circle</v-icon
													>
													<strong>Exclusion</strong>
													<small
														>Remove device from
														network</small
													>
												</div>
											</template>
										</v-radio>
									</v-radio-group>

									<v-card-actions>
										<v-btn
											v-if="state !== 'start'"
											color="primary"
											variant="flat"
											@click.stop="nextStep"
											class="next-btn"
											@keypress.enter="nextStep"
										>
											Next
										</v-btn>

										<v-btn
											v-else
											variant="flat"
											color="error"
											class="next-btn"
											@click="stopAction"
										>
											Stop running {{ currentAction }}
										</v-btn>
									</v-card-actions>
								</v-card-text>

								<v-card-text v-if="s.key == 'replaceFailed'">
									<v-combobox
										label="Node"
										v-model="s.values.replaceId"
										:items="
											nodes.filter(
												(n) => !n.isControllerNode,
											)
										"
										return-object
										chips
										hint="Failed node to remove. Write the node Id and press enter if not present"
										persistent-hint
										item-title="_name"
									></v-combobox>
									<v-card-actions>
										<v-btn
											variant="flat"
											color="primary"
											@click.stop="nextStep"
											class="next-btn"
											@keypress.enter="nextStep"
										>
											Next
										</v-btn>
									</v-card-actions>
								</v-card-text>

								<v-card-text v-if="s.key == 'inclusionNaming'">
									<v-form
										ref="namingForm"
										v-model="validNaming"
										validate-on="lazy"
										@submit.prevent
									>
										<p>
											Auto assign a name/location to this
											node when it is added. Leave empty
											to ignore
										</p>
										<v-text-field
											label="Name"
											persistent-hint
											autofocus
											hint="Node name"
											:rules="[validateTopic]"
											v-model.trim="s.values.name"
										>
										</v-text-field>
										<v-text-field
											label="Location"
											class="mb-2"
											persistent-hint
											:rules="[validateTopic]"
											hint="Node location"
											v-model.trim="s.values.location"
										>
										</v-text-field>
									</v-form>

									<v-card-actions>
										<v-btn
											variant="flat"
											color="primary"
											@click.stop="submitNameLoc"
											class="next-btn"
											@keypress.enter="submitNameLoc"
										>
											Next
										</v-btn>
									</v-card-actions>
								</v-card-text>

								<v-card-text v-if="s.key == 'inclusionMode'">
									<div v-if="!loading">
										<v-radio-group
											:modelValue="s.values.inclusionMode"
											@update:modelValue="
												setInclusionMode
											"
											mandatory
										>
											<missing-keys-alert />
											<v-radio
												:value="
													InclusionStrategy.Default
												"
											>
												<template #label>
													<div class="option">
														<v-icon
															color="success"
															size="small"
															>add_circle</v-icon
														>
														<strong>Default</strong>
														<small
															>S2 when supported,
															S0 only when
															necessary, no
															encryption
															otherwise. Requires
															user
															interaction</small
														>
													</div>
												</template>
											</v-radio>
											<v-radio
												:value="
													InclusionStrategy.SmartStart
												"
											>
												<template #label>
													<div class="option">
														<v-icon
															color="primary"
															size="small"
															>smart_button</v-icon
														>
														<strong
															>Scan QR
															Code</strong
														>
														<small
															>S2 only. Allows
															pre-configuring the
															device inclusion
															settings, which will
															then happen without
															user
															interaction</small
														>
													</div>
												</template>
											</v-radio>
											<v-radio
												:value="
													InclusionStrategy.Security_S0
												"
											>
												<template #label>
													<div class="option">
														<v-icon
															color="amber-accent-4"
															size="small"
															>lock</v-icon
														>
														<strong
															>S0
															encryption</strong
														>
														<small
															>Use S0
															encryption</small
														>
													</div>
												</template>
											</v-radio>
											<v-radio
												:value="
													InclusionStrategy.Insecure
												"
											>
												<template #label>
													<div class="option">
														<v-icon
															color="error"
															size="small"
															>no_encryption</v-icon
														>
														<strong
															>No
															encryption</strong
														>
														<small
															>Do not use
															encryption</small
														>
													</div>
												</template>
											</v-radio>
										</v-radio-group>

										<v-checkbox
											v-if="
												s.values.inclusionMode ==
												InclusionStrategy.Default
											"
											class="mb-2"
											v-model="s.values.forceSecurity"
											label="Force Security"
											hint="Prefer S0 over no encryption"
											persistent-hint
										></v-checkbox>
									</div>

									<v-col
										v-else
										class="d-flex flex-column align-center"
									>
										<v-icon
											size="60"
											color="
												primary"
											>all_inclusive</v-icon
										>
										<p
											v-if="state === 'start'"
											class="mt-3 text-h5 text-center"
										>
											Inclusion is started. Please put
											your device in INCLUSION MODE
										</p>
										<p
											v-else-if="nvmProgress > 0"
											class="mt-3 text-h5 text-center"
										>
											Waiting for NVM Backup...
										</p>
										<p
											v-else
											class="mt-3 text-h5 text-center"
										>
											Inclusion stopped. Checking for
											changes...
										</p>
									</v-col>

									<v-card-actions>
										<v-btn
											v-if="!loading"
											variant="flat"
											color="primary"
											@click.stop="nextStep"
											class="next-btn"
											@keypress.enter="nextStep"
										>
											Next
										</v-btn>
										<v-btn
											v-if="state === 'start'"
											variant="flat"
											color="error"
											@click="stopAction"
										>
											Stop running {{ currentAction }}
										</v-btn>
									</v-card-actions>
								</v-card-text>

								<v-card-text
									v-if="s.key == 'replaceInclusionMode'"
								>
									<v-radio-group
										v-if="!loading"
										v-model="s.values.inclusionMode"
										mandatory
									>
										<v-radio :value="1">
											<template #label>
												<div class="option">
													<v-icon
														color="primary"
														size="small"
														>smart_button</v-icon
													>
													<strong
														>S2 - Scan QR</strong
													>
													<small
														>S2 only. Allows to
														include node scanning a
														S2 only QR-Code</small
													>
												</div>
											</template>
										</v-radio>
										<v-radio :value="4">
											<template #label>
												<div class="option">
													<v-icon
														color="success"
														size="small"
														>enhanced_encryption</v-icon
													>
													<strong>S2</strong>
													<small>S2 security</small>
												</div>
											</template>
										</v-radio>
										<v-radio :value="3">
											<template #label>
												<div class="option">
													<v-icon
														color="primary"
														size="small"
														>lock</v-icon
													>
													<strong>S0</strong>
													<small>S0 security</small>
												</div>
											</template>
										</v-radio>
										<v-radio :value="2">
											<template #label>
												<div class="option">
													<v-icon
														color="amber-accent-4"
														size="small"
														>no_encryption</v-icon
													>
													<strong
														>No encryption</strong
													>
													<small
														>Do not use
														encryption</small
													>
												</div>
											</template>
										</v-radio>
									</v-radio-group>

									<v-col
										v-else
										class="d-flex flex-column align-center"
									>
										<v-icon
											size="60"
											color="
												primary"
											>all_inclusive</v-icon
										>
										<p class="mt-3 text-h5 text-center">
											Inclusion is started. Please put
											your device in INCLUSION MODE
										</p>
									</v-col>

									<v-card-actions>
										<v-btn
											v-if="!loading"
											variant="flat"
											color="primary"
											@click.stop="nextStep"
											class="next-btn"
											@keypress.enter="nextStep"
										>
											Next
										</v-btn>
										<v-btn
											v-if="state === 'start'"
											variant="flat"
											color="error"
											@click="stopAction"
										>
											Stop
										</v-btn>
									</v-card-actions>
								</v-card-text>

								<v-card-text v-if="s.key == 's2Classes'">
									<div v-if="!loading">
										<v-checkbox
											:disabled="
												s.values.s2AccessControl ===
												undefined
											"
											v-model="s.values.s2AccessControl"
											label="S2 Access Control"
											hint="Example: Door Locks, garage doors"
											persistent-hint
										></v-checkbox>
										<v-checkbox
											:disabled="
												s.values.s2Authenticated ===
												undefined
											"
											v-model="s.values.s2Authenticated"
											label="S2 Authenticated"
											hint="Example: Lighting, Sensors, Security Systems"
											persistent-hint
										></v-checkbox>
										<v-checkbox
											:disabled="
												s.values.s2Unauthenticated ===
												undefined
											"
											v-model="s.values.s2Unauthenticated"
											label="S2 Unauthenticated"
											hint="Like S2 Authenticated but without verification that the correct device is included"
											persistent-hint
										></v-checkbox>
										<v-checkbox
											:disabled="
												s.values.s0Legacy === undefined
											"
											v-model="s.values.s0Legacy"
											label="S0 legacy"
											hint="Example: Legacy door locks without S2 support"
											persistent-hint
										></v-checkbox>
										<v-checkbox
											:disabled="
												s.values.clientAuth ===
												undefined
											"
											v-model="s.values.clientAuth"
											label="Client-side authentication"
											hint="Authentication of the inclusion happens on the device instead of on the controller (for devices without DSK)"
											persistent-hint
										></v-checkbox>

										<v-card-actions>
											<v-btn
												v-if="!aborted"
												variant="flat"
												color="primary"
												@click.stop="nextStep"
												class="next-btn"
												@keypress.enter="nextStep"
											>
												Next
											</v-btn>

											<v-btn
												color="error"
												variant="flat"
												@click="abortInclusion"
											>
												Abort
											</v-btn>
										</v-card-actions>
									</div>
									<div v-else>
										<v-col class="text-center">
											<v-progress-circular
												size="64"
												indeterminate
												color="primary"
											></v-progress-circular>
											<p class="mt-3 text-h5">
												Waiting response from node...
											</p>
										</v-col>
									</div>
								</v-card-text>

								<v-card-text v-if="s.key == 's2Pin'">
									<div v-if="!loading">
										<v-text-field
											label="DSK Pin"
											class="mb-2"
											autofocus
											persistent-hint
											hint="Enter the 5-digit PIN for your device and verify that the rest of digits matches the one that can be found on your device manual"
											inputmode="numeric"
											v-model.trim="s.values.pin"
											validate-on="blur"
											:error="
												!!s.values.pin &&
												validPin(s.values.pin) !== true
											"
											:suffix="
												$vuetify.display.xs
													? ''
													: s.suffix
											"
										>
										</v-text-field>

										<code
											class="code font-weight-bold"
											v-if="$vuetify.display.xs"
										>
											{{ s.suffix }}
										</code>

										<v-card-actions>
											<v-btn
												v-if="!aborted"
												variant="flat"
												color="primary"
												:disabled="
													validPin(s.values.pin) !==
													true
												"
												@click.stop="nextStep"
												class="next-btn"
												@keypress.enter="nextStep"
											>
												Next
											</v-btn>

											<v-btn
												color="error"
												variant="flat"
												@click="abortInclusion"
											>
												Abort
											</v-btn>
										</v-card-actions>
									</div>
									<div v-else>
										<v-col class="text-center">
											<v-progress-circular
												size="64"
												indeterminate
												color="primary"
											></v-progress-circular>
											<p class="mt-3 text-h5">
												Waiting response from node...
											</p>
										</v-col>
									</div>
								</v-card-text>

								<v-card-text v-if="s.key == 'done'">
									<v-col
										class="d-flex flex-column align-center"
									>
										<v-icon
											size="60"
											:color="
												s.success
													? 'success'
													: 'warning'
											"
											>{{
												s.success
													? 'check_circle'
													: 'warning'
											}}</v-icon
										>
										<p
											v-text="s.text"
											class="mt-3 text-h5 text-center"
										></p>
										<p
											v-if="s.error"
											v-text="s.error"
											class="text-h5 text-center text-error"
										></p>
									</v-col>
								</v-card-text>
							</v-card>
						</v-stepper-window-item>
					</v-stepper-window>
				</v-stepper>

				<v-alert
					class="mt-3 mb-0"
					v-if="alert"
					density="compact"
					text
					:type="alert.type"
					>{{ alert.text }}</v-alert
				>
			</v-card-text>
		</v-card>
	</v-dialog>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import { mapState } from 'pinia'
import { tryParseDSKFromQRCodeString } from '@zwave-js/core'

import {
	parseSecurityClasses,
	securityClassesToArray,
	copy,
	validTopic,
} from '../../lib/utils.js'
import useBaseStore from '../../stores/base.js'
import { InclusionStrategy, SecurityBootstrapFailure } from 'zwave-js'
import InstancesMixin from '../../mixins/InstancesMixin.js'
import { nextTick } from 'vue'

export default {
	props: {
		socket: Object,
	},
	components: {
		MissingKeysAlert: defineAsyncComponent(
			() => import('../custom/MissingKeysAlert.vue'),
		),
	},
	mixins: [InstancesMixin],
	data() {
		return {
			isOpen: false,
			currentStep: 1,
			loading: false,
			validNaming: true,
			InclusionStrategy,
			availableSteps: {
				action: {
					key: 'action',
					title: 'Action',
					values: {
						action: 0, //inclusion
					},
				},
				inclusionNaming: {
					key: 'inclusionNaming',
					title: 'Name and Location',
					values: {
						name: '',
						location: '',
					},
				},
				inclusionMode: {
					key: 'inclusionMode',
					title: 'Inclusion Mode',
					values: {
						inclusionMode: InclusionStrategy.Default, //default, smartstart no encryption
						forceSecurity: false,
					},
				},
				replaceInclusionMode: {
					key: 'replaceInclusionMode',
					title: 'Inclusion Mode',
					values: {
						inclusionMode: InclusionStrategy.Default, //default, smartstart no encryption
					},
				},
				s2Classes: {
					key: 's2Classes',
					title: 'Security Classes',
					values: {
						s2AccessControl: undefined,
						s2Authenticated: undefined,
						s2Unauthenticated: undefined,
						s0Legacy: undefined,
						clientAuth: false,
					},
				},
				s2Pin: {
					key: 's2Pin',
					title: 'DSK validation',
					suffix: '', // Ex: '-12345-12345-12345-12345-12345-12345-12345',
					values: {
						pin: '',
					},
				},
				replaceFailed: {
					key: 'replaceFailed',
					title: 'Node Id',
					values: {
						replaceId: null, //default
					},
				},
				done: {
					key: 'done',
					success: false,
					title: 'Done',
					text: 'Test',
					error: false,
				},
			},
			steps: [],
			state: 'new',
			commandEndDate: null,
			commandTimer: null,
			waitTimeout: null,
			alert: null,
			nodeFound: null,
			currentAction: null,
			nodeProps: {},
			stopped: false,
			aborted: false,
			nvmProgress: 0,
			commandTimedOut: false,
		}
	},
	computed: {
		...mapState(useBaseStore, [
			'appInfo',
			'zwave',
			'nodes',
			'mqtt',
			'backup',
		]),
		timeoutMs() {
			return this.zwave.commandsTimeout * 1000 + 800 // add small buffer
		},
		controllerStatus() {
			return this.appInfo.controllerStatus?.status
		},
	},
	watch: {
		commandEndDate(newVal) {
			if (this.commandTimer) {
				clearInterval(this.commandTimer)
				this.commandTimer = null
			}

			if (!newVal) return

			this.commandTimer = setInterval(() => {
				const now = Date.now()
				const end = newVal.getTime() - 1000 // add small buffer to end before controller trigger
				const s = Math.trunc((end - now) / 1000)
				if (this.state === 'start') {
					this.alert = {
						type: 'info',
						text: `${this.currentAction} started: ${s}s remaining`,
					}
				}

				// timeout ended
				if (s <= 0) {
					this.commandTimedOut = true
					clearInterval(this.commandTimer)
					this.alert = null
				}
			}, 250)
		},
		controllerStatus(status) {
			if (!status) return
			this.nvmProgress = 0
			if (status.indexOf('clusion') > 0) {
				// it could be inclusion is started by the driver, in that case get the current action
				this.currentAction = /inclusion/i.test(status)
					? 'Inclusion'
					: 'Exclusion'

				// inclusion/exclusion started, start the countdown timer
				if (status.indexOf('started') > 0) {
					this.commandEndDate = new Date(
						new Date().getTime() + this.timeoutMs,
					)
					this.nodeFound = null
					this.state = 'start'
				} else if (status.indexOf('stopped') > 0) {
					// inclusion/exclusion stopped, check what happened

					// inclusion has been stopped manually
					if (this.stopped || this.commandTimedOut) {
						this.stopped = false
						this.showResults()
					} else {
						// inclusion stopped by controller, see if a node was found
						let timeout =
							this.currentAction === 'Exclusion' ? 3000 : 5000
						this.state = 'wait'

						// when a node is added/removed showResults it's called from socket event listeners
						// (onNodeAdded onNodeRemoved) set a timeout in case the events for some reason are not received
						// fixes issue #2746
						this.waitTimeout = setTimeout(
							() => this.showResults(),
							timeout,
						) // add additional discovery time
					}
				} else {
					// error
					this.commandEndDate = null
					this.alert = {
						type: 'error',
						text: status, // TODO: better formatting?
					}
					this.state = 'stop'
				}
			} else if (status.indexOf('Backup NVM progress') >= 0) {
				const progress = status.match(/(\d+)%/)
				if (progress && progress.length > 1) {
					this.nvmProgress = parseInt(progress[1])
					this.alert = {
						type: 'info',
						text: `NVM backup: ${this.nvmProgress}%`,
					}
				}
			}
		},
	},
	mounted() {
		this.onKeypressed = (event) => {
			if (!this.isOpen) {
				return
			}

			if (event.key === 'Enter') {
				this.dispatchEnter()
			}
		}

		window.addEventListener('keydown', this.onKeypressed)
	},
	beforeUnmount() {
		this.init(false)
		window.removeEventListener('keydown', this.onKeypressed)
	},
	methods: {
		setInclusionMode(v) {
			const s = this.steps[this.currentStep - 1]
			if (typeof v !== 'number') {
				s.values.forceSecurity = v
				return
			}

			s.values.inclusionMode = v
		},
		async submitNameLoc() {
			const result = await this.$refs.namingForm[0].validate()
			if (result.valid) {
				this.nextStep()
			}
		},
		validPin(pin) {
			return pin?.length === 5 || 'PIN must be 5 digits'
		},
		dispatchEnter() {
			const isDoneStep = this.steps[this.currentStep - 1]?.key === 'done'

			if (isDoneStep) {
				this.changeStep(0)
			} else {
				// for some reason using @keydown.enter on buttons isn't working
				// this trick is used to dispatch the enter event to the button
				const button = this.$refs.content[0].$el.querySelector(
					'.next-btn:not([disabled])',
				)

				if (button) {
					button.click()
				}
			}
		},
		onNodeAdded({ node, result }) {
			this.nodeFound = node
			if (this.loading) {
				this.showResults(result)
			}
		},
		onNodeRemoved(node) {
			this.nodeFound = node

			// the add/remove dialog is waiting for a feedback
			if (this.waitTimeout) {
				this.showResults()
			}
		},
		async onParseQrCode(data) {
			const res = data.result
			let provisioning = res.parsed

			if (provisioning) {
				// add name and location to provisioning
				if (this.nodeProps) {
					provisioning = {
						...provisioning,
						...this.nodeProps,
					}
				}

				const mode = 4 // s2 only

				const replaceStep = this.steps.find(
					(s) => s.key === 'replaceFailed',
				)
				let replaceId

				if (replaceStep) {
					replaceId = replaceStep.values.replaceId
					if (typeof replaceId === 'object') {
						replaceId = replaceId.id
					} else {
						replaceId = parseInt(replaceId, 10)
					}
				}
				// S2 only, start inclusion
				if (provisioning.version === 0) {
					this.aborted = false
					this.loading = true

					if (replaceStep) {
						this.sendAction('replaceFailedNode', [
							replaceId,
							mode,
							{ provisioning },
						])
					} else {
						if (res.exists) {
							this.alert = {
								type: 'info',
								text: 'Already added to provisioning list',
							}
							this.state = 'stop'
							return
						}

						if (res.nodeId) {
							this.alert = {
								type: 'info',
								text: 'Node already added',
							}
							this.state = 'stop'
							return
						}
						this.sendAction('startInclusion', [
							mode,
							{ provisioning },
						])
					}
				} else if (provisioning.version === 1) {
					// smart start
					if (!replaceStep) {
						const response = await this.app.apiRequest(
							'provisionSmartStartNode',
							[provisioning],
						)

						if (response.success) {
							this.alert = null
							this.aborted = false
							const doneStep = copy(this.availableSteps.done)
							doneStep.text = `Node added to provisioning list`
							doneStep.success = true
							this.pushStep(doneStep)
							this.loading = true
						}
					} else {
						// it's a smart start code btw in replace we cannot use it as smart start
						this.sendAction('replaceFailedNode', [
							replaceId,
							mode,
							{ provisioning },
						])
					}
				}
			}
		},
		changeStep(index) {
			if (index <= 1) {
				this.init() // calling it without the bind parameter will not touch events
			} else {
				this.steps = this.steps.slice(0, index)
			}
		},
		async abortInclusion() {
			this.aborted = true
			this.loading = true
			await this.app.apiRequest('abortInclusion', [])
		},
		onGrantSecurityCC(requested) {
			const grantStep = this.availableSteps.s2Classes
			const classes = requested.securityClasses
			grantStep.values = {
				...grantStep.values,
				...parseSecurityClasses(classes),
				clientAuth: requested.clientSideAuth || undefined,
			}

			if (this.waitTimeout) {
				clearTimeout(this.waitTimeout)
				this.waitTimeout = null
			}

			this.loading = false
			this.alert = false

			this.pushStep(grantStep)
		},
		onValidateDSK(dsk) {
			const dskStep = this.availableSteps.s2Pin
			dskStep.suffix = dsk

			this.loading = false
			this.alert = false

			this.pushStep(dskStep)
		},
		async nextStep() {
			const s = this.steps[this.currentStep - 1]
			if (s.key === 'action') {
				const mode = s.values.action

				if (mode === 0) {
					// inclusion
					this.currentAction = 'Inclusion'
					this.pushStep('inclusionNaming')
				} else if (mode === 1) {
					// replace
					this.currentAction = 'Inclusion'
					this.pushStep('replaceFailed')
				} else if (mode === 2) {
					// exclusion
					this.currentAction = 'Exclusion'
					this.sendAction('startExclusion', [])
				}
			} else if (s.key === 'inclusionNaming') {
				this.nodeProps = {
					name: s.values.name,
					location: s.values.location,
				}
				this.pushStep('inclusionMode')
			} else if (
				s.key === 'inclusionMode' ||
				s.key === 'replaceInclusionMode'
			) {
				let mode = s.values.inclusionMode
				let dsk

				if (mode === InclusionStrategy.SmartStart) {
					this.alert = null

					const qrString = await this.app.confirm(
						'Smart start',
						'Scan QR Code or import it as an image',
						'info',
						{
							qrScan: true,
							tryParseDsk: true,
							canceltext: 'Close',
							width: 500,
						},
					)
					if (!qrString) {
						return
					}

					dsk = tryParseDSKFromQRCodeString(qrString)

					if (!dsk) {
						const response = await this.app.apiRequest(
							'parseQRCodeString',
							[qrString],
						)

						this.onParseQrCode(response)

						return
					} else {
						// prefilled DSK qr code
						mode = InclusionStrategy.Security_S2
					}
				}

				this.aborted = false
				this.loading = true
				const replaceStep = this.steps.find(
					(s) => s.key === 'replaceFailed',
				)

				if (replaceStep) {
					let replaceId = replaceStep.values.replaceId
					if (typeof replaceId === 'object') {
						replaceId = replaceId.id
					} else {
						replaceId = parseInt(replaceId, 10)
					}
					this.sendAction('replaceFailedNode', [replaceId, mode])
				} else {
					this.sendAction('startInclusion', [
						mode,
						{
							forceSecurity: s.values.forceSecurity,
							dsk,
							...this.nodeProps,
						},
					])
				}
			} else if (s.key === 's2Classes') {
				const values = s.values

				const securityClasses = securityClassesToArray(s.values)

				this.loading = true
				await this.app.apiRequest('grantSecurityClasses', [
					{
						securityClasses,
						clientSideAuth: !!values.clientAuth,
					},
				])
			} else if (s.key === 's2Pin') {
				const pin = s.values.pin
				this.loading = true
				await this.app.apiRequest('validateDSK', [pin])
			} else if (s.key === 'replaceFailed') {
				this.currentAction = 'Inclusion'
				this.pushStep('replaceInclusionMode')
			}
		},
		async show(stepOrStepsValues) {
			this.isOpen = true
			this.$emit('open')
			if (typeof stepOrStepsValues === 'object') {
				this.init(true)
				this.steps = []
				for (const s in stepOrStepsValues) {
					const step = await this.pushStep(s)
					Object.assign(step.values, stepOrStepsValues[s])
				}
			} else {
				this.init(true, stepOrStepsValues)
			}
		},
		close() {
			this.isOpen = false
			this.$emit('close')
			this.init(false)
		},
		init(bind, step = 'action') {
			this.steps = []

			if (this.availableSteps[step]) {
				this.pushStep(step)
				// this.pushStep('s2Pin')
			}

			// stop any running inclusion/exclusion
			if (this.state !== 'start') {
				this.stopped = false
				this.currentAction = null
			}

			this.loading = false
			this.nodeProps = {}
			this.alert = null
			this.nodeFound = null
			this.aborted = false

			if (this.waitTimeout) {
				clearTimeout(this.waitTimeout)
				this.waitTimeout = null
			}

			if (this.commandTimer) {
				clearInterval(this.commandTimer)
				this.commandTimer = null
			}

			if (bind && Object.keys(this.bindedSocketEvents).length === 0) {
				this.bindEvent(
					'grantSecurityClasses',
					this.onGrantSecurityCC.bind(this),
				)
				this.bindEvent('validateDSK', this.onValidateDSK.bind(this))
				this.bindEvent('nodeRemoved', this.onNodeRemoved.bind(this))
				this.bindEvent('nodeAdded', this.onNodeAdded.bind(this))
			} else if (bind === false) {
				this.unbindEvents()
			}
		},
		async pushStep(step) {
			const s =
				typeof step === 'string' ? this.availableSteps[step] : step
			s.index = this.steps.length + 1
			this.alert = null
			const newStep = copy(s)
			this.steps.push(newStep)
			await nextTick()
			this.currentStep = newStep.index

			return newStep
		},
		stopAction() {
			this.stopped = true
			this.sendAction('stop' + this.currentAction)
		},
		async sendAction(api, args) {
			this.commandEndDate = null

			let text = ''

			if (this.backup.nvmBackupOnEvent && api.startsWith('start')) {
				text = `Backuping NVM before ${this.currentAction}. Check progress status bar...`
			} else {
				text = `${this.currentAction} ${
					api.startsWith('stop') ? 'stopping…' : 'starting…'
				}`
			}

			this.alert = {
				type: 'info',
				text,
			}

			this.state = 'wait' // make sure user can't trigger another action too soon
			const response = await this.app.apiRequest(api, args)

			if (response.success) {
				// done
			} else {
				if (api === 'replaceFailedNode') {
					this.init()
				}
			}
		},
		getSecurityBootstrapError(val) {
			switch (val) {
				case SecurityBootstrapFailure.NodeCanceled:
					return 'Security bootstrap canceled by the included node'
				case SecurityBootstrapFailure.NoKeysConfigured:
					return 'Required security keys not configured'
				case SecurityBootstrapFailure.ParameterMismatch:
					return 'No possible match in encryption parameters between the controller and the node'
				case SecurityBootstrapFailure.S2IncorrectPIN:
					return 'Incorrect S2 PIN'
				case SecurityBootstrapFailure.S2NoUserCallbacks:
					return 'No user callbacks'
				case SecurityBootstrapFailure.S2WrongSecurityLevel:
					return 'Security keys mismatch between the controller and the node'
				case SecurityBootstrapFailure.Timeout:
					return 'Expected message was not received within the corresponding timeout'
				case SecurityBootstrapFailure.Unknown:
					return 'Unknown error'
				case SecurityBootstrapFailure.UserCanceled:
					return 'Security bootstrap canceled by the user'
				default:
					return 'Unknown error'
			}
		},
		showResults(result) {
			if (this.waitTimeout) {
				clearTimeout(this.waitTimeout)
				this.waitTimeout = null
			}

			if (this.nodeFound === null) {
				this.alert = {
					type: 'warning',
					text: this.commandTimedOut
						? `Timed Out! No device has been found to complete ${this.currentAction}`
						: `${this.currentAction} stopped, no changes detected`,
				}
			} else if (this.currentAction === 'Exclusion') {
				this.alert = null
				this.aborted = false
				const doneStep = copy(this.availableSteps.done)
				doneStep.text = `Node ${this.nodeFound.id} removed`
				doneStep.success = true
				this.pushStep(doneStep)
			} else {
				this.alert = null
				this.aborted = false
				const doneStep = copy(this.availableSteps.done)
				doneStep.text = `Node ${
					this.nodeFound.id
				} added with security ${this.nodeFound.security || 'None'}`
				doneStep.error = result.lowSecurityReason
					? this.getSecurityBootstrapError(result.lowSecurityReason)
					: false
				doneStep.success = !(result && result.lowSecurity)
				this.pushStep(doneStep)
			}

			this.loading = false
			this.commandTimedOut = false

			this.state = 'stop'
		},
		validateTopic(name) {
			return this.mqtt.disabled ? true : validTopic(name)
		},
	},
}
</script>

<style scoped>
.option {
	margin-top: 1rem;
}
.option > small {
	color: #888;
	display: block;
	margin: -0.2rem 0 0 1.4rem;
}
</style>
