<template>
	<v-dialog
		v-model="value"
		@keydown.esc="$emit('close')"
		max-width="800px"
		persistent
	>
		<v-card :loading="loading">
			<v-card-title>
				<span class="headline">Nodes Manager</span>
				<v-spacer></v-spacer>
				<v-btn icon @click="$emit('close')"
					><v-icon>clear</v-icon></v-btn
				>
			</v-card-title>

			<v-card-text>
				<v-stepper v-model="currentStep" @change="changeStep">
					<v-stepper-header>
						<template v-for="s in steps">
							<v-stepper-step
								:key="`${s.key}-step`"
								:complete="currentStep > s.index"
								:step="s.index"
								:editable="
									!['s2Classes', 's2Pin'].includes(s.key)
								"
							>
								{{ s.title }}
							</v-stepper-step>

							<v-divider
								v-if="s.index !== steps.length"
								:key="s.index"
							></v-divider>
						</template>
					</v-stepper-header>

					<v-stepper-items>
						<v-stepper-content
							v-for="s in steps"
							:key="`${s.key}-content`"
							:step="s.index"
						>
							<v-card elevation="0">
								<v-card-text v-if="s.key == 'action'">
									<v-radio-group
										v-model="s.values.action"
										mandatory
									>
										<v-radio :value="0">
											<template v-slot:label>
												<div class="option">
													<v-icon
														color="green accent-4"
														small
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
										<v-radio :value="1">
											<template v-slot:label>
												<div class="option">
													<v-icon
														color="amber accent-4"
														small
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
										<v-radio :value="2">
											<template v-slot:label>
												<div class="option">
													<v-icon
														color="red accent-4"
														small
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
											@click.stop="nextStep"
											@keypress.enter="nextStep"
										>
											Next
										</v-btn>

										<v-btn
											v-else
											color="error"
											@click="stopAction"
										>
											Stop
										</v-btn>
									</v-card-actions>
								</v-card-text>
								<v-card-text v-if="s.key == 'replaceFailed'">
									<v-combobox
										label="Node"
										v-model="s.values.replaceId"
										:items="nodes"
										return-object
										chips
										hint="Failed node to remove. Write the node Id and press enter if not present"
										persistent-hint
										item-text="_name"
									></v-combobox>
									<v-card-actions>
										<v-btn
											color="primary"
											@click.stop="nextStep"
											@keypress.enter="nextStep"
										>
											Next
										</v-btn>
									</v-card-actions>
								</v-card-text>

								<v-card-text v-if="s.key == 'inclusionMode'">
									<v-radio-group
										v-if="!loading"
										v-model="s.values.inclusionMode"
										mandatory
									>
										<v-alert
											dense
											border="left"
											type="warning"
											v-if="missingKeys.length > 0"
										>
											Some security keys are missing:
											<strong>{{
												missingKeys.join(', ')
											}}</strong
											>. Please check your zwave settings.
										</v-alert>
										<v-radio :value="0">
											<template v-slot:label>
												<div class="option">
													<v-icon
														color="green accent-4"
														small
														>add_circle</v-icon
													>
													<strong>Default</strong>
													<small
														>S2 when supported, S0
														only when necessary, no
														encryption otherwise.
														Requires user
														interaction</small
													>
												</div>
											</template>
										</v-radio>
										<v-checkbox
											class="mt-0 ml-5"
											v-model="s.values.forceSecurity"
											label="Force Security"
											hint="Prefer S0 over no encryption"
											persistent-hint
										></v-checkbox>
										<v-radio :value="1">
											<template v-slot:label>
												<div class="option">
													<v-icon
														color="primary"
														small
														>smart_button</v-icon
													>
													<strong
														>Scan QR Code</strong
													>
													<small
														>S2 only. Allows
														pre-configuring the
														device inclusion
														settings, which will
														then happen without user
														interaction</small
													>
												</div>
											</template>
										</v-radio>
										<v-radio :value="3">
											<template v-slot:label>
												<div class="option">
													<v-icon
														color="amber accent-4"
														small
														>lock</v-icon
													>
													<strong
														>S0 encryption</strong
													>
													<small
														>Use S0
														encryption</small
													>
												</div>
											</template>
										</v-radio>
										<v-radio :value="2">
											<template v-slot:label>
												<div class="option">
													<v-icon color="error" small
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
										<p class="mt-3 headline text-center">
											Inclusion is started. Please put
											your device in INCLUSION MODE
										</p>
									</v-col>

									<v-card-actions>
										<v-btn
											v-if="!loading"
											color="primary"
											@click.stop="nextStep"
											@keypress.enter="nextStep"
										>
											Next
										</v-btn>
										<v-btn
											v-if="state === 'start'"
											color="error"
											@click="stopAction"
										>
											Stop
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
											<template v-slot:label>
												<div class="option">
													<v-icon
														color="primary"
														small
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
											<template v-slot:label>
												<div class="option">
													<v-icon
														color="green accent-4"
														small
														>enhanced_encryption</v-icon
													>
													<strong>S2</strong>
													<small>S2 security</small>
												</div>
											</template>
										</v-radio>
										<v-radio :value="3">
											<template v-slot:label>
												<div class="option">
													<v-icon
														color="primary"
														small
														>lock</v-icon
													>
													<strong>S0</strong>
													<small>S0 security</small>
												</div>
											</template>
										</v-radio>
										<v-radio :value="2">
											<template v-slot:label>
												<div class="option">
													<v-icon
														color="amber accent-4"
														small
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
										<p class="mt-3 headline text-center">
											Inclusion is started. Please put
											your device in INCLUSION MODE
										</p>
									</v-col>

									<v-card-actions>
										<v-btn
											v-if="!loading"
											color="primary"
											@click.stop="nextStep"
											@keypress.enter="nextStep"
										>
											Next
										</v-btn>
										<v-btn
											v-if="state === 'start'"
											color="error"
											@click="stopAction"
										>
											Stop
										</v-btn>
									</v-card-actions>
								</v-card-text>

								<v-card-text v-if="s.key == 's2Classes'">
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
											s.values.clientAuth === undefined
										"
										v-model="s.values.clientAuth"
										label="Client-side authentication"
										hint="Authentication of the inclusion happens on the device instead of on the controller (for devices without DSK)"
										persistent-hint
									></v-checkbox>

									<v-card-actions v-if="!loading">
										<v-btn
											v-if="!aborted"
											color="primary"
											@click.stop="nextStep"
											@keypress.enter="nextStep"
										>
											Next
										</v-btn>

										<v-btn
											color="error"
											@click="abortInclusion"
										>
											Abort
										</v-btn>
									</v-card-actions>
								</v-card-text>
								<v-card-text v-if="s.key == 's2Pin'">
									<v-text-field
										label="DSK Pin"
										class="mb-2"
										persistent-hint
										hint="Enter the 5-digit PIN for your device and verify that the rest of digits matches the one that can be found on your device manual"
										v-model.trim="s.values.pin"
										:suffix="
											$vuetify.breakpoint.xsOnly
												? ''
												: s.suffix
										"
									>
									</v-text-field>

									<code
										class="code font-weight-bold"
										v-if="$vuetify.breakpoint.xsOnly"
									>
										{{ s.suffix }}
									</code>

									<v-card-actions v-if="!loading">
										<v-btn
											v-if="!aborted"
											color="primary"
											@click.stop="nextStep"
											@keypress.enter="nextStep"
										>
											Next
										</v-btn>

										<v-btn
											color="error"
											@click="abortInclusion"
										>
											Abort
										</v-btn>
									</v-card-actions>
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
										<p class="mt-3 headline text-center">
											{{ s.text }}
										</p>
									</v-col>
								</v-card-text>
							</v-card>
						</v-stepper-content>
					</v-stepper-items>
				</v-stepper>

				<v-alert
					class="mt-3"
					v-if="alert"
					dense
					text
					:type="alert.type"
					>{{ alert.text }}</v-alert
				>
			</v-card-text>
		</v-card>
	</v-dialog>
