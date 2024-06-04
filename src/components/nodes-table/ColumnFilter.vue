<template>
	<v-menu :value="show" :close-on-content-click="false" :offset-y="true">
		<template v-slot:activator="{ on, attrs }">
			<v-icon
				small
				v-on:click="showOptions"
				v-bind="attrs"
				v-on="on"
				title="Filter options..."
				style="padding-right: 2px; padding-bottom: 3px"
			>
				{{ hasFilter ? 'filter_list_alt' : 'filter_list' }}
			</v-icon>
		</template>
		<v-card>
			<v-icon small v-on:click="hideOptions" right>close</v-icon>
			<column-filter-boolean
				v-if="column.type == 'boolean'"
				:value="value"
				@change="change"
			></column-filter-boolean>
			<column-filter-date
				v-if="column.type == 'date'"
				:value="value"
				@change="change"
			></column-filter-date>
			<column-filter-number
				v-if="column.type == 'number'"
				:value="value"
				:items="items"
				@change="change"
			></column-filter-number>
			<column-filter-string
				v-if="column.type == 'string'"
				:value="value"
				:items="items"
				@change="change"
			></column-filter-string>
			<v-checkbox
				v-if="column.groupable != false"
				label="Group values"
				class="ml-4"
				:value="groupBy"
				@change="$emit('update:group-by', $event ? [column.value] : [])"
			></v-checkbox>
			<v-card-actions>
				<v-btn @click="clearFilter">Clear</v-btn>
				<v-btn color="primary" @click="confirm" :disabled="!valid"
					>Ok</v-btn
				>
			</v-card-actions>
		</v-card>
	</v-menu>
</template>

<script>
import ColumnFilterHelper from '@/modules/ColumnFilterHelper'

export default {
	components: {
		ColumnFilterBoolean: () => import('./ColumnFilterBoolean.vue'),
		ColumnFilterDate: () => import('./ColumnFilterDate.vue'),
		ColumnFilterNumber: () => import('./ColumnFilterNumber.vue'),
		ColumnFilterString: () => import('./ColumnFilterString.vue'),
	},
	props: {
		value: {
			type: Object,
			default: () => {},
			required: true,
		},
		column: {
			type: Object,
			default: () => {},
			required: true,
		},
		items: {
			type: Array,
			default: () => [],
			required: true,
		},
		groupBy: {
			type: Boolean,
			default: () => false,
			required: false,
		},
	},
	data() {
		return {
			valid: true,
			show: false,
		}
	},
	computed: {
		hasFilter() {
			return this.hasDeepValue(this.value)
		},
	},
	methods: {
		hasDeepValue(obj) {
			return (
				obj !== undefined &&
				obj !== null &&
				Object.keys(obj).some(
					(k) =>
						(!!obj[k] && !!Object.keys(obj[k]).length) ||
						typeof obj[k] === 'boolean',
				)
			)
		},
		showOptions() {
			this.show = true
		},
		hideOptions() {
			this.show = false
		},
		change(value, valid) {
			this.valid = valid
			if (valid === true) {
				// Emit minimal storable filter spec (with empty default values removed):
				this.$emit(
					'change',
					ColumnFilterHelper.filterSpec(this.column.type, value),
				)
			}
		},
		confirm() {
			this.hideOptions()
		},
		resetToDefaults() {
			// Non-destructive value reset to prevent vue warnings:
			const defaults = ColumnFilterHelper.defaultFilter(this.column.type)
			Object.assign(this.value, defaults)
			for (const key in this.value) {
				if (Object.hasOwnProperty.call(this.value, key)) {
					Object.keys(this.value).forEach(() => {
						if (!Object.keys(defaults).includes(key)) {
							delete this.value.key
						}
					})
				}
			}
		},
		clearFilter() {
			this.resetToDefaults()
			this.change(this.value, true)
		},
	},
}
</script>
