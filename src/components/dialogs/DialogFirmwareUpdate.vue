<template>
	<ZwDialog
		:model-value="_value"
		size="xl"
		:title="`Firmware Updates - Node ${node?.id}`"
		dismiss="button"
		@update:model-value="_value = $event"
	>
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
	</ZwDialog>
</template>

<script>
import ZwDialog from '@/components/dashboard/dialogs/ZwDialog.vue'
import OTAUpdates from '@/components/nodes-table/OTAUpdates.vue'
import OTWUpdates from '@/components/nodes-table/OTWUpdates.vue'

export default {
	components: {
		ZwDialog,
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
