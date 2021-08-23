<template>
	<v-dialog v-model="value" @click:outside="$emit('close')" max-width="800px">
		<v-card>
			<v-card-title>
				<span class="headline">Inclusion Manager</span>
			</v-card-title>

			<v-card-text>
				<v-stepper v-model="currentStep" @change="changeStep">
					<v-stepper-header>
						<template v-for="s in steps">
							<v-stepper-step
								:key="`${s.key}-step`"
								:complete="currentStep > s.index"
								:step="s.index"
								editable
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
								</v-card-text>
								<v-card-text v-if="s.key == 'replaceFailed'">
									<v-text-field
										label="Node ID"
										v-model="s.values.replaceId"
									>
									</v-text-field>
								</v-card-text>

								<v-card-text v-if="s.key == 'inclusionMode'">
									<v-radio-group
										v-model="s.values.inclusionMode"
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
										<v-radio :value="1">
											<template v-slot:label>
												<div class="option">
													<v-icon
														color="primary"
														small
														>smart_button</v-icon
													>
													<strong>Smart start</strong>
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
								</v-card-text>
							</v-card>

							<v-btn color="primary" @click="nextStep">
								Next
							</v-btn>

							<v-btn
								v-if="state === 'wait'"
								text
								@click="stopAction"
							>
								Stop
							</v-btn>
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

export default {
	props: {
		value: Boolean, // show or hide
		nodeAddedOrRemoved: Object,
	},
	data() {
		return {
			currentStep: 1,
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
					},
				},
				s2Classes: {
					key: 's2Classes',
					title: 'Security Classes',
					values: {
						accessControl: true,
						auth: true,
						unAuth: false,
						legacy: true,
						clientAuth: false,
					},
				},
				s2Pin: {
					key: 's2Pin',
					title: 'DSK validation',
					values: {
						pin: '00000',
					},
				},
				replaceFailed: {
					key: 'replaceFailed',
					title: 'Node Id',
					values: {
						replaceId: null, //default
					},
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
		}
	},
	computed: {
		...mapGetters(['appInfo', 'zwave']),
		timeoutMs() {
			return this.zwave.commandsTimeout * 1000 + 800 // add small buffer
		},
		controllerStatus() {
			return this.appInfo.controllerStatus
		},
	},
	mounted() {
		this.init()
	},
	watch: {
		value() {
			this.init()
		},
		nodeAddedOrRemoved(node) {
			this.nodeFound = node

			// the add/remove dialog is waiting for a feedback
			if (this.waitTimeout) {
				this.showResults()
			}
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
			}, 100)
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
					this.alert = {
						type: 'info',
						text: `${this.currentAction} stopped, checking nodes…`,
					}
					this.state = 'wait'
					this.waitTimeout = setTimeout(this.showResults, 5000) // add additional discovery time
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
		copy(o) {
			return JSON.parse(JSON.stringify(o))
		},
		changeStep(index) {
			this.steps = this.steps.slice(0, index)
		},
		nextStep() {
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
			} else if (s.key === 'replaceFailed' || s.key === 'inclusionMode') {
			}
		},
		init() {
			this.steps = []
			this.pushStep('action')
			this.currentAction = null
		},
		async pushStep(stepKey) {
			const s = this.availableSteps[stepKey]
			s.index = this.steps.length + 1
			this.steps.push(this.copy(s))
			await this.$nextTick()
			this.currentStep = s.index
		},
		stopAction() {
			this.sendAction('stop' + this.currentAction)
		},
		sendAction(api, args) {
			this.commandEndDate = new Date()
			this.alert = {
				type: 'info',
				text: `${this.currentAction} ${
					this.method === 'start' ? 'starting…' : 'stopping…'
				}`,
			}

			this.$emit('apiRequest', api, args)
			this.state = 'wait' // make sure user can't trigger another action too soon
		},
		showResults() {
			if (this.waitTimeout) {
				clearTimeout(this.waitTimeout)
				this.waitTimeout = null
			}

			if (this.nodeFound === null) {
				this.alert = {
					type: 'warning',
					text: `${this.currentAction} stopped, no changes detected`,
				}
			} else if (this.mode === 2) {
				this.alert = {
					type: 'success',
					text: `Node ${this.nodeFound.id} removed`,
				}
			} else {
				this.alert = {
					type: 'success',
					text: `Device found! Node ${this.nodeFound.id} added`, // we don't know yet if it's added securely or not, need to wait interview
				}
			}

			this.state = 'stop'
		},
	},
	beforeDestroy() {
		if (this.commandTimer) {
			clearInterval(this.commandTimer)
		}

		if (this.waitTimeout) {
			clearTimeout(this.waitTimeout)
		}

		this.alert = null
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
