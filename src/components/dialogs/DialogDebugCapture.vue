<template>
	<v-dialog
		v-model="show"
		max-width="800"
		persistent
		:fullscreen="$vuetify.display.mobile"
	>
		<v-card>
			<v-card-title class="text-h5">
				<v-icon class="mr-2">troubleshoot</v-icon>
				Debug Capture
			</v-card-title>

			<v-card-text>
				<v-stepper v-model="step" alt-labels>
					<v-stepper-header>
						<v-stepper-item
							:complete="step > 1"
							:value="1"
							title="Start Capture"
						/>
						<v-divider />
						<v-stepper-item
							:complete="step > 2"
							:value="2"
							title="Perform Actions"
						/>
						<v-divider />
						<v-stepper-item
							:complete="step > 3"
							:value="3"
							title="Select Devices"
						/>
						<v-divider />
						<v-stepper-item :value="4" title="Download" />
					</v-stepper-header>

					<v-stepper-window>
						<!-- Step 1: Start Capture -->
						<v-stepper-window-item :value="1">
							<v-card flat>
								<v-card-text>
									<v-alert
										type="info"
										variant="tonal"
										class="mb-4"
									>
										<div class="text-body-1 mb-2">
											This wizard will help you collect a
											complete debug package.
										</div>
										<div class="text-body-2">
											When you start the capture:
										</div>
										<ul class="ml-4 mt-2">
											<li>
												Log levels will be automatically
												set to debug
											</li>
											<li>
												All logs will be captured in
												memory
											</li>
											<li>
												The system will continue running
												normally
											</li>
										</ul>
									</v-alert>

									<div v-if="error" class="text-error mb-4">
										{{ error }}
									</div>
								</v-card-text>
							</v-card>
						</v-stepper-window-item>

						<!-- Step 2: Perform Actions -->
						<v-stepper-window-item :value="2">
							<v-card flat>
								<v-card-text>
									<v-alert
										type="success"
										variant="tonal"
										class="mb-4"
									>
										<v-icon class="mr-2"
											>check_circle</v-icon
										>
										Debug capture is active!
									</v-alert>

									<v-alert
										type="warning"
										variant="tonal"
										class="mb-4"
									>
										<div class="text-body-1 mb-2">
											<strong
												>Now perform the actions you
												want to debug</strong
											>
										</div>
										<div class="text-body-2">Examples:</div>
										<ul class="ml-4 mt-2">
											<li>
												Control a device that's not
												working properly
											</li>
											<li>Trigger an automation</li>
											<li>Wait for an issue to occur</li>
											<li>Observe unexpected behavior</li>
										</ul>
									</v-alert>

									<v-card variant="outlined" class="pa-4">
										<div class="text-center">
											<v-icon
												size="64"
												color="primary"
												class="mb-2"
											>
												pending
											</v-icon>
											<div class="text-h6">
												Capture in progress...
											</div>
											<div
												class="text-body-2 text-medium-emphasis mt-2"
											>
												Click "Next" when you're done
											</div>
										</div>
									</v-card>
								</v-card-text>
							</v-card>
						</v-stepper-window-item>

						<!-- Step 3: Select Devices -->
						<v-stepper-window-item :value="3">
							<v-card flat>
								<v-card-text>
									<v-alert
										type="info"
										variant="tonal"
										class="mb-4"
									>
										Select the devices you want to include
										node dumps for. This will add detailed
										device information to the debug package.
									</v-alert>

									<v-text-field
										v-model="search"
										prepend-inner-icon="search"
										label="Search devices"
										single-line
										hide-details
										clearable
										class="mb-4"
									/>

									<v-card variant="outlined">
										<v-list
											v-model:selected="selectedNodes"
											select-strategy="independent"
										>
											<v-list-item
												v-for="node in filteredNodes"
												:key="node.id"
												:value="node.id"
												:title="
													node.name ||
													`Node ${node.id}`
												"
												:subtitle="`ID: ${node.id} - ${node.type || 'Unknown'}`"
											>
												<template #prepend>
													<v-checkbox-btn
														:model-value="
															selectedNodes.includes(
																node.id,
															)
														"
													/>
												</template>
											</v-list-item>

											<v-list-item
												v-if="
													filteredNodes.length === 0
												"
											>
												<v-list-item-title
													class="text-center text-medium-emphasis"
												>
													No devices found
												</v-list-item-title>
											</v-list-item>
										</v-list>
									</v-card>

									<div
										class="mt-4 text-body-2 text-medium-emphasis"
									>
										{{ selectedNodes.length }} device(s)
										selected
									</div>
								</v-card-text>
							</v-card>
						</v-stepper-window-item>

						<!-- Step 4: Download -->
						<v-stepper-window-item :value="4">
							<v-card flat>
								<v-card-text>
									<div v-if="downloading" class="text-center">
										<v-progress-circular
											indeterminate
											color="primary"
											size="64"
											class="mb-4"
										/>
										<div class="text-h6">
											Generating debug package...
										</div>
										<div
											class="text-body-2 text-medium-emphasis mt-2"
										>
											This may take a few moments
										</div>
									</div>

									<v-alert
										v-else-if="downloadComplete"
										type="success"
										variant="tonal"
									>
										<div class="text-body-1 mb-2">
											<v-icon class="mr-2"
												>check_circle</v-icon
											>
											Debug package downloaded
											successfully!
										</div>
										<div class="text-body-2">
											You can now close this dialog and
											attach the downloaded file to your
											issue report.
										</div>
									</v-alert>

									<v-alert
										v-else-if="error"
										type="error"
										variant="tonal"
									>
										<div class="text-body-1 mb-2">
											<v-icon class="mr-2">error</v-icon>
											Error generating debug package
										</div>
										<div class="text-body-2">
											{{ error }}
										</div>
									</v-alert>
								</v-card-text>
							</v-card>
						</v-stepper-window-item>
					</v-stepper-window>
				</v-stepper>
			</v-card-text>

			<v-divider />

			<v-card-actions>
				<v-spacer />

				<v-btn
					v-if="step > 1 && step < 4"
					color="error"
					variant="text"
					@click="cancelCapture"
				>
					Cancel Capture
				</v-btn>

				<v-btn
					v-if="step === 1"
					color="primary"
					variant="text"
					@click="close"
				>
					Cancel
				</v-btn>

				<v-btn
					v-if="step === 4 && downloadComplete"
					color="primary"
					variant="text"
					@click="close"
				>
					Close
				</v-btn>

				<v-btn
					v-if="step === 1"
					color="primary"
					variant="flat"
					:loading="loading"
					@click="startCapture"
				>
					Start Capture
				</v-btn>

				<v-btn
					v-if="step === 2"
					color="primary"
					variant="flat"
					@click="step = 3"
				>
					Next
				</v-btn>

				<v-btn
					v-if="step === 3"
					color="primary"
					variant="flat"
					:loading="loading"
					@click="stopCapture"
				>
					Generate Package
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script>
import { mapState } from 'pinia'
import useBaseStore from '@/stores/base.js'
import ConfigApis from '@/apis/ConfigApis'

