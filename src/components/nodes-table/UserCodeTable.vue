<template>
	<v-data-table
		:headers="headers"
		:items="userCodes"
		:items-per-page="-1"
		:mobile-breakpoint="0"
		item-key="id"
		:footer-props="{
			showFirstLastPage: true,
		}"
		dense
		:show-expand="!!node.schedule"
		expand-on-click
	>
		<template #[`item.code`]="{ item }">
			<div>
				<span
					v-if="!editingState[item.id]?.editingCode"
					style="cursor: pointer"
					@click.stop="startEditing(item, 'code')"
				>
					{{ item.code || '-------' }}
				</span>
				<div v-else>
					<v-text-field
						v-model="editingState[item.id].newCode"
						label="Code"
						style="max-width: 250px"
						single-line
					>
						<template #append>
							<v-icon
								class="mr-2"
								color="success"
								style="cursor: pointer"
								@click.stop="setUserCode(item)"
							>
								check
							</v-icon>
							<v-icon
								color="error"
								style="cursor: pointer"
								@click.stop="cancelEditing(item, 'code')"
							>
								close
							</v-icon>
						</template>
					</v-text-field>
				</div>
			</div>
		</template>
		<template #[`item.status`]="{ item }">
			<div>
				<span
					v-if="!editingState[item.id]?.editingStatus"
					@click.stop="startEditing(item, 'status')"
				>
					{{ getStatus(item.status) || '-------' }}
				</span>
				<div v-else>
					<v-select
						v-model="editingState[item.id].newStatus"
						:items="statuses"
						style="max-width: 250px"
						label="Status"
						single-line
					>
						<template #append>
							<v-icon
								class="mr-2"
								color="success"
								style="cursor: pointer"
								@click.stop="setUserStatus(item)"
							>
								check
							</v-icon>
							<v-icon
								color="error"
								style="cursor: pointer"
								@click.stop="cancelEditing(item, 'status')"
							>
								close
							</v-icon>
						</template>
					</v-select>
				</div>
			</div>
		</template>
		<template #[`item.schedule`]="{ item }">
			<v-btn
				size="x-small"
				variant="flat"
				:color="item.schedule.enabled ? 'success' : 'error'"
				@click="setEnabled(item)"
			>
				{{ item.schedule.enabled ? 'Enabled' : 'Disabled' }}
			</v-btn>
			<p class="mb-0">
				Mode:
				<b class="text-capitalize">{{ item.schedule.type || '---' }}</b>
				Slots:<b>
					{{
						item.schedule.slots.filter(
							(s) => s.type === item.schedule.type,
						).length
					}}
				</b>
			</p>
		</template>

		<template #[`expanded-row`]="{ columns: headers, item }">
			<td :colspan="headers.length">
				<node-scheduler
					v-if="node.userCodes.available.includes(item.id)"
					:node="node"
					:_user="item"
					:activeMode="item.schedule.type"
				></node-scheduler>
				<p class="text-center ma-3" v-else>
					<b>Enable this User Id in order to set schedules</b>
				</p>
			</td>
		</template>
	</v-data-table>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import InstancesMixin from '../../mixins/InstancesMixin.js'

export default {
	mixins: [InstancesMixin],
	props: { node: Object },
	components: {
		NodeScheduler: defineAsyncComponent(
			() => import('./NodeScheduler.vue'),
		),
	},
	data() {
		return {
			statuses: [
				{
					title: 'Available',
					value: 0,
				},
				{
					title: 'Enabled',
					value: 1,
				},
				{
					title: 'Disabled',
					value: 2,
				},
			],
			loading: false,
			editingState: {}, // External object to manage editing state
		}
	},
	computed: {
		headers() {
			const base = [
				{ title: 'User Id', key: 'id' },
				{ title: 'Code', key: 'code' },
				{ title: 'Status', key: 'status' },
			]

			if (this.node.schedule) {
				base.push({ title: 'Scheduling', key: 'schedule' })
			}

			return base
		},
		values() {
			return this.node.values?.filter((v) => v.commandClass === 99) || []
		},
		userCodes() {
			if (!this.values) return []
			const toReturn = []

			for (const v of this.values) {
				const id = v.propertyKey
				const code = toReturn[id] || this.getBaseItem(id)
				const prop = v.property
				if (prop === 'userCode') {
					code.code = v.value
				} else if (prop === 'userIdStatus') {
					code.status = v.value
				} else {
					continue
				}

				toReturn[id] = code
			}

			// element at index 0 is null and this breaks data-table
			return toReturn.filter((c) => !!c)
		},
	},
	methods: {
		startEditing(item, prop) {
			const id = item.id
			if (!this.editingState[id]) {
				this.editingState[id] = {
					editingCode: false,
					newCode: '',
					editingStatus: false,
					newStatus: '',
				}
			}

			const state = this.editingState[id]

			if (prop === 'code') {
				state.editingCode = true
				state.newCode = item.code || ''
			} else if (prop === 'status') {
				state.editingStatus = true
				state.newStatus = item.status
			}
		},
		cancelEditing(item, prop) {
			const id = item.id
			if (this.editingState[id]) {
				if (prop === 'code') {
					this.editingState[id].editingCode = false
				} else if (prop === 'status') {
					this.editingState[id].editingStatus = false
				}
			}
		},
		async setEnabled(user) {
			const enabled = !user.schedule.enabled
			const response = await this.app.apiRequest('setEnabledSchedule', [
				this.node.id,
				enabled,
				user.id,
			])

			if (!response.success) {
				this.showSnackbar(
					`User ID ${user.id} ${enabled ? 'enabled' : 'disabled'}`,
					'success',
				)
			}
		},
		getStatus(status) {
			return this.statuses.find((s) => s.value === status)?.text
		},
		getSlots(id) {
			const allSlots = []
			for (const type in this.node.schedule) {
				allSlots.push(
					...this.node.schedule[type].slots
						.filter((s) => s.userId === id)
						.map((s) => ({ ...s, type })),
				)
			}

			return allSlots
		},
		getBaseItem(id) {
			const base = { id }

			if (this.node.schedule) {
				const slots = this.getSlots(id)
				base.schedule = {
					type: slots.find((s) => s.enabled)?.type || 'daily',
					slots,
					enabled: this.node.userCodes.enabled.includes(id),
				}
			}

			return base
		},
		getValueId(id, prop) {
			return this.values.find(
				(v) => v.propertyKey === id && v.property === prop,
			)
		},
		async setUserCode(item) {
			const code = this.editingState[item.id].newCode
			const valueId = this.getValueId(item.id, 'userCode')

			if (!valueId) return

			valueId.newValue = code
			this.$emit('updateValue', valueId)
			this.cancelEditing(item, 'code')
		},
		async setUserStatus(item) {
			const status = this.editingState[item.id].newStatus
			const valueId = this.getValueId(item.id, 'userIdStatus')

			if (!valueId) return

			valueId.newValue = status
			this.$emit('updateValue', valueId)
			this.cancelEditing(item, 'status')
		},
	},
}
</script>
