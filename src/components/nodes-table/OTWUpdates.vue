<script>
import OTAUpdates from './OTAUpdates.vue'

export default {
	extends: OTAUpdates,
	data() {
		return {
			showDowngrades: undefined,
			hideTargets: true,
		}
	},
	methods: {
		async updateFirmware(update) {
			if (
				await this.app.confirm(
					`Firmware Upgrade`,
					`<p>Are you sure you want to upgrade your controller to <b>v${update.version}</b>?</p>

					<p><strong>We don't take any responsibility if devices upgraded using Z-Wave JS don't work after an update. Always double-check that the correct update is about to be installed</strong></p>

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
