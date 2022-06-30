<template>
	<v-container grid-list-md>
		<v-row class="ml-5">
			<v-col style="text-align: center" cols="12">
				<v-btn
					v-if="!loading"
					text
					color="green"
					@click="checkUpdates"
					class="mb-2"
					>Check updates</v-btn
				>
			</v-col>

			<template v-if="fwUpdates.length > 0">
				<v-col
					cols="12"
					sm="2"
					md="4"
					class="firmware-box"
					v-for="u in fwUpdates"
					:key="u.version"
				>
					<h1>v{{ u.version }}</h1>
					<v-subheader><strong>Changelog</strong></v-subheader>
					<p
						class="text-caption"
						v-text="u.changelog"
						style="white-space: pre"
					></p>

					<v-list-item
						@click.stop="updateFirmware(f)"
						v-for="f in u.files"
						:key="f.url"
						two-line
					>
						<v-list-item-icon>
							<v-icon color="primary">widgets</v-icon>
						</v-list-item-icon>
						<v-list-item-content>
							<v-list-item-title
								>Target: {{ f.target }}</v-list-item-title
							>
							<v-list-item-subtitle>{{
								f.url
							}}</v-list-item-subtitle>
						</v-list-item-content>
						<v-list-item-icon>
							<v-icon color="success">download</v-icon>
						</v-list-item-icon>
					</v-list-item>
				</v-col>
			</template>
			<v-col style="text-align: center" v-else-if="loading">
				<v-progress-circular indeterminate color="primary" />
				<p class="text-caption">
					Remember to weak up sleeping devices...
				</p>
			</v-col>
			<v-col v-else>
				<h1>No updates available</h1>
			</v-col>
		</v-row>
	</v-container>
</template>

<script>
import {
	socketEvents,
	inboundEvents as socketActions,
} from '@/../server/lib/SocketEvents'
import { mapMutations, mapGetters } from 'vuex'

export default {
	components: {},
	props: {
		node: Object,
		socket: Object,
	},
	data() {
		return {
			fwUpdates: [],
			loading: false,
		}
	},
	computed: {},
	mounted() {
		this.socket.on(socketEvents.api, (data) => {
			if (
				data.api === 'getAvailableFirmwareUpdates' &&
				data.originalArgs[0] === this.node.id
			) {
				this.loading = false
				if (data.success) {
					this.fwUpdates = data.result
				}
			}
		})

		this.checkUpdates()
	},
	methods: {
		...mapMutations(['showSnackbar']),
		apiRequest(apiName, args) {
			if (this.socket.connected) {
				const data = {
					api: apiName,
					args: args,
				}
				this.socket.emit(socketActions.zwave, data)
			} else {
				this.showSnackbar('Socket disconnected')
			}
		},
		checkUpdates() {
			this.loading = true
			this.fwUpdates = []
			this.apiRequest('getAvailableFirmwareUpdates', [this.node.id])
		},
		updateFirmware(firmware) {
			this.apiRequest('beginOTAFirmwareUpdate', [this.node.id, firmware])
		},
	},
}
</script>

<style scooped>
.firmware-box {
	padding: 20px;
	border-radius: 5px;
	border: 1px solid #ccc;
	margin-bottom: 20px;
}
</style>
