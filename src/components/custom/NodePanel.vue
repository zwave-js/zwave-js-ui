<template>
	<v-container class="pt-0" v-show="_value">
		<v-col class="pa-0 pb-2" v-if="_value && node">
			<v-subheader
				class="font-weight-bold"
				style="position: sticky; top: 0; z-index: 10"
				>Node properties
				<v-icon @click="_value = false" class="close-btn"
					>clear</v-icon
				></v-subheader
			>
			<v-list dense style="min-width: 300px; background: transparent">
				<v-list-item dense>
					<v-list-item-content>ID</v-list-item-content>
					<v-list-item-content class="align-end">{{
						node.id
					}}</v-list-item-content>
				</v-list-item>
				<v-list-item dense>
					<v-list-item-content>Status</v-list-item-content>
					<v-list-item-content class="align-end">{{
						node.status
					}}</v-list-item-content>
				</v-list-item>
				<v-list-item dense>
					<v-list-item-content>Protocol</v-list-item-content>
					<v-list-item-content class="align-end">{{
						getProtocol(node)
					}}</v-list-item-content>
				</v-list-item>
				<v-list-item dense>
					<v-list-item-content>Code</v-list-item-content>
					<v-list-item-content class="align-end">{{
						node.productLabel
					}}</v-list-item-content>
				</v-list-item>
				<v-list-item dense>
					<v-list-item-content>Product</v-list-item-content>
					<v-list-item-content class="align-end">{{
						node.productDescription
					}}</v-list-item-content>
				</v-list-item>
				<v-list-item dense>
					<v-list-item-content>Manufacturer</v-list-item-content>
					<v-list-item-content class="align-end">{{
						node.manufacturer
					}}</v-list-item-content>
				</v-list-item>
				<v-list-item v-if="node.name">
					<v-list-item-content>Name</v-list-item-content>
					<v-list-item-content class="align-end">{{
						node.name
					}}</v-list-item-content>
				</v-list-item>
				<v-list-item v-if="node.loc">
					<v-list-item-content>Location</v-list-item-content>
					<v-list-item-content class="align-end">{{
						node.loc
					}}</v-list-item-content>
				</v-list-item>
				<v-list-item v-if="node.neighbors && !isLongRange">
					<v-list-item-content>Neighbors</v-list-item-content>
					<v-list-item-content class="align-end"
						>{{
							node.neighbors.length > 0
								? node.neighbors.join(', ')
								: 'None'
						}}
					</v-list-item-content>
					<v-list-item-action v-if="!node.isControllerNode">
						<v-btn
							class="ml-2"
							color="primary"
							x-small
							:loading="discoverLoading"
							dark
							@click="discoverNeighbors()"
							>Discover
							<v-icon x-small>search</v-icon>
						</v-btn>
					</v-list-item-action>
				</v-list-item>
				<v-list-item dense>
					<v-list-item-content>Statistics</v-list-item-content>
					<v-list-item-content class="align-end"
						><statistics-arrows inactive-color="black" :node="node"
					/></v-list-item-content>
				</v-list-item>
				<!-- <div v-if="lwr">
						<v-subheader>Last working route</v-subheader>
						<v-list-item dense v-for="(s, i) in lwr" :key="i">
							<v-list-item-content>{{
								s.title
							}}</v-list-item-content>
							<v-list-item-content class="align-end">{{
								s.text
							}}</v-list-item-content>
						</v-list-item>
					</div>

					<div v-if="nlwr">
						<v-subheader>Next to Last working route</v-subheader>
						<v-list-item dense v-for="(s, i) in nlwr" :key="i">
							<v-list-item-content>{{
								s.title
							}}</v-list-item-content>
							<v-list-item-content class="align-end">{{
								s.text
							}}</v-list-item-content>
						</v-list-item>
					</div> -->

				<div v-if="!node.isControllerNode && !isLongRange">
					<v-subheader
						>Priority route
						<v-btn
							v-if="appRoute"
							class="ml-2"
							color="error"
							x-small
							@click="deleteRoute('appRoute')"
							>Delete
							<v-icon x-small>delete</v-icon>
						</v-btn>
						<v-btn
							class="ml-2"
							color="success"
							x-small
							dark
							@click="getRoute('appRoute')"
							>Get
							<v-icon x-small>refresh</v-icon>
						</v-btn>
						<v-btn
							class="ml-2"
							color="purple"
							x-small
							dark
							@click="setRoute('appRoute')"
							>Set
							<v-icon x-small>route</v-icon>
						</v-btn>
					</v-subheader>
					<div v-if="appRoute && !isLongRange" class="text-caption">
						<v-list-item dense v-for="(s, i) in appRoute" :key="i">
							<v-list-item-content>{{
								s.title
							}}</v-list-item-content>
							<v-list-item-content class="align-end">{{
								s.text
							}}</v-list-item-content>
						</v-list-item>
					</div>
					<p class="text-center" v-else>None</p>
				</div>

				<div v-if="!node.isControllerNode && !isLongRange">
					<v-subheader
						>Return routes
						<v-btn
							v-if="!routesChanged"
							class="ml-2"
							color="success"
							x-small
							dark
							@click="getRouteReturnRoutes()"
							>Get
							<v-icon x-small>refresh</v-icon>
						</v-btn>
						<v-btn
							:disabled="returnRoutes.length === 4"
							class="ml-2"
							color="purple"
							x-small
							dark
							@click="addReturnRoute()"
							>Add
							<v-icon x-small>route</v-icon>
						</v-btn>
					</v-subheader>
					<div>
						<div v-if="returnRoutes.length > 0">
							<table class="fill-width">
								<thead
									class="text-caption text-center font-weight-bold"
								>
									<tr>
										<th></th>
										<th>Repeaters</th>
										<th>Speed</th>
										<th>Priority</th>
										<th></th>
									</tr>
								</thead>
								<draggable
									v-model="returnRoutes"
									@change="routesChanged = true"
									handle=".handle"
									:move="checkMove"
									tag="tbody"
								>
									<tr
										v-for="(r, i) in returnRoutes"
										:key="`returnRoute_${i}`"
										dense
										class="text-caption text-center"
									>
										<td>
											<v-icon
												v-if="!r.isPriority"
												class="handle"
												style="cursor: move"
												color="primary lighten-2"
												>drag_indicator</v-icon
											>
										</td>
										<td>
											{{
												r.repeaters.length > 0
													? r.repeaters.join(', ')
													: 'Direct connection'
											}}
										</td>
										<td>
											{{
												zwaveDataRateToString(
													r.routeSpeed,
												)
											}}
										</td>
										<td>
											<v-icon
												v-if="r.isPriority"
												color="success"
												small
												>check</v-icon
											>
										</td>
										<td>
											<v-icon
												color="error"
												small
												@click="deleteReturnRoute(r)"
												>delete</v-icon
											>
										</td>
										<td></td>
									</tr>
								</draggable>
							</table>
						</div>
						<div v-else>
							<p class="text-center">None</p>
						</div>
						<v-row dense>
							<v-btn
								v-if="routesChanged"
								class="ma-2"
								color="success"
								x-small
								dark
								@click="setReturnRoutes()"
								>Save
								<v-icon x-small>save</v-icon>
							</v-btn>

							<v-btn
								v-if="routesChanged"
								class="ma-2"
								color="error"
								x-small
								dark
								@click="resetReturnRoutes()"
								>Reset
								<v-icon x-small>clear</v-icon>
							</v-btn>
						</v-row>
					</div>
				</div>
			</v-list>
			<v-row
				v-if="!node.isControllerNode"
				class="mt-1 pa-0 text-center"
				justify="center"
			>
				<v-col class="pa-1">
					<v-btn
						color="primary"
						small
						rounded
						@click="dialogHealth = true"
						>Diagnose
						<v-icon>monitor_heart</v-icon>
					</v-btn>
				</v-col>
				<v-col class="pa-1">
					<v-btn
						color="purple"
						small
						rounded
						@click="dialogLinkReliability = true"
						>Link Statistics
						<v-icon>leak_add</v-icon>
					</v-btn>
				</v-col>
				<v-col v-if="!isLongRange" class="pa-1">
					<v-btn
						color="error"
						small
						rounded
						@click="rebuildNodeRoutes(node)"
						>Rebuild Routes
						<v-icon>heart_broken</v-icon>
					</v-btn>
				</v-col>
				<v-col class="pa-1">
					<v-btn color="success" small rounded @click="pingNode(node)"
						>Ping
						<v-icon>settings_ethernet</v-icon>
					</v-btn>
				</v-col>
			</v-row>
			<v-row v-else class="mt-1" justify="center">
				<!-- Full screen button -->
				<v-btn
					color="primary"
					small
					rounded
					@click="showFullscreen = true"
					>Full Screen
					<v-icon small>fullscreen</v-icon>
				</v-btn>

				<v-btn
					small
					class="ml-2"
					color="warning"
					rounded
					@click="newWindow()"
					>Open
					<v-icon small>open_in_new</v-icon>
				</v-btn>

				<bg-rssi-chart class="mt-2" :node="node" />
			</v-row>
		</v-col>
		<dialog-health-check
			v-if="node && !node.isControllerNode"
			v-model="dialogHealth"
			@close="dialogHealth = false"
			:socket="socket"
			:node="node"
		/>

		<dialog-link-reliability
			v-if="node && !node.isControllerNode"
			v-model="dialogLinkReliability"
			@close="dialogLinkReliability = false"
			:socket="socket"
			:node="node"
		/>

		<v-dialog
			fullscreen
			persistent
			@keydown.esc="showFullscreen = false"
			z-index="9999"
			v-model="showFullscreen"
		>
			<v-card v-if="node && node.isControllerNode">
				<v-card-text class="pt-4">
					<v-btn
						style="position: absolute; top: 10px; right: 10px"
						icon
						@click="showFullscreen = false"
					>
						<v-icon>close</v-icon>
					</v-btn>
					<bg-rssi-chart :node="node" fill-size />
				</v-card-text>
			</v-card>
		</v-dialog>
	</v-container>
