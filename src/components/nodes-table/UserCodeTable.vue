<template>
	<v-data-table
		:headers="headers"
		:items="userCodes"
		:items-per-page="-1"
		:mobile-breakpoint="0"
		:footer-props="{
			showFirstLastPage: true,
		}"
		dense
		:show-expand="!!node.schedule"
	>
		<template v-slot:[`item.code`]="props">
			<v-edit-dialog
				@open="newCode = props.item.code"
				@close="newCode = ''"
				@save="setUserCode(props.item)"
				large
			>
				{{ props.item.code || '-------' }}
				<template v-slot:input>
					<v-text-field
						v-model="newCode"
						label="Code"
						single-line
					></v-text-field>
				</template>
			</v-edit-dialog>
		</template>
		<template v-slot:[`item.status`]="props">
			<v-edit-dialog
				@open="newStatus = props.item.status"
				@close="newStatus = -1"
				@save="setUserStatus(props.item)"
				large
			>
				{{ getStatus(props.item.status) || '-------' }}
				<template v-slot:input>
					<v-select
						v-model="newStatus"
						:items="statuses"
						label="Status"
						single-line
					></v-select>
				</template>
			</v-edit-dialog>
		</template>
		<template v-slot:[`item.schedule`]="{ item }">
			<v-btn
				x-small
				:color="item.schedule.enabled ? 'success' : 'error'"
				@click="setEnabled(item)"
				>{{ item.schedule.enabled ? 'Enabled' : 'Disabled' }}</v-btn
			>
			<p class="mb-0">
				Mode:
				<b class="text-capitalize">{{ item.schedule.type || '---' }}</b>
				Slots:<b> {{ item.schedule.slots.length }}</b>
			</p>
		</template>

		<template v-slot:expanded-item="{ headers, item }">
			<td :colspan="headers.length">
				<node-scheduler
					:node="node"
					:user="item"
					:activeMode="item.schedule.type"
				></node-scheduler>
			</td>
		</template>
	</v-data-table>
</template>

<script>
import NodeScheduler from './NodeScheduler.vue'
import InstancesMixin from '../../mixins/InstancesMixin.js'

export default {
	mixins: [InstancesMixin],
	props: { node: Object },
	components: { NodeScheduler },
	data() {
		return {
			statuses: [
				{
					text: 'Available',
					value: 0,
				},
				{
					text: 'Enabled',
					value: 1,
				},
				{
					text: 'Disabled',
					value: 2,
				},
			],
			loading: false,
			newCode: '',
			newStatus: -1,
		}
	},
	computed: {
		headers() {
			const base = [
				{ text: 'Index', value: 'id' },
				{ text: 'Code', value: 'code' },
				{ text: 'Status', value: 'status' },
			]

			if (this.node.schedule) {
				base.push({ text: 'Scheduling', value: 'schedule' })
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

			return toReturn
		},
	},
	methods: {
		async setEnabled(user) {
			const enabled = !user.schedule.enabled
			const response = await this.app.apiRequest('sendCommand', [
				{
					nodeId: this.node.id,
					commandClass: 78,
				},
				'setEnabled',
				[enabled, user.id],
			])

			if (!response.success) {
				this.showSnackbar(
					`User ID ${user.id} ${enabled ? 'enabled' : 'disabled'}`,
					'success'
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
						.map((s) => ({ ...s, type }))
				)
			}

			return allSlots
		},
		getBaseItem(id) {
			const base = { id }

			if (this.node.schedule) {
				const slots = this.getSlots(id)
				base.schedule = {
					type: slots.find((s) => s.enabled)?.type,
					slots,
					enabled: this.node.userCodes.enabled.includes(id),
				}
			}

			return base
		},
		getValueId(id, prop) {
			return this.values.find(
				(v) => v.propertyKey === id && v.property === prop
			)
		},
		async setUserCode(item) {
			const code = this.newCode
			const valueId = this.getValueId(item.id, 'userCode')

			if (!valueId) return

			valueId.newValue = code
			this.$emit('updateValue', valueId)
		},
		async setUserStatus(item) {
			const status = this.newStatus
			const valueId = this.getValueId(item.id, 'userIdStatus')

			if (!valueId) return

			valueId.newValue = status
			this.$emit('updateValue', valueId)
		},
	},
}
</script>
