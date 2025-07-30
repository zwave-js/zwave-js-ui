<template>
	<v-checkbox v-model="inverted" v-bind="$attrs"></v-checkbox>
</template>

<script>
export default {
	props: {
		modelValue: {
			type: Boolean,
			default: false,
		},
	},
	emits: ['update:modelValue'],
	computed: {
		inverted: {
			get() {
				return !this.modelValue
			},
			set(value) {
				this.$emit('update:modelValue', !value)
			},
		},
	},
}
</script>

<style></style>
