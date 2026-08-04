<template>
	<ZwDialog
		:model-value="_value"
		size="lg"
		dismiss="button"
		:loading="loading"
		:title="`Node ${activeNode ? activeNode.id : ''} - Health check`"
		:actions="dialogActions"
		@update:model-value="_value = $event"
		@after-leave="teardown"
	>
		<v-container class="pa-0">
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
						item-title="_name"
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
					variant="flat"
					:color="loading ? 'error' : 'success'"
					:disabled="!targetNode"
					@click="loading ? stopHealth() : checkHealth()"
					>{{ loading ? 'Stop' : 'Check' }}</v-btn
				>

				<v-btn variant="flat" color="primary" @click="infoMenu = true">
					Info
					<v-icon>help</v-icon>
				</v-btn>
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
					<p class="mb-1 text-subtitle-1 font-weight-bold">
						No. Neighbors
					</p>
					<span
						:class="getNeighborsColor(averages.numNeighbors)"
						class="text-h3"
						>{{ averages.numNeighbors }}</span
					>
				</v-col>

				<v-col v-if="averages.rating" class="text-center">
					<p class="mb-1 text-subtitle-1 font-weight-bold">Rating</p>
					<span
						:class="'text-' + getRatingColor(averages.rating)"
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
				<template #top>
					<v-row class="py-2" align="center" justify="center">
						<v-btn
							variant="flat"
							v-if="!loading && resultsTargetNode >= 0"
							color="primary"
							@click="exportResults"
							class="mb-2"
							>Export
							<v-icon>file_download</v-icon>
						</v-btn>
					</v-row>
				</template>
				<template #[`item.rating`]="{ item }">
					<span class="zw-hc-rating">
						<ZwProgressBar
							as="span"
							class="zw-hc-rating__bar"
							:style="{
								'--zw-progress-fill': ratingFill(item.rating),
							}"
							:value="
								item.rating === undefined
									? null
									: item.rating / 10
							"
						/>
						<strong v-if="item.rating !== undefined"
							>{{ item.rating }}/10</strong
						>
					</span>
				</template>
				<template #[`item.latency`]="{ item }">
					<strong
						:class="getLatencyColor(item.latency)"
						v-if="item.latency !== undefined"
						>{{ item.latency }} ms</strong
					>
				</template>
				<template #[`item.snrMargin`]="{ item }">
					<strong
						:class="getSnrMarginColor(item.snrMargin)"
						v-if="item.snrMargin !== undefined"
						>{{ item.snrMargin }} dBm</strong
					>
				</template>

				<template #[`item.routeChanges`]="{ item }">
					<strong v-if="item.routeChanges !== undefined">{{
						item.routeChanges
					}}</strong>
				</template>

				<template #[`item.minPowerlevel`]="{ item }">
					<strong
						:class="getPowerLevelColor(item.minPowerlevel)"
						v-if="item.minPowerlevel !== undefined"
						>{{ getPowerLevel(item.minPowerlevel) }}</strong
					>
				</template>

				<template #[`item.failedPingsNode`]="{ item }">
					<p class="mb-0" v-if="item.failedPingsNode !== undefined">
						{{ resultsTargetNode }} → {{ activeNode.id }}:
						<strong
							:class="getFailedPingsColor(item.failedPingsNode)"
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
								getFailedPingsColor(item.failedPingsController)
							"
							>{{ item.failedPingsController }}/10</strong
						>
					</p>
				</template>

				<template #[`item.failedPingsToSource`]="{ item }">
					<p
						class="mb-0"
						v-if="item.failedPingsToSource !== undefined"
					>
						{{ resultsTargetNode }} → {{ activeNode.id }}:
						<strong
							:class="
								getFailedPingsColor(item.failedPingsToSource)
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
								getFailedPingsColor(item.failedPingsToTarget)
							"
							>{{ item.failedPingsToTarget }}/10</strong
						>
					</p>
				</template>

				<template #[`item.minPowerlevelSource`]="{ item }">
					<p
						class="mb-0"
						v-if="item.minPowerlevelSource !== undefined"
					>
						Node {{ activeNode.id }}:
						<strong
							:class="
								getPowerLevelColor(item.minPowerlevelSource)
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
								getPowerLevelColor(item.minPowerlevelTarget)
							"
							>{{
								getPowerLevel(item.minPowerlevelTarget)
							}}</strong
						>
					</p>
				</template>
			</v-data-table>
		</v-container>
	</ZwDialog>
	<dialog-health-check-info
		v-model="infoMenu"
		v-if="infoMenu"
	></dialog-health-check-info>
</template>

