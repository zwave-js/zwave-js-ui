<template>
	<v-container>
		<bg-rssi-chart v-if="controllerNode" :node="controllerNode" fill-size />
	</v-container>
</template>

<script>
import { mapState } from 'pinia'
import useBaseStore from '../stores/base.js'
import { defineAsyncComponent } from 'vue'

export default {
	components: {
		BgRssiChart: defineAsyncComponent(
			() => import('../components/custom/BgRssiChart.vue'),
		),
	},
	computed: {
		...mapState(useBaseStore, ['controllerNode']),
	},
}
</script>

<style></style>
