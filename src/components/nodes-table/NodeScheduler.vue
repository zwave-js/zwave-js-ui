<template>
	<v-container grid-list-md>
		<v-row justify="center">
			<v-select
				class="ma-2"
				label="Schedule mode"
				style="max-width: 200px"
				v-model="mode"
				:items="modes"
			></v-select>
		</v-row>
		<v-row justify="center" class="pa-1">
			<v-data-table
				:headers="headers"
				:items="items"
				item-key="id"
				:loading="loading"
				class="elevation-1"
			>
				<template v-slot:top>
					<v-btn
						:disabled="loading"
						text
						color="primary"
						@click="refresh()"
						class="mb-2"
						>Refresh</v-btn
					>
				</template>

				<template v-slot:[`item.actions`]="{ item }">
					<v-icon small color="red" @click="removeSlot(item.slot)"
						>delete</v-icon
					>
				</template>
			</v-data-table>
		</v-row>
	</v-container>
</template>

<script>
import { mapActions } from 'pinia'

import useBaseStore from '../../stores/base.js'
import InstancesMixin from '../../mixins/InstancesMixin.js'
import { getEnumMemberName } from 'zwave-js/safe'
import { ScheduleEntryLockWeekday } from '@zwave-js/cc/safe'
import { padNumber } from '../../lib/utils.js'

export default {
	mixins: [InstancesMixin],
	props: {
		node: Object,
	},
	data() {
		return {
			mode: 'daily',
			modes: ['daily', 'weekly', 'yearly'],
			weekdays: Object.entries(ScheduleEntryLockWeekday).map(
				([key, value]) => ({ text: key, value })
			),
			loading: false,
		}
	},
	computed: {
		items() {
			const schedule = this.node.schedule[this.mode]

			const items = []

			for (const s of schedule.slots) {
				let item = {
					id: `${s.userId}-${s.slotId}`,
					userId: s.userId,
					slotId: s.slotId,
					start: '',
					end: '',
					slot: s,
				}

				switch (this.mode) {
					case 'daily':
						item.weekdays = s.weekdays.map((w) =>
							getEnumMemberName(ScheduleEntryLockWeekday, w)
						)
						item.start = `${padNumber(s.startHour, 2)}:${padNumber(
							s.startMinute,
							2
						)}`
						item.duration = `${s.durationHour}h ${s.durationMinute}m`
						break
					case 'weekly':
						item.weekday = getEnumMemberName(
							ScheduleEntryLockWeekday,
							s.weekday
						)
						item.start = `${padNumber(s.startHour, 2)}:${padNumber(
							s.startMinute,
							2
						)}`

						item.stop = `${padNumber(s.stopHour, 2)}:${padNumber(
							s.stopMinute,
							2
						)}`
						break
					case 'yearly':
						item.start = new Date(
							2000 + s.startYear,
							s.startMonth - 1,
							s.startDay,
							s.startHour,
							s.startMinute
						).toLocaleString()

						item.stop = new Date(
							2000 + s.stopYear,
							s.stopMonth - 1,
							s.stopDay,
							s.stopHour,
							s.stopMinute
						).toLocaleString()

						break
				}

				items.push(item)
			}

			return items
		},
		headers() {
			let headers = [
				{ text: 'User Id', value: 'userId' },
				{ text: 'Slot Id', value: 'slotId' },
				{ text: 'Start', value: 'start' },
			]

			switch (this.mode) {
				case 'daily':
					headers = [
						...headers,
						{ text: 'Weekdays', value: 'weekdays' },
						{ text: 'duration', value: 'duration' },
					]
					break
				case 'weekly':
					headers = [
						...headers,
						{ text: 'Weekday', value: 'weekday' },
						{ text: 'Stop', value: 'stop' },
					]
					break
				case 'yearly':
					headers = [...headers, { text: 'Stop', value: 'stop' }]
					break
			}

			headers.push({ text: 'Actions', value: 'actions', sortable: false })

			return headers
		},
	},
	mounted() {},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		async refresh() {
			this.loading = true
			const response = await this.app.apiRequest('getSchedules', [
				this.node.id,
			])

			this.loading = false

			if (response.success) {
				this.showSnackbar('Schedules updated', 'success')
			}
		},
		async removeSlot(slot) {
			const response = await this.app.apiRequest('setSchedules', [
				this.node.id,
				this.mode,
				{
					slotId: slot.slotId,
					userId: slot.userId,
				},
			])

			if (response.success) {
				this.showSnackbar('Slot removed', 'success')
			}
		},
		async addSlot() {},
	},
}
</script>

<style></style>
