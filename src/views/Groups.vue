<template>
	<v-container fluid class="pa-4">
		<v-data-table
			:headers="headers_groups"
			:items="groups"
			:search="search"
			class="elevation-1"
		>
			<template #top>
				<v-col class="pt-0">
					<v-row>
						<v-col cols="12" sm="6">
							<v-text-field
								v-model="search"
								clearable
								flat
								variant="outlined"
								hide-details
								single-line
								class="ma-2"
								style="max-width: 300px; min-width: 250px"
								prepend-inner-icon="search"
								label="Search"
								append-icon="refresh"
								@click:append="refreshGroups"
							></v-text-field>
						</v-col>
						<v-col
							cols="12"
							sm="6"
							class="d-flex align-center justify-end"
						>
							<v-btn color="primary" @click="editItem()">
								<v-icon start>add</v-icon>
								Create Group
							</v-btn>
							<v-btn variant="text" @click="exportGroups">
								Export
								<v-icon end color="primary"
									>file_download</v-icon
								>
							</v-btn>
						</v-col>
					</v-row>
				</v-col>
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
					v-tooltip:bottom="'Edit'"
					>edit</v-icon
				>
				<v-icon
					size="small"
					color="error"
					@click="deleteItem(item)"
					v-tooltip:bottom="'Delete'"
					>delete</v-icon
				>
			</template>
		</v-data-table>
	</v-container>
</template>

<script>
import { mapState } from 'pinia'
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
			search: '',
			groups: [],
			headers_groups: [
				{ title: 'Name', key: 'name' },
				{ title: 'Nodes', key: 'nodeIds' },
				{ title: 'Actions', key: 'actions', sortable: false },
			],
		}
	},
	methods: {
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

			// Filter out controller node and virtual nodes
			const availableNodes = this.physicalNodes.filter(
				(node) => !node.isControllerNode,
			)

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
					items: availableNodes.map((node) => {
						// Format: "Node [id] - [manufacturer] [product]"
						const manufacturer = node.manufacturer || ''
						const product =
							node.productDescription || node.productLabel || ''
						const deviceLabel = manufacturer
							? `${manufacturer}${product ? ' ' + product : ''}`
							: product
						return {
							title: deviceLabel
								? `Node ${node.id} - ${deviceLabel}`
								: node.name || `Node ${node.id}`,
							value: node.id,
						}
					}),
					hint: 'Select at least 2 nodes for the multicast group (controller excluded)',
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

			if (response.success && response.result) {
				const updated = response.result
				const index = this.groups.findIndex((g) => g.id === updated.id)
				if (index >= 0) {
					this.groups.splice(index, 1, updated)
				} else {
					this.groups.push(updated)
				}
				this.showSnackbar(
					`Group ${isEdit ? 'updated' : 'created'}`,
					'success',
				)
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
					const index = this.groups.findIndex(
						(g) => g.id === group.id,
					)
					if (index >= 0) {
						this.groups.splice(index, 1)
					}
					this.showSnackbar('Group deleted', 'success')
				}
			}
		},
	},
	mounted() {
		this.refreshGroups()
	},
}
</script>
