<template>
	<v-select
		hint="Force dark/light mode or select color scheme automatically based on the system preference"
		persistent-hint
		label="Color scheme"
		:hide-details="hideDetails"
		:items="colorSchemes"
		:prepend="prependIcon"
		v-model="internalColorScheme"
	></v-select>
</template>

<script>
import { colorSchemes } from '../../lib/colorScheme'
import useBaseStore from '../../stores/base.js'

import { mapState, mapActions } from 'pinia'

export default {
	props: {
		hideDetails: {
			type: Boolean,
		},
		prependIcon: {
			type: String,
		},
	},
	data() {
		return {
			colorSchemes,
		}
	},
	computed: {
		...mapState(useBaseStore, {
			colorScheme: (store) => store.ui.colorScheme,
		}),
		internalColorScheme: {
			get() {
				return this.colorScheme
			},
			set(value) {
				this.setColorScheme(value)
			},
		},
	},
	methods: {
		...mapActions(useBaseStore, ['setColorScheme']),
	},
}
</script>

<style></style>
