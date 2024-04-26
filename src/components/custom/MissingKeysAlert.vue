<template>
	<v-alert
		max-width="600px"
		dense
		border="left"
		type="warning"
		v-if="missingKeys.length > 0"
	>
		Some security keys are missing:
		<strong>{{ missingKeys.join(', ') }}</strong
		>. Please check your Z-Wave settings.
	</v-alert>
</template>

<script>
import { mapState } from 'pinia'
import useBaseStore from '../../stores/base'

export default {
	computed: {
		...mapState(useBaseStore, ['zwave']),
		missingKeys() {
			const keys = this.zwave.securityKeys || {}

			const requiredKeys = [
				'S2_Unauthenticated',
				'S2_Authenticated',
				'S2_AccessControl',
				'S0_Legacy',
			]
			const missing = []
			for (const key of requiredKeys) {
				if (!keys[key] || keys[key].length !== 32) {
					missing.push(key)
				}
			}
			return missing
		},
	},
}
</script>

<style></style>