</template>

<script>
import { mapGetters } from 'vuex'
import { socketEvents } from '@/plugins/socket'
import {
	parseSecurityClasses,
	securityClassesToArray,
	copy,
} from '../../lib/utils.js'

export default {
	props: {
		value: Boolean, // show or hide
		socket: Object,
	},
	data() {
		return {
			currentStep: 1,
			loading: false,
			availableSteps: {
				action: {
					key: 'action',
					title: 'Action',
					values: {
						action: 0, //inclusion
					},
				},
				inclusionMode: {
					key: 'inclusionMode',
					title: 'Inclusion Mode',
					values: {
						inclusionMode: 0, //default, smartstart no encryption
						forceSecurity: false,
					},
				},
				replaceInclusionMode: {
					key: 'replaceInclusionMode',
					title: 'Inclusion Mode',
					values: {
						inclusionMode: 0, //default, smartstart no encryption
					},
				},
				s2Classes: {
					key: 's2Classes',
					title: 'Security Classes',
					values: {
						s2AccessControl: false,
						s2Authenticated: false,
						s2Unauthenticated: false,
						s0Legacy: false,
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
				},
			},
			steps: [],
			state: 'new',
			commandEndDate: new Date(),
			commandTimer: null,
			waitTimeout: null,
			alert: null,
			nodeFound: null,
			currentAction: null,
			bindedSocketEvents: {},
			stopped: false,
			aborted: false,
		}
	},
	computed: {
		...mapGetters(['appInfo', 'zwave', 'nodes']),
		timeoutMs() {
			return this.zwave.commandsTimeout * 1000 + 800 // add small buffer
		},
		controllerStatus() {
			return this.appInfo.controllerStatus?.status
		},
		missingKeys() {
			const keys = this.zwave.securityKeys || {}

			const requiredKeys = [
				'S2_Unauthenticated',
				'S2_Authenticated',
				'S2_AccessControl',
				'S0_Legacy',
			]
			const missing = []
			for (const key of requiredKeys) {
				if (!keys[key] || keys[key].length !== 32) {
					missing.push(key)
				}
			}
			return missing
		},
	},
	watch: {
		value(v) {
			this.init(v)
		},
		commandEndDate(newVal) {
			if (this.commandTimer) {
				clearInterval(this.commandTimer)
			}
			this.commandTimer = setInterval(() => {
				const now = new Date()
				const s = Math.trunc((this.commandEndDate - now) / 1000)
				if (this.state === 'start') {
					this.alert = {
						type: 'info',
						text: `${this.currentAction} started: ${s}s remaining`,
					}
				}
				if (now > newVal) clearInterval(this.commandTimer)
			}, 500)
		},
		controllerStatus(status) {
			if (status && status.indexOf('clusion') > 0) {
				if (this.state === 'new') return // ignore initial status

				// inclusion/exclusion started, start the countdown timer
				if (status.indexOf('started') > 0) {
					this.commandEndDate = new Date(
						new Date().getTime() + this.timeoutMs
					)
					this.nodeFound = null
					this.state = 'start'
				} else if (status.indexOf('stopped') > 0) {
					// inclusion/exclusion stopped, check what happened
					this.commandEndDate = new Date()
					this.state = 'wait'
					let timeout = this.currentAction === 'Exclusion' ? 1000 : 0
					if (this.stopped) {
						timeout = 1000
						this.stopped = false
					}

					if (timeout > 0) {
						// don't use a timeout for inclusion
						this.waitTimeout = setTimeout(this.showResults, timeout) // add additional discovery time
					}
				} else {
					// error
					this.commandEndDate = new Date()
					this.alert = {
						type: 'error',
						text: status, // TODO: better formatting?
					}
					this.state = 'stop'
				}
			}
		},
	},
	methods: {
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
		onApiResponse(data) {
			if (!data.success) {
				if (data.api === 'replaceFailedNode') {
					this.init()
				}
			} else {
				if (data.api === 'parseQRCodeString') {
					const res = data.result
					const provisioning = res.parsed

					if (provisioning) {
						const mode = 4 // s2 only

						const replaceStep = this.steps.find(
							(s) => s.key === 'replaceFailed'
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
								this.$emit(
									'apiRequest',
									'provisionSmartStartNode',
									[provisioning]
								)
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
				} else if (data.api === 'provisionSmartStartNode') {
					this.alert = null
					this.aborted = false
					const doneStep = copy(this.availableSteps.done)
					doneStep.text = `Node added to provisioning list`
					doneStep.success = true
					this.pushStep(doneStep)
					this.loading = true
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
		abortInclusion() {
			this.aborted = true
			this.loading = true
			this.$emit('apiRequest', 'abortInclusion', [])
		},
		onGrantSecurityCC(requested) {
			const grantStep = this.availableSteps.s2Classes
			const classes = requested.securityClasses
			grantStep.values = {
				...grantStep.values,
				...parseSecurityClasses(classes),
				clientAuth: requested.clientSideAuth || undefined,
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
					this.pushStep('inclusionMode')
				} else if (mode === 1) {
					// replace
					this.currentAction = 'Inclusion'
					this.pushStep('replaceFailed')
				} else if (mode === 2) {
					// exclusion
					this.currentAction = 'Exclusion'
					this.sendAction('startExclusion', [])
				}
			} else if (
				s.key === 'inclusionMode' ||
				s.key === 'replaceInclusionMode'
			) {
				const mode = s.values.inclusionMode

				if (mode === 1) {
					this.alert = null

					const qrString = await this.$listeners.showConfirm(
						'Smart start',
						'Scan QR Code or import it as an image',
						'info',
						{
							qrScan: true,
							canceltext: 'Close',
							width: 500,
						}
					)
					if (!qrString) {
						return
					}

					this.$emit('apiRequest', 'parseQRCodeString', [qrString])

					return
				}

				this.aborted = false
				this.loading = true
				const replaceStep = this.steps.find(
					(s) => s.key === 'replaceFailed'
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
						{ forceSecurity: s.values.forceSecurity },
					])
				}
			} else if (s.key === 's2Classes') {
				const values = s.values

				const securityClasses = securityClassesToArray(s.values)

				this.$emit('apiRequest', 'grantSecurityClasses', [
					{
						securityClasses,
						clientSideAuth: !!values.clientAuth,
					},
				])

				this.loading = true
			} else if (s.key === 's2Pin') {
				const mode = s.values.pin
				this.$emit('apiRequest', 'validateDSK', [mode])
				this.loading = true
			} else if (s.key === 'replaceFailed') {
				this.currentAction = 'Inclusion'
				this.pushStep('replaceInclusionMode')
			}
		},
		init(bind) {
			this.steps = []
			this.pushStep('action')

			// stop any running inclusion/exclusion
			if (this.state === 'start') {
				this.stopAction()
			} else {
				this.stopped = false
				this.currentAction = null
			}

			this.loading = false
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

			if (bind) {
				this.bindEvent(
					'grantSecurityClasses',
					this.onGrantSecurityCC.bind(this)
				)
				this.bindEvent('validateDSK', this.onValidateDSK.bind(this))
				this.bindEvent('nodeRemoved', this.onNodeRemoved.bind(this))
				this.bindEvent('nodeAdded', this.onNodeAdded.bind(this))
				this.bindEvent('api', this.onApiResponse.bind(this))
			} else if (bind === false) {
				this.unbindEvents()
			}
		},
		async pushStep(step) {
			const s =
				typeof step === 'string' ? this.availableSteps[step] : step
			s.index = this.steps.length + 1
			this.alert = null
			this.steps.push(copy(s))
			await this.$nextTick()
			this.currentStep = s.index
		},
		stopAction() {
			this.stopped = true
			this.sendAction('stop' + this.currentAction)
		},
		sendAction(api, args) {
			this.commandEndDate = new Date()
			this.alert = {
				type: 'info',
				text: `${this.currentAction} ${
					api.startsWith('stop') ? 'stopping…' : 'starting…'
				}`,
			}

			this.$emit('apiRequest', api, args)
			this.state = 'wait' // make sure user can't trigger another action too soon
		},
		bindEvent(eventName, handler) {
			this.socket.on(socketEvents[eventName], handler)
			this.bindedSocketEvents[eventName] = handler
		},
		unbindEvents() {
			for (const event in this.bindedSocketEvents) {
				this.socket.off(
					socketEvents[event],
					this.bindedSocketEvents[event]
				)
			}

			this.bindedSocketEvents = {}
		},
		showResults(result) {
			if (this.waitTimeout) {
				clearTimeout(this.waitTimeout)
				this.waitTimeout = null
			}

			if (this.nodeFound === null) {
				this.alert = {
					type: 'warning',
					text: `${this.currentAction} stopped, no changes detected`,
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
				} added with security "${this.nodeFound.security || 'None'}"`
				doneStep.success = !(result && result.lowSecurity)
				this.pushStep(doneStep)
			}

			this.loading = false

			this.state = 'stop'
		},
	},
	beforeDestroy() {
		this.init(false)
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
