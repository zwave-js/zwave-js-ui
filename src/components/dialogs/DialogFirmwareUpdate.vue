<template>
	<v-dialog v-model="_value" max-width="900px" persistent>
		<v-card>
			<v-card-title class="px-4 py-3">
				<span class="text-h5"
					>Firmware Updates - Node {{ node?.id }}</span
				>
			</v-card-title>
			<v-btn
				icon="close"
				size="x-small"
				@click="_value = false"
				style="position: absolute; right: 10px; top: 10px"
			/>

			<v-card-text class="px-4">
				<OTWUpdates
					v-if="node && node.isControllerNode"
					:node="node"
					:socket="socket"
					:dialog-mode="true"
					@close-dialog="closeDialog"
				/>
				<OTAUpdates
					v-else-if="node"
					:node="node"
					:socket="socket"
					:dialog-mode="true"
					@close-dialog="closeDialog"
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
	methods: {
		closeDialog() {
			this._value = false
		},
	},
}
</script>
