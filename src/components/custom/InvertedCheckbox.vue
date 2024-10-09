<template>
	<v-checkbox v-model="inverted" v-bind="$attrs"></v-checkbox>
</template>

<script>
export default {
	props: {
		value: {
			type: Boolean,
			default: false,
		},
	},
	computed: {
		inverted: {
			get() {
				return !this.value
			},
			set(value) {
				this.$emit('input', !value)
			},
		},
	},
}
</script>

<style></style>
