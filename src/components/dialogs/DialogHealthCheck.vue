<template>
	<v-dialog v-model="value" max-width="800px" persistent>
		<v-card :loading="loading">
			<v-card-title>
				<span class="headline"
					>Node {{ activeNode ? activeNode.id : '' }} - Health
					check</span
				>
			</v-card-title>

			<v-card-text>
				<v-container>
					<v-row class="ma-3" justify="start">
						<v-col>
							<v-combobox
								style="max-width: 300px"
								label="Target Node"
								v-model="targetNode"
								:items="filteredNodes"
								return-object
								hint="Target node to run the route health check on"
								persistent-hint
								item-text="_name"
								item-value="id"
							></v-combobox>
						</v-col>
						<v-col>
							<v-text-field
								v-model.number="rounds"
								hint="Number of rounds to run the health check"
								label="Rounds"
								min="1"
								max="10"
								type="number"
								persistent-hint
							></v-text-field>
						</v-col>
					</v-row>

					<v-row class="mb-2" justify="space-around">
						<v-btn
							:color="loading ? 'error' : 'success'"
							:disabled="!targetNode"
							@click="loading ? stopHealth() : checkHealth()"
							>{{ loading ? 'Stop' : 'Check' }}</v-btn
						>
						<v-menu
							:close-on-content-click="false"
							offset-y
							bottom
							open-on-click
							content-class="help-menu"
						>
							<template v-slot:activator="{ on, attrs }">
								<v-btn color="primary" v-on="on" v-bind="attrs">
									<v-icon>help</v-icon>
								</v-btn>
							</template>
							<v-list dense>
								<v-list-item>
									<v-list-item-content class="ma-0">
										<v-list-item-title
											>Route changes</v-list-item-title
										>
										<v-list-item-subtitle
											>How many times at least one new
											route was needed. Lower = better,
											ideally 0. Only available if the
											controller supports TX
											reports</v-list-item-subtitle
										>
									</v-list-item-content>
								</v-list-item>
								<v-list-item>
									<v-list-item-content>
										<v-list-item-title
											>Latency</v-list-item-title
										>
										<v-list-item-subtitle
											>The maximum time it took to send a
											ping to the node. Lower = better,
											ideally 10 ms. Will use the time in
											TX reports if available, otherwise
											fall back to measuring the round
											trip time.</v-list-item-subtitle
										>
									</v-list-item-content>
								</v-list-item>
								<v-list-item>
									<v-list-item-content>
										<v-list-item-title
											>No. Neighbors</v-list-item-title
										>
										<v-list-item-subtitle
											>How many routing neighbors this
											node has. Higher = better, ideally >
											2</v-list-item-subtitle
										>
									</v-list-item-content>
								</v-list-item>
								<v-list-item>
									<v-list-item-content>
										<v-list-item-title
											>Failed Pings
											node</v-list-item-title
										>
										<v-list-item-subtitle
											>How many pings were not ACKed by
											the node. Lower = better, ideally
											0.</v-list-item-subtitle
										>
									</v-list-item-content>
								</v-list-item>
								<v-list-item>
									<v-list-item-content>
										<v-list-item-title
											>Min Power Level</v-list-item-title
										>
										<v-list-item-subtitle
											>The minimum powerlevel where all
											pings from the (source) node were
											ACKed by the target node /
											controller. Lower = better, ideally
											-6dBm or less. Only available if the
											(source) node supports Powerlevel
											CC</v-list-item-subtitle
										>
									</v-list-item-content>
								</v-list-item>
								<v-list-item>
									<v-list-item-content>
										<v-list-item-title
											>Failed pings
											Controller</v-list-item-title
										>
										<v-list-item-subtitle
											>If no powerlevel was found where
											the controller ACKed all pings from
											the node, this contains the number
											of pings that weren't ACKed. Lower =
											better, ideally
											0.</v-list-item-subtitle
										>
									</v-list-item-content>
								</v-list-item>
								<v-list-item>
									<v-list-item-content>
										<v-list-item-title
											>SNR Margin</v-list-item-title
										>
										<v-list-item-subtitle
											>An estimation of the
											Signal-to-Noise Ratio Margin in dBm.
											Only available if the controller
											supports TX
											reports.</v-list-item-subtitle
										>
									</v-list-item-content>
								</v-list-item>
								<v-list-item>
									<v-list-item-content>
										<v-list-item-title
											>Rating</v-list-item-title
										>
									</v-list-item-content>
								</v-list-item>
							</v-list>
							<v-data-table
								:headers="hintHeaders"
								:items="hintValues"
								class="elevation-1"
								:mobile-breakpoint="0"
								hide-default-footer
								disable-pagination
							>
								<template v-slot:footer>
									<p class="mb-0 text-caption">
										<code>*</code> Due to missing insight
										into re-routing attempts between two
										nodes, some of the values for the for
										the route check rating don't exist here
										and are only present in lifeline checks
										(when target node is the controller).
										Furthermore, it is not guaranteed that a
										route between two nodes and lifeline
										with the same health rating have the
										same quality.
									</p>
								</template>
							</v-data-table>
						</v-menu>
					</v-row>

					<v-row
						v-if="averages && !loading"
						class="mb-2"
						justify="space-around"
					>
						<v-col
							v-if="averages.numNeighbors && !isLR"
							class="text-center"
						>
							<p class="mb-1 subtitle-1 font-weight-bold">
								No. Neighbors
							</p>
							<span
								:class="
									getNeighborsColor(averages.numNeighbors)
								"
								class="text-h3"
								>{{ averages.numNeighbors }}</span
							>
						</v-col>

						<v-col v-if="averages.rating" class="text-center">
							<p class="mb-1 subtitle-1 font-weight-bold">
								Rating
							</p>
							<span
								:class="
									getRatingColor(averages.rating) + '--text'
								"
								class="text-h3"
								>{{ averages.rating }}/10</span
							>
						</v-col>
					</v-row>

					<v-data-table
						:headers="headers"
						:items="results"
						item-key="id"
						class="elevation-1"
						v-if="results.length > 0"
						hide-default-footer
						:items-per-page="-1"
					>
						<template v-slot:top>
							<v-btn
								text
								v-if="!loading && resultsTargetNode >= 0"
								color="primary"
								@click="exportResults"
								class="mb-2"
								>Export</v-btn
							>
						</template>
						<template v-slot:[`item.rating`]="{ item }">
							<v-progress-linear
								rounded
								style="min-width: 80px"
								height="25"
								:value="item.rating * 10"
								:color="getRatingColor(item.rating)"
								:indeterminate="item.rating === undefined"
							>
								<strong v-if="item.rating !== undefined"
									>{{ item.rating }}/10</strong
								>
							</v-progress-linear>
						</template>
						<template v-slot:[`item.latency`]="{ item }">
							<strong
								:class="getLatencyColor(item.latency)"
								v-if="item.latency !== undefined"
								>{{ item.latency }} ms</strong
							>
						</template>
						<template v-slot:[`item.snrMargin`]="{ item }">
							<strong
								:class="getSnrMarginColor(item.snrMargin)"
								v-if="item.snrMargin !== undefined"
								>{{ item.snrMargin }} dBm</strong
							>
						</template>

						<template v-slot:[`item.routeChanges`]="{ item }">
							<strong v-if="item.routeChanges !== undefined">{{
								item.routeChanges
							}}</strong>
						</template>

						<template v-slot:[`item.minPowerlevel`]="{ item }">
							<strong
								:class="getPowerLevelColor(item.minPowerlevel)"
								v-if="item.minPowerlevel !== undefined"
								>{{ getPowerLevel(item.minPowerlevel) }}</strong
							>
						</template>

						<template v-slot:[`item.failedPingsNode`]="{ item }">
							<p
								class="mb-0"
								v-if="item.failedPingsNode !== undefined"
							>
								{{ resultsTargetNode }} → {{ activeNode.id }}:
								<strong
									:class="
										getFailedPingsColor(
											item.failedPingsNode,
										)
									"
									>{{ item.failedPingsNode }}/10</strong
								>
							</p>
							<p
								class="mb-0"
								v-if="item.failedPingsController !== undefined"
							>
								{{ resultsTargetNode }} ← {{ activeNode.id }}:
								<strong
									:class="
										getFailedPingsColor(
											item.failedPingsController,
										)
									"
									>{{ item.failedPingsController }}/10</strong
								>
							</p>
						</template>

						<template
							v-slot:[`item.failedPingsToSource`]="{ item }"
						>
							<p
								class="mb-0"
								v-if="item.failedPingsToSource !== undefined"
							>
								{{ resultsTargetNode }} → {{ activeNode.id }}:
								<strong
									:class="
										getFailedPingsColor(
											item.failedPingsToSource,
										)
									"
									>{{ item.failedPingsToSource }}/10</strong
								>
							</p>
							<p
								class="mb-0"
								v-if="item.failedPingsToTarget !== undefined"
							>
								{{ resultsTargetNode }} ← {{ activeNode.id }}:
								<strong
									:class="
										getFailedPingsColor(
											item.failedPingsToTarget,
										)
									"
									>{{ item.failedPingsToTarget }}/10</strong
								>
							</p>
						</template>

						<template
							v-slot:[`item.minPowerlevelSource`]="{ item }"
						>
							<p
								class="mb-0"
								v-if="item.minPowerlevelSource !== undefined"
							>
								Node {{ activeNode.id }}:
								<strong
									:class="
										getPowerLevelColor(
											item.minPowerlevelSource,
										)
									"
									>{{
										getPowerLevel(item.minPowerlevelSource)
									}}</strong
								>
							</p>
							<p
								class="mb-0"
								v-if="item.minPowerlevelTarget !== undefined"
							>
								Node {{ resultsTargetNode }}:
								<strong
									:class="
										getPowerLevelColor(
											item.minPowerlevelTarget,
										)
									"
									>{{
										getPowerLevel(item.minPowerlevelTarget)
									}}</strong
								>
							</p>
						</template>
					</v-data-table>
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
import { getEnumMemberName } from 'zwave-js/safe'
import { Powerlevel } from '@zwave-js/cc/safe'
import { mapActions, mapState } from 'pinia'

