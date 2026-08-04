<template>
	<ZwDialog
		:model-value="_value"
		size="md"
		:title="title"
		:dismiss="ended ? 'all' : 'none'"
		@update:model-value="_value = $event"
	>
		<p v-if="text" v-html="text" class="ma-0"></p>
		<div v-if="!ended" class="loader-progress">
			<ZwProgressBar :value="indeterminate ? null : progress" />
			<span v-if="!indeterminate" class="loader-pct"
				>{{ progress }}%</span
			>
		</div>
	</ZwDialog>
</template>

<script>
import ZwDialog from '@/components/dashboard/dialogs/ZwDialog.vue'
import ZwProgressBar from '@/components/dashboard/atoms/ZwProgressBar.vue'

export default {
	components: {
		ZwDialog,
		ZwProgressBar,
	},
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

<style scoped>
.loader-progress {
	margin-top: 14px;
}

.loader-pct {
	display: block;
	margin-top: 6px;
	font: var(--zw-text-mono-small);
	color: var(--zw-muted);
}
</style>
