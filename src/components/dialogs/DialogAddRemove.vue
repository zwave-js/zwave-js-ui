<template>
	<v-dialog v-model="value" max-width="430px" persistent>
		<v-card>
			<v-card-title>
				<span class="headline">Add/Remove Device</span>
			</v-card-title>

			<v-card-text style="padding-bottom: 0">
				<v-container fluid style="margin-top: -2rem">
					<v-radio-group v-model="selectedMode" mandatory>
						<v-radio :value="0">
							<template v-slot:label>
								<div class="option">
									<v-icon color="green accent-4" small
										>add_circle</v-icon
									>
									<strong>Inclusion</strong>
									<small
										>Add using non-secure mode (best for
										most devices)</small
									>
								</div>
							</template>
						</v-radio>
						<v-radio :value="1">
							<template v-slot:label>
								<div class="option">
									<v-icon color="amber accent-4" small
										>enhanced_encryption</v-icon
									>
									<strong>Secure Inclusion</strong>
									<small
										>Add with security (best for
										locks/doors)</small
									>
								</div>
							</template>
						</v-radio>
						<v-radio :value="2">
							<template v-slot:label>
								<div class="option">
									<v-icon color="red accent-4" small
										>remove_circle</v-icon
									>
									<strong>Exclusion</strong>
									<small
										>Remove device attached to existing
										network</small
									>
								</div>
							</template>
						</v-radio>
					</v-radio-group>
				</v-container>

				<v-alert v-if="alert" dense text :type="alert.type">{{
					alert.text
				}}</v-alert>
			</v-card-text>

			<v-card-actions>
				<v-spacer></v-spacer>
				<v-btn
					v-if="state === 'stop' || state === 'new'"
					color="red darken-1"
					text
					@click="$emit('close')"
					>Close</v-btn
				>
				<v-btn
					v-if="state !== 'wait'"
					color="blue darken-1"
					text
					@click="onAction"
					>{{ method }}</v-btn
				>
			</v-card-actions>
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
	watch: {
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
