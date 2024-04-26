<template>
	<v-alert
		max-width="600px"
		dense
		border="left"
		type="warning"
		v-if="missingKeys.length > 0 || missingZwlrKeys.length > 0"
	>
		<p v-if="missingKeys.length > 0">
			Some Z-Wave security keys are missing:
			<strong>{{ missingKeys.join(', ') }}</strong>
		</p>

		<p v-if="missingZwlrKeys.length > 0">
			Some Z-Wave Long Range security keys are missing:
			<strong>{{ missingZwlrKeys.join(', ') }}</strong>
		</p>

		<span>Please make sure to set the keys in Settings.</span>
	</v-alert>
</template>

<script>
import { mapState } from 'pinia'
import useBaseStore from '../../stores/base'

export default {
	data: () => ({
		requiredKeys: [
			'S2_Unauthenticated',
			'S2_Authenticated',
			'S2_AccessControl',
			'S0_Legacy',
		],
		requiredKeysLongRange: ['S2_Authenticated', 'S2_AccessControl'],
	}),
	computed: {
		...mapState(useBaseStore, ['zwave']),
		missingKeys() {
			const keys = this.zwave.securityKeys || {}

			const missing = []
			for (const key of this.requiredKeys) {
				if (!keys[key] || keys[key].length !== 32) {
					missing.push(key)
				}
			}
			return missing
		},
		missingZwlrKeys() {
			const keys = this.zwave.securityKeysLongRange || {}

			const missing = []
			for (const key of this.requiredKeysLongRange) {
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
