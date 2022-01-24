<template>
	<v-tooltip bottom>
		<template v-slot:activator="{ on }">
			<center v-on="on">
				<blink-icon
					icon="north"
					:activeColor="node.errorTransmit ? 'error' : 'green'"
					:active="now - node.lastTransmit < 1000"
				/>
				<blink-icon
					icon="south"
					:activeColor="node.errorReceive ? 'error' : 'green'"
					:active="now - node.lastReceive < 1000"
				/>
				<div>
					{{
						node.lastActive
							? new Date(node.lastActive).toLocaleString()
							: 'Never'
					}}
				</div>
			</center>
		</template>
		<span style="white-space: pre-wrap">{{
			jsonToList(node.statistics)
		}}</span>
	</v-tooltip>
</template>

<script>
import { jsonToList } from '@/lib/utils'
import BlinkIcon from '@/components/custom/BlinkIcon.vue'

export default {
	props: {
		node: {
			type: Object,
			required: true,
		},
	},
	components: {
		BlinkIcon,
	},
	data() {
		return {
			now: Date.now(),
			nowInterval: null,
		}
	},
	methods: {
		jsonToList,
	},
	mounted() {
		this.nowInterval = setInterval(() => {
			this.now = Date.now()
		}, 1000)
	},
	beforeDestroy() {
		clearInterval(this.nowInterval)
	},
}
</script>

<style></style>
