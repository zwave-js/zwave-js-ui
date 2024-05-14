<template>
	<v-container class="fill">
		<multipane class="horizontal-panes" layout="horizontal">
			<div
				class="pane"
				ref="topPane"
				v-intersect.once="bindTopPaneObserver"
				:style="{
					minHeight: '500px',
					height: `${topPaneHeight}px`,
				}"
			>
				<v-row class="fill" v-if="zniffer.enabled">
					<v-col cols="12">
						<v-btn
							color="green darken-1"
							text
							:disabled="znifferState.started"
							@click="startZniffer()"
							>Start</v-btn
						>
						<v-btn
							color="red darken-1"
							:disabled="!znifferState.started"
							text
							@click="stopZniffer()"
							>Stop</v-btn
						>
						<v-btn
							color="blue darken-1"
							text
							:disabled="!znifferState.started"
							@click="createCapture()"
							>Save Capture</v-btn
						>
					</v-col>

					<v-col cols="12">
						<v-data-table
							v-intersect.once="bindScroll"
							:headers="headers"
							:items="framesLimited"
							:item-style="getRowStyle"
							@click:row="onRowClick"
							single-select
							fixed-header
							dense
							:height="topPaneHeight - 80"
							id="framesTable"
							ref="framesTable"
							hide-default-footer
							disable-pagination
							:mobile-breakpoint="-1"
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

							<template v-slot:[`item.rssi`]="{ item }">
								{{ getRssi(item) }}
							</template>

							<template
								v-slot:[`item.protocolDataRate`]="{ item }"
							>
								{{ getProtocolDataRate(item) }}
							</template>

							<template v-slot:[`item.type`]="{ item }">
								{{ getType(item) }}
							</template>

							<template v-slot:[`item.homeId`]="{ item }">
								{{ item.homeId?.toString(16) }}
							</template>

							<template v-slot:[`item.payload`]="{ item }">
								<span v-if="item.parsedPayload">
									{{ item.parsedPayload.tags.join(' - ') }}
								</span>
								<span v-else-if="item.payload">
									{{ item.payload }}
								</span>
								<span v-else>---</span>
							</template>

							<template v-if="start > 0" v-slot:[`body.prepend`]>
								<tr>
									<td
										:colspan="headers.length"
										class="text-center"
										:style="
											'padding-top:' + startHeight + 'px'
										"
									>
										<!-- <v-skeleton-loader
											type="table-row"
										/><v-skeleton-loader type="table-row" /> -->
									</td>
								</tr>
							</template>
							<template
								v-if="start + perPage <= totalFrames"
								v-slot:[`body.append`]
							>
								<tr>
									<td
										:colspan="headers.length"
										class="text-center"
										:style="
											'padding-top:' + endHeight + 'px'
										"
									>
										<!-- <v-skeleton-loader type="table-row" /> -->
									</td>
								</tr>
							</template>
						</v-data-table>
					</v-col>
				</v-row>
				<v-row v-else>
					<v-col cols="12">
						<v-alert type="info">
							<span
								>Zniffer is disabled, enable it in
								settings</span
							>
						</v-alert>
					</v-col>
				</v-row>
			</div>
			<multipane-resizer></multipane-resizer>
			<div class="pane pa-2" :style="{ flexGrow: 1, minHeight: '200px' }">
				<frame-details :value="selectedFrame" />
			</div>
		</multipane>
	</v-container>
</template>
<script>
import {
	isRssiError,
	rssiToString,
	getEnumMemberName,
	ZWaveFrameType,
} from 'zwave-js/safe'
import { znifferProtocolDataRateToString } from '@zwave-js/core/safe'
import { socketEvents } from '@server/lib/SocketEvents'

import { mapState, mapActions } from 'pinia'
import useBaseStore from '../stores/base.js'
import { inboundEvents as socketActions } from '@server/lib/SocketEvents'
import { rfRegions } from '../lib/items.js'
import { uuid } from '../lib/utils'

