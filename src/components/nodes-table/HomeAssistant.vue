<template>
	<v-col>
		<v-subheader>Home Assistant - Devices</v-subheader>

		<!-- HASS DEVICES -->
		<v-row v-if="hassDevices.length > 0">
			<v-col cols="12" md="6" pa-1>
				<v-tooltip bottom>
					<template v-slot:activator="{ on }">
						<v-btn
							v-on="on"
							color="blue darken-1"
							text
							@click="storeDevices(false)"
							>Store</v-btn
						>
					</template>
					<span
						>Store all discovered devices in nodes.json in store
						directory. Prevents re-discovery on startup</span
					>
				</v-tooltip>

				<v-tooltip bottom>
					<template v-slot:activator="{ on }">
						<v-btn
							v-on="on"
							color="red darken-1"
							text
							@click="storeDevices(true)"
							>Remove Store</v-btn
						>
					</template>
					<span
						>Remove devices from nodes.json in store directory</span
					>
				</v-tooltip>

				<v-tooltip bottom>
					<template v-slot:activator="{ on }">
						<v-btn
							v-on="on"
							color="green darken-1"
							text
							@click="rediscoverNode"
							>Rediscover Node</v-btn
						>
					</template>
					<span
						>Rediscover all node entities. Useful when changing node
						name/location and need to recalculate topics</span
					>
				</v-tooltip>

				<v-tooltip bottom>
					<template v-slot:activator="{ on }">
						<v-btn
							v-on="on"
							color="yellow darken-1"
							text
							@click="disableDiscovery"
							>Disable Discovery</v-btn
						>
					</template>
					<span
						>Set the ignoreDiscovery flag to true on all entities of
						this node to skip the discovery of them</span
					>
				</v-tooltip>

				<v-data-table
					:headers="headers_hass"
					:items="hassDevices"
					single-select
					item-key="id"
					@click:row="selectDevice"
					class="elevation-1"
				>
					<template v-slot:[`item.id`]="{ item }">
						{{ item.id }}
					</template>
					<template v-slot:[`item.type`]="{ item }">
						{{ item.type }}
					</template>
					<template v-slot:[`item.object_id`]="{ item }">
						{{ item.object_id }}
					</template>
					<template v-slot:[`item.persistent`]="{ item }">
						{{ item.persistent ? 'Yes' : 'No' }}
					</template>
					<template v-slot:[`item.ignoreDiscovery`]="{ item }">
						{{ item.ignoreDiscovery ? 'Disabled' : 'Enabled' }}
					</template>
				</v-data-table>
			</v-col>
			<v-col cols="12" md="6" pa-1>
				<v-tooltip v-if="!selectedDevice" bottom>
					<template v-slot:activator="{ on }">
						<v-btn
							v-on="on"
							color="blue darken-1"
							:disabled="errorDevice"
							text
							@click="addDevice"
							>Add</v-btn
						>
					</template>
					<span>Add this device to discovered entities</span>
				</v-tooltip>

				<v-tooltip v-if="selectedDevice" bottom>
					<template v-slot:activator="{ on }">
						<v-btn
							v-on="on"
							color="blue darken-1"
							:disabled="errorDevice"
							text
							@click="updateDevice"
							>Update</v-btn
						>
					</template>
					<span
						>Update the in-memory discover template. You have to
						press Rediscover in order to send this to HA</span
					>
				</v-tooltip>

				<v-tooltip v-if="selectedDevice" bottom>
					<template v-slot:activator="{ on }">
						<v-btn
							v-on="on"
							color="green darken-1"
							:disabled="errorDevice"
							text
							@click="rediscoverDevice"
							>Rediscover</v-btn
						>
					</template>
					<span>Send this payload to HA</span>
				</v-tooltip>

				<v-tooltip v-if="selectedDevice" bottom>
					<template v-slot:activator="{ on }">
						<v-btn
							v-on="on"
							color="red darken-1"
							:disabled="errorDevice"
							text
							@click="deleteDevice"
							>Delete</v-btn
						>
					</template>
					<span>Delete this entity</span>
				</v-tooltip>

				<v-textarea
					label="Hass Device JSON"
					auto-grow
					:rules="[validJSONdevice]"
					v-model="deviceJSON"
				></v-textarea>
			</v-col>
		</v-row>
		<div style="margin: 20px" class="subtitle-1" v-else>
			No Hass Devices
		</div>
	</v-col>
