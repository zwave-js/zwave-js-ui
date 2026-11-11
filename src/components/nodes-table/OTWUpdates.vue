<template>
	<FirmwareUpdates
		:node="node"
		:socket="socket"
		:dialog-mode="dialogMode"
		:hide-targets="true"
		:hide-downgrades="true"
		@update-firmware="updateFirmware"
	/>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import InstancesMixin from '../../mixins/InstancesMixin.js'

export default {
	components: {
		FirmwareUpdates: defineAsyncComponent(
			() => import('../custom/FirmwareUpdates.vue'),
		),
	},
	mixins: [InstancesMixin],
	props: {
		node: {
			type: Object,
			required: true,
		},
		socket: {
			type: Object,
			required: true,
		},
		dialogMode: {
			type: Boolean,
			default: false,
		},
	},
	emits: ['close-dialog'],
	data() {
		return {
			showDowngrades: undefined,
		}
	},
	methods: {
		async updateFirmware(update) {
			if (
				await this.app.confirm(
					`Firmware Upgrade`,
					`<p>Are you sure you want to upgrade your controller to <b>v${update.version}</b>?</p>

                    <p><strong>We are not responsible if a device stops working after being upgraded using Z-Wave JS. Always double-check that you are about to install the correct update.</strong></p>

                    <p>This will download the desired firmware update from the <a href="https://github.com/zwave-js/firmware-updates/">Z-Wave JS firmware update service</a> and start the upgrade process.</p>

                    `,
					'warning',
					{
						confirmText: 'Upgrade',
						cancelText: 'Cancel',
						width: '500px',
					},
				)
			) {
				// Close the dialog before starting the update
				if (this.dialogMode) {
					this.$emit('close-dialog')
				}

				const response = await this.app.apiRequest(
					'firmwareUpdateOTW',
					[update],
				)

				await this.app.handleFwUpdateResponse(response)
			}
		},
	},
}
</script>

<style></style>
