<template>
	<v-container grid-list-md>
		<v-row>
			<v-col cols="12">
				<v-btn variant="text" @click="exportGroups">
					Export
					<v-icon end color="primary">file_download</v-icon>
				</v-btn>
			</v-col>

			<v-col cols="12" sm="6">
				<v-text-field
					label="Group Name"
					v-model.trim="newGroupName"
				></v-text-field>
			</v-col>

			<v-col cols="12" sm="6">
				<v-btn
					color="primary"
					variant="text"
					@click="openCreateDialog"
					:disabled="!newGroupName"
				>
					Create Group
				</v-btn>
			</v-col>
		</v-row>

		<DialogGroupEdit
			@save="saveGroup"
			@close="closeDialog"
			v-model="dialogGroup"
			:title="dialogTitle"
			:editedGroup="editedGroup"
			:nodes="physicalNodes"
		/>

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
import { defineAsyncComponent } from 'vue'

export default {
	name: 'Groups',
	mixins: [InstancesMixin],
	components: {
		DialogGroupEdit: defineAsyncComponent(
			() => import('@/components/dialogs/DialogGroupEdit.vue'),
		),
	},
	watch: {
		dialogGroup(val) {
			val || this.closeDialog()
		},
	},
	computed: {
		...mapState(useBaseStore, ['nodes']),
		physicalNodes() {
			// Only return physical nodes (not virtual ones)
			return this.nodes.filter((node) => !node.virtual)
		},
		dialogTitle() {
			return this.editedIndex === -1 ? 'New Group' : 'Edit Group'
		},
	},
	data() {
		return {
			dialogGroup: false,
			groups: [],
			newGroupName: '',
			editedGroup: {},
			editedIndex: -1,
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
		openCreateDialog() {
			this.editedIndex = -1
			this.editedGroup = {
				name: this.newGroupName,
				nodeIds: [],
			}
			this.dialogGroup = true
		},
		editItem(item) {
			this.editedIndex = this.groups.indexOf(item)
			this.editedGroup = {
				...item,
				nodeIds: [...item.nodeIds], // Create a copy of the array
			}
			this.dialogGroup = true
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
		closeDialog() {
			this.dialogGroup = false
			setTimeout(() => {
				this.editedGroup = {}
				this.editedIndex = -1
				this.newGroupName = ''
			}, 300)
		},
		async saveGroup() {
			const group = this.editedGroup

			if (!group.name || !group.nodeIds || group.nodeIds.length === 0) {
				this.showSnackbar(
					'Please provide a name and select at least one node',
					'error',
				)
				return
			}

			let response
			if (this.editedIndex === -1) {
				// Create new group
				response = await this.app.apiRequest('_createGroup', [
					group.name,
					group.nodeIds,
				])
			} else {
				// Update existing group
				response = await this.app.apiRequest('_updateGroup', [
					group.id,
					group.name,
					group.nodeIds,
				])
			}

			if (response.success) {
				const action = this.editedIndex === -1 ? 'created' : 'updated'
				this.showSnackbar(`Group ${action}`, 'success')
				this.refreshGroups()
				this.closeDialog()
			}
		},
	},
	mounted() {
		this.refreshGroups()
	},
}
</script>
