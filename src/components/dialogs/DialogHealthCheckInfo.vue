<template>
	<v-dialog fullscreen @keydown.esc="_value = false" v-model="_value">
		<v-card class="fill">
			<!-- Add close button on top right -->
			<v-row>
				<v-spacer></v-spacer>
				<v-btn class="ma-3" icon @click="_value = false">
					<v-icon>close</v-icon>
				</v-btn>
			</v-row>
			<v-list density="compact">
				<v-list-item>
					<v-list-item-title>Route changes</v-list-item-title>
					<v-list-item-subtitle
						>How many times at least one new route was needed. Lower
						= better, ideally 0. Only available if the controller
						supports TX reports</v-list-item-subtitle
					>
				</v-list-item>
				<v-list-item>
					<v-list-item-title>Latency</v-list-item-title>
					<v-list-item-subtitle
						>The maximum time it took to send a ping to the node.
						Lower = better, ideally 10 ms. Will use the time in TX
						reports if available, otherwise fall back to measuring
						the round trip time.</v-list-item-subtitle
					>
				</v-list-item>
				<v-list-item>
					<v-list-item-title>No. Neighbors</v-list-item-title>
					<v-list-item-subtitle
						>How many routing neighbors this node has. Higher =
						better, ideally > 2</v-list-item-subtitle
					>
				</v-list-item>
				<v-list-item>
					<v-list-item-title>Failed Pings node</v-list-item-title>
					<v-list-item-subtitle
						>How many pings were not ACKed by the node. Lower =
						better, ideally 0.</v-list-item-subtitle
					>
				</v-list-item>
				<v-list-item>
					<v-list-item-title>Min Power Level</v-list-item-title>
					<v-list-item-subtitle
						>The minimum powerlevel where all pings from the
						(source) node were ACKed by the target node /
						controller. Lower = better, ideally -6dBm or less. Only
						available if the (source) node supports Powerlevel
						CC</v-list-item-subtitle
					>
				</v-list-item>
				<v-list-item>
					<v-list-item-title
						>Failed pings Controller</v-list-item-title
					>
					<v-list-item-subtitle
						>If no powerlevel was found where the controller ACKed
						all pings from the node, this contains the number of
						pings that weren't ACKed. Lower = better, ideally
						0.</v-list-item-subtitle
					>
				</v-list-item>
				<v-list-item>
					<v-list-item-title>SNR Margin</v-list-item-title>
					<v-list-item-subtitle
						>An estimation of the Signal-to-Noise Ratio Margin in
						dBm. Only available if the controller supports TX
						reports.</v-list-item-subtitle
					>
				</v-list-item>
				<v-list-item>
					<v-list-item-title>Rating</v-list-item-title>
				</v-list-item>
			</v-list>
			<v-data-table
				:headers="headers"
				:items="values"
				class="elevation-1"
				:mobile-breakpoint="0"
				hide-default-footer
				disable-pagination
			>
				<template v-slot:footer>
					<p class="mb-0 text-caption">
						<code>*</code> Due to missing insight into re-routing
						attempts between two nodes, some of the values for the
						for the route check rating don't exist here and are only
						present in lifeline checks (when target node is the
						controller). Furthermore, it is not guaranteed that a
						route between two nodes and lifeline with the same
						health rating have the same quality.
					</p>
				</template>
			</v-data-table>
		</v-card>
	</v-dialog>
</template>

<script>
export default {
	props: {
		modelValue: {
			type: Boolean,
			default: false,
		},
	},
	emits: ['update:modelValue'],
	data() {
		return {
			headers: [
				{ title: 'Rating', key: 'rating', sortable: false },
				{
					title: 'Failed pings',
					key: 'failedPings',
					sortable: false,
				},
				{ title: 'Max latency (*)', key: 'latency', sortable: false },
				{
					title: 'No. of Neighbors',
					key: 'neighbors',
					sortable: false,
				},
				{
					title: 'SNR margin (*)',
					key: 'snrMargin',
					sortable: false,
				},
				{
					title: 'Min power level w/o errors',
					key: 'minPowerlevel',
					sortable: false,
				},
			],
			values: [
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
	computed: {
		_value: {
			get() {
				return this.modelValue
			},
			set(v) {
				this.$emit('update:modelValue', v)
			},
		},
	},
}
</script>

<style></style>
