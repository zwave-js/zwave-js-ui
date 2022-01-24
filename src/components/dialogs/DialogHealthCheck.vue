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
								type="number"
								persistent-hint
							></v-text-field>
						</v-col>
					</v-row>

					<v-row class="mb-2" justify="center">
						<v-btn
							color="success"
							:disabled="loading || !targetNode"
							@click="checkHealth()"
							>Check</v-btn
						>
					</v-row>

					<v-data-table
						:headers="headers"
						:items="results"
						item-key="id"
						class="elevation-1"
						v-if="results.length > 0"
					>
						<template v-slot:[`item.rating`]="{ item }">
							<span
								:class="
									'font-weight-bold ' +
									ratingColor(item.rating)
								"
								v-if="item.rating !== undefined"
								>{{ item.rating }}</span
							>
							<v-progress-circular
								v-else
								indeterminate
							></v-progress-circular>
						</template>
						<template v-slot:[`item.latency`]="{ item }">
							<span v-if="item.latency !== undefined"
								>{{ item.latency }} ms</span
							>
						</template>
						<template v-slot:[`item.snrMargin`]="{ item }">
							<span v-if="item.snrMargin !== undefined"
								>{{ item.snrMargin }} dBm</span
							>
						</template>
						<template v-slot:[`item.minPowerLevel`]="{ item }">
							<span v-if="item.minPowerLevel !== undefined"
								>{{ item.minPowerLevel }} dBm</span
							>
						</template>

						<template v-slot:[`item.failedPingsNode`]="{ item }">
							<p
								class="mb-0"
								v-if="item.failedPingsNode !== undefined"
							>
								Node: {{ item.failedPingsNode }}
							</p>
							<p
								class="mb-0"
								v-if="item.failedPingsController !== undefined"
							>
								Controller: {{ item.failedPingsController }}
							</p>
						</template>

						<template
							v-slot:[`item.failedPingsToSource`]="{ item }"
						>
							<p
								class="mb-0"
								v-if="item.failedPingsToSource !== undefined"
							>
								Source: {{ item.failedPingsToSource }}
							</p>
							<p
								class="mb-0"
								v-if="item.failedPingsToTarget !== undefined"
							>
								Target: {{ item.failedPingsToTarget }}
							</p>
						</template>

						<template
							v-slot:[`item.minPowerlevelSource`]="{ item }"
						>
							<p
								class="mb-0"
								v-if="item.minPowerlevelSource !== undefined"
							>
								Source: {{ item.minPowerlevelSource }} dBm
							</p>
							<p
								class="mb-0"
								v-if="item.minPowerlevelTarget !== undefined"
							>
								Target: {{ item.minPowerlevelTarget }} dBm
							</p>
						</template>
					</v-data-table>
				</v-container>
			</v-card-text>

			<v-card-actions>
				<v-spacer></v-spacer>
				<v-btn color="blue darken-1" text @click="$emit('close')"
					>Cancel</v-btn
				>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script>
import { socketEvents, inboundEvents } from '@/plugins/socket'
import { copy } from '@/lib/utils'

export default {
	components: {},
	props: {
		value: Boolean, // show or hide
		socket: Object,
		node: Object,
		nodes: Array,
	},
	watch: {
		value(v) {
			this.init(v)
		},
	},
	computed: {
		filteredNodes() {
			return this.activeNode
				? this.nodes.filter((n) => n.id !== this.activeNode.id)
				: this.nodes
		},
		headers() {
			if (this.mode === 'Lifeline') {
				return [
					{ text: 'Latency', value: 'latency' },
					{ text: 'Failed pings', value: 'failedPingsNode' },
					{ text: 'Route Changes', value: 'routeChanges' },
					{ text: 'SNR margin', value: 'snrMargin' },
					{ text: 'Min power level', value: 'minPowerlevel' },
					{ text: 'Rating', value: 'rating' },
				]
			} else {
				return [
					{ text: 'Failed pings', value: 'failedPingsToSource' },
					{ text: 'Min Power Level', value: 'minPowerlevelSource' },
					{ text: 'Neighbors', value: 'numNeighbors' },
					{ text: 'Rating', value: 'rating' },
				]
			}
		},
	},
	data() {
		return {
			bindedSocketEvents: {},
			loading: false,
			results: [],
			rounds: 5,
			targetNode: null,
			activeNode: null,
			mode: 'Lifeline',
		}
	},
	methods: {
		ratingColor(rating) {
			if (rating >= 6) {
				return 'green--text'
			} else if (rating >= 4) {
				return 'orange--text'
			} else {
				return 'red--text'
			}
		},
		init(open) {
			if (open) {
				this.rounds = 5
				this.activeNode = copy(this.node)
				this.selectedNode = this.filteredNodes[0]
					? this.filteredNodes[0].id
					: null
				this.bindEvent(
					'healthCheckProgress',
					this.onHealthCheckProgress.bind(this)
				)
				this.bindEvent('api', this.onApiResponse.bind(this))
			} else if (open === false) {
				this.unbindEvents()
				this.results = []
				this.loading = false
				this.targetNode = null
			}
		},
		onApiResponse(data) {
			if (
				data.api === 'checkLifelineHealth' ||
				data.api === 'checkRouteHealth'
			) {
				this.loading = false
				if (data.success) {
					const res = data.result

					this.results = res.results
				}
			}
		},
		onHealthCheckProgress(data) {
			// eslint-disable-next-line no-unused-vars
			const { request, round, totalRounds, lastRating } = data

			// prevent showing results of other requests
			if (request.nodeId === this.activeNode.id) {
				const lastResult = this.results[this.results.length - 1]

				if (lastResult) {
					Object.assign(lastResult, {
						rating: lastRating,
					})
				}
				this.results.push({
					round,
					rating: undefined,
				})
			}
		},
		bindEvent(eventName, handler) {
			this.socket.on(socketEvents[eventName], handler)
			this.bindedSocketEvents[eventName] = handler
		},
		unbindEvents() {
			for (const event in this.bindedSocketEvents) {
				this.socket.off(
					socketEvents[event],
					this.bindedSocketEvents[event]
				)
			}

			this.bindedSocketEvents = {}
		},
		checkHealth() {
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

			this.socket.emit(inboundEvents.zwave, {
				api: `check${this.mode}Health`,
				args,
			})

			this.results.push({
				round: 1,
				rating: undefined,
			})
		},
	},
	beforeDestroy() {
		this.init(false)
	},
}
</script>
