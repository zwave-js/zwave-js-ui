<template>
	<v-btn
		v-if="hasAvailableFirmwareUpdate"
		v-tooltip:bottom="
			'Firmware update available for this device. Click to dismiss.'
		"
		:style="bStyle"
		@click.stop="dismissFirmwareUpdate"
		variant="flat"
		color="info"
		size="small"
		density="compact"
		icon="system_update"
		class="my-auto"
	/>
</template>

<script>
import { mapState, mapActions } from 'pinia'
import useBaseStore from '../../stores/base.js'
import { firmwareUpdateChecker } from '../../lib/FirmwareUpdateChecker.js'

export default {
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
		...mapState(useBaseStore, ['firmwareUpdatesStatus']),
		hasAvailableFirmwareUpdate() {
			const nodeUpdates = this.firmwareUpdatesStatus?.[this.node.id]
			return (
				nodeUpdates &&
				nodeUpdates.available &&
				nodeUpdates.available.length > 0 &&
				!nodeUpdates.dismissed
			)
		},
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		dismissFirmwareUpdate() {
			firmwareUpdateChecker.dismissNodeUpdate(this.node.id)
			const updateCount =
				this.firmwareUpdatesStatus[this.node.id]?.available?.length || 0
			this.showSnackbar(
				`Dismissed ${updateCount} firmware update(s) for node ${this.node.id}`,
				'info',
			)
		},
	},
}
</script>
