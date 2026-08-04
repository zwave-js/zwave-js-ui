<template>
	<v-btn
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
		variant="flat"
		color="warning"
		size="small"
		density="compact"
		icon="update"
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
}
</script>
