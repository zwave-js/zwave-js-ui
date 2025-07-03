<template>
	<v-select
		hint="Force dark/light mode or select color scheme automatically based on the system preference"
		persistent-hint
		label="Color scheme"
		:hide-details="hideDetails"
		:items="colorSchemes"
		:prepend-icon="prependIcon"
		v-model="internalColorScheme"
	></v-select>
</template>

<script>
import { colorSchemes } from '../../lib/colorScheme'

export default {
	props: {
		hideDetails: {
			type: Boolean,
		},
		prependIcon: {
			type: String,
		},
		value: {
			type: String,
			default: 'system',
		},
	},
	data() {
		return {
			colorSchemes,
		}
	},
	computed: {
		internalColorScheme: {
			get() {
				return this.value
			},
			set(value) {
				this.$emit('input', value)
			},
		},
	},
}
</script>

<style></style>
