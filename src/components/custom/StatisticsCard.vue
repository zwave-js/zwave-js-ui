<template>
	<v-expansion-panels style="justify-content: start">
		<v-expansion-panel class="ma-3" style="max-width: 600px">
			<v-expansion-panel-header>{{ title }}</v-expansion-panel-header>
			<v-expansion-panel-content>
				<v-card flat>
					<v-card-text>
						<v-row>
							<v-col
								v-for="prop in statProps"
								:key="prop"
								cols="4"
							>
								<div
									class="caption font-weight-bold"
									:style="{
										color:
											props[prop].color ||
											$vuetify.theme.themes.light.primary,
									}"
								>
									{{ props[prop].title || prop }}
								</div>
								<div class="caption font-weight-bold">
									{{ getStat(prop) }}
								</div>
							</v-col>
						</v-row>
					</v-card-text>
				</v-card>
			</v-expansion-panel-content>
		</v-expansion-panel>
	</v-expansion-panels>
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
	computed: {
		statProps() {
			return Object.keys(this.props)
				.filter((p) => this.hasStat(p))
				.sort()
		},
	},
	data() {
		return {
			props: {
				messagesTX: {
					title: 'Messages TX',
				},
				messagesRX: {
					title: 'Messages RX',
				},
				messagesDroppedRX: {
					title: 'Messages Dropped RX',
					color: 'red',
				},
				NAK: {
					color: 'red',
				},
				CAN: {
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
				messagesDroppedTX: {
					title: 'Messages Dropped TX',
					color: 'red',
				},
				commandsTX: {
					title: 'Commands TX',
				},
				commandsRX: {
					title: 'Commands RX',
				},
				commandsDroppedRX: {
					title: 'Commands dropped RX',
					color: 'red',
				},
				commandsDroppedTX: {
					title: 'Commands Dropped TX',
					color: 'red',
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
	},
}
</script>
