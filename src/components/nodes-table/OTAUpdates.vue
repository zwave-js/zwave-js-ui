<template>
	<FirmwareUpdates
		:node="node"
		:socket="socket"
		update-type="OTA"
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
	},
	data() {
		return {}
	},
	methods: {
		async updateFirmware(update) {
			if (
				await this.app.confirm(
					`OTA ${update.downgrade ? 'Downgrade' : 'Upgrade'}`,
					`<p>Are you sure you want to ${
						update.downgrade ? 'downgrade' : 'upgrade'
					} node to <b>v${update.version}</b>?</p>
                                        
                    <p><strong>We don't take any responsibility if devices upgraded using Z-Wave JS don't work after an update. Always double-check that the correct update is about to be installed</strong></p>
                    
                    <p>This will download the desired firmware update from the <a href="https://github.com/zwave-js/firmware-updates/">Z-Wave JS firmware update service</a> and start an over-the-air (OTA) firmware update for the given node.</p>
    
                    `,
					update.downgrade ? 'error' : 'warning',
					{
						confirmText: `${
							update.downgrade ? 'Downgrade' : 'Upgrade'
						}`,
						cancelText: 'Cancel',
						width: '500px',
					},
				)
			) {
				const response = await this.app.apiRequest(
					'firmwareUpdateOTA',
					[this.node.id, update],
				)

				await this.app.handleFwUpdateResponse(response)
			}
		},
	},
}
</script>
