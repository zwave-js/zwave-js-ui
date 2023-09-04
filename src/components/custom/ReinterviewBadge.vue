<template>
	<v-tooltip v-if="!!node.hasDeviceConfigChanged" bottom>
		<template v-slot:activator="{ on }">
			<v-btn
				:style="bStyle"
				v-on="on"
				@click.stop="
					$emit('action', 'refreshInfo', {
						nodeId: node.id,
					})
				"
				color="warning"
				fab
				height="20"
				width="20"
				><v-icon x-small>update</v-icon></v-btn
			>
		</template>
		<span>
			Auto-discovered functionality has changed since the last interview;
			re-interview to apply</span
		>
	</v-tooltip>
</template>

<script>
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
}
</script>
