<template>
	<v-fab
		v-if="!!node.hasDeviceConfigChanged"
		v-tooltip:bottom="
			'Auto-discovered functionality has changed since the last interview; re-interview to apply'
		"
		:style="bStyle"
		@click.stop="
			sendAction('refreshInfo', {
				nodeId: node.id,
			})
		"
		color="warning"
		height="20"
		width="20"
		icon="update"
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
}
</script>
