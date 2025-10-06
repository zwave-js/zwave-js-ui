<template>
	<v-dialog v-model="_value" max-width="800px" persistent>
		<v-card>
			<v-card-title>
				<span class="text-h5"
					>Node {{ activeNode ? activeNode.id : '' }} - Link
					Statistics</span
				>
			</v-card-title>

			<v-card-text>
				<v-container>
					<v-row class="ma-3" justify="start">
						<v-col cols="12" align="center">
							<v-select
								label="Mode"
								style="max-width: 325px"
								v-model="mode"
								:items="modes"
								persistent-hint
							></v-select>
						</v-col>

						<v-col cols="12" sm="6">
							<v-radio-group
								class="justify-center"
								v-model="infinite"
								inline
							>
								<v-radio
									label="Infinite"
									:value="true"
								></v-radio>
								<v-radio label="XX" :value="false">
									<template #label>
										<v-number-input
											:disabled="infinite"
											label="Iterations"
											v-model.number="iterations"
											type="number"
											:min="1"
											:max="10000"
											persistent-hint
										></v-number-input>
									</template>
								</v-radio>
							</v-radio-group>
						</v-col>

						<v-col cols="12" sm="6" class="mt-4">
							<v-number-input
								label="Interval"
								v-model.number="interval"
								suffix="ms"
								type="number"
								:min="1"
								:max="10000"
								persistent-hint
							></v-number-input>
						</v-col>
					</v-row>

					<v-row class="mb-4" justify="space-around">
						<v-btn
							variant="flat"
							color="success"
							@click="checkLinkReliability"
							:disabled="running"
							:loading="running"
							>Run</v-btn
						>
						<v-btn
							variant="flat"
							color="error"
							@click="abortLinkReliabilityCheck"
							:disabled="!running"
							>Stop</v-btn
						>
					</v-row>

					<v-divider></v-divider>

					<v-row
						v-if="statistics"
						class="ma-3"
						justify="center"
						align="center"
					>
						<v-progress-linear
							v-if="running"
							:indeterminate="this.infinite"
							:model-value="this.infinite ? null : this.progress"
							color="success"
						></v-progress-linear>
						<v-list class="mr-2" density="compact">
							<v-list-item>
								<v-list-item-title class="text-info"
									>Commands Sent</v-list-item-title
								>
								<v-list-item-subtitle>{{
									statistics.commandsSent
								}}</v-list-item-subtitle>
							</v-list-item>
							<v-list-item>
								<v-list-item-title class="text-error"
									>Failed Commands</v-list-item-title
								>
								<v-list-item-subtitle
									>{{ statistics.commandErrors }} ({{
										(
											(statistics.commandErrors /
												statistics.rounds) *
											100
										).toFixed(1)
									}}
									%)</v-list-item-subtitle
								>
							</v-list-item>
							<v-list-item
								v-if="statistics?.missingResponses != undefined"
							>
								<v-list-item-title class="text-error"
									>Missing Responses</v-list-item-title
								>
								<v-list-item-subtitle
									>{{ statistics.missingResponses }} ({{
										(
											(statistics.missingResponses /
												statistics.commandsSent) *
											100
										).toFixed(1)
									}}
									%)</v-list-item-subtitle
								>
							</v-list-item>
						</v-list>

						<v-table>
							<template #default>
								<thead>
									<tr>
										<th class="text-left"></th>
										<th class="text-left">Min</th>
										<th class="text-left">Max</th>
										<th class="text-left">Avg</th>
									</tr>
								</thead>
								<tbody v-if="statistics.latency">
									<tr>
										<td>Latency [ms]</td>
										<td>{{ statistics.latency.min }}</td>
										<td>{{ statistics.latency.max }}</td>
										<td>
											{{
												Math.round(
													statistics.latency.average,
												)
											}}
										</td>
									</tr>
									<tr>
										<td>Round-Trip Time [ms]</td>
										<td>{{ statistics.rtt.min }}</td>
										<td>{{ statistics.rtt.max }}</td>
										<td>
											{{
												Math.round(
													statistics.rtt.average,
												)
											}}
										</td>
									</tr>
									<tr>
										<td>ACK RSSI [dBm]</td>
										<td>{{ statistics.ackRSSI.min }}</td>
										<td>{{ statistics.ackRSSI.max }}</td>
										<td>
											{{
												Math.round(
													statistics.ackRSSI.average,
												)
											}}
										</td>
									</tr>
									<tr
										v-if="
											Number.isFinite(
												statistics.responseRSSI
													?.average,
											)
										"
									>
										<td>Response RSSI [dBm]</td>
										<td>
											{{ statistics.responseRSSI.min }}
										</td>
										<td>
											{{ statistics.responseRSSI.max }}
										</td>
										<td>
											{{
												Math.round(
													statistics.responseRSSI
														.average,
												)
											}}
										</td>
									</tr>
								</tbody>
							</template>
						</v-table>
					</v-row>
				</v-container>
			</v-card-text>

			<v-card-actions>
				<v-spacer></v-spacer>
				<v-btn
					color="blue-darken-1"
					variant="text"
					@click="$emit('close')"
					>Close</v-btn
				>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<style>
