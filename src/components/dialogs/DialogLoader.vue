<template>
	<v-dialog v-model="_value" :persistent="!ended" width="500">
		<v-card>
			<v-card-title v-if="title">
				<span class="text-h5">{{ title }}</span>
			</v-card-title>
			<v-btn
				v-if="ended"
				icon="close"
				size="x-small"
				@click="_value = false"
				style="position: absolute; right: 5px; top: 5px"
			/>
			<v-card-text :class="{ 'pt-5': !title }" class="text-center">
				<v-col class="pa-0">
					<p v-html="text" class="ma-0"></p>
					<div v-if="!ended">
						<v-progress-linear
							:model-value="progress"
							:indeterminate="indeterminate"
							class="mt-1"
						>
						</v-progress-linear>
						<span>{{ progress }}%</span>
					</div>
				</v-col>
			</v-card-text>
		</v-card>
	</v-dialog>
</template>

<script>
export default {
	props: {
		modelValue: {
			type: Boolean,
			default: false,
		},
		title: {
			type: String,
			default: 'Loading',
		},
		text: {
			type: String,
			default: 'Please wait',
		},
		progress: {
			type: Number,
			default: -1,
		},
		indeterminate: {
			type: Boolean,
			default: false,
		},
	},
	computed: {
		ended() {
			return this.progress === 100 || this.progress === -1
		},
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
