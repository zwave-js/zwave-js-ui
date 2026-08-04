<template>
	<v-btn
		v-if="hasAvailableFirmwareUpdate"
		v-tooltip:bottom="
			`${availableUpdatesCount} firmware update(s) available. Click to open firmware update tab.`
		"
		:style="bStyle"
		@click.stop="openFirmwareUpdateTab"
		variant="flat"
		color="warning"
		density="compact"
		icon="auto_mode"
		class="my-auto"
	>
		<v-icon size="x-small">auto_mode</v-icon>
	</v-btn>
</template>

<script>
import InstancesMixin from '../../mixins/InstancesMixin.js'

export default {
	mixins: [InstancesMixin],
	props: {
		node: {
			type: Object,
			required: true,
		},
		bStyle: {
			type: Object,
			default: () => ({}),
		},
	},
	computed: {
		hasAvailableFirmwareUpdate() {
			const updates = this.node.availableFirmwareUpdates || []
			const dismissed = this.node.firmwareUpdatesDismissed || {}

			// Filter out dismissed updates
			const nonDismissedUpdates = updates.filter(
				(update) => !dismissed[update.version],
			)
			return nonDismissedUpdates.length > 0
		},
		availableUpdatesCount() {
			const updates = this.node.availableFirmwareUpdates || []
			const dismissed = this.node.firmwareUpdatesDismissed || {}

			// Filter out dismissed updates
			const nonDismissedUpdates = updates.filter(
				(update) => !dismissed[update.version],
			)
			return nonDismissedUpdates.length
		},
	},
	methods: {
		openFirmwareUpdateTab() {
			// Use app instance to show firmware update dialog
			this.app.showFirmwareUpdateDialog(this.node)
		},
	},
}
</script>
