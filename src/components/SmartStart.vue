<template>
	<v-container grid-list-md>
		<v-data-table :headers="headers" :items="items" class="elevation-1">
			<template v-slot:top>
				<v-btn color="green" @click="addItem" dark class="mb-2"
					>Add</v-btn
				>

				<v-btn color="amber" @click="scanItem" dark class="mb-2"
					>Scan</v-btn
				>

				<v-btn color="primary" @click="refreshItems" dark class="mb-2"
					>Refresh</v-btn
				>
			</template>

			<template v-slot:[`item.s2AccessControl`]="{ item }">
				<v-checkbox
					v-model="item.s2AccessControl"
					readonly
					hide-details
					dense
				></v-checkbox>
			</template>
			<template v-slot:[`item.s2Authenticated`]="{ item }">
				<v-checkbox
					v-model="item.s2Authenticated"
					readonly
					hide-details
					dense
				></v-checkbox>
			</template>
			<template v-slot:[`item.s2Unhauntenticated`]="{ item }">
				<v-checkbox
					v-model="item.s2Unhauntenticated"
					readonly
					hide-details
					dense
				></v-checkbox>
			</template>
			<template v-slot:[`item.s0Legacy`]="{ item }">
				<v-checkbox
					v-model="item.s0Legacy"
					readonly
					hide-details
					dense
				></v-checkbox>
			</template>
			<template v-slot:[`item.actions`]="{ item }">
				<v-icon small color="red" @click="removeItem(item)"
					>delete</v-icon
				>
			</template>
		</v-data-table>
	</v-container>
</template>
<script>
import { socketEvents } from '@/plugins/socket'
import { mapGetters, mapMutations } from 'vuex'
import {
	parseSecurityClasses,
	validDsk,
	securityClassesToArray,
} from '../lib/utils.js'

export default {
	name: 'SmartStart',
	props: {
		socket: Object,
	},
	watch: {},
	computed: {
		...mapGetters(['nodes']),
	},
	data() {
		return {
			items: [],
			headers: [
				{ text: 'ID', value: 'nodeId' },
				{ text: 'DSK', value: 'dsk' },
				{ text: 'S2 Access Control', value: 's2AccessControl' },
				{ text: 'S2 Authenticated', value: 's2Authenticated' },
				{ text: 'S2 Unhaunthennitcated', value: 's2Unhauntenticated' },
				{ text: 'S0 Legacy', value: 's0Legacy' },
				{ text: 'Actions', value: 'actions', sortable: false },
			],
		}
	},
	methods: {
		...mapMutations(['showSnackbar']),
		refreshItems() {
			this.apiRequest('getProvisioningEntries', [])
		},
		async scanItem() {
			let qrString = await this.$listeners.showConfirm(
				'New entry',
				'Scan QR Code or import it as an image',
				'info',
				{
					qrScan: 'true',
					canceltext: 'Close',
				}
			)

			if (qrString) {
				this.apiRequest('provisionSmartStartNode', [qrString])
			}
		},
		async addItem() {
			let item = await this.$listeners.showConfirm(
				'New entry',
				'Add new entry to provisioning list',
				'info',
				{
					confirmText: 'Add',
					width: 900,
					inputs: [
						{
							type: 'text',
							label: 'DSK',
							required: true,
							key: 'dsk',
							hint: 'Enter the full DSK code (dashes included) for your device',
							rules: [validDsk],
						},
						{
							type: 'checkbox',
							label: 'S2 Unhauthenticated',
							key: 's2Unhauntenticated',
						},
						{
							type: 'checkbox',
							label: 'S2 Authenticated',
							key: 's2Authenticated',
						},
						{
							type: 'checkbox',
							label: 'S2 Access Control',
							key: 's2AccessControl',
						},
						{
							type: 'checkbox',
							label: 'S0 Legacy',
							key: 's0Legacy',
						},
					],
				}
			)

			if (item.dsk) {
				item = {
					dsk: item.dsk,
					securityClasses: securityClassesToArray(item),
				}

				this.apiRequest('provisionSmartStartNode', [item])
			}
		},
		async removeItem(item) {
			if (
				await this.$listeners.showConfirm(
					'Attention',
					`Are you sure you want to delete this item from provisioning? Removing it from provisioning will not exclude the node`,
					'alert'
				)
			) {
				this.apiRequest('unprovisionSmartStartNode', [item.dsk])
				this.refreshItems()
			}
		},
		parseItems(items) {
			return items.map((item) => {
				return {
					nodeId: item.nodeId,
					dsk: item.dsk,
					...parseSecurityClasses(item.securityClasses),
				}
			})
		},
		apiRequest(apiName, args) {
			this.$emit('apiRequest', apiName, args)
		},
	},
	mounted() {
		// init socket events
		this.socket.on(socketEvents.api, async (data) => {
			if (data.success) {
				switch (data.api) {
					case 'getProvisioningEntries':
						this.items = this.parseItems(data.result)
						break
					case 'unprovisionSmartStartNode':
						this.showSnackbar('Node successfully removed')
						this.refreshItems()
						break
					case 'provisionSmartStartNode':
						this.showSnackbar('Node successfully added')
						this.refreshItems()
						break
					default:
						this.showSnackbar('Successfully call api ' + data.api)
				}
			} else {
				this.showSnackbar(
					'Error while calling api ' + data.api + ': ' + data.message
				)
			}
		})

		this.refreshItems()
	},
	beforeDestroy() {
		if (this.socket) {
			// unbind events
			this.socket.off(socketEvents.api)
		}
	},
}
</script>
