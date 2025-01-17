<template>
	<v-dialog v-model="value" max-width="800px" persistent>
		<v-card>
			<v-card-title>
				<span class="headline"
					>Node {{ activeNode ? activeNode.id : '' }} - Link
					Statistics</span
				>
			</v-card-title>

			<v-card-text>
				<v-container>
					<v-row class="ma-3" justify="start">
						<v-col cols="12">
							<v-select
								label="Mode"
								style="max-width: 325px"
								v-model="mode"
								:items="modes"
								persistent-hint
							></v-select>
						</v-col>

						<v-col cols="6">
							<v-radio-group
								class="justify-center"
								v-model="infinite"
							>
								<v-radio
									label="Infinite"
									:value="true"
								></v-radio>
								<v-radio label="XX" :value="false">
									<template v-slot:label>
										<v-text-field
											:disabled="infinite"
											label="Iterations"
											v-model.number="iterations"
											type="number"
											:min="1"
											:max="10000"
											persistent-hint
										></v-text-field>
									</template>
								</v-radio>
							</v-radio-group>
						</v-col>

						<v-col cols="6" class="justify-center">
							<v-text-field
								label="Interval"
								v-model.number="interval"
								suffix="ms"
								type="number"
								:min="1"
								:max="10000"
								persistent-hint
							></v-text-field>
						</v-col>
					</v-row>

					<v-row class="mb-4" justify="space-around">
						<v-btn
							color="success"
							@click="checkLinkReliability"
							:disabled="running"
							:loading="running"
							>Run</v-btn
						>
						<v-btn
							color="error"
							@click="abortLinkReliabilityCheck"
							:disabled="!running"
							>Stop</v-btn
						>
					</v-row>

					<v-divider></v-divider>

					<v-row v-if="statistics" class="ma-3" justify="center">
						<v-progress-linear
							v-if="running"
							:indeterminate="this.infinite"
							:value="this.infinite ? null : this.progress"
							color="success"
						></v-progress-linear>
						<v-list dense>
							<v-list-item>
								<v-list-item-content>
									<v-list-item-title class="info--text"
										>Commands Sent</v-list-item-title
									>
									<v-list-item-subtitle>{{
										statistics.commandsSent
									}}</v-list-item-subtitle>
								</v-list-item-content>
							</v-list-item>
							<v-list-item>
								<v-list-item-content>
									<v-list-item-title class="error--text"
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
								</v-list-item-content>
							</v-list-item>
							<v-list-item
								v-if="statistics?.missingResponses != undefined"
							>
								<v-list-item-content>
									<v-list-item-title class="error--text"
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
								</v-list-item-content>
							</v-list-item>
						</v-list>

						<v-simple-table>
							<template v-slot:default>
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
						</v-simple-table>
					</v-row>
				</v-container>
			</v-card-text>

			<v-card-actions>
				<v-spacer></v-spacer>
				<v-btn color="blue darken-1" text @click="$emit('close')"
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
		value: Boolean, // show or hide
		node: Object,
		socket: Object,
	},
	mixins: [InstancesMixin],
	watch: {
		value(v) {
			this.init(v)
		},
	},
	computed: {
		// ...mapState(useBaseStore, ['nodes']),
	},
	data() {
		return {
			running: false,
			activeNode: null,
			isRunning: false,
			mode: 'Lifeline',
			modes: [
				// FIXME: Fill with enum variants
				{
					text: 'Basic Set On/Off',
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
				if (this.running) {
					this.abortLinkReliabilityCheck()
				}
			}
		},
		onProgress(data) {
			// eslint-disable-next-line no-unused-vars
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
	beforeDestroy() {
		this.init(false)
	},
}
</script>
