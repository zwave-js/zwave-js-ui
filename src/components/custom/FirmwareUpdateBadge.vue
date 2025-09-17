<template>
	<v-btn
		v-if="hasAvailableFirmwareUpdate"
		v-tooltip:bottom="
			`${availableUpdatesCount} firmware update(s) available. Click to open firmware update tab.`
		"
		:style="bStyle"
		@click.stop="openFirmwareUpdateTab"
		variant="flat"
		color="info"
		size="small"
		density="compact"
		icon="system_update"
		class="my-auto"
	/>
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
			const nonDismissedUpdates = updates.filter(update => !dismissed[update.version])
			return nonDismissedUpdates.length > 0
		},
		availableUpdatesCount() {
			const updates = this.node.availableFirmwareUpdates || []
			const dismissed = this.node.firmwareUpdatesDismissed || {}
			
			// Filter out dismissed updates
			const nonDismissedUpdates = updates.filter(update => !dismissed[update.version])
			return nonDismissedUpdates.length
		},
	},
	methods: {
		openFirmwareUpdateTab() {
			// Emit event to expand node and open firmware update tab
			this.$emit('open-node-firmware-tab', this.node.id)
		},
	},
}
</script>