export default {
	name: 'Zniffer',
	props: {
		socket: Object,
	},
	components: {
		Multipane: () => import('../components/custom/Multipane.vue'),
		MultipaneResizer: () =>
			import('../components/custom/MultipaneResizer.vue'),
		FrameDetails: () => import('../components//custom/FrameDetails.vue'),
	},
	computed: {
		...mapState(useBaseStore, ['zniffer', 'znifferState']),
		framesLimited() {
			return this.frames.slice(this.start, this.perPage + this.start)
		},
		totalFrames() {
			return this.frames.length
		},
		startHeight() {
			return this.start * this.rowHeight
		},
		endHeight() {
			const lastIndex = this.start + this.perPage
			return this.rowHeight * (this.totalFrames - lastIndex + 1)
		},
	},
	watch: {
		topPaneHeight(v) {
			if (this.scrollWrapper) {
				this.scrollWrapper.style.height = `${v - 80}px`
			}
		},
	},
	mounted() {
		this.socket.on(socketEvents.znifferFrame, (data) => {
			data.id = uuid()
			const lastFrame = this.frames[this.frames.length - 1]
			data.delta = lastFrame ? data.timestamp - lastFrame.timestamp : 0
			this.frames.push(data)

			this.scrollBottom()
		})

		this.socket.on(socketEvents.znifferState, (data) => {
			this.setZnifferState(data)
		})

		const onWindowResize = () => {
			const oneThird = window.innerHeight / 3
			this.topPaneHeight = oneThird * 2
		}

		this.ro = new ResizeObserver(onWindowResize)
		this.ro.observe(this.$el)

		onWindowResize()
		this.scrollBottom()
	},
	beforeDestroy() {
		if (this.ro) {
			// call both unoobserve and disconnect to avoid memory leaks
			this.ro.unobserve(this.$el)
			this.ro.disconnect()
		}

		if (this.roTopPane) {
			this.roTopPane.unobserve(this.$refs.topPane)
			this.roTopPane.disconnect()
		}

		if (this.socket) {
			// unbind events
			this.socket.off(socketEvents.znifferFrame)
		}

		if (this.timeoutScroll) {
			clearTimeout(this.timeoutScroll)
		}
	},
	data() {
		return {
			start: 0,
			busy: false,
			selectedFrame: null,
			scrollWrapper: null,
			rowHeight: 32,
			perPage: 22,
			topPaneHeight: 500,
			frames: [],
			headers: [
				{ text: 'Timestamp', value: 'timestamp', width: 160 },
				{
					text: 'Protocol Data Rate',
					value: 'protocolDataRate',
					width: 175,
				},
				{ text: 'RSSI', value: 'rssi' },
				{ text: 'Channel', value: 'channel' },
				{ text: 'Delta [ms]', value: 'delta' },
				{ text: 'Source', value: 'sourceNodeId' },
				{ text: 'Destination', value: 'destinationNodeId' },
				{ text: 'Home Id', value: 'homeId' },
				{ text: 'Type', value: 'type' },
				{ text: 'Payload', value: 'payload' },
			],
		}
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar', 'setZnifferState']),
		onRowClick(frame, { select, isSelected }) {
			if (isSelected) {
				this.selectedFrame = null
				select(false)
			} else {
				this.selectedFrame = frame
				select(true)
			}
		},
		getRowStyle(frame) {
			const style = {
				backgroundColor: '',
			}

			if (frame.corrupted) {
				style.backgroundColor = 'rgba(255, 0, 0, 0.1)'
			} else {
				switch (frame.type) {
					case ZWaveFrameType.Singlecast:
						style.backgroundColor = 'rgba(0, 255, 0, 0.1)'
						break
					case ZWaveFrameType.Multicast:
						style.backgroundColor = 'rgba(0, 0, 255, 0.1)'
						break
					case ZWaveFrameType.AckDirect:
						style.backgroundColor = 'rgba(255, 165, 0, 0.1)'
						break
					case ZWaveFrameType.ExplorerNormal:
						style.backgroundColor = 'rgba(255, 255, 0, 0.1)'
						break
					case ZWaveFrameType.ExplorerSearchResult:
						style.backgroundColor = 'rgba(255, 0, 255, 0.1)'
						break
					case ZWaveFrameType.ExplorerInclusionRequest:
						style.backgroundColor = 'rgba(0, 255, 255, 0.1)'
						break
					case ZWaveFrameType.BeamStart:
						style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
						break
					case ZWaveFrameType.BeamStop:
						style.backgroundColor = 'rgba(0, 0, 0, 0.1)'
						break
				}
			}

			return style
		},
		bindTopPaneObserver() {
			const onTopPaneResize = (e) => {
				this.topPaneHeight = e[0].contentRect.height
			}

			this.roTopPane = new ResizeObserver(onTopPaneResize)
			this.roTopPane.observe(this.$refs.topPane)
		},
		bindScroll() {
			if (this.scrollWrapper) return
			// find v-data-table__wrapper element inside #framesTable
			const el = this.$refs.framesTable?.$el

			if (el) {
				const wrapper = el.getElementsByClassName(
					'v-data-table__wrapper',
				)[0]
				wrapper.addEventListener('scroll', this.onScroll.bind(this))
				this.scrollWrapper = wrapper
			}
		},
		scrollBottom() {
			if (this.scrollWrapper) {
				this.scrollWrapper.scrollTo(0, this.scrollWrapper.scrollHeight)
			}
		},
		scrollToRow(index) {
			const table = this.$refs.framesTable.$el.querySelector('table')
			const row = table.rows[index]
			if (row) {
				row.scrollIntoView(true)
			}
		},
		async onScroll(e) {
			// debounce if scrolling fast
			if (this.timeoutScroll) {
				clearTimeout(this.timeoutScroll)
			}

			this.timeoutScroll = setTimeout(async () => {
				// rows to show
				const { scrollTop } = e.target
				const rows = Math.ceil(scrollTop / this.rowHeight)
				// start index
				this.start =
					rows + this.perPage >= this.totalFrames &&
					this.perPage <= this.totalFrames
						? this.totalFrames - this.perPage
						: rows
				await this.$nextTick()
				e.target.scrollTop = scrollTop
			}, 10)
		},
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
				? znifferProtocolDataRateToString(item.protocolDataRate)
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
}
</script>

<style scoped>
.truncate {
	display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

#framesTable::v-deep .v-data-table__wrapper::-webkit-scrollbar {
	height: 5px;
	width: 8px;
	background: rgba(0, 0, 0, 0.233);
	padding-right: 10;
}

#framesTable::v-deep .v-data-table__wrapper::-webkit-scrollbar-thumb {
	background: var(--v-primary-base);
	border-radius: 1ex;
	-webkit-border-radius: 1ex;
}

.single-line {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
