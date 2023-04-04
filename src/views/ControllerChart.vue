<template>
	<v-container>
		<bg-rssi-chart v-if="controllerNode" :node="controllerNode" fill-size />
	</v-container>
</template>

<script>
import BgRssiChart from '../components/custom/BgRssiChart.vue'
import { mapState } from 'pinia'
import useBaseStore from '../stores/base.js'

export default {
	components: { BgRssiChart },
	computed: {
		...mapState(useBaseStore, ['controllerNode']),
	},
}
</script>

<style></style>
