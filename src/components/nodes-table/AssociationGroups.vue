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
						color="green"
						@click="dialogAssociation = true"
						class="mb-2"
						>Add</v-btn
					>
					<v-btn
						text
						color="red"
						@click="removeAllAssociations"
						class="mb-2"
						>Remove All</v-btn
					>
					<v-btn
						text
						color="primary"
						@click="getAssociations"
						class="mb-2"
						>Refresh</v-btn
					>
				</template>
				<template v-slot:[`item.groupId`]="{ item }">
					{{
						node.groups.find(
							(g) =>
								g.value === item.groupId &&
								g.endpoint === item.endpoint
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
					<v-icon small color="red" @click="removeAssociation(item)"
						>delete</v-icon
					>
				</template>
			</v-data-table>
		</v-row>

		<DialogAssociation
			@add="addAssociation"
			@close="dialogAssociation = false"
			v-model="dialogAssociation"
			:nodes="nodes"
			:node="node"
			:associations="associations"
		/>
	</v-container>
</template>

<script>
import DialogAssociation from '@/components/dialogs/DialogAssociation'
import { mapState, mapActions } from 'pinia'

import useBaseStore from '../../stores/base.js'
import InstancesMixin from '../../mixins/InstancesMixin.js'

export default {
	components: {
		DialogAssociation,
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
		getAssociationAddress(ass) {
			return {
				nodeId: ass.nodeId,
				endpoint: ass.endpoint === null ? undefined : ass.endpoint,
			}
		},
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
		async getAssociations() {
			const data = await this.app.apiRequest('getAssociations', [
				this.node.id,
			])

			if (data.success) this.associations = data.result
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

			const data = await this.app.apiRequest('addAssociations', args)

			if (data.success) {
				this.showSnackbar({
					message: 'Association added',
					color: 'success',
				})
				this.getAssociations()
			} else {
				this.showSnackbar({
					message: data.message || 'Association failed',
					color: 'error',
				})
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

			const data = await this.app.apiRequest('removeAssociations', args)

			if (data.success) {
				this.showSnackbar({
					message: 'Association removed',
					color: 'success',
				})
				this.getAssociations()
			} else {
				this.showSnackbar({
					message: data.message || 'Failed to remove association',
					color: 'error',
				})
			}
		},
		async removeAllAssociations() {
			const args = [this.node.id]

			const data = await this.app.apiRequest(
				'removeAllAssociations',
				args
			)

			if (data.success) {
				this.showSnackbar({
					message: 'Association removed',
					color: 'success',
				})
				this.getAssociations()
			} else {
				this.showSnackbar({
					message: data.message || 'Failed to remove association',
					color: 'error',
				})
			}
		},
	},
}
</script>

<style></style>
