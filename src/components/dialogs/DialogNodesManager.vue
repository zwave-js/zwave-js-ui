<template>
	<ZwWizardDialog
		:model-value="isOpen"
		:steps="stepTitles"
		:current="currentStep - 1"
		title="Nodes Manager"
		:subtitle="currentSubtitle"
		size="xl"
		:dismiss="dismiss"
		:loading="loading"
		:actions="footerActions"
		@update:model-value="(v) => !v && close()"
		@after-leave="init(false)"
	>
		<template #footer-left>
			<ZwButton v-if="showBack" variant="ghost" @click="goBack">
				Back
			</ZwButton>
		</template>

		<template v-if="step">
			<div v-if="step.key === 'replaceFailed'">
				<v-combobox
					:menu-props="zwMenuProps"
					label="Node"
					v-model="step.values.replaceId"
					:items="nodes.filter((n) => !n.isControllerNode)"
					return-object
					chips
					hint="Failed node to remove. Write the node Id and press enter if not present"
					persistent-hint
					item-title="_name"
				></v-combobox>
			</div>

			<div v-else-if="step.key === 'inclusionNaming'">
				<v-form
					ref="namingForm"
					v-model="validNaming"
					validate-on="lazy"
					@submit.prevent
				>
					<p>
						Auto assign a name/location to this node when it is
						added. Leave empty to ignore
					</p>
					<v-text-field
						label="Name"
						persistent-hint
						autofocus
						hint="Node name"
						:rules="[validateTopic]"
						v-model.trim="step.values.name"
					>
					</v-text-field>
					<v-text-field
						label="Location"
						class="mb-2"
						persistent-hint
						:rules="[validateTopic]"
						hint="Node location"
						v-model.trim="step.values.location"
					>
					</v-text-field>
				</v-form>
			</div>

			<div v-else-if="step.key === 'inclusionMode'">
				<div v-if="!loading">
					<v-radio-group
						:modelValue="step.values.inclusionMode"
						@update:modelValue="setInclusionMode"
						mandatory
					>
						<missing-keys-alert />
						<v-radio :value="InclusionStrategy.Default">
							<template #label>
								<div class="option">
									<v-icon color="success" size="small"
										>add_circle</v-icon
									>
									<strong>Default</strong>
									<small
										>S2 when supported, S0 only when
										necessary, no encryption otherwise.
										Requires user interaction</small
									>
								</div>
							</template>
						</v-radio>
						<v-radio :value="InclusionStrategy.SmartStart">
							<template #label>
								<div class="option">
									<v-icon color="primary" size="small"
										>smart_button</v-icon
									>
									<strong>Scan QR Code</strong>
									<small
										>S2 only. Allows pre-configuring the
										device inclusion settings, which will
										then happen without user
										interaction</small
									>
								</div>
							</template>
						</v-radio>
						<v-radio :value="InclusionStrategy.Security_S0">
							<template #label>
								<div class="option">
									<v-icon color="amber-accent-4" size="small"
										>lock</v-icon
									>
									<strong>S0 encryption</strong>
									<small>Use S0 encryption</small>
								</div>
							</template>
						</v-radio>
						<v-radio :value="InclusionStrategy.Insecure">
							<template #label>
								<div class="option">
									<v-icon color="error" size="small"
										>no_encryption</v-icon
									>
									<strong>No encryption</strong>
									<small>Do not use encryption</small>
								</div>
							</template>
						</v-radio>
					</v-radio-group>

					<v-checkbox
						v-if="
							step.values.inclusionMode ==
							InclusionStrategy.Default
						"
						class="mb-2"
						v-model="step.values.forceSecurity"
						label="Prefer S0 over no encryption"
						hide-details
					></v-checkbox>
				</div>

				<v-col v-else class="d-flex flex-column align-center">
					<v-icon size="60" color="primary">all_inclusive</v-icon>
					<p
						v-if="state === 'start'"
						class="mt-3 text-h5 text-center"
					>
						Inclusion is started. Please put your device in
						INCLUSION MODE
					</p>
					<p
						v-else-if="nvmProgress > 0"
						class="mt-3 text-h5 text-center"
					>
						Waiting for NVM Backup...
					</p>
					<p v-else class="mt-3 text-h5 text-center">
						Inclusion stopped. Checking for changes...
					</p>
				</v-col>
			</div>

			<div v-else-if="step.key === 'replaceInclusionMode'">
				<v-radio-group
					v-if="!loading"
					v-model="step.values.inclusionMode"
					mandatory
				>
					<v-radio :value="1">
						<template #label>
							<div class="option">
								<v-icon color="primary" size="small"
									>smart_button</v-icon
								>
								<strong>S2 - Scan QR</strong>
								<small
									>S2 only. Allows to include node scanning a
									S2 only QR-Code</small
								>
							</div>
						</template>
					</v-radio>
					<v-radio :value="4">
						<template #label>
							<div class="option">
								<v-icon color="success" size="small"
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
								<v-icon color="primary" size="small"
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
								<v-icon color="amber-accent-4" size="small"
									>no_encryption</v-icon
								>
								<strong>No encryption</strong>
								<small>Do not use encryption</small>
							</div>
						</template>
					</v-radio>
				</v-radio-group>

				<v-col v-else class="d-flex flex-column align-center">
					<v-icon size="60" color="primary">all_inclusive</v-icon>
					<p class="mt-3 text-h5 text-center">
						Inclusion is started. Please put your device in
						INCLUSION MODE
					</p>
				</v-col>
			</div>

			<div v-else-if="step.key === 's2Classes'">
				<div v-if="!loading">
					<v-checkbox
						:disabled="step.values.s2AccessControl === undefined"
						v-model="step.values.s2AccessControl"
						label="S2 Access Control"
						hint="Example: Door Locks, garage doors"
						persistent-hint
					></v-checkbox>
					<v-checkbox
						:disabled="step.values.s2Authenticated === undefined"
						v-model="step.values.s2Authenticated"
						label="S2 Authenticated"
						hint="Example: Lighting, Sensors, Security Systems"
						persistent-hint
					></v-checkbox>
					<v-checkbox
						:disabled="step.values.s2Unauthenticated === undefined"
						v-model="step.values.s2Unauthenticated"
						label="S2 Unauthenticated"
						hint="Like S2 Authenticated but without verification that the correct device is included"
						persistent-hint
					></v-checkbox>
					<v-checkbox
						:disabled="step.values.s0Legacy === undefined"
						v-model="step.values.s0Legacy"
						label="S0 legacy"
						hint="Example: Legacy door locks without S2 support"
						persistent-hint
					></v-checkbox>
					<v-checkbox
						:disabled="step.values.clientAuth === undefined"
						v-model="step.values.clientAuth"
						label="Client-side authentication"
						hint="Authentication of the inclusion happens on the device instead of on the controller (for devices without DSK)"
						persistent-hint
					></v-checkbox>
				</div>
				<div v-else>
					<v-col class="text-center">
						<ZwSpinner
							:size="64"
							label="Waiting for node response"
						/>
						<p class="mt-3 text-h5">
							Waiting response from node...
						</p>
					</v-col>
				</div>
			</div>

			<div v-else-if="step.key === 's2Pin'">
				<div v-if="!loading">
					<v-text-field
						label="DSK Pin"
						class="mb-2"
						autofocus
						persistent-hint
						hint="Enter the 5-digit PIN for your device and verify that the rest of digits matches the one that can be found on your device manual"
						inputmode="numeric"
						v-model.trim="step.values.pin"
						validate-on="blur"
						:error="
							!!step.values.pin &&
							validPin(step.values.pin) !== true
						"
						:suffix="$vuetify.display.xs ? '' : step.suffix"
					>
					</v-text-field>

					<code
						class="code font-weight-bold"
						v-if="$vuetify.display.xs"
					>
						{{ step.suffix }}
					</code>
				</div>
				<div v-else>
					<v-col class="text-center">
						<ZwSpinner
							:size="64"
							label="Waiting for node response"
						/>
						<p class="mt-3 text-h5">
							Waiting response from node...
						</p>
					</v-col>
				</div>
			</div>

			<div v-else-if="step.key === 'done'">
				<v-col class="d-flex flex-column align-center">
					<v-icon
						size="60"
						:color="step.success ? 'success' : 'warning'"
						>{{ step.success ? 'check_circle' : 'warning' }}</v-icon
					>
					<p v-text="step.text" class="mt-3 text-h5 text-center"></p>
					<p
						v-if="step.error"
						v-text="step.error"
						class="text-h5 text-center text-error"
					></p>
				</v-col>
			</div>

			<v-alert
				class="mt-3 mb-0"
				v-if="alert"
				density="compact"
				text
				:type="alert.type"
				>{{ alert.text }}</v-alert
			>
		</template>
	</ZwWizardDialog>
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
import ZwWizardDialog from '@/components/dashboard/dialogs/ZwWizardDialog.vue'
import ZwButton from '@/components/dashboard/atoms/ZwButton.vue'
import ZwSpinner from '@/components/dashboard/atoms/ZwSpinner.vue'
import { confirmAction } from '@/lib/dashboard-types'
import OverlayAttachMixin from '@/mixins/OverlayAttachMixin.js'

