<template>
	<v-container grid-list-md>
		<v-row>
			<v-col cols="12">
				<v-btn variant="text" @click="exportGroups">
					Export
					<v-icon end color="primary">file_download</v-icon>
				</v-btn>
				<v-btn
					color="primary"
					variant="flat"
					size="large"
					@click="editItem()"
					prepend-icon="add"
					class="ml-2"
				>
					Create Group
				</v-btn>
			</v-col>
		</v-row>

		<v-data-table
			:headers="headers_groups"
			:items="groups"
			class="elevation-1"
		>
			<template #top>
				<div class="d-flex flex-row">
					<v-btn
						color="primary"
						variant="text"
						@click="refreshGroups"
					>
						Refresh
					</v-btn>
				</div>
			</template>

			<template #[`item.nodeIds`]="{ item }">
				{{ item.nodeIds.length }} node(s):
				{{ getNodeNames(item.nodeIds).join(', ') }}
			</template>

			<template #[`item.actions`]="{ item }">
				<v-icon
					size="small"
					color="success"
					class="mr-2"
					@click="editItem(item)"
				>
					edit
				</v-icon>
				<v-icon size="small" color="error" @click="deleteItem(item)">
					delete
				</v-icon>
			</template>
		</v-data-table>
	</v-container>
</template>

<script>
import { mapState, mapActions } from 'pinia'
import useBaseStore from '../stores/base.js'
import InstancesMixin from '../mixins/InstancesMixin.js'

export default {
	name: 'Groups',
	mixins: [InstancesMixin],
	components: {},
	computed: {
		...mapState(useBaseStore, ['nodes']),
		physicalNodes() {
			// Only return physical nodes (not virtual ones)
			return this.nodes.filter((node) => !node.virtual)
		},
	},
	data() {
		return {
			groups: [],
			headers_groups: [
				{ title: 'ID', key: 'id' },
				{ title: 'Name', key: 'name' },
				{ title: 'Nodes', key: 'nodeIds' },
				{ title: 'Actions', key: 'actions', sortable: false },
			],
		}
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		exportGroups() {
			this.app.exportConfiguration(this.groups, 'groups')
		},
		getNodeNames(nodeIds) {
			return nodeIds.map((nodeId) => {
				const node = this.nodes.find((n) => n.id === nodeId)
				return node ? node.name || `Node ${nodeId}` : `Node ${nodeId}`
			})
		},
		async refreshGroups() {
			const response = await this.app.apiRequest('_getGroups', [], {
				infoSnack: false,
				errorSnack: true,
			})

			if (response.success) {
				this.groups = response.result || []
			}
		},
		async editItem(existingGroup) {
			const isEdit = !!existingGroup

			let inputs = [
				{
					type: 'text',
					label: 'Group Name',
					required: true,
					key: 'name',
					hint: 'Enter a descriptive name for this multicast group',
					default: isEdit ? existingGroup.name : '',
				},
				{
					type: 'list',
					label: 'Nodes',
					required: true,
					key: 'nodeIds',
					multiple: true,
					items: this.physicalNodes.map((node) => ({
						title: node.name || `Node ${node.id}`,
						value: node.id,
					})),
					hint: 'Select at least 2 nodes for the multicast group',
					default: isEdit ? existingGroup.nodeIds : [],
					rules: [
						(value) => {
							if (!value || value.length < 2) {
								return 'Please select at least 2 nodes'
							}
							return true
						},
					],
				},
			]

			let result = await this.app.confirm(
				isEdit ? 'Edit Group' : 'Create Group',
				'',
				'info',
				{
					confirmText: isEdit ? 'Update' : 'Create',
					width: 500,
					inputs,
				},
			)

			// cancelled
			if (!result || Object.keys(result).length === 0) {
				return
			}

			// Validate inputs
			if (!result.name || !result.nodeIds || result.nodeIds.length < 2) {
				this.showSnackbar(
					'Please provide a name and select at least 2 nodes',
					'error',
				)
				return
			}

			let response
			if (isEdit) {
				// Update existing group
				response = await this.app.apiRequest('_updateGroup', [
					existingGroup.id,
					result.name,
					result.nodeIds,
				])
			} else {
				// Create new group
				response = await this.app.apiRequest('_createGroup', [
					result.name,
					result.nodeIds,
				])
			}

			if (response.success) {
				const action = isEdit ? 'updated' : 'created'
				this.showSnackbar(`Group ${action}`, 'success')
				this.refreshGroups()
			}
		},
		async deleteItem(group) {
			if (
				await this.app.confirm(
					'Attention',
					`Are you sure you want to delete group "${group.name}"? This will also remove the virtual node.`,
					'alert',
				)
			) {
				const response = await this.app.apiRequest('_deleteGroup', [
					group.id,
				])

				if (response.success) {
					this.showSnackbar('Group deleted', 'success')
					this.refreshGroups()
				}
			}
		},
	},
	mounted() {
		this.refreshGroups()
	},
}
</script>
