<template>
	<v-container fluid class="pa-4">
		<v-data-table
			:headers="headers"
			:items="items"
			class="elevation-1"
			style="margin-bottom: 80px"
			:search="search"
			:options.sync="tableOptions"
		>
			<template v-slot:top>
				<v-col class="pt-0" dense>
					<h2 class="pa-3">Provisioning Entries</h2>
					<missing-keys-alert />
					<v-menu
						v-model="showInfoTooltip"
						:position-x="x"
						:position-y="y"
						absolute
						offset-y
						offset-x
					>
						<v-list dense>
							<v-list-item dense>
								<v-list-item-title>
									When an entry has a Node associated it
									cannot be edited
								</v-list-item-title>
							</v-list-item>
						</v-list>
					</v-menu>

					<v-row>
						<v-col cols="12" sm="6">
							<v-text-field
								v-model="search"
								clearable
								flat
								solo-inverted
								hide-details
								single-line
								class="ma-2"
								style="max-width: 250px; min-width: 250px"
								prepend-inner-icon="search"
								label="Search"
								append-icon="refresh"
								@click:append="refreshItems"
							></v-text-field>
						</v-col>
					</v-row>
				</v-col>
			</template>

			<template v-slot:[`item.nodeId`]="{ item }">
				<v-btn
					v-if="item.nodeId"
					color="primary"
					small
					rounded
					@click.stop="showNodeDialog(item)"
				>
					{{ item.nodeId }}

					<v-icon class="ml-2" small>open_in_new</v-icon>
				</v-btn>
			</template>

			<template v-slot:[`item.dsk`]="{ item }">
				<span v-if="streamerMode">*********</span>
				<span v-else> {{ item.dsk }} </span>
			</template>

			<template v-slot:[`item.status`]="{ item }">
				<v-switch
					v-model="item.status"
					@change="onChange(item)"
					dense
				></v-switch>
			</template>

			<template v-slot:[`item.protocol`]="{ item }">
				<v-btn
					v-if="
						item.supportedProtocols?.includes(
							Protocols.ZWaveLongRange,
						)
					"
					@click="toggleProtocol(item)"
					:disabled="!!item.nodeId"
					dense
					rounded
					@focus="onRowFocus($event, item)"
					@blur="onRowBlur($event, item)"
					@mouseenter="onRowFocus($event, item)"
					@mouseleave="onRowBlur($event, item)"
					small
					outlined
					:color="getProtocolColor(item)"
					>{{ getProtocol(item) }}</v-btn
				>
				<span class="caption" v-else> Z-Wave </span>
			</template>

			<template
				v-slot:[`item.securityClasses.s2AccessControl`]="{ item }"
			>
				<div
					@focus="onRowFocus($event, item)"
					@blur="onRowBlur($event, item)"
					@mouseenter="onRowFocus($event, item)"
					@mouseleave="onRowBlur($event, item)"
				>
					<v-checkbox
						v-model="item.securityClasses.s2AccessControl"
						@change="onChange(item)"
						:disabled="
							!!item.nodeId ||
							!item.requestedSecurityClasses.s2AccessControl
						"
						hide-details
						dense
					></v-checkbox>
				</div>
			</template>
			<template
				v-slot:[`item.securityClasses.s2Authenticated`]="{ item }"
			>
				<div
					@focus="onRowFocus($event, item)"
					@blur="onRowBlur($event, item)"
					@mouseenter="onRowFocus($event, item)"
					@mouseleave="onRowBlur($event, item)"
				>
					<v-checkbox
						v-model="item.securityClasses.s2Authenticated"
						@change="onChange(item)"
						:disabled="
							!!item.nodeId ||
							!item.requestedSecurityClasses.s2Authenticated
						"
						hide-details
						dense
					></v-checkbox>
				</div>
			</template>
			<template
				v-slot:[`item.securityClasses.s2Unauthenticated`]="{ item }"
			>
				<div
					@focus="onRowFocus($event, item)"
					@blur="onRowBlur($event, item)"
					@mouseenter="onRowFocus($event, item)"
					@mouseleave="onRowBlur($event, item)"
				>
					<v-checkbox
						v-if="item.protocol === Protocols.ZWave"
						v-model="item.securityClasses.s2Unauthenticated"
						:disabled="
							!!item.nodeId ||
							!item.requestedSecurityClasses.s2Unauthenticated
						"
						@change="onChange(item)"
						hide-details
						dense
					></v-checkbox>
					<span v-else></span>
				</div>
			</template>
			<template v-slot:[`item.securityClasses.s0Legacy`]="{ item }">
				<div
					@focus="onRowFocus($event, item)"
					@blur="onRowBlur($event, item)"
					@mouseenter="onRowFocus($event, item)"
					@mouseleave="onRowBlur($event, item)"
				>
					<v-checkbox
						v-if="item.protocol === Protocols.ZWave"
						v-model="item.securityClasses.s0Legacy"
						:disabled="
							!!item.nodeId ||
							!item.requestedSecurityClasses.s0Legacy
						"
						@change="onChange(item)"
						hide-details
						dense
					></v-checkbox>
					<span v-else></span>
				</div>
			</template>
			<template v-slot:[`item.actions`]="{ item }">
				<v-icon small color="error" @click="removeItem(item)"
					>delete</v-icon
				>
				<v-icon small color="success" @click="editItem(item)"
					>edit</v-icon
				>
			</template>
		</v-data-table>
		<v-speed-dial
			v-model="fab"
			fixed
			bottom
			right
			transition="slide-y-reverse-transition"
			class="mb-7"
		>
			<template v-slot:activator>
				<v-btn v-model="fab" color="primary" dark fab>
					<v-icon v-if="fab"> close </v-icon>
					<v-icon v-else> menu </v-icon>
				</v-btn>
			</template>
			<v-tooltip left>
				<template v-slot:activator="{ on, attrs }">
					<v-btn
						fab
						dark
						small
						@click="editItem()"
						color="primary"
						v-bind="attrs"
						v-on="on"
					>
						<v-icon>add</v-icon>
					</v-btn>
				</template>
				<span>Add</span>
			</v-tooltip>
			<v-tooltip left>
				<template v-slot:activator="{ on, attrs }">
					<v-btn
						fab
						dark
						small
						@click="scanItem"
						color="warning"
						v-bind="attrs"
						v-on="on"
					>
						<v-icon>qr_code_scanner</v-icon>
					</v-btn>
				</template>
				<span>Scan</span>
			</v-tooltip>
			<v-tooltip left>
				<template v-slot:activator="{ on, attrs }">
					<v-btn
						fab
						dark
						small
						@click="refreshItems"
						color="success"
						v-bind="attrs"
						v-on="on"
					>
						<v-icon>refresh</v-icon>
					</v-btn>
				</template>
				<span>Refresh</span>
			</v-tooltip>
			<v-tooltip left>
				<template v-slot:activator="{ on, attrs }">
					<v-btn
						fab
						dark
						small
						@click="importList"
						color="error"
						v-bind="attrs"
						v-on="on"
					>
						<v-icon>file_download</v-icon>
					</v-btn>
				</template>
				<span>Import</span>
			</v-tooltip>
			<v-tooltip left>
				<template v-slot:activator="{ on, attrs }">
					<v-btn
						fab
						dark
						small
						@click="exportList"
						color="purple"
						v-bind="attrs"
						v-on="on"
					>
						<v-icon>file_upload</v-icon>
					</v-btn>
				</template>
				<span>Export</span>
			</v-tooltip>
		</v-speed-dial>

		<v-dialog
			:fullscreen="$vuetify.breakpoint.xs"
			max-width="1200px"
			v-model="expandedNodeDialog"
			persistent
			@keydown.exit="closeDialog()"
		>
			<v-card min-height="90vh">
				<v-btn
					style="position: absolute; right: 5px; top: 5px"
					x-small
					@click="closeDialog()"
					icon
					fab
				>
					<v-icon>close</v-icon>
				</v-btn>
				<v-card-text class="pt-3">
					<expanded-node :node="expandedNode" :socket="socket" />
				</v-card-text>
			</v-card>
		</v-dialog>
	</v-container>