export default {
	props: {
		socket: Object,
	},
	components: {
		ZwWizardDialog,
		ZwButton,
		ZwSpinner,
		MissingKeysAlert: defineAsyncComponent(
			() => import('../custom/MissingKeysAlert.vue'),
		),
	},
	mixins: [OverlayAttachMixin, InstancesMixin],
	emits: ['open', 'close'],
	data() {
		return {
			isOpen: false,
			currentStep: 1,
			loading: false,
			validNaming: true,
			InclusionStrategy,
			availableSteps: {
				inclusionNaming: {
					key: 'inclusionNaming',
					title: 'Name and Location',
					subtitle: 'Optionally name and place the new device.',
					values: {
						name: '',
						location: '',
					},
				},
				inclusionMode: {
					key: 'inclusionMode',
					title: 'Inclusion Mode',
					subtitle:
						'How the new device negotiates security when it joins.',
					values: {
						inclusionMode: InclusionStrategy.Default, //default, smartstart no encryption
						forceSecurity: false,
					},
				},
				replaceInclusionMode: {
					key: 'replaceInclusionMode',
					title: 'Inclusion Mode',
					subtitle: 'Security strategy for the replacement device.',
					values: {
						inclusionMode: InclusionStrategy.Default, //default, smartstart no encryption
					},
				},
				s2Classes: {
					key: 's2Classes',
					title: 'Security Classes',
					subtitle:
						'Grant the security classes the device requested.',
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
					subtitle: 'Enter the DSK PIN printed on the device.',
					suffix: '', // Ex: '-12345-12345-12345-12345-12345-12345-12345',
					values: {
						pin: '',
					},
				},
				replaceFailed: {
					key: 'replaceFailed',
					title: 'Node Id',
					subtitle: 'Pick the failed node to replace.',
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
		step() {
			return this.steps[this.currentStep - 1] ?? null
		},
		stepTitles() {
			return this.steps.map((s) => s.title)
		},
		currentSubtitle() {
			return this.step?.subtitle ?? ''
		},
		showBack() {
			const s = this.step
			if (!s) return false
			return (
				this.currentStep > 1 &&
				!this.loading &&
				this.state !== 'start' &&
				!['s2Classes', 's2Pin', 'done'].includes(s.key)
			)
		},
		dismiss() {
			// While an inclusion is active, the dialog must not be dismissed
			if (this.state === 'start') return 'none'
			// Keep the X during a transient request, drop Esc and the scrim
			return this.loading ? 'button' : 'all'
		},
		footerActions() {
			const s = this.step
			if (!s) return []
			const running = this.state === 'start'
			const acts = []

			if (s.key === 'replaceFailed') {
				acts.push(confirmAction('Next', this.submitReplaceFailed))
			} else if (s.key === 'inclusionNaming') {
				acts.push(confirmAction('Next', this.submitNameLoc))
			} else if (
				s.key === 'inclusionMode' ||
				s.key === 'replaceInclusionMode'
			) {
				if (running) {
					acts.push(
						confirmAction(
							s.key === 'inclusionMode'
								? 'Stop running Inclusion'
								: 'Stop',
							this.stopAction,
							{ tone: 'danger' },
						),
					)
				}
				if (!this.loading) {
					acts.push(confirmAction('Next', this.nextStep))
				}
			} else if (s.key === 's2Classes' || s.key === 's2Pin') {
				if (!this.loading) {
					acts.push(
						confirmAction('Abort', this.abortInclusion, {
							tone: 'danger',
						}),
					)
					if (!this.aborted) {
						acts.push(
							confirmAction('Next', this.nextStep, {
								disabled:
									s.key === 's2Pin' &&
									this.validPin(s.values.pin) !== true,
							}),
						)
					}
				}
			} else if (s.key === 'done') {
				acts.push(confirmAction('Close', this.close))
			}

			return acts
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
						text: `Inclusion started: ${s}s remaining`,
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
			// Exclusion is driven by DialogExcludeDevice, so only track inclusion here
			if (/inclusion/i.test(status)) {
				// Inclusion started, start the countdown timer
				if (status.indexOf('started') > 0) {
					this.commandEndDate = new Date(
						new Date().getTime() + this.timeoutMs,
					)
					this.nodeFound = null
					this.state = 'start'
				} else if (status.indexOf('stopped') > 0) {
					// Inclusion stopped, check what happened

					// inclusion has been stopped manually
					if (this.stopped || this.commandTimedOut) {
						this.stopped = false
						this.showResults()
					} else {
						// inclusion stopped by controller, see if a node was found
						this.state = 'wait'

						// when a node is added/removed showResults it's called from socket event listeners
						// (onNodeAdded onNodeRemoved) set a timeout in case the events for some reason are not received
						// fixes issue #2746
						this.waitTimeout = setTimeout(
							() => this.showResults(),
							5000,
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
			const result = await this.$refs.namingForm.validate()
			if (result.valid) {
				this.nextStep()
			}
		},
		submitReplaceFailed() {
			const s = this.steps[this.currentStep - 1]
			const replaceId = s.values.replaceId

			// Validate that a node has been selected
			if (!replaceId) {
				this.showSnackbar('Please select a node to replace', 'error')
				return
			}

			// Additional validation for numeric input
			if (typeof replaceId !== 'object') {
				const nodeId = parseInt(replaceId, 10)
				if (isNaN(nodeId) || nodeId <= 0) {
					this.showSnackbar('Please enter a valid node ID', 'error')
					return
				}
			}

			this.nextStep()
		},
		validPin(pin) {
			return pin?.length === 5 || 'PIN must be 5 digits'
		},
		dispatchEnter() {
			const s = this.step
			if (!s) return

			const primary = this.footerActions.find(
				(a) => a.tone === 'accent' && !a.disabled,
			)
			if (primary && primary.onClick) {
				primary.onClick()
			}
		},
		goBack() {
			this.changeStep(this.currentStep - 1)
		},
		onNodeAdded({ node, result }) {
			this.nodeFound = node
			if (this.loading) {
				this.showResults(result)
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
			// Truncate forward steps so skipped entry points stay skipped
			if (index < 1) return
			this.steps = this.steps.slice(0, index)
			this.currentStep = index
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
			if (s.key === 'inclusionNaming') {
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
				// Validation should have been done in submitReplaceFailed
				this.pushStep('replaceInclusionMode')
			}
		},
		async showForAction(kind) {
			await this.show({
				[kind === 'replace-failed'
					? 'replaceFailed'
					: 'inclusionNaming']: {},
			})
		},
		async show(stepOrStepsValues) {
			this.isOpen = true
			this.$emit('open')
			this.init(true)
			if (typeof stepOrStepsValues === 'object') {
				this.steps = []
				for (const s in stepOrStepsValues) {
					const step = await this.pushStep(s)
					Object.assign(step.values, stepOrStepsValues[s])
				}
			}
		},
		close() {
			this.isOpen = false
			this.$emit('close')
		},
		init(bind) {
			this.steps = []
			// `current` is derived from this, so a stale index would point past
			// the freshly emptied steps until the first pushStep lands
			this.currentStep = 1

			// Keep the stop flag while an inclusion is still running
			if (this.state !== 'start') {
				this.stopped = false
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
				this.subscribeChannels(['nodes'])
				this.bindEvent(
					'grantSecurityClasses',
					this.onGrantSecurityCC.bind(this),
				)
				this.bindEvent('validateDSK', this.onValidateDSK.bind(this))
				this.bindEvent('nodeAdded', this.onNodeAdded.bind(this))
			} else if (bind === false) {
				this.unbindEvents()
			}
		},
		async pushStep(step) {
			const s =
				typeof step === 'string' ? this.availableSteps[step] : step
			if (!s) {
				throw new Error(`Unknown nodes manager step "${step}"`)
			}
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
			this.sendAction('stopInclusion')
		},
		async sendAction(api, args) {
			this.commandEndDate = null

			let text = ''

			if (this.backup.nvmBackupOnEvent && api.startsWith('start')) {
				text =
					'Backuping NVM before Inclusion. Check progress status bar...'
			} else {
				text = `Inclusion ${
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
						? 'Timed Out! No device has been found to complete Inclusion'
						: 'Inclusion stopped, no changes detected',
				}
			} else {
				this.alert = null
				this.aborted = false
				const doneStep = copy(this.availableSteps.done)
				doneStep.text = `Node ${
					this.nodeFound.id
				} added with security ${this.nodeFound.security || 'None'}`
				doneStep.error =
					result && result.lowSecurityReason
						? this.getSecurityBootstrapError(
								result.lowSecurityReason,
							)
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
	color: var(--zw-muted);
	display: block;
	margin: -0.2rem 0 0 1.4rem;
}
</style>
