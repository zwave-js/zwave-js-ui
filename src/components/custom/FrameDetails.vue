<template>
	<v-row v-if="value">
		<v-col>
			<v-simple-table class="frame-details" dense>
				<template v-slot:default>
					<tbody>
						<tr>
							<td>Type</td>
							<td>{{ getType(value) }}</td>
						</tr>
						<tr>
							<td>Protocol</td>
							<td>{{ getProtocol(value) }}</td>
						</tr>
						<tr>
							<td>Channel</td>
							<td>{{ value.channel }}</td>
						</tr>
						<tr>
							<td>Region</td>
							<td>{{ getRegion(value) }}</td>
						</tr>
						<tr>
							<td>RSSI</td>
							<td>{{ getRssi(value) }}</td>
						</tr>
						<tr>
							<td>Protocol Data Rate</td>
							<td>
								{{
									getProtocolDataRate(value) +
									(value.speedModified
										? ' (speed modified)'
										: '')
								}}
							</td>
						</tr>
						<tr>
							<td>Sequence Number</td>
							<td>{{ value.sequenceNumber }}</td>
						</tr>
						<tr>
							<td>Home ID</td>
							<td>
								{{
									value.homeId
										? value.homeId.toString(16)
										: ''
								}}
							</td>
						</tr>
						<tr>
							<td>Route</td>
							<td v-html="getRoute(value, true)"></td>
						</tr>
						<tr v-if="value.ackRequested !== undefined">
							<td>Ack Requested</td>
							<td>{{ value.ackRequested }}</td>
						</tr>
						<tr v-if="value.routedAck">
							<td>Routed Ack</td>
							<td>{{ value.routedAck }}</td>
						</tr>
						<tr v-if="value.routedError">
							<td>Routed Error</td>
							<td>{{ value.routedError }}</td>
						</tr>
					</tbody>
				</template>
			</v-simple-table>
		</v-col>
		<v-col v-if="value.payload || value.parsedPayload">
			<CCTreeView
				v-if="value.parsedPayload"
				:value="value.parsedPayload"
			></CCTreeView>
			<v-textarea
				v-else
				readonly
				label="Payload"
				v-model="value.payload"
				rows="10"
			></v-textarea>
		</v-col>
	</v-row>
</template>

<script>
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
		value: Object,
	},
	components: {
		CCTreeView: () => import('./CCTreeView.vue'),
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
.frame-details::v-deep td:first-child {
	max-width: 50px !important;
}
</style>
