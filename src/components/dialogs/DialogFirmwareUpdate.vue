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
				<FirmwareUpdates
					v-if="node && socket"
					:node="node"
					:socket="socket"
					:hideDowngrades="false"
					:hideTargets="false"
					@update-firmware="handleUpdateFirmware"
				/>
			</v-card-text>
		</v-card>
	</v-dialog>
</template>

<script>
import FirmwareUpdates from '@/components/custom/FirmwareUpdates.vue'

export default {
	components: {
		FirmwareUpdates,
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
	emits: ['update:modelValue', 'update-firmware'],
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
		handleUpdateFirmware(update) {
			this.$emit('update-firmware', update)
		},
	},
}
</script>