</template>
<script>
import { tryParseDSKFromQRCodeString, Protocols } from '@zwave-js/core/safe'
import { mapActions } from 'pinia'
import {
	parseSecurityClasses,
	validDsk,
	securityClassesToArray,
	getProtocol,
	getProtocolColor,
} from '../lib/utils.js'
import useBaseStore from '../stores/base.js'
import InstancesMixin from '../mixins/InstancesMixin.js'
import { protocolsItems } from '../lib/items.js'
import { socketEvents } from '@server/lib/SocketEvents'

export default {
	name: 'SmartStart',
	props: {
		socket: Object,
	},
	mixins: [InstancesMixin],
	components: {
		ExpandedNode: () => import('@/components/nodes-table/ExpandedNode.vue'),
		MissingKeysAlert: () =>
			import('@/components/custom/MissingKeysAlert.vue'),
	},
	watch: {
		tableOptions: {
			handler() {
				useBaseStore().savePreferences({
					smartStartTable: this.tableOptions,
				})
			},
			deep: true,
		},
	},
	computed: {
		streamerMode() {
			return useBaseStore().ui.streamerMode
		},
	},
	data() {
		return {
			items: [],
			showInfoTooltip: false,
			x: 0,
			y: 0,
			Protocols,
			fab: false,
			search: '',
			tableOptions: {
				sortBy: ['nodeId'],
			},
			expandedNode: null,
			expandedNodeDialog: false,
			headers: [
				{ text: 'ID', value: 'nodeId' },
				{ text: 'Name', value: 'name' },
				{ text: 'Location', value: 'location' },
				{ text: 'Active', value: 'status' },
				{ text: 'Protocol', value: 'protocol' },
				{ text: 'DSK', value: 'dsk' },
				{
					text: 'S2 Access Control',
					value: 'securityClasses.s2AccessControl',
				},
				{
					text: 'S2 Authenticated',
					value: 'securityClasses.s2Authenticated',
				},
				{
					text: 'S2 Unauthenticated',
					value: 'securityClasses.s2Unauthenticated',
				},
				{ text: 'S0 Legacy', value: 'securityClasses.s0Legacy' },
				{ text: 'Manufacturer', value: 'manufacturer' },
				{ text: 'Label', value: 'label' },
				{ text: 'Description', value: 'description' },
				{ text: 'Actions', value: 'actions', sortable: false },
			],
			edited: false,
		}
	},
	mounted() {
		this.tableOptions = useBaseStore().getPreference('smartStartTable', {
			page: 1,
			itemsPerPage: 10,
			sortBy: ['nodeId'],
			sortDesc: [false],
			groupBy: [],
			groupDesc: [],
			mustSort: false,
			multiSort: false,
		})

		this.refreshItems()

		this.bindEvent(socketEvents.nodeAdded, () => {
			this.refreshItems()
		})
	},
	beforeDestroy() {
		if (this.socket) {
			this.unbindEvents()
		}
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		onRowFocus(event, item) {
			if (item.nodeId) {
				// get mouse position
				this.x = event.clientX + 10
				this.y = event.clientY + 10

				this.showInfoTooltip = true
			}
		},
		onRowBlur() {
			this.showInfoTooltip = false
		},
		getProtocol,
		getProtocolColor,
		showNodeDialog(entity) {
			const node = this.nodes.find((n) => n.id === entity.nodeId)
			if (node) {
				this.expandedNode = node
				this.expandedNodeDialog = true
			}
		},
		closeDialog() {
			this.expandedNode = null
			this.expandedNodeDialog = false
		},
		async refreshItems() {
			const response = await this.app.apiRequest(
				'getProvisioningEntries',
				[],
				{
					infoSnack: false,
					errorSnack: true,
				},
			)

			if (response.success) {
				this.items = this.parseItems(response.result)
			}
		},
		async exportList() {
			await this.app.exportConfiguration(
				this.items,
				'provisioningEntries',
				'json',
			)
		},
		async importList() {
			const { data } = await this.app.importFile('json')

			if (data) {
				for (const entry of data) {
					this.updateItem(entry)
				}
			}
		},
		async onChange(item) {
			await this.updateItem(item)
			this.edited = false
			this.refreshItems()
		},
		async toggleProtocol(item) {
			item.protocol =
				item.protocol === Protocols.ZWave
					? Protocols.ZWaveLongRange
					: Protocols.ZWave
			await this.onChange(item)
		},
		async updateItem(itemOrQr) {
			const response = await this.app.apiRequest(
				'provisionSmartStartNode',
				[
					typeof itemOrQr === 'string'
						? itemOrQr
						: this.convertItem(itemOrQr),
				],
			)

			if (response.success) {
				const entry = response.result
				this.showSnackbar(
					`Node ${entry.nodeId || entry.name || ''} ${
						this.edited ? 'updated' : 'added'
					}`,
					'success',
				)

				this.refreshItems()
			}
		},
		async scanItem() {
			let qrString = await this.app.confirm(
				'New entry',
				'Scan QR Code or import it as an image',
				'info',
				{
					qrScan: true,
					canceltext: 'Close',
					width: 500,
				},
			)

			if (qrString) {
				const dsk = tryParseDSKFromQRCodeString(qrString)
				if (dsk) {
					this.showSnackbar(
						`Provided QR Code is not a SmartStart QR Code.\nIn order to use it go to Control Panel > Manage Nodes and use Scan QR Code Inclusion.`,
						'warning',
					)
				} else {
					this.updateItem(qrString)
				}
			}
		},
		async editItem(existingItem) {
			if (existingItem) {
				this.edited = true
			}

			let inputs = [
				{
					type: 'text',
					label: 'Name',
					required: true,
					key: 'name',
					hint: 'The node name',
					default: existingItem ? existingItem.name : '',
				},
				{
					type: 'text',
					label: 'Location',
					required: true,
					key: 'location',
					hint: 'The node location',
					default: existingItem ? existingItem.location : '',
				},
			]

			if (!existingItem?.nodeId) {
				inputs = [
					...inputs,
					{
						type: 'text',
						label: 'DSK',
						required: true,
						key: 'dsk',
						hint: 'Enter the full DSK code (dashes included) for your device',
						rules: [validDsk],
						default: existingItem ? existingItem.dsk : '',
					},
					{
						type: 'list',
						label: 'Protocol',
						required: true,
						key: 'protocol',
						items: protocolsItems,
						disabled:
							existingItem &&
							(!existingItem.supportedProtocols ||
								existingItem.supportedProtocols.length < 2),
						hint: 'Inclusion protocol to use',
						default: existingItem
							? existingItem.protocol
							: Protocols.ZWave,
					},
					{
						type: 'checkbox',
						label: 'S2 Access Control',
						key: 's2AccessControl',
						disabled: existingItem
							? !existingItem.requestedSecurityClasses
									.s2AccessControl
							: false,
						default: existingItem
							? existingItem.securityClasses.s2AccessControl
							: false,
					},
					{
						type: 'checkbox',
						label: 'S2 Authenticated',
						key: 's2Authenticated',
						disabled: existingItem
							? !existingItem.requestedSecurityClasses
									.s2Authenticated
							: false,
						default: existingItem
							? existingItem.securityClasses.s2Authenticated
							: false,
					},
					{
						type: 'checkbox',
						label: 'S2 Unauthenticated',
						key: 's2Unauthenticated',
						disabled: existingItem
							? !existingItem.requestedSecurityClasses
									.s2Unauthenticated
							: false,
						default: existingItem
							? existingItem.securityClasses.s2Unauthenticated
							: false,
						show: (item) => {
							return item.protocol === Protocols.ZWave
						},
					},
					{
						type: 'checkbox',
						label: 'S0 Legacy',
						key: 's0Legacy',
						disabled: existingItem
							? !existingItem.requestedSecurityClasses.s0Legacy
							: false,
						default: existingItem
							? existingItem.securityClasses.s0Legacy
							: false,
						show: (item) => {
							return item.protocol === Protocols.ZWave
						},
					},
				]
			}

			let item = await this.app.confirm(
				(existingItem ? 'Update' : 'New') + ' entry',
				'',
				'info',
				{
					confirmText: existingItem ? 'Update' : 'Add',
					width: 500,
					inputs,
				},
			)

			if (item.dsk || existingItem?.nodeId) {
				if (!existingItem?.nodeId) {
					const securityClasses = {
						s2Unauthenticated: item.s2Unauthenticated,
						s2Authenticated: item.s2Authenticated,
						s2AccessControl: item.s2AccessControl,
						s0Legacy: item.s0Legacy,
					}
					delete item.s2AccessControl
					delete item.s2Authenticated
					delete item.s2Unauthenticated
					delete item.s0Legacy

					item.securityClasses = securityClasses
				}

				if (existingItem) {
					// extend existing item props that are not shown in dialog
					item = { ...existingItem, ...item }
				}

				this.updateItem(item)
			} else if (Object.keys(item).length > 0 && !item.dsk) {
				this.showSnackbar('DSK is required', 'error')
			}
		},
		async removeItem(item) {
			if (
				await this.app.confirm(
					'Attention',
					`Are you sure you want to delete this item from provisioning? Removing it from provisioning will not exclude the node`,
					'alert',
				)
			) {
				const response = await this.app.apiRequest(
					'unprovisionSmartStartNode',
					[item.dsk],
				)

				if (response.success) {
					this.showSnackbar(`Node ${item.nodeId} removed`, 'success')
					this.refreshItems()
				}
			}
		},
		parseItems(items) {
			return items.map((item) => {
				return {
					...item,
					status: !item.status,
					protocol: item.protocol ?? Protocols.ZWave,
					securityClasses: parseSecurityClasses(
						item.securityClasses,
						false,
					),
					requestedSecurityClasses: parseSecurityClasses(
						item.requestedSecurityClasses,
						item.requestedSecurityClasses ? false : true,
					),
				}
			})
		},
		convertItem(item) {
			item = {
				...item,
				status: item.status ? 0 : 1,
				protocol: item.protocol ?? Protocols.ZWave,
				securityClasses: securityClassesToArray(item.securityClasses),
				requestedSecurityClasses: securityClassesToArray(
					item.requestedSecurityClasses ||
						parseSecurityClasses([], true),
				),
			}

			return item
		},
	},
}
</script>
