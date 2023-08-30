<template>
	<v-tooltip v-if="!node.hasDeviceConfigChanged" bottom>
		<template v-slot:activator="{ on }">
			<v-btn
				style="position: absolute"
				:style="{
					left,
					right,
					top,
					bottom,
				}"
				v-on="on"
				@click.stop="
					$emit('action', 'refreshInfo', {
						nodeId: node.id,
					})
				"
				color="primary"
				fab
				height="20"
				width="20"
				><v-icon x-small>update</v-icon></v-btn
			>
		</template>
		<span>Configuration update available, re-interview the node</span>
	</v-tooltip>
</template>

<script>
export default {
	props: {
		node: {
			type: Object,
			required: true,
		},
		left: {
			type: String,
			default: '',
		},
		right: {
			type: String,
			default: '',
		},
		top: {
			type: String,
			default: '',
		},
		bottom: {
			type: String,
			default: '',
		},
	},
}
</script>

<style></style>
