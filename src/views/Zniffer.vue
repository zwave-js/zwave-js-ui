<template>
	<v-container class="px-3" style="max-width: unset">
		<multipane class="horizontal-panes" layout="horizontal">
			<div
				class="pane"
				ref="topPane"
				v-intersect.once="bindTopPaneObserver"
				:style="{
					minHeight: '300px',
					height: `${topPaneHeight}px`,
				}"
			>
				<v-row v-if="zniffer.enabled">
					<v-col style="max-width: 220px; margin-top: 7px">
						<v-btn-toggle dense multiple>
							<v-tooltip
								bottom
								v-for="button in buttons"
								:key="button.label"
								:target="`#${button.id}`"
							>
								<template v-slot:activator="{ on }">
									<v-btn
										:id="button.id"
										:color="button.color"
										:disabled="button.disabled"
										@click="button.action"
										v-on="on"
									>
										<v-icon>{{ button.icon }}</v-icon>
									</v-btn>
								</template>
								<span>{{ button.tooltip }}</span>
							</v-tooltip>
						</v-btn-toggle>
					</v-col>
					<v-col
						ref="settingCol"
						v-resize="onTopColResize"
						class="pa-0 pt-2"
						cols="6"
					>
						<v-text-field
							v-model="search"
							clearable
							flat
							persistent-hint
							hint="Search expression using JS. Click on info button for more info"
							:error="searchError"
							:error-messages="
								searchError ? ['Invalid search'] : []
							"
							outlined
							dense
							single-line
							class="ma-2"
							prepend-inner-icon="search"
							label="Search"
						>
							<template v-slot:append>
								<v-menu offset-y>
									<template v-slot:activator="{ on }">
										<v-icon v-on="on" color="grey" size="20"
											>info</v-icon
										>
									</template>
									<v-card>
										<v-card-text>
											<p>
												Write a custom filter function
												in JS. Function arguments are:
												frame (the full frame object),
												homeId, ch, src, dest,
												protocolDataRate, hop, dir
												(direction), repeaters.
											</p>
											<strong>Examples:</strong>
											<ul>
												<li>
													<code>frame.corrupted</code>
												</li>
												<li>
													<code
														>src === 1 && dest ===
														2</code
													>
												</li>
												<li>
													<code
														>protocolDataRate ===
														'100kbps'</code
													>
												</li>
												<li>
													<code
														>homeId ===
														'12345678'</code
													>
												</li>
												<li>
													<code>hop > 1</code>
												</li>

												<li>
													<code
														>dir === 'inbound'</code
													>
												</li>
												<li>
													<code
														>repeaters.length >
														0</code
													>
												</li>
											</ul>
										</v-card-text>
									</v-card>
								</v-menu>
							</template>
							<!-- add to append-outer slot the total numer of frames -->

							<template v-slot:append-outer>
								<v-col
									style="margin-top: -7px"
									v-if="totalFrames"
									class="pa-0 caption grey--text text-center"
								>
									<p class="mb-0">Frames</p>
									<p class="mb-0">
										{{
											humanFriendlyNumber(totalFrames, 2)
										}}
									</p>
								</v-col>
							</template>
						</v-text-field>
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
							:height="topPaneHeight - offsetTop"
							id="framesTable"
							ref="framesTable"
							hide-default-footer
							disable-pagination
							:mobile-breakpoint="-1"
						>
							<template v-slot:[`item.timestamp`]="{ item }">
								{{ getTimestamp(item.timestamp) }}
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
								<span v-if="item.corrupted"></span>
								<div v-else class="d-flex text-center">
									<rich-value
										:value="getProtocolIcon(item.protocol)"
									/>
									<span class="ml-1">
										{{
											getProtocolDataRate(item, false) +
											(item.speedModified ? ' 🐌' : '')
										}}
									</span>
								</div>
							</template>

							<template v-slot:[`item.type`]="{ item }">
								<span>
									{{ getType(item) }}
								</span>
							</template>

							<template v-slot:[`item.sourceNodeId`]="{ item }">
								<span v-html="getRoute(item)"></span>
							</template>

							<template v-slot:[`item.homeId`]="{ item }">
								{{ item.homeId?.toString(16) }}
							</template>

							<template v-slot:[`item.payload`]="{ item }">
								<code v-if="item.corrupted"> CRC Error </code>
								<span v-else-if="item.parsedPayload">
									{{ getPayloadTags(item.parsedPayload) }}
								</span>
								<span
									v-else-if="item.payload && !item.corrupted"
								>
									{{ item.payload }}
								</span>
								<span v-else-if="item.routedAck"
									>ROUTED ACK</span
								>
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

						<v-tooltip v-if="!autoScroll" left>
							<template v-slot:activator="{ on }">
								<v-btn
									color="purple"
									@click="enableAutoScroll()"
									dark
									small
									fab
									hover
									top
									absolute
									right
									style="top: 40px"
									v-on="on"
								>
									<v-icon>vertical_align_bottom</v-icon>
								</v-btn>
							</template>
							<span>Enable autoscroll</span>
						</v-tooltip>
					</v-col>
				</v-row>
				<v-row v-else>
					<v-col cols="12">
						<v-alert text type="info">
							<span
								>Zniffer is disabled, enable it in
								settings</span
							>
						</v-alert>
					</v-col>
				</v-row>
			</div>
			<multipane-resizer :class="$vuetify.theme.dark ? 'dark' : ''" />
			<div
				class="pane pa-2"
				style="flex-grow: 1; overflow-y: scroll; overflow-x: hidden"
				:style="{
					height: `calc(100vh - ${topPaneHeight + 110}px)`,
				}"
			>
				<frame-details class="my-1" :value="selectedFrame" />
			</div>
		</multipane>

		<v-btn
			color="primary"
			@click="drawer = !drawer"
			dark
			fab
			hover
			bottom
			right
			fixed
		>
			<v-icon v-if="drawer">close</v-icon>
			<v-icon v-else>menu</v-icon>
		</v-btn>

		<v-navigation-drawer v-model="drawer" absolute right style="z-index: 2">
			<v-card class="fill">
				<v-card-title> Settings </v-card-title>
				<v-card-text>
					<v-row>
						<v-col v-if="!isPopup" cols="12">
							<v-btn
								text
								small
								color="primary"
								@click="openInWindow('Zniffer', 800, 1500)"
							>
								Open in new<v-icon>open_in_new</v-icon>
							</v-btn>
						</v-col>
						<v-col cols="12">
							<v-select
								label="Zniffer frequency"
								hide-details
								:items="znifferRegions"
								v-model="frequency"
								@change="setFrequency"
							>
								<template v-slot:prepend>
									<v-icon>signal_cellular_alt</v-icon>
								</template>

								<template v-slot:append-outer>
									<v-icon
										color="success"
										v-if="frequencySuccess"
										>check_circle</v-icon
									>
								</template>
							</v-select>
						</v-col>
					</v-row>
				</v-card-text>
			</v-card>
		</v-navigation-drawer>
	</v-container>
