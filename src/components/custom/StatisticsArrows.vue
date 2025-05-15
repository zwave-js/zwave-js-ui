<template>
	<v-tooltip bottom>
		<template v-slot:activator="{ on }">
			<center v-on="on">
				<blink-icon
					icon="north"
					:activeColor="node.errorTransmit ? 'error' : 'success'"
					:active="now - node.lastTransmit < 200"
				/>
				<blink-icon
					icon="south"
					:activeColor="node.errorReceive ? 'error' : 'success'"
					:active="now - node.lastReceive < 200"
				/>
				<div class="text-caption">
					<i
						>{{
							node.lastActive
								? getDateTimeString(node.lastActive)
								: 'Never'
						}}
					</i>
				</div>
			</center>
		</template>
		<span style="white-space: pre-wrap">{{
			node.statistics ? jsonToList(node.statistics) : '-----'
		}}</span>
	</v-tooltip>
</template>

<script>
import { jsonToList } from '@/lib/utils'
import { mapActions } from 'pinia'
import useBaseStore from '../../stores/base.js'

export default {
	props: {
		node: {
			type: Object,
			required: true,
		},
	},
	components: {
		BlinkIcon: () => import('@/components/custom/BlinkIcon.vue'),
	},
	data() {
		return {
			now: Date.now(),
			nowInterval: null,
		}
	},
	methods: {
		...mapActions(useBaseStore, ['getDateTimeString']),
		jsonToList(item) {
			return jsonToList(item, {
				ignore: ['lwr', 'nlwr', 'rssi', 'backgroundRSSI', 'lastSeen'],
				suffixes: { rtt: 'ms' },
			})
		},
	},
	mounted() {
		this.nowInterval = setInterval(() => {
			this.now = Date.now()
		}, 200)
	},
	beforeDestroy() {
		clearInterval(this.nowInterval)
	},
}
</script>

<style></style>
