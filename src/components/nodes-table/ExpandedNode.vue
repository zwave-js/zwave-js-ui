<template>
	<td :colspan="isMobile ? 1 : headers.length">
		<v-tabs
			style="margin-top: 10px"
			v-model="currentTab"
			center-active
			fixed-tabs
			show-arrows
			icons-and-text
		>
			<v-tab key="node">Node <v-icon>widgets</v-icon></v-tab>
			<v-tab v-if="nodeMetadata" key="manual"
				>Help <v-icon>help</v-icon></v-tab
			>
			<v-tab v-if="showHass" key="homeassistant"
				>Home Assistant <v-icon>home</v-icon></v-tab
			>
			<v-tab key="groups">Groups <v-icon>device_hub</v-icon></v-tab>
			<v-tab v-if="$vuetify.breakpoint.mdAndUp" key="debug"
				>Debug Info <v-icon>bug_report</v-icon></v-tab
			>

			<!-- TABS -->
			<v-tabs-items
				style="background: transparent; padding-bottom: 10px"
				touchless
				v-model="currentTab"
			>
				<!-- TAB NODE -->
				<v-tab-item key="node">
					<node-details
						:headers="headers"
						:node="node"
						:actions="actions"
						:socket="socket"
						v-on="$listeners"
					></node-details>
				</v-tab-item>

				<!-- TAB NODE -->
				<v-tab-item v-if="nodeMetadata" key="manual">
					<v-row class="mt-2" justify="center">
						<v-card class="ma-5" style="max-width: 600px">
							<v-tabs vertical>
								<v-tab
									v-for="meta in Object.keys(nodeMetadata)"
									:key="`tab-${meta}`"
								>
									{{ meta }}
								</v-tab>

								<v-tab-item
									v-for="meta in Object.keys(nodeMetadata)"
									:key="`content-${meta}`"
								>
									<v-card flat>
										<v-card-text>
											<v-col
												style="width: 600px"
												class="text-center"
												v-if="meta === 'manual'"
											>
												<v-btn
													:href="nodeMetadata[meta]"
													color="primary"
													>DOWNLOAD</v-btn
												>
											</v-col>
											<p v-else>
												{{ nodeMetadata[meta] }}
											</p>
										</v-card-text>
									</v-card>
								</v-tab-item>
							</v-tabs>
						</v-card>
					</v-row>
				</v-tab-item>

				<!-- TAB HOMEASSISTANT -->
				<v-tab-item v-if="showHass" key="homeassistant">
					<home-assistant
						:node="node"
						:socket="socket"
						v-on="$listeners"
					/>
				</v-tab-item>

				<!-- TAB GROUPS -->
				<v-tab-item key="groups">
					<association-groups :node="node" :socket="socket" />
				</v-tab-item>

				<!-- TAB DEBUG INFO -->
				<v-tab-item v-if="$vuetify.breakpoint.mdAndUp" key="debug">
					<v-textarea
						class="mx-2"
						rows="10"
						append-icon="content_copy"
						v-model="nodeJson"
						readonly
						ref="nodeJsonContent"
						@click:append="copyText"
					></v-textarea>
				</v-tab-item>
			</v-tabs-items>
		</v-tabs>
	</td>
</template>

<script>
import AssociationGroups from '@/components/nodes-table/AssociationGroups'
import HomeAssistant from '@/components/nodes-table/HomeAssistant'
import NodeDetails from '@/components/nodes-table/NodeDetails'

import { mapGetters } from 'vuex'

export default {
	props: {
		actions: Array,
		headers: Array,
		isMobile: Boolean,
		node: Object,
		socket: Object,
	},
	components: {
		AssociationGroups,
		HomeAssistant,
		NodeDetails,
	},
	computed: {
		...mapGetters(['gateway', 'mqtt']),
		nodeMetadata() {
			return this.node.deviceConfig?.metadata
		},
		nodeJson() {
			return JSON.stringify(this.node, null, 2)
		},
		showHass() {
			return (
				!this.mqtt.disabled &&
				this.gateway.hassDiscovery &&
				this.node.hassDevices &&
				Object.keys(this.node.hassDevices).length > 0
			)
		},
	},
	data() {
		return {
			currentTab: 0,
		}
	},
	methods: {
		copyText() {
			const textToCopy =
				this.$refs.nodeJsonContent.$el.querySelector('textarea')
			textToCopy.select()
			document.execCommand('copy')
		},
	},
}
</script>

<style></style>
