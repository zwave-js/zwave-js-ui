<template>
	<v-row>
		<v-col>
			<v-simple-table v-if="value" dense>
				<template v-slot:default>
					<tbody>
						<tr>
							<td>Type</td>
							<td>{{ getType(value) }}</td>
						</tr>
						<tr>
							<td>Protocol</td>
							<td>{{ value.protocol }}</td>
						</tr>
						<tr>
							<td>Payload</td>
							<td v-if="value.parsedPayload">
								<CCTreeView
									:value="value.parsedPayload"
								></CCTreeView>
							</td>
							<td v-else>{{ value.payload }}</td>
						</tr>
						<tr>
							<td>Channel</td>
							<td>{{ value.channel }}</td>
						</tr>
						<tr>
							<td>Region</td>
							<td>{{ getRegion(value.region) }}</td>
						</tr>
						<tr>
							<td>RSSI</td>
							<td>{{ getRssi(value) }}</td>
						</tr>
						<tr>
							<td>Protocol Data Rate</td>
							<td>{{ getProtocolDataRate(value) }}</td>
						</tr>
						<tr>
							<td>Sequence Number</td>
							<td>{{ value.sequenceNumber }}</td>
						</tr>
						<tr>
							<td>Home ID</td>
							<td>{{ value.homeId?.toString(16) }}</td>
						</tr>
						<tr>
							<td>Source Node ID</td>
							<td>{{ value.sourceNodeId }}</td>
						</tr>
						<tr>
							<td>Destination Node ID</td>
							<td>{{ value.destinationNodeId }}</td>
						</tr>
						<tr>
							<td>Ack Requested</td>
							<td>{{ value.ackRequested }}</td>
						</tr>
						<tr v-if="value.direction">
							<td>Direction</td>
							<td>{{ value.direction }}</td>
						</tr>
						<tr v-if="value.hop">
							<td>Hop</td>
							<td>{{ value.hop }}</td>
						</tr>
						<tr v-if="value.repeaters">
							<td>Repeaters</td>
							<td>{{ getRepeaters(value) }}</td>
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
	</v-row>
</template>

<script>
import {
	jsonToList,
	getRegion,
	getRepeaters,
	getType,
	getRssi,
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
	computed: {
		parsed() {
			if (!this.value) return ''

			const ignore = ['id']
			if (this.value.parsedPayload) {
				ignore.push('parsedPayload', 'payload')
			}
			return jsonToList(this.value, { ignore })
		},
	},
	methods: {
		getRegion,
		getRepeaters,
		getType,
		getRssi,
		getProtocolDataRate,
	},
}
</script>

<style></style>
