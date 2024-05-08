<template>
	<v-container grid-list-md>
		<v-row v-if="zniffer.enabled">
			<v-col cols="12">
				<v-btn color="green darken-1" text @click="startZniffer()"
					>Start</v-btn
				>
				<v-btn color="red darken-1" text @click="stopZniffer()"
					>Stop</v-btn
				>
				<v-btn color="blue darken-1" text @click="createCapture()"
					>Capture</v-btn
				>
			</v-col>

			<v-col cols="12">
				<v-data-table
					:headers="headers"
					:items="frames"
					item-key="timestamp"
					class="elevation-1"
				>
					<template v-slot:top>
						<!-- Top template -->
					</template>
					<template v-slot:[`item.timestamp`]="{ item }">
						{{ new Date(item.timestamp).toLocaleString() }}
					</template>

					<template v-slot:[`item.channel`]="{ item }">
						{{ item.channel }}
					</template>

					<template v-slot:[`item.region`]="{ item }">
						{{ getRegion(item.region) }}
					</template>

					<template v-slot:[`item.rssi`]="{ item }">
						{{ getRssi(item) }}
					</template>

					<template v-slot:[`item.protocolDataRate`]="{ item }">
						{{ getProtocolDataRate(item) }}
					</template>

					<template v-slot:[`item.type`]="{ item }">
						{{ getType(item) }}
					</template>

					<template v-slot:[`item.payload`]="{ item }">
						<cc-tree-view
							v-if="item.parsedPayload"
							:value="item.parsedPayload"
						>
						</cc-tree-view>
						<p v-else-if="item.payload">
							{{ item.payload }}
						</p>
						<p v-else>---</p>
					</template>

					<template v-slot:[`item.repeaters`]="{ item }">
						{{ getRepeaters(item) }}
					</template>
				</v-data-table>
			</v-col>
		</v-row>
		<v-row v-else>
			<v-col cols="12">
				<v-alert type="info">
					<span>Zniffer is disabled, enable it in settings</span>
				</v-alert>
			</v-col>
		</v-row>
	</v-container>
</template>
<script>
import {
	protocolDataRateToString,
	isRssiError,
	rssiToString,
	getEnumMemberName,
} from 'zwave-js/safe'
import { socketEvents } from '@server/lib/SocketEvents'
import { jsonToList } from '../lib/utils'

import { mapState, mapActions } from 'pinia'
import useBaseStore from '../stores/base.js'
import { inboundEvents as socketActions } from '@server/lib/SocketEvents'
import { rfRegions } from '../lib/items.js'
import { ZWaveFrameType } from 'zwave-js/core/safe'

export default {
	name: 'Zniffer',
	props: {
		socket: Object,
	},
	components: {
		ccTreeView: () => import('../components/custom/CCTreeView.vue'),
	},
	computed: {
		...mapState(useBaseStore, ['zniffer']),
	},
	data() {
		return {
			frames: [],
			headers: [
				{ text: 'Timestamp', value: 'timestamp' },
				{ text: 'Type', value: 'type' },
				{ text: 'Channel', value: 'channel' },
				{ text: 'Sequence #', value: 'sequenceNumber' },
				{ text: 'Home Id', value: 'homeId' },
				{ text: 'Region', value: 'region' },
				{ text: 'Source', value: 'sourceNodeId' },
				{ text: 'Destination', value: 'destinationNodeId' },
				{ text: 'RSSI', value: 'rssi' },
				{ text: 'Protocol Data Rate', value: 'protocolDataRate' },
				{ text: 'Tx Power', value: 'txPower' },
				{ text: 'Payload', value: 'payload' },
				{ text: 'Repeaters', value: 'repeaters' },
			],
		}
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		jsonToList,
		getRegion(region) {
			return (
				rfRegions.find((r) => r.value === region)?.text ||
				`Unknown region ${region}`
			)
		},
		getRepeaters(item) {
			const repRSSI = item.repeaterRSSI || []
			return item.repeaters?.length > 0
				? item.repeaters
						.map(
							(r, i) =>
								`${r}${
									repRSSI[i] && !isRssiError(repRSSI[i])
										? ` (${rssiToString(repRSSI[i])})`
										: ''
								}`,
						)
						.join(', ')
				: 'None, direct connection'
		},
		getType(item) {
			return getEnumMemberName(ZWaveFrameType, item.type)
		},
		getRssi(item) {
			if (item.rssi && !isRssiError(item.rssi)) {
				return rssiToString(item.rssi)
			}

			return item.rssiRaw
		},
		getProtocolDataRate(item) {
			return item.protocolDataRate !== undefined
				? protocolDataRateToString(item.protocolDataRate)
				: '---'
		},
		async sendAction(data = {}) {
			return new Promise((resolve) => {
				if (this.socket.connected) {
					this.showSnackbar(`API ${data.apiName} called`, 'info')

					this.socket.emit(
						socketActions.zniffer,
						data,
						(response) => {
							if (!response.success) {
								this.showSnackbar(
									`Error while calling ${data.apiName}: ${response.message}`,
									'error',
								)
							}
							resolve(response)
						},
					)
				} else {
					resolve({
						success: false,
						message: 'Socket disconnected',
					})
					this.showSnackbar('Socket disconnected', 'error')
				}
			})
		},
		async startZniffer() {
			const response = await this.sendAction({
				apiName: 'start',
			})

			if (response.success) {
				this.showSnackbar(`Zniffer started`, 'success')
			}
		},
		async stopZniffer() {
			const response = await this.sendAction({
				apiName: 'stop',
			})

			if (response.success) {
				this.showSnackbar(`Zniffer stopped`, 'success')
			}
		},
		async createCapture() {
			const response = await this.sendAction({
				apiName: 'saveCaptureToFile',
			})

			if (response.success) {
				const result = response.result
				this.showSnackbar(
					`Capture "${result.name}" created in store`,
					'success',
				)
			}
		},
	},
	mounted() {
		// init socket events

		this.socket.on(socketEvents.znifferFrame, (data) => {
			this.frames.push(data)

			if (this.frames.length > 1000) {
				this.frames.shift()
			}
		})
	},
	beforeDestroy() {
		if (this.socket) {
			// unbind events
			this.socket.off(socketEvents.znifferFrame)
		}
	},
}
</script>
