<template>
	<v-col>
		<v-list-subheader>Home Assistant - Devices</v-list-subheader>

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
			<v-col cols="12" md="6">
				<v-btn
					v-tooltip:bottom="
						'Store all discovered devices in nodes.json in store directory. Prevents re-discovery on startup'
					"
					color="primary"
					variant="text"
					@click="storeDevices(false)"
				>
					Store
				</v-btn>

				<v-btn
					v-tooltip:bottom="
						'Remove devices from nodes.json in store directory'
					"
					color="error"
					variant="text"
					@click="storeDevices(true)"
				>
					Remove Store
				</v-btn>

				<v-btn
					v-tooltip:bottom="
						'Rediscover all node entities. Useful when changing node name/location and need to recalculate topics'
					"
					color="success"
					variant="text"
					@click="rediscoverNode"
				>
					Rediscover Node
				</v-btn>

				<v-btn
					v-tooltip:bottom="
						'Set the ignoreDiscovery flag to true on all entities of this node to skip the discovery of them'
					"
					color="warning"
					variant="text"
					@click="disableDiscovery"
				>
					Disable Discovery
				</v-btn>

				<v-data-table
					:headers="headers_hass"
					:items="hassDevices"
					show-select
					select-strategy="single"
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
							@update:model-value="updateDevice(item)"
							hide-details
							density="compact"
						></v-checkbox>
					</template>
					<template v-slot:[`item.ignoreDiscovery`]="{ item }">
						<v-btn
							variant="flat"
							@click.stop="toggleField(item, 'ignoreDiscovery')"
							:color="item.ignoreDiscovery ? 'error' : 'success'"
							size="x-small"
						>
							{{ item.ignoreDiscovery ? 'Disabled' : 'Enabled' }}
						</v-btn>
					</template>
				</v-data-table>
			</v-col>
			<v-col cols="12" md="6" pa-1>
				<v-tooltip v-if="!selectedDevice" location="bottom">
					<template v-slot:activator="{ props }">
						<v-btn
							v-bind="props"
							color="primary"
							:disabled="errorDevice"
							variant="text"
							@click="addDevice()"
							>Add</v-btn
						>
					</template>
					<span>Add this device to discovered entities</span>
				</v-tooltip>

				<v-tooltip v-if="selectedDevice" location="bottom">
					<template v-slot:activator="{ props }">
						<v-btn
							v-bind="props"
							color="primary"
							:disabled="errorDevice"
							variant="text"
							@click="updateDeviceJSON()"
							>Update</v-btn
						>
					</template>
					<span
						>Update the in-memory discover template. You have to
						press Rediscover in order to send this to HA</span
					>
				</v-tooltip>

				<v-tooltip v-if="selectedDevice" location="bottom">
					<template v-slot:activator="{ props }">
						<v-btn
							v-bind="props"
							color="success"
							:disabled="errorDevice"
							variant="text"
							@click="rediscoverDevice"
							>Rediscover</v-btn
						>
					</template>
					<span>Send this payload to HA</span>
				</v-tooltip>

				<v-tooltip v-if="selectedDevice" location="bottom">
					<template v-slot:activator="{ props }">
						<v-btn
							v-bind="props"
							color="error"
							:disabled="errorDevice"
							variant="text"
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
		<div style="margin: 20px" class="text-subtitle-1" v-else>
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
				{ title: 'Id', value: 'id' },
				{ title: 'Type', value: 'type' },
				{ title: 'Object id', value: 'object_id' },
				{ title: 'Persistent', value: 'persistent' },
				{ title: 'Discovery', value: 'ignoreDiscovery' },
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
		selectDevice(event, { item, toggleSelect, internalItem, index }) {
			toggleSelect(internalItem, index, event)
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
