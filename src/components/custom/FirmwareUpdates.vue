<template>
	<v-container grid-list-md>
		<v-row class="ml-5">
			<v-col v-show="!node.firmwareUpdate" cols="12">
				<v-row justify="center" class="mb-2 text-center">
					<v-btn
						:disabled="loading"
						variant="outlined"
						class="my-auto"
						color="success"
						@click="checkUpdates"
						>Check updates</v-btn
					>
					<v-checkbox
						v-model="includePrereleases"
						hide-details
						density="compact"
						label="Include pre-releases"
						class="ml-2 my-auto"
					>
					</v-checkbox>
					<v-checkbox
						v-if="!hideDowngrades"
						v-model="showDowngrades"
						hide-details
						density="compact"
						label="Show downgrades"
						class="ml-2 my-auto"
					>
					</v-checkbox>
				</v-row>
				<v-row
					v-if="controllerNode.RFRegion === undefined"
					justify="center"
					class="pt-2 text-center"
				>
					<v-alert
						type="info"
						density="compact"
						text
						class="ml-2 mb-2"
						style="max-width: 400px"
					>
						<small>
							{{
								invalidRfRegion
									? 'To get region-specific firmware updates, you need to configure your current region in the settings.'
									: `Firmware updates include updates specific to ${RFRegion[zwave.rf.region]}. If this is not correct, you can change it in the settings.`
							}}
						</small>
					</v-alert>
				</v-row>
			</v-col>

			<template v-if="filteredUpdates.length > 0 && !node.firmwareUpdate">
				<v-col
					cols="12"
					sm="6"
					md="4"
					v-for="u in filteredUpdates"
					:key="u.version"
				>
					<v-card density="compact" elevation="5">
						<v-card-title>
							<v-icon>mdi-update</v-icon>
							<span class="text-h5"
								><strong
									>v{{ u.version }} [{{ u.channel }}]</strong
								></span
							>
							<v-spacer></v-spacer>
							<v-btn
								variant="outlined"
								size="small"
								:color="u.downgrade ? 'warning' : 'success'"
								@click="handleUpdateFirmware(u)"
								:prepend-icon="
									u.downgrade ? 'download' : 'upload'
								"
							>
								{{ u.downgrade ? 'Downgrade' : 'Update' }}
							</v-btn>
						</v-card-title>
						<v-divider class="mx-4"></v-divider>
						<v-card-text>
							<v-list-subheader class="text-subtitle-1"
								><strong>Changelog</strong></v-list-subheader
							>
							<p
								class="text-caption ml-4"
								v-html="u.changelog"
							></p>

							<v-list-item
								v-for="f in u.files"
								:key="f.url"
								lines="two"
								density="compact"
								style="border-bottom: 1px solid #e0e0e0"
							>
								<template #prepend>
									<v-icon color="primary">widgets</v-icon>
								</template>

								<v-list-item-title
									v-if="
										!hideTargets && f.target !== undefined
									"
									>Target: {{ f.target }}</v-list-item-title
								>
								<v-list-item-subtitle>{{
									f.url
								}}</v-list-item-subtitle>

								<template #append>
									<v-btn
										title="Download"
										@click="download(f.url)"
										icon="download"
										color="success"
									/>
								</template>
							</v-list-item>
						</v-card-text>
					</v-card>
				</v-col>
			</template>
			<v-col
				class="text-center"
				v-else-if="loading || node.firmwareUpdate"
			>
				<v-progress-circular indeterminate color="primary" />
				<p class="text-caption">
					{{
						node.firmwareUpdate
							? 'Update in progress...'
							: 'Remember to wake up sleeping devices...'
					}}
				</p>
			</v-col>
			<v-col class="text-center" v-else>
				<h1 class="text-h6">No updates available</h1>
				<span
					>This service relies on
					<a
						href="https://github.com/zwave-js/firmware-updates#readme"
						target="_blank"
						>Z-Wave JS Firmware Update Service</a
					>, and may not represent all updates for your device.</span
				>
				<br />
				<span
					>If you know that a firmware update <i>does</i> exist, you
					can help the Z-Wave JS community by encouraging your device
					manufacturer to provide the firmwares. Read more in the link
					above.</span
				>
			</v-col>
		</v-row>
	</v-container>
</template>

<script>
import useBaseStore from '../../stores/base.js'
import { mapActions, mapState } from 'pinia'
import InstancesMixin from '../../mixins/InstancesMixin.js'
import { RFRegion } from '@zwave-js/core'

export default {
	components: {},
	props: {
		node: {
			type: Object,
			required: true,
		},
		socket: {
			type: Object,
			required: true,
		},
		hideDowngrades: {
			type: Boolean,
			default: false,
		},
		hideTargets: {
			type: Boolean,
			default: false,
		},
	},
	mixins: [InstancesMixin],
	data() {
		return {
			RFRegion,
			rfRegion: null,
			fwUpdates: [],
			loading: false,
			includePrereleases: false,
			showDowngrades: false,
		}
	},
	computed: {
		...mapState(useBaseStore, ['controllerNode', 'zwave']),
		filteredUpdates() {
			return this.fwUpdates.filter(
				(u) => !u.downgrade || (u.downgrade && this.showDowngrades),
			)
		},
		invalidRfRegion() {
			return (
				this.controllerNode &&
				this.controllerNode.RFRegion === undefined &&
				!this.zwave.rf.region
			)
		},
	},
	mounted() {
		this.checkUpdates()
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		async checkUpdates() {
			this.loading = true
			this.fwUpdates = []
			const options = {
				includePrereleases: this.includePrereleases,
			}

			if (
				this.controllerNode &&
				this.controllerNode.RFRegion === undefined &&
				this.zwave.rf.region
			) {
				options.rfRegion = this.zwave.rf.region
			}

			const response = await this.app.apiRequest(
				'getAvailableFirmwareUpdates',
				[this.node.id, options],
			)

			this.loading = false

			if (response.success) {
				const { default: md } = await import('markdown-it')

				// convert markdown changelog to html
				for (const update of response.result) {
					update.changelog = md().render(update.changelog)
				}

				this.fwUpdates = response.result
			} else {
				this.showSnackbar(
					`Failed to check for firmware updates: ${response.message}`,
					'error',
				)
			}
		},
		download(url) {
			window.open(url, '_blank')
		},
		async handleUpdateFirmware(update) {
			this.$emit('update-firmware', update)
		},
	},
}
</script>
