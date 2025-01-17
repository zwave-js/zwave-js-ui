<template>
	<v-container grid-list-md>
		<v-row justify="center" class="pa-5">
			<v-data-table
				:headers="headers"
				:items="associations"
				item-key="id"
				class="elevation-1"
			>
				<template v-slot:top>
					<v-btn
						text
						color="success"
						@click="dialogAssociation = true"
						class="mb-2"
						>Add</v-btn
					>
					<v-btn
						text
						color="error"
						@click="removeAllAssociations"
						class="mb-2"
						>Remove All</v-btn
					>
					<v-btn
						text
						color="primary"
						@click="getAssociations(true)"
						class="mb-2"
						>Refresh</v-btn
					>
				</template>
				<template v-slot:[`item.groupId`]="{ item }">
					{{
						node.groups.find(
							(g) =>
								g.value === item.groupId &&
								g.endpoint === item.endpoint,
						).text
					}}
				</template>
				<template v-slot:[`item.nodeId`]="{ item }">
					{{ getNodeName(item.nodeId) }}
				</template>
				<template v-slot:[`item.endpoint`]="{ item }">
					{{
						item.endpoint >= 0
							? getEndpointLabel(node.id, item.endpoint)
							: 'None'
					}}
				</template>
				<template v-slot:[`item.targetEndpoint`]="{ item }">
					{{
						item.targetEndpoint >= 0
							? getEndpointLabel(item.nodeId, item.targetEndpoint)
							: 'None'
					}}
				</template>
				<template v-slot:[`item.actions`]="{ item }">
					<v-icon small color="error" @click="removeAssociation(item)"
						>delete</v-icon
					>
				</template>
			</v-data-table>
		</v-row>

		<DialogAssociation
			@add="addAssociation"
			@close="dialogAssociation = false"
			v-model="dialogAssociation"
			:node="node"
			:associations="associations"
		/>
	</v-container>
</template>

<script>
import { mapState, mapActions } from 'pinia'

import useBaseStore from '../../stores/base.js'
import InstancesMixin from '../../mixins/InstancesMixin.js'
import { getEnumMemberName } from 'zwave-js/safe'
import { AssociationCheckResult } from '@zwave-js/cc/safe'
import { getAssociationAddress } from '../../lib/utils'

export default {
	components: {
		DialogAssociation: () =>
			import('@/components/dialogs/DialogAssociation.vue'),
	},
	mixins: [InstancesMixin],
	props: {
		node: Object,
	},
	data() {
		return {
			associations: [],
			dialogAssociation: false,
			headers: [
				{ text: 'Endpoint', value: 'endpoint' },
				{ text: 'Group', value: 'groupId' },
				{ text: 'Node', value: 'nodeId' },
				{ text: 'Target Endpoint', value: 'targetEndpoint' },
				{ text: 'Actions', value: 'actions', sortable: false },
			],
		}
	},
	computed: {
		...mapState(useBaseStore, ['nodes', 'nodesMap']),
	},
	mounted() {
		this.getAssociations()
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		getAssociationAddress,
		getNodeName(nodeId) {
			const node = this.nodes[this.nodesMap.get(nodeId)]
			return node ? node._name : 'NodeID_' + nodeId
		},
		getEndpointLabel(nodeId, endpoint) {
			const node = this.nodes[this.nodesMap.get(nodeId)]
			if (node && endpoint >= 0) {
				const ep = node.endpoints.find((e) => e.index === endpoint)
				if (ep) {
					return ep.label
				}
			}

			return endpoint >= 0 ? 'Endpoint ' + endpoint : 'No Endpoint'
		},
		async getAssociations(ask = false) {
			let refresh = false
			if (ask && this.node.status !== 'Dead') {
				refresh = await this.app.confirm(
					'Info',
					`Do you want to force query associations?${
						this.node.status === 'Alive'
							? ''
							: ' This node is Asleep, so you should wake it up first.'
					}`,
					'info',
				)
			}
			const response = await this.app.apiRequest('getAssociations', [
				this.node.id,
				refresh,
			])

			if (response.success) {
				this.associations = response.result
				this.showSnackbar('Associations updated', 'success')
			}
		},
		async addAssociation(association) {
			const target = !isNaN(association.target)
				? parseInt(association.target)
				: association.target.id

			const group = association.group

			const toAdd = { nodeId: target }

			if (group.multiChannel && association.targetEndpoint >= 0) {
				toAdd.endpoint = association.targetEndpoint
			}

			const args = [
				this.getAssociationAddress({
					nodeId: this.node.id,
					endpoint: association.endpoint,
				}),
				group.value,
				[toAdd],
			]

			const response = await this.app.apiRequest('addAssociations', args)

			if (response.success) {
				const checkResult = response.result[0]

				if (checkResult === AssociationCheckResult.OK) {
					this.showSnackbar('Association added', 'success')
					this.getAssociations()
				} else {
					this.showSnackbar(
						`Error while adding association: ${getEnumMemberName(AssociationCheckResult, checkResult)}`,
						'error',
					)
				}
			}
			this.dialogAssociation = false
		},
		async removeAssociation(association) {
			const args = [
				this.getAssociationAddress({
					nodeId: this.node.id,
					endpoint: association.endpoint,
				}),
				association.groupId,
				[
					{
						nodeId: association.nodeId,
						endpoint: association.targetEndpoint,
					},
				],
			]

			const response = await this.app.apiRequest(
				'removeAssociations',
				args,
			)

			if (response.success) {
				this.showSnackbar('Association removed', 'success')
				this.getAssociations()
			}
		},
		async removeAllAssociations() {
			const args = [this.node.id]

			if (
				!(await this.app.confirm(
					'Attention',
					`Are you sure you want to remove all associations from this node? This will also remove lifeline association if it exists.`,
					'alert',
				))
			) {
				return
			}

			const response = await this.app.apiRequest(
				'removeAllAssociations',
				args,
			)

			if (response.success) {
				this.showSnackbar('Association removed', 'success')
				this.getAssociations()
			}
		},
	},
}
</script>

<style></style>