</template>

<style scoped>
.close-btn {
	cursor: pointer;
	position: absolute;
	right: 0px;
	top: 5px;
	z-index: 3;
}
</style>

<script>
import {
	ProtocolDataRate,
	protocolDataRateToString,
	isRssiError,
	rssiToString,
} from 'zwave-js/safe'
import { Protocols, zwaveDataRateToString } from '@zwave-js/core/safe'
import draggable from 'vuedraggable'

import { Routes } from '../../router/index.js'
import InstancesMixin from '../../mixins/InstancesMixin.js'
import { mapActions, mapState } from 'pinia'
import useBaseStore from '../../stores/base.js'
import { copy, getProtocol } from '../../lib/utils'

export default {
	mixins: [InstancesMixin],
	components: {
		StatisticsArrows: () =>
			import('@/components/custom/StatisticsArrows.vue'),
		BgRssiChart: () => import('@/components/custom/BgRssiChart.vue'),
		DialogHealthCheck: () =>
			import('@/components/dialogs/DialogHealthCheck.vue'),
		DialogLinkReliability: () =>
			import('@/components/dialogs/DialogLinkReliability.vue'),
		draggable,
	},
	props: {
		value: {
			type: Boolean,
			default: false,
		},
		node: {
			type: Object,
			default: () => null,
		},
		socket: {
			type: Object,
		},
	},
	data: () => ({
		showFullscreen: false,
		dialogHealth: false,
		dialogLinkReliability: false,
		discoverLoading: false,
		routesChanged: false,
		returnRoutes: [],
		Protocols,
		dataRateItems: [
			{
				text: '100 Kbps',
				value: ProtocolDataRate.ZWave_100k,
			},
			{
				text: '40 Kbps',
				value: ProtocolDataRate.ZWave_40k,
			},
			{
				text: '9.6 Kbps',
				value: ProtocolDataRate.ZWave_9k6,
			},
		],
		required: (v) => !!v || 'This field is required',
	}),
	computed: {
		...mapState(useBaseStore, ['nodes']),
		nodeReturnRoutes() {
			if (!this.node) return null

			const routes = [...(this.node.customSUCReturnRoutes || [])]

			if (this.node.prioritySUCReturnRoute) {
				// priority must be first
				routes.unshift({
					...this.node.prioritySUCReturnRoute,
					isPriority: true,
				})
			}

			return routes
		},
		_value: {
			get() {
				return this.value
			},
			set(val) {
				this.$emit('input', val)
			},
		},
		lwr() {
			if (!this.node) return null

			const stats = this.node.statistics

			if (!stats || !stats.lwr) return null

			const routeStats = this.parseRouteStats(stats.lwr)

			return routeStats
		},
		nlwr() {
			if (!this.node) return null

			const stats = this.node.statistics

			if (!stats || !stats.nlwr) return null

			const routeStats = this.parseRouteStats(stats.nlwr)

			return routeStats
		},
		appRoute() {
			if (!this.node?.applicationRoute) return null

			const routeStats = this.parseRouteStats(this.node.applicationRoute)

			return routeStats
		},
		isLongRange() {
			if (!this.node) return false

			return this.node.protocol === Protocols.ZWaveLongRange
		},
	},
	watch: {
		nodeReturnRoutes: {
			handler(val) {
				this.returnRoutes = copy(val)
				this.routesChanged = false
			},
			immediate: true,
		},
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		getProtocol,
		zwaveDataRateToString,
		checkMove(evt) {
			const { futureIndex } = evt.draggedContext
			const hasPriority = this.returnRoutes.some((r) => r.isPriority)
			if (hasPriority && futureIndex === 0) {
				return false
			}

			return true
		},
		parseRouteStats(stats) {
			const repRSSI = stats.repeaterRSSI || []
			const repeaters =
				stats.repeaters?.length > 0
					? stats.repeaters
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

			const filterFailed =
				stats.routeFailedBetween?.filter((r) => !!r[0] && !!r[1]) || []
			const routeFailed =
				filterFailed.length > 0
					? filterFailed.map((r) => `${r[0]} --> ${r[1]}`).join(', ')
					: ''

			const protocolDataRate = stats.protocolDataRate
				? protocolDataRateToString(stats.protocolDataRate)
				: ''

			const routeSpeed = stats.routeSpeed
				? zwaveDataRateToString(stats.routeSpeed)
				: ''

			// const rssi = stats.rssi ? rssiToString(stats.rssi) : ''
			return [
				// rssi
				// 	? {
				// 			title: 'RSSI',
				// 			text: rssi,
				// 	  }
				// 	: null,
				protocolDataRate
					? {
							title: 'Data Rate',
							text: protocolDataRate,
						}
					: null,
				routeSpeed
					? {
							title: 'Route Speed',
							text: routeSpeed,
						}
					: null,
				{
					title: 'Repeaters',
					text: repeaters,
				},
				routeFailed
					? {
							title: 'Route failed between',
							text: routeFailed,
						}
					: null,
			].filter((r) => !!r)
		},
		newWindow() {
			const newwindow = window.open(
				'#' + Routes.controllerChart + '/#no-topbar',
				'BG-RSSI-Chart',
				'height=800,width=1200,status=no,toolbar:no,scrollbars:no,menubar:no', // check https://www.w3schools.com/jsref/met_win_open.asp for all available specs
			)
			if (window.focus) {
				newwindow.focus()
			}
		},
		async deleteRoute(route) {
			if (!this.node) return

			let api = ''

			switch (route) {
				case 'appRoute':
					api = 'removePriorityRoute'
					break
				case 'prioritySUCReturnRoute':
				case 'customSUCReturnRoutes':
					api = 'deleteSUCReturnRoutes'
					break
				default:
					api = ''
					break
			}

			if (!api) return

			if (
				await this.app.confirm(
					'Delete',
					'Are you sure you want to delete this route?',
					'alert',
				)
			) {
				const response = await this.app.apiRequest(api, [this.node.id])

				if (response.success) {
					if (response.result) {
						this.showSnackbar('Route deleted', 'success')
					} else {
						this.showSnackbar(
							`Failed delete route for node "${this.node._name}"`,
							'error',
						)
					}
				}
			}
		},
		async discoverNeighbors() {
			this.discoverLoading = true
			const response = await this.app.apiRequest(
				'discoverNodeNeighbors',
				[this.node.id],
			)

			this.discoverLoading = false

			if (response.success) {
				if (response.result) {
					this.showSnackbar('Neighbors updated', 'success')
				} else {
					this.showSnackbar(
						`Failed to discover neighbors of node "${this.node._name}"`,
						'error',
					)
				}
			}
		},
		async getRoute(route) {
			if (!this.node) return

			let api = ''

			switch (route) {
				case 'appRoute':
					api = 'getPriorityRoute'
					break
				case 'prioritySUCReturnRoute':
					api = 'getPrioritySUCReturnRoute'
					break
				case 'customSUCReturnRoutes':
					api = 'getCustomSUCReturnRoute'
					break
				default:
					api = ''
					break
			}

			if (!api) return

			const response = await this.app.apiRequest(api, [this.node.id])

			if (response.success) {
				this.showSnackbar('Route updated', 'success')
			}
		},
		async promptRoute(prefix, suffix, showPriority = false) {
			const inputs = [
				{
					type: 'array',
					inputType: 'autocomplete',
					list: true,
					multiple: true,
					prefix,
					suffix,
					key: 'repeaters',
					label: 'Repeaters',
					hint: 'Select the nodes that should be used as repeaters starting from the closest to the controller. Empty list means direct route to controller',
					itemValue: 'id',
					itemText: '_name',
					default: [],
					rules: [(v) => v.length <= 4 || 'Max 4 repeaters'],
					items: this.nodes.filter(
						(n) =>
							!n.isControllerNode &&
							n.isListening &&
							n.id !== this.node.id,
					),
				},
				{
					type: 'list',
					autocomplete: true,
					key: 'routeSpeed',
					label: 'Route speed',
					default: ProtocolDataRate.ZWave_100k,
					rules: [this.required],
					items: this.dataRateItems,
				},
			]

			if (showPriority) {
				inputs.push({
					type: 'boolean',
					key: 'isPriority',
					label: 'Priority route',
					hint: 'If enabled, this route will always be used first',
					default: false,
				})
			}

			const res = await this.app.confirm('Set route', '', 'info', {
				width: 500,
				inputs,
				confirmText: 'Set',
			})

			if (Object.keys(res).length === 0) {
				return null
			}

			return res
		},
		async getRouteReturnRoutes() {
			await this.getRoute('prioritySUCReturnRoute')
			await this.getRoute('customSUCReturnRoutes')
		},
		deleteReturnRoute(route) {
			this.returnRoutes.splice(this.returnRoutes.indexOf(route), 1)
			this.routesChanged = true
		},
		async addReturnRoute() {
			if (!this.node) return

			const res = await this.promptRoute(
				`Node "${this.node._name}"`,
				'Controller',
				true,
			)

			if (!res) return

			this.routesChanged = true

			const { repeaters, routeSpeed, isPriority } = res

			if (isPriority) {
				const existingPriorityRoute = this.returnRoutes.find(
					(r) => r.isPriority,
				)

				const newRoute = {
					repeaters,
					routeSpeed,
					isPriority,
				}

				if (existingPriorityRoute) {
					// ask if he wants to replace the existing priority route
					const res = await this.app.confirm(
						'Priority route',
						'You already have a priority route set. Do you want to replace it?',
						'info',
					)

					if (!res) return

					this.returnRoutes.splice(
						this.returnRoutes.indexOf(existingPriorityRoute),
						1,
						newRoute,
					)
				} else {
					if (newRoute.isPriority) {
						this.returnRoutes.unshift(newRoute)
					} else {
						this.returnRoutes.push(newRoute)
					}
				}
				return
			}

			this.returnRoutes.push({ repeaters, routeSpeed, isPriority })
		},
		resetReturnRoutes() {
			this.returnRoutes = copy(this.nodeReturnRoutes)
			this.routesChanged = false
		},
		async setReturnRoutes() {
			if (!this.node) return

			if (this.returnRoutes.length === 0) {
				await this.deleteRoute('customSUCReturnRoutes')
				return
			}

			const customRoutes = this.returnRoutes.filter((r) => !r.isPriority)
			const priorityRoute = this.returnRoutes.find((r) => r.isPriority)

			const args = [
				this.node.id,
				customRoutes.map((r) => ({
					repeaters: r.repeaters,
					routeSpeed: r.routeSpeed,
				})),
			]

			if (priorityRoute) {
				args.push({
					repeaters: priorityRoute.repeaters,
					routeSpeed: priorityRoute.routeSpeed,
				})
			}

			await this.setRoute('customSUCReturnRoutes', args)
		},
		async setRoute(route, args) {
			if (!this.node) return

			let api = ''
			let prefix = ''
			let suffix = ''

			switch (route) {
				case 'appRoute':
					prefix = 'Controller'
					suffix = `Node "${this.node._name}"`
					api = 'setPriorityRoute'
					break
				case 'prioritySUCReturnRoute':
					prefix = `Node "${this.node._name}"`
					suffix = `Controller`
					api = 'assignPrioritySUCReturnRoute'
					break
				case 'customSUCReturnRoutes':
					prefix = `Node "${this.node._name}"`
					suffix = `Controller`
					api = 'assignCustomSUCReturnRoutes'
					break
				default:
					api = ''
					break
			}

			if (!api) return

			if (!args) {
				const res = await this.promptRoute(prefix, suffix)

				const { repeaters, routeSpeed } = res

				args = []
				switch (route) {
					case 'appRoute':
					case 'prioritySUCReturnRoute':
						args = [this.node.id, repeaters, routeSpeed]
						break
					case 'customSUCReturnRoutes':
						{
							const routes = this.node.customSUCReturnRoutes || []
							args = [this.node.id, routes]
						}
						break
					default:
						break
				}
			}

			const response = await this.app.apiRequest(api, args)

			if (response.success) {
				if (response.result) {
					this.showSnackbar(
						`New route set for node "${this.node._name}"`,
						'success',
					)
				} else {
					this.showSnackbar(
						`Failed to set route for node "${this.node._name}"`,
					)
				}
			}
		},
	},
}
</script>

<style></style>
