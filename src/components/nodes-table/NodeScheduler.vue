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
					<v-btn text color="green" @click="editSlot()" class="mb-2"
						>Add</v-btn
					>
				</template>

				<template v-slot:[`item.actions`]="{ item }">
					<v-icon small color="red" @click="removeSlot(item.slot)"
						>delete</v-icon
					>
					<v-icon small color="success" @click="editSlot(item.slot)"
						>edit</v-icon
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

const months = [
	{
		text: 'January',
		value: 1,
	},
	{
		text: 'February',
		value: 2,
	},
	{
		text: 'March',
		value: 3,
	},
	{
		text: 'April',
		value: 4,
	},
	{
		text: 'May',
		value: 5,
	},
	{
		text: 'June',
		value: 6,
	},
	{
		text: 'July',
		value: 7,
	},
	{
		text: 'August',
		value: 8,
	},
	{
		text: 'September',
		value: 9,
	},
	{
		text: 'October',
		value: 10,
	},
	{
		text: 'November',
		value: 11,
	},
	{
		text: 'December',
		value: 12,
	},
]

export default {
	mixins: [InstancesMixin],
	props: {
		node: Object,
	},
	data() {
		return {
			mode: 'daily',
			modes: ['daily', 'weekly', 'yearly'],
			weekdays: Object.keys(ScheduleEntryLockWeekday)
				.map((key) => ({
					text: key,
					value: ScheduleEntryLockWeekday[key],
				}))
				.filter((w) => typeof w.value === 'number'),
			loading: false,
			rules: {
				required: (value) => {
					let valid = false

					if (value instanceof Array) valid = value.length > 0
					else valid = !!value || value === 0

					return valid || 'This field is required.'
				},
				positive: (value) => {
					return value > 0 || 'Value must be positive.'
				},
			},
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
		getInputs() {
			const inputs = {
				userId: {
					type: 'number',
					key: 'userId',
					label: 'User Id',
					default: 1,
					rules: [this.rules.required],
				},
				slotId: {
					type: 'number',
					key: 'slotId',
					label: 'Slot Id',
					default: 1,
					rules: [this.rules.required],
				},
				weekdays: {
					type: 'list',
					key: 'weekdays',
					label: 'Weekdays',
					default: this.weekdays.map((w) => w.value),
					rules: [this.rules.required],
					items: this.weekdays,
					multiple: true,
				},
				startHour: {
					type: 'list',
					key: 'startHour',
					label: 'Start Hour',
					default: 0,
					rules: [this.rules.required],
					items: [...Array(24).keys()],
				},
				startMinute: {
					type: 'list',
					key: 'startMinute',
					label: 'Start Minute',
					default: 0,
					rules: [this.rules.required],
					items: [...Array(60).keys()],
				},
				durationHour: {
					type: 'list',
					key: 'durationHour',
					label: 'Duration Hour',
					default: 0,
					rules: [this.rules.required],
					items: [...Array(24).keys()],
				},
				durationMinute: {
					type: 'list',
					key: 'durationMinute',
					label: 'Duration Minute',
					default: 0,
					rules: [this.rules.required],
					items: [...Array(60).keys()],
				},
				startYear: {
					type: 'list',
					key: 'startYear',
					label: 'Start Year',
					default: 0,
					rules: [this.rules.required],
					items: [...Array(100).keys()].map((i) => i + 2000),
				},
				startMonth: {
					type: 'list',
					key: 'startMonth',
					label: 'Start Month',
					default: 1,
					rules: [this.rules.required],
					items: months,
				},
				startDay: {
					type: 'list',
					key: 'startDay',
					label: 'Start Day',
					default: 1,
					rules: [this.rules.required],
					items: [...Array(31).keys()].map((i) => i + 1),
				},
			}

			if (this.mode === 'daily') {
				return [
					inputs.userId,
					inputs.slotId,
					inputs.weekdays,
					inputs.startHour,
					inputs.startMinute,
					inputs.durationHour,
					inputs.durationMinute,
				]
			}

			if (this.mode === 'weekly') {
				return [
					inputs.userId,
					inputs.slotId,
					{ ...inputs.weekdays, multiple: false, default: 1 },
					inputs.startHour,
					inputs.startMinute,
					{
						...inputs.startHour,
						key: 'stopHour',
						label: 'Stop Hour',
					},
					{
						...inputs.startMinute,
						key: 'stopMinute',
						label: 'Stop Minute',
					},
				]
			}

			if (this.mode === 'yearly') {
				return [
					inputs.userId,
					inputs.slotId,
					inputs.startYear,
					inputs.startMonth,
					inputs.startDay,
					inputs.startHour,
					inputs.startMinute,
					{ ...inputs.stopYear, key: 'stopYear', label: 'Stop Year' },
					{
						...inputs.stopMonth,
						key: 'stopMonth',
						label: 'Stop Month',
					},
					{ ...inputs.stopDay, key: 'stopDay', label: 'Stop Day' },
					{ ...inputs.stopHour, key: 'stopHour', label: 'Stop Hour' },
					{
						...inputs.stopMinute,
						key: 'stopMinute',
						label: 'Stop Minute',
					},
				]
			}

			return []
		},
		async editSlot(slot) {
			const res = await this.$listeners.showConfirm(
				slot ? 'Edit slot' : 'New slot',
				'',
				'info',
				{
					width: 900,
					inputs: this.getInputs(),
					confirmText: slot ? 'Edit' : 'Add',
				}
			)

			if (res.userId) {
				if (slot) {
					Object.assign(slot, res)
				}

				const response = await this.app.apiRequest('setSchedules', [
					this.node.id,
					this.mode,
					res,
				])

				if (response.success) {
					this.showSnackbar('Slot saved', 'success')
				}
			}
		},
	},
}
</script>

<style></style>
