<template>
	<!-- Start Dialog -->
	<v-dialog v-model="showStartDialog" max-width="600px" persistent>
		<v-card>
			<v-card-title class="text-h5">
				<v-icon class="mr-2">troubleshoot</v-icon>
				Start Debug Capture
			</v-card-title>

			<v-card-text>
				<p class="text-body-1 mb-3">
					This wizard will help you collect a complete debug package.
				</p>

				<p class="text-body-2 mb-2">When you start the capture:</p>
				<ul class="ml-4 mb-4">
					<li>Log levels will be automatically set to debug</li>
					<li>All logs will be captured to temporary files</li>
					<li>The system will continue running normally</li>
				</ul>

				<p class="text-body-2 mb-2">
					<strong>Next steps:</strong>
				</p>
				<ul class="ml-4 mb-4">
					<li>
						After starting, reproduce the issue you want to debug
					</li>
					<li>
						Click the debug indicator in the top bar when you're
						done
					</li>
					<li>Select which devices to include in the package</li>
				</ul>

				<div v-if="error" class="text-error mb-4">
					{{ error }}
				</div>
			</v-card-text>

			<v-divider />

			<v-card-actions>
				<v-spacer />
				<v-btn color="primary" variant="text" @click="closeStart">
					Cancel
				</v-btn>
				<v-btn
					color="primary"
					variant="flat"
					:loading="loading"
					@click="startCapture"
				>
					Start Capture
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>

	<!-- Finish Dialog -->
	<v-dialog v-model="showFinishDialog" max-width="800px" persistent>
		<v-card>
			<v-card-title class="text-h5">
				<v-icon class="mr-2">troubleshoot</v-icon>
				Finish Debug Capture
			</v-card-title>

			<v-card-text>
				<p class="text-body-1 mb-4">
					<v-icon class="mr-2" color="success">check_circle</v-icon>
					Debug capture completed!
				</p>

				<p class="text-body-2 mb-3">
					Select the devices you want to include node dumps for. This
					will add detailed device information to the debug package.
				</p>

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
							:title="node.name || `Node ${node.id}`"
							:subtitle="`ID: ${node.id} - ${node.type || 'Unknown'}`"
						>
							<template #prepend>
								<v-checkbox-btn
									:model-value="
										selectedNodes.includes(node.id)
									"
								/>
							</template>
						</v-list-item>

						<v-list-item v-if="filteredNodes.length === 0">
							<v-list-item-title
								class="text-center text-medium-emphasis"
							>
								No devices found
							</v-list-item-title>
						</v-list-item>
					</v-list>
				</v-card>

				<div class="mt-4 text-body-2 text-medium-emphasis">
					{{ selectedNodes.length }} device(s) selected
				</div>

				<div v-if="downloading" class="text-center mt-4">
					<v-progress-circular
						indeterminate
						color="primary"
						size="64"
						class="mb-4"
					/>
					<div class="text-h6">Generating debug package...</div>
					<div class="text-body-2 text-medium-emphasis mt-2">
						This may take a few moments
					</div>
				</div>

				<v-alert
					v-if="downloadComplete"
					type="success"
					variant="tonal"
					class="mt-4"
				>
					<div class="text-body-1 mb-2">
						<v-icon class="mr-2">check_circle</v-icon>
						Debug package downloaded successfully!
					</div>
					<div class="text-body-2">
						You can now close this dialog and attach the downloaded
						file to your issue report.
					</div>
				</v-alert>

				<v-alert
					v-if="finishError"
					type="error"
					variant="tonal"
					class="mt-4"
				>
					<div class="text-body-1 mb-2">
						<v-icon class="mr-2">error</v-icon>
						Error generating debug package
					</div>
					<div class="text-body-2">
						{{ finishError }}
					</div>
				</v-alert>
			</v-card-text>

			<v-divider />

			<v-card-actions>
				<v-btn
					v-if="!downloading && !downloadComplete"
					color="error"
					variant="text"
					@click="cancelCapture"
				>
					Cancel Capture
				</v-btn>
				<v-spacer />
				<v-btn
					v-if="downloadComplete"
					color="primary"
					variant="text"
					@click="closeFinish"
				>
					Close
				</v-btn>
				<v-btn
					v-if="!downloading && !downloadComplete"
					color="primary"
					variant="flat"
					:loading="loading"
					@click="finishCapture"
				>
					Download Debug Package
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script>
import { mapState, mapActions } from 'pinia'
import useBaseStore from '@/stores/base.js'
import ConfigApis from '@/apis/ConfigApis'

export default {
	name: 'DialogDebugCapture',
	props: {
		modelValue: {
			type: String,
			default: null, // 'start' or 'finish'
		},
	},
	emits: ['update:modelValue', 'captureStarted', 'captureStopped'],
	data() {
		return {
			loading: false,
			downloading: false,
			downloadComplete: false,
			error: null,
			finishError: null,
			search: '',
			selectedNodes: [],
		}
	},
	computed: {
		...mapState(useBaseStore, ['nodes']),
		showStartDialog: {
			get() {
				return this.modelValue === 'start'
			},
			set(value) {
				this.$emit('update:modelValue', value ? 'start' : null)
			},
		},
		showFinishDialog: {
			get() {
				return this.modelValue === 'finish'
			},
			set(value) {
				this.$emit('update:modelValue', value ? 'finish' : null)
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
		modelValue(val) {
			if (val === 'start') {
				// Reset start dialog state
				this.error = null
				this.loading = false
			} else if (val === 'finish') {
				// Reset finish dialog state
				this.finishError = null
				this.loading = false
				this.downloading = false
				this.downloadComplete = false
				this.search = ''
				this.selectedNodes = []
			}
		},
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		async startCapture() {
			this.loading = true
			this.error = null

			try {
				const response = await ConfigApis.startDebugCapture()

				if (response.success) {
					this.showSnackbar('Debug capture started')
					this.$emit('captureStarted')
					this.closeStart()
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
		async finishCapture() {
			this.loading = true
			this.downloading = true
			this.finishError = null

			try {
				await ConfigApis.stopDebugCapture(this.selectedNodes)
				this.downloadComplete = true
				this.showSnackbar('Debug package downloaded successfully')
				this.$emit('captureStopped')
			} catch (error) {
				this.finishError =
					error.message || 'Failed to generate debug package'
			} finally {
				this.loading = false
				this.downloading = false
			}
		},
		async cancelCapture() {
			try {
				await ConfigApis.cancelDebugCapture()
				this.showSnackbar('Debug capture cancelled')
				this.$emit('captureStopped')
				this.closeFinish()
			} catch (error) {
				this.finishError =
					error.message || 'Failed to cancel debug capture'
			}
		},
		closeStart() {
			this.showStartDialog = false
		},
		closeFinish() {
			this.showFinishDialog = false
		},
	},
}
</script>
