<template>
	<v-container grid-list-md>
		<v-row class="pa-5">
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
					{{ item.endpoint >= 0 ? item.endpoint : 'None' }}
				</template>
				<template v-slot:[`item.targetEndpoint`]="{ item }">
					{{
						item.targetEndpoint >= 0 ? item.targetEndpoint : 'None'
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
import {
	socketEvents,
	inboundEvents as socketActions,
} from '@/../server/lib/SocketEvents'
import { mapMutations, mapGetters } from 'vuex'
export default {
	components: {
		DialogAssociation,
	},
	props: {
		node: Object,
		socket: Object,
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
		...mapGetters(['nodes', 'nodesMap']),
	},
	mounted() {
		this.socket.on(socketEvents.api, (data) => {
			if (
				data.success &&
				data.api === 'getAssociations' &&
				data.originalArgs[0] === this.node.id
			) {
				this.associations = data.result
			}
		})

		this.getAssociations()
	},
	methods: {
		...mapMutations(['showSnackbar']),
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
		getAssociations() {
			this.apiRequest('getAssociations', [this.node.id])
		},
		addAssociation(association) {
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

			this.apiRequest('addAssociations', args)

			// wait a moment before refresh to check if the node
			// has been added to the group correctly
			setTimeout(this.getAssociations, 1000)

			this.dialogAssociation = false
		},
		removeAssociation(association) {
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

			this.apiRequest('removeAssociations', args)
			// wait a moment before refresh to check if the node
			// has been added to the group correctly
			setTimeout(this.getAssociations, 1000)
		},
		removeAllAssociations() {
			const args = [this.node.id]

			this.apiRequest('removeAllAssociations', args)
			// wait a moment before refresh to check if the node
			// has been added to the group correctly
			setTimeout(this.getAssociations, 1000)
		},
	},
}
</script>

<style></style>
