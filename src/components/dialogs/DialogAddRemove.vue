<template>
	<v-dialog v-model="value" @click:outside="$emit('close')" max-width="800px">
		<v-card>
			<v-card-title>
				<span class="headline">Inclusion Manager</span>
			</v-card-title>

			<v-card-text>
				<v-stepper v-model="currentStep">
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
							<div v-if="s.key == 'action'">
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
							</div>

							<v-btn color="primary" @click="nextStep(s)">
								Continue
							</v-btn>

							<v-btn text> Cancel </v-btn>
						</v-stepper-content>
					</v-stepper-items>
				</v-stepper>

				<v-alert v-if="alert" dense text :type="alert.type">{{
					alert.text
				}}</v-alert>
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
			currentStep: 0,
			availableSteps: {
				action: {
					index: 0,
					key: 'action',
					title: 'Action',
					values: {
						action: 0, //inclusion
					},
				},
				inclusionMode: {
					index: 1,
					key: 'inclusionMode',
					title: 'Inclusion Mode',
					values: {
						inclusionMode: 0, //default, smartstart no encryption
					},
				},
				s2Classes: {
					index: 2,
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
					index: 3,
					key: 's2Pin',
					title: 'DSK validation',
					values: {
						pin: '00000',
					},
				},
				replaceFailed: {
					index: 1,
					key: 'replaceFailed',
					title: 'Replace Failed',
					values: {
						replaceId: 0, //default
					},
				},
			},
			steps: [],
			selectedMode: 0,
			mode: 0, // most common action should be default
			modes: [
				{
					baseAction: 'Inclusion',
					name: 'Inclusion',
					secure: false,
				},
				{
					baseAction: 'Inclusion',
					name: 'Secure inclusion',
					secure: true,
				},
				{
					baseAction: 'Exclusion',
					name: 'Exclusion',
					secure: false,
				},
			],
			state: 'new', // new -> wait -> start -> wait -> stop
			commandEndDate: new Date(),
			commandTimer: null,
			waitTimeout: null,
			alert: null,
			nodeFound: null,
		}
	},
	computed: {
		...mapGetters(['appInfo', 'zwave']),
		method() {
			return this.state === 'new' || this.state === 'stop'
				? 'start'
				: 'stop'
		},
		timeoutMs() {
			return this.zwave.commandsTimeout * 1000 + 800 // add small buffer
		},
		controllerStatus() {
			return this.appInfo.controllerStatus
		},
		modeName() {
			return this.modes[this.mode].name
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
						text: `${this.modeName} started: ${s}s remaining`,
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
						text: `${this.modeName} stopped, checking nodes…`,
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
		nextStep(s) {},
		init() {
			this.steps = [this.copy(this.availableSteps.action)]
			this.currentStep = 0
		},
		onAction() {
			this.mode = this.selectedMode
			this.commandEndDate = new Date()
			this.alert = {
				type: 'info',
				text: `${this.modeName} ${
					this.method === 'start' ? 'starting…' : 'stopping…'
				}`,
			}
			const args = []
			if (this.mode < 2 && this.method === 'start') {
				args.push(this.modes[this.mode].secure)
			}
			this.$emit(
				'apiRequest',
				this.method + this.modes[this.mode].baseAction,
				args
			)
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
					text: `${this.modeName} stopped, no changes detected`,
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
