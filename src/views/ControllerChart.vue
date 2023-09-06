<template>
	<v-container>
		<bg-rssi-chart v-if="controllerNode" :node="controllerNode" fill-size />
	</v-container>
</template>

<script>
import { mapState } from 'pinia'
import useBaseStore from '../stores/base.js'

export default {
	components: {
		BgRssiChart: () => import('../components/custom/BgRssiChart.vue'),
	},
	computed: {
		...mapState(useBaseStore, ['controllerNode']),
	},
}
</script>

<style></style>