</template>
<script>
import { ZWaveFrameType, LongRangeFrameType } from 'zwave-js/safe'
import { Protocols } from '@zwave-js/core/safe'
import { socketEvents } from '@server/lib/SocketEvents'

import { mapState, mapActions } from 'pinia'
import useBaseStore from '../stores/base.js'
import { inboundEvents as socketActions } from '@server/lib/SocketEvents'
import { znifferRegions } from '../lib/items.js'
import {
	getRoute,
	getType,
	getRssi,
	getProtocolDataRate,
	humanFriendlyNumber,
	openInWindow,
	getProtocolIcon,
	isPopupWindow,
} from '../lib/utils'

export default {
	name: 'Zniffer',
	props: {
		socket: Object,
	},
	components: {
		Multipane: () => import('../components/custom/Multipane.vue'),
		MultipaneResizer: () =>
			import('../components/custom/MultipaneResizer.vue'),
		RichValue: () => import('@/components/nodes-table/RichValue.vue'),
		FrameDetails: () => import('../components//custom/FrameDetails.vue'),
	},
	computed: {
		...mapState(useBaseStore, ['zniffer', 'znifferState']),
		buttons() {
			return [
				{
					id: 'start',
					icon: 'play_arrow',
					color: 'success',
					tooltip: 'Start Zniffer',
					action: this.startZniffer,
					disabled: this.znifferState?.started,
				},
				{
					id: 'stop',
					icon: 'stop',
					color: 'error',
					tooltip: 'Stop Zniffer',
					action: this.stopZniffer,
					disabled: !this.znifferState?.started,
				},
				{
					id: 'clear',
					icon: 'delete',
					color: 'warning',
					tooltip: 'Clear Zniffer',
					action: this.clearFrames,
					disabled: !this.frames.length,
				},
				{
					id: 'save',
					icon: 'save',
					color: 'primary',
					tooltip: 'Save capture',
					action: this.createCapture,
					disabled: !this.frames.length,
				},
			]
		},
		framesLimited() {
			return this.framesFiltered.slice(
				this.start,
				this.perPage + this.start,
			)
		},
		totalFrames() {
			return this.framesFiltered.length
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
		topPaneHeight() {
			this.resizeScrollWrapper()
		},
		znifferState() {
			this.clearFrequency()
		},
		frequencySuccess(v) {
			if (v) {
				setTimeout(() => {
					this.frequencySuccess = false
				}, 3000)
			}
		},
		framesQueue() {
			// used to improve performances when lot of frames comes all together
			if (this.queueTimeout) {
				clearTimeout(this.queueTimeout)
			}

			this.queueTimeout = setTimeout(() => {
				this.emptyQueue()
			}, 50)
		},
		search(v) {
			if (this.searchTimeout) {
				clearTimeout(this.searchTimeout)
			}

			this.searchTimeout = setTimeout(() => {
				this.filterFrames(v)
			}, 300)
		},
		frames() {
			this.filterFrames(this.search)
			this.scrollBottom()
		},
	},
	mounted() {
		this.socket.on(socketEvents.znifferFrame, this.addFrame)

		this.onWindowResize = () => {
			this.topPaneHeight = window.innerHeight / 2
		}

		this.socket.on('connect', this.onConnnect)

		if (this.socket.connected) {
			this.onConnnect()
		}

		window.addEventListener('resize', this.onWindowResize)

		this.onWindowResize()
		this.clearFrequency()
	},
	beforeDestroy() {
		window.removeEventListener('resize', this.onWindowResize)

		if (this.roTopPane) {
			this.roTopPane.unobserve(this.$refs.topPane)
			this.roTopPane.disconnect()
		}

		if (this.socket) {
			// unbind events
			this.socket.off(socketEvents.znifferFrame)
			this.socket.off('connect', this.onConnnect)
		}

		if (this.timeoutScroll) {
			clearTimeout(this.timeoutScroll)
		}

		if (this.searchTimeout) {
			clearTimeout(this.searchTimeout)
		}
	},
	data() {
		return {
			znifferRegions,
			isPopup: isPopupWindow(),
			fab: false,
			drawer: false,
			frequency: null,
			frequencySuccess: false,
			start: 0,
			offsetTop: 125,
			search: '',
			searchError: false,
			busy: false,
			selectedFrame: null,
			scrollWrapper: null,
			rowHeight: 32,
			perPage: 22,
			topPaneHeight: 500,
			frames: [],
			framesFiltered: [],
			framesQueue: [],
			headers: [
				{
					text: '#',
					value: 'id',
					width: '10ch',
					sortable: false,
				},
				{
					text: 'Timestamp',
					value: 'timestamp',
					width: '12ch',
					sortable: false,
					class: 'no-wrap',
				},
				{
					text: 'Delta [ms]',
					value: 'delta',
					width: '4ch',
					sortable: false,
				},
				{
					text: 'Protocol Data Rate',
					value: 'protocolDataRate',
					width: '20ch',
					sortable: false,
				},
				{
					text: 'RSSI',
					value: 'rssi',
					width: '4ch',
					sortable: false,
				},
				{
					text: 'Ch',
					value: 'channel',
					width: '4ch',
					sortable: false,
				},
				{
					text: 'Home Id',
					value: 'homeId',
					width: '8ch',
					sortable: false,
					class: 'no-wrap',
				},
				{
					text: 'Type',
					width: '8ch',
					value: 'type',
					sortable: false,
				},
				{
					text: 'Route',
					value: 'sourceNodeId',
					sortable: false,
				},
				{
					text: 'Payload',
					value: 'payload',
					sortable: false,
				},
			],
			autoScroll: true,
		}
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		getProtocolIcon,
		openInWindow,
		humanFriendlyNumber,
		emptyQueue() {
			if (this.framesQueue.length > 0) {
				this.frames.push(...this.framesQueue)
				this.framesQueue = []
			}
		},
		onConnnect() {
			this.getFrames()
		},
		addFrame(data) {
			const lastFrame =
				this.framesQueue.length > 0
					? this.framesQueue[this.framesQueue.length - 1]
					: this.frames[this.frames.length - 1]

			data.id = lastFrame ? lastFrame.id + 1 : 1
			data.delta = lastFrame ? data.timestamp - lastFrame.timestamp : 0
			this.framesQueue.push(data)
		},
		async clearFrequency() {
			// needed to handle the clear event on select
			await this.$nextTick()
			this.frequency = this.znifferState?.frequency ?? null
		},
		onTopColResize() {
			this.offsetTop = this.$refs.settingCol.clientHeight + 20
			this.resizeScrollWrapper()
		},
		resizeScrollWrapper() {
			if (this.scrollWrapper) {
				this.scrollWrapper.style.height = `${
					this.topPaneHeight - this.offsetTop
				}px`
			}
		},
		filterFrames(search) {
			if (!search || search.trim() === '') {
				this.framesFiltered = this.frames
				this.searchError = false
				return
			}

			try {
				const fn = new Function(
					'frame, homeId, ch, src, dest, protocolDataRate, hop, dir, repeaters',
					`return ${search.replace(/\\/g, '\\\\')}`,
				)

				this.framesFiltered = this.frames.filter((frame) => {
					return fn(
						frame,
						frame.homeId?.toString(16) || '',
						frame.channel,
						frame.sourceNodeId,
						frame.destinationNodeId,
						frame.protocolDataRate,
						frame.hop,
						frame.direction,
						frame.repeaters || [],
					)
				})

				this.searchError = false
			} catch (e) {
				this.searchError = true
			}
		},
		onRowClick(frame, { select, isSelected }) {
			if (isSelected) {
				this.selectedFrame = null
				this.autoScroll = true
				select(false)
			} else {
				this.selectedFrame = frame
				this.autoScroll = false
				select(true)
			}
		},
		getRowStyle(frame) {
			const style = {
				backgroundColor: '',
			}

			if (this.selectedFrame && this.selectedFrame.id === frame.id) {
				style.backgroundColor = 'rgba(0, 0, 255, 0.5)'
			} else if (frame.corrupted) {
				style.backgroundColor = 'rgba(255, 0, 0, 0.1)'
			} else if (frame.routedAck) {
				style.backgroundColor = 'rgba(255, 165, 0, 0.1)'
			} else {
				if (frame.protocol === Protocols.ZWaveLongRange) {
					switch (frame.type) {
						case LongRangeFrameType.Singlecast:
							style.backgroundColor = 'rgba(0, 255, 0, 0.1)'
							break
						case LongRangeFrameType.Ack:
							style.backgroundColor = 'rgba(255, 165, 0, 0.1)'
							break
						case LongRangeFrameType.BeamStart:
							style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
							break
						case LongRangeFrameType.BeamStop:
							style.backgroundColor = 'rgba(0, 0, 0, 0.1)'
							break
						case LongRangeFrameType.Broadcast:
							style.backgroundColor = 'rgba(165, 0, 255, 0.1)'
							break
					}
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
						case ZWaveFrameType.Broadcast:
							style.backgroundColor = 'rgba(165, 0, 255, 0.1)'
							break
					}
				}
			}

			return style
		},
		getPayloadTags(payload, prev = []) {
			const tags = [
				...prev,
				payload.tags?.join(' '),
				...(payload.encapsulated || []).map((e) =>
					this.getPayloadTags(e, prev),
				),
			]
			return tags.filter((t) => !!t).join(' > ')
		},
		bindTopPaneObserver() {
			const onTopPaneResize = (e) => {
				this.topPaneHeight = e[0].contentRect.height
				this.perPage = Math.ceil(
					(this.topPaneHeight - this.offsetTop) / this.rowHeight,
				)
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
		enableAutoScroll() {
			this.autoScroll = true
			this.scrollBottom()
		},
		scrollBottom() {
			if (this.scrollWrapper && this.autoScroll) {
				this.scrollWrapper.scrollTo(
					0,
					this.scrollWrapper.scrollHeight + this.rowHeight,
				)
			}
		},
		async onScroll(e) {
			// debounce if scrolling fast
			if (this.timeoutScroll) {
				clearTimeout(this.timeoutScroll)
			}

			this.timeoutScroll = setTimeout(async () => {
				const prevStart = this.start

				// rows to show
				const { scrollTop } = e.target
				const rows = Math.ceil(scrollTop / this.rowHeight)
				// start index
				this.start =
					rows + this.perPage >= this.totalFrames &&
					this.perPage <= this.totalFrames
						? this.totalFrames - this.perPage
						: rows

				const direction = prevStart <= this.start ? 'down' : 'up'
				if (this.autoScroll && direction === 'up') {
					this.autoScroll = false
				}
			}, 50)
		},
		getTimestamp(timestamp) {
			// format timestamp HH:mm:ss.fff
			const date = new Date(timestamp)
			const ms = date.getMilliseconds()
			return `${date.toTimeString().split(' ')[0]}.${ms
				.toString()
				.padEnd(3, '0')}`
		},
		getRoute,
		getType,
		getRssi,
		getProtocolDataRate,
		async sendAction(data = {}, { hideInfo } = {}) {
			return new Promise((resolve) => {
				if (this.socket.connected) {
					if (!hideInfo)
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
		async getFrames() {
			const response = await this.sendAction(
				{
					apiName: 'getFrames',
				},
				{
					hideInfo: true,
				},
			)

			if (response.success) {
				this.frames = []
				response.result.forEach(this.addFrame)
			}
		},
		async setFrequency() {
			const response = await this.sendAction(
				{
					apiName: 'setFrequency',
					frequency: this.frequency,
				},
				{ hideInfo: true },
			)

			if (response.success) {
				this.frequencySuccess = true
			}
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
		async clearFrames() {
			const response = await this.sendAction({
				apiName: 'clear',
			})

			if (response.success) {
				this.showSnackbar(`Zniffer cleared`, 'success')
				this.frames = []
				this.framesFiltered = []
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
#framesTable::v-deep td {
	white-space: nowrap;
	/* display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical; */
	overflow: hidden;
}

.pane::-webkit-scrollbar,
#framesTable::v-deep .v-data-table__wrapper::-webkit-scrollbar {
	height: 5px;
	width: 8px;
	background: rgba(0, 0, 0, 0.233);
	padding-right: 10;
}

.pane::-webkit-scrollbar-thumb,
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
