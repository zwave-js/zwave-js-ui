<template>
	<v-col>
		<v-subheader>Home Assistant - Devices</v-subheader>

		<v-alert
			max-width="1150"
			v-if="gateway.manualDiscovery"
			text
			type="warning"
		>
			<small
				>Manual discovery is enabled, you have to select an entity in
				the table and then press on `REDISCOVER` button on the top of
				JSON input in order to publish the discovery payload to
				MQTT</small
			>
		</v-alert>

		<!-- HASS DEVICES -->
		<v-row v-if="hassDevices.length > 0">
			<v-col cols="12" md="6" pa-1>
				<v-tooltip bottom>
					<template v-slot:activator="{ on }">
						<v-btn
							v-on="on"
							color="primary"
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
							color="error"
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
							color="success"
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
							color="warning"
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
						<v-checkbox
							v-model="item.persistent"
							@click.stop
							@change="updateDevice(item)"
							hide-details
							dense
						></v-checkbox>
					</template>
					<template v-slot:[`item.ignoreDiscovery`]="{ item }">
						<v-btn
							@click.stop="toggleField(item, 'ignoreDiscovery')"
							:color="item.ignoreDiscovery ? 'error' : 'success'"
							rounded
							x-small
						>
							{{ item.ignoreDiscovery ? 'Disabled' : 'Enabled' }}
						</v-btn>
					</template>
				</v-data-table>
			</v-col>
			<v-col cols="12" md="6" pa-1>
				<v-tooltip v-if="!selectedDevice" bottom>
					<template v-slot:activator="{ on }">
						<v-btn
							v-on="on"
							color="primary"
							:disabled="errorDevice"
							text
							@click="addDevice()"
							>Add</v-btn
						>
					</template>
					<span>Add this device to discovered entities</span>
				</v-tooltip>

				<v-tooltip v-if="selectedDevice" bottom>
					<template v-slot:activator="{ on }">
						<v-btn
							v-on="on"
							color="primary"
							:disabled="errorDevice"
							text
							@click="updateDeviceJSON()"
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
							color="success"
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
							color="error"
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
import { inboundEvents as socketActions } from '@server/lib/SocketEvents'
import { mapActions, mapState } from 'pinia'
import useBaseStore from '../../stores/base'
import InstancesMixin from '../../mixins/InstancesMixin'

export default {
	props: {
		node: Object,
		socket: Object,
	},
	mixins: [InstancesMixin],
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
		...mapState(useBaseStore, ['gateway']),
		hassDevices() {
			const devices = []
			if (this.node && this.node.hassDevices) {
				for (const id in this.node.hassDevices) {
					const d = JSON.parse(
						JSON.stringify(this.node.hassDevices[id]),
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
		...mapActions(useBaseStore, ['showSnackbar']),
		async sendAction(data = {}) {
			return new Promise((resolve) => {
				if (this.socket.connected) {
					this.showSnackbar(`API ${data.apiName} called`, 'info')

					this.socket.emit(socketActions.hass, data, (response) => {
						if (!response.success) {
							this.showSnackbar(
								`Error while calling ${data.apiName}: ${response.message}`,
								'error',
							)
						}
						resolve(response)
					})
				} else {
					resolve({
						success: false,
						message: 'Socket disconnected',
					})
					this.showSnackbar('Socket disconnected', 'error')
				}
			})
		},
		selectDevice(item, row) {
			row.select(!row.isSelected)
			this.selectedDevice = this.selectedDevice === item ? null : item
		},
		async addDevice() {
			if (!this.errorDevice) {
				const newDevice = JSON.parse(this.deviceJSON)
				const response = await this.sendAction({
					apiName: 'add',
					device: newDevice,
					nodeId: this.node.id,
				})

				if (response.success) {
					this.showSnackbar(`Device ${newDevice.id} added`, 'success')
				}
			}
		},
		async deleteDevice() {
			const device = this.selectedDevice
			if (
				device &&
				(await this.app.confirm(
					'Attention',
					'Are you sure you want to delete selected device?',
					'alert',
				))
			) {
				const response = await this.sendAction({
					apiName: 'delete',
					device: device,
					nodeId: this.node.id,
				})

				if (response.success) {
					this.showSnackbar(`Device ${device.id} deleted`, 'success')
				}
			}
		},
		async disableDiscovery() {
			if (
				this.node &&
				(await this.app.confirm(
					'Rediscover node',
					'Are you sure you want to disable discovery of all values? In order to make this persistent remember to click on Store',
				))
			) {
				const response = await this.sendAction({
					apiName: 'disableDiscovery',
					nodeId: this.node.id,
				})

				if (response.success) {
					this.showSnackbar(
						`Discovery disabled for node ${this.node.id}`,
						'success',
					)
				}
			}
		},
		async rediscoverDevice() {
			const device = this.selectedDevice
			if (
				device &&
				(await this.app.confirm(
					'Rediscover Device',
					'Are you sure you want to re-discover selected device?',
				))
			) {
				const response = await this.sendAction({
					apiName: 'discover',
					device: device,
					nodeId: this.node.id,
				})

				if (response.success) {
					this.showSnackbar(
						`Device ${device.id} re-discovered`,
						'success',
					)
				}
			}
		},
		async rediscoverNode() {
			if (
				this.node &&
				(await this.app.confirm(
					'Rediscover node',
					'Are you sure you want to re-discover all node values?',
				))
			) {
				const response = await this.sendAction({
					apiName: 'rediscoverNode',
					nodeId: this.node.id,
				})

				if (response.success) {
					this.showSnackbar(
						`Node ${this.node.id} re-discovered`,
						'success',
					)
				}
			}
		},
		async storeDevices(remove) {
			const response = await this.sendAction({
				apiName: 'store',
				devices: this.node.hassDevices,
				nodeId: this.node.id,
				remove: remove,
			})

			if (response.success) {
				this.showSnackbar(
					`Devices stored for node ${this.node.id}`,
					'success',
				)
			}
		},
		async updateDeviceJSON() {
			if (!this.errorDevice) {
				const updated = JSON.parse(this.deviceJSON)
				this.$set(
					this.node.hassDevices,
					this.selectedDevice.id,
					updated,
				)
				await this.updateDevice(updated)
			}
		},
		async toggleField(device, field) {
			device[field] = !device[field]
			await this.updateDevice(device)
		},
		async updateDevice(device) {
			const response = await this.sendAction({
				apiName: 'update',
				device,
				nodeId: this.node.id,
			})

			if (response.success) {
				this.node.hassDevices = {
					...this.node.hassDevices,
					[device.id]: device,
				}

				if (
					this.selectedDevice &&
					this.selectedDevice.id === device.id
				) {
					this.deviceJSON = JSON.stringify(device, null, 2)
				}
				this.showSnackbar(`Device ${device.id} updated`, 'success')
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