export default {
	name: 'DialogDebugCapture',
	props: {
		modelValue: Boolean,
	},
	emits: ['update:modelValue'],
	data() {
		return {
			step: 1,
			loading: false,
			downloading: false,
			downloadComplete: false,
			error: null,
			search: '',
			selectedNodes: [],
		}
	},
	computed: {
		...mapState(useBaseStore, ['nodes']),
		show: {
			get() {
				return this.modelValue
			},
			set(value) {
				this.$emit('update:modelValue', value)
			},
		},
		nodesList() {
			return Object.values(this.nodes).filter((n) => n && n.id)
		},
		filteredNodes() {
			if (!this.search) {
				return this.nodesList
			}

			const searchLower = this.search.toLowerCase()
			return this.nodesList.filter(
				(node) =>
					node.name?.toLowerCase().includes(searchLower) ||
					node.id?.toString().includes(searchLower) ||
					node.type?.toLowerCase().includes(searchLower),
			)
		},
	},
	watch: {
		show(val) {
			if (val) {
				// Reset state when dialog opens
				this.step = 1
				this.loading = false
				this.downloading = false
				this.downloadComplete = false
				this.error = null
				this.search = ''
				this.selectedNodes = []
			}
		},
	},
	methods: {
		async startCapture() {
			this.loading = true
			this.error = null

			try {
				const response = await ConfigApis.startDebugCapture()

				if (response.success) {
					this.step = 2
				} else {
					this.error =
						response.message || 'Failed to start debug capture'
				}
			} catch (error) {
				this.error = error.message || 'Failed to start debug capture'
			} finally {
				this.loading = false
			}
		},
		async stopCapture() {
			this.loading = true
			this.error = null
			this.step = 4
			this.downloading = true

			try {
				await ConfigApis.stopDebugCapture(this.selectedNodes)
				this.downloadComplete = true
			} catch (error) {
				this.error = error.message || 'Failed to generate debug package'
			} finally {
				this.loading = false
				this.downloading = false
			}
		},
		async cancelCapture() {
			try {
				await ConfigApis.cancelDebugCapture()
				this.close()
			} catch (error) {
				this.error = error.message || 'Failed to cancel debug capture'
			}
		},
		close() {
			this.show = false
		},
	},
}
</script>
