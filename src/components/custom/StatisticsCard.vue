<template>
	<v-row class="pa-4">
		<template v-for="(section, name) in props">
			<v-col
				cols="12"
				:md="section.cols"
				:key="`section-content-${name}`"
			>
				<div>
					<h1 class="text-caption text-uppercase grey--text mb-4">
						{{ name }}
					</h1>
					<v-row>
						<v-col
							v-for="(stat, index) in section.stats"
							:key="`controller-stat-${index}`"
							:cols="section.statCols"
							:style="{ color: getColor(stat) }"
						>
							<h2 class="text-caption">
								{{ stat.title }}
							</h2>
							<div class="text-caption font-weight-bold">
								{{ getStat(stat) || '-' }}
							</div>
						</v-col>
					</v-row>
				</div>
			</v-col>
			<v-divider
				:key="`section-divider-${name}`"
				:vertical="$vuetify.breakpoint.mdAndUp"
				v-if="name !== 'communication'"
				class="my-4"
			/>
		</template>
	</v-row>
</template>

<script>
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
			props: {
				messages: {
					stats: {
						messagesTX: {
							title: 'TX',
						},
						messagesRX: {
							title: 'RX',
						},
						messagesDroppedTX: {
							title: 'Dropped TX',
							color: 'red',
						},
						messagesDroppedRX: {
							title: 'Dropped RX',
							color: 'red',
						},
					},
					cols: 3,
					statCols: 6,
				},
				commands: {
					stats: {
						commandsTX: {
							title: 'TX',
						},
						commandsRX: {
							title: 'RX',
						},
						commandsDroppedTX: {
							title: 'Dropped TX',
							color: 'red',
						},
						commandsDroppedRX: {
							title: 'Dropped RX',
							color: 'red',
						},
					},
					cols: 3,
					statCols: 6,
				},
				communication: {
					stats: {
						CAN: {
							title: 'CAN',
						},
						NAK: {
							title: 'NAK',
							color: 'red',
						},
						timeoutACK: {
							title: 'Timeout ACK',
							color: 'red',
						},
						timeoutResponse: {
							title: 'Timeout Response',
							color: 'red',
						},
						timeoutCallback: {
							title: 'Timeout Callback',
							color: 'red',
						},
					},
					cols: 6,
					statCols: 4,
				},
			},
		}
	},
	methods: {
		hasStat(prop) {
			if (this.node && this.node.statistics) {
				return Object.prototype.hasOwnProperty.call(
					this.node.statistics,
					prop
				)
			} else {
				return false
			}
		},
		getStat(prop) {
			if (this.node && this.node.statistics) {
				return this.node.statistics[prop]
			} else {
				return null
			}
		},
		getColor(prop) {
			if (!this.hasStat(prop)) {
				return 'grey'
			}
			return prop.color || this.$vuetify.theme.themes.light.primary
		},
	},
}
</script>
