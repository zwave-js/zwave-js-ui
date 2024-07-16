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
						<v-col cols="6">
							<v-select
								label="Mode"
								v-model="mode"
								:items="modes"
								persistent-hint
							></v-select>
						</v-col>
						<v-col cols="6">
							<v-checkbox
								v-model="infinite"
								label="Infinite"
							></v-checkbox>
						</v-col>

						<v-col cols="6">
							<v-text-field
								label="Interval"
								v-model.number="interval"
								suffix="ms"
								type="number"
								persistent-hint
							></v-text-field>
						</v-col>

						<v-col cols="6">
							<v-text-field
								label="Iterations"
								v-model.number="iterations"
								type="number"
								persistent-hint
							></v-text-field>
						</v-col>
					</v-row>

					<v-row class="mb-2" justify="space-around">
						<v-btn
							color="green darken-1"
							@click="runStatistics"
							:disabled="running"
							:loading="running"
							>Run</v-btn
						>
						<v-btn
							color="red darken-1"
							@click="stopLinkStatistics"
							:disabled="!running"
							>Stop</v-btn
						>
					</v-row>

					<v-divider></v-divider>

					<v-row v-if="statistics" class="ma-3" justify="start">
						<v-list dense>
							<v-list-item>
								<v-list-item-content>
									<v-list-item-title
										>Commands Sent</v-list-item-title
									>
									<v-list-item-subtitle>{{
										statistics?.commandsSent
									}}</v-list-item-subtitle>
								</v-list-item-content>
							</v-list-item>
							<v-list-item>
								<v-list-item-content>
									<v-list-item-title
										>Tx Errors</v-list-item-title
									>
									<v-list-item-subtitle>{{
										statistics?.txErrors
									}}</v-list-item-subtitle>
								</v-list-item-content>
							</v-list-item>
							<v-list-item>
								<v-list-item-content>
									<v-list-item-title
										>Missed Responses</v-list-item-title
									>
									<v-list-item-subtitle>{{
										statistics?.missedResponses
									}}</v-list-item-subtitle>
								</v-list-item-content>
							</v-list-item>
						</v-list>

						<v-simple-table>
							<template v-slot:default>
								<thead>
									<tr>
										<th class="text-left"></th>
										<th class="text-left">Avg</th>
										<th class="text-left">Min</th>
										<th class="text-left">Max</th>
									</tr>
								</thead>
								<tbody>
									<tr
										v-for="stat in Object.keys(statistics)"
										:key="`stat-${stat}`"
									>
										<td>{{ stat }}</td>
										<td>{{ statistics[stat].avg }}</td>
										<td>{{ statistics[stat].min }}</td>
										<td>{{ statistics[stat].max }}</td>
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
				{
					text: 'Basic Set On/Off',
					value: 0,
				},
			],
			infinite: false,
			interval: 250,
			iterations: 25,
			statistics: null,
		}
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		exportResults() {
			this.app.exportConfiguration(
				this.results,
				`linkStatistics_${this.activeNode.id}-${this.statistics}`,
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

			if (open) {
				this.activeNode = copy(this.node)

				this.bindEvent(
					'linkStatistics',
					this.onLinkStatistics.bind(this),
				)
			} else if (open === false) {
				this.unbindEvents()
				if (this.running) {
					this.stopLinkStatistics()
				}
			}
		},
		onLinkStatistics(data) {
			// eslint-disable-next-line no-unused-vars
		},
		async stopLinkStatistics() {
			const response = await this.app.apiRequest(`abortLinkStatistics`, [
				this.activeNode.id,
			])

			if (response.success) {
				this.showSnackbar('Link statistics aborted', 'success')
			}

			this.running = false
		},
		async runStatistics() {
			this.running = true

			const response = await this.app.apiRequest(
				`runLinkStatistics`,
				[
					this.activeNode.id,
					{
						mode: this.mode,
						infinite: this.infinite,
						interval: this.interval,
						iterations: this.iterations,
					},
				],
				{
					infoSnack: true,
					errorSnack: false,
				},
			)

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
