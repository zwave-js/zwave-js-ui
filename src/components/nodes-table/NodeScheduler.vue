<template>
	<v-container grid-list-md>
		<v-row justify="center">
			<v-select
				class="ma-2"
				style="max-width: 200px"
				v-model="mode"
				dense
				:items="supportedModes"
				persistent-hint
				:hint="`Max slots: ${this.schedule.numSlots}`"
			></v-select>
		</v-row>
		<v-row justify="center" class="pa-1">
			<v-data-table
				:headers="headers"
				:items="items"
				item-key="id"
				:loading="loading"
				dense
				:mobile-breakpoint="0"
			>
				<template v-slot:top>
					<v-btn
						v-if="!loading"
						small
						outlined
						text
						color="primary"
						@click="refresh()"
						class="mb-2"
						>Refresh</v-btn
					>
					<v-btn
						v-else
						small
						outlined
						text
						color="error"
						@click="cancel()"
						class="mb-2"
						>Stop</v-btn
					>

					<v-btn
						small
						outlined
						text
						:disabled="schedule.numSlots <= items.length"
						color="success"
						@click="editSlot()"
						class="mb-2"
						>Add</v-btn
					>

					<v-btn
						small
						outlined
						v-if="mode !== activeMode && items.length > 0"
						text
						color="warning"
						@click="enableMode()"
						class="mb-2"
						>Enable</v-btn
					>
				</template>

				<template v-slot:[`item.actions`]="{ item }">
					<v-icon small color="error" @click="removeSlot(item.slot)"
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
import { padNumber, copy } from '../../lib/utils.js'

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
		user: Object,
		activeMode: String,
	},
	data() {
		return {
			mode: 'daily',
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
		schedule() {
			return this.node.schedule[this.mode || 'daily']
		},
		supportedModes() {
			return this.modes.filter((m) => {
				return this.node.schedule[m.value].numSlots > 0
			})
		},
		modes() {
			const modes = [
				{ text: 'Daily', value: 'daily' },
				{ text: 'Weekly', value: 'weekly' },
				{ text: 'Yearly', value: 'yearly' },
			]

			for (const m of modes) {
				if (this.activeMode !== m.value) {
					m.text = `${m.text} (disabled)`
				}
			}

			return modes
		},
		items() {
			const items = []

			for (const s of this.user.schedule.slots) {
				if (s.type !== this.mode) continue

				let item = {
					slotId: s.slotId,
					start: '',
					end: '',
					slot: s,
				}

				switch (this.mode) {
					case 'daily':
						item.weekdays = s.weekdays.map((w) =>
							getEnumMemberName(ScheduleEntryLockWeekday, w),
						)
						item.start = `${padNumber(s.startHour, 2)}:${padNumber(
							s.startMinute,
							2,
						)}`
						item.duration = `${s.durationHour}h ${s.durationMinute}m`
						break
					case 'weekly':
						item.weekday = getEnumMemberName(
							ScheduleEntryLockWeekday,
							s.weekday,
						)
						item.start = `${padNumber(s.startHour, 2)}:${padNumber(
							s.startMinute,
							2,
						)}`

						item.stop = `${padNumber(s.stopHour, 2)}:${padNumber(
							s.stopMinute,
							2,
						)}`
						break
					case 'yearly':
						item.start = new Date(
							2000 + s.startYear,
							s.startMonth - 1,
							s.startDay,
							s.startHour,
							s.startMinute,
						).toLocaleString()

						item.stop = new Date(
							2000 + s.stopYear,
							s.stopMonth - 1,
							s.stopDay,
							s.stopHour,
							s.stopMinute,
						).toLocaleString()

						break
				}

				items.push(item)
			}

			return items
		},
		headers() {
			let headers = [
				{ text: 'Slot Id', value: 'slotId' },
				{ text: 'Start', value: 'start' },
			]

			switch (this.mode) {
				case 'daily':
					headers = [
						...headers,
						{ text: 'Weekdays', value: 'weekdays' },
						{ text: 'Duration', value: 'duration' },
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
	mounted() {
		this.mode = this.activeMode || 'daily'
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		validSlot(v, values) {
			return (
				!this.items.some((i) => i.slotId === values.slotId) ||
				'Slot already exists'
			)
		},
		async enableMode() {
			// in order to enable a mode we need to set a schedule
			const response = await this.app.apiRequest('setSchedule', [
				this.node.id,
				this.mode,
				{ ...this.items[0].slot, type: undefined },
			])

			if (response.success) {
				this.showSnackbar(`Mode ${this.mode} enabled`, 'success')
			}
		},
		async refresh() {
			const shouldQuery = await this.app.confirm(
				'Refresh schedules',
				'Do you want to query the schedules from the device or to get them from the cache? Querying from the device may take a while but will always return the latest schedules stored on it.',
				'info',
				{
					confirmText: 'Query',
					cancelText: 'Cache',
				},
			)

			this.loading = true
			const response = await this.app.apiRequest('getSchedules', [
				this.node.id,
				{ mode: this.mode, fromCache: !shouldQuery },
			])

			this.loading = false

			if (response.success) {
				this.showSnackbar('Schedules updated', 'success')
			}
		},
		async cancel() {
			const response = await this.app.apiRequest('cancelGetSchedule', [])

			if (response.success) {
				this.loading = false
				this.showSnackbar('Schedule cancelled', 'success')
			}
		},
		async removeSlot(slot) {
			const response = await this.app.apiRequest('setSchedule', [
				this.node.id,
				this.mode,
				{
					slotId: slot.slotId,
					userId: this.user.id,
				},
			])

			if (response.success) {
				this.showSnackbar('Slot removed', 'success')
			}
		},
		getInputs(slot) {
			const maxSlots = this.schedule.numSlots

			const actualYear = new Date().getFullYear()

			const inputs = {
				slotId: {
					type: 'list',
					autocomplete: true,
					key: 'slotId',
					label: 'Slot Id',
					default: 1,
					cols: 6,
					rules: [this.rules.required, this.validSlot],
					items: [...Array(maxSlots).keys()].map((i) => i + 1),
				},
				weekdays: {
					type: 'list',
					autocomplete: true,
					key: 'weekdays',
					label: 'Weekdays',
					default: this.weekdays.map((w) => w.value),
					rules: [this.rules.required],
					items: this.weekdays,
					multiple: true,
				},
				startHour: {
					type: 'list',
					autocomplete: true,
					key: 'startHour',
					label: 'Start Hour',
					default: 0,
					cols: 6,
					rules: [this.rules.required],
					items: [...Array(24).keys()],
				},
				startMinute: {
					type: 'list',
					autocomplete: true,
					key: 'startMinute',
					label: 'Start Minute',
					default: 0,
					cols: 6,
					rules: [this.rules.required],
					items: [...Array(60).keys()],
				},
				durationHour: {
					type: 'list',
					autocomplete: true,
					key: 'durationHour',
					label: 'Duration Hour',
					cols: 6,
					default: 0,
					rules: [this.rules.required],
					items: [...Array(24).keys()],
				},
				durationMinute: {
					type: 'list',
					autocomplete: true,
					key: 'durationMinute',
					label: 'Duration Minute',
					default: 0,
					cols: 6,
					rules: [this.rules.required],
					items: [...Array(60).keys()],
				},
				startYear: {
					type: 'list',
					autocomplete: true,
					key: 'startYear',
					label: 'Start Year',
					default: 0,
					cols: 6,
					rules: [this.rules.required],
					items: [...Array(100).keys()]
						.map((i) => i + 2000)
						.filter((i) => i >= actualYear),
				},
				startMonth: {
					type: 'list',
					autocomplete: true,
					key: 'startMonth',
					label: 'Start Month',
					default: 1,
					cols: 6,
					rules: [this.rules.required],
					items: months,
				},
				startDay: {
					type: 'list',
					autocomplete: true,
					key: 'startDay',
					label: 'Start Day',
					default: 1,
					cols: 6,
					rules: [this.rules.required],
					items: [...Array(31).keys()].map((i) => i + 1),
				},
			}

			let toReturn = []

			if (this.mode === 'daily') {
				toReturn = [
					inputs.weekdays,
					inputs.startHour,
					inputs.startMinute,
					inputs.durationHour,
					inputs.durationMinute,
				]
			} else if (this.mode === 'weekly') {
				toReturn = [
					{
						...inputs.weekdays,
						key: 'weekday',
						multiple: false,
						default: 1,
					},
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
			} else if (this.mode === 'yearly') {
				toReturn = [
					inputs.startYear,
					inputs.startMonth,
					inputs.startDay,
					inputs.startHour,
					inputs.startMinute,
					{
						...inputs.startYear,
						key: 'stopYear',
						label: 'Stop Year',
					},
					{
						...inputs.startMonth,
						key: 'stopMonth',
						label: 'Stop Month',
					},
					{ ...inputs.startDay, key: 'stopDay', label: 'Stop Day' },
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

			if (!slot) {
				toReturn.unshift(inputs.slotId)
			}

			return toReturn
		},
		async editSlot(slot) {
			let values = {}
			if (slot) {
				values = copy(slot)

				if (values.startYear) {
					values.startYear += 2000
					values.stopYear += 2000
				}
			}

			const res = await this.app.confirm(
				slot ? 'Edit slot' : 'New slot',
				'',
				'info',
				{
					width: 900,
					inputs: this.getInputs(slot),
					confirmText: slot ? 'Edit' : 'Add',
					values,
				},
			)

			if (Object.keys(res).length === 0) {
				return
			}

			if (slot) {
				res.slotId = slot.slotId
			}

			if (res.startYear) {
				res.startYear -= 2000
				res.stopYear -= 2000
			}

			if (slot) {
				Object.assign(slot, res)
			}

			const response = await this.app.apiRequest('setSchedule', [
				this.node.id,
				this.mode,
				{ ...res, userId: this.user.id },
			])

			if (response.success) {
				this.showSnackbar('Slot saved', 'success')
			}
		},
	},
}
</script>

<style></style>