.help-menu {
	max-height: 90vh;
	overflow: scroll;
}
</style>

<script>
import { copy } from '@/lib/utils'
import { mapActions } from 'pinia'

import useBaseStore from '../../stores/base.js'
import InstancesMixin from '../../mixins/InstancesMixin.js'

export default {
	components: {},
	props: {
		modelValue: Boolean, // show or hide
		node: Object,
		socket: Object,
	},
	mixins: [InstancesMixin],
	watch: {
		modelValue(v) {
			this.init(v)
		},
	},
	computed: {
		_value: {
			get() {
				return this.modelValue
			},
			set(val) {
				this.$emit('update:modelValue', val)
			},
		},
	},
	data() {
		return {
			running: false,
			activeNode: null,
			isRunning: false,
			mode: 0,
			modes: [
				// FIXME: Fill with enum variants
				{
					title: 'Basic Set On/Off',
					value: 0,
				},
			],
			infinite: false,
			interval: 250,
			iterations: 100,
			statistics: null,
			progress: 0,
		}
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		exportResults() {
			this.app.exportConfiguration(
				this.results,
				`linkReliability_${this.activeNode.id}-${this.statistics}`,
				'json',
			)
		},
		init(open) {
			const wasRunning = this.running
			this.mode = 0
			this.statistics = null
			this.infinite = false
			this.running = false
			this.interval = 250
			this.iterations = 25
			this.progress = 0

			if (open) {
				this.activeNode = copy(this.node)

				this.bindEvent('linkReliability', this.onProgress.bind(this))
			} else if (open === false) {
				this.unbindEvents()
				if (wasRunning) {
					this.abortLinkReliabilityCheck()
				}
			}
		},
		onProgress(data) {
			this.statistics = data.args[0]
			this.progress = Math.round(
				(this.statistics.rounds / this.iterations) * 100,
			)
		},
		async abortLinkReliabilityCheck() {
			const response = await this.app.apiRequest(
				`abortLinkReliabilityCheck`,
				[this.activeNode.id],
			)

			this.running = false

			if (response.success) {
				this.showSnackbar('Link statistics aborted', 'success')
			}
		},
		async checkLinkReliability() {
			this.running = true

			const response = await this.app.apiRequest(
				`checkLinkReliability`,
				[
					this.activeNode.id,
					{
						mode: this.mode,
						interval: this.interval,
						rounds: this.infinite ? undefined : this.iterations,
					},
				],
				{
					infoSnack: true,
					errorSnack: false,
				},
			)

			this.running = false
			this.progress = 0

			if (response.success) {
				this.statistics = response.result
			} else {
				this.showSnackbar(
					response.message || 'Health check failed',
					'error',
				)
			}
		},
	},
	beforeUnmount() {
		this.init(false)
	},
}
</script>
