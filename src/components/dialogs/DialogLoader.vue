<template>
	<v-dialog
		:model-value="modelValue"
		@update:model-value="$emit('update:modelValue', $event)"
		:persistent="!ended"
		width="500"
	>
		<v-card>
			<v-card-title v-if="title">
				<span class="headline">{{ title }}</span>
			</v-card-title>
			<v-btn
				v-if="ended"
				icon
				x-small
				@click="$emit('input', false)"
				style="position: absolute; right: 5px; top: 5px"
			>
				<v-icon>close</v-icon>
			</v-btn>
			<v-card-text :class="{ 'pt-5': !title }" class="text-center">
				<v-col class="pa-0">
					<p v-html="text" class="ma-0"></p>
					<div v-if="!ended">
						<v-progress-linear
							:value="progress"
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
	emits: ['input', 'update:modelValue'],
	computed: {
		ended() {
			return this.progress === 100 || this.progress === -1
		},
	},
}
</script>
