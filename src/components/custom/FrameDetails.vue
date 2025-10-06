<template>
	<v-row v-if="modelValue">
		<v-col>
			<v-table class="frame-details" density="compact">
				<template #default>
					<tbody>
						<tr>
							<td>Type</td>
							<td>{{ getType(modelValue) }}</td>
						</tr>
						<tr>
							<td>Protocol</td>
							<td>{{ getProtocol(modelValue) }}</td>
						</tr>
						<tr>
							<td>Channel</td>
							<td>{{ modelValue.channel }}</td>
						</tr>
						<tr>
							<td>Region</td>
							<td>{{ getRegion(modelValue) }}</td>
						</tr>
						<tr>
							<td>RSSI</td>
							<td>{{ getRssi(modelValue) }}</td>
						</tr>
						<tr>
							<td>Protocol Data Rate</td>
							<td>
								{{
									getProtocolDataRate(modelValue) +
									(modelValue.speedModified
										? ' (speed modified)'
										: '')
								}}
							</td>
						</tr>
						<tr>
							<td>Sequence Number</td>
							<td>{{ modelValue.sequenceNumber }}</td>
						</tr>
						<tr v-if="modelValue.payload">
							<td>Payload</td>
							<td>{{ modelValue.payload }}</td>
						</tr>
						<tr>
							<td>Home ID</td>
							<td>
								{{
									modelValue.homeId
										? modelValue.homeId.toString(16)
										: ''
								}}
							</td>
						</tr>
						<tr>
							<td>Route</td>
							<td v-html="getRoute(modelValue, true)"></td>
						</tr>
						<tr v-if="modelValue.ackRequested !== undefined">
							<td>Ack Requested</td>
							<td>{{ modelValue.ackRequested }}</td>
						</tr>
						<tr v-if="modelValue.routedAck">
							<td>Routed Ack</td>
							<td>{{ modelValue.routedAck }}</td>
						</tr>
						<tr v-if="modelValue.routedError">
							<td>Routed Error</td>
							<td>{{ modelValue.routedError }}</td>
						</tr>
					</tbody>
				</template>
			</v-table>
		</v-col>
		<v-col>
			<CCTreeView
				class="my-2"
				v-if="modelValue.parsedPayload"
				:modelValue="modelValue.parsedPayload"
			></CCTreeView>
			<span class="text-caption">Raw</span>
			<v-textarea
				class="mono"
				readonly
				hide-details
				variant="solo"
				no-resize
				v-model="modelValue.raw"
				rows="2"
			></v-textarea>
		</v-col>
	</v-row>
	<v-row class="fill" justify="center" align="center" v-else>
		<v-col class="text-center text-caption">
			<span dense>Click on a frame in table to see details</span>
		</v-col>
	</v-row>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import {
	getRegion,
	getRoute,
	getType,
	getRssi,
	getProtocol,
	getProtocolDataRate,
} from '../../lib/utils.js'

export default {
	props: {
		modelValue: Object,
	},
	components: {
		CCTreeView: defineAsyncComponent(() => import('./CCTreeView.vue')),
	},
	data: () => ({}),
	methods: {
		getRegion,
		getRoute,
		getType,
		getRssi,
		getProtocolDataRate,
		getProtocol,
	},
}
</script>

<style scoped>
.frame-details :deep(td:first-child) {
	max-width: 50px !important;
}
</style>