import useBaseStore from '../../stores/base.js'
import InstancesMixin from '../../mixins/InstancesMixin.js'
import { Protocols } from '@zwave-js/core/safe'

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
		...mapState(useBaseStore, ['nodes']),
		isLR() {
			return this.activeNode?.protocol === Protocols.ZWaveLongRange
		},
		filteredNodes() {
			if (this.isLR) {
				return this.nodes.filter((n) => n.isControllerNode)
			}
			return this.activeNode
				? this.nodes.filter((n) => n.id !== this.activeNode.id)
				: this.nodes
		},
		headers() {
			if (this.mode === 'Lifeline') {
				return [
					{ text: 'Max latency', value: 'latency' },
					{ text: 'Failed pings', value: 'failedPingsNode' },
					{ text: 'Route Changes', value: 'routeChanges' },
					{ text: 'SNR margin', value: 'snrMargin' },
					{
						text: 'Min power level w/o errors',
						value: 'minPowerlevel',
					},
					{ text: 'Rating', value: 'rating' },
				]
			} else {
				return [
					{ text: 'Failed pings', value: 'failedPingsToSource' },
					{
						text: 'Min Power Level w/o errors',
						value: 'minPowerlevelSource',
					},
					{ text: 'Rating', value: 'rating' },
				]
			}
		},
	},
	data() {
		return {
			loading: false,
			results: [],
			rounds: 5,
			targetNode: null,
			activeNode: null,
			resultsTargetNode: null,
			averages: null,
			mode: 'Lifeline',
			hintHeaders: [
				{ text: 'Rating', value: 'rating', sortable: false },
				{ text: 'Failed pings', value: 'failedPings', sortable: false },
				{ text: 'Max latency (*)', value: 'latency', sortable: false },
				{
					text: 'No. of Neighbors',
					value: 'neighbors',
					sortable: false,
				},
				{ text: 'SNR margin (*)', value: 'snrMargin', sortable: false },
				{
					text: 'Min power level w/o errors',
					value: 'minPowerlevel',
					sortable: false,
				},
			],
			hintValues: [
				{
					rating: 10,
					failedPings: 0,
					latency: '≤ 50 ms',
					neighbors: '> 2',
					snrMargin: '≥ 17dBm',
					minPowerlevel: '≤ -6dBm',
				},
				{
					rating: 9,
					failedPings: 0,
					latency: '≤ 100 ms',
					neighbors: '> 2',
					snrMargin: '≥ 17dBm',
					minPowerlevel: '≤ -6dBm',
				},
				{
					rating: 8,
					failedPings: 0,
					latency: '≤ 100 ms',
					neighbors: '≤ 2',
					snrMargin: '≥ 17dBm',
					minPowerlevel: '≤ -6dBm',
				},
				{
					rating: 7,
					failedPings: 0,
					latency: '≤ 100ms',
					neighbors: '> 2',
				},
				{
					rating: 6,
					failedPings: 0,
					latency: '≤ 100ms',
					neighbors: '≤ 2',
				},
				{
					rating: 5,
					failedPings: 0,
					latency: '≤ 250ms',
				},
				{
					rating: 4,
					failedPings: 0,
					latency: '≤ 500 ms',
				},
				{
					rating: 3,
					failedPings: 1,
					latency: '≤ 1000ms',
				},
				{
					rating: 2,
					failedPings: '≤ 2',
					latency: '> 1000ms',
				},
				{
					rating: 1,
					failedPings: '≤ 9',
				},
				{
					rating: 0,
					failedPings: 10,
				},
			],
		}
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		exportResults() {
			this.app.exportConfiguration(
				this.results,
				`healthCheck_${this.activeNode.id}-${this.resultsTargetNode}`,
				'json',
			)
		},
		getNeighborsColor(value) {
			if (value > 2) {
				return 'success--text'
			} else if (value === 0) {
				return 'error--text'
			} else {
				return 'warning--text'
			}
		},
		getLatencyColor(value) {
			if (value <= 100) {
				return 'success--text'
			} else if (value <= 500) {
				return 'warning--text'
			} else {
				return 'error--text'
			}
		},
		getSnrMarginColor(value) {
			if (value >= 17) {
				return 'success--text'
			} else {
				return 'error--text'
			}
		},
		getFailedPingsColor(value) {
			if (value === 0) {
				return 'success--text'
			} else if (value === 1) {
				return 'warning--text'
			} else {
				return 'error--text'
			}
		},
		getRatingColor(rating) {
			if (rating === undefined) {
				return 'primary'
			} else if (rating >= 6) {
				return 'success'
			} else if (rating >= 4) {
				return 'warning'
			} else {
				return 'error'
			}
		},
		getPowerLevel(v) {
			return getEnumMemberName(Powerlevel, v)
		},
		getPowerLevelColor(v) {
			if (v === undefined) {
				return ''
			} else if (v >= 6) {
				return 'success--text'
			} else if (v >= 3) {
				return 'warning--text'
			} else {
				return 'error--text'
			}
		},
		init(open) {
			if (open) {
				this.rounds = 5
				this.activeNode = copy(this.node)
				this.targetNode = this.filteredNodes.find(
					(n) => n.isControllerNode,
				)
				this.selectedNode = this.filteredNodes[0]
					? this.filteredNodes[0].id
					: null
				this.bindEvent(
					'healthCheckProgress',
					this.onHealthCheckProgress.bind(this),
				)
			} else if (open === false) {
				this.unbindEvents()
				this.results = []
				this.loading = false
				this.targetNode = null
				this.averages = null
			}
		},
		onHealthCheckProgress(data) {
			// eslint-disable-next-line no-unused-vars
			const { request, round, totalRounds, lastResult } = data

			// prevent showing results of other requests
			if (request.nodeId === this.activeNode.id) {
				const step = this.results[this.results.length - 1]

				if (lastResult) {
					Object.assign(step, lastResult)
				}
				if (round < totalRounds) {
					this.results.push({
						round,
						rating: undefined,
					})
				}
			}
		},
		async stopHealth() {
			const response = await this.app.apiRequest(`abortHealthCheck`, [
				this.activeNode.id,
			])

			if (response.success) {
				this.showSnackbar('Health check aborted', 'success')
			}
		},
		async checkHealth() {
			this.loading = true
			this.results = []
			const args = [this.activeNode.id]

			const targetNode =
				typeof this.targetNode === 'object'
					? this.targetNode
					: this.nodes.find((n) => n.id == this.targetNode)

			if (!targetNode) {
				return
			}

			if (targetNode.isControllerNode) {
				this.mode = 'Lifeline'
			} else {
				this.mode = 'Route'
				args.push(targetNode.id)
			}

			args.push(this.rounds || 1)

			this.results.push({
				round: 1,
				rating: undefined,
			})

			const response = await this.app.apiRequest(
				`check${this.mode}Health`,
				args,
				{
					infoSnack: true,
					errorSnack: false,
				},
			)

			this.loading = false
			if (response.success) {
				const res = response.result

				this.results = res.results
				delete res.results
				this.averages = res

				this.averages.numNeighbors = Math.max(
					...this.results.map((n) => n.numNeighbors),
				)

				this.resultsTargetNode = res.targetNodeId
			} else {
				this.results.pop()
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
