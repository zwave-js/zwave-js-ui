<template>
	<v-container grid-list-md>
		<v-data-table :headers="headers" :items="items" class="elevation-1">
			<template v-slot:top>
				<v-btn color="green" @click="editItem" dark class="mb-2"
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
					@change="onChange(item)"
					hide-details
					dense
				></v-checkbox>
			</template>
			<template v-slot:[`item.s2Authenticated`]="{ item }">
				<v-checkbox
					v-model="item.s2Authenticated"
					@change="onChange(item)"
					hide-details
					dense
				></v-checkbox>
			</template>
			<template v-slot:[`item.s2Unauthenticated`]="{ item }">
				<v-checkbox
					v-model="item.s2Unauthenticated"
					@change="onChange(item)"
					hide-details
					dense
				></v-checkbox>
			</template>
			<template v-slot:[`item.s0Legacy`]="{ item }">
				<v-checkbox
					v-model="item.s0Legacy"
					@change="onChange(item)"
					hide-details
					dense
				></v-checkbox>
			</template>
			<template v-slot:[`item.actions`]="{ item }">
				<v-icon small color="red" @click="removeItem(item)"
					>delete</v-icon
				>
				<v-icon small color="success" @click="editItem(item)"
					>edit</v-icon
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
				{ text: 'Name', value: 'name' },
				{ text: 'Location', value: 'location' },
				{ text: 'DSK', value: 'dsk' },
				{ text: 'S2 Access Control', value: 's2AccessControl' },
				{ text: 'S2 Authenticated', value: 's2Authenticated' },
				{ text: 'S2 Unhaunthenticated', value: 's2Unauthenticated' },
				{ text: 'S0 Legacy', value: 's0Legacy' },
				{ text: 'Manufacturer', value: 'manufacturer' },
				{ text: 'Label', value: 'label' },
				{ text: 'Description', value: 'description' },
				{ text: 'Actions', value: 'actions', sortable: false },
			],
			edited: false,
		}
	},
	methods: {
		...mapMutations(['showSnackbar']),
		refreshItems() {
			this.apiRequest('getProvisioningEntries', [])
		},
		onChange(item) {
			this.edited = true

			this.apiRequest('provisionSmartStartNode', [this.convertItem(item)])
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
		async editItem(existingItem) {
			if (existingItem) {
				this.edited = true
			}
			let item = await this.$listeners.showConfirm(
				(existingItem ? 'Update' : 'New') + ' entry',
				'',
				'info',
				{
					confirmText: existingItem ? 'Update' : 'Add',
					width: 900,
					inputs: [
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
						{
							type: 'checkbox',
							label: 'S2 Unhauthenticated',
							key: 's2Unauthenticated',
							default: existingItem
								? existingItem.s2Unauthenticated
								: false,
						},
						{
							type: 'checkbox',
							label: 'S2 Authenticated',
							key: 's2Authenticated',
							default: existingItem
								? existingItem.s2Authenticated
								: false,
						},
						{
							type: 'checkbox',
							label: 'S2 Access Control',
							key: 's2AccessControl',
							default: existingItem
								? existingItem.s2AccessControl
								: false,
						},
						{
							type: 'checkbox',
							label: 'S0 Legacy',
							key: 's0Legacy',
							default: existingItem
								? existingItem.s0Legacy
								: false,
						},
					],
				}
			)

			if (item.dsk) {
				this.apiRequest('provisionSmartStartNode', [
					this.convertItem(item),
				])
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
					...item,
					...parseSecurityClasses(item.securityClasses),
				}
			})
		},
		convertItem(item) {
			item = {
				...item,
				securityClasses: securityClassesToArray(item),
			}

			delete item.s2AccessControl
			delete item.s2Authenticated
			delete item.s2Unauthenticated
			delete item.s0Legacy

			return item
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
						this.showSnackbar(
							`Node successfully ${
								this.edited ? 'updated' : 'added'
							}`
						)
						this.edited = false
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