<script>
import { copy } from '@/lib/utils'
import { cancelAction } from '@/lib/dashboard-types'
import { getEnumMemberName } from '@zwave-js/shared'
import { Powerlevel } from '@zwave-js/cc'
import { mapState } from 'pinia'
import { Protocols } from '@zwave-js/core'

import useBaseStore from '../../stores/base.js'
import InstancesMixin from '../../mixins/InstancesMixin.js'
import { defineAsyncComponent } from 'vue'
import ZwDialog from '@/components/dashboard/dialogs/ZwDialog.vue'
import ZwProgressBar from '@/components/dashboard/atoms/ZwProgressBar.vue'

export default {
	components: {
		ZwDialog,
		ZwProgressBar,
		DialogHealthCheckInfo: defineAsyncComponent(
			() => import('./DialogHealthCheckInfo.vue'),
		),
	},
	emits: ['update:modelValue', 'close'],
	props: {
		modelValue: Boolean, // show or hide
		node: Object,
		socket: Object,
	},
	mixins: [InstancesMixin],
	watch: {
		modelValue(v) {
			if (v) this.init(v)
		},
	},
	computed: {
		...mapState(useBaseStore, ['nodes']),
		dialogActions() {
			return [
				cancelAction(() => (this._value = false), { label: 'Close' }),
			]
		},
		_value: {
			get() {
				return this.modelValue
			},
			// Lowering the model is the only dismissal path, so `close` rides it
			set(val) {
				this.$emit('update:modelValue', val)
				if (!val) this.$emit('close')
			},
		},
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
					{ title: 'Max latency', key: 'latency' },
					{ title: 'Failed pings', key: 'failedPingsNode' },
					{ title: 'Route Changes', key: 'routeChanges' },
					{ title: 'SNR margin', key: 'snrMargin' },
					{
						title: 'Min power level w/o errors',
						key: 'minPowerlevel',
					},
					{ title: 'Rating', key: 'rating' },
				]
			} else {
				return [
					{ title: 'Failed pings', key: 'failedPingsToSource' },
					{
						title: 'Min Power Level w/o errors',
						key: 'minPowerlevelSource',
					},
					{ title: 'Rating', key: 'rating' },
				]
			}
		},
	},
	data() {
		return {
			loading: false,
			infoMenu: false,
			results: [],
			rounds: 5,
			targetNode: null,
			activeNode: null,
			resultsTargetNode: null,
			averages: null,
			mode: 'Lifeline',
		}
	},
	methods: {
		exportResults() {
			this.app.exportConfiguration(
				this.results,
				`healthCheck_${this.activeNode.id}-${this.resultsTargetNode}`,
				'json',
			)
		},
		getNeighborsColor(value) {
			if (value > 2) {
				return 'text-success'
			} else if (value === 0) {
				return 'text-error'
			} else {
				return 'text-warning'
			}
		},
		getLatencyColor(value) {
			if (value <= 100) {
				return 'text-success'
			} else if (value <= 500) {
				return 'text-warning'
			} else {
				return 'text-error'
			}
		},
		getSnrMarginColor(value) {
			if (value >= 17) {
				return 'text-success'
			} else {
				return 'text-error'
			}
		},
		getFailedPingsColor(value) {
			if (value === 0) {
				return 'text-success'
			} else if (value === 1) {
				return 'text-warning'
			} else {
				return 'text-error'
			}
		},
		ratingFill(rating) {
			if (rating === undefined) return 'var(--zw-accent)'
			if (rating >= 6) return 'var(--zw-ok)'
			if (rating >= 4) return 'var(--zw-warning)'
			return 'var(--zw-danger)'
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
				return 'text-success'
			} else if (v >= 3) {
				return 'text-warning'
			} else {
				return 'text-error'
			}
		},
		init(open) {
			// `after-leave` never fires when a re-open cancels the leave, so
			// the reset has to happen here as well
			this.results = []
			this.averages = null
			this.loading = false
			this.targetNode = null

			if (open) {
				this.rounds = 5
				this.activeNode = copy(this.node)
				this.targetNode = this.filteredNodes.find(
					(n) => n.isControllerNode,
				)
				this.selectedNode = this.filteredNodes[0]
					? this.filteredNodes[0].id
					: null
				this.subscribeChannels(['diagnostics'])
				this.bindEvent(
					'healthCheckProgress',
					this.onHealthCheckProgress.bind(this),
				)
			}
		},
		teardown() {
			this.unbindEvents()
			this.init(false)
		},
		onHealthCheckProgress(data) {
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
	beforeUnmount() {
		this.teardown()
	},
}
</script>

<style scoped>
.zw-hc-rating {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	min-width: 80px;
}

.zw-hc-rating__bar {
	--zw-progress-h: 5px;
	flex: 1;
	min-width: 48px;
}
</style>
