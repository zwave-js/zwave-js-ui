<template>
	<v-row v-if="node" class="pa-4">
		<template v-for="(section, name) in props">
			<v-col
				cols="12"
				:sm="section.cols"
				:key="`section-content-${name}`"
			>
				<div>
					<h1 class="text-caption text-uppercase grey--text mb-2">
						{{ name }}
					</h1>
					<v-row dense>
						<v-col
							class="pa-1"
							v-for="(stat, index) in section.stats"
							:key="`controller-stat-${index}`"
							:cols="section.statCols"
							:style="{ color: stat.color }"
						>
							<h2 class="text-caption">
								{{ stat.title }}
							</h2>
							<div class="text-caption font-weight-bold">
								{{ stat.value || '-' }}
							</div>
						</v-col>
					</v-row>
				</div>
			</v-col>
			<v-divider
				:key="`section-divider-${name}`"
				:vertical="$vuetify.breakpoint.smAndUp"
				v-if="section.divider"
				class="my-4"
			/>
		</template>
	</v-row>
</template>

<script>
import { mapState } from 'pinia'
import useBaseStore from '../../stores/base.js'

export default {
	props: {
		node: {
			type: [Object],
		},
		title: {
			type: [String],
		},
	},
	data() {
		return {
			hideNoDataStats: false,
			defaultColor: this.$vuetify.theme.themes.light.primary,
		}
	},
	computed: {
		...mapState(useBaseStore, ['nodes']),
		total() {
			return this.nodes.reduce(
				(acc, node) => {
					if (!node.statistics) return acc

					for (const k in acc) {
						acc[k] += node.statistics[k] || 0
					}

					return acc
				},
				{
					commandsTX: 0,
					commandsRX: 0,
					commandsDroppedTX: 0,
					commandsDroppedRX: 0,
				},
			)
		},
		stats() {
			if (!this.node.isControllerNode) {
				return this.node.statistics
			} else {
				return {
					...this.node.statistics,
					commandsTX: this.total.commandsTX,
					commandsRX: this.total.commandsRX,
					commandsDroppedTX: this.total.commandsDroppedTX,
					commandsDroppedRX: this.total.commandsDroppedRX,
				}
			}
		},
		props() {
			const props = {
				communication: {
					divider: true,
					stats: {
						...this.createStat('CAN', 'CAN'),
						...this.createStat('NAK', 'NAK', 'error'),
						...this.createStat(
							'timeoutACK',
							'Timeout ACK',
							'error',
						),
						...this.createStat(
							'timeoutResponse',
							'Timeout Response',
							'error',
						),
						...this.createStat(
							'timeoutCallback',
							'Timeout Callback',
							'error',
						),
					},
					cols: 6,
					statCols: 4,
				},
				[this.node.isControllerNode ? 'total Commands' : 'commands']: {
					divider: this.node.isControllerNode,
					stats: {
						...this.createStat('commandsTX', 'TX'),
						...this.createStat('commandsRX', 'RX'),
						...this.createStat(
							'commandsDroppedTX',
							'Dropped TX',
							'error',
						),
						...this.createStat(
							'commandsDroppedRX',
							'Dropped RX',
							'error',
						),
					},
					cols: 3,
					statCols: 6,
				},
			}

			if (this.node.isControllerNode) {
				props.messages = {
					divider: false,
					stats: {
						...this.createStat('messagesTX', 'TX'),
						...this.createStat('messagesRX', 'RX'),
						...this.createStat(
							'messagesDroppedTX',
							'Dropped TX',
							'error',
						),
						...this.createStat(
							'messagesDroppedRX',
							'Dropped RX',
							'error',
						),
					},
					cols: 3,
					statCols: 6,
				}
			}

			return props
		},
	},
	methods: {
		createStat(slug, title, color = this.defaultColor) {
			return {
				[`${slug}`]: {
					title: title,
					value: this.stats[slug],
					color: this.stats[slug] ? color : 'grey',
				},
			}
		},
	},
}
</script>