</template>

<script>
import { inboundEvents as socketActions } from '@/../server/lib/SocketEvents'
export default {
	props: {
		node: Object,
		socket: Object,
	},
	data() {
		return {
			deviceJSON: '',
			errorDevice: false,
			headers_hass: [
				{ text: 'Id', value: 'id' },
				{ text: 'Type', value: 'type' },
				{ text: 'Object id', value: 'object_id' },
				{ text: 'Persistent', value: 'persistent' },
				{ text: 'Discovery', value: 'ignoreDiscovery' },
			],
			selectedDevice: null,
		}
	},
	computed: {
		hassDevices() {
			const devices = []
			if (this.node && this.node.hassDevices) {
				for (const id in this.node.hassDevices) {
					const d = JSON.parse(
						JSON.stringify(this.node.hassDevices[id])
					)
					d.id = id
					devices.push(d)
				}
			}

			return devices
		},
	},
	watch: {
		selectedDevice() {
			this.deviceJSON = this.selectedDevice
				? JSON.stringify(this.selectedDevice, null, 2)
				: ''
		},
	},
	methods: {
		selectDevice(item, row) {
			row.select(!row.isSelected)
			this.selectedDevice = this.selectedDevice === item ? null : item
		},
		addDevice() {
			if (!this.errorDevice) {
				const newDevice = JSON.parse(this.deviceJSON)
				this.socket.emit(socketActions.hass, {
					apiName: 'add',
					device: newDevice,
					nodeId: this.node.id,
				})
			}
		},
		async deleteDevice() {
			const device = this.selectedDevice
			if (
				device &&
				(await this.$listeners.showConfirm(
					'Attention',
					'Are you sure you want to delete selected device?',
					'alert'
				))
			) {
				this.socket.emit(socketActions.hass, {
					apiName: 'delete',
					device: device,
					nodeId: this.node.id,
				})
			}
		},
		async disableDiscovery() {
			if (
				this.node &&
				(await this.$listeners.showConfirm(
					'Rediscover node',
					'Are you sure you want to disable discovery of all values? In order to make this persistent remember to click on Store'
				))
			) {
				this.socket.emit(socketActions.hass, {
					apiName: 'disableDiscovery',
					nodeId: this.node.id,
				})
			}
		},
		async rediscoverDevice() {
			const device = this.selectedDevice
			if (
				device &&
				(await this.$listeners.showConfirm(
					'Rediscover Device',
					'Are you sure you want to re-discover selected device?'
				))
			) {
				this.socket.emit(socketActions.hass, {
					apiName: 'discover',
					device: device,
					nodeId: this.node.id,
				})
			}
		},
		async rediscoverNode() {
			if (
				this.node &&
				(await this.$listeners.showConfirm(
					'Rediscover node',
					'Are you sure you want to re-discover all node values?'
				))
			) {
				this.socket.emit(socketActions.hass, {
					apiName: 'rediscoverNode',
					nodeId: this.node.id,
				})
			}
		},
		storeDevices(remove) {
			this.socket.emit(socketActions.hass, {
				apiName: 'store',
				devices: this.node.hassDevices,
				nodeId: this.node.id,
				remove: remove,
			})
		},
		updateDevice() {
			if (!this.errorDevice) {
				const updated = JSON.parse(this.deviceJSON)
				this.$set(
					this.node.hassDevices,
					this.selectedDevice.id,
					updated
				)
				this.socket.emit(socketActions.hass, {
					apiName: 'update',
					device: updated,
					nodeId: this.node.id,
				})
			}
		},
		validJSONdevice() {
			let valid = true
			try {
				JSON.parse(this.deviceJSON)
			} catch (error) {
				valid = false
			}
			this.errorDevice = !valid

			return this.deviceJSON === '' || valid || 'JSON test failed'
		},
	},
}
</script>

<style></style>
