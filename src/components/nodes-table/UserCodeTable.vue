<template>
	<v-data-table
		:headers="headers"
		:items="userCodes"
		:items-per-page="-1"
		:mobile-breakpoint="0"
		:footer-props="{
			showFirstLastPage: true,
		}"
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
	</v-data-table>
</template>

<script>
const DIALOG_HASH = '#usercodes'

export default {
	props: { node: Object, values: Array },
	data() {
		return {
			headers: [
				{ text: 'Index', value: 'id' },
				{ text: 'Code', value: 'code' },
				{ text: 'Status', value: 'status' },
			],
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
	watch: {
		value(val) {
			if (val) {
				this.$router.push(DIALOG_HASH)
			} else if (this.$route.hash === DIALOG_HASH) {
				this.$router.back()
			}
		},
		'$route.hash': function hash(newHash, oldHash) {
			if (newHash === DIALOG_HASH) {
				this._open = true
			} else if (oldHash === DIALOG_HASH) {
				this._open = false
			}
		},
	},
	computed: {
		userCodes() {
			if (!this.values) return []
			const toReturn = []

			for (const v of this.values) {
				const id = v.propertyKey
				const code = toReturn[id] || { id }
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
		getStatus(status) {
			return this.statuses.find((s) => s.value === status)?.text
		},
		async setUserCode(item) {
			const code = this.newCode
			const valueId = this.values.find(
				(v) => v.propertyKey === item.id && v.property === 'userCode'
			)

			if (!valueId) return

			valueId.newValue = code

			this.$emit('updateValue', valueId)
		},
		async setUserStatus(item) {
			const status = this.newStatus
			const valueId = this.values.find(
				(v) =>
					v.propertyKey === item.id && v.property === 'userIdStatus'
			)

			if (!valueId) return

			valueId.newValue = status

			this.$emit('updateValue', valueId)
		},
	},
}
</script>
