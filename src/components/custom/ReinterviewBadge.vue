<template>
	<v-tooltip v-if="!!node.hasDeviceConfigChanged" location="bottom">
		<template v-slot:activator="{ props }">
			<v-btn
				:style="bStyle"
				v-bind="props"
				@click.stop="
					sendAction('refreshInfo', {
						nodeId: node.id,
					})
				"
				color="warning"
				variant="fab"
				height="20"
				width="20"
				><v-icon size="x-small">update</v-icon></v-btn
			>
		</template>
		<span>
			Auto-discovered functionality has changed since the last interview;
			re-interview to apply</span
		>
	</v-tooltip>
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
