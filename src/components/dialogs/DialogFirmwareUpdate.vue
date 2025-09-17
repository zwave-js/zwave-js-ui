<template>
	<v-dialog v-model="_value" max-width="900px" persistent>
		<v-card>
			<v-card-title>
				<span class="text-h5">Firmware Updates - Node {{ node?.id }}</span>
			</v-card-title>
			<v-btn
				icon="close"
				size="x-small"
				@click="_value = false"
				style="position: absolute; right: 5px; top: 5px"
			/>

			<v-card-text>
				<OTWUpdates
					v-if="node && socket && node.isControllerNode"
					:node="node"
					:socket="socket"
				/>
				<OTAUpdates
					v-else-if="node && socket"
					:node="node"
					:socket="socket"
				/>
			</v-card-text>
		</v-card>
	</v-dialog>
</template>

<script>
import OTAUpdates from '@/components/nodes-table/OTAUpdates.vue'
import OTWUpdates from '@/components/nodes-table/OTWUpdates.vue'

export default {
	components: {
		OTAUpdates,
		OTWUpdates,
	},
	props: {
		modelValue: {
			type: Boolean,
			default: false,
		},
		node: {
			type: Object,
			default: null,
		},
		socket: {
			type: Object,
			default: null,
		},
	},
	emits: ['update:modelValue'],
	computed: {
		_value: {
			get() {
				return this.modelValue
			},
			set(val) {
				this.$emit('update:modelValue', val)
			},
		},
	},
}
</